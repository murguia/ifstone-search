# I.F. Stone's Weekly Search

An AI-powered semantic search interface for I.F. Stone's Weekly archive (1953-1971). Ask questions about I.F. Stone's investigative journalism and get AI-generated answers with citations and links to the original PDFs.

## Overview

This application uses:
- **Next.js** with TypeScript for the web framework
- **OpenAI** for embeddings (`text-embedding-3-small`) and answer generation (`gpt-4o-mini`)
- **Pinecone** for vector similarity search
- **RAG (Retrieval-Augmented Generation)** to provide accurate, source-backed answers

Data ingestion (PDF conversion, review, and Pinecone upload) is handled by a separate project.

## Features

- Semantic search across I.F. Stone's Weekly articles
- Conversational chat interface with follow-up questions
- Source citations with article title, date, author, and type
- Index-topic boosting — Stone's own annual index categorizations influence search ranking
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
PINECONE_API_KEY=your_pinecone_api_key_here
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
3. **Similarity search** — top matches retrieved from Pinecone (`ifstone-weekly` index)
4. **Index-topic boosting** — results where Stone's own index topics match query keywords get a 20% score boost
5. **Answer generation** — `gpt-4o-mini` generates an answer using the matched article texts as context
6. **Sources** — each result links back to the original PDF with title, date, and author

### Pinecone Vector Schema

Each vector in the `ifstone-weekly` index carries metadata produced by the data pipeline:

| Field | Description |
|---|---|
| `title` | Article title |
| `date` | Publication date (YYYY-MM-DD) |
| `year` | Publication year |
| `author` | "I.F. Stone", "Jennings Perry", etc. |
| `type` | `analysis`, `note`, or `quotation-transcription` |
| `full_text` | Complete article text |
| `text` | First 1000 chars (Pinecone display) |
| `file_id` | PDF filename (e.g., `IFStonesWeekly-1953apr04.pdf`) |
| `index_topics` | JSON array of Stone's own topic tags from his annual index |
| `has_index_topics` | Boolean — whether this article has index tags |

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
│   ├── openai.ts               # OpenAI embeddings and streaming chat
│   └── pinecone.ts             # Pinecone search with index-topic boosting
└── package.json
```

## Development

```bash
npm run dev       # Start development server
npm run build     # Production build
npm run start     # Start production server
npm run lint      # Run linter
```

## Deployment

Deployable to Vercel, Railway, Fly.io, or any Node.js platform. Set `OPENAI_API_KEY` and `PINECONE_API_KEY` as environment variables.

## Credits

Archive courtesy of [ifstone.org](https://www.ifstone.org). Use of these Weeklys for non-commercial purposes is authorized by the I.F. Stone family.

The I.F. Stone heirs thank Ron Unz for scanning the newsletters and sharing the material.

Powered by OpenAI and Pinecone.

## License

MIT
