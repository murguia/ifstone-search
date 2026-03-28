"use client";

import { useState, FormEvent, useEffect, useRef, ReactNode } from "react";
import { parseCitations } from "@/lib/citations";

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

export interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Array<{
    title: string;
    text: string;
    date?: string;
    year: string;
    author?: string;
    type?: string;
    filename: string;
    pdfUrl?: string;
    score?: number;
  }>;
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [filterType, setFilterType] = useState("");
  const [filterAuthor, setFilterAuthor] = useState("");
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if ((!input.trim() && !filterType && !filterAuthor) || isLoading) return;

    const userMessage: Message = {
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const question = input.trim();
    setInput("");
    setIsLoading(true);

    try {
      const conversationHistory = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          conversationHistory,
          filters: {
            ...(filterType && { type: filterType }),
            ...(filterAuthor && { author: filterAuthor }),
          },
        }),
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

            if (data.type === "sources") {
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
    { text: "What did I.F. Stone write about McCarthy?", author: "I.F. Stone" },
    { text: "What was Stone's view on the Korean War armistice?", author: "" },
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
              Currently searching 1953 — full archive through 1971 coming soon.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto">
              {sampleQuestions.map((question, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setInput(question.text);
                    if (question.author) setFilterAuthor(question.author);
                  }}
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
                                      {[source.date, source.author, source.type].filter(Boolean).join(" · ")}
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
                                <div className="bg-gray-50 dark:bg-gray-900/50 rounded p-3 mt-3 max-h-80 overflow-y-auto">
                                  <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-200 mb-1">
                                    {source.title}
                                  </h4>
                                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                                    {[source.date, source.author, source.type].filter(Boolean).join(" · ")}
                                  </div>
                                  <div className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed space-y-2">
                                    {source.text.split("\n").filter(Boolean).map((para, i) => (
                                      <p key={i}>{para}</p>
                                    ))}
                                  </div>
                                </div>
                                {source.pdfUrl && (
                                  <div className="mt-2">
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
                                  </div>
                                )}
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
        <div className="flex items-center justify-between mb-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filterType === "quotation-transcription"}
            onChange={(e) => { setFilterType(e.target.checked ? "quotation-transcription" : ""); if (e.target.checked) setFilterAuthor(""); }}
            className="w-3.5 h-3.5 rounded border-gray-300 dark:border-gray-600 text-amber-500 focus:ring-amber-500 cursor-pointer"
          />
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Quotations &amp; transcriptions only
          </span>
        </label>
          <select
            value={filterType === "quotation-transcription" ? "_none" : filterAuthor}
            onChange={(e) => setFilterAuthor(e.target.value)}
            disabled={filterType === "quotation-transcription"}
            className="text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-gray-600 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {filterType === "quotation-transcription" ? (
              <option value="_none">(no author)</option>
            ) : (
              <>
                <option value="">All authors</option>
                <option value="I.F. Stone">I.F. Stone</option>
                <option value="Jennings Perry">Jennings Perry</option>
              </>
            )}
          </select>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => setMessages([])}
              className="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
            >
              Clear chat
            </button>
          )}
        </div>
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
            disabled={isLoading || (!input.trim() && !filterType && !filterAuthor)}
            className="bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-medium transition-colors"
          >
            Ask
          </button>
        </div>
      </form>
    </div>
  );
}
