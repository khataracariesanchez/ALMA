import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

SCHEMA = '''
CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
 password TEXT NOT NULL, plan TEXT NOT NULL DEFAULT 'free', premium_until TEXT);
CREATE TABLE IF NOT EXISTS sessions (
 token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS workspaces (
 id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL,
 description TEXT NOT NULL, invite TEXT UNIQUE NOT NULL, created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS memberships (
 workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
 user_id TEXT REFERENCES users(id), role TEXT NOT NULL,
 PRIMARY KEY(workspace_id,user_id));
CREATE TABLE IF NOT EXISTS documents (
 id TEXT PRIMARY KEY, workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
 user_id TEXT REFERENCES users(id), filename TEXT NOT NULL, kind TEXT NOT NULL,
 version INTEGER NOT NULL, parent_id TEXT REFERENCES documents(id),
 size INTEGER NOT NULL, content BLOB NOT NULL, created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS passages (
 id TEXT PRIMARY KEY, document_id TEXT REFERENCES documents(id) ON DELETE CASCADE,
 page INTEGER NOT NULL, text TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS requirements (
 id TEXT PRIMARY KEY, workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
 description TEXT NOT NULL, passage_id TEXT REFERENCES passages(id));
CREATE TABLE IF NOT EXISTS tasks (
 id TEXT PRIMARY KEY, workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
 title TEXT NOT NULL, assignee_id TEXT REFERENCES users(id), deadline TEXT,
 status TEXT NOT NULL DEFAULT 'todo', created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS reviews (
 id TEXT PRIMARY KEY, workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
 document_id TEXT REFERENCES documents(id), user_id TEXT REFERENCES users(id),
 created TEXT NOT NULL, findings TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS usage (
 owner_id TEXT REFERENCES users(id), month TEXT NOT NULL, checks INTEGER NOT NULL,
 PRIMARY KEY(owner_id,month));
CREATE TABLE IF NOT EXISTS events (
 id TEXT PRIMARY KEY, workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
 user_id TEXT REFERENCES users(id), action TEXT NOT NULL, created TEXT NOT NULL);
'''

@contextmanager
def connect(write=False):
    path = Path(os.getenv('REQVIO_DB', 'data/reqvio.db'))
    path.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(path, timeout=30)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys=ON')
    try:
        if write:
            db.execute('BEGIN IMMEDIATE')
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

def initialize():
    with connect() as db:
        db.executescript(SCHEMA)
    with connect(True) as db:
        columns = {row['name'] for row in db.execute('PRAGMA table_info(workspaces)')}
        if 'mode' not in columns:
            db.execute("ALTER TABLE workspaces ADD COLUMN mode TEXT NOT NULL DEFAULT 'group' CHECK(mode IN ('group','solo'))")

def rows(db, sql, args=()):
    return [dict(r) for r in db.execute(sql, args).fetchall()]
