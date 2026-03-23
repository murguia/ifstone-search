import { NextRequest } from 'next/server';
import { createEmbedding, generateAnswerStream } from '@/lib/openai';
import { searchSimilarChunks } from '@/lib/pinecone';

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

    // Generate embedding for the question (use broad query if filter-only)
    const queryText = question?.trim() || 'I.F. Stone Weekly 1953';
    const questionEmbedding = await createEmbedding(queryText);

    // Search for similar chunks in Pinecone
    const matches = await searchSimilarChunks(questionEmbedding, queryText, 10, filters);

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
        // Send sources first
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
