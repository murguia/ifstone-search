import { NextRequest } from 'next/server';
import { createEmbedding, generateAnswerStream } from '@/lib/openai';
import { searchSimilarChunks } from '@/lib/pinecone';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(request: NextRequest) {
  try {
    const { question, conversationHistory = [] } = await request.json();

    if (!question || typeof question !== 'string') {
      const encoder = new TextEncoder();
      return new Response(
        encoder.encode(
          JSON.stringify({ type: 'error', error: 'Question is required' })
        ),
        { status: 400 }
      );
    }

    // Generate embedding for the question
    console.log('Creating embedding for question...');
    const questionEmbedding = await createEmbedding(question);

    // Search for similar chunks in Pinecone
    console.log('Searching for similar content...');
    const matches = await searchSimilarChunks(questionEmbedding, 10);

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
        return `[Source ${idx + 1}] ${metadata.text}`;
      })
      .join('\n\n');

    const sources = matches.map((match) => {
      const metadata = match.metadata as Record<string, any>;
      const filename = metadata.filename;
      const pdfUrl = `https://www.ifstone.org/weekly/${filename}`;

      return {
        text: metadata.text,
        year: metadata.year,
        filename: filename,
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
          console.log('Generating answer...');
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
