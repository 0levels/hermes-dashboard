import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/auth';

export async function POST(request: Request) {
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.match(/(?:^|;\s*)hermes-session=([^;]*)/);
  const token = match ? decodeURIComponent(match[1]) : null;

  if (token) destroySession(token);

  const response = NextResponse.json({ ok: true });
  response.cookies.set('hermes-session', '', { maxAge: 0, path: '/' });
  return response;
}
