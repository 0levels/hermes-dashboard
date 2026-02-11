import { NextResponse } from 'next/server';
import fs from 'fs';
import { requireApiUser } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

const DRIFT_JSON = '/home/leads/.openclaw/health/memory-drift-weekly.json';

export async function GET(request: Request) {
  const auth = requireApiUser(request);
  if (auth) return auth;
  try {
    if (!fs.existsSync(DRIFT_JSON)) {
      return NextResponse.json({ error: 'Memory drift report not found' }, { status: 404 });
    }
    const raw = fs.readFileSync(DRIFT_JSON, 'utf-8');
    const data = JSON.parse(raw);
    return NextResponse.json(data);
  } catch (error) {
    console.error('GET /api/memory-drift error:', error);
    return NextResponse.json({ error: 'Failed to read memory drift report' }, { status: 500 });
  }
}
