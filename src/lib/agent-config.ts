import fs from 'fs';
import path from 'path';

export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  category: 'marketing' | 'sales' | 'research' | 'ops';
}

export interface CronJob {
  id: string;
  label: string;
  skill: string;
  schedule: string; // human-readable
  cron: string; // cron expression
  days?: string[]; // ['mon'] for monday-only, etc.
}

export interface AgentDefinition {
  id: string;
  name: string;
  emoji: string;
  role: string;
  description: string;
  model: string;
  fallbacks: string[];
  tools: string[];
  skills: AgentSkill[];
  cronJobs: CronJob[];
  workspace: string;
}

interface OpenClawModel {
  primary?: unknown;
  fallbacks?: unknown;
}

interface OpenClawAgent {
  id?: unknown;
  name?: unknown;
  workspace?: unknown;
  model?: unknown;
  identity?: {
    emoji?: unknown;
    theme?: unknown;
  };
  tools?: {
    allow?: unknown;
  };
}

interface OpenClawConfig {
  agents?: {
    defaults?: { model?: unknown };
    list?: OpenClawAgent[];
  };
}

type AgentStaticMeta = {
  name?: string;
  emoji?: string;
  role?: string;
  description?: string;
  model?: string;
  fallbacks?: string[];
  tools?: string[];
  workspace?: string;
  skills?: AgentSkill[];
  cronJobs?: CronJob[];
};

const OPENCLAW_DIR = '/home/leads/.openclaw';
const OPENCLAW_CONFIG = path.join(OPENCLAW_DIR, 'openclaw.json');
const OPENCLAW_AGENTS_DIR = path.join(OPENCLAW_DIR, 'agents');

const DEFAULT_ORDER = ['hermes', 'apollo', 'athena', 'metis', 'kb-manager'];

const AGENT_ID_ALIASES: Record<string, string> = {
  marketing: 'hermes',
  sales: 'apollo',
  knowledge: 'athena',
  analytics: 'metis',
  manager: 'kb-manager',
  core: 'kb-manager',
};

