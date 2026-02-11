import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { requireApiUser } from '@/lib/api-auth';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

type Namespace = 'leads' | 'openclaw';

type AlertPolicy = {
  window_days: number;
  alert_contradictions_threshold: number;
  alert_duplicates_threshold: number;
  alert_weak_agents_threshold: number;
  alert_never_ratio_threshold: number;
};

const POLICY_FILES: Record<Namespace, string> = {
  leads: '/home/leads/.openclaw/health/memory-alert-policy.json',
  openclaw: '/home/openclaw/.openclaw/health/memory-alert-policy.json',
};

const POLICY_AUDIT_FILES: Record<Namespace, string> = {
  leads: '/home/leads/.openclaw/logs/memory-alert-policy-audit.jsonl',
  openclaw: '/home/openclaw/.openclaw/logs/memory-alert-policy-audit.jsonl',
};

const DEFAULT_POLICY: AlertPolicy = {
  window_days: 7,
  alert_contradictions_threshold: 1,
  alert_duplicates_threshold: 1,
  alert_weak_agents_threshold: 1,
  alert_never_ratio_threshold: 0.7,
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function parseNamespace(value: string | null | undefined): Namespace {
  return value === 'openclaw' ? 'openclaw' : 'leads';
}

function sanitize(input: Partial<AlertPolicy>): AlertPolicy {
  return {
    window_days: clamp(Number(input.window_days ?? DEFAULT_POLICY.window_days), 1, 90),
    alert_contradictions_threshold: clamp(
      Number(input.alert_contradictions_threshold ?? DEFAULT_POLICY.alert_contradictions_threshold),
      1,
      100,
    ),
    alert_duplicates_threshold: clamp(
      Number(input.alert_duplicates_threshold ?? DEFAULT_POLICY.alert_duplicates_threshold),
      1,
      100,
    ),
    alert_weak_agents_threshold: clamp(
      Number(input.alert_weak_agents_threshold ?? DEFAULT_POLICY.alert_weak_agents_threshold),
      1,
      100,
    ),
    alert_never_ratio_threshold: clamp(
      Number(input.alert_never_ratio_threshold ?? DEFAULT_POLICY.alert_never_ratio_threshold),
      0,
      1,
    ),
  };
}

function readPolicy(namespace: Namespace): AlertPolicy {
  try {
    const policyFile = POLICY_FILES[namespace];
    if (!fs.existsSync(policyFile)) return DEFAULT_POLICY;
    const raw = fs.readFileSync(policyFile, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<AlertPolicy>;
    return sanitize(parsed);
  } catch {
    return DEFAULT_POLICY;
  }
}

function writePolicy(namespace: Namespace, policy: AlertPolicy): void {
  const policyFile = POLICY_FILES[namespace];
  fs.mkdirSync(path.dirname(policyFile), { recursive: true });
  fs.writeFileSync(policyFile, JSON.stringify(policy, null, 2) + '\n', 'utf-8');
}

function appendPolicyAudit(namespace: Namespace, payload: Record<string, unknown>): void {
  const auditFile = POLICY_AUDIT_FILES[namespace];
  fs.mkdirSync(path.dirname(auditFile), { recursive: true });
  fs.appendFileSync(auditFile, `${JSON.stringify(payload)}\n`, 'utf-8');
}

function crontabList(namespace: Namespace): string {
  if (namespace === 'leads') {
    return execFileSync('crontab', ['-l'], { encoding: 'utf-8' });
  }
  return execFileSync('sudo', ['-n', 'crontab', '-u', 'openclaw', '-l'], { encoding: 'utf-8' });
}

function crontabWrite(namespace: Namespace, filePath: string): void {
  if (namespace === 'leads') {
    execFileSync('crontab', [filePath], { encoding: 'utf-8' });
    return;
  }
  execFileSync('sudo', ['-n', 'crontab', '-u', 'openclaw', filePath], { encoding: 'utf-8' });
}

function rewriteDriftCron(namespace: Namespace, policy: AlertPolicy): { updated: number } {
  const current = crontabList(namespace);
  const lines = current.split('\n');
  const targetNsArg = `--namespace ${namespace}`;
  let updated = 0;

  const next = lines.map(line => {
    if (!line.includes('memory-drift-report.py') || !line.includes(targetNsArg)) return line;
    let rewritten = line
      .replace(/\s--window-days\s+\S+/g, '')
      .replace(/\s--alert-contradictions-threshold\s+\S+/g, '')
      .replace(/\s--alert-duplicates-threshold\s+\S+/g, '')
      .replace(/\s--alert-weak-agents-threshold\s+\S+/g, '')
      .replace(/\s--alert-never-ratio-threshold\s+\S+/g, '');

    const opts =
      ` --window-days ${policy.window_days}` +
      ` --alert-contradictions-threshold ${policy.alert_contradictions_threshold}` +
      ` --alert-duplicates-threshold ${policy.alert_duplicates_threshold}` +
      ` --alert-weak-agents-threshold ${policy.alert_weak_agents_threshold}` +
      ` --alert-never-ratio-threshold ${policy.alert_never_ratio_threshold}`;

    const redirectIdx = rewritten.indexOf(' >> ');
    if (redirectIdx >= 0) {
      rewritten = `${rewritten.slice(0, redirectIdx)}${opts}${rewritten.slice(redirectIdx)}`;
    } else {
      rewritten = `${rewritten}${opts}`;
    }
    updated += 1;
    return rewritten;
  });

  if (updated > 0) {
    const tmp = namespace === 'openclaw'
      ? '/tmp/hermes-openclaw-cron.txt'
      : '/tmp/hermes-leads-cron.txt';
    fs.writeFileSync(tmp, next.join('\n'), 'utf-8');
    crontabWrite(namespace, tmp);
  }
  return { updated };
}

export async function GET(request: Request) {
  const auth = requireApiUser(request as Request);
  if (auth) return auth;
  try {
    const url = new URL(request.url);
    const namespace = parseNamespace(url.searchParams.get('namespace'));
    return NextResponse.json({ namespace, policy: readPolicy(namespace) });
  } catch (error) {
    console.error('GET /api/memory-alert-policy error:', error);
    return NextResponse.json({ error: 'Failed to read memory alert policy' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = requireApiUser(request as Request);
  if (auth) return auth;
  let namespace: Namespace = 'leads';
  try {
    const actor = requireUser(request as Request);
    const body = (await request.json()) as Partial<AlertPolicy> & { namespace?: Namespace };
    namespace = parseNamespace(body.namespace);
    const before = readPolicy(namespace);
    const policy = sanitize(body);
    writePolicy(namespace, policy);
    const cron = rewriteDriftCron(namespace, policy);
    appendPolicyAudit(namespace, {
      timestamp: new Date().toISOString(),
      actor: actor.username,
      actor_role: actor.role,
      namespace,
      before,
      after: policy,
      drift_cron_lines_updated: cron.updated,
    });
    return NextResponse.json({ ok: true, namespace, policy, cron });
  } catch (error) {
    console.error('POST /api/memory-alert-policy error:', error);
    const message = error instanceof Error ? error.message : String(error);
    if (namespace === 'openclaw' && /password is required|sudo/i.test(message)) {
      return NextResponse.json(
        { error: 'openclaw alert policy update requires sudo permission for leads service user' },
        { status: 403 },
      );
    }
    return NextResponse.json({ error: 'Failed to update memory alert policy' }, { status: 500 });
  }
}
