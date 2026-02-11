import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_COOKIE = 'hermes-session';

export function proxy(request: NextRequest) {
  const host = request.headers.get('host') || '';
  const hostName = host.split(':')[0];
  const isLocalhost = hostName === 'localhost' || hostName === '127.0.0.1';
  const isTailscale = hostName.startsWith('100.') || hostName.endsWith('.ts.net');

  if (!isLocalhost && !isTailscale) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const { pathname } = request.nextUrl;

  if (pathname === '/login' || pathname.startsWith('/api/auth/')) {
    return NextResponse.next();
  }

  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;
  const apiKey = request.headers.get('x-api-key');

  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && sessionToken && !(apiKey && apiKey === process.env.API_KEY)) {
    const allowedOrigin = process.env.PUBLIC_BASE_URL
      ? new URL(process.env.PUBLIC_BASE_URL).origin
      : request.nextUrl.origin;
    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');
    const originOk = origin ? origin === allowedOrigin : true;
    const refererOk = referer ? referer.startsWith(allowedOrigin) : true;
    if (!originOk || !refererOk || (!origin && !referer)) {
      return new NextResponse('Forbidden', { status: 403 });
    }
  }

  if (pathname.startsWith('/api/')) {
    if (sessionToken || (apiKey && apiKey === process.env.API_KEY)) {
      return NextResponse.next();
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (sessionToken) {
    return NextResponse.next();
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = '/login';
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
