import OpenAI from 'openai';
import { openai } from './openai';
import { toolDefinitions, executeTool, type ToolProgress } from './agent-tools';
import { loadAuthors } from './self-query';
import type { Match } from './search';
import type { SearchFilters } from './filters';

const MAX_STEPS = 4;
const AGENT_MODEL = 'gpt-4o';

export interface AgentProgress extends ToolProgress {
  step: number;
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

function buildSystemPrompt(recurringAuthors: string[]): string {
  const knownAuthors = recurringAuthors.length ? recurringAuthors.join(', ') : 'I.F. Stone';
  return `You are a research planner for I.F. Stone's Weekly, an investigative newsletter published from 1953 to 1971. Your only job is to RETRIEVE evidence with the tools provided — a separate model writes the user-facing answer from the articles you collect, so you never write the answer yourself.

HOW TO RESEARCH:
- Always search before finishing. Never rely on prior knowledge.
- Issue multiple scoped searches when a question spans several topics, people, or time periods — e.g. for "how did X evolve from 1954 to 1968", search the early and late periods separately using date filters.
- Re-search with different phrasing or broader filters when results are thin.
- Use read_article to pull the full text of an article whose excerpt looks important but incomplete.
- The recurring authors in the corpus, with canonical spellings, are: ${knownAuthors}. I.F. Stone refers to himself as "IFS" and "Izzy"; the canonical author value is "I.F. Stone".

WHEN TO STOP:
- Stop as soon as the collected results cover the question — do not keep searching for marginal additions.
- To finish, reply with a one-line note of what you gathered and make no further tool calls. The note is discarded; only the retrieved articles matter.`;
}

/**
 * Runs a tool-calling research loop: the model plans and issues scoped searches
 * over the Weekly and drills into specific articles, deciding when it has enough
 * evidence. Returns every match retrieved along the way; the chat route dedupes
 * them and hands them to the existing answer-streaming model.
 */
export async function runResearchAgent(opts: {
  question: string;
  conversationHistory?: ConversationMessage[];
  uiFilters?: SearchFilters;
  onProgress?: (progress: AgentProgress) => void;
}): Promise<Match[]> {
  const { question, conversationHistory = [], uiFilters = {}, onProgress } = opts;
  const { all: allowedAuthors, recurring } = await loadAuthors();

  // Recent history (as in generateAnswerStream) so follow-ups resolve.
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: buildSystemPrompt(recurring) },
    ...conversationHistory.slice(-8).map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: question },
  ];

  const collected: Match[] = [];

  for (let step = 0; step < MAX_STEPS; step++) {
    const completion = await openai.chat.completions.create({
      model: AGENT_MODEL,
      messages,
      tools: toolDefinitions,
      // Force at least one search on the first turn so answers are always grounded.
      tool_choice: step === 0 ? 'required' : 'auto',
      temperature: 0.3,
      max_tokens: 600,
    });

    const choice = completion.choices[0].message;
    messages.push(choice);

    // No tool calls: the agent considers the evidence sufficient.
    if (!choice.tool_calls || choice.tool_calls.length === 0) break;

    for (const call of choice.tool_calls) {
      if (call.type !== 'function') continue;
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || '{}');
      } catch {
        args = {};
      }
      const result = await executeTool(call.function.name, args, {
        uiFilters,
        allowedAuthors,
        onProgress: (p) => onProgress?.({ step, ...p }),
      });
      collected.push(...result.matches);
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: result.content,
      });
    }
  }

  // Step budget exhausted (or agent finished): the route synthesizes from
  // whatever was collected — no forced final completion needed here.
  return collected;
}

// Collapse the matches retrieved across all of the agent's tool calls into a
// deduped, score-ranked list (the same article can surface in several searches).
export function dedupeMatches(matches: Match[], cap: number = 10): Match[] {
  const byId = new Map<string, Match>();
  for (const m of matches) {
    const id = m.metadata.article_id;
    const existing = byId.get(id);
    if (!existing || m.score > existing.score) byId.set(id, m);
  }
  return [...byId.values()].sort((a, b) => b.score - a.score).slice(0, cap);
}