const STATIC_META: Record<string, AgentStaticMeta> = {
  hermes: {
    name: 'Hermes',
    emoji: '\u{1F3DB}\u{FE0F}',
    role: 'Marketing Engine',
    description:
      'Content creation, social engagement, brand building, and experiment management. Owns the public voice of Builderz across X and LinkedIn.',
    model: 'Claude Sonnet 4',
    fallbacks: ['Haiku 4.5', 'Qwen 2.5 14B'],
    tools: ['read', 'write', 'exec', 'bash', 'memory_get', 'memory_search', 'message', 'reactions', 'web_search', 'web_fetch'],
    workspace: '/home/leads/workspace',
    skills: [
      {
        id: 'x-research',
        name: 'X Research',
        description: 'Search X via API v2 for ICP pain signals, trending topics, and engagement opportunities',
        category: 'research',
      },
      {
        id: 'content-engine',
        name: 'Content Engine',
        description: 'Draft LinkedIn + X content by pillar with calendar planning and A/B variants',
        category: 'marketing',
      },
      {
        id: 'social-engagement',
        name: 'Social Engagement',
        description: 'Reply to mentions, quote-tweet opportunities, LinkedIn comments, strategic follows',
        category: 'marketing',
      },
      {
        id: 'social-listening',
        name: 'Social Listening',
        description: 'Monitor brand mentions, competitor activity, pain-point keywords, and opportunities',
        category: 'research',
      },
      {
        id: 'cold-outreach',
        name: 'Cold Outreach',
        description: 'Full email pipeline: discover, score, personalize, send. Manages sequences and suppression',
        category: 'sales',
      },
      {
        id: 'reply-triage',
        name: 'Reply Triage',
        description: 'Classify replies from email, X, and DMs into interested/objection/unsubscribe/spam',
        category: 'ops',
      },
      {
        id: 'experiment-tracker',
        name: 'Experiment Tracker',
        description: 'Weekly marketing experiment lifecycle: propose, run, measure, decide (SCALE/ITERATE/KILL)',
        category: 'ops',
      },
      {
        id: 'reporting',
        name: 'Reporting',
        description: 'Daily Telegram summary with key metrics + weekly deep-dive performance review',
        category: 'ops',
      },
    ],
    cronJobs: [
      { id: 'morning-research', label: 'Morning Research', skill: 'x-research', schedule: '8:00 AM', cron: '0 8 * * 1-5' },
      { id: 'morning-engagement', label: 'Morning Engagement', skill: 'social-engagement', schedule: '9:30 AM', cron: '30 9 * * 1-5' },
      { id: 'monday-content', label: 'Content Planning', skill: 'content-engine', schedule: '10:00 AM', cron: '0 10 * * 1', days: ['mon'] },
      { id: 'monday-experiment', label: 'Experiment Review', skill: 'experiment-tracker', schedule: '10:30 AM', cron: '30 10 * * 1', days: ['mon'] },
      { id: 'midday-listening', label: 'Midday Listening', skill: 'social-listening', schedule: '12:00 PM', cron: '0 12 * * 1-5' },
      { id: 'afternoon-engagement', label: 'Afternoon Engagement', skill: 'social-engagement', schedule: '2:00 PM', cron: '0 14 * * 1-5' },
      { id: 'daily-report', label: 'Daily Report', skill: 'reporting', schedule: '6:00 PM', cron: '0 18 * * 1-5' },
      { id: 'friday-review', label: 'Weekly Review', skill: 'experiment-tracker', schedule: '4:00 PM', cron: '0 16 * * 5', days: ['fri'] },
    ],
  },
  apollo: {
    name: 'Apollo',
    emoji: '\u{1F3AF}',
    role: 'Sales Pipeline',
    description:
      'Lead discovery, scoring, email sequences, reply triage, and CRM management. Owns the outbound pipeline from discovery to qualification.',
    model: 'Claude Sonnet 4',
    fallbacks: ['Haiku 4.5', 'Qwen 2.5 14B'],
    tools: ['read', 'write', 'exec', 'bash', 'memory_get', 'memory_search', 'web_search', 'web_fetch'],
    workspace: '/home/leads/.openclaw/workspace-apollo',
    skills: [
      {
        id: 'cold-outreach',
        name: 'Cold Outreach',
        description: 'Lead discovery via enrichment APIs, ICP scoring, personalized email sequences, bounce/suppression management',
        category: 'sales',
      },
      {
        id: 'reply-triage',
        name: 'Reply Triage',
        description: 'Classify email replies, update lead stages, handle objections, route interested leads to CRM',
        category: 'sales',
      },
    ],
    cronJobs: [
      { id: 'outreach-pipeline', label: 'Outreach Pipeline', skill: 'cold-outreach', schedule: '10:30 AM', cron: '30 10 * * 1-5' },
      { id: 'evening-triage', label: 'Evening Triage', skill: 'reply-triage', schedule: '7:00 PM', cron: '0 19 * * 1-5' },
    ],
  },
  athena: {
    name: 'Athena',
    emoji: '\u{1F9E0}',
    role: 'SEO & Content Optimization',
    description: 'SEO strategy, keyword research, content optimization, competitor analysis, and search performance tracking.',
    model: 'Kimi K2.5',
    fallbacks: ['Claude Sonnet 4', 'Qwen 2.5 14B'],
    tools: ['read', 'write', 'exec', 'bash', 'web_search', 'web_fetch', 'memory_search', 'memory_get'],
    workspace: '/home/leads/.openclaw/workspace-athena',
    skills: [
      { id: 'seo-audit', name: 'SEO Audit', description: 'Audit technical SEO, content quality, indexing and ranking blockers', category: 'research' },
      {
        id: 'keyword-research',
        name: 'Keyword Research',
        description: 'Discover and prioritize keyword opportunities by intent and competitiveness',
        category: 'research',
      },
      {
        id: 'content-optimization',
        name: 'Content Optimization',
        description: 'Improve existing pages for relevance, structure, and SERP performance',
        category: 'marketing',
      },
      {
        id: 'competitor-analysis',
        name: 'Competitor Analysis',
        description: 'Track competitor positioning, content gaps, and ranking deltas',
        category: 'research',
      },
    ],
    cronJobs: [
      { id: 'seo-daily-scan', label: 'Daily SEO Scan', skill: 'seo-audit', schedule: '9:00 AM', cron: '0 9 * * 1-5' },
      { id: 'keyword-refresh', label: 'Keyword Refresh', skill: 'keyword-research', schedule: '2:30 PM', cron: '30 14 * * 1-5' },
    ],
  },
  metis: {
    name: 'Metis',
    emoji: '\u{1F4CA}',
    role: 'Analytics & Reporting',
    description: 'Performance analytics, KPI tracking, report generation, data analysis, and actionable insights across all channels.',
    model: 'Claude Sonnet 4',
    fallbacks: ['Qwen 2.5 14B', 'Kimi K2.5'],
    tools: ['read', 'write', 'exec', 'bash', 'memory_search', 'memory_get'],
    workspace: '/home/leads/.openclaw/workspace-metis',
    skills: [
      {
        id: 'performance-report',
        name: 'Performance Report',
        description: 'Generate daily/weekly performance reports with key outcomes and deltas',
        category: 'ops',
      },
      { id: 'data-analysis', name: 'Data Analysis', description: 'Analyze conversion, engagement, and funnel performance data', category: 'ops' },
      {
        id: 'trend-detection',
        name: 'Trend Detection',
        description: 'Detect anomalies, trends, and statistically significant changes in KPIs',
        category: 'research',
      },
    ],
    cronJobs: [
      { id: 'daily-kpi-summary', label: 'Daily KPI Summary', skill: 'performance-report', schedule: '7:30 PM', cron: '30 19 * * 1-5' },
      { id: 'weekly-insights', label: 'Weekly Insights', skill: 'trend-detection', schedule: '5:00 PM', cron: '0 17 * * 5', days: ['fri'] },
    ],
  },
  'kb-manager': {
    name: 'KB Manager',
    emoji: '\u{1F4DA}',
    role: 'Knowledge Management',
    description: 'Maintains collective memory, knowledge quality, and retrieval consistency across agents.',
    model: 'Kimi K2.5',
    fallbacks: ['Claude Sonnet 4', 'Qwen 2.5 14B'],
    tools: ['read', 'write', 'exec', 'bash', 'memory_search', 'memory_get'],
    workspace: '/home/leads/.openclaw/workspace-kb-manager',
    skills: [
      { id: 'memory-curation', name: 'Memory Curation', description: 'Cleans and curates long-term memory artifacts', category: 'ops' },
      { id: 'knowledge-sync', name: 'Knowledge Sync', description: 'Keeps shared knowledge synchronized across agents', category: 'ops' },
    ],
    cronJobs: [],
  },
};

