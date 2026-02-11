import { NextResponse } from 'next/server';
import fs from 'fs';
import { requireApiUser } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

const HEALTH_JSON = '/home/leads/.openclaw/health/memory-health.json';

export async function GET(request: Request) {
  const auth = requireApiUser(request as Request);
  if (auth) return auth;
  try {
    if (!fs.existsSync(HEALTH_JSON)) {
      return NextResponse.json({ error: 'Memory health report not found' }, { status: 404 });
    }
    const raw = fs.readFileSync(HEALTH_JSON, 'utf-8');
    const data = JSON.parse(raw);
    return NextResponse.json(data);
  } catch (error) {
    console.error('GET /api/memory-health error:', error);
    return NextResponse.json({ error: 'Failed to read memory health report' }, { status: 500 });
  }
}

