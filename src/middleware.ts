import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow static assets and Next.js internals
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon') || pathname.match(/\.\w+$/)) {
    return NextResponse.next();
  }

  const token = request.cookies.get('hermes-session')?.value;

  // API routes: also accept x-api-key header
  if (pathname.startsWith('/api/')) {
    const apiKey = request.headers.get('x-api-key');
    if (apiKey && apiKey === process.env.API_KEY) {
      return NextResponse.next();
    }
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    // Token validation happens in the route handler (middleware can't access SQLite)
    return NextResponse.next();
  }

  // Page routes: redirect to login
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
