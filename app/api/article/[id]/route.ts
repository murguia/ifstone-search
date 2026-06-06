import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';

// On-demand full article lookup, so the chat response can ship lightweight
// snippets and the reader fetches the complete text only when opened.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return Response.json({ error: 'id is required' }, { status: 400 });
  }

  const { rows } = await pool.query(
    `SELECT article_id AS id, title, to_char(date, 'YYYY-MM-DD') AS date,
            year::text AS year, author, type, full_text, file_id, pages
     FROM articles WHERE article_id = $1`,
    [id]
  );

  if (rows.length === 0) {
    return Response.json({ error: 'not found' }, { status: 404 });
  }

  return Response.json(rows[0]);
}
