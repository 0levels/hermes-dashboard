import { NextResponse } from 'next/server';
import { getUserFromRequest, seedAdmin } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    seedAdmin();
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Auth configuration error' },
      { status: 500 },
    );
  }
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const response = NextResponse.json({ user: { id: user.id, username: user.username, role: user.role } });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
