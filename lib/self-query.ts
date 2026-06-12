import { openai } from './openai';
import { pool } from './db';
import type { SearchFilters } from './filters';

export interface ParsedQuery {
  semanticQuery: string;
  filters: SearchFilters;
  interpretation: string;
}

// Corpus bounds. Anything outside this window is dropped — a misparse must never
// produce a filter that silently returns nothing.
const CORPUS_START = '1953-01-01';
const CORPUS_END = '1971-12-31';
const CORPUS_START_YEAR = 1953;
const CORPUS_END_YEAR = 1971;

// 'article' is a pseudo-type meaning "exclude quotation-transcription" (see buildSqlWhere).
const VALID_TYPES = new Set(['analysis', 'note', 'quotation-transcription', 'article']);

// Authors with at least this many articles are surfaced to the model as the
// canonical "recurring authors" list; everyone else still validates (below).
const RECURRING_MIN = 4;

interface AuthorData {
  all: Set<string>; // every author in the corpus — an inferred author must be one of these
  recurring: string[]; // recurring voices, seeded into the prompt for canonical spelling
}
let authorCache: Promise<AuthorData> | null = null;

// Load the corpus author set once per server instance. Used to validate an
// inferred author against names that actually exist (so a hallucinated name
// can't zero out the results) and to seed the prompt with the recurring authors.
// Exported so the agent loop can validate its tool arguments against the same set.
export function loadAuthors(): Promise<AuthorData> {
  if (!authorCache) {
    authorCache = (async () => {
      try {
        const { rows } = await pool.query(
          'SELECT author, count(*)::int AS n FROM articles WHERE author IS NOT NULL GROUP BY author'
        );
        const all = new Set<string>(rows.map((r) => r.author));
        const recurring = rows
          .filter((r) => r.n >= RECURRING_MIN)
          .sort((a, b) => b.n - a.n)
          .map((r) => r.author);
        return { all, recurring };
      } catch (err) {
        console.error('self-query: author load failed; author filter off this call:', err);
        authorCache = null; // allow a retry on the next request
        return { all: new Set<string>(), recurring: [] };
      }
    })();
  }
  return authorCache;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function buildSystemPrompt(recurringAuthors: string[]): string {
  const knownAuthors = recurringAuthors.length ? recurringAuthors.join(', ') : 'I.F. Stone';
  return `You convert a user's natural-language question about I.F. Stone's Weekly into a structured search query.

I.F. Stone's Weekly was an investigative newsletter published from 1953 to 1971. The corpus contains only issues from that period.

Produce:
- semanticQuery: the topical/subject part of the question ONLY, with any filter phrases (dates, eras, author, document type) removed. This text is embedded for semantic search, so keep it concise (e.g. "Vietnam war", "nuclear test ban treaty").
- author: set this only when the user asks about a specific writer's own pieces ("what did X write/think/say", "X's own articles", "his/her reporting"). Use the writer's exact name. The recurring authors in the corpus, with canonical spellings, are: ${knownAuthors}. Other authors also exist; if the user clearly names one, use the name as written. I.F. Stone refers to himself as "IFS" (and "I.F. Stone", "Stone", "Izzy") — map any of these to the author "I.F. Stone". For a purely topical question with no named writer, leave author null. Never invent a name the user didn't mention.
- type: "quotation-transcription" when the user explicitly wants reprinted/quoted/transcribed material; "analysis" or "note" only if explicitly named; otherwise null. Do NOT set type when you have also set an author — reproduced material (quotation-transcription) has no byline, so combining the two returns nothing. "what did X say/think/write" means X's own pieces: set author, not type.
- year: a single year as an integer when the question names exactly one; otherwise null.
- dateFrom / dateTo: ISO YYYY-MM-DD bounds when the question implies a time range or era. Use world knowledge to convert era language to dates — especially U.S. presidential terms: Eisenhower (Jan 20 1953 – Jan 20 1961), Kennedy (Jan 20 1961 – Nov 22 1963), Johnson/LBJ (Nov 22 1963 – Jan 20 1969), Nixon (from Jan 20 1969). "before the LBJ administration" → dateTo = 1963-11-21 (the day before he took office). Clamp everything to the 1953–1971 corpus. Prefer year over a full range when only a year is given.
- interpretation: a short human-readable summary of the filters you applied, e.g. "I.F. Stone's own articles before Nov 1963". Empty string when no filters apply.

Rules:
- Only set a field when the question clearly implies it; leave it null when unsure.
- Never invent topic filters — topical meaning belongs in semanticQuery.`;
}

const SELF_QUERY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    semanticQuery: { type: 'string' },
    type: {
      type: ['string', 'null'],
      enum: ['analysis', 'note', 'quotation-transcription', 'article', null],
    },
    author: { type: ['string', 'null'] },
    year: { type: ['integer', 'null'] },
    dateFrom: { type: ['string', 'null'] },
    dateTo: { type: ['string', 'null'] },
    interpretation: { type: 'string' },
  },
  required: [
    'semanticQuery',
    'type',
    'author',
    'year',
    'dateFrom',
    'dateTo',
    'interpretation',
  ],
} as const;

