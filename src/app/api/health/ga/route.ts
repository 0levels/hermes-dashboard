import { NextResponse } from 'next/server';

export async function GET() {
  const id = process.env.NEXT_PUBLIC_GA_ID || process.env.GA_MEASUREMENT_ID || null;
  return NextResponse.json({ id, enabled: !!id, checked_at: new Date().toISOString() });
}
