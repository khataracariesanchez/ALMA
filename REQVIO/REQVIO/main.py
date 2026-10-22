"""Reqvio API. Run: uvicorn main:app --reload"""
import hashlib
import hmac
import json
import os
import secrets
from pathlib import Path
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from difflib import unified_diff
from typing import Annotated, Literal
from uuid import uuid4

import pymupdf
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field, StringConstraints

from reqvio import ai
from reqvio.db import connect, initialize, rows

load_dotenv()


@asynccontextmanager
async def lifespan(app):
    initialize()
    yield


app = FastAPI(title='Reqvio API', version='1.0.0', lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=os.getenv(
    'CORS_ORIGINS', 'http://localhost:5173,http://localhost:3000').split(','),
    allow_credentials=False, allow_methods=['*'], allow_headers=['Authorization', 'Content-Type'])
bearer = HTTPBearer()
PLANS = {
    'free': {'checks_per_month': 2, 'documents': 2, 'file_mb': 5, 'workspaces': 1,
             'members': 5, 'tasks': 20, 'history': 3, 'detailed_feedback': False,
             'comparison': False, 'pdf_reports': False, 'detailed_dashboard': False},
    'premium': {'checks_per_month': 100, 'documents': 100, 'file_mb': 25, 'workspaces': 20,
                'members': 30, 'tasks': 1000, 'history': None, 'detailed_feedback': True,
                'comparison': True, 'pdf_reports': True, 'detailed_dashboard': True}}


def now():
    return datetime.now(timezone.utc).isoformat()


def uid():
    return str(uuid4())


def fail(status, message):
    raise HTTPException(status, message)


def one(db, sql, args=()):
    row = db.execute(sql, args).fetchone()
    if row is None:
        fail(404, 'Resource not found')
    return dict(row)


def current_user(auth: HTTPAuthorizationCredentials = Depends(bearer)):
    token = hashlib.sha256(auth.credentials.encode()).hexdigest()
    with connect() as db:
        result = rows(db, 'SELECT u.* FROM sessions s JOIN users u ON s.user_id=u.id '
                      'WHERE s.token=? AND s.expires>?', (token, now()))
    if not result:
        fail(401, 'Session expired or invalid')
    return result[0]


def plan(user):
    return 'premium' if user['plan'] == 'premium' and user['premium_until'] and user['premium_until'] > now() else 'free'


def public(user):
    return {k: user[k] for k in ('id', 'name', 'email', 'premium_until')} | {'plan': plan(user)}


def access(db, workspace_id, user, leader=False):
    workspace = one(db, 'SELECT w.*, m.role FROM workspaces w JOIN memberships m '
                    'ON w.id=m.workspace_id WHERE w.id=? AND m.user_id=?', (workspace_id, user['id']))
    if leader and workspace['role'] != 'leader':
        fail(403, 'Workspace leader permission required')
    owner = one(db, 'SELECT * FROM users WHERE id=?', (workspace['owner_id'],))
    return workspace, PLANS[plan(owner)]


def premium(limits, feature):
    if not limits[feature]:
        fail(403, {'code': 'premium_required', 'feature': feature})


def limit(count, maximum, feature):
    if count >= maximum:
        fail(403, {'code': 'plan_limit', 'feature': feature, 'limit': maximum})


def count(db, sql, args):
    return db.execute(sql, args).fetchone()[0]


def event(db, workspace_id, user, action):
    db.execute('INSERT INTO events VALUES (?,?,?,?,?)', (uid(), workspace_id, user['id'], action, now()))


