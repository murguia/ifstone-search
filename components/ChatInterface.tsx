"use client";

import { useState, FormEvent, useEffect, useRef, ReactNode } from "react";
import { parseCitations } from "@/lib/citations";
import { COVERAGE_RANGE } from "@/lib/coverage";
import { formatPages } from "@/lib/pages";
import ArticleReader, { type ReaderSource } from "@/components/ArticleReader";

function renderCitations(text: string): ReactNode[] {
  return parseCitations(text).map((part, i) => {
    if (part.type === 'citation') {
      return (
        <button
          key={i}
          onClick={() => {
            const el = document.getElementById(`source-${part.num}`) as HTMLDetailsElement | null;
            if (el) {
              el.open = true;
              el.scrollIntoView({ behavior: "smooth", block: "nearest" });
              el.classList.add("ring-2", "ring-amber-400");
              setTimeout(() => el.classList.remove("ring-2", "ring-amber-400"), 2000);
            }
          }}
          className="inline-flex items-center justify-center text-xs font-medium text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 cursor-pointer bg-amber-100 dark:bg-amber-900/30 rounded px-1 mx-0.5 transition-colors"
        >
          {part.value}
        </button>
      );
    }
    return <span key={i}>{part.value}</span>;
  });
}

export interface ProgressStep {
  step: number;
  action: "search" | "read";
  detail: string;
  filters?: {
    type?: string;
    author?: string;
    year?: string;
    dateFrom?: string;
    dateTo?: string;
  };
}

