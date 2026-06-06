import { NextRequest } from 'next/server';
import { createEmbedding, generateAnswerStream } from '@/lib/openai';
import { searchArticles } from '@/lib/search';
import { parseQuery, type ParsedQuery } from '@/lib/self-query';
import type { SearchFilters } from '@/lib/filters';

interface Message {
  role: 'user' | 'assistant';
  content: string;
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

    // Self-query: infer filters + a cleaner semantic query from the question.
    // parseQuery never throws — on any failure it returns the question unchanged
    // with no filters, i.e. plain hybrid search. Skip it for filter-only requests.
    let parsed: ParsedQuery = { semanticQuery: '', filters: {}, interpretation: '' };
    if (question && typeof question === 'string' && question.trim()) {
      parsed = await parseQuery(question);
    }

    // Explicit UI filters always win over inferred ones.
    const merged: SearchFilters = { ...parsed.filters, ...uiFilters };

    // Retrieve on the semantic part; fall back to the raw question, then a broad query.
    const queryText =
      parsed.semanticQuery?.trim() || question?.trim() || 'I.F. Stone Weekly 1953';
    const questionEmbedding = await createEmbedding(queryText);

    // Hybrid search (semantic + lexical) over the Postgres serving layer
    const matches = await searchArticles(queryText, questionEmbedding, 10, merged);

    if (matches.length === 0) {
      const encoder = new TextEncoder();
      const noResultsMessage = {
        type: 'content',
        content:
          "I couldn't find any relevant information in I.F. Stone's Weekly to answer your question. Please try rephrasing or asking about a different topic.",
      };
      return new Response(encoder.encode(JSON.stringify(noResultsMessage)), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Extract context and sources
    const context = matches
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

    const sources = matches.map((match) => {
      const metadata = match.metadata as Record<string, any>;
      const fileId = metadata.file_id || metadata.filename;
      const pdfUrl = `https://www.ifstone.org/weekly/${fileId}`;

      return {
        title: metadata.title || metadata.article_title || fileId,
        text: metadata.full_text || metadata.text,
        date: metadata.date,
        year: metadata.year,
        author: metadata.author,
        type: metadata.type,
        filename: fileId,
        pdfUrl: pdfUrl,
        score: match.score,
      };
    });

    // Create a streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // How the query was read (inferred filters), so the UI can surface it.
        controller.enqueue(
          encoder.encode(
            JSON.stringify({
              type: 'interpretation',
              interpretation: parsed.interpretation,
              filters: merged,
            }) + '\n'
          )
        );

        // Send sources next
        controller.enqueue(
          encoder.encode(JSON.stringify({ type: 'sources', sources }) + '\n')
        );

        try {
          // Stream the answer
          const chatStream = await generateAnswerStream(
            question,
            context,
            conversationHistory as Message[]
          );

          for await (const chunk of chatStream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              controller.enqueue(
                encoder.encode(JSON.stringify({ type: 'content', content }) + '\n')
              );
            }
          }

          // Send done signal
          controller.enqueue(
            encoder.encode(JSON.stringify({ type: 'done' }) + '\n')
          );
        } catch (error) {
          console.error('Error streaming answer:', error);
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                type: 'error',
                error: 'Error generating answer',
              }) + '\n'
            )
          );
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
