import { NextResponse } from 'next/server';

const apiKey = process.env.NEXT_PUBLIC_MAILCHIMP_API_KEY;

function getDataCenter(key?: string) {
  if (!key) return null;
  const parts = key.split('-');
  return parts.length > 1 ? parts[1] : null;
}

export async function GET() {
  if (!apiKey) {
    return NextResponse.json({ enabled: false, error: 'Missing Mailchimp API key' });
  }

  const dc = getDataCenter(apiKey);
  if (!dc) {
    return NextResponse.json({ enabled: true, ok: false, error: 'Invalid Mailchimp API key format' });
  }

  try {
    const res = await fetch(`https://${dc}.api.mailchimp.com/3.0/lists?count=5`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`anystring:${apiKey}`).toString('base64')}`,
      },
      next: { revalidate: 60 },
    });
    if (!res.ok) {
      return NextResponse.json({ enabled: true, ok: false, error: `Mailchimp HTTP ${res.status}` });
    }

    const json = await res.json() as { lists?: any[]; total_items?: number };
    const lists = (json.lists || []).map((list) => ({
      id: list.id,
      name: list.name,
      members: list.stats?.member_count ?? 0,
      unsubscribed: list.stats?.unsubscribe_count ?? 0,
      cleaned: list.stats?.cleaned_count ?? 0,
    }));

    const totals = lists.reduce((acc, l) => {
      acc.members += l.members;
      acc.unsubscribed += l.unsubscribed;
      acc.cleaned += l.cleaned;
      return acc;
    }, { members: 0, unsubscribed: 0, cleaned: 0 });

    return NextResponse.json({ enabled: true, ok: true, count: lists.length, totals, lists });
  } catch (error) {
    return NextResponse.json({ enabled: true, ok: false, error: String(error) });
  }
}
