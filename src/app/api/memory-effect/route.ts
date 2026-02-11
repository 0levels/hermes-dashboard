import { NextResponse } from 'next/server';
import fs from 'fs';
import { requireApiUser } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

type Namespace = 'leads' | 'openclaw';

const DRIFT_HISTORY: Record<Namespace, string> = {
  leads: '/home/leads/.openclaw/logs/memory-drift-history.jsonl',
  openclaw: '/home/openclaw/.openclaw/logs/memory-drift-history.jsonl',
};

const POLICY_AUDIT: Record<Namespace, string> = {
  leads: '/home/leads/.openclaw/logs/memory-policy-audit.jsonl',
  openclaw: '/home/openclaw/.openclaw/logs/memory-policy-audit.jsonl',
};

const ALERT_POLICY_AUDIT: Record<Namespace, string> = {
  leads: '/home/leads/.openclaw/logs/memory-alert-policy-audit.jsonl',
  openclaw: '/home/openclaw/.openclaw/logs/memory-alert-policy-audit.jsonl',
};

type DriftRow = {
  timestamp: string;
  namespace: string;
  contradictions: number;
  duplicates: number;
  weak_agents: number;
  hot_memory: number;
  cold_memory: number;
  never_accessed: number;
  collective_total: number;
};

function parseNamespace(value: string | null | undefined): Namespace {
  return value === 'openclaw' ? 'openclaw' : 'leads';
}

function readJsonl(filePath: string): any[] {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, 'utf-8');
  const out: any[] = [];
  for (const line of raw.split('\n')) {
    const s = line.trim();
    if (!s) continue;
    try {
      out.push(JSON.parse(s));
    } catch {
      continue;
    }
  }
  return out;
}

function tsMs(ts: string | undefined): number {
  if (!ts) return Number.NaN;
  return Date.parse(ts);
}

function metricDelta(before: number, after: number): { before: number; after: number; delta: number } {
  return { before, after, delta: after - before };
}

export async function GET(request: Request) {
  const auth = requireApiUser(request as Request);
  if (auth) return auth;
  try {
    const url = new URL(request.url);
    const namespace = parseNamespace(url.searchParams.get('namespace'));

    const history = readJsonl(DRIFT_HISTORY[namespace]) as DriftRow[];
    const policyAudit = readJsonl(POLICY_AUDIT[namespace]);
    const alertPolicyAudit = readJsonl(ALERT_POLICY_AUDIT[namespace]);
    const changes = [...policyAudit, ...alertPolicyAudit]
      .filter(x => typeof x?.timestamp === 'string')
      .sort((a, b) => tsMs(b.timestamp) - tsMs(a.timestamp));

    if (history.length < 2 || changes.length === 0) {
      return NextResponse.json({
        namespace,
        available: false,
        reason: 'insufficient_history_or_policy_changes',
        history_points: history.length,
        policy_changes: changes.length,
      });
    }

    const sortedHistory = [...history].sort((a, b) => tsMs(a.timestamp) - tsMs(b.timestamp));
    const latestChange = changes[0];
    const changeMs = tsMs(latestChange.timestamp);
    const before = [...sortedHistory].reverse().find(h => tsMs(h.timestamp) <= changeMs) ?? sortedHistory[sortedHistory.length - 2];
    const after = sortedHistory[sortedHistory.length - 1];

    const beforeTotal = Math.max(1, Number(before.collective_total || 0));
    const afterTotal = Math.max(1, Number(after.collective_total || 0));
    const beforeNeverRatio = Number(before.never_accessed || 0) / beforeTotal;
    const afterNeverRatio = Number(after.never_accessed || 0) / afterTotal;

    return NextResponse.json({
      namespace,
      available: true,
      latest_policy_change: latestChange.timestamp,
      baseline_at: before.timestamp,
      current_at: after.timestamp,
      deltas: {
        contradictions: metricDelta(Number(before.contradictions || 0), Number(after.contradictions || 0)),
        duplicates: metricDelta(Number(before.duplicates || 0), Number(after.duplicates || 0)),
        weak_agents: metricDelta(Number(before.weak_agents || 0), Number(after.weak_agents || 0)),
        hot_memory: metricDelta(Number(before.hot_memory || 0), Number(after.hot_memory || 0)),
        never_accessed_ratio: {
          before: beforeNeverRatio,
          after: afterNeverRatio,
          delta: afterNeverRatio - beforeNeverRatio,
        },
      },
    });
  } catch (error) {
    console.error('GET /api/memory-effect error:', error);
    return NextResponse.json({ error: 'Failed to read memory policy effect' }, { status: 500 });
  }
}
