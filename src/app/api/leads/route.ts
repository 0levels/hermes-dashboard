import { NextRequest, NextResponse } from 'next/server';
import { getLeads, updateLeadStatus, getLeadFunnel } from '@/lib/queries';
import { writebackLeadStatus } from '@/lib/writeback';
import { requireApiEditor, requireApiUser } from '@/lib/api-auth';
import { requireUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest) {
  const auth = requireApiUser(req as Request);
  if (auth) return auth;
  const { searchParams } = req.nextUrl;
  const real = searchParams.get('real') === 'true';

  if (searchParams.get('funnel') === 'true') {
    return NextResponse.json(getLeadFunnel({ excludeSeed: real }));
  }

  const leads = getLeads({
    status: searchParams.get('status') || undefined,
    tier: searchParams.get('tier') || undefined,
    segment: searchParams.get('segment') || undefined,
    sort: searchParams.get('sort') || undefined,
    order: (searchParams.get('order') as 'asc' | 'desc') || undefined,
    excludeSeed: real,
  });
  return NextResponse.json(leads);
}

export async function PATCH(req: NextRequest) {
  const auth = requireApiEditor(req as Request);
  if (auth) return auth;
  const actor = requireUser(req as Request);
  const body = await req.json();
  const { id, status } = body;
  if (!id || !status) {
    return NextResponse.json({ error: 'id and status required' }, { status: 400 });
  }
  updateLeadStatus(id, status);
  writebackLeadStatus(id, status);
  logAudit({
    actor,
    action: 'lead.update_status',
    target: `lead:${id}`,
    detail: { status },
  });
  return NextResponse.json({ ok: true });
}
