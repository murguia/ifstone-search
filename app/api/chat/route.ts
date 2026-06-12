import { NextRequest } from 'next/server';
import { createEmbedding, generateAnswerStream } from '@/lib/openai';
import { searchArticles, type Match } from '@/lib/search';
import { parseQuery, type ParsedQuery } from '@/lib/self-query';
import { runResearchAgent, dedupeMatches } from '@/lib/agent';
import type { SearchFilters } from '@/lib/filters';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const MAX_SOURCES = 10;
const PREVIEW_LEN = 280;
const NO_RESULTS_MESSAGE =
  "I couldn't find any relevant information in I.F. Stone's Weekly to answer your question. Please try rephrasing or asking about a different topic.";

// Build the [Source n] context block the answer model is grounded in.
function buildContext(matches: Match[]): string {
  return matches
    .map((match, idx) => {
      const metadata = match.metadata as Record<string, any>;
      const text = metadata.full_text || metadata.text;
      const header = [
        metadata.title,
        metadata.date,
        metadata.author,
      ].filter(Boolean).join(' | ');
      return `[Source ${idx + 1}] ${header}\n${text}`;
    })
    .join('\n\n');
}

function buildSources(matches: Match[]) {
  return matches.map((match) => {
    const metadata = match.metadata as Record<string, any>;
    const fileId = metadata.file_id || metadata.filename;
    const pdfUrl = `https://www.ifstone.org/weekly/${fileId}`;

    // Ship only a short preview; the full text is fetched on demand via
    // /api/article/[id] when the reader is opened (keeps this payload small).
    const fullText = metadata.full_text || metadata.text || '';
    const preview =
      fullText.length > PREVIEW_LEN
        ? fullText.slice(0, PREVIEW_LEN).trimEnd() + '…'
        : fullText;

    return {
      id: metadata.article_id,
      title: metadata.title || metadata.article_title || fileId,
      text: preview,
      date: metadata.date,
      year: metadata.year,
      author: metadata.author,
      type: metadata.type,
      pages: metadata.pages,
      filename: fileId,
      pdfUrl: pdfUrl,
      score: match.score,
    };
  });
}

export async function POST(request: NextRequest) {
  try {
    const { question, conversationHistory = [], filters = {} } = await request.json();

    if ((!question || typeof question !== 'string') && !filters.type) {
      const encoder = new TextEncoder();
      return new Response(
        encoder.encode(
          JSON.stringify({ type: 'error', error: 'Question is required' })
        ),
        { status: 400 }
      );
    }

    const uiFilters = (filters || {}) as SearchFilters;
    const hasQuestion =
      Boolean(question) && typeof question === 'string' && Boolean(question.trim());
    const history = conversationHistory as Message[];

    // The stream opens before any retrieval so the agent's progress events
    // reach the client live. Order: progress* → (interpretation) → sources →
    // content* → done.
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: Record<string, unknown>) =>
          controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));

        try {
          // Agentic research path: a tool-calling planner issues its own scoped
          // searches and article reads. Retrieval only — the answer below is
          // still written by generateAnswerStream. Filter-only requests skip it;
          // any agent failure falls back to the original one-shot flow.
          let matches: Match[] | null = null;
          if (hasQuestion) {
            try {
              const collected = await runResearchAgent({
                question,
                conversationHistory: history,
                uiFilters,
                onProgress: (p) => send({ type: 'progress', ...p }),
              });
              matches = dedupeMatches(collected, MAX_SOURCES);
            } catch (err) {
              console.error('agent loop failed; falling back to one-shot search:', err);
            }
          }

          if (matches === null) {
            // Original flow: self-query parse → single hybrid search. parseQuery
            // never throws — on any failure it returns the question unchanged
            // with no filters, i.e. plain hybrid search.
            let parsed: ParsedQuery = { semanticQuery: '', filters: {}, interpretation: '' };
            if (hasQuestion) {
              parsed = await parseQuery(question);
            }

            // Explicit UI filters always win over inferred ones.
            const merged: SearchFilters = { ...parsed.filters, ...uiFilters };

            // Retrieve on the semantic part; fall back to the raw question, then a broad query.
            const queryText =
              parsed.semanticQuery?.trim() || question?.trim() || 'I.F. Stone Weekly 1953';
            const questionEmbedding = await createEmbedding(queryText);

            matches = await searchArticles(queryText, questionEmbedding, MAX_SOURCES, merged);

            // How the query was read (inferred filters), so the UI can surface it.
            send({ type: 'interpretation', interpretation: parsed.interpretation, filters: merged });
          }

          if (matches.length === 0) {
            send({ type: 'content', content: NO_RESULTS_MESSAGE });
            send({ type: 'done' });
            return;
          }

          // Send sources before the answer starts streaming
          send({ type: 'sources', sources: buildSources(matches) });

          // Stream the answer
          const chatStream = await generateAnswerStream(
            question,
            buildContext(matches),
            history
          );

          for await (const chunk of chatStream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              send({ type: 'content', content });
            }
          }

          // Send done signal
          send({ type: 'done' });
        } catch (error) {
          console.error('Error streaming answer:', error);
          send({ type: 'error', error: 'Error generating answer' });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error in chat API:', error);
    const encoder = new TextEncoder();
    return new Response(
      encoder.encode(
        JSON.stringify({
          type: 'error',
          error: 'An error occurred while processing your request',
        })
      ),
      { status: 500 }
    );
  }
}
