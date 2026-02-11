import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { requireApiUser } from '@/lib/api-auth';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

type Namespace = 'leads' | 'openclaw';

const POLICY_FILES: Record<Namespace, string> = {
  leads: '/home/leads/.openclaw/health/memory-policy.json',
  openclaw: '/home/openclaw/.openclaw/health/memory-policy.json',
};
const POLICY_AUDIT_FILES: Record<Namespace, string> = {
  leads: '/home/leads/.openclaw/logs/memory-policy-audit.jsonl',
  openclaw: '/home/openclaw/.openclaw/logs/memory-policy-audit.jsonl',
};

type MemoryPolicy = {
  decay_half_life_days: number;
  min_effective_confidence: number;
  min_keep_confidence: number;
  low_confidence_prune_days: number;
  default_ttl_days: number;
};

const DEFAULT_POLICY: MemoryPolicy = {
  decay_half_life_days: 45,
  min_effective_confidence: 0.35,
  min_keep_confidence: 0.55,
  low_confidence_prune_days: 30,
  default_ttl_days: 90,
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function sanitize(input: Partial<MemoryPolicy>): MemoryPolicy {
  return {
    decay_half_life_days: clamp(Number(input.decay_half_life_days ?? DEFAULT_POLICY.decay_half_life_days), 7, 365),
    min_effective_confidence: clamp(Number(input.min_effective_confidence ?? DEFAULT_POLICY.min_effective_confidence), 0, 1),
    min_keep_confidence: clamp(Number(input.min_keep_confidence ?? DEFAULT_POLICY.min_keep_confidence), 0, 1),
    low_confidence_prune_days: clamp(Number(input.low_confidence_prune_days ?? DEFAULT_POLICY.low_confidence_prune_days), 1, 365),
    default_ttl_days: clamp(Number(input.default_ttl_days ?? DEFAULT_POLICY.default_ttl_days), 7, 365),
  };
}

function parseNamespace(value: string | null | undefined): Namespace {
  return value === 'openclaw' ? 'openclaw' : 'leads';
}

function readPolicy(namespace: Namespace): MemoryPolicy {
  try {
    const policyFile = POLICY_FILES[namespace];
    if (!fs.existsSync(policyFile)) return DEFAULT_POLICY;
    const raw = fs.readFileSync(policyFile, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<MemoryPolicy>;
    return sanitize(parsed);
  } catch {
    return DEFAULT_POLICY;
  }
}

function writePolicy(namespace: Namespace, policy: MemoryPolicy): void {
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

function rewriteKbCron(namespace: Namespace, policy: MemoryPolicy): { updated: boolean; line: string | null } {
  const current = crontabList(namespace);
  const lines = current.split('\n');
  let updated = false;
  let outLine: string | null = null;
  const targetNsArg = `--namespace ${namespace}`;

  const next = lines.map(line => {
    if (!line.includes('kb-manager.py') || !line.includes(targetNsArg)) return line;

    let rewritten = line
      .replace(/\s--decay-half-life-days\s+\S+/g, '')
      .replace(/\s--min-effective-confidence\s+\S+/g, '')
      .replace(/\s--min-keep-confidence\s+\S+/g, '')
      .replace(/\s--low-confidence-prune-days\s+\S+/g, '')
      .replace(/\s--default-ttl-days\s+\S+/g, '');

    const opts =
      ` --decay-half-life-days ${policy.decay_half_life_days}` +
      ` --min-effective-confidence ${policy.min_effective_confidence}` +
      ` --min-keep-confidence ${policy.min_keep_confidence}` +
      ` --low-confidence-prune-days ${policy.low_confidence_prune_days}` +
      ` --default-ttl-days ${policy.default_ttl_days}`;

    const redirectIdx = rewritten.indexOf(' >> ');
    if (redirectIdx >= 0) {
      rewritten = `${rewritten.slice(0, redirectIdx)}${opts}${rewritten.slice(redirectIdx)}`;
    } else {
      rewritten = `${rewritten}${opts}`;
    }

    updated = true;
    outLine = rewritten;
    return rewritten;
  });

  if (updated) {
    const tmp = namespace === 'openclaw'
      ? '/tmp/hermes-openclaw-cron.txt'
      : '/tmp/hermes-leads-cron.txt';
    fs.writeFileSync(tmp, next.join('\n'), 'utf-8');
    crontabWrite(namespace, tmp);
  }

  return { updated, line: outLine };
}

export async function GET(request: Request) {
  const auth = requireApiUser(request as Request);
  if (auth) return auth;
  try {
    const url = new URL(request.url);
    const namespace = parseNamespace(url.searchParams.get('namespace'));
    const policy = readPolicy(namespace);
    return NextResponse.json({ namespace, policy });
  } catch (error) {
    console.error('GET /api/memory-policy error:', error);
    return NextResponse.json({ error: 'Failed to read memory policy' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = requireApiUser(request as Request);
  if (auth) return auth;
  let namespace: Namespace = 'leads';
  try {
    const actor = requireUser(request as Request);
    const body = (await request.json()) as Partial<MemoryPolicy> & { namespace?: Namespace };
    namespace = parseNamespace(body.namespace);
    const before = readPolicy(namespace);
    const policy = sanitize(body);
    writePolicy(namespace, policy);
    const cron = rewriteKbCron(namespace, policy);
    appendPolicyAudit(namespace, {
      timestamp: new Date().toISOString(),
      actor: actor.username,
      actor_role: actor.role,
      namespace,
      before,
      after: policy,
      cron_updated: cron.updated,
      cron_line: cron.line,
    });
    return NextResponse.json({ ok: true, namespace, policy, cron });
  } catch (error) {
    console.error('POST /api/memory-policy error:', error);
    const message = error instanceof Error ? error.message : String(error);
    if (namespace === 'openclaw' && /password is required|sudo/i.test(message)) {
      return NextResponse.json(
        { error: 'openclaw policy update requires sudo permission for leads service user' },
        { status: 403 },
      );
    }
    return NextResponse.json({ error: 'Failed to update memory policy' }, { status: 500 });
  }
}
