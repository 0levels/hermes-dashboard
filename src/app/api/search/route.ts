import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { isRealMode } from '@/lib/seed-filter';
import { requireApiUser } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  const auth = requireApiUser(req as Request);
  if (auth) return auth;
  const q = req.nextUrl.searchParams.get('q')?.trim();
  if (!q || q.length < 2) return NextResponse.json({ results: [] });

  const db = getDb();
  const like = `%${q}%`;
  const excludeSeed = isRealMode(req);

  const sf = (table: string, idCol: string = 'id') => excludeSeed
    ? ` AND NOT EXISTS (SELECT 1 FROM seed_registry sr WHERE sr.table_name = '${table}' AND sr.record_id = CAST(${idCol} AS TEXT))`
    : '';

  // Search across multiple tables, return unified results
  const leads = db.prepare(`
    SELECT id, first_name || ' ' || last_name AS title, company AS subtitle,
           'lead' AS category, status, tier
    FROM leads
    WHERE (first_name || ' ' || last_name LIKE ? OR company LIKE ? OR email LIKE ?)${sf('leads')}
    LIMIT 5
  `).all(like, like, like);

  const content = db.prepare(`
    SELECT id, text_preview AS title, platform || ' · ' || format AS subtitle,
           'content' AS category, status
    FROM content_posts
    WHERE text_preview LIKE ?${sf('content_posts')}
    LIMIT 5
  `).all(like);

  const signals = db.prepare(`
    SELECT id, summary AS title, username AS subtitle,
           'signal' AS category, type AS status, relevance AS tier
    FROM signals
    WHERE (summary LIKE ? OR username LIKE ?)${sf('signals')}
    LIMIT 5
  `).all(like, like);

  const experiments = db.prepare(`
    SELECT id, hypothesis AS title, 'Week ' || week AS subtitle,
           'experiment' AS category, status
    FROM experiments
    WHERE (hypothesis LIKE ? OR action LIKE ?)${sf('experiments')}
    LIMIT 3
  `).all(like, like);

  const activity = db.prepare(`
    SELECT id, detail AS title, action AS subtitle,
           'activity' AS category, action AS status
    FROM activity_log
    WHERE (detail LIKE ? OR result LIKE ?)${sf('activity_log')}
    ORDER BY ts DESC
    LIMIT 3
  `).all(like, like);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results = [...leads, ...content, ...signals, ...experiments, ...activity] as any[];
  return NextResponse.json({ results });
}