function isValidCorpusDate(d: unknown): d is string {
  if (typeof d !== 'string' || !DATE_RE.test(d)) return false;
  if (Number.isNaN(Date.parse(d))) return false;
  return d >= CORPUS_START && d <= CORPUS_END;
}

// Build a clean SearchFilters from only the fields that survive validation.
// Pure and side-effect free so the guardrails can be unit-tested without the
// LLM, and shared between the self-query parse and the agent's tool arguments
// (which may carry year as a string).
export function sanitizeFilters(raw: any, allowedAuthors: Set<string>): SearchFilters {
  const filters: SearchFilters = {};

  if (typeof raw?.type === 'string' && VALID_TYPES.has(raw.type)) {
    filters.type = raw.type;
  }

  // Keep an inferred author only if it actually exists in the corpus, so a
  // hallucinated name can't produce a filter that silently returns nothing.
  if (typeof raw?.author === 'string' && allowedAuthors.has(raw.author)) {
    filters.author = raw.author;
  }

  const year =
    typeof raw?.year === 'string' && raw.year.trim() ? Number(raw.year) : raw?.year;
  if (
    typeof year === 'number' &&
    Number.isInteger(year) &&
    year >= CORPUS_START_YEAR &&
    year <= CORPUS_END_YEAR
  ) {
    filters.year = String(year);
  }

  let dateFrom = isValidCorpusDate(raw?.dateFrom) ? raw.dateFrom : undefined;
  let dateTo = isValidCorpusDate(raw?.dateTo) ? raw.dateTo : undefined;
  // Contradictory range — drop both rather than guess.
  if (dateFrom && dateTo && dateFrom > dateTo) {
    dateFrom = undefined;
    dateTo = undefined;
  }
  if (dateFrom) filters.dateFrom = dateFrom;
  if (dateTo) filters.dateTo = dateTo;

  return filters;
}

// Assemble the full ParsedQuery around the validated filters.
export function sanitizeParsedQuery(
  raw: any,
  question: string,
  allowedAuthors: Set<string>
): ParsedQuery {
  const filters = sanitizeFilters(raw, allowedAuthors);

  const semanticQuery =
    typeof raw?.semanticQuery === 'string' && raw.semanticQuery.trim()
      ? raw.semanticQuery.trim()
      : question;

  // An interpretation is only meaningful when at least one filter survived;
  // otherwise this behaves exactly like plain hybrid search.
  const interpretation =
    Object.keys(filters).length > 0 && typeof raw?.interpretation === 'string'
      ? raw.interpretation.trim()
      : '';

  return { semanticQuery, filters, interpretation };
}

// Infer filters + a cleaner semantic query from a natural-language question.
// One gpt-4o-mini call with Structured Outputs. Never throws: any failure falls
// back to plain hybrid search (the original question, no filters).
export async function parseQuery(question: string): Promise<ParsedQuery> {
  try {
    const { all, recurring } = await loadAuthors();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      messages: [
        { role: 'system', content: buildSystemPrompt(recurring) },
        { role: 'user', content: question },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'self_query', strict: true, schema: SELF_QUERY_SCHEMA },
      },
    } as any);

    const raw = JSON.parse(completion.choices[0]?.message?.content || '{}');
    return sanitizeParsedQuery(raw, question, all);
  } catch (err) {
    console.error('self-query parse failed; falling back to plain search:', err);
    return { semanticQuery: question, filters: {}, interpretation: '' };
  }
}
