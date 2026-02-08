import { NextResponse } from 'next/server';
import { authenticate, createSession, seedAdmin } from '@/lib/auth';

export async function POST(request: Request) {
  seedAdmin();

  const { username, password } = await request.json();
  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
  }

  const user = authenticate(username, password);
  if (!user) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const token = createSession(user.id);
  const response = NextResponse.json({ user: { id: user.id, username: user.username, role: user.role } });

  response.cookies.set('hermes-session', token, {
    httpOnly: true,
    secure: false,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  });

  return response;
}
