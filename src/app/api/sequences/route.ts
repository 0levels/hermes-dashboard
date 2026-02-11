import { NextRequest, NextResponse } from 'next/server';
import { getSequences, updateSequenceStatus } from '@/lib/queries';
import { writebackSequenceStatus } from '@/lib/writeback';
import { requireApiEditor, requireApiUser } from '@/lib/api-auth';
import { requireUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest) {
  const auth = requireApiUser(req as Request);
  if (auth) return auth;
  const { searchParams } = req.nextUrl;
  const real = searchParams.get('real') === 'true';
  const sequences = getSequences({
    status: searchParams.get('status') || undefined,
    lead_id: searchParams.get('lead_id') || undefined,
    excludeSeed: real,
  });
  return NextResponse.json(sequences);
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
  updateSequenceStatus(id, status);
  writebackSequenceStatus(id, status);
  logAudit({
    actor,
    action: 'sequence.update_status',
    target: `sequence:${id}`,
    detail: { status },
  });
  return NextResponse.json({ ok: true });
}
