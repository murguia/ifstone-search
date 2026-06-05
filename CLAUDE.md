# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. 

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Git Discipline

**Never commit or push without explicit permission.**

- Always ask before running `git commit` or `git push`
- Don't assume the user wants changes committed just because a task is complete
- Wait for the user to say "commit", "push", or similar before doing so

## 5. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

## Development Commands

- `npm run dev` - Start development server (http://localhost:3000)
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint linter

Always run `npm run build` to validate changes (includes type checking and linting).

## Architecture Overview

This is a RAG (Retrieval-Augmented Generation) search interface for I.F. Stone's Weekly (1953-1971). Data ingestion (PDF conversion, review, Postgres build) is handled by a separate private repo: [pdf-newsletter-converter](https://github.com/murguia/pdf-newsletter-converter), which **owns the database the app queries**. The full backend↔frontend data contract (schema, value semantics, invariants, change policy) lives there as `docs/data-contract.md`; the stub below is the self-sufficient consumer view.

### Core Architecture
1. **Query Embedding**: User questions are embedded via OpenAI `text-embedding-3-small`
2. **Hybrid Search**: Postgres + pgvector — semantic (two-level: best distance across an article's article-level and section vectors) fused with lexical full-text search via Reciprocal Rank Fusion (`lib/search.ts`)
3. **Response Generation**: GPT-4o-mini generates answers grounded in matched article chunks
4. **Streaming**: Answers stream to the client; sources appear after streaming completes

Note: `index_topics` from Stone's annual index is available on each article but ranking does not currently use it. Index-topic boosting is deferred to phase 2.

### Key Components

#### API Route (`app/api/chat/route.ts`)
- Handles chat requests with streaming responses
- Builds LLM context from `full_text` metadata with title/date/author headers
- Returns sources with title, date, author, type, and PDF link

#### Search (`lib/search.ts`, `lib/db.ts`, `lib/filters.ts`)
- `searchArticles(queryText, embedding, topK, filters)` — hybrid (semantic + lexical) search over Postgres, RRF-fused; returns `{ metadata, score }[]`
- `buildSqlWhere(filters, alias, params)` — parameterized SQL filter, applied to both rankers

#### LLM (`lib/openai.ts`)
- `createEmbedding` — converts text to vector via `text-embedding-3-small`
- `generateAnswerStream` — streams chat responses from `gpt-4o-mini` with conversation history
- System prompt instructs citing article titles and dates

#### Frontend (`components/ChatInterface.tsx`)
- Chat bubble interface (user right, assistant left)
- Sources deferred until after answer streaming completes
- Auto-scroll only when user is near bottom
- Expandable source cards with title, date, author, match score, and PDF link

#### About Dialog (`components/AboutSection.tsx`)
- "How it works" modal explaining semantic search pipeline

### Data contract (consumer stub)

The app queries a Postgres + pgvector database built and owned by
[pdf-newsletter-converter](https://github.com/murguia/pdf-newsletter-converter)
(authoritative contract: its `docs/data-contract.md`). The coupling is the schema,
not a network API — `lib/search.ts` runs SQL directly. What this app depends on:

**Embedding invariant (breaks silently if violated):** queries must be embedded with
the **same** model the corpus was — `text-embedding-3-small`, 1536 dims, cosine.
Pinned in `lib/openai.ts` `EMBEDDING_MODEL`; must match the backend's.

**Returned per match** (the `metadata`), from the `articles` table:

| Field | Type | Notes |
|---|---|---|
| `title` | string | Article title |
| `date` | string | `YYYY-MM-DD` |
| `year` | string | Publication year |
| `author` | string | `'I.F. Stone'` = his own voice; others are guest/wire |
| `type` | string | `analysis` \| `note` \| `quotation-transcription` (reproduced material) |
| `full_text` | string | Complete article text |
| `file_id` | string | PDF filename → `https://www.ifstone.org/weekly/{file_id}` |
| `index_topics` | string[] | Stone's topic tags from the annual index |

Also queried (not returned): `articles.embedding` / `sections.embedding` (semantic),
`articles.fts` (lexical). Adding columns is safe; renaming/retyping a column above
or changing the embedding space is a breaking change — coordinate both repos.

### Environment Configuration

Required variables (in `.env.local`):
- `OPENAI_API_KEY` - For embeddings and LLM responses
- `DATABASE_URL` - Postgres + pgvector serving layer (local: `postgresql://localhost/ifstone`; production: Supabase connection string)

### Deployment

Deployed on Vercel. Environment variables must be set in Vercel dashboard. The `next.config.js` includes `Cache-Control: no-cache` headers to prevent Safari from serving stale content after deploys.
