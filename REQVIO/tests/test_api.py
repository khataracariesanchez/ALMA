from datetime import datetime, timedelta, timezone

import pymupdf
import pytest
from fastapi.testclient import TestClient

import main
from reqvio import ai
from reqvio.db import connect


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv('REQVIO_DB', str(tmp_path / 'test.db'))
    monkeypatch.setenv('ADMIN_TOKEN', 'test-admin')
    with TestClient(main.app) as client:
        yield client


def register(client, email='leader@example.com'):
    r = client.post('/auth/signup', json={'name': 'Student', 'email': email, 'password': 'secure-password'})
    assert r.status_code == 201, r.text
    return {'Authorization': 'Bearer ' + r.json()['access_token']}, r.json()['user']['id']


def workspace(client, headers):
    r = client.post('/workspaces', headers=headers, json={'title': 'Research'})
    assert r.status_code == 201, r.text
    return r.json()


def pdf(text):
    with pymupdf.open() as doc:
        page = doc.new_page()
        page.insert_text((50, 50), text)
        return doc.tobytes()


def upload(client, h, wid, text='Our methodology uses a student survey.', kind='draft', parent=None):
    data = {'kind': kind}
    if parent:
        data['parent_id'] = parent
    return client.post(f'/workspaces/{wid}/documents', headers=h, data=data,
                       files={'file': ('research.pdf', pdf(text), 'application/pdf')})


def upgrade(client, user_id):
    expiry = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    r = client.put(f'/admin/users/{user_id}/subscription', headers={'X-Admin-Token': 'test-admin'},
                   json={'plan': 'premium', 'expires_at': expiry})
    assert r.status_code == 200, r.text


def test_auth_and_workspace_isolation(client):
    h, _ = register(client)
    other, _ = register(client, 'other@example.com')
    w = workspace(client, h)
    assert client.get(f"/workspaces/{w['id']}", headers=other).status_code == 404
    assert client.get('/auth/me').status_code in (401, 403)
    assert client.post('/auth/login', json={'email': 'leader@example.com', 'password': 'wrong'}).status_code == 401
    assert client.post('/auth/login', json={'email': 'leader@example.com', 'password': 'secure-password'}).status_code == 200
    assert client.post('/auth/logout', headers=h).status_code == 204
    assert client.get('/auth/me', headers=h).status_code == 401


def test_limits_and_premium(client):
    h, user_id = register(client)
    w = workspace(client, h)
    for i in range(4):
        assert client.post('/workspaces', headers=h, json={
            'title': f'Additional project {i}', 'mode': 'solo' if i % 2 else 'group'}).status_code == 201
    assert client.post('/workspaces', headers=h, json={'title': 'Sixth'}).status_code == 403
    for _ in range(30):
        assert upload(client, h, w['id']).status_code == 201
    assert upload(client, h, w['id']).status_code == 403
    assert client.get(f"/workspaces/{w['id']}/reports/pdf", headers=h).status_code == 403
    assert client.put(f'/admin/users/{user_id}/subscription', json={'plan': 'free'}).status_code == 403
    upgrade(client, user_id)
    assert client.post('/workspaces', headers=h, json={'title': 'Second'}).status_code == 201
    assert upload(client, h, w['id']).status_code == 201
    r = client.get(f"/workspaces/{w['id']}/reports/pdf", headers=h)
    assert r.status_code == 200 and r.content.startswith(b'%PDF')


