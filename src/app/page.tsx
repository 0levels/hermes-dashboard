'use client';

import { useEffect } from 'react';
import { PenLine, MessageCircle, Mail, Users, AlertTriangle, Info, AlertCircle } from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';
import { TrendChart } from '@/components/ui/trend-chart';
import { useSmartPoll } from '@/hooks/use-smart-poll';
import { timeAgo } from '@/lib/utils';
import type { OverviewStats, Alert, ActivityEntry, DailyMetrics } from '@/types';

interface OverviewData {
  stats: OverviewStats;
  alerts: Alert[];
  recentActivity: ActivityEntry[];
  metrics: DailyMetrics[];
}

export default function OverviewPage() {
  const { data, loading } = useSmartPoll<OverviewData>(
    () => fetch('/api/overview').then(r => r.json()),
    { interval: 30_000 },
  );

  // Start sync service once
  useEffect(() => { fetch('/api/sync').catch(() => {}); }, []);

  if (!data || loading) {
    return <PageSkeleton />;
  }

  const { stats, alerts, recentActivity, metrics } = data;

  const metricsReversed = [...metrics].reverse();
  const impressionData = metricsReversed.map(m => ({ date: m.date, value: m.total_impressions }));
  const engagementData = metricsReversed.map(m => ({ date: m.date, value: m.total_engagement }));
  const sendsData = metricsReversed.map(m => ({ date: m.date, value: m.sends }));
  const discoveryData = metricsReversed.map(m => ({ date: m.date, value: m.discoveries }));

  return (
    <div className="space-y-6 animate-in">
      <h1 className="text-xl font-semibold">Overview</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Posts Today"
          value={stats.posts_today}
          icon={PenLine}
          sparkline={impressionData.slice(-14).map(d => ({ value: d.value }))}
          color="var(--primary)"
        />
        <StatCard
          label="Engagements Today"
          value={stats.engagement_today}
          icon={MessageCircle}
          sparkline={engagementData.slice(-14).map(d => ({ value: d.value }))}
          color="var(--success)"
        />
        <StatCard
          label="Emails Sent"
          value={stats.emails_sent}
          icon={Mail}
          sparkline={sendsData.slice(-14).map(d => ({ value: d.value }))}
          color="var(--warning)"
        />
        <StatCard
          label="Pipeline"
          value={stats.pipeline_count}
          icon={Users}
          sparkline={discoveryData.slice(-14).map(d => ({ value: d.value }))}
          color="var(--info)"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Impressions (12 weeks)</h3>
          <TrendChart
            data={metricsReversed.map(m => ({ date: m.date.slice(5), impressions: m.total_impressions }))}
            xKey="date"
            lines={[{ key: 'impressions', color: 'var(--primary)', label: 'Impressions' }]}
          />
        </div>
        <div className="card p-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Engagement & Sends (12 weeks)</h3>
          <TrendChart
            data={metricsReversed.map(m => ({
              date: m.date.slice(5),
              engagement: m.total_engagement,
              sends: m.sends,
            }))}
            xKey="date"
            lines={[
              { key: 'engagement', color: 'var(--success)', label: 'Engagement' },
              { key: 'sends', color: 'var(--warning)', label: 'Sends' },
            ]}
          />
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Activity Feed */}
        <div className="card p-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Recent Activity</h3>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet</p>
            ) : (
              recentActivity.map(entry => (
                <div key={entry.id} className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center mt-0.5">
                    <ActionIcon action={entry.action} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{entry.detail || entry.action}</p>
                    <p className="text-xs text-muted-foreground">{timeAgo(entry.ts)}</p>
                  </div>
                  {entry.result && (
                    <span className="text-xs text-success">{entry.result}</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Alerts */}
        <div className="card p-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Alerts</h3>
          <div className="space-y-2">
            {alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">All clear</p>
            ) : (
              alerts.map(alert => (
                <div
                  key={alert.id}
                  className={`flex items-start gap-3 p-3 rounded-lg ${
                    alert.type === 'error' ? 'bg-destructive/10' :
                    alert.type === 'warning' ? 'bg-warning/10' :
                    'bg-info/10'
                  }`}
                >
                  {alert.type === 'error' && <AlertCircle size={16} className="text-destructive mt-0.5" />}
                  {alert.type === 'warning' && <AlertTriangle size={16} className="text-warning mt-0.5" />}
                  {alert.type === 'info' && <Info size={16} className="text-info mt-0.5" />}
                  <p className="text-sm">{alert.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionIcon({ action }: { action: string | null }) {
  const size = 12;
  switch (action) {
    case 'post': return <PenLine size={size} />;
    case 'engage': return <MessageCircle size={size} />;
    case 'send': return <Mail size={size} />;
    default: return <Info size={size} />;
  }
}

function PageSkeleton() {
  return (
    <div className="space-y-6 animate-in">
      <h1 className="text-xl font-semibold">Overview</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="card p-4 h-32 animate-pulse bg-muted/20" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[1, 2].map(i => (
          <div key={i} className="card p-4 h-64 animate-pulse bg-muted/20" />
        ))}
      </div>
    </div>
  );
}
