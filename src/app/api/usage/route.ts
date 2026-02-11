import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const db = getDb();
  const daysParam = Number(req.nextUrl.searchParams.get('days') || 14);
  const days = Number.isFinite(daysParam) ? Math.max(1, Math.min(90, Math.floor(daysParam))) : 14;
  const today = new Date().toISOString().slice(0, 10);

  const totals = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN day = ? THEN total_tokens ELSE 0 END), 0) AS tokens_today,
      COALESCE(SUM(CASE WHEN day >= date('now', '-6 days') THEN total_tokens ELSE 0 END), 0) AS tokens_week,
      COALESCE(SUM(CASE WHEN day = ? THEN cost_usd ELSE 0 END), 0) AS cost_today,
      COALESCE(SUM(CASE WHEN day >= date('now', '-6 days') THEN cost_usd ELSE 0 END), 0) AS cost_week,
      COALESCE(SUM(CASE WHEN day >= date('now', '-29 days') THEN total_tokens ELSE 0 END), 0) AS tokens_30d,
      COALESCE(SUM(CASE WHEN day >= date('now', '-29 days') THEN cost_usd ELSE 0 END), 0) AS cost_30d
    FROM llm_usage_events
  `).get(today, today);

  const byAgent = db.prepare(`
    SELECT
      agent_id,
      COALESCE(SUM(CASE WHEN day = ? THEN total_tokens ELSE 0 END), 0) AS tokens_today,
      COALESCE(SUM(CASE WHEN day >= date('now', '-6 days') THEN total_tokens ELSE 0 END), 0) AS tokens_week,
      COALESCE(SUM(CASE WHEN day = ? THEN cost_usd ELSE 0 END), 0) AS cost_today,
      COALESCE(SUM(CASE WHEN day >= date('now', '-6 days') THEN cost_usd ELSE 0 END), 0) AS cost_week
    FROM llm_usage_events
    GROUP BY agent_id
    ORDER BY cost_week DESC, tokens_week DESC
  `).all(today, today);

  const byModel = db.prepare(`
    SELECT
      COALESCE(model, 'unknown') AS model,
      COALESCE(SUM(total_tokens), 0) AS total_tokens,
      COALESCE(SUM(cost_usd), 0) AS total_cost
    FROM llm_usage_events
    WHERE day >= date('now', '-' || (? - 1) || ' days')
    GROUP BY model
    ORDER BY total_cost DESC, total_tokens DESC
  `).all(days);

  const daily = db.prepare(`
    SELECT
      day,
      COALESCE(SUM(total_tokens), 0) AS total_tokens,
      COALESCE(SUM(cost_usd), 0) AS total_cost
    FROM llm_usage_events
    WHERE day >= date('now', '-' || (? - 1) || ' days')
    GROUP BY day
    ORDER BY day ASC
  `).all(days);

  return NextResponse.json({
    days,
    totals,
    by_agent: byAgent,
    by_model: byModel,
    daily,
  });
}
