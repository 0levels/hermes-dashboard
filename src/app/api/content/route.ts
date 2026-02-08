import { NextRequest, NextResponse } from 'next/server';
import { getContentPosts, updateContentStatus } from '@/lib/queries';
import { writebackContentStatus } from '@/lib/writeback';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const posts = getContentPosts({
    status: searchParams.get('status') || undefined,
    platform: searchParams.get('platform') || undefined,
    pillar: searchParams.get('pillar') ? Number(searchParams.get('pillar')) : undefined,
  });
  return NextResponse.json(posts);
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, status } = body;
  if (!id || !status) {
    return NextResponse.json({ error: 'id and status required' }, { status: 400 });
  }
  updateContentStatus(id, status);
  writebackContentStatus(id, status);
  return NextResponse.json({ ok: true });
}
