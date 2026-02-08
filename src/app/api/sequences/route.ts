import { NextRequest, NextResponse } from 'next/server';
import { getSequences, updateSequenceStatus } from '@/lib/queries';
import { writebackSequenceStatus } from '@/lib/writeback';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const sequences = getSequences({
    status: searchParams.get('status') || undefined,
    lead_id: searchParams.get('lead_id') || undefined,
  });
  return NextResponse.json(sequences);
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, status } = body;
  if (!id || !status) {
    return NextResponse.json({ error: 'id and status required' }, { status: 400 });
  }
  updateSequenceStatus(id, status);
  writebackSequenceStatus(id, status);
  return NextResponse.json({ ok: true });
}