// Compact one-line label for a research step, e.g.
// Searched “Vietnam escalation” (I.F. Stone · 1964-01-01 – 1968-12-31)
function progressLabel(step: ProgressStep): string {
  if (step.action === "read") return `Read “${step.detail}”`;
  const f = step.filters;
  const parts: string[] = [];
  if (f?.author) parts.push(f.author);
  if (f?.type) parts.push(f.type);
  if (f?.year) parts.push(f.year);
  else if (f?.dateFrom && f?.dateTo) parts.push(`${f.dateFrom} – ${f.dateTo}`);
  else if (f?.dateFrom) parts.push(`from ${f.dateFrom}`);
  else if (f?.dateTo) parts.push(`until ${f.dateTo}`);
  return `Searched “${step.detail}”${parts.length ? ` (${parts.join(" · ")})` : ""}`;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
  interpretation?: string;
  progress?: ProgressStep[];
  sources?: Array<{
    id: string;
    title: string;
    text: string;
    date?: string;
    year: string;
    author?: string;
    type?: string;
    pages?: number[];
    filename: string;
    pdfUrl?: string;
    score?: number;
  }>;
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [readerSource, setReaderSource] = useState<ReaderSource | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll only if user is near the bottom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    if (isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  async function handleSubmit(e: FormEvent | null, override?: { text: string }) {
    e?.preventDefault();

    const question = (override?.text ?? input).trim();

    if (!question || isLoading) return;

    const userMessage: Message = {
      role: "user",
      content: question,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const conversationHistory = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      // Filters are inferred server-side by self-query; the client sends none.
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, conversationHistory }),
      });

      if (!response.ok) throw new Error("Failed to get response");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("No response body");

      let sources: Message["sources"] = [];
      let content = "";
      let assistantMessageIndex = -1;

      setMessages((prev) => {
        assistantMessageIndex = prev.length;
        return [...prev, { role: "assistant", content: "", sources: [] }];
      });

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);

            if (data.type === "progress") {
              const step: ProgressStep = {
                step: data.step,
                action: data.action,
                detail: data.detail,
                filters: data.filters,
              };
              setMessages((prev) => {
                const newMessages = [...prev];
                const msg = newMessages[assistantMessageIndex];
                newMessages[assistantMessageIndex] = {
                  ...msg,
                  progress: [...(msg.progress || []), step],
                };
                return newMessages;
              });
            } else if (data.type === "interpretation") {
              const interpretation = data.interpretation || "";
              if (interpretation) {
                setMessages((prev) => {
                  const newMessages = [...prev];
                  newMessages[assistantMessageIndex] = {
                    ...newMessages[assistantMessageIndex],
                    interpretation,
                  };
                  return newMessages;
                });
              }
            } else if (data.type === "sources") {
              sources = data.sources;
            } else if (data.type === "content") {
              content += data.content;
              setMessages((prev) => {
                const newMessages = [...prev];
                newMessages[assistantMessageIndex] = {
                  ...newMessages[assistantMessageIndex],
                  content,
                };
                return newMessages;
              });
            } else if (data.type === "error") {
              throw new Error(data.error);
            }
          } catch {
            // Incomplete JSON line — will be completed in next chunk
            buffer = line;
          }
        }
      }

      // Attach sources only after streaming is complete
      if (sources && sources.length > 0) {
        setMessages((prev) => {
          const newMessages = [...prev];
          newMessages[assistantMessageIndex] = {
            ...newMessages[assistantMessageIndex],
            sources,
          };
          return newMessages;
        });
      }

      setIsLoading(false);
    } catch (error) {
      console.error("Error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        },
      ]);
      setIsLoading(false);
    }
  }

  const sampleQuestions = [
    { text: "How did I.F. Stone's view of the Vietnam War evolve from 1954 to 1968?" },
    { text: "What did I.F. Stone think about Eugene McCarthy vs. RFK in the 1968 primary?" },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-12rem)] max-w-4xl mx-auto">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-2 md:py-6">
        {messages.length === 0 ? (
          <div className="text-center flex flex-col items-center justify-center h-full">
            <h2 className="text-xl md:text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-1 md:mb-4">
              Ask about I.F. Stone&apos;s Weekly
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-3 md:mb-8 max-w-lg mx-auto text-sm md:text-base">
              Semantic search across I.F. Stone&apos;s Weekly, one of the most
              influential independent newsletters in American journalism.
              Searching the complete archive, {COVERAGE_RANGE}.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto">
              {sampleQuestions.map((question, i) => (
                <button
                  key={i}
                  onClick={() => handleSubmit(null, { text: question.text })}
                  className="text-left px-4 py-3 bg-white dark:bg-gray-800 hover:bg-amber-50 dark:hover:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-300 text-sm transition-colors border border-gray-200 dark:border-gray-700 hover:border-amber-300 dark:hover:border-amber-600"
                >
                  {question.text}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((message, index) => (
              <div key={index} className="mb-6">
                {message.role === "user" ? (
                  <div className="flex justify-end mb-4">
                    <div className="bg-amber-500 text-white px-4 py-3 rounded-2xl rounded-br-md max-w-[80%]">
                      {message.content}
                    </div>
                  </div>
                ) : (
                  <div>
                    {message.progress && message.progress.length > 0 && (
                      message.content ? (
                        // Research done: collapse to an expandable summary line.
                        <details className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                          <summary className="cursor-pointer hover:text-amber-600 dark:hover:text-amber-400 transition-colors">
                            Researched · {(() => {
                              const searches = message.progress.filter((p) => p.action === "search").length;
                              const reads = message.progress.filter((p) => p.action === "read").length;
                              const parts = [`${searches} ${searches === 1 ? "search" : "searches"}`];
                              if (reads > 0) parts.push(`${reads} ${reads === 1 ? "article" : "articles"} read`);
                              return parts.join(", ");
                            })()}
                          </summary>
                          <ol className="mt-1.5 ml-4 space-y-1 list-decimal">
                            {message.progress.map((p, i) => (
                              <li key={i}>{progressLabel(p)}</li>
                            ))}
                          </ol>
                        </details>
                      ) : (
                        // Research in flight: show the steps live.
                        <div className="mb-2 space-y-1 text-xs text-gray-500 dark:text-gray-400">
                          {message.progress.map((p, i) => (
                            <div key={i} className="flex items-center gap-1.5">
                              <span
                                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                  i === message.progress!.length - 1
                                    ? "bg-amber-500 animate-pulse"
                                    : "bg-amber-300 dark:bg-amber-700"
                                }`}
                              />
                              <span>{progressLabel(p)}</span>
                            </div>
                          ))}
                        </div>
                      )
                    )}
                    {message.interpretation && (
                      <div className="mb-2 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L14 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 018 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
                        </svg>
                        <span>{message.interpretation}</span>
                      </div>
                    )}
                    <div className="bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-5 py-4 rounded-2xl rounded-bl-md max-w-[90%] shadow-sm">
                      {message.content ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          {message.content.split("\n").map((line, i) => (
                            <p key={i} className={line === "" ? "h-4" : "mb-2"}>
                              {renderCitations(line)}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-gray-400">
                          <div className="flex gap-1">
                            <span className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" />
                            <span className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
                            <span className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                          </div>
                          <span className="text-sm">Searching archives...</span>
                        </div>
                      )}
                    </div>

                    {message.sources && message.sources.length > 0 && (
                      <div className="mt-3">
                        <p className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-2">
                          Sources ({message.sources.length})
                        </p>
                        <div className="space-y-2">
                          {message.sources.map((source, idx) => (
                            <details
                              key={idx}
                              id={`source-${idx + 1}`}
                              className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white/50 dark:bg-gray-800/50 transition-all"
                            >
                              <summary className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-amber-50/50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer">
                                <div className="flex items-center gap-3 min-w-0">
                                  <span className="bg-amber-500 text-white text-xs font-medium px-2 py-1 rounded shrink-0">
                                    [{idx + 1}]
                                  </span>
                                  <div className="min-w-0">
                                    <span className="text-gray-800 dark:text-gray-200 font-medium text-sm">
                                      {source.title}
                                    </span>
                                    <div className="text-xs text-gray-400 dark:text-gray-500">
                                      {[source.date, source.author, source.type, formatPages(source.pages)].filter(Boolean).join(" · ")}
                                    </div>
                                  </div>
                                </div>
                                {source.score && (
                                  <span className="text-amber-600 dark:text-amber-400 text-xs shrink-0 ml-2">
                                    {(source.score * 100).toFixed(0)}%
                                  </span>
                                )}
                              </summary>
                              <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700">
                                <div className="bg-gray-50 dark:bg-gray-900/50 rounded p-3 mt-3">
                                  <div className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                                    {source.text}
                                  </div>
                                </div>
                                <div className="mt-2 flex items-center gap-4">
                                  <button
                                    type="button"
                                    onClick={() => setReaderSource(source)}
                                    className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 transition-colors flex items-center gap-1"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                    </svg>
                                    Read full article
                                  </button>
                                  {source.pdfUrl && (
                                    <a
                                      href={source.pdfUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors flex items-center gap-1"
                                    >
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                      </svg>
                                      View original PDF
                                    </a>
                                  )}
                                </div>
                              </div>
                            </details>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {isLoading && messages.length > 0 && messages[messages.length - 1].role !== "assistant" && (
              <div className="flex items-center gap-2 text-gray-400 mb-4">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" />
                  <span className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
                  <span className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                </div>
                <span className="text-sm">Searching archives...</span>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="border-t border-amber-200 dark:border-gray-700 p-4 bg-white/50 dark:bg-gray-900/50"
      >
        {messages.length > 0 && (
          <div className="flex items-center justify-end mb-3">
            <button
              type="button"
              onClick={() => setMessages([])}
              className="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
            >
              Clear chat
            </button>
          </div>
        )}
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about I.F. Stone's Weekly..."
            className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-medium transition-colors"
          >
            Ask
          </button>
        </div>
      </form>

      {readerSource && (
        <ArticleReader source={readerSource} onClose={() => setReaderSource(null)} />
      )}
    </div>
  );
}
