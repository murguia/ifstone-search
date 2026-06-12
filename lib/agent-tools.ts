import OpenAI from 'openai';
import { createEmbedding } from './openai';
import { searchArticles, type Match } from './search';
import { pool } from './db';
import { sanitizeFilters } from './self-query';
import type { SearchFilters } from './filters';

// Caps on what a single tool call feeds back into the agent's context.
const SEARCH_EXCERPT_LEN = 1500;
const READ_TEXT_LEN = 8000;

// Tool schemas exposed to the model for the agentic research loop.
export const toolDefinitions: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'search_articles',
      description:
        "Hybrid (semantic + lexical) search over I.F. Stone's Weekly, an investigative " +
        'newsletter published 1953-1971. Returns the most relevant articles, each with its ' +
        'article_id, title, date, author, type, and an excerpt. Issue several scoped searches ' +
        '(different queries and/or filters) when a question spans multiple topics or time ' +
        'periods, and re-search with different phrasing or broader filters when results are thin.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description:
              'A focused natural-language query describing what to find. Topical content ' +
              'only — express dates, authors, and document types as filters instead.',
          },
          filters: {
            type: 'object',
            description: 'Optional constraints applied to this search.',
            properties: {
              year: {
                type: 'integer',
                description: 'Restrict to a single publication year (1953-1971).',
              },
              dateFrom: {
                type: 'string',
                description: 'Earliest publication date, YYYY-MM-DD (corpus starts 1953-01-01).',
              },
              dateTo: {
                type: 'string',
                description: 'Latest publication date, YYYY-MM-DD (corpus ends 1971-12-31).',
              },
              author: {
                type: 'string',
                description:
                  'Exact author name, e.g. "I.F. Stone". Only for questions about a ' +
                  "specific writer's own pieces.",
              },
              type: {
                type: 'string',
                enum: ['analysis', 'note', 'quotation-transcription', 'article'],
                description:
                  '"quotation-transcription" is reproduced material (speeches, documents); ' +
                  '"article" means any non-reproduced piece. Never combine an author with ' +
                  'type "quotation-transcription" — reproduced material has no byline.',
              },
            },
          },
          top_k: {
            type: 'integer',
            description: 'Number of articles to return (1-10). Default 5.',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_article',
      description:
        'Fetch the full text and metadata of one article by its article_id (returned by ' +
        'search_articles). Use this to drill into an article whose excerpt looks relevant ' +
        'but is not enough on its own.',
      parameters: {
        type: 'object',
        properties: {
          article_id: {
            type: 'string',
            description: 'The article_id to read.',
          },
        },
        required: ['article_id'],
      },
    },
  },
];

export interface ToolProgress {
  action: 'search' | 'read';
  detail: string; // the search query, or the title of the article being read
  filters?: SearchFilters;
}

export interface ToolContext {
  uiFilters: SearchFilters;
  allowedAuthors: Set<string>;
  onProgress: (progress: ToolProgress) => void;
}

export function clampTopK(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 5;
  return Math.min(Math.max(Math.trunc(n), 1), 10);
}

// Sanitize the agent's filters with the same guardrails as self-query, then
// overlay the request's explicit UI filters so they constrain every tool call.
export function buildToolFilters(
  raw: unknown,
  uiFilters: SearchFilters,
  allowedAuthors: Set<string>
): SearchFilters {
  return { ...sanitizeFilters(raw, allowedAuthors), ...uiFilters };
}

// Render matches into a compact, model-readable block. article_id is included
// so the agent can follow up with read_article to drill into an article.
function formatMatches(matches: Match[]): string {
  if (matches.length === 0) {
    return 'No matching articles found. Try different phrasing or broader filters.';
  }
  return matches
    .map((m, i) => {
      const md = m.metadata;
      const fullText: string = md.full_text || '';
      const excerpt =
        fullText.length > SEARCH_EXCERPT_LEN
          ? fullText.slice(0, SEARCH_EXCERPT_LEN) + '…'
          : fullText;
      const header = [
        `article_id=${md.article_id}`,
        `date=${md.date}`,
        md.author && `author=${md.author}`,
        `type=${md.type}`,
      ]
        .filter(Boolean)
        .join(' | ');
      return `[Result ${i + 1}] ${header}\ntitle: ${md.title}\n${excerpt}`;
    })
    .join('\n\n---\n\n');
}

// Executes a tool call and returns both a model-facing string and the raw
// matches, which the agent loop accumulates into the answer context/sources.
export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<{ content: string; matches: Match[] }> {
  switch (name) {
    case 'search_articles': {
      const query = String(args.query ?? '').trim();
      if (!query) return { content: 'Error: query is required.', matches: [] };
      const filters = buildToolFilters(args.filters, ctx.uiFilters, ctx.allowedAuthors);
      ctx.onProgress({
        action: 'search',
        detail: query,
        ...(Object.keys(filters).length ? { filters } : {}),
      });
      const embedding = await createEmbedding(query);
      const matches = await searchArticles(query, embedding, clampTopK(args.top_k), filters);
      return { content: formatMatches(matches), matches };
    }
    case 'read_article': {
      const articleId = String(args.article_id ?? '').trim();
      if (!articleId) return { content: 'Error: article_id is required.', matches: [] };
      const { rows } = await pool.query(
        `SELECT article_id, title, to_char(date, 'YYYY-MM-DD') AS date,
                year::text AS year, author, type, full_text, file_id, index_topics, pages
         FROM articles WHERE article_id = $1`,
        [articleId]
      );
      if (rows.length === 0) {
        return { content: `No article found with article_id "${articleId}".`, matches: [] };
      }
      const md = rows[0];
      ctx.onProgress({ action: 'read', detail: md.title || articleId });
      const fullText: string = md.full_text || '';
      const text =
        fullText.length > READ_TEXT_LEN
          ? fullText.slice(0, READ_TEXT_LEN) + '… [truncated]'
          : fullText;
      const header = [md.title, md.date, md.author].filter(Boolean).join(' | ');
      // score 0: if this article also surfaced in a search, dedupe keeps the
      // search score; an article only read still reaches the sources, ranked last.
      return { content: `${header}\n\n${text}`, matches: [{ metadata: md, score: 0 }] };
    }
    default:
      return { content: `Unknown tool: ${name}`, matches: [] };
  }
}
