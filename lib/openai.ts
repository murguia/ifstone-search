import OpenAI from 'openai';

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is not set');
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const EMBEDDING_MODEL = 'text-embedding-3-small';

export async function createEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });

  return response.data[0].embedding;
}

export async function generateAnswer(
  question: string,
  context: string
): Promise<string> {
  const prompt = `You are an AI assistant helping users understand I.F. Stone's Weekly, a newsletter published from 1953 to 1971. I.F. Stone was an investigative journalist known for his independent reporting and critical analysis of government and politics.

Based on the following excerpts from I.F. Stone's Weekly, answer the user's question. If the excerpts don't contain relevant information, say so. Be accurate and cite specific details when possible.

Each source includes a title, date, and author. Use these to cite your sources precisely.

Format your answer as follows:
1. Start with 2-3 bullet points summarizing the key findings
2. Follow with a detailed explanation providing context and analysis
3. Cite specific article titles and dates when available

Context from I.F. Stone's Weekly:
${context}

Question: ${question}

Answer:`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'You are a helpful assistant with expertise in I.F. Stone\'s Weekly and mid-20th century American journalism and politics.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.7,
    max_tokens: 1200,
  });

  return response.choices[0].message.content || 'No answer generated.';
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function generateAnswerStream(
  question: string,
  context: string,
  conversationHistory: ConversationMessage[] = []
) {
  // Keep only last 4 exchanges (8 messages) to manage token limits
  const recentHistory = conversationHistory.slice(-8);

  // Build system message with instructions
  const systemMessage = `You are an AI assistant helping users understand I.F. Stone's Weekly, a newsletter published from 1953 to 1971. I.F. Stone was an investigative journalist known for his independent reporting and critical analysis of government and politics.

Based on the conversation history and excerpts from I.F. Stone's Weekly, answer the user's question. If the excerpts don't contain relevant information, say so. Be accurate and cite specific details when possible.

Each source includes a title, date, and author. Use these to cite your sources precisely.

Conversation Context:
- Pay attention to the conversation history to understand follow-up questions
- If the user asks a follow-up like "What about the 1960s?" or "Tell me more", refer back to the previous topic

Format your answer as follows:
1. Start with 2-3 bullet points summarizing the key findings
2. Follow with a detailed explanation providing context and analysis
3. Cite specific article titles and dates when available`;

  // Build messages array with conversation history
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    {
      role: 'system',
      content: systemMessage,
    },
  ];

  // Add recent conversation history
  recentHistory.forEach((msg) => {
    messages.push({
      role: msg.role,
      content: msg.content,
    });
  });

  // Add current question with context
  const currentPrompt = `Context from I.F. Stone's Weekly:
${context}

Question: ${question}`;

  messages.push({
    role: 'user',
    content: currentPrompt,
  });

  const stream = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    temperature: 0.7,
    max_tokens: 1200,
    stream: true,
  });

  return stream;
}
