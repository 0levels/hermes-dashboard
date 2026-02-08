import { NextRequest, NextResponse } from 'next/server';
import { getLeads, updateLeadStatus, getLeadFunnel } from '@/lib/queries';
import { writebackLeadStatus } from '@/lib/writeback';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  if (searchParams.get('funnel') === 'true') {
    return NextResponse.json(getLeadFunnel());
  }

  const leads = getLeads({
    status: searchParams.get('status') || undefined,
    tier: searchParams.get('tier') || undefined,
    segment: searchParams.get('segment') || undefined,
    sort: searchParams.get('sort') || undefined,
    order: (searchParams.get('order') as 'asc' | 'desc') || undefined,
  });
  return NextResponse.json(leads);
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, status } = body;
  if (!id || !status) {
    return NextResponse.json({ error: 'id and status required' }, { status: 400 });
  }
  updateLeadStatus(id, status);
  writebackLeadStatus(id, status);
  return NextResponse.json({ ok: true });
}
