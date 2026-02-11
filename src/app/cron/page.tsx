'use client';

import { useMemo, useState } from 'react';
import { Play, Pause, RotateCcw, History, ThermometerSun } from 'lucide-react';
import { useSmartPoll } from '@/hooks/use-smart-poll';
import { toast } from '@/components/ui/toast';

interface CronJob {
  id: string;
  name?: string;
  agentId?: string;
  skill?: string;
  enabled?: boolean;
  schedule?: { expr?: string; tz?: string };
  payload?: { model?: string };
  state?: {
    lastRunAtMs?: number;
    lastStatus?: string;
    lastDurationMs?: number;
    lastError?: string;
    nextRunAtMs?: number;
  };
  lastRun?: string | null;
  lastResult?: string | null;
}

interface CronRun {
  ts?: number | string | null;
  status?: string;
  durationMs?: number | null;
  summary?: string | null;
  error?: string | null;
  nextRunAtMs?: number | null;
}

interface ModelHealth {
  ok?: boolean;
  running?: { name: string; expires_at?: string }[];
}

function formatTime(ms?: number) {
  if (!ms) return '—';
  return new Date(ms).toLocaleString();
}

function formatRunTs(ts?: number | string | null) {
  if (!ts) return '—';
  if (typeof ts === 'number') return new Date(ts).toLocaleString();
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? String(ts) : d.toLocaleString();
}

