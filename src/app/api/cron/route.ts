import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { promises as fs } from 'node:fs';
import fsSync from 'node:fs';
import path from 'node:path';
import { requireApiUser } from '@/lib/api-auth';

const CRON_DIR = '/home/leads/.openclaw/cron';
const LOGS_DIR = '/home/leads/.openclaw/cron/logs';

/**
 * POST /api/cron — Check for completed cron jobs and create notifications
 */
export async function POST(request: Request) {
  const auth = requireApiUser(request as Request);
  if (auth) return auth;
  try {
    const db = getDb();
    const jobsPath = path.join(CRON_DIR, 'jobs.json');
    if (!fsSync.existsSync(jobsPath)) {
      return NextResponse.json({ notified: 0 });
    }

    const data = JSON.parse(fsSync.readFileSync(jobsPath, 'utf-8'));
    const jobs = data.jobs || [];
    let notified = 0;

    for (const job of jobs) {
      if (!job.state?.lastRunAtMs) continue;

      // Check if we already notified for this run
      const key = `cron:${job.id}:${job.state.lastRunAtMs}`;
      const existing = db.prepare(
        "SELECT 1 FROM notifications WHERE data LIKE ? LIMIT 1"
      ).get(`%${key}%`);

      if (!existing) {
        const status = job.state.lastStatus === 'ok' ? 'info' : 'warning';
        const duration = job.state.lastDurationMs ? `${Math.round(job.state.lastDurationMs / 1000)}s` : '';
        const agentLabel = (job.agentId || 'unknown').charAt(0).toUpperCase() + (job.agentId || 'unknown').slice(1);

        db.prepare(`
          INSERT INTO notifications (type, severity, title, message, data)
          VALUES ('cron', ?, ?, ?, ?)
        `).run(
          status,
          `${agentLabel}: ${job.name} completed`,
          `${job.skill || job.id} finished in ${duration}. Status: ${job.state.lastStatus || 'unknown'}`,
          JSON.stringify({ key, job_id: job.id, agent_id: job.agentId, duration_ms: job.state.lastDurationMs }),
        );
        notified++;
      }
    }

    return NextResponse.json({ notified });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';


interface CronJob {
  id: string;
  agent: string;
  schedule: string;
  message: string;
  enabled: boolean;
  timezone?: string;
  lastRun?: string | null;
  lastResult?: string | null;
  lastDuration?: number | null;
  nextRun?: string | null;
}

export async function GET(request: Request) {
  const auth = requireApiUser(request as Request);
  if (auth) return auth;
  try {
    // Read cron jobs config
    const jobsPath = path.join(CRON_DIR, 'jobs.json');
    let jobs: CronJob[] = [];
    try {
      const raw = await fs.readFile(jobsPath, 'utf-8');
      const parsed = JSON.parse(raw);
      jobs = Array.isArray(parsed) ? parsed : parsed.jobs || [];
    } catch {
      // No cron config yet
    }

    // Read recent logs for each job
    const enriched = await Promise.all(jobs.map(async (job) => {
      try {
        const logFile = path.join(LOGS_DIR, `${job.id}.log`);
        const stat = await fs.stat(logFile).catch(() => null);
        if (!stat) return { ...job, lastRun: null, lastResult: null };

        // Read last 2KB of log
        const fd = await fs.open(logFile, 'r');
        const size = stat.size;
        const readSize = Math.min(size, 2048);
        const buffer = Buffer.alloc(readSize);
        await fd.read(buffer, 0, readSize, Math.max(0, size - readSize));
        await fd.close();

        const lastLines = buffer.toString('utf-8').trim().split('\n').slice(-5);
        return {
          ...job,
          lastRun: stat.mtime.toISOString(),
          lastResult: lastLines.join('\n'),
        };
      } catch {
        return { ...job, lastRun: null, lastResult: null };
      }
    }));

    // Calculate next run (simple: just show schedule info)
    return NextResponse.json({ jobs: enriched });
  } catch (error) {
    console.error('GET /api/cron error:', error);
    return NextResponse.json({ error: 'Failed to read cron status' }, { status: 500 });
  }
}
