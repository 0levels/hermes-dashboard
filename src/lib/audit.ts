import { getDb } from './db';
import type { User } from './auth';

export interface AuditEntry {
  actor: User | null;
  action: string;
  target?: string | null;
  detail?: Record<string, unknown> | null;
}

export function logAudit(entry: AuditEntry): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO audit_log (actor_id, actor_username, action, target, detail)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(
    entry.actor?.id ?? null,
    entry.actor?.username ?? null,
    entry.action,
    entry.target ?? null,
    entry.detail ? JSON.stringify(entry.detail) : null,
  );
}
