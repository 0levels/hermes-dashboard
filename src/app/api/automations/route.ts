import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAgents, ACTION_TO_AGENT } from '@/lib/agent-config';
import type { ApprovalItem, SkillExecution } from '@/types';
import { requireApiUser } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = requireApiUser(request as Request);
  if (auth) return auth;
  const db = getDb();

  // Approval queue: pending content + pending sequences
  const pendingContent = db.prepare(
    `SELECT id, platform, text_preview, status, created_at
     FROM content_posts WHERE status = 'pending_approval'
     ORDER BY created_at DESC LIMIT 20`
  ).all() as { id: string; platform: string; text_preview: string | null; status: string; created_at: string }[];

  const pendingEmails = db.prepare(
    `SELECT s.id, s.subject, s.tier, s.status, s.created_at, l.first_name, l.last_name, l.company
     FROM sequences s LEFT JOIN leads l ON s.lead_id = l.id
     WHERE s.status = 'pending_approval'
     ORDER BY s.created_at DESC LIMIT 20`
  ).all() as { id: string; subject: string | null; tier: string | null; status: string; created_at: string; first_name: string | null; last_name: string | null; company: string | null }[];

  const approvals: ApprovalItem[] = [
    ...pendingContent.map(c => ({
      id: c.id,
      type: 'content' as const,
      title: `${c.platform.toUpperCase()} post`,
      preview: c.text_preview || '(no preview)',
      agent: 'hermes',
      created_at: c.created_at,
      platform: c.platform,
    })),
    ...pendingEmails.map(e => ({
      id: e.id,
      type: 'email' as const,
      title: e.subject || 'No subject',
      preview: `To: ${e.first_name || ''} ${e.last_name || ''} at ${e.company || 'Unknown'}`,
      agent: 'apollo',
      created_at: e.created_at,
      tier: e.tier || undefined,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Skill execution stats (from activity_log, last 30 days)
  const actionCounts = db.prepare(
    `SELECT action, COUNT(*) as c, MAX(ts) as last_run
     FROM activity_log
     WHERE ts > datetime('now', '-30 days') AND action IS NOT NULL
     GROUP BY action ORDER BY c DESC`
  ).all() as { action: string; c: number; last_run: string }[];

  const skillExecutions: SkillExecution[] = actionCounts
    .filter(a => ACTION_TO_AGENT[a.action])
    .map(a => ({
      skill: ACTION_TO_AGENT[a.action].skill,
      agent: ACTION_TO_AGENT[a.action].agent,
      count: a.c,
      last_run: a.last_run,
    }));

  // Cron schedule (flattened from all agents)
  const schedule = getAgents().flatMap((agent) =>
    agent.cronJobs.map(job => ({
      ...job,
      agent: agent.id,
      agentName: agent.name,
      agentEmoji: agent.emoji,
    }))
  ).sort((a, b) => {
    // Sort by time of day
    const timeA = a.schedule.match(/(\d+):(\d+)/);
    const timeB = b.schedule.match(/(\d+):(\d+)/);
    if (!timeA || !timeB) return 0;
    return (parseInt(timeA[1]) * 60 + parseInt(timeA[2])) - (parseInt(timeB[1]) * 60 + parseInt(timeB[2]));
  });

  // Today's activity count by hour
  const today = new Date().toISOString().slice(0, 10);
  const hourlyActivity = db.prepare(
    `SELECT CAST(strftime('%H', ts) AS INTEGER) as hour, COUNT(*) as c
     FROM activity_log WHERE date(ts) = ?
     GROUP BY hour ORDER BY hour`
  ).all(today) as { hour: number; c: number }[];

  return NextResponse.json({
    approvals,
    skill_executions: skillExecutions,
    schedule,
    hourly_activity: hourlyActivity,
    summary: {
      pending_approvals: approvals.length,
      total_executions_30d: skillExecutions.reduce((s, e) => s + e.count, 0),
      active_cron_jobs: schedule.length,
    },
  });
}
