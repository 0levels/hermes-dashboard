'use client';

import { useState, useCallback, useEffect, useRef, DragEvent } from 'react';
import Link from 'next/link';
import {
  Contact, Search, ChevronRight, ChevronLeft, Mail, Linkedin, Star,
  Clock, Building2, User, ArrowUpDown, X, Pause, Play,
  Send, Eye, CircleDot, MessageSquare, CalendarCheck, CheckCircle, Ban,
  ChevronDown, ChevronUp, Check, XCircle, Edit3, Save, Loader2,
  LayoutList, Kanban, AlertCircle, BarChart3, GripVertical, ExternalLink,
} from 'lucide-react';
import { useSmartPoll } from '@/hooks/use-smart-poll';
import { useDashboard } from '@/store';
import { timeAgo } from '@/lib/utils';
import type { Lead, Sequence, FunnelStep } from '@/types';

interface CrmData {
  leads: Lead[];
  funnel: FunnelStep[];
  summary: {
    total: number;
    avg_score: number;
    tier_breakdown: { tier: string; c: number }[];
    pending_approvals: number;
    emails_sent: number;
    conversion_rate: number;
    tasks_overdue?: number;
    tasks_due_today?: number;
  };
  tasks_overdue?: number;
  tasks_due_today?: number;
}

interface LeadDetail {
  lead: Lead & { pause_outreach?: number };
  sequences: Sequence[];
  timeline: { id: number; type: string; description: string; timestamp: string }[];
}

const STAGES = ['new', 'validated', 'approved', 'contacted', 'replied', 'interested', 'booked', 'qualified'] as const;

const STAGE_ICONS: Record<string, typeof Send> = {
  new: CircleDot,
  validated: CheckCircle,
  approved: Check,
  contacted: Send,
  replied: MessageSquare,
  interested: Eye,
  booked: CalendarCheck,
  qualified: Star,
  rejected: XCircle,
  disqualified: Ban,
};

const STAGE_COLORS: Record<string, string> = {
  new: 'text-muted-foreground',
  validated: 'text-info',
  approved: 'text-success',
  contacted: 'text-primary',
  replied: 'text-warning',
  interested: 'text-success',
  booked: 'text-success',
  qualified: 'text-success',
  rejected: 'text-destructive',
  disqualified: 'text-destructive',
};

const TIER_COLORS: Record<string, string> = {
  A: 'bg-success/15 text-success border-success/30',
  B: 'bg-warning/15 text-warning border-warning/30',
  C: 'bg-muted/30 text-muted-foreground border-border',
};

type ViewMode = 'list' | 'kanban';
type Role = 'admin' | 'editor' | 'viewer';

