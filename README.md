# I.F. Stone's Weekly Search

An AI-powered semantic search interface for I.F. Stone's Weekly archive (1953-1971). Ask questions about I.F. Stone's investigative journalism and get AI-generated answers with citations and links to the original PDFs.

## Overview

This application uses:
- **Next.js** with TypeScript for the web framework
- **OpenAI** for embeddings (`text-embedding-3-small`) and answer generation (`gpt-4o-mini`)
- **Postgres + pgvector** for hybrid (semantic + lexical) search
- **RAG (Retrieval-Augmented Generation)** to provide accurate, source-backed answers

Data ingestion is handled by a companion project: [pdf-newsletter-converter](https://github.com/murguia/pdf-newsletter-converter) (private). That repo contains the full pipeline — PDF download, vision-language model conversion, manual review UI, index parsing, and the Postgres build — and owns the database this app queries.

## Features

- Semantic search across I.F. Stone's Weekly articles
- Conversational chat interface with follow-up questions
- Source citations with article title, date, author, and type
- Direct links to original PDFs on ifstone.org
- Search history with localStorage persistence
- Light/dark mode support

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env.local` and fill in your API keys:

```bash
cp .env.example .env.local
```

```
OPENAI_API_KEY=your_openai_api_key_here
DATABASE_URL=your_postgres_connection_string_here
```

### 3. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## How It Works

### Search Pipeline

1. **User asks a question** via the chat interface
2. **Embedding** — question is converted to a vector using `text-embedding-3-small`
3. **Hybrid search** — semantic (pgvector, two-level: article- and section-level vectors) and lexical (Postgres full-text search) results fused via Reciprocal Rank Fusion
4. **Answer generation** — `gpt-4o-mini` generates an answer using the matched article texts as context
5. **Sources** — each result links back to the original PDF with title, date, and author

### Article Schema

Each match returns metadata from the `articles` table (built and owned by the companion ingestion repo):

| Field | Description |
|---|---|
| `title` | Article title |
| `date` | Publication date (YYYY-MM-DD) |
| `year` | Publication year |
| `author` | "I.F. Stone", "Jennings Perry", etc. |
| `type` | `analysis`, `note`, or `quotation-transcription` |
| `full_text` | Complete article text |
| `file_id` | PDF filename (e.g., `IFStonesWeekly-1953apr04.pdf`) |
| `index_topics` | Stone's own topic tags from his annual index |

## Project Structure

```
ifstone-search/
├── app/
│   ├── api/chat/route.ts      # Chat API endpoint (RAG pipeline)
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── AboutSection.tsx        # 'How it works' info dialog
│   └── ChatInterface.tsx       # Main chat UI
├── lib/
│   ├── citations.ts            # Citation parser for [1], [2] references
│   ├── db.ts                   # Postgres connection pool
│   ├── filters.ts              # SQL filter builder
│   ├── openai.ts               # OpenAI embeddings and streaming chat
│   └── search.ts               # Postgres + pgvector hybrid search
├── __tests__/                   # Vitest tests
└── package.json
```

## Development

```bash
npm run dev       # Start development server
npm run build     # Production build
npm run start     # Start production server
npm run lint      # Run linter
npm test          # Run tests
npm run test:watch # Run tests in watch mode
```

## Testing

Tests use [Vitest](https://vitest.dev/) and cover:

- **Citation parsing** (`__tests__/citations.test.ts`) — verifies inline `[1]`, `[2]` citation extraction from LLM responses
- **SQL filters** (`__tests__/sql-filters.test.ts`) — verifies parameterized WHERE-clause building for the hybrid rankers
- **Chat interface** (`__tests__/chat-interface.test.tsx`) — verifies the sample-question buttons submit a search

CI runs automatically on every push and PR via GitHub Actions.

## Deployment

Deployable to Vercel, Railway, Fly.io, or any Node.js platform. Set `OPENAI_API_KEY` and `DATABASE_URL` as environment variables.

## Credits

Archive courtesy of [ifstone.org](https://www.ifstone.org). Use of these Weeklys for non-commercial purposes is authorized by the I.F. Stone family.

The I.F. Stone heirs thank Ron Unz for scanning the newsletters and sharing the material.

Powered by OpenAI and Postgres.

## License

MIT
