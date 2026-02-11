import { NextRequest, NextResponse } from 'next/server';
import { getSuppression } from '@/lib/queries';
import { requireApiUser } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  const auth = requireApiUser(req as Request);
  if (auth) return auth;
  const real = req.nextUrl.searchParams.get('real') === 'true';
  return NextResponse.json(getSuppression({ excludeSeed: real }));
}
