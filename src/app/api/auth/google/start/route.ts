import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const STATE_COOKIE = 'hermes-google-state';

function requireGoogleEnv() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (!clientId || !redirectUri) {
    throw new Error('Google SSO is not configured');
  }
  return { clientId, redirectUri };
}

export async function GET(request: Request) {
  try {
    const { clientId, redirectUri } = requireGoogleEnv();
    const state = randomBytes(24).toString('hex');
    const from = new URL(request.url).searchParams.get('from') || '/';

    const authUrl = new URL(GOOGLE_AUTH_URL);
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'openid email profile');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('prompt', 'select_account');
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('include_granted_scopes', 'true');

    const response = NextResponse.redirect(authUrl);
    response.cookies.set(STATE_COOKIE, `${state}:${encodeURIComponent(from)}`, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 10 * 60,
      path: '/',
    });
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Google SSO error' },
      { status: 503 },
    );
  }
}

