import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

const STATE_DIR = process.env.HERMES_STATE_DIR || '/home/leads/workspace/state';
const LEADS_PATH = path.join(STATE_DIR, 'leads.json');
const SEQUENCES_PATH = path.join(STATE_DIR, 'sequences.json');

function readJson<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

function parseDate(value?: string) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET() {
  try {
    const leads = readJson<any[]>(LEADS_PATH, []);
    const sequences = readJson<any[]>(SEQUENCES_PATH, []);

    const tierCounts: Record<string, number> = { A: 0, B: 0, C: 0, unknown: 0 };
    const scores: number[] = [];
    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const weekAgo = now - weekMs;
    const prevWeekAgo = now - (2 * weekMs);

    let newLeads7d = 0;
    let newTierA7d = 0;
    let prevLeads7d = 0;
    let prevTierA7d = 0;
    const prevScores: number[] = [];

    const sourceAgg: Record<string, { count: number; tierA: number; scores: number[] }> = {};

    for (const lead of leads) {
      if (lead?.tier && tierCounts[lead.tier] !== undefined) {
        tierCounts[lead.tier] += 1;
      } else {
        tierCounts.unknown += 1;
      }
      if (typeof lead?.score === 'number') scores.push(lead.score);

      const created = parseDate(lead?.created_at);
      if (created) {
        const ts = created.getTime();
        if (ts >= weekAgo) {
          newLeads7d += 1;
          if (lead?.tier === 'A') newTierA7d += 1;
        } else if (ts >= prevWeekAgo && ts < weekAgo) {
          prevLeads7d += 1;
          if (lead?.tier === 'A') prevTierA7d += 1;
          if (typeof lead?.score === 'number') prevScores.push(lead.score);
        }
      }

      const sources: string[] = [];
      if (typeof lead?.source === 'string' && lead.source.trim()) sources.push(lead.source);
      if (Array.isArray(lead?.sources)) {
        for (const s of lead.sources) {
          if (typeof s === 'string' && s.trim()) sources.push(s);
        }
      }
      for (const s of sources) {
        if (!sourceAgg[s]) sourceAgg[s] = { count: 0, tierA: 0, scores: [] };
        sourceAgg[s].count += 1;
        if (lead?.tier === 'A') sourceAgg[s].tierA += 1;
        if (typeof lead?.score === 'number') sourceAgg[s].scores.push(lead.score);
      }
    }

    const totalLeads = leads.length;
    const tierAShare = totalLeads > 0 ? tierCounts.A / totalLeads : 0;
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

    const prevTierAShare = prevLeads7d > 0 ? prevTierA7d / prevLeads7d : 0;
    const prevAvgScore = prevScores.length > 0 ? prevScores.reduce((a, b) => a + b, 0) / prevScores.length : null;

    const countedStatuses = new Set([
      'sent', 'bounced', 'replied', 'opened', 'clicked', 'interested', 'booked', 'qualified', 'unsubscribed', 'opt_out'
    ]);
    const sentTotal = sequences.filter((s) => countedStatuses.has(s?.status)).length;
    const bounces = sequences.filter((s) => s?.status === 'bounced').length;
    const bounceRate = sentTotal > 0 ? bounces / sentTotal : 0;

    const source_quality = Object.entries(sourceAgg)
      .map(([source, v]) => ({
        source,
        count: v.count,
        tier_a_share: v.count > 0 ? v.tierA / v.count : 0,
        avg_score: v.scores.length > 0 ? v.scores.reduce((a, b) => a + b, 0) / v.scores.length : null,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return NextResponse.json({
      total_leads: totalLeads,
      tier_counts: tierCounts,
      tier_a_share: tierAShare,
      avg_score: avgScore,
      new_leads_7d: newLeads7d,
      new_tier_a_7d: newTierA7d,
      prev_new_leads_7d: prevLeads7d,
      prev_new_tier_a_7d: prevTierA7d,
      prev_tier_a_share: prevTierAShare,
      prev_avg_score: prevAvgScore,
      delta_tier_a_share: tierAShare - prevTierAShare,
      delta_avg_score: (avgScore ?? 0) - (prevAvgScore ?? 0),
      delta_new_leads_7d: newLeads7d - prevLeads7d,
      bounce_rate: bounceRate,
      bounces,
      sent_total: sentTotal,
      source_quality,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
