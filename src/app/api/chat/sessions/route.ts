import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireApiUser } from '@/lib/api-auth';

/**
 * GET /api/chat/sessions
 * Returns a list of synced agent sessions with message counts and previews.
 */
export async function GET(request: Request) {
  const auth = requireApiUser(request as Request);
  if (auth) return auth;
  const db = getDb();

  const rows = db.prepare(`
    SELECT
      conversation_id,
      COUNT(*) as message_count,
      MAX(created_at) as last_message_at,
      MIN(created_at) as first_message_at
    FROM messages
    WHERE conversation_id LIKE 'session:%'
    GROUP BY conversation_id
    ORDER BY last_message_at DESC
  `).all() as Array<{
    conversation_id: string;
    message_count: number;
    last_message_at: number;
    first_message_at: number;
  }>;

  const sessions = rows.map(row => {
    // Parse conversation_id: "session:{agentId}:{sessionId}"
    const parts = row.conversation_id.split(':');
    const agentId = parts[1] || 'unknown';
    const sessionId = parts[2] || '';

    // Get first user message as preview
    const firstMsg = db.prepare(
      "SELECT content FROM messages WHERE conversation_id = ? AND from_agent = 'operator' ORDER BY created_at ASC LIMIT 1"
    ).get(row.conversation_id) as { content: string } | undefined;

    const preview = firstMsg?.content
      ? firstMsg.content.slice(0, 100) + (firstMsg.content.length > 100 ? '...' : '')
      : undefined;

    return {
      agent_id: agentId,
      session_id: sessionId,
      conversation_id: row.conversation_id,
      message_count: row.message_count,
      last_message_at: row.last_message_at,
      first_message_at: row.first_message_at,
      preview,
    };
  });

  return NextResponse.json({ sessions });
}

export const dynamic = 'force-dynamic';
