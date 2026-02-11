import { NextResponse } from 'next/server';

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION || '2022-11-15';
const token = process.env.SANITY_API_TOKEN;

const TYPES = ['post', 'article', 'blogPost', 'blog', 'content', 'page'];

function buildUrl() {
  if (!projectId || !dataset) return null;
  const query = `*[_type in ${JSON.stringify(TYPES)}] | order(_updatedAt desc)[0...5]{_id,_type,title,slug,updatedAt:_updatedAt,publishedAt}`;
  const encoded = encodeURIComponent(query);
  return `https://${projectId}.api.sanity.io/v${apiVersion}/data/query/${dataset}?query=${encoded}`;
}

export async function GET() {
  if (!projectId || !dataset) {
    return NextResponse.json({ enabled: false, error: 'Missing Sanity configuration' });
  }

  const url = buildUrl();
  if (!url) return NextResponse.json({ enabled: false, error: 'Invalid Sanity configuration' });

  try {
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      next: { revalidate: 60 },
    });
    if (!res.ok) {
      return NextResponse.json({ enabled: true, ok: false, error: `Sanity HTTP ${res.status}` });
    }
    const json = await res.json() as { result?: any[] };
    const items = (json.result || []).map((item) => ({
      id: item._id,
      type: item._type,
      title: item.title || '(untitled)',
      slug: item.slug?.current || null,
      updatedAt: item.updatedAt || null,
      publishedAt: item.publishedAt || null,
    }));
    return NextResponse.json({ enabled: true, ok: true, count: items.length, items });
  } catch (error) {
    return NextResponse.json({ enabled: true, ok: false, error: String(error) });
  }
}
