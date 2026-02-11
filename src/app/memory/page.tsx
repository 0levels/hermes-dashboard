'use client';

import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, GitCompare, Users } from 'lucide-react';
import { useSmartPoll } from '@/hooks/use-smart-poll';
import { timeAgo } from '@/lib/utils';
import type { MemoryDriftPayload } from '@/types';

export default function MemoryDriftPage() {
  const { data, loading } = useSmartPoll<MemoryDriftPayload | null>(
    () => fetch('/api/memory-drift').then(async r => (r.ok ? r.json() : null)),
    { interval: 120_000, key: 'memory-drift-page' },
  );

  const contradictionAgents = useMemo(
    () => Object.entries(data?.contradictions.by_agent ?? {}).sort((a, b) => b[1] - a[1]),
    [data],
  );

  if (loading || !data) {
    return (
      <div className="space-y-6 animate-in">
        <h1 className="text-xl font-semibold">Memory Drift</h1>
        <div className="panel p-6 h-48 animate-pulse bg-muted/20" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Memory Drift</h1>
        <div className="text-xs text-muted-foreground">Updated {timeAgo(data.collected_at)}</div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Contradictions" value={data.contradictions.count} icon={<AlertTriangle size={14} />} />
        <StatCard label="Duplicate Clusters" value={data.duplicates.count} icon={<GitCompare size={14} />} />
        <StatCard label="Weak Contributors" value={data.contributions.weak_agents.length} icon={<Users size={14} />} />
        <StatCard label="Collective Entries" value={data.collective_total} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Hot Memory" value={data.access.hot_count} />
        <StatCard label="Cold Memory" value={data.access.cold_count} />
        <StatCard label="Never Accessed" value={data.access.never_accessed_count} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <section className="panel">
          <div className="panel-header">
            <h2 className="section-title">Top Contradictions ({data.window_days}d)</h2>
          </div>
          <div className="panel-body">
          {data.contradictions.top_events.length === 0 ? (
            <div className="text-sm text-muted-foreground">No contradiction events in this window.</div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b border-border/40">
                    <th className="text-left py-2">Time</th>
                    <th className="text-left py-2">Action</th>
                    <th className="text-left py-2">Reason</th>
                    <th className="text-left py-2">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {data.contradictions.top_events.slice(0, 15).map((ev, idx) => (
                    <tr key={`${ev.timestamp}-${idx}`} className="border-b border-border/20 align-top">
                      <td className="py-2 pr-2 whitespace-nowrap">{timeAgo(ev.timestamp)}</td>
                      <td className="py-2 pr-2 font-mono">{ev.action}</td>
                      <td className="py-2 pr-2">{ev.reason}</td>
                      <td className="py-2">{ev.value || ev.new_value || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2 className="section-title">Duplicate Clusters</h2>
          </div>
          <div className="panel-body">
          {data.duplicates.top_clusters.length === 0 ? (
            <div className="text-sm text-muted-foreground">No duplicate clusters detected.</div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b border-border/40">
                    <th className="text-left py-2">Type</th>
                    <th className="text-left py-2">Size</th>
                    <th className="text-left py-2">Signature</th>
                    <th className="text-left py-2">Variants</th>
                  </tr>
                </thead>
                <tbody>
                  {data.duplicates.top_clusters.slice(0, 15).map((d, idx) => (
                    <tr key={`${d.type}-${d.signature}-${idx}`} className="border-b border-border/20 align-top">
                      <td className="py-2 pr-2 font-mono">{d.type}</td>
                      <td className="py-2 pr-2 font-mono">{d.size}</td>
                      <td className="py-2 pr-2">{d.signature}</td>
                      <td className="py-2">{d.variants.slice(0, 3).join(' | ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <section className="panel">
          <div className="panel-header">
            <h2 className="section-title">Weak Contributors</h2>
          </div>
          <div className="panel-body">
          {data.contributions.weak_agents.length === 0 ? (
            <div className="text-sm text-muted-foreground">No weak contributors under current threshold.</div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b border-border/40">
                    <th className="text-left py-2">Agent</th>
                    <th className="text-left py-2">Sessions</th>
                    <th className="text-left py-2">Entries</th>
                    <th className="text-left py-2">Ratio</th>
                  </tr>
                </thead>
                <tbody>
                  {data.contributions.weak_agents.map(a => (
                    <tr key={a.agent_id} className="border-b border-border/20">
                      <td className="py-2 pr-2">{a.agent_id}</td>
                      <td className="py-2 pr-2 font-mono">{a.session_files}</td>
                      <td className="py-2 pr-2 font-mono">{a.contributed_entries}</td>
                      <td className="py-2 font-mono">{a.contribution_ratio === null ? '-' : a.contribution_ratio.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2 className="section-title">Contradictions By Agent</h2>
          </div>
          <div className="panel-body">
          {contradictionAgents.length === 0 ? (
            <div className="text-sm text-muted-foreground">No contradiction producers in this window.</div>
          ) : (
            <div className="space-y-2">
              {contradictionAgents.slice(0, 15).map(([agent, count]) => (
                <div key={agent} className="flex items-center justify-between text-xs">
                  <span>{agent}</span>
                  <span className="font-mono">{count}</span>
                </div>
              ))}
            </div>
          )}
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-header">
          <h2 className="section-title">Top Accessed Memory</h2>
        </div>
        <div className="panel-body">
        {data.access.top_accessed.length === 0 ? (
          <div className="text-sm text-muted-foreground">No access data yet.</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-border/40">
                  <th className="text-left py-2">Type</th>
                  <th className="text-left py-2">Access Count</th>
                  <th className="text-left py-2">Last Accessed</th>
                  <th className="text-left py-2">Value</th>
                </tr>
              </thead>
              <tbody>
                {data.access.top_accessed.slice(0, 20).map((row, idx) => (
                  <tr key={`${row.id ?? row.value ?? 'row'}-${idx}`} className="border-b border-border/20 align-top">
                    <td className="py-2 pr-2 font-mono">{row.type ?? '-'}</td>
                    <td className="py-2 pr-2 font-mono">{row.access_count}</td>
                    <td className="py-2 pr-2">{row.last_accessed ? timeAgo(row.last_accessed) : '-'}</td>
                    <td className="py-2">{row.value ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon?: ReactNode }) {
  return (
    <div className="stat-tile">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground uppercase tracking-wide">
        <span>{label}</span>
        {icon}
      </div>
      <div className="text-xl font-semibold font-mono mt-1">{value}</div>
    </div>
  );
}
