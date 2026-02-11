import { NextResponse } from 'next/server';

const heliusUrl = process.env.NEXT_PUBLIC_HELIUS_URL;

async function rpc(method: string, params: any[] = []) {
  if (!heliusUrl) return null;
  const res = await fetch(heliusUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    next: { revalidate: 30 },
  });
  return res.json();
}

export async function GET() {
  if (!heliusUrl) {
    return NextResponse.json({ enabled: false, error: 'Missing Helius URL' });
  }

  try {
    const [health, slot] = await Promise.all([
      rpc('getHealth'),
      rpc('getSlot'),
    ]);

    return NextResponse.json({
      enabled: true,
      ok: (health?.result === 'ok'),
      health: health?.result ?? null,
      slot: slot?.result ?? null,
      checked_at: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ enabled: true, ok: false, error: String(error) });
  }
}
