import { NextRequest, NextResponse } from 'next/server';
import { getLeads, getSequences, getLeadFunnel, getSuppression } from '@/lib/queries';
import { requireApiUser } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  const auth = requireApiUser(req as Request);
  if (auth) return auth;
  const { searchParams } = req.nextUrl;
  const view = searchParams.get('view');
  const real = searchParams.get('real') === 'true';

  if (view === 'funnel') {
    return NextResponse.json(getLeadFunnel({ excludeSeed: real }));
  }
  if (view === 'suppression') {
    return NextResponse.json(getSuppression({ excludeSeed: real }));
  }
  if (view === 'sequences') {
    return NextResponse.json(getSequences({
      status: searchParams.get('status') || undefined,
      lead_id: searchParams.get('lead_id') || undefined,
      excludeSeed: real,
    }));
  }

  // Default: leads + sequences overview
  const leads = getLeads({
    status: searchParams.get('status') || undefined,
    tier: searchParams.get('tier') || undefined,
    excludeSeed: real,
  });
  const funnel = getLeadFunnel({ excludeSeed: real });
  const pendingApprovals = getSequences({ status: 'pending_approval', excludeSeed: real });

  return NextResponse.json({ leads, funnel, pendingApprovals });
}
