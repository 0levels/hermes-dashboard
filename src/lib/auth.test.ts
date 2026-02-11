import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const tempDir = mkdtempSync(path.join(tmpdir(), 'hermes-auth-test-'));
const dbPath = path.join(tempDir, 'hermes-test.db');

process.env.HERMES_DB_PATH = dbPath;
process.env.AUTH_USER = 'admin_test';
process.env.AUTH_PASS = 'super-secure-pass';
process.env.API_KEY = 'test-api-key';

import { getDb, resetDbForTests } from './db';
import {
  authenticate,
  createSession,
  destroySession,
  ensureAuthTables,
  getUserFromRequest,
  requireUser,
  seedAdmin,
  validateSession,
} from './auth';

function resetAuthState() {
  ensureAuthTables();
  const db = getDb();
  db.exec('DELETE FROM sessions; DELETE FROM users;');
}

beforeEach(() => {
  resetAuthState();
});

after(() => {
  resetDbForTests();
  rmSync(tempDir, { recursive: true, force: true });
});

test('seedAdmin requires AUTH_USER and AUTH_PASS when users table is empty', () => {
  const previousUser = process.env.AUTH_USER;
  const previousPass = process.env.AUTH_PASS;
  delete process.env.AUTH_USER;
  delete process.env.AUTH_PASS;

  assert.throws(() => seedAdmin(), /AUTH_USER must be set/);

  process.env.AUTH_USER = previousUser;
  process.env.AUTH_PASS = previousPass;
});

test('seedAdmin creates initial admin and authenticate succeeds', () => {
  seedAdmin();
  const user = authenticate('admin_test', 'super-secure-pass');
  assert.ok(user);
  assert.equal(user.username, 'admin_test');
  assert.equal(user.role, 'admin');
});

test('session lifecycle validates and invalidates correctly', () => {
  seedAdmin();
  const user = authenticate('admin_test', 'super-secure-pass');
  assert.ok(user);

  const token = createSession(user.id);
  const validated = validateSession(token);
  assert.ok(validated);
  assert.equal(validated.username, user.username);

  destroySession(token);
  assert.equal(validateSession(token), null);
});

test('requireUser throws on invalid session cookie', () => {
  const request = new Request('http://localhost/api/test', {
    headers: { cookie: 'hermes-session=invalid-token' },
  });

  assert.equal(getUserFromRequest(request), null);
  assert.throws(() => requireUser(request), /unauthorized/);
});

test('x-api-key auth only works when API_KEY is configured and matches', () => {
  const request = new Request('http://localhost/api/test', {
    headers: { 'x-api-key': 'test-api-key' },
  });
  const user = getUserFromRequest(request);
  assert.ok(user);
  assert.equal(user.username, 'api');

  const previous = process.env.API_KEY;
  delete process.env.API_KEY;
  assert.equal(getUserFromRequest(request), null);
  process.env.API_KEY = previous;
});