NonBlank = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class Signup(BaseModel):
    name: NonBlank = Field(max_length=100)
    email: str = Field(min_length=3, max_length=254, pattern=r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
    password: str = Field(min_length=10, max_length=128)


class Login(BaseModel):
    email: str
    password: str = Field(max_length=128)


def password_hash(password, salt):
    return hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex()


def session(db, user):
    raw = secrets.token_urlsafe(32)
    db.execute('INSERT INTO sessions VALUES (?,?,?)',
               (hashlib.sha256(raw.encode()).hexdigest(), user['id'],
                (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()))
    return {'access_token': raw, 'token_type': 'bearer', 'user': public(user)}


@app.get('/health')
def health():
    return {'status': 'ok', 'ai_configured': all(os.getenv(k) for k in ('ALMA_URL', 'ALMA_API_KEY', 'ALMA_MODEL'))}


@app.post('/auth/signup', status_code=201)
def signup(body: Signup):
    with connect(True) as db:
        email = body.email.strip().lower()
        if rows(db, 'SELECT id FROM users WHERE email=?', (email,)):
            fail(409, 'Email already registered')
        salt = secrets.token_hex(16)
        user_id = uid()
        db.execute('INSERT INTO users (id,name,email,password) VALUES (?,?,?,?)',
                   (user_id, body.name.strip(), email, salt + ':' + password_hash(body.password, salt)))
        return session(db, one(db, 'SELECT * FROM users WHERE id=?', (user_id,)))


@app.post('/auth/login')
def login(body: Login):
    with connect(True) as db:
        found = rows(db, 'SELECT * FROM users WHERE email=?', (body.email.strip().lower(),))
        salt, expected = found[0]['password'].split(':') if found else ('00' * 16, '0' * 128)
        valid = hmac.compare_digest(password_hash(body.password, salt), expected)
        if not found or not valid:
            fail(401, 'Invalid email or password')
        return session(db, found[0])


@app.post('/auth/logout', status_code=204)
def logout(auth: HTTPAuthorizationCredentials = Depends(bearer), user=Depends(current_user)):
    with connect(True) as db:
        db.execute('DELETE FROM sessions WHERE token=?', (hashlib.sha256(auth.credentials.encode()).hexdigest(),))


@app.get('/auth/me')
def me(user=Depends(current_user)):
    return public(user)


class ProfileBody(BaseModel):
    name: NonBlank = Field(max_length=100)
    email: str = Field(min_length=3, max_length=254, pattern=r'^[^\s@]+@[^\s@]+\.[^\s@]+$')


@app.patch('/auth/me')
def edit_profile(body: ProfileBody, user=Depends(current_user)):
    with connect(True) as db:
        email = body.email.strip().lower()
        if rows(db, 'SELECT id FROM users WHERE email=? AND id<>?', (email, user['id'])):
            fail(409, 'Email already registered')
        if not body.name.strip():
            fail(422, 'Name cannot be blank')
        db.execute('UPDATE users SET name=?,email=? WHERE id=?', (body.name.strip(), email, user['id']))
        return public(one(db, 'SELECT * FROM users WHERE id=?', (user['id'],)))


@app.get('/plans')
def plans():
    return {'plans': PLANS, 'billing': 'Administrator-provisioned; payment checkout is not configured.'}


@app.get('/subscription')
def subscription(user=Depends(current_user)):
    with connect() as db:
        used = rows(db, 'SELECT checks FROM usage WHERE owner_id=? AND month=?', (user['id'], now()[:7]))
    return {'plan': plan(user), 'limits': PLANS[plan(user)], 'checks_used': used[0]['checks'] if used else 0,
            'month': now()[:7], 'premium_until': user['premium_until']}


class Provision(BaseModel):
    plan: Literal['free', 'premium']
    expires_at: datetime | None = None


@app.put('/admin/users/{user_id}/subscription')
def provision(user_id: str, body: Provision, x_admin_token: str = Header(default='')):
    expected = os.getenv('ADMIN_TOKEN', '')
    if not expected or not hmac.compare_digest(expected, x_admin_token):
        fail(403, 'Administrator credentials required')
    expiry = body.expires_at
    if body.plan == 'premium' and (not expiry or expiry.tzinfo is None or expiry <= datetime.now(timezone.utc)):
        fail(422, 'Premium requires a future timezone-aware expires_at')
    with connect(True) as db:
        one(db, 'SELECT id FROM users WHERE id=?', (user_id,))
        db.execute('UPDATE users SET plan=?,premium_until=? WHERE id=?',
                   (body.plan, expiry.astimezone(timezone.utc).isoformat() if body.plan == 'premium' else None, user_id))
    return {'updated': True}


class WorkspaceBody(BaseModel):
    title: NonBlank = Field(max_length=200)
    description: str = Field(default='', max_length=4000)


@app.post('/workspaces', status_code=201)
def create_workspace(body: WorkspaceBody, user=Depends(current_user)):
    with connect(True) as db:
        limit(count(db, 'SELECT count(*) FROM workspaces WHERE owner_id=?', (user['id'],)),
              PLANS[plan(user)]['workspaces'], 'workspaces')
        workspace_id = uid()
        db.execute('INSERT INTO workspaces VALUES (?,?,?,?,?,?)',
                   (workspace_id, user['id'], body.title, body.description, secrets.token_urlsafe(18), now()))
        db.execute('INSERT INTO memberships VALUES (?,?,?)', (workspace_id, user['id'], 'leader'))
        return one(db, 'SELECT * FROM workspaces WHERE id=?', (workspace_id,))


@app.get('/workspaces')
def workspaces(user=Depends(current_user)):
    with connect() as db:
        return rows(db, 'SELECT w.id,w.title,w.description,w.owner_id,w.created,m.role FROM workspaces w '
                    'JOIN memberships m ON w.id=m.workspace_id WHERE m.user_id=?', (user['id'],))


class Join(BaseModel):
    code: str = Field(min_length=1, max_length=100)


@app.post('/workspaces/join')
def join(body: Join, user=Depends(current_user)):
    with connect(True) as db:
        w = one(db, 'SELECT * FROM workspaces WHERE invite=?', (body.code,))
        if rows(db, 'SELECT * FROM memberships WHERE workspace_id=? AND user_id=?', (w['id'], user['id'])):
            return {'workspace_id': w['id'], 'joined': False}
        owner = one(db, 'SELECT * FROM users WHERE id=?', (w['owner_id'],))
        limit(count(db, 'SELECT count(*) FROM memberships WHERE workspace_id=?', (w['id'],)),
              PLANS[plan(owner)]['members'], 'members')
        db.execute('INSERT INTO memberships VALUES (?,?,?)', (w['id'], user['id'], 'member'))
        event(db, w['id'], user, 'joined')
        return {'workspace_id': w['id'], 'joined': True}


@app.get('/workspaces/{wid}')
def workspace(wid: str, user=Depends(current_user)):
    with connect() as db:
        w, limits = access(db, wid, user)
        if w['role'] != 'leader':
            w.pop('invite')
        return w | {'limits': limits}


@app.patch('/workspaces/{wid}')
def edit_workspace(wid: str, body: WorkspaceBody, user=Depends(current_user)):
    with connect(True) as db:
        access(db, wid, user, True)
        db.execute('UPDATE workspaces SET title=?,description=? WHERE id=?', (body.title, body.description, wid))
    return {'updated': True}


@app.post('/workspaces/{wid}/invite')
def rotate_invite(wid: str, user=Depends(current_user)):
    with connect(True) as db:
        access(db, wid, user, True)
        code = secrets.token_urlsafe(18)
        db.execute('UPDATE workspaces SET invite=? WHERE id=?', (code, wid))
        return {'code': code}


@app.get('/workspaces/{wid}/members')
def members(wid: str, user=Depends(current_user)):
    with connect() as db:
        access(db, wid, user)
        return rows(db, 'SELECT u.id,u.name,m.role FROM memberships m JOIN users u ON u.id=m.user_id '
                    'WHERE m.workspace_id=?', (wid,))


@app.delete('/workspaces/{wid}/members/{member_id}', status_code=204)
def remove_member(wid: str, member_id: str, user=Depends(current_user)):
    with connect(True) as db:
        w, _ = access(db, wid, user, True)
        if member_id == w['owner_id']:
            fail(409, 'The owner cannot be removed')
        db.execute('UPDATE tasks SET assignee_id=NULL WHERE workspace_id=? AND assignee_id=?', (wid, member_id))
        db.execute('DELETE FROM memberships WHERE workspace_id=? AND user_id=?', (wid, member_id))
        event(db, wid, user, 'removed member')


def document_passages(db, wid, document_id):
    return rows(db, 'SELECT p.*,d.filename FROM passages p JOIN documents d ON d.id=p.document_id '
                'WHERE d.workspace_id=? AND d.id=? ORDER BY p.page,p.rowid', (wid, document_id))


@app.post('/workspaces/{wid}/documents', status_code=201)
def upload(wid: str, file: UploadFile = File(...),
           kind: Literal['rubric', 'instructions', 'draft', 'reference'] = Form(...),
           parent_id: str | None = Form(None), user=Depends(current_user)):
    with connect() as db:
        w, limits = access(db, wid, user)
    if w['role'] != 'leader' and kind in ('rubric', 'instructions'):
        fail(403, 'Only leaders may upload rubrics or instructions')
    content = file.file.read(limits['file_mb'] * 1024 * 1024 + 1)
    if len(content) > limits['file_mb'] * 1024 * 1024:
        fail(413, 'File exceeds plan upload size')
    filename = (file.filename or 'document.pdf').replace('\\', '/').split('/')[-1][:200]
    if not filename.lower().endswith('.pdf') or not content.startswith(b'%PDF-'):
        fail(415, 'Only PDF files are supported')
    try:
        with pymupdf.open(stream=content, filetype='pdf') as pdf:
            if pdf.is_encrypted or len(pdf) > 300:
                fail(422, 'Use an unencrypted PDF with at most 300 pages')
            pages = [(i + 1, page.get_text()) for i, page in enumerate(pdf)]
    except HTTPException:
        raise
    except Exception:
        fail(422, 'Unreadable PDF')
    if not any(text.strip() for _, text in pages):
        fail(422, 'PDF has no selectable text. OCR is not supported.')
    if sum(len(text) for _, text in pages) > 1_000_000:
        fail(422, 'PDF contains too much extracted text')
    with connect(True) as db:
        _, limits = access(db, wid, user)
        limit(count(db, 'SELECT count(*) FROM documents WHERE workspace_id=?', (wid,)), limits['documents'], 'documents')
        version = 1
        if parent_id:
            parent = one(db, 'SELECT * FROM documents WHERE id=? AND workspace_id=?', (parent_id, wid))
            if parent['kind'] != kind or kind != 'draft':
                fail(422, 'Revisions must reference a draft in this workspace')
            if rows(db, 'SELECT id FROM documents WHERE parent_id=?', (parent_id,)):
                fail(409, 'This draft already has a revision; use the latest version')
            version = parent['version'] + 1
        doc_id = uid()
        db.execute('INSERT INTO documents VALUES (?,?,?,?,?,?,?,?,?,?)',
                   (doc_id, wid, user['id'], filename, kind, version, parent_id, len(content), content, now()))
        for page, text in pages:
            words = text.split()
            for start in range(0, len(words), 180):
                db.execute('INSERT INTO passages VALUES (?,?,?,?)',
                           (uid(), doc_id, page, ' '.join(words[start:start + 220])))
        event(db, wid, user, 'uploaded document')
        return {'id': doc_id, 'filename': filename, 'kind': kind, 'version': version, 'pages': len(pages)}


@app.get('/workspaces/{wid}/documents')
def documents(wid: str, user=Depends(current_user)):
    with connect() as db:
        access(db, wid, user)
        return rows(db, 'SELECT id,filename,kind,version,parent_id,size,created,user_id FROM documents '
                    'WHERE workspace_id=? ORDER BY created DESC', (wid,))


@app.get('/workspaces/{wid}/documents/{doc_id}/passages')
def passages(wid: str, doc_id: str, user=Depends(current_user)):
    with connect() as db:
        access(db, wid, user)
        one(db, 'SELECT id FROM documents WHERE workspace_id=? AND id=?', (wid, doc_id))
        return document_passages(db, wid, doc_id)


@app.get('/workspaces/{wid}/documents/{doc_id}/file')
def download(wid: str, doc_id: str, user=Depends(current_user)):
    with connect() as db:
        access(db, wid, user)
        doc = one(db, 'SELECT content FROM documents WHERE workspace_id=? AND id=?', (wid, doc_id))
    return Response(bytes(doc['content']), media_type='application/pdf',
                    headers={'Content-Disposition': 'inline; filename="document.pdf"'})


@app.delete('/workspaces/{wid}/documents/{doc_id}', status_code=204)
def delete_document(wid: str, doc_id: str, user=Depends(current_user)):
    with connect(True) as db:
        access(db, wid, user, True)
        one(db, 'SELECT id FROM documents WHERE id=? AND workspace_id=?', (doc_id, wid))
        if rows(db, 'SELECT id FROM reviews WHERE document_id=?', (doc_id,)) or rows(
                db, 'SELECT id FROM documents WHERE parent_id=?', (doc_id,)):
            fail(409, 'Reviewed drafts and parent versions must be retained for evidence history')
        if rows(db, 'SELECT r.id FROM requirements r JOIN passages p ON r.passage_id=p.id '
                    'WHERE p.document_id=?', (doc_id,)):
            fail(409, 'Remove linked requirements before deleting their source rubric')
        db.execute('DELETE FROM documents WHERE id=?', (doc_id,))
        event(db, wid, user, 'deleted document')


class RequirementBody(BaseModel):
    description: NonBlank = Field(max_length=3000)
    passage_id: str | None = None


@app.get('/workspaces/{wid}/requirements')
def requirements(wid: str, user=Depends(current_user)):
    with connect() as db:
        access(db, wid, user)
        return rows(db, 'SELECT * FROM requirements WHERE workspace_id=?', (wid,))


@app.post('/workspaces/{wid}/requirements', status_code=201)
def add_requirement(wid: str, body: RequirementBody, user=Depends(current_user)):
    with connect(True) as db:
        access(db, wid, user, True)
        limit(count(db, 'SELECT count(*) FROM requirements WHERE workspace_id=?', (wid,)), 100, 'requirements')
        if body.passage_id:
            one(db, 'SELECT p.id FROM passages p JOIN documents d ON d.id=p.document_id '
                "WHERE p.id=? AND d.workspace_id=? AND d.kind IN ('rubric','instructions')", (body.passage_id, wid))
        rid = uid()
        db.execute('INSERT INTO requirements VALUES (?,?,?,?)', (rid, wid, body.description, body.passage_id))
        return {'id': rid, **body.model_dump()}


@app.delete('/workspaces/{wid}/requirements/{rid}', status_code=204)
def delete_requirement(wid: str, rid: str, user=Depends(current_user)):
    with connect(True) as db:
        access(db, wid, user, True)
        db.execute('DELETE FROM requirements WHERE workspace_id=? AND id=?', (wid, rid))


class ReviewBody(BaseModel):
    document_id: str


@app.post('/workspaces/{wid}/requirements/extract')
def extract_requirements(wid: str, body: ReviewBody, user=Depends(current_user)):
    with connect() as db:
        access(db, wid, user, True)
        one(db, "SELECT id FROM documents WHERE workspace_id=? AND id=? AND kind IN ('rubric','instructions')",
            (wid, body.document_id))
        sources = document_passages(db, wid, body.document_id)
    if len(sources) > 80:
        fail(422, 'Rubric too long for automatic extraction; enter requirements manually')
    result = ai.generate('Extract individual assessable rubric requirements. Return '
                         '{"requirements":[{"description":"...","passage_id":"source passage id"}]}. '
                         'Each requirement must cite a supplied source passage. Maximum 50 requirements.', sources)
    if not isinstance(result, dict) or not isinstance(result.get('requirements'), list):
        fail(502, 'Invalid extracted requirements')
    allowed = {p['id'] for p in sources}
    extracted = result['requirements']
    if not extracted or len(extracted) > 50 or any(
        not isinstance(r, dict) or r.get('passage_id') not in allowed or
        not isinstance(r.get('description'), str) or not 1 <= len(r['description']) <= 3000 for r in extracted):
        fail(502, 'AI returned invalid requirement sources or descriptions')
    with connect(True) as db:
        access(db, wid, user, True)
        existing = count(db, 'SELECT count(*) FROM requirements WHERE workspace_id=?', (wid,))
        if existing + len(extracted) > 100:
            fail(422, 'Workspace supports at most 100 requirements')
        output = []
        for item in extracted:
            rid = uid()
            db.execute('INSERT INTO requirements VALUES (?,?,?,?)', (rid, wid, item['description'], item['passage_id']))
            output.append({'id': rid, **item})
        return output


def visible_findings(findings, limits):
    if limits['detailed_feedback']:
        return findings
    return [{k: v for k, v in f.items() if k != 'recommendation'} for f in findings]


@app.post('/workspaces/{wid}/reviews', status_code=201)
def run_review(wid: str, body: ReviewBody, user=Depends(current_user)):
    # Reserve quota atomically before the external call; refund on failure.
    month = now()[:7]
    with connect(True) as db:
        w, limits = access(db, wid, user, True)
        one(db, "SELECT id FROM documents WHERE id=? AND workspace_id=? AND kind='draft'", (body.document_id, wid))
        reqs = rows(db, 'SELECT * FROM requirements WHERE workspace_id=?', (wid,))
        if not reqs:
            fail(422, 'Add rubric requirements before running a review')
        source = document_passages(db, wid, body.document_id)
        used = rows(db, 'SELECT checks FROM usage WHERE owner_id=? AND month=?', (w['owner_id'], month))
        limit(used[0]['checks'] if used else 0, limits['checks_per_month'], 'checks_per_month')
        db.execute('INSERT INTO usage VALUES (?,?,1) ON CONFLICT(owner_id,month) DO UPDATE SET checks=checks+1',
                   (w['owner_id'], month))
    try:
        findings = [ai.check_requirement(r, source) for r in reqs]
        with connect(True) as db:
            access(db, wid, user, True)
            review_id = uid()
            db.execute('INSERT INTO reviews VALUES (?,?,?,?,?,?)',
                       (review_id, wid, body.document_id, user['id'], now(), json.dumps(findings)))
            event(db, wid, user, 'ran review')
        return {'id': review_id, 'findings': visible_findings(findings, limits), 'advisory': True}
    except Exception:
        with connect(True) as db:
            db.execute('UPDATE usage SET checks=MAX(0,checks-1) WHERE owner_id=? AND month=?', (w['owner_id'], month))
        raise


def history(db, wid, limits):
    sql = 'SELECT * FROM reviews WHERE workspace_id=? ORDER BY created DESC'
    return rows(db, sql + (' LIMIT 3' if limits['history'] else ''), (wid,))


@app.get('/workspaces/{wid}/reviews')
def reviews(wid: str, user=Depends(current_user)):
    with connect() as db:
        _, limits = access(db, wid, user)
        result = history(db, wid, limits)
        for r in result:
            r['findings'] = visible_findings(json.loads(r['findings']), limits)
        return result


@app.get('/workspaces/{wid}/reviews/{review_id}')
def review(wid: str, review_id: str, user=Depends(current_user)):
    return next((r for r in reviews(wid, user) if r['id'] == review_id), None) or fail(404, 'Review not available in your history')


class Question(BaseModel):
    question: str = Field(min_length=3, max_length=2000)
    document_id: str


@app.post('/workspaces/{wid}/questions')
def ask(wid: str, body: Question, user=Depends(current_user)):
    with connect() as db:
        access(db, wid, user)
        one(db, 'SELECT id FROM documents WHERE workspace_id=? AND id=?', (wid, body.document_id))
        evidence = ai.retrieve(body.question, document_passages(db, wid, body.document_id))
    result = ai.generate('Answer the question using only the supplied document evidence. '
                         'Return {"answer":"...","citations":[{"passage_id":"...","quote":"exact substring"}]}. '
                         'If evidence is insufficient, say so.', {'question': body.question, 'evidence': evidence})
    if not isinstance(result, dict) or not isinstance(result.get('answer'), str):
        fail(502, 'Invalid AI answer')
    allowed = {p['id']: p for p in evidence}
    citations = []
    for citation in result.get('citations', []) if isinstance(result.get('citations'), list) else []:
        if not isinstance(citation, dict):
            continue
        source = allowed.get(citation.get('passage_id'))
        quote = citation.get('quote')
        if source and isinstance(quote, str) and quote.strip() and quote in source['text']:
            citations.append({'passage_id': source['id'], 'document_id': source['document_id'],
                              'filename': source['filename'], 'page': source['page'], 'quote': quote})
    if not citations:
        return {'answer': 'The document evidence is insufficient to provide a verified answer.',
                'citations': [], 'advisory': True}
    return {'answer': result['answer'][:8000], 'citations': citations, 'advisory': True}


class TaskBody(BaseModel):
    title: NonBlank = Field(max_length=300)
    assignee_id: str | None = None
    deadline: datetime | None = None


@app.post('/workspaces/{wid}/tasks', status_code=201)
def create_task(wid: str, body: TaskBody, user=Depends(current_user)):
    with connect(True) as db:
        _, limits = access(db, wid, user, True)
        limit(count(db, 'SELECT count(*) FROM tasks WHERE workspace_id=?', (wid,)), limits['tasks'], 'tasks')
        if body.assignee_id:
            one(db, 'SELECT user_id FROM memberships WHERE workspace_id=? AND user_id=?', (wid, body.assignee_id))
        task_id = uid()
        db.execute('INSERT INTO tasks VALUES (?,?,?,?,?,?,?)', (task_id, wid, body.title, body.assignee_id,
                   body.deadline.isoformat() if body.deadline else None, 'todo', now()))
        event(db, wid, user, 'created task')
        return one(db, 'SELECT * FROM tasks WHERE id=?', (task_id,))


@app.get('/workspaces/{wid}/tasks')
def tasks(wid: str, user=Depends(current_user)):
    with connect() as db:
        access(db, wid, user)
        return rows(db, 'SELECT * FROM tasks WHERE workspace_id=? ORDER BY created', (wid,))


class TaskStatus(BaseModel):
    status: Literal['todo', 'in_progress', 'completed']


@app.patch('/workspaces/{wid}/tasks/{tid}')
def update_task(wid: str, tid: str, body: TaskStatus, user=Depends(current_user)):
    with connect(True) as db:
        w, _ = access(db, wid, user)
        task = one(db, 'SELECT * FROM tasks WHERE id=? AND workspace_id=?', (tid, wid))
        if w['role'] != 'leader' and task['assignee_id'] != user['id']:
            fail(403, 'Members can update only their assigned tasks')
        db.execute('UPDATE tasks SET status=? WHERE id=?', (body.status, tid))
        event(db, wid, user, 'task status: ' + body.status)
        return {'id': tid, 'status': body.status}


@app.get('/workspaces/{wid}/dashboard')
def dashboard(wid: str, user=Depends(current_user)):
    with connect() as db:
        _, limits = access(db, wid, user)
        task_counts = rows(db, 'SELECT status,count(*) AS count FROM tasks WHERE workspace_id=? GROUP BY status', (wid,))
        latest = rows(db, 'SELECT findings FROM reviews WHERE workspace_id=? ORDER BY created DESC LIMIT 1', (wid,))
        findings = json.loads(latest[0]['findings']) if latest else []
        result = {'tasks': task_counts, 'requirements': count(db, 'SELECT count(*) FROM requirements WHERE workspace_id=?', (wid,)),
                  'compliance': {s: sum(f['status'] == s for f in findings)
                                 for s in ('Met', 'Partially Met', 'Missing', 'Needs Review')}}
        if limits['detailed_dashboard']:
            result['history'] = rows(db, 'SELECT * FROM events WHERE workspace_id=? ORDER BY created DESC LIMIT 500', (wid,))
            result['contributions'] = rows(db, 'SELECT user_id,action,count(*) AS count FROM events WHERE workspace_id=? '
                                           'GROUP BY user_id,action', (wid,))
            result['revisions'] = rows(db, 'SELECT id,parent_id,filename,version,created,user_id FROM documents '
                                      'WHERE workspace_id=? ORDER BY created', (wid,))
        return result


class CompareBody(BaseModel):
    old_document_id: str
    new_document_id: str


@app.post('/workspaces/{wid}/comparisons')
def compare(wid: str, body: CompareBody, user=Depends(current_user)):
    with connect() as db:
        _, limits = access(db, wid, user)
        premium(limits, 'comparison')
        docs = [one(db, "SELECT id FROM documents WHERE workspace_id=? AND id=? AND kind='draft'", (wid, did))
                for did in (body.old_document_id, body.new_document_id)]
        if docs[0]['id'] == docs[1]['id']:
            fail(422, 'Select two different drafts')
        old, new = [document_passages(db, wid, d['id']) for d in docs]
    # Diff uses page text stored in overlapping chunks; AI sees scoped evidence from both drafts.
    diff = '\n'.join(unified_diff([p['text'] for p in old], [p['text'] for p in new], fromfile='old', tofile='revised'))
    result = ai.generate('Compare the two drafts. Return {"summary":"...","improvements":["..."],'
                         '"remaining_issues":["..."]}. Do not invent sources or declare rubric compliance.',
                         {'old': old[:40], 'revised': new[:40]})
    if not isinstance(result, dict):
        fail(502, 'Invalid comparison output')
    return {'comparison': result, 'diff': diff, 'advisory': True,
            'ai_scope': 'First 40 passages of each draft; text diff covers all passages.'}


@app.get('/workspaces/{wid}/reports/summary')
def summary(wid: str, user=Depends(current_user)):
    with connect() as db:
        w, limits = access(db, wid, user, True)
        latest = history(db, wid, limits)[:1]
        return {'title': w['title'], 'advisory': 'AI findings are advisory, not an official teacher evaluation.',
                'members': rows(db, 'SELECT u.name,m.role FROM memberships m JOIN users u ON m.user_id=u.id '
                                'WHERE m.workspace_id=?', (wid,)),
                'tasks': rows(db, 'SELECT title,status,assignee_id,deadline FROM tasks WHERE workspace_id=?', (wid,)),
                'contributions': rows(db, 'SELECT u.name,e.action,count(*) AS count FROM events e '
                                      'JOIN users u ON e.user_id=u.id WHERE e.workspace_id=? '
                                      'GROUP BY u.id,e.action', (wid,)) if limits['detailed_dashboard'] else [],
                'findings': visible_findings(json.loads(latest[0]['findings']), limits) if latest else []}


@app.get('/workspaces/{wid}/reports/pdf')
def report_pdf(wid: str, user=Depends(current_user)):
    with connect() as db:
        _, limits = access(db, wid, user, True)
        premium(limits, 'pdf_reports')
    from reqvio.reports import render_report
    return Response(render_report(summary(wid, user)), media_type='application/pdf',
                    headers={'Content-Disposition': 'attachment; filename="reqvio-report.pdf"'})


# API routes are registered first; only the frontend directory is exposed.
app.mount('/', StaticFiles(directory=Path(__file__).parent / 'frontend', html=True), name='frontend')
