import { spawn } from 'node:child_process';

const LEADS_ADMIN = '/home/openclaw/bin/leads-admin';

interface CommandResult {
  stdout: string;
  stderr: string;
  code: number | null;
}

/**
 * Run a leads-admin CLI command (wraps openclaw with leads env).
 * Resolves on exit; rejects on spawn error or non-zero exit.
 */
export function runLeadsAdmin(
  args: string[],
  opts: { timeoutMs?: number } = {},
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(LEADS_ADMIN, args, { shell: false });

    let stdout = '';
    let stderr = '';
    let timer: NodeJS.Timeout | undefined;

    if (opts.timeoutMs) {
      timer = setTimeout(() => child.kill('SIGKILL'), opts.timeoutMs);
    }

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('error', (err) => {
      if (timer) clearTimeout(timer);
      reject(err);
    });

    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      resolve({ stdout, stderr, code });
    });
  });
}

/**
 * Send a message to an agent via the gateway.
 * Uses `leads-admin agent --agent <id> --message <text> --json`
 * Returns the agent's response text.
 */
export async function sendAgentMessage(
  agentId: string,
  message: string,
  sessionId?: string,
): Promise<{ response: string; sessionId?: string }> {
  const args = [
    'agent',
    '--agent', agentId,
    '--message', message,
    '--json',
  ];
  if (sessionId) {
    args.push('--session-id', sessionId);
  }

  const result = await runLeadsAdmin(args, { timeoutMs: 120_000 });

  // Parse JSON response
  try {
    const data = JSON.parse(result.stdout);
    return {
      response: data.response || data.content || result.stdout.trim(),
      sessionId: data.sessionId,
    };
  } catch {
    // Fall back to raw stdout
    return { response: result.stdout.trim() };
  }
}

/**
 * Send a message to the default orchestrator routing via leads-admin.
 * Uses `leads-admin agent --message <text> --json` (no explicit --agent).
 */
export async function sendOrchestratorMessage(
  message: string,
  sessionId?: string,
): Promise<{ response: string; sessionId?: string }> {
  const args = [
    'agent',
    '--message', message,
    '--json',
  ];
  if (sessionId) {
    args.push('--session-id', sessionId);
  }

  const result = await runLeadsAdmin(args, { timeoutMs: 120_000 });

  try {
    const data = JSON.parse(result.stdout);
    return {
      response: data.response || data.content || result.stdout.trim(),
      sessionId: data.sessionId,
    };
  } catch {
    return { response: result.stdout.trim() };
  }
}
