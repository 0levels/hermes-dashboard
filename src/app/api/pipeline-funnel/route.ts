import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireApiUser } from '@/lib/api-auth';

const STAGE_ORDER = ['new', 'enriched', 'scored', 'sequenced', 'contacted', 'replied', 'interested', 'booked'];
const STAGE_COLORS: Record<string, string> = {
  new: '#6366f1',
  enriched: '#8b5cf6',
  scored: '#a78bfa',
  sequenced: '#f59e0b',
  contacted: '#f97316',
  replied: '#22c55e',
  interested: '#10b981',
  booked: '#059669',
};

const STAGE_LABELS: Record<string, string> = {
  new: 'New',
  enriched: 'Enriched',
  scored: 'Scored',
  sequenced: 'Sequenced',
  contacted: 'Contacted',
  replied: 'Replied',
  interested: 'Interested',
  booked: 'Booked',
};

export async function GET(request: NextRequest) {
  const auth = requireApiUser(request as Request);
  if (auth) return auth;
  const db = getDb();
  const real = request.nextUrl.searchParams.get('real') === 'true';

  const seedFilter = real
    ? " AND NOT EXISTS (SELECT 1 FROM seed_registry sr WHERE sr.table_name = 'leads' AND sr.record_id = leads.id)"
    : '';

  const rows = db.prepare(`
    SELECT status, COUNT(*) as count FROM leads WHERE 1=1${seedFilter} GROUP BY status
  `).all() as Array<{ status: string; count: number }>;

  const countMap: Record<string, number> = {};
  for (const row of rows) {
    countMap[row.status] = row.count;
  }

  const stages = STAGE_ORDER.map(status => ({
    label: STAGE_LABELS[status] || status,
    count: countMap[status] || 0,
    color: STAGE_COLORS[status] || '#6b7280',
  }));

  // Only include stages that have at least 1 lead or are key stages
  const keyStages = new Set(['new', 'sequenced', 'replied', 'interested', 'booked']);
  const filteredStages = stages.filter(s => s.count > 0 || keyStages.has(STAGE_ORDER[stages.indexOf(s)]));

  return NextResponse.json({ stages: filteredStages });
}

export const dynamic = 'force-dynamic';
