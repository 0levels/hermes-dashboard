import { NextResponse } from 'next/server';
import { getUserFromRequest, seedAdmin } from '@/lib/auth';

export async function GET(request: Request) {
  seedAdmin();
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  return NextResponse.json({ user: { id: user.id, username: user.username, role: user.role } });
}
