import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { getDb } from './db';

const SALT_LENGTH = 16;
const KEY_LENGTH = 32;
const SCRYPT_COST = 16384;
const SESSION_DURATION = 7 * 24 * 60 * 60; // 7 days

export interface User {
  id: number;
  username: string;
  role: string;
  created_at: string;
}

function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LENGTH).toString('hex');
  const hash = scryptSync(password, salt, KEY_LENGTH, { N: SCRYPT_COST }).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const derived = scryptSync(password, salt, KEY_LENGTH, { N: SCRYPT_COST });
  const storedBuf = Buffer.from(hash, 'hex');
  if (derived.length !== storedBuf.length) return false;
  return timingSafeEqual(derived, storedBuf);
}

export function ensureAuthTables(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT UNIQUE NOT NULL,
      user_id INTEGER REFERENCES users(id),
      expires_at INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
  `);
}

export function seedAdmin(): void {
  const db = getDb();
  ensureAuthTables();
  const count = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
  if (count > 0) return;

  const username = process.env.AUTH_USER || 'admin';
  const password = process.env.AUTH_PASS || 'hermes';
  db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(
    username,
    hashPassword(password),
    'admin',
  );
}

export function authenticate(username: string, password: string): User | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as
    | (User & { password_hash: string })
    | undefined;
  if (!row || !verifyPassword(password, row.password_hash)) return null;
  return { id: row.id, username: row.username, role: row.role, created_at: row.created_at };
}

export function createSession(userId: number): string {
  const db = getDb();
  const token = randomBytes(32).toString('hex');
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_DURATION;
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expiresAt);
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Math.floor(Date.now() / 1000));
  return token;
}

export function validateSession(token: string): User | null {
  if (!token) return null;
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  const row = db
    .prepare(
      `SELECT u.id, u.username, u.role, u.created_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > ?`,
    )
    .get(token, now) as User | undefined;
  return row || null;
}

export function destroySession(token: string): void {
  getDb().prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export function getUserFromRequest(request: Request): User | null {
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.match(/(?:^|;\s*)hermes-session=([^;]*)/);
  const token = match ? decodeURIComponent(match[1]) : null;
  if (token) {
    const user = validateSession(token);
    if (user) return user;
  }

  const apiKey = request.headers.get('x-api-key');
  if (apiKey && apiKey === process.env.API_KEY) {
    return { id: 0, username: 'api', role: 'admin', created_at: '' };
  }

  return null;
}
