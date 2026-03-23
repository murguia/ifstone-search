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

This is a RAG (Retrieval-Augmented Generation) search interface for I.F. Stone's Weekly (1953-1971). Data ingestion (PDF conversion, review, Pinecone upload) is handled by a separate private repo: [pdf-newsletter-converter](https://github.com/murguia/pdf-newsletter-converter).

### Core Architecture
1. **Query Embedding**: User questions are embedded via OpenAI `text-embedding-3-small`
2. **Vector Search**: Pinecone similarity search against the `ifstone-weekly` index
3. **Index-Topic Boosting**: Results where Stone's own annual index topics match query keywords get a 20% score boost
4. **Response Generation**: GPT-4o-mini generates answers grounded in matched article chunks
5. **Streaming**: Answers stream to the client; sources appear after streaming completes

### Key Components

#### API Route (`app/api/chat/route.ts`)
- Handles chat requests with streaming responses
- Passes query text to `searchSimilarChunks` for keyword-based index-topic boosting
- Builds LLM context from `full_text` metadata with title/date/author headers
- Returns sources with title, date, author, type, and PDF link

#### Search (`lib/pinecone.ts`)
- `searchSimilarChunks(embedding, query, topK)` — fetches 3x candidates, applies topic boost, re-ranks
- Parses `index_topics` (JSON string array) from Pinecone metadata
- Compares query keywords against topics for boosting decisions

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

### Pinecone Vector Schema

Each vector in `ifstone-weekly` carries metadata produced by pdf-newsletter-converter:

| Field | Type | Description |
|---|---|---|
| `title` | string | Article title |
| `date` | string | Publication date (YYYY-MM-DD) |
| `year` | string | Publication year |
| `author` | string | "I.F. Stone", "Jennings Perry", etc. |
| `type` | string | `analysis`, `note`, or `quotation-transcription` |
| `full_text` | string | Complete article text |
| `text` | string | First 1000 chars |
| `file_id` | string | PDF filename (e.g., `IFStonesWeekly-1953apr04.pdf`) |
| `index_topics` | string | JSON array of Stone's topic tags from annual index |
| `has_index_topics` | bool | Whether this article has index tags |

### Environment Configuration

Required variables (in `.env.local`):
- `OPENAI_API_KEY` - For embeddings and LLM responses
- `PINECONE_API_KEY` - Vector database queries

### Deployment

Deployed on Vercel. Environment variables must be set in Vercel dashboard. The `next.config.js` includes `Cache-Control: no-cache` headers to prevent Safari from serving stale content after deploys.
