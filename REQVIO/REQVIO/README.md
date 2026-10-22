# Reqvio

FastAPI backend and the supplied buildless HTML/CSS/JavaScript frontend. Persistent SQLite storage,
workspace-scoped roles, PDF passages, TF-IDF retrieval, validated AI citations,
tasks, reports and server-enforced free/premium entitlements.

## Start

Install Python 3.11 or newer, then run from this directory in PowerShell:

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
.\.venv\Scripts\python.exe -m uvicorn main:app --reload
```

Website: http://localhost:8000. Interactive API: http://localhost:8000/docs. OpenAPI: `/openapi.json`.
Tests: `.\.venv\Scripts\python.exe -m pytest -q`.
The same server serves the frontend and API; no Node installation or frontend build is needed.
The website retains your teal theme, typography, responsive layout and light/dark modes.
Google Fonts are optional; system fallback fonts work without Internet access.

## Using the website

Create an account, create a workspace, then upload a rubric and draft in Documents.
Add requirements manually while AI is unconfigured. Invite teammates with the exact
case-sensitive code in Members. Assign tasks and update their statuses. Your data
persists in SQLite; the login token is stored in sessionStorage for the current tab.
Sign out revokes that session. Refresh restores the signed-in account.

AI-dependent actions display a setup-pending state until configured. No simulated
AI results or client-side paid entitlements are created. Premium features follow the
workspace owner's active server subscription. The supplied Student Pro, Research Team
and Research Pass pricing cards are labeled **planned offers**: there is no checkout,
purchase, or automatic activation. Their proposed allowances differ from the currently
implemented Free/Premium backend plans, and need billing and matching entitlement work
before launch. Account and workspace screens show current server limits.

Pages include landing, authentication, workspaces, overview, documents and manual
requirements, AI review with source PDF links, tasks, team, settings, reports, revision
comparison, history, profile and plans. Files live under `frontend/`; `app.js` contains
the supplied view templates, `integration.js` connects API requests, and `premium.js`
adds theme, plans, history, comparisons and contribution views. Forms preserve input
on failure, uploads wait for successful persistence, and API errors appear inline.

## Frontend workflow

1. `POST /auth/signup` with name, email, password (10+ characters), or
   `POST /auth/login`. Store the returned `access_token` and send
   `Authorization: Bearer <token>` on authenticated requests. Sessions expire in 7 days.
2. `GET /auth/me`, `GET /subscription` and `GET /plans` supply account and feature state.
3. `POST /workspaces` with title/description; `GET /workspaces` lists memberships.
   The creator is the sole leader. Joining another owner's workspace does not consume
   the joining student's owned-workspace allowance.
4. Leaders obtain/rotate codes with `POST /workspaces/{id}/invite`.
   Members join with `POST /workspaces/join` and `{"code":"..."}`.
5. Upload using `POST /workspaces/{id}/documents` as multipart form data:
   `file`, `kind` (rubric/instructions/draft/reference), optional `parent_id` for a draft revision.
   All versions count toward the document allowance. Members may upload drafts/references.
6. `POST /workspaces/{id}/requirements` accepts description and optional rubric
   passage_id. Alternatively `/requirements/extract` accepts `document_id` and uses AI.
7. Leaders run `POST /workspaces/{id}/reviews` with `document_id` for an explicit draft.
   Reviews are synchronous; allow up to 90 seconds per requirement in the client.
   `GET /reviews` and `/reviews/{review_id}` return saved results.
   Members and leaders can ask grounded questions at `POST /questions` with
   question/document_id; answers without verified quotations are withheld.
8. `/tasks` supports listing and leader creation with title, assignee_id, deadline.
   `PATCH /tasks/{id}` accepts status: todo/in_progress/completed. Members update their own tasks.
9. `/dashboard` keeps task completion separate from requirement compliance.
10. Leaders get `/reports/summary`; premium leaders download `/reports/pdf`.
    Premium `/comparisons` accepts old_document_id/new_document_id.

All workspace subpaths above begin `/workspaces/{id}`. Use the OpenAPI schema
for complete payload types. IDs are UUIDs. Dates are ISO 8601. Quota months use UTC.
Errors use FastAPI's `detail` envelope; plan errors include `code`, `feature`, `limit`.
Treat 403 premium_required/plan_limit as upgrade prompts; 503 means AI isn't configured.
PDF download routes require a bearer header; fetch a Blob to display/download in React.

## Plans and provisioning

| Allowance | Free | Premium |
| --- | --- | --- |
| Reviews per UTC month | 2 | 100 |
| Documents per owned workspace | 2 | 100 |
| File size | 5 MB | 25 MB |
| Owned workspaces | 1 | 20 |
| Members, including leader | 3 | 30 |
| Tasks per workspace | 20 | 1,000 |
| Review history visible | Latest 3 | Full |
| Feedback | Explanation and citations | Also recommendations |
| Revision comparison | No | AI summary and full passage diff |
| Dashboard | Checklist/counts | Activity, contributions, document versions |
| Reports | JSON summary | PDF with evidence |

The owner's active subscription controls team features and monthly review usage.
Premium values are explicit initial defaults because pricing and allowances weren't specified.
Older reviews remain stored but become inaccessible on Free. Expiration automatically
reverts entitlements; existing content is retained and further additions obey Free limits.
Contribution tracking records uploads, task actions, joins and reviews, not keystrokes.

Payments are not integrated. To provision a paid/test entitlement, set a strong
backend-only `ADMIN_TOKEN`, then call `PUT /admin/users/{user_id}/subscription`
with `X-Admin-Token` and `{"plan":"premium","expires_at":"2027-01-01T00:00:00Z"}`.
An unset token disables provisioning. There is no public self-upgrade endpoint.
Use `{"plan":"free"}` to revoke. Keep admin credentials out of the frontend.

## ALMA configuration

No official ALMA endpoint or authentication contract was supplied. `reqvio/ai.py`
contains an optional OpenAI-compatible chat adapter; use it only if ALMA documents
that protocol. Set ALMA_URL to the exact endpoint, ALMA_API_KEY, ALMA_MODEL,
ALMA_AUTH_HEADER, ALMA_AUTH_PREFIX and ALMA_PROTOCOL in `.env`.
If ALMA uses another protocol, implement it in `generate()` using its official docs.
No external AI calls are made until configured. Provider failures refund review quota.
Tests mock the provider and do not establish live Gemma connectivity.

Retrieval only reads the selected draft inside the current workspace. Quotes and
passage IDs must match retrieved source text. Unsupported/fabricated citations
produce Needs Review. Missing is conservatively normalized to Needs Review because
top-k retrieval cannot prove absence across a draft. Findings are advisory.
Comparison AI reads the first 40 passages per draft and explicitly reports that scope.
Rubric extraction supports up to 80 passages; requirements may also be entered manually.
Automatic extraction and comparison are not counted as rubric checks.

## Deployment notes

This is a local MVP: use HTTPS, authentication rate limiting, a proper payment webhook
integration, managed secrets, backups, database migrations and background review jobs
before public launch. Current sessions are opaque, hashed in the DB and revocable;
passwords use scrypt. No demo users or hardcoded credentials are installed. SQLite
write transactions serialize quota reservations. PDFs are limited to 300 pages and
one million extracted characters; scanned PDFs require text extraction elsewhere.
Uploads live in the SQLite DB under ignored `data/`. Restrict filesystem access and
back up that database. No OCR, plagiarism detection, real-time sockets, email invites,
password reset, or leader transfer is included. Configure exact CORS origins in `.env`.