function toTitleCase(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function defaultWorkspaceFor(agentId: string): string {
  return agentId === 'hermes' ? '/home/leads/workspace' : `/home/leads/.openclaw/workspace-${agentId}`;
}

function readOpenClawConfig(): OpenClawConfig | null {
  try {
    if (!fs.existsSync(OPENCLAW_CONFIG)) return null;
    return JSON.parse(fs.readFileSync(OPENCLAW_CONFIG, 'utf-8')) as OpenClawConfig;
  } catch {
    return null;
  }
}

function parseModelRouting(value: unknown): { primary: string; fallbacks: string[] } | null {
  if (!value) return null;
  if (typeof value === 'string') return { primary: value, fallbacks: [] };
  if (typeof value !== 'object') return null;

  const model = value as OpenClawModel;
  const primary = typeof model.primary === 'string' ? model.primary : null;
  const fallbacks = Array.isArray(model.fallbacks)
    ? model.fallbacks.filter((m): m is string => typeof m === 'string')
    : [];

  if (!primary) return null;
  return { primary, fallbacks };
}

function normalizeAgentId(id: string): string {
  const normalized = id.trim().toLowerCase();
  return AGENT_ID_ALIASES[normalized] ?? normalized;
}

function discoverAgentIdsFromSessions(): string[] {
  try {
    if (!fs.existsSync(OPENCLAW_AGENTS_DIR)) return [];
    return fs
      .readdirSync(OPENCLAW_AGENTS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .filter((id) => id !== 'main');
  } catch {
    return [];
  }
}

function sortAgentIds(ids: string[]): string[] {
  return [...ids].sort((a, b) => {
    const ia = DEFAULT_ORDER.indexOf(a);
    const ib = DEFAULT_ORDER.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });
}

export function getAgents(): AgentDefinition[] {
  const config = readOpenClawConfig();
  const defaultsModel = parseModelRouting(config?.agents?.defaults?.model);

  const configuredList = Array.isArray(config?.agents?.list) ? config?.agents?.list ?? [] : [];
  const configuredById = new Map<string, OpenClawAgent>();

  for (const entry of configuredList) {
    if (!entry || typeof entry.id !== 'string' || !entry.id.trim()) continue;
    const normalizedId = normalizeAgentId(entry.id);
    configuredById.set(normalizedId, entry);
  }

  const ids = new Set<string>();

  // Prefer explicit configuration when present, and only fall back to filesystem discovery
  // for legacy or bootstrap setups where the config list is missing/empty.
  if (configuredById.size > 0) {
    for (const id of configuredById.keys()) ids.add(id);
  } else {
    for (const id of discoverAgentIdsFromSessions()) ids.add(normalizeAgentId(id));
  }

  if (ids.size === 0) {
    for (const id of Object.keys(STATIC_META)) ids.add(id);
  }

  return sortAgentIds([...ids]).map((id) => {
    const configured = configuredById.get(id);
    const staticMeta = STATIC_META[id] ?? {};

    const identityEmoji = typeof configured?.identity?.emoji === 'string' ? configured.identity.emoji : undefined;
    const identityTheme = typeof configured?.identity?.theme === 'string' ? configured.identity.theme : undefined;

    const modelRouting = parseModelRouting(configured?.model) ?? defaultsModel;

    const allowedTools = Array.isArray(configured?.tools?.allow)
      ? configured.tools.allow.filter((t): t is string => typeof t === 'string')
      : null;

    const name =
      (typeof configured?.name === 'string' && configured.name.trim()) ||
      staticMeta.name ||
      toTitleCase(id);

    const role = staticMeta.role || (identityTheme ? toTitleCase(identityTheme) : 'Agent');

    const workspace =
      (typeof configured?.workspace === 'string' && configured.workspace.trim()) ||
      staticMeta.workspace ||
      defaultWorkspaceFor(id);

    return {
      id,
      name,
      emoji: staticMeta.emoji || identityEmoji || '\u{1F916}',
      role,
      description: staticMeta.description || `${name} autonomous agent.`,
      model: modelRouting?.primary || staticMeta.model || 'unknown',
      fallbacks: modelRouting?.fallbacks ?? staticMeta.fallbacks ?? [],
      tools: allowedTools ?? staticMeta.tools ?? [],
      skills: staticMeta.skills ?? [],
      cronJobs: staticMeta.cronJobs ?? [],
      workspace,
    };
  });
}

export function getAgentIds(): string[] {
  return getAgents().map((a) => a.id);
}

export function getAgent(id: string): AgentDefinition | undefined {
  return getAgents().find((a) => a.id === id);
}

// Map activity_log actions to agent + skill
export const ACTION_TO_AGENT: Record<string, { agent: string; skill: string }> = {
  post: { agent: 'hermes', skill: 'content-engine' },
  engage: { agent: 'hermes', skill: 'social-engagement' },
  research: { agent: 'hermes', skill: 'x-research' },
  discover: { agent: 'apollo', skill: 'cold-outreach' },
  send: { agent: 'apollo', skill: 'cold-outreach' },
  triage: { agent: 'apollo', skill: 'reply-triage' },
  alert: { agent: 'hermes', skill: 'reporting' },
};

// Back-compat export for routes still importing AGENTS directly.
export const AGENTS: AgentDefinition[] = getAgents();
