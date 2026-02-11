import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { maybeSeedExclude } from '@/lib/seed-filter';
import { requireApiUser } from '@/lib/api-auth';

// Lightweight endpoint — returns pending counts for nav badges
// Polled by nav-rail every 30s
export async function GET(req: NextRequest) {
  const auth = requireApiUser(req as Request);
  if (auth) return auth;
  try {
    const db = getDb();
    const sf = (table: string) => maybeSeedExclude(req, table);

    const content = (db.prepare(
      `SELECT COUNT(*) as c FROM content_posts WHERE status = 'pending_approval'${sf('content_posts')}`
    ).get() as { c: number })?.c ?? 0;

    const outreach = (db.prepare(
      `SELECT COUNT(*) as c FROM sequences WHERE status = 'pending_approval'${sf('sequences')}`
    ).get() as { c: number })?.c ?? 0;

    const signals_today = (db.prepare(
      `SELECT COUNT(*) as c FROM signals WHERE date = date('now')${sf('signals')}`
    ).get() as { c: number })?.c ?? 0;

    const unread_notifications = (db.prepare(
      `SELECT COUNT(*) as c FROM notifications WHERE read = 0${sf('notifications')}`
    ).get() as { c: number })?.c ?? 0;

    const new_leads = (db.prepare(
      `SELECT COUNT(*) as c FROM leads WHERE status = 'new'${sf('leads')}`
    ).get() as { c: number })?.c ?? 0;

    return NextResponse.json({
      content,
      outreach,
      signals_today,
      unread_notifications,
      new_leads,
      // Combined for automations page badge
      total_pending: content + outreach,
    });
  } catch {
    return NextResponse.json({
      content: 0, outreach: 0, signals_today: 0,
      unread_notifications: 0, new_leads: 0, total_pending: 0,
    });
  }
}
