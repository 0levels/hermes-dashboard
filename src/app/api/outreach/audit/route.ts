import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();
    const rows = db.prepare(
      `SELECT id, ts, action, detail, result
       FROM activity_log
       WHERE action IN ('outreach_paused', 'outreach_resumed')
       ORDER BY ts DESC
       LIMIT 50`
    ).all();

    return NextResponse.json({ history: rows });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