def test_members_and_task_permissions(client):
    h, _ = register(client)
    w = workspace(client, h)
    member, member_id = register(client, 'member@example.com')
    second, _ = register(client, 'second@example.com')
    third, _ = register(client, 'third@example.com')
    for who in (member, second):
        assert client.post('/workspaces/join', headers=who, json={'code': w['invite']}).status_code == 200
    fourth, _ = register(client, 'fourth@example.com')
    fifth, _ = register(client, 'fifth@example.com')
    for who in (third, fourth):
        assert client.post('/workspaces/join', headers=who, json={'code': w['invite']}).status_code == 200
    assert client.post('/workspaces/join', headers=fifth, json={'code': w['invite']}).status_code == 403
    task = client.post(f"/workspaces/{w['id']}/tasks", headers=h,
                       json={'title': 'Methodology', 'assignee_id': member_id}).json()
    path = f"/workspaces/{w['id']}/tasks/{task['id']}"
    assert client.patch(path, headers=second, json={'status': 'completed'}).status_code == 403
    assert client.patch(path, headers=member, json={'status': 'completed'}).status_code == 200
    assert upload(client, member, w['id'], kind='rubric').status_code == 403
    assert 'invite' not in client.get(f"/workspaces/{w['id']}", headers=member).json()


def test_review_quota_citations_and_refund(client, monkeypatch):
    h, _ = register(client)
    w = workspace(client, h)
    did = upload(client, h, w['id']).json()['id']
    client.post(f"/workspaces/{w['id']}/requirements", headers=h, json={'description': 'Describe methodology'})

    def generated(instruction, payload):
        passage = payload['evidence'][0]
        return {'status': 'Met', 'explanation': 'Survey described', 'recommendation': 'Add sampling details',
                'citations': [{'passage_id': passage['id'], 'quote': 'student survey'}]}

    monkeypatch.setattr(ai, 'generate', generated)
    path = f"/workspaces/{w['id']}/reviews"
    for _ in range(30):
        response = client.post(path, headers=h, json={'document_id': did})
        assert response.status_code == 201, response.text
        finding = response.json()['findings'][0]
        assert finding['status'] == 'Met' and finding['citations'][0]['page'] == 1
        assert 'recommendation' not in finding
        document = client.get(f"/workspaces/{w['id']}/documents", headers=h).json()[0]
        assert document['last_reviewed_at']
        assert document['review_count'] >= 1
    assert client.post(path, headers=h, json={'document_id': did}).status_code == 403
    with connect(True) as db:
        db.execute('UPDATE usage SET checks=0')
    def broken(*args):
        raise main.HTTPException(502, 'Unavailable')
    monkeypatch.setattr(ai, 'generate', broken)
    assert client.post(path, headers=h, json={'document_id': did}).status_code == 502
    assert client.get('/subscription', headers=h).json()['checks_used'] == 0


def test_fabricated_citations_are_rejected(monkeypatch):
    monkeypatch.setattr(ai, 'generate', lambda *args: {
        'status': 'Met', 'citations': [{'passage_id': 'unknown', 'quote': 'invented'}]})
    finding = ai.check_requirement({'id': 'r', 'description': 'Methodology'},
                                   [{'id': 'p', 'document_id': 'd', 'filename': 'draft.pdf', 'page': 1,
                                     'text': 'Our methodology describes a survey.'}])
    assert finding['status'] == 'Needs Review' and finding['citations'] == []


def test_cross_workspace_sources_and_revision(client, monkeypatch):
    h, user_id = register(client)
    upgrade(client, user_id)
    a = workspace(client, h)
    b = workspace(client, h)
    did = upload(client, h, a['id']).json()['id']
    assert client.get(f"/workspaces/{b['id']}/documents/{did}/passages", headers=h).status_code == 404
    assert upload(client, h, b['id'], parent=did).status_code == 404
    newer = upload(client, h, a['id'], 'Our revised methodology includes sampling.', parent=did).json()
    assert newer['version'] == 2
    monkeypatch.setattr(ai, 'generate', lambda *args: {'summary': 'Sampling added'})
    response = client.post(f"/workspaces/{a['id']}/comparisons", headers=h,
                           json={'old_document_id': did, 'new_document_id': newer['id']})
    assert response.status_code == 200 and response.json()['diff']


