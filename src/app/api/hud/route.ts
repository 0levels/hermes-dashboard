import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

const STATE_DIR = process.env.HERMES_STATE_DIR || '/home/leads/workspace/state';
const CRON_DIR = '/home/leads/.openclaw/cron';

export async function GET() {
  try {
    const db = getDb();

    const sendingPausedPath = path.join(STATE_DIR, 'sending-paused.flag');
    const sending_paused = fs.existsSync(sendingPausedPath);

    let paused_reason: string | null = null;
    if (sending_paused) {
      try {
        paused_reason = fs.readFileSync(sendingPausedPath, 'utf-8').trim().split('\n')[0] || 'Paused';
      } catch {
        paused_reason = 'Paused';
      }
    }

    const content_pending = db.prepare(
      "SELECT COUNT(*) as c FROM content_posts WHERE status = 'pending_approval'",
    ).get() as { c: number };

    const seq_pending = db.prepare(
      "SELECT COUNT(*) as c FROM sequences WHERE status = 'pending_approval'",
    ).get() as { c: number };

    const stale_content = db.prepare(
      "SELECT COUNT(*) as c FROM content_posts WHERE status = 'pending_approval' AND created_at < datetime('now', '-24 hours')",
    ).get() as { c: number };

    const stale_sequences = db.prepare(
      "SELECT COUNT(*) as c FROM sequences WHERE status = 'pending_approval' AND created_at < datetime('now', '-24 hours')",
    ).get() as { c: number };

    let cron_total = 0;
    let cron_errors = 0;
    try {
      const jobsPath = path.join(CRON_DIR, 'jobs.json');
      const raw = fs.readFileSync(jobsPath, 'utf-8');
      const parsed = JSON.parse(raw);
      const jobs = Array.isArray(parsed) ? parsed : (parsed?.jobs || []);
      cron_total = jobs.length;
      cron_errors = jobs.filter((j: any) => j?.enabled !== false && j?.state?.lastStatus && j.state.lastStatus !== 'ok').length;
    } catch {
      // ignore
    }

    return NextResponse.json({
      sending_paused,
      paused_reason,
      approvals_pending: (content_pending?.c ?? 0) + (seq_pending?.c ?? 0),
      approvals_stale: (stale_content?.c ?? 0) + (stale_sequences?.c ?? 0),
      cron_total,
      cron_errors,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