function normalizeModel(model?: string | null) {
  if (!model) return null;
  return model.replace(/^ollama\//, '');
}

export default function CronBoardPage() {
  const { data } = useSmartPoll<{ jobs: CronJob[] }>(
    () => fetch('/api/cron').then(r => r.json()),
    { interval: 30_000 },
  );
  const { data: modelHealth } = useSmartPoll<ModelHealth>(
    () => fetch('/api/model-health').then(r => r.json()),
    { interval: 30_000 },
  );
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [runs, setRuns] = useState<Record<string, CronRun[]>>({});
  const [openRuns, setOpenRuns] = useState<Record<string, boolean>>({});

  const jobs = useMemo(() => data?.jobs ?? [], [data?.jobs]);
  const runningSet = useMemo(() => {
    const set = new Set<string>();
    for (const m of modelHealth?.running || []) {
      if (m?.name) set.add(m.name);
    }
    return set;
  }, [modelHealth]);

  const summary = useMemo(() => {
    const total = jobs.length;
    const errors = jobs.filter(j => j.enabled !== false && j.state?.lastStatus && j.state.lastStatus !== 'ok').length;
    const disabled = jobs.filter(j => j.enabled === false).length;
    return { total, errors, disabled };
  }, [jobs]);

  const runAction = async (id: string, action: 'toggle' | 'trigger') => {
    setPending((p) => ({ ...p, [id]: true }));
    try {
      const res = await fetch('/api/cron', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      if (!res.ok) throw new Error('Request failed');
      toast.success(action === 'trigger' ? 'Cron triggered' : 'Cron toggled');
    } catch {
      toast.error('Cron action failed');
    } finally {
      setPending((p) => ({ ...p, [id]: false }));
    }
  };

  const toggleRuns = async (id: string) => {
    const open = !openRuns[id];
    setOpenRuns((p) => ({ ...p, [id]: open }));
    if (open && !runs[id]) {
      try {
        const res = await fetch(`/api/cron/runs?id=${encodeURIComponent(id)}`);
        const data = await res.json();
        setRuns((p) => ({ ...p, [id]: data.runs || [] }));
      } catch {
        toast.error('Failed to load runs');
      }
    }
  };

  return (
    <div className="space-y-6 animate-in">
      <div className="panel">
        <div className="panel-header flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-semibold">Cron Board</h1>
            <p className="text-sm text-muted-foreground">Live status from OpenClaw cron jobs</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="status-pill status-neutral">Total: {summary.total}</span>
            <span className={summary.errors > 0 ? 'status-pill status-danger' : 'status-pill status-ok'}>
              Errors: {summary.errors}
            </span>
            <span className="status-pill status-warn">Disabled: {summary.disabled}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {jobs.map(job => {
          const ok = job.state?.lastStatus === 'ok';
          const statusClass = ok ? 'status-pill status-ok' : (job.state?.lastStatus ? 'status-pill status-danger' : 'status-pill status-neutral');
          const busy = !!pending[job.id];
          const isDisabled = job.enabled === false;
          const runList = runs[job.id] || [];
          const model = normalizeModel(job.payload?.model);
          const isWarm = model ? runningSet.has(model) : false;
          return (
            <div key={job.id} className="panel">
              <div className="panel-header">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-sm">{job.name || job.id}</div>
                    <div className="text-xs text-muted-foreground">
                      {job.agentId ? `${job.agentId} · ` : ''}{job.skill || 'cron'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={statusClass}>{job.state?.lastStatus || 'unknown'}</span>
                    {isDisabled && <span className="status-pill status-warn">disabled</span>}
                  </div>
                </div>
              </div>
              <div className="panel-body space-y-3">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-muted-foreground">Schedule</div>
                    <div className="font-mono">{job.schedule?.expr || '—'}</div>
                    <div className="text-muted-foreground">{job.schedule?.tz || ''}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Next Run</div>
                    <div className="font-mono">{formatTime(job.state?.nextRunAtMs)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Last Run</div>
                    <div className="font-mono">{formatTime(job.state?.lastRunAtMs)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Duration</div>
                    <div className="font-mono">{job.state?.lastDurationMs ? `${Math.round(job.state.lastDurationMs / 1000)}s` : '—'}</div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <ThermometerSun size={12} />
                    <span className="text-muted-foreground">Model:</span>
                    <span className="font-mono">{model || '—'}</span>
                    {model && (
                      <span className={isWarm ? 'status-pill status-ok' : 'status-pill status-warn'}>
                        {isWarm ? 'warm' : 'cold'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    className="btn btn-ghost btn-sm text-xs"
                    onClick={() => runAction(job.id, 'trigger')}
                    disabled={busy}
                  >
                    <RotateCcw size={12} /> Run now
                  </button>
                  <button
                    className={`btn btn-sm text-xs ${isDisabled ? 'bg-success/15 text-success hover:bg-success/25' : 'bg-warning/15 text-warning hover:bg-warning/25'}`}
                    onClick={() => runAction(job.id, 'toggle')}
                    disabled={busy}
                  >
                    {isDisabled ? <Play size={12} /> : <Pause size={12} />}
                    {isDisabled ? 'Enable' : 'Disable'}
                  </button>
                  <button
                    className="btn btn-ghost btn-sm text-xs"
                    onClick={() => toggleRuns(job.id)}
                  >
                    <History size={12} /> Runs
                  </button>
                </div>

                {openRuns[job.id] && (
                  <div className="bg-muted/20 border border-border/40 rounded-md p-3 text-xs space-y-2">
                    {runList.length === 0 ? (
                      <div className="text-muted-foreground">No recent runs</div>
                    ) : (
                      runList.map((r, idx) => (
                        <div key={idx} className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-mono">{formatRunTs(r.ts)}</div>
                            {r.summary && (
                              <div className="text-[11px] text-muted-foreground line-clamp-2">{r.summary}</div>
                            )}
                            {r.error && (
                              <div className="text-[11px] text-destructive">{r.error}</div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className={r.status === 'ok' ? 'status-pill status-ok' : 'status-pill status-danger'}>{r.status || 'unknown'}</div>
                            <div className="text-[10px] text-muted-foreground mt-1">
                              {r.durationMs ? `${Math.round(r.durationMs / 1000)}s` : '—'}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {(job.state?.lastStatus && job.state.lastStatus !== 'ok') || job.state?.lastError ? (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-destructive">Error drilldown</summary>
                    <div className="mt-2 bg-destructive/10 border border-destructive/30 rounded-md p-2 space-y-2">
                      <div className="text-[11px]">
                        Last status: <span className="font-mono">{job.state?.lastStatus || 'unknown'}</span>
                      </div>
                      {job.state?.lastError && (
                        <div className="text-[11px] text-destructive">{job.state.lastError}</div>
                      )}
                      {job.lastResult && (
                        <pre className="whitespace-pre-wrap bg-muted/30 border border-border/30 rounded-md p-2 max-h-40 overflow-y-auto">
                          {job.lastResult}
                        </pre>
                      )}
                    </div>
                  </details>
                ) : null}

                {job.lastResult && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground">Last log snippet</summary>
                    <pre className="mt-2 whitespace-pre-wrap bg-muted/30 border border-border/30 rounded-md p-2 max-h-40 overflow-y-auto">
                      {job.lastResult}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