def test_upload_validation(client):
    h, _ = register(client)
    w = workspace(client, h)
    r = client.post(f"/workspaces/{w['id']}/documents", headers=h, data={'kind': 'draft'},
                    files={'file': ('fake.pdf', b'%PDF-invalid', 'application/pdf')})
    assert r.status_code == 422


def test_expiration_and_history_gate(client):
    h, user_id = register(client)
    upgrade(client, user_id)
    w = workspace(client, h)
    did = upload(client, h, w['id']).json()['id']
    with connect(True) as db:
        for i in range(5):
            db.execute('INSERT INTO reviews VALUES (?,?,?,?,?,?)',
                       (str(i), w['id'], did, user_id, f'2026-01-0{i+1}T00:00:00+00:00', '[]'))
    assert len(client.get(f"/workspaces/{w['id']}/reviews", headers=h).json()) == 5
    with connect(True) as db:
        db.execute('UPDATE users SET premium_until=? WHERE id=?', ('2000-01-01T00:00:00+00:00', user_id))
    assert client.get('/subscription', headers=h).json()['plan'] == 'free'
    assert len(client.get(f"/workspaces/{w['id']}/reviews", headers=h).json()) == 3
    assert client.get(f"/workspaces/{w['id']}/reviews/0", headers=h).status_code == 404


def test_requirement_extraction_validates_source(client, monkeypatch):
    h, _ = register(client)
    w = workspace(client, h)
    did = upload(client, h, w['id'], 'Describe your methodology.', 'rubric').json()['id']
    monkeypatch.setattr(ai, 'generate', lambda *args: {
        'requirements': [{'description': 'Describe methodology', 'passage_id': 'invented'}]})
    path = f"/workspaces/{w['id']}/requirements/extract"
    assert client.post(path, headers=h, json={'document_id': did}).status_code == 502
    passage = client.get(f"/workspaces/{w['id']}/documents/{did}/passages", headers=h).json()[0]
    monkeypatch.setattr(ai, 'generate', lambda *args: {
        'requirements': [{'description': 'Describe methodology', 'passage_id': passage['id']}]})
    assert client.post(path, headers=h, json={'document_id': did}).status_code == 200


def test_questions_reject_invented_evidence(client, monkeypatch):
    h, _ = register(client)
    w = workspace(client, h)
    did = upload(client, h, w['id']).json()['id']
    monkeypatch.setattr(ai, 'generate', lambda *args: {
        'answer': 'Unsupported claim', 'citations': [{'passage_id': 'fake', 'quote': 'invented'}]})
    r = client.post(f"/workspaces/{w['id']}/questions", headers=h,
                    json={'question': 'What methodology is used?', 'document_id': did})
    assert r.status_code == 200 and r.json()['citations'] == []
    assert 'Unsupported claim' not in r.json()['answer']


def test_frontend_is_served_without_exposing_private_files(client):
    response = client.get('/')
    assert response.status_code == 200 and '<title>Reqvio</title>' in response.text
    for name in ('app.js', 'integration.js', 'premium.js', 'styles.css', 'premium.css'):
        assert client.get('/' + name).status_code == 200
    for path in ('/.env', '/main.py', '/data/reqvio.db'):
        assert client.get(path).status_code == 404


def test_profile_edit_persists_and_rejects_duplicate_email(client):
    h, _ = register(client)
    register(client, 'other@example.com')
    response = client.patch('/auth/me', headers=h, json={'name': 'Research Leader', 'email': 'new@example.com'})
    assert response.status_code == 200 and response.json()['name'] == 'Research Leader'
    assert client.get('/auth/me', headers=h).json()['email'] == 'new@example.com'
    assert client.patch('/auth/me', headers=h, json={'name': 'Student', 'email': 'other@example.com'}).status_code == 409


