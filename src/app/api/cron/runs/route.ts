import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

const RUNS_DIR = '/home/leads/.openclaw/cron/runs';

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }
    const file = path.join(RUNS_DIR, `${id}.jsonl`);
    if (!fs.existsSync(file)) {
      return NextResponse.json({ runs: [] });
    }
    const lines = fs.readFileSync(file, 'utf-8').split('\n').filter(Boolean);
    const runs = lines.slice(-10).map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);

    return NextResponse.json({ runs });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
