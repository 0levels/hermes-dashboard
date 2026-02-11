import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireApiUser } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  const auth = requireApiUser(request as Request);
  if (auth) return auth;
  const db = getDb();
  const real = request.nextUrl.searchParams.get('real') === 'true';

  const seedFilter = real
    ? " AND NOT EXISTS (SELECT 1 FROM seed_registry sr WHERE sr.table_name = 'content_posts' AND sr.record_id = content_posts.id)"
    : '';

  const items = db.prepare(`
    SELECT id, platform, format, pillar, text_preview, status, scheduled_for
    FROM content_posts
    WHERE status IN ('draft', 'ready', 'scheduled', 'needs_review')${seedFilter}
    ORDER BY
      CASE status
        WHEN 'scheduled' THEN 1
        WHEN 'ready' THEN 2
        WHEN 'needs_review' THEN 3
        WHEN 'draft' THEN 4
      END,
      scheduled_for ASC,
      created_at DESC
    LIMIT 20
  `).all();

  return NextResponse.json({ items });
}

export const dynamic = 'force-dynamic';