@pytest.mark.parametrize('target', ['signup', 'workspace', 'requirement', 'task'])
def test_whitespace_only_labels_are_rejected(client, target):
    if target == 'signup':
        response = client.post('/auth/signup', json={
            'name': '   ', 'email': 'blank@example.com', 'password': 'secure-password'})
    else:
        h, _ = register(client)
        if target == 'workspace':
            response = client.post('/workspaces', headers=h, json={'title': '   '})
        else:
            w = workspace(client, h)
            response = client.post(f"/workspaces/{w['id']}/" + ('requirements' if target == 'requirement' else 'tasks'),
                                   headers=h, json={'description': '   '} if target == 'requirement' else {'title': '   '})
    assert response.status_code == 422, f'{target} must reject labels that become empty after trimming'


def test_solo_workspace_is_private_and_tasks_are_personal(client):
    h, owner_id = register(client)
    other, _ = register(client, 'other@example.com')
    response = client.post('/workspaces', headers=h, json={'title': 'My thesis', 'mode': 'solo'})
    assert response.status_code == 201
    w = response.json()
    assert w['mode'] == 'solo'
    assert client.get('/workspaces', headers=h).json()[0]['mode'] == 'solo'
    assert client.post(f"/workspaces/{w['id']}/invite", headers=h).status_code == 403
    assert client.post('/workspaces/join', headers=other, json={'code': w['invite']}).status_code == 403
    assert client.get(f"/workspaces/{w['id']}", headers=other).status_code == 404
    task = client.post(f"/workspaces/{w['id']}/tasks", headers=h, json={'title': 'Write introduction'})
    assert task.status_code == 201 and task.json()['assignee_id'] == owner_id
    assert upload(client, h, w['id']).status_code == 201
    assert client.post(f"/workspaces/{w['id']}/requirements", headers=h,
                       json={'description': 'Explain methodology'}).status_code == 201
    assert client.get(f"/workspaces/{w['id']}/reports/summary", headers=h).status_code == 200


def test_solo_can_explicitly_convert_to_group_without_losing_work(client):
    h, _ = register(client)
    other, _ = register(client, 'other@example.com')
    w = client.post('/workspaces', headers=h, json={'title': 'My thesis', 'mode': 'solo'}).json()
    client.post(f"/workspaces/{w['id']}/tasks", headers=h, json={'title': 'Write introduction'})
    client.patch(f"/workspaces/{w['id']}", headers=h, json={'title': 'Updated thesis'})
    assert client.get(f"/workspaces/{w['id']}", headers=h).json()['mode'] == 'solo'
    path = f"/workspaces/{w['id']}/convert-to-group"
    assert client.post(path, headers=other).status_code == 404
    assert client.post(path, headers=h).status_code == 200
    assert client.post(path, headers=h).status_code == 200  # safe retry
    assert client.get(f"/workspaces/{w['id']}", headers=h).json()['mode'] == 'group'
    assert len(client.get(f"/workspaces/{w['id']}/tasks", headers=h).json()) == 1
    invite = client.post(f"/workspaces/{w['id']}/invite", headers=h).json()['code']
    assert client.post('/workspaces/join', headers=other, json={'code': invite}).status_code == 200


def test_legacy_workspace_migration_preserves_existing_projects(tmp_path, monkeypatch):
    import sqlite3
    from reqvio.db import initialize
    path = tmp_path / 'legacy.db'
    monkeypatch.setenv('REQVIO_DB', str(path))
    with sqlite3.connect(path) as db:
        db.execute('CREATE TABLE workspaces (id TEXT PRIMARY KEY, owner_id TEXT, title TEXT, '
                   'description TEXT, invite TEXT, created TEXT)')
        db.execute("INSERT INTO workspaces VALUES ('old','owner','Existing team','Keep me','code','2026')")
    initialize()
    initialize()
    with sqlite3.connect(path) as db:
        assert db.execute("SELECT title,description,mode FROM workspaces WHERE id='old'").fetchone() == (
            'Existing team', 'Keep me', 'group')
