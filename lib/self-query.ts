import { openai } from './openai';
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

// Allowlist: only authors known to exist in the corpus survive validation, so a
// hallucinated name can't zero out the results.
const KNOWN_AUTHORS = new Set(['I.F. Stone']);
// 'article' is a pseudo-type meaning "exclude quotation-transcription" (see buildSqlWhere).
const VALID_TYPES = new Set(['analysis', 'note', 'quotation-transcription', 'article']);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const SYSTEM_PROMPT = `You convert a user's natural-language question about I.F. Stone's Weekly into a structured search query.

I.F. Stone's Weekly was an investigative newsletter published from 1953 to 1971. The corpus contains only issues from that period.

Produce:
- semanticQuery: the topical/subject part of the question ONLY, with any filter phrases (dates, eras, author, document type) removed. This text is embedded for semantic search, so keep it concise (e.g. "Vietnam war", "nuclear test ban treaty").
- author: set to "I.F. Stone" when the user refers to Stone himself as the writer — "what did Stone think/write/say", "Stone's own articles", "his reporting/view". This is the right filter for "what did Stone think" questions. For a purely topical question that does not mention Stone as author, leave it null. Never name any other author.
- type: "quotation-transcription" when the user explicitly wants reprinted/quoted/transcribed material; "analysis" or "note" only if explicitly named; otherwise null. NOTE: quotation-transcriptions have no author, so an author:"I.F. Stone" filter already excludes them — do NOT also set type when you have set author:"I.F. Stone".
- year: a single year as an integer when the question names exactly one; otherwise null.
- dateFrom / dateTo: ISO YYYY-MM-DD bounds when the question implies a time range or era. Use world knowledge to convert era language to dates — especially U.S. presidential terms: Eisenhower (Jan 20 1953 – Jan 20 1961), Kennedy (Jan 20 1961 – Nov 22 1963), Johnson/LBJ (Nov 22 1963 – Jan 20 1969), Nixon (from Jan 20 1969). "before the LBJ administration" → dateTo = 1963-11-21 (the day before he took office). Clamp everything to the 1953–1971 corpus. Prefer year over a full range when only a year is given.
- interpretation: a short human-readable summary of the filters you applied, e.g. "I.F. Stone's own articles before Nov 1963". Empty string when no filters apply.

Rules:
- Only set a field when the question clearly implies it; leave it null when unsure.
- Never invent topic filters — topical meaning belongs in semanticQuery.
- Do not set author to anyone other than I.F. Stone.`;

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
// Pure and side-effect free so the guardrails can be unit-tested without the LLM.
export function sanitizeParsedQuery(raw: any, question: string): ParsedQuery {
  const filters: SearchFilters = {};

  if (typeof raw?.type === 'string' && VALID_TYPES.has(raw.type)) {
    filters.type = raw.type;
  }

  if (typeof raw?.author === 'string' && KNOWN_AUTHORS.has(raw.author)) {
    filters.author = raw.author;
  }

  if (
    typeof raw?.year === 'number' &&
    Number.isInteger(raw.year) &&
    raw.year >= CORPUS_START_YEAR &&
    raw.year <= CORPUS_END_YEAR
  ) {
    filters.year = String(raw.year);
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
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: question },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'self_query', strict: true, schema: SELF_QUERY_SCHEMA },
      },
    } as any);

    const raw = JSON.parse(completion.choices[0]?.message?.content || '{}');
    return sanitizeParsedQuery(raw, question);
  } catch (err) {
    console.error('self-query parse failed; falling back to plain search:', err);
    return { semanticQuery: question, filters: {}, interpretation: '' };
  }
}
