# I.F. Stone's Weekly Search

An AI-powered semantic search engine for I.F. Stone's Weekly archive (1953-1971). Ask questions about I.F. Stone's investigative journalism and get AI-generated answers with citations from the original documents.

## Overview

This application uses:
- **Next.js 14** with TypeScript for the web framework
- **OpenAI** for embeddings and answer generation
- **Pinecone** for vector database storage
- **RAG (Retrieval-Augmented Generation)** to provide accurate, source-backed answers

## Features

- 🔍 Semantic search through 18 years of I.F. Stone's Weekly
- 💬 Chat interface for asking questions
- 📚 Source citations with expandable excerpts
- 🎨 Beautiful, accessible UI with light/dark mode support
- ⚡ Fast vector similarity search

## Prerequisites

- Node.js 18+ and npm
- OpenAI API key ([get one here](https://platform.openai.com/api-keys))
- Pinecone account ([sign up here](https://www.pinecone.io/))
- Downloaded PDFs from I.F. Stone's Weekly (use the download script in `../scripts`)

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

Edit `.env.local`:
```
OPENAI_API_KEY=your_openai_api_key_here
PINECONE_API_KEY=your_pinecone_api_key_here
```

### 3. Set Up Pinecone Index

Create the Pinecone vector database index:

```bash
npm run setup-pinecone
```

This will create an index named `ifstone-weekly` with:
- Dimension: 1536 (text-embedding-3-small)
- Metric: cosine similarity
- Spec: Serverless (AWS us-east-1)

### 4. Process PDFs

Extract text from all downloaded PDFs:

```bash
npm run process-pdfs
```

This will:
- Read all PDFs from `../scripts/ifstone_pdfs/`
- Extract text from each document
- Save extracted data to `data/extracted-documents.json`

Expected output:
- Processing time: ~5-15 minutes depending on number of PDFs
- Output file size: Varies based on content

### 5. Generate and Upload Embeddings

Create embeddings and upload to Pinecone:

```bash
npm run upload-embeddings
```

This will:
- Chunk the extracted text into ~500-token pieces with overlap
- Generate embeddings using OpenAI's `text-embedding-3-small`
- Upload vectors to Pinecone
- Save backup to `data/embeddings.json`

**Note**: This step can take a while and will incur OpenAI API costs based on the amount of text.

Expected costs (approximate):
- text-embedding-3-small: ~$0.02 per 1M tokens
- Total cost depends on corpus size

### 6. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. Type a question about I.F. Stone's Weekly in the input box
2. Click "Ask" or press Enter
3. Wait for the AI to search and generate an answer
4. Expand "View Sources" to see the original excerpts used

### Example Questions

- "What did I.F. Stone write about McCarthyism?"
- "Tell me about the coverage of the Vietnam War"
- "What articles discuss civil rights?"
- "How did I.F. Stone report on the Kennedy administration?"
- "What was written about the Cuban Missile Crisis?"

## Project Structure

```
ifstone-search/
├── app/
│   ├── api/
│   │   └── chat/
│   │       └── route.ts       # Chat API endpoint (RAG pipeline)
│   ├── globals.css            # Global styles
│   ├── layout.tsx             # Root layout
│   └── page.tsx               # Home page
├── components/
│   └── ChatInterface.tsx      # Main chat UI component
├── lib/
│   ├── openai.ts              # OpenAI client and utilities
│   └── pinecone.ts            # Pinecone client and search
├── scripts/
│   ├── process-pdfs.ts        # PDF text extraction
│   ├── setup-pinecone.ts      # Pinecone index creation
│   └── upload-embeddings.ts   # Embedding generation and upload
├── data/                      # Generated data (gitignored)
│   ├── extracted-documents.json
│   └── embeddings.json
└── package.json
```

## How It Works

### RAG Pipeline

1. **User asks a question** → Sent to `/api/chat`
2. **Question embedding** → Convert question to vector using OpenAI
3. **Similarity search** → Find top 5 most similar chunks in Pinecone
4. **Context assembly** → Combine relevant excerpts
5. **Answer generation** → Use GPT-4o-mini to generate answer with context
6. **Response** → Return answer with source citations

### Chunking Strategy

- **Chunk size**: ~500 tokens (375 words)
- **Overlap**: 50 tokens for context continuity
- **Metadata**: Year, filename, chunk index, date (if available)

## Development

### Run Linter

```bash
npm run lint
```

### Build for Production

```bash
npm run build
npm run start
```

## Deployment

This app can be deployed to:

- **Vercel** (recommended for Next.js)
- **Railway**
- **Fly.io**
- Any Node.js hosting platform

Make sure to set environment variables in your deployment platform.

## Troubleshooting

### "No PDFs found" error

Make sure you've run the PDF download script first:
```bash
cd ../scripts
python download_pdfs.py
```

### "Index not found" error

Run the Pinecone setup script:
```bash
npm run setup-pinecone
```

### OpenAI rate limits

If you hit rate limits, the upload script includes delays between batches. You may need to:
- Reduce batch size in `scripts/upload-embeddings.ts`
- Wait and re-run the script (it will skip already-processed chunks)

### Empty search results

Make sure:
1. Embeddings have been uploaded to Pinecone
2. Your Pinecone index name matches `PINECONE_INDEX_NAME` in the code
3. Check Pinecone dashboard to verify vectors are present

## Credits

- Inspired by [obbb](https://github.com/lucasdickey/obbb) by Lucas Dickey
- Built for exploring I.F. Stone's Weekly archive (1953-1971)
- Powered by OpenAI and Pinecone

## License

MIT
