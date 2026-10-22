import httpx

from reqvio import ai


def test_generate_works_with_models_that_reject_temperature(monkeypatch):
    monkeypatch.setenv('ALMA_URL', 'https://provider.example/chat/completions')
    monkeypatch.setenv('ALMA_API_KEY', 'test-only-key')
    monkeypatch.setenv('ALMA_MODEL', 'model-with-provider-defaults')
    monkeypatch.setenv('ALMA_PROTOCOL', 'openai_chat')

    def provider(url, *, headers, json, timeout):
        request = httpx.Request('POST', url)
        if 'temperature' in json:
            return httpx.Response(400, request=request, json={'detail': '`temperature` is deprecated for this model.'})
        return httpx.Response(200, request=request, json={
            'choices': [{'message': {'content': '{"ok":true}'}}]})

    monkeypatch.setattr(ai.httpx, 'post', provider)
    assert ai.generate('Return JSON.', {'question': 'Connection check'}) == {'ok': True}
