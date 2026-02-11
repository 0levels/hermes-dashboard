import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { requireApiUser } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

const LOCK_FILE = '/tmp/hermes-dashboard-deploy.lock';
const LOG_DIR = '/home/leads/.openclaw/logs/deploy';
const SCRIPT_PATH = '/home/leads/workspace/scripts/hermes-dashboard-deploy.sh';
const SERVICE = 'hermes-dashboard.service';

function safeExec(cmd: string[], fallback = ''): string {
  try {
    return execFileSync(cmd[0], cmd.slice(1), { encoding: 'utf-8' }).trim();
  } catch {
    return fallback;
  }
}

function latestLog() {
  if (!fs.existsSync(LOG_DIR)) return null;
  const files = fs.readdirSync(LOG_DIR)
    .filter(f => f.startsWith('hermes-dashboard-deploy-') && f.endsWith('.log'))
    .map(f => path.join(LOG_DIR, f));
  if (files.length === 0) return null;
  files.sort((a, b) => {
    const as = fs.statSync(a).mtimeMs;
    const bs = fs.statSync(b).mtimeMs;
    return bs - as;
  });
  const file = files[0];
  const raw = fs.readFileSync(file, 'utf-8');
  const lines = raw.trim().split('\n').slice(-80);
  return {
    path: file,
    mtime: new Date(fs.statSync(file).mtimeMs).toISOString(),
    tail: lines,
  };
}

export async function GET(request: Request) {
  const auth = requireApiUser(request as Request);
  if (auth) return auth;
  try {
    const running = safeExec(['pgrep', '-af', 'hermes-dashboard-deploy.sh'], '');
    const isActive = safeExec(['systemctl', 'is-active', SERVICE], 'unknown');
    const log = latestLog();
    const lockExists = fs.existsSync(LOCK_FILE);

    return NextResponse.json({
      service: {
        name: SERVICE,
        state: isActive,
      },
      deploy: {
        script_path: SCRIPT_PATH,
        lock_file: LOCK_FILE,
        lock_exists: lockExists,
        running_pids: running ? running.split('\n').filter(Boolean) : [],
      },
      latest_log: log,
    });
  } catch (error) {
    console.error('GET /api/deploy-status error:', error);
    return NextResponse.json({ error: 'Failed to read deploy status' }, { status: 500 });
  }
}