export default function CrmPage() {
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [selectedLead, setSelectedLead] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'score' | 'created_at'>('score');
  const [refreshKey, setRefreshKey] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [role, setRole] = useState<Role>('viewer');
  const [slaStaleDays, setSlaStaleDays] = useState(7);
  const [slaNewDays, setSlaNewDays] = useState(3);
  const { realOnly } = useDashboard();

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((payload) => setRole(payload?.user?.role === 'admin' || payload?.user?.role === 'editor' ? payload.user.role : 'viewer'))
      .catch(() => setRole('viewer'));
  }, []);

  useEffect(() => {
    fetch('/api/settings/crm')
      .then(r => r.json())
      .then((data) => {
        if (typeof data?.sla_stale_days === 'number') setSlaStaleDays(data.sla_stale_days);
        if (typeof data?.sla_new_days === 'number') setSlaNewDays(data.sla_new_days);
      })
      .catch(() => {});
  }, []);

  const params = new URLSearchParams();
  if (stageFilter) params.set('status', stageFilter);
  if (tierFilter) params.set('tier', tierFilter);
  if (search) params.set('search', search);
  if (realOnly) params.set('real', 'true');

  const { data } = useSmartPoll<CrmData>(
    () => fetch(`/api/crm?${params}`).then(r => r.json()),
    { interval: 30_000, key: `${realOnly}-${refreshKey}` },
  );

  const leads = data?.leads || [];
  const sorted = [...leads].sort((a, b) => {
    if (sortField === 'score') return (b.score ?? 0) - (a.score ?? 0);
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  const tasksDue = leads
    .filter(l => l.next_action_at)
    .sort((a, b) => new Date(a.next_action_at as string).getTime() - new Date(b.next_action_at as string).getTime());

  async function markTaskDone(leadId: string) {
    if (!canEdit) return;
    try {
      await fetch('/api/crm', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: leadId, next_action_at: null, task_done: true }),
      });
      setRefreshKey(k => k + 1);
    } catch {
      // ignore
    }
  }

  const handleMutate = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);
  const canEdit = role === 'admin' || role === 'editor';

  // Kanban drag handler
  async function handleKanbanDrop(leadId: string, newStage: string) {
    if (!canEdit) return;
    try {
      const res = await fetch('/api/crm', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: leadId, status: newStage }),
      });
      if (!res.ok) throw new Error('Update failed');
      setRefreshKey(k => k + 1);
    } catch {
      // silently fail, will refresh on next poll
    }
  }

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold">CRM</h1>
        {data?.summary && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
            <span><strong className="text-foreground">{data.summary.total}</strong> leads</span>
            <span>avg score <strong className="text-foreground">{data.summary.avg_score}</strong></span>
            {data.summary.tier_breakdown.map(t => (
              <span key={t.tier} className={`badge border ${TIER_COLORS[t.tier] || ''}`}>
                Tier {t.tier}: {t.c}
              </span>
            ))}
          {(data.summary?.tasks_overdue ?? data.tasks_overdue ?? 0) > 0 && (
            <span className="badge border bg-destructive/15 text-destructive border-destructive/30">
                SLA breaches: {data.summary?.tasks_overdue ?? data.tasks_overdue}
            </span>
          )}
          {(data.summary?.tasks_due_today ?? data.tasks_due_today ?? 0) > 0 && (
            <span className="badge border bg-warning/15 text-warning border-warning/30">
                Due today: {data.summary?.tasks_due_today ?? data.tasks_due_today}
            </span>
          )}
          </div>
        )}
      </div>

      {/* Quick Stats */}
      {data?.summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="stat-tile">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <BarChart3 size={12} /> Pipeline
            </div>
            <div className="text-lg font-semibold">{data.summary.total}</div>
            <div className="text-[10px] text-muted-foreground">active leads</div>
          </div>
          <div className="stat-tile">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <AlertCircle size={12} className="text-warning" /> Pending
            </div>
            <div className="text-lg font-semibold text-warning">{data.summary.pending_approvals}</div>
            <div className="text-[10px] text-muted-foreground">emails awaiting approval</div>
          </div>
          <div className="stat-tile">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Send size={12} className="text-success" /> Sent
            </div>
            <div className="text-lg font-semibold text-success">{data.summary.emails_sent}</div>
            <div className="text-[10px] text-muted-foreground">emails delivered</div>
          </div>
          <div className="stat-tile">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Star size={12} className="text-primary" /> Conversion
            </div>
            <div className="text-lg font-semibold text-primary">{data.summary.conversion_rate}%</div>
            <div className="text-[10px] text-muted-foreground">reply rate</div>
          </div>
        </div>
      )}

      {/* Pipeline Funnel */}
      {data?.funnel && (
        <div className="panel">
          <div className="panel-header">
            <h3 className="section-title">Pipeline</h3>
          </div>
          <div className="panel-body">
          <div className="flex items-end gap-1 h-20">
            {data.funnel.filter(s => s.name !== 'disqualified').map(step => {
              const maxVal = Math.max(...data.funnel.map(s => s.value), 1);
              const height = Math.max((step.value / maxVal) * 100, 8);
              const Icon = STAGE_ICONS[step.name] || CircleDot;
              const isFiltered = stageFilter === step.name;
              return (
                <button
                  key={step.name}
                  onClick={() => setStageFilter(isFiltered ? '' : step.name)}
                  className={`flex-1 flex flex-col items-center gap-1 group transition-opacity ${
                    stageFilter && !isFiltered ? 'opacity-40' : ''
                  }`}
                >
                  <span className="text-xs font-mono font-semibold">{step.value}</span>
                  <div
                    className={`w-full rounded-t transition-all ${
                      isFiltered ? 'bg-primary' : 'bg-primary/40 group-hover:bg-primary/60'
                    }`}
                    style={{ height: `${height}%` }}
                  />
                  <div className="flex flex-col items-center gap-0.5">
                    <Icon size={12} className={STAGE_COLORS[step.name]} />
                    <span className="text-[9px] text-muted-foreground capitalize">{step.name}</span>
                  </div>
                </button>
              );
            })}
          </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="panel">
        <div className="panel-body !p-3 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search leads..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3"
          />
        </div>
        <select
          value={tierFilter}
          onChange={e => setTierFilter(e.target.value)}
          className="px-3"
        >
          <option value="">All Tiers</option>
          <option value="A">Tier A</option>
          <option value="B">Tier B</option>
          <option value="C">Tier C</option>
        </select>

        {/* View Toggle */}
        <div className="flex items-center border border-border/30 rounded-lg overflow-hidden">
          <button
            onClick={() => setViewMode('list')}
            className={`px-2.5 py-2 text-sm transition-colors ${
              viewMode === 'list' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
            title="List view"
          >
            <LayoutList size={14} />
          </button>
          <button
            onClick={() => setViewMode('kanban')}
            className={`px-2.5 py-2 text-sm transition-colors ${
              viewMode === 'kanban' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Board view"
          >
            <Kanban size={14} />
          </button>
        </div>

        {viewMode === 'list' && (
          <button
            onClick={() => setSortField(sortField === 'score' ? 'created_at' : 'score')}
            className="btn btn-ghost btn-sm"
          >
            <ArrowUpDown size={12} />
            {sortField === 'score' ? 'Score' : 'Date'}
          </button>
        )}
        {(stageFilter || tierFilter || search) && (
          <button onClick={() => { setStageFilter(''); setTierFilter(''); setSearch(''); }} className="btn btn-ghost btn-sm text-destructive">
            <X size={12} /> Clear
          </button>
        )}
        </div>
      </div>

      {/* Tasks Due */}
      {tasksDue.length > 0 && (
        <div className="panel">
          <div className="panel-header flex items-center justify-between">
            <h3 className="section-title">Tasks</h3>
            <button
              className="btn btn-ghost text-xs"
              onClick={() => {
                const rows = tasksDue.map(task => ([
                  task.id,
                  `${task.first_name ?? ''} ${task.last_name ?? ''}`.trim(),
                  task.company ?? '',
                  task.title ?? '',
                  task.email ?? '',
                  task.next_action_at ?? '',
                ]));
                const header = ['id', 'name', 'company', 'title', 'email', 'next_action_at'];
                const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
                const csv = [header.join(','), ...rows.map(r => r.map(escape).join(','))].join('\n');
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'crm-tasks.csv';
                link.click();
                URL.revokeObjectURL(url);
              }}
            >
              Export CSV
            </button>
          </div>
          <div className="panel-body space-y-3">
            {(() => {
              const now = Date.now();
              const overdue = tasksDue.filter(t => new Date(t.next_action_at as string).getTime() < now);
              const dueSoon = tasksDue.filter(t => {
                const ts = new Date(t.next_action_at as string).getTime();
                return ts >= now && ts < now + 24 * 60 * 60 * 1000;
              });
              const upcoming = tasksDue.filter(t => new Date(t.next_action_at as string).getTime() >= now + 24 * 60 * 60 * 1000);

              const renderList = (label: string, items: typeof tasksDue) => (
                <div className="space-y-2">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label} ({items.length})</div>
                  {items.length === 0 ? (
                    <div className="text-xs text-muted-foreground">None</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {items.slice(0, 6).map(task => (
                        <div
                          key={task.id}
                          className="flex items-center justify-between bg-muted/20 rounded-lg px-3 py-2 text-xs hover:bg-muted/30 transition-colors"
                        >
                          <Link href={`/crm/${task.id}`} className="truncate">
                            <span className="font-medium">{task.first_name} {task.last_name}</span>
                            {task.company && <span className="text-muted-foreground"> · {task.company}</span>}
                          </Link>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                              new Date(task.next_action_at as string).getTime() < Date.now()
                                ? 'bg-destructive/15 text-destructive'
                                : 'bg-warning/15 text-warning'
                            }`}>
                              {timeAgo(task.next_action_at as string)}
                            </span>
                            <button
                              onClick={() => markTaskDone(task.id)}
                              disabled={!canEdit}
                              className="text-[10px] text-primary hover:underline disabled:opacity-50"
                            >
                              Done
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );

              return (
                <div className="space-y-3">
                  {renderList('Overdue', overdue)}
                  {renderList('Due Today', dueSoon)}
                  {renderList('Upcoming', upcoming)}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Main Content */}
      {viewMode === 'list' ? (
        /* ─── List View ──────────────────────────────────── */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-2">
            {sorted.length === 0 ? (
              <div className="panel p-8 text-center text-sm text-muted-foreground">No leads found</div>
            ) : (
              sorted.map(lead => (
                <LeadRow
                  key={lead.id}
                  lead={lead}
                  slaStaleDays={slaStaleDays}
                  slaNewDays={slaNewDays}
                  selected={selectedLead === lead.id}
                  onClick={() => setSelectedLead(selectedLead === lead.id ? null : lead.id)}
                />
              ))
            )}
          </div>

          <div className="lg:col-span-1">
            {selectedLead ? (
          <LeadDetailPanel
              key={selectedLead}
              id={selectedLead}
              onClose={() => setSelectedLead(null)}
              onMutate={handleMutate}
              canEdit={canEdit}
              slaStaleDays={slaStaleDays}
              slaNewDays={slaNewDays}
            />
            ) : (
              <div className="panel p-8 text-center text-sm text-muted-foreground sticky top-24">
                <Contact size={32} className="mx-auto mb-3 opacity-30" />
                <p>Select a lead to view details</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ─── Kanban View ────────────────────────────────── */
        <KanbanBoard
          leads={sorted}
          funnel={data?.funnel || []}
          selectedLead={selectedLead}
          onSelectLead={(id) => setSelectedLead(selectedLead === id ? null : id)}
          onDropLead={handleKanbanDrop}
          onMutate={handleMutate}
          onCloseLead={() => setSelectedLead(null)}
          canEdit={canEdit}
          slaStaleDays={slaStaleDays}
          slaNewDays={slaNewDays}
        />
      )}
    </div>
  );
}

/* ─── Kanban Board ─────────────────────────────────────── */

function KanbanBoard({
  leads,
  funnel,
  selectedLead,
  onSelectLead,
  onDropLead,
  onMutate,
  onCloseLead,
  canEdit,
  slaStaleDays,
  slaNewDays,
}: {
  leads: Lead[];
  funnel: FunnelStep[];
  selectedLead: string | null;
  onSelectLead: (id: string) => void;
  onDropLead: (leadId: string, newStage: string) => void;
  onMutate: () => void;
  onCloseLead: () => void;
  canEdit: boolean;
  slaStaleDays: number;
  slaNewDays: number;
}) {
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const stageLeads = STAGES.reduce<Record<string, Lead[]>>((acc, stage) => {
    acc[stage] = leads.filter(l => l.status === stage);
    return acc;
  }, {});

  // Also add rejected/disqualified columns
  const rejectedLeads = leads.filter(l => l.status === 'rejected');
  const dqLeads = leads.filter(l => l.status === 'disqualified');

  return (
    <div className="space-y-4">
      {/* Board + Detail side by side on lg */}
      <div className="flex gap-4">
        <div
          ref={scrollRef}
          className={`flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory ${
            selectedLead ? 'flex-1' : 'w-full'
          }`}
          style={{ scrollbarWidth: 'thin' }}
        >
          {STAGES.map(stage => {
            const count = stageLeads[stage]?.length || 0;
            const funnelStep = funnel.find(f => f.name === stage);
            const Icon = STAGE_ICONS[stage] || CircleDot;

            return (
              <KanbanColumn
                key={stage}
                stage={stage}
                icon={Icon}
                count={count}
                leads={stageLeads[stage] || []}
                selectedLead={selectedLead}
                canEdit={canEdit}
                slaStaleDays={slaStaleDays}
                slaNewDays={slaNewDays}
                isDragOver={dragOverStage === stage}
                onSelectLead={onSelectLead}
                onDragOver={(e) => {
                  if (!canEdit) return;
                  e.preventDefault();
                  setDragOverStage(stage);
                }}
                onDragLeave={() => setDragOverStage(null)}
                onDrop={(e) => {
                  if (!canEdit) return;
                  e.preventDefault();
                  setDragOverStage(null);
                  const leadId = e.dataTransfer.getData('text/plain');
                  if (leadId) onDropLead(leadId, stage);
                }}
              />
            );
          })}

          {/* Rejected column */}
          {rejectedLeads.length > 0 && (
            <KanbanColumn
              stage="rejected"
              icon={XCircle}
              count={rejectedLeads.length}
              leads={rejectedLeads}
              selectedLead={selectedLead}
              canEdit={canEdit}
              slaStaleDays={slaStaleDays}
              slaNewDays={slaNewDays}
              isDragOver={dragOverStage === 'rejected'}
              onSelectLead={onSelectLead}
              onDragOver={(e) => {
                if (!canEdit) return;
                e.preventDefault();
                setDragOverStage('rejected');
              }}
              onDragLeave={() => setDragOverStage(null)}
              onDrop={(e) => {
                if (!canEdit) return;
                e.preventDefault();
                setDragOverStage(null);
                const leadId = e.dataTransfer.getData('text/plain');
                if (leadId) onDropLead(leadId, 'rejected');
              }}
            />
          )}

          {/* Disqualified column */}
          {dqLeads.length > 0 && (
            <KanbanColumn
              stage="disqualified"
              icon={Ban}
              count={dqLeads.length}
              leads={dqLeads}
              selectedLead={selectedLead}
              canEdit={canEdit}
              slaStaleDays={slaStaleDays}
              slaNewDays={slaNewDays}
              isDragOver={dragOverStage === 'disqualified'}
              onSelectLead={onSelectLead}
              onDragOver={(e) => {
                if (!canEdit) return;
                e.preventDefault();
                setDragOverStage('disqualified');
              }}
              onDragLeave={() => setDragOverStage(null)}
              onDrop={(e) => {
                if (!canEdit) return;
                e.preventDefault();
                setDragOverStage(null);
                const leadId = e.dataTransfer.getData('text/plain');
                if (leadId) onDropLead(leadId, 'disqualified');
              }}
            />
          )}
        </div>

        {/* Detail panel in kanban mode */}
        {selectedLead && (
          <div className="hidden lg:block w-80 shrink-0">
          <LeadDetailPanel
            key={selectedLead}
            id={selectedLead}
            onClose={onCloseLead}
            onMutate={onMutate}
            canEdit={canEdit}
            slaStaleDays={slaStaleDays}
            slaNewDays={slaNewDays}
          />
          </div>
        )}
      </div>

      {/* Mobile detail panel */}
      {selectedLead && (
        <div className="lg:hidden">
          <LeadDetailPanel
            key={`mobile-${selectedLead}`}
            id={selectedLead}
            onClose={onCloseLead}
            onMutate={onMutate}
            canEdit={canEdit}
            slaStaleDays={slaStaleDays}
            slaNewDays={slaNewDays}
          />
        </div>
      )}
    </div>
  );
}

/* ─── Kanban Column ────────────────────────────────────── */

function KanbanColumn({
  stage,
  icon: Icon,
  count,
  leads,
  selectedLead,
  canEdit,
  slaStaleDays,
  slaNewDays,
  isDragOver,
  onSelectLead,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  stage: string;
  icon: typeof Send;
  count: number;
  leads: Lead[];
  selectedLead: string | null;
  canEdit: boolean;
  slaStaleDays: number;
  slaNewDays: number;
  isDragOver: boolean;
  onSelectLead: (id: string) => void;
  onDragOver: (e: DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent) => void;
}) {
  return (
    <div
      className={`min-w-[200px] w-[200px] shrink-0 snap-start transition-colors rounded-xl ${
        isDragOver ? 'bg-primary/10 ring-1 ring-primary/30' : ''
      }`}
      onDragOver={canEdit ? onDragOver : undefined}
      onDragLeave={onDragLeave}
      onDrop={canEdit ? onDrop : undefined}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-2 py-2 mb-2">
        <Icon size={13} className={STAGE_COLORS[stage]} />
        <span className="text-xs font-medium capitalize">{stage}</span>
        <span className="text-[10px] font-mono bg-muted/50 px-1.5 py-0.5 rounded ml-auto">{count}</span>
      </div>

      {/* Cards */}
      <div className="space-y-2 min-h-[100px] px-1">
        {leads.map(lead => (
          <KanbanCard
            key={lead.id}
            lead={lead}
            selected={selectedLead === lead.id}
            canEdit={canEdit}
            slaStaleDays={slaStaleDays}
            slaNewDays={slaNewDays}
            onSelect={() => onSelectLead(lead.id)}
          />
        ))}
        {leads.length === 0 && (
          <div className="text-[10px] text-muted-foreground text-center py-6 opacity-50">
            {canEdit ? 'Drop here' : 'No items'}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Kanban Card ──────────────────────────────────────── */

function KanbanCard({ lead, selected, onSelect, canEdit, slaStaleDays, slaNewDays }: { lead: Lead; selected: boolean; onSelect: () => void; canEdit: boolean; slaStaleDays: number; slaNewDays: number }) {
  const isPaused = (lead as { pause_outreach?: number }).pause_outreach === 1;
  const missingEmail = !lead.email;
  const missingCompany = !lead.company;
  const missingIndustry = !lead.industry_segment;
  const staleDays = lead.last_touch_at ? Math.floor((Date.now() - new Date(lead.last_touch_at).getTime()) / (1000 * 60 * 60 * 24)) : null;
  const newDays = !lead.last_touch_at ? Math.floor((Date.now() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24)) : null;

  function handleDragStart(e: DragEvent) {
    if (!canEdit) return;
    e.dataTransfer.setData('text/plain', lead.id);
    e.dataTransfer.effectAllowed = 'move';
  }

  return (
    <div
      draggable={canEdit}
      onDragStart={handleDragStart}
      onClick={onSelect}
      className={`card p-2.5 transition-all text-left hover:border-primary/30 ${
        selected ? 'border-primary/50 bg-primary/5' : ''
      } ${isPaused ? 'opacity-60' : ''} ${canEdit ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
    >
      <div className="flex items-start justify-between gap-1.5 mb-1.5">
        <span className="text-xs font-medium truncate leading-tight">
          {lead.first_name} {lead.last_name}
        </span>
        {lead.tier && (
          <span className={`text-[9px] font-semibold px-1 py-0.5 rounded border shrink-0 ${TIER_COLORS[lead.tier] || ''}`}>
            {lead.tier}
          </span>
        )}
      </div>
      {lead.company && (
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1.5">
          <Building2 size={9} />
          <span className="truncate">{lead.company}</span>
        </div>
      )}
      <div className="flex items-center gap-1 flex-wrap text-[9px] text-muted-foreground mb-1.5">
        {lead.last_touch_at && (
          <span className={`px-1.5 py-0.5 rounded-full ${
            staleDays !== null && staleDays > slaStaleDays
              ? 'bg-destructive/15 text-destructive'
              : staleDays !== null && staleDays > Math.max(1, Math.floor(slaStaleDays / 3))
                ? 'bg-warning/15 text-warning'
                : 'bg-success/15 text-success'
          }`}>
            {timeAgo(lead.last_touch_at)}
          </span>
        )}
        {!lead.last_touch_at && newDays !== null && (
          <span className={`px-1.5 py-0.5 rounded-full ${
            newDays > slaNewDays ? 'bg-destructive/15 text-destructive' : 'bg-warning/15 text-warning'
          }`}>
            new {newDays}d
          </span>
        )}
        {(staleDays !== null && staleDays > slaStaleDays) && (
          <span className="px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive">
            SLA
          </span>
        )}
        {lead.next_action_at && (
          <span className="px-1.5 py-0.5 rounded-full bg-info/15 text-info">
            next {timeAgo(lead.next_action_at)}
          </span>
        )}
        {(missingEmail || missingCompany || missingIndustry) && (
          <span className="px-1.5 py-0.5 rounded-full bg-warning/15 text-warning flex items-center gap-1">
            <AlertCircle size={9} /> missing
          </span>
        )}
      </div>
      <div className="flex items-center justify-between">
        {lead.score != null && (
          <div className="flex items-center gap-1">
            <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  lead.score >= 80 ? 'bg-success' : lead.score >= 50 ? 'bg-warning' : 'bg-destructive'
                }`}
                style={{ width: `${lead.score}%` }}
              />
            </div>
            <span className="text-[9px] font-mono text-muted-foreground">{lead.score}</span>
          </div>
        )}
        {isPaused && <Pause size={10} className="text-warning" />}
      </div>
    </div>
  );
}

/* ─── Lead Row (List View) ─────────────────────────────── */

function LeadRow({ lead, selected, onClick, slaStaleDays, slaNewDays }: { lead: Lead & { pause_outreach?: number }; selected: boolean; onClick: () => void; slaStaleDays: number; slaNewDays: number }) {
  const Icon = STAGE_ICONS[lead.status] || CircleDot;
  const isPaused = (lead as { pause_outreach?: number }).pause_outreach === 1;
  const missingEmail = !lead.email;
  const missingCompany = !lead.company;
  const missingIndustry = !lead.industry_segment;
  const staleDays = lead.last_touch_at ? Math.floor((Date.now() - new Date(lead.last_touch_at).getTime()) / (1000 * 60 * 60 * 24)) : null;
  const newDays = !lead.last_touch_at ? Math.floor((Date.now() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24)) : null;
  return (
    <button
      onClick={onClick}
      className={`card card-hover w-full text-left p-4 flex items-center gap-4 transition-all ${
        selected ? 'border-primary/50 bg-primary/5' : ''
      } ${isPaused ? 'opacity-60' : ''}`}
    >
      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
        {isPaused ? (
          <Pause size={14} className="text-warning" />
        ) : (
          <User size={16} className="text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">
            {lead.first_name} {lead.last_name}
          </span>
          {lead.tier && (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${TIER_COLORS[lead.tier] || ''}`}>
              {lead.tier}
            </span>
          )}
          {isPaused && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-warning/15 text-warning border border-warning/30">
              paused
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
          {lead.company && (
            <span className="flex items-center gap-1 truncate">
              <Building2 size={10} /> {lead.company}
            </span>
          )}
          {lead.title && <span className="truncate">{lead.title}</span>}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-1 flex-wrap">
          {lead.last_touch_at && (
            <span className={`px-2 py-0.5 rounded-full ${
              staleDays !== null && staleDays > slaStaleDays
                ? 'bg-destructive/15 text-destructive'
                : staleDays !== null && staleDays > Math.max(1, Math.floor(slaStaleDays / 3))
                  ? 'bg-warning/15 text-warning'
                  : 'bg-success/15 text-success'
            }`}>
              last touch {timeAgo(lead.last_touch_at)}
            </span>
          )}
          {!lead.last_touch_at && newDays !== null && (
            <span className={`px-2 py-0.5 rounded-full ${
              newDays > slaNewDays ? 'bg-destructive/15 text-destructive' : 'bg-warning/15 text-warning'
            }`}>
              new {newDays}d
            </span>
          )}
          {(staleDays !== null && staleDays > slaStaleDays) && (
            <span className="px-2 py-0.5 rounded-full bg-destructive/15 text-destructive">
              SLA breach
            </span>
          )}
          {lead.next_action_at && (
            <span className="px-2 py-0.5 rounded-full bg-info/15 text-info">
              next {timeAgo(lead.next_action_at)}
            </span>
          )}
          {(missingEmail || missingCompany || missingIndustry) && (
            <span className="px-2 py-0.5 rounded-full bg-warning/15 text-warning flex items-center gap-1">
              <AlertCircle size={10} /> missing {[
                missingEmail ? 'email' : null,
                missingCompany ? 'company' : null,
                missingIndustry ? 'industry' : null,
              ].filter(Boolean).join(', ')}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-1.5">
          <Icon size={14} className={STAGE_COLORS[lead.status]} />
          <span className="text-xs capitalize">{lead.status}</span>
        </div>
        {lead.score != null && (
          <span className="text-xs font-mono font-semibold bg-muted/50 px-2 py-0.5 rounded">
            {lead.score}
          </span>
        )}
        <Link
          href={`/crm/${lead.id}`}
          onClick={(e) => e.stopPropagation()}
          className="text-muted-foreground hover:text-foreground"
          title="Open record"
        >
          <ExternalLink size={14} />
        </Link>
        <ChevronRight size={14} className="text-muted-foreground" />
      </div>
    </button>
  );
}

/* ─── Lead Detail Panel ────────────────────────────────── */

function LeadDetailPanel({ id, onClose, onMutate, canEdit, slaStaleDays, slaNewDays }: { id: string; onClose: () => void; onMutate: () => void; canEdit: boolean; slaStaleDays: number; slaNewDays: number }) {
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [expandedSeq, setExpandedSeq] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [detailRefresh, setDetailRefresh] = useState(0);

  const { data, loading } = useSmartPoll<LeadDetail>(
    () => fetch(`/api/crm?id=${id}`).then(r => {
      if (!r.ok) throw new Error('Failed to load');
      return r.json();
    }),
    { interval: 30_000, key: detailRefresh },
  );

  useEffect(() => {
    if (data?.lead?.notes !== undefined) {
      setNotesValue(data.lead.notes || '');
    }
    if (data?.lead?.next_action_at) {
      setNextAction(data.lead.next_action_at.split('T')[0]);
    }
  }, [data?.lead?.notes, data?.lead?.next_action_at]);

  function showFeedback(type: 'success' | 'error', msg: string) {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 2500);
  }

  async function patchLead(updates: Record<string, unknown>) {
    if (!canEdit) return;
    setSaving(true);
    try {
      const res = await fetch('/api/crm', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      });
      if (!res.ok) throw new Error('Update failed');
      showFeedback('success', 'Updated');
      setDetailRefresh(k => k + 1);
      onMutate();
    } catch {
      showFeedback('error', 'Failed to update');
    } finally {
      setSaving(false);
    }
  }

  async function patchSequence(seqId: string, status: string) {
    if (!canEdit) return;
    setSaving(true);
    try {
      const res = await fetch('/api/crm', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: seqId, type: 'sequence', status }),
      });
      if (!res.ok) throw new Error('Update failed');
      showFeedback('success', status === 'approved' ? 'Email approved' : 'Email rejected');
      setDetailRefresh(k => k + 1);
      onMutate();
    } catch {
      showFeedback('error', 'Failed to update');
    } finally {
      setSaving(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="panel p-6 sticky top-24 flex items-center justify-center h-64">
        <Loader2 size={20} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="panel p-6 sticky top-24 text-center space-y-2">
        <XCircle size={24} className="mx-auto text-destructive/60" />
        <p className="text-sm text-muted-foreground">Failed to load lead</p>
        <button onClick={() => setDetailRefresh(k => k + 1)} className="btn btn-ghost btn-sm">
          Retry
        </button>
      </div>
    );
  }

  const { lead, sequences, timeline } = data;
  const isPaused = (lead as { pause_outreach?: number }).pause_outreach === 1;
  const currentStageIdx = STAGES.indexOf(lead.status as typeof STAGES[number]);
  const canAdvance = currentStageIdx >= 0 && currentStageIdx < STAGES.length - 1;
  const canRevert = currentStageIdx > 0;
  const staleDays = lead.last_touch_at ? Math.floor((Date.now() - new Date(lead.last_touch_at).getTime()) / (1000 * 60 * 60 * 24)) : null;
  const newDays = !lead.last_touch_at ? Math.floor((Date.now() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24)) : null;

  // Sequence analytics
  const sentCount = sequences.filter(s => s.status === 'sent').length;
  const pendingCount = sequences.filter(s => s.status === 'pending_approval').length;
  const totalSteps = sequences.length;

  return (
    <div className="panel sticky top-24 animate-slide-in max-h-[calc(100vh-8rem)] overflow-y-auto">
      {/* Feedback */}
      {feedback && (
        <div className={`mx-5 mt-5 text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 animate-in ${
          feedback.type === 'success' ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'
        }`}>
          {feedback.type === 'success' ? <Check size={12} /> : <XCircle size={12} />}
          {feedback.msg}
        </div>
      )}

      {/* Header */}
      <div className="panel-header">
        <div>
          <h3 className="font-semibold">{lead.first_name} {lead.last_name}</h3>
          <p className="text-xs text-muted-foreground">{lead.title} at {lead.company}</p>
          {!canEdit && <p className="text-[10px] text-muted-foreground mt-0.5">Read-only</p>}
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X size={16} />
        </button>
      </div>

      <div className="panel-body space-y-4">

      {/* Contact Info */}
      <div className="space-y-1.5">
        {lead.email && (
          <a href={`mailto:${lead.email}`} className="flex items-center gap-2 text-xs hover:text-primary transition-colors">
            <Mail size={12} className="text-muted-foreground shrink-0" />
            <span className="font-mono truncate">{lead.email}</span>
          </a>
        )}
        {lead.linkedin_url && (
          <a href={lead.linkedin_url.startsWith('http') ? lead.linkedin_url : `https://${lead.linkedin_url}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs hover:text-primary transition-colors">
            <Linkedin size={12} className="text-muted-foreground shrink-0" />
            <span className="truncate">{lead.linkedin_url}</span>
          </a>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-muted/30 rounded-lg p-2 text-center">
          <div className="text-sm font-semibold">{lead.score ?? '\u2014'}</div>
          <div className="text-[9px] text-muted-foreground uppercase">Score</div>
        </div>
        <div className="bg-muted/30 rounded-lg p-2 text-center">
          <select
            value={lead.tier || ''}
            onChange={e => patchLead({ tier: e.target.value || null })}
            disabled={!canEdit || saving}
            className="bg-transparent text-sm font-semibold text-center w-full cursor-pointer focus:outline-none disabled:opacity-50"
          >
            <option value="">--</option>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
          </select>
          <div className="text-[9px] text-muted-foreground uppercase">Tier</div>
        </div>
        <div className="bg-muted/30 rounded-lg p-2 text-center">
          <div className="text-sm font-semibold capitalize">{lead.status}</div>
          <div className="text-[9px] text-muted-foreground uppercase">Stage</div>
        </div>
      </div>

      {/* Stage Controls */}
      <div className="flex items-center gap-2">
        <button
          disabled={!canEdit || !canRevert || saving}
          onClick={() => patchLead({ status: STAGES[currentStageIdx - 1] })}
          className="btn btn-ghost btn-sm flex-1 disabled:opacity-30"
          title="Previous stage"
        >
          <ChevronLeft size={14} />
          {canRevert ? STAGES[currentStageIdx - 1] : 'Back'}
        </button>
        <button
          disabled={!canEdit || !canAdvance || saving}
          onClick={() => patchLead({ status: STAGES[currentStageIdx + 1] })}
          className="btn btn-sm flex-1 bg-primary/15 text-primary hover:bg-primary/25 disabled:opacity-30"
          title="Advance stage"
        >
          {canAdvance ? STAGES[currentStageIdx + 1] : 'Done'}
          <ChevronRight size={14} />
        </button>
        {lead.status !== 'disqualified' && lead.status !== 'rejected' && (
          <button
            disabled={!canEdit || saving}
            onClick={() => patchLead({ status: 'disqualified' })}
            className="btn btn-ghost btn-sm text-destructive hover:bg-destructive/10"
            title="Disqualify"
          >
            <Ban size={14} />
          </button>
        )}
      </div>

      {/* Lead Triage */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => patchLead({ status: 'approved' })}
          disabled={!canEdit || saving || lead.status === 'approved'}
          className="btn btn-sm bg-success/15 text-success hover:bg-success/25 disabled:opacity-40"
        >
          <Check size={12} /> Approve Lead
        </button>
        <button
          onClick={() => patchLead({ status: 'rejected' })}
          disabled={!canEdit || saving || lead.status === 'rejected'}
          className="btn btn-sm bg-destructive/15 text-destructive hover:bg-destructive/25 disabled:opacity-40"
        >
          <XCircle size={12} /> Reject Lead
        </button>
      </div>

      {/* Pause Toggle */}
      <button
        onClick={() => patchLead({ pause_outreach: isPaused ? 0 : 1 })}
        disabled={!canEdit || saving}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
          isPaused
            ? 'bg-warning/15 text-warning border border-warning/30'
            : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
        }`}
      >
        <span className="flex items-center gap-2">
          {isPaused ? <Pause size={12} /> : <Play size={12} />}
          {isPaused ? 'Outreach Paused' : 'Outreach Active'}
        </span>
        <span className="text-[10px] opacity-70">{isPaused ? 'Click to resume' : 'Click to pause'}</span>
      </button>

      {/* Details */}
      <div className="space-y-1 text-xs">
        {lead.industry_segment && (
          <div className="flex justify-between"><span className="text-muted-foreground">Industry</span><span>{lead.industry_segment}</span></div>
        )}
        {lead.company_size && (
          <div className="flex justify-between"><span className="text-muted-foreground">Size</span><span>{lead.company_size}</span></div>
        )}
        {lead.source && (
          <div className="flex justify-between"><span className="text-muted-foreground">Source</span><span>{lead.source}</span></div>
        )}
        {lead.sequence_name && (
          <div className="flex justify-between"><span className="text-muted-foreground">Sequence</span><span>{lead.sequence_name}</span></div>
        )}
        {lead.last_touch_at && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Last Touch</span>
            <span className={`px-2 py-0.5 rounded-full ${
              staleDays !== null && staleDays > slaStaleDays
                ? 'bg-destructive/15 text-destructive'
                : staleDays !== null && staleDays > Math.max(1, Math.floor(slaStaleDays / 3))
                  ? 'bg-warning/15 text-warning'
                  : 'bg-success/15 text-success'
            }`}>
              {timeAgo(lead.last_touch_at)}
            </span>
          </div>
        )}
        {!lead.last_touch_at && newDays !== null && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">New Lead SLA</span>
            <span className={`px-2 py-0.5 rounded-full ${
              newDays > slaNewDays ? 'bg-destructive/15 text-destructive' : 'bg-warning/15 text-warning'
            }`}>
              {newDays}d
            </span>
          </div>
        )}
        <div className="flex justify-between items-center gap-2">
          <span className="text-muted-foreground">Next Action</span>
          <input
            type="date"
            value={nextAction}
            onChange={e => setNextAction(e.target.value)}
            className="bg-muted/30 rounded px-2 py-0.5 text-[10px]"
            disabled={!canEdit || saving}
          />
          <button
            onClick={() => patchLead({ next_action_at: nextAction ? new Date(`${nextAction}T00:00:00.000Z`).toISOString() : null })}
            disabled={!canEdit || saving}
            className="btn btn-ghost btn-sm text-[10px]"
          >
            Save
          </button>
        </div>
        {lead.reply_type && (
          <div className="flex justify-between"><span className="text-muted-foreground">Reply Type</span><span className="capitalize">{lead.reply_type.replace('_', ' ')}</span></div>
        )}
      </div>

      {/* Notes */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Edit3 size={12} /> Notes
          </h4>
          {!editingNotes && canEdit && (
            <button
              onClick={() => { setEditingNotes(true); setNotesValue(lead.notes || ''); }}
              className="text-[10px] text-primary hover:underline"
            >
              Edit
            </button>
          )}
        </div>
        {editingNotes ? (
          <div className="space-y-2">
            <textarea
              value={notesValue}
              onChange={e => setNotesValue(e.target.value)}
              placeholder="Add notes about this lead..."
              rows={3}
              className="w-full text-xs resize-none"
            />
            <div className="flex items-center gap-2 justify-end">
              <button onClick={() => setEditingNotes(false)} className="btn btn-ghost btn-sm text-xs">Cancel</button>
              <button
                onClick={() => { patchLead({ notes: notesValue }); setEditingNotes(false); }}
                disabled={!canEdit || saving}
                className="btn btn-sm text-xs bg-primary/15 text-primary hover:bg-primary/25"
              >
                <Save size={12} /> Save
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-muted/20 rounded-lg p-3 text-xs min-h-[2rem]">
            {lead.notes || <span className="text-muted-foreground italic">No notes yet</span>}
          </div>
        )}
      </div>

      {/* Timeline */}
      {timeline.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
            <Clock size={12} /> Timeline
          </h4>
          <div className="space-y-3 relative before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-px before:bg-border">
            {timeline.map(event => (
              <div key={event.id} className="flex items-start gap-3 pl-0 relative">
                <div className={`w-[15px] h-[15px] rounded-full border-2 border-background shrink-0 z-10 ${
                  event.type === 'pending_approval' ? 'bg-warning' :
                  event.type === 'approved' ? 'bg-success' :
                  'bg-muted'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs leading-relaxed">{event.description}</p>
                  <p className="text-[10px] text-muted-foreground">{timeAgo(event.timestamp)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Email Sequences */}
      {sequences.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Send size={12} /> Email Sequences ({sequences.length})
            </h4>
            {/* Mini analytics */}
            <div className="flex items-center gap-2 text-[10px]">
              {sentCount > 0 && (
                <span className="text-success">{sentCount} sent</span>
              )}
              {pendingCount > 0 && (
                <span className="text-warning">{pendingCount} pending</span>
              )}
            </div>
          </div>

          {/* Progress bar */}
          {totalSteps > 0 && (
            <div className="flex items-center gap-1.5 mb-2">
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-success transition-all"
                  style={{ width: `${(sentCount / totalSteps) * 100}%` }}
                />
                <div
                  className="h-full bg-warning transition-all"
                  style={{ width: `${(pendingCount / totalSteps) * 100}%` }}
                />
              </div>
              <span className="text-[9px] text-muted-foreground font-mono">
                {sentCount}/{totalSteps}
              </span>
            </div>
          )}

          <div className="space-y-1.5">
            {sequences.map(seq => (
              <div key={seq.id} className="bg-muted/20 rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedSeq(expandedSeq === seq.id ? null : seq.id)}
                  className="w-full flex items-center justify-between text-xs px-3 py-2 hover:bg-muted/30 transition-colors"
                >
                  <div className="truncate text-left">
                    <span className="text-muted-foreground">Step {seq.step}: </span>
                    {seq.subject || 'No subject'}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className={`${
                      seq.status === 'sent' ? 'text-success' :
                      seq.status === 'pending_approval' ? 'text-warning' :
                      seq.status === 'approved' ? 'text-info' :
                      seq.status === 'cancelled' ? 'text-destructive' :
                      'text-muted-foreground'
                    }`}>
                      {seq.status === 'pending_approval' ? 'pending' : seq.status}
                    </span>
                    {expandedSeq === seq.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </div>
                </button>

                {expandedSeq === seq.id && (
                  <div className="border-t border-border/20 px-3 py-2 space-y-2">
                    {seq.body ? (
                      <div className="text-xs bg-background/50 rounded p-2 whitespace-pre-wrap max-h-40 overflow-y-auto font-mono leading-relaxed">
                        {seq.body}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">No email body available</p>
                    )}
                    {seq.scheduled_for && (
                      <p className="text-[10px] text-muted-foreground">
                        Scheduled: {new Date(seq.scheduled_for).toLocaleString()}
                      </p>
                    )}
                    {seq.sent_at && (
                      <p className="text-[10px] text-muted-foreground">
                        Sent: {new Date(seq.sent_at).toLocaleString()}
                      </p>
                    )}

                    {seq.status === 'pending_approval' && canEdit && (
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => patchSequence(seq.id, 'approved')}
                          disabled={saving}
                          className="btn btn-sm text-xs bg-success/15 text-success hover:bg-success/25 flex-1"
                        >
                          <Check size={12} /> Approve
                        </button>
                        <button
                          onClick={() => patchSequence(seq.id, 'cancelled')}
                          disabled={saving}
                          className="btn btn-sm text-xs bg-destructive/15 text-destructive hover:bg-destructive/25 flex-1"
                        >
                          <XCircle size={12} /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
