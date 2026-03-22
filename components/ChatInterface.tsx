"use client";

import { useState, FormEvent, useEffect, useRef } from "react";

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
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K: Focus search input
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      // Cmd/Ctrl + Enter: Submit form
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && document.activeElement === inputRef.current) {
        e.preventDefault();
        if (input.trim() && !isLoading) {
          formRef.current?.requestSubmit();
        }
      }
      // Escape: Clear input
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        setInput('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [input, isLoading]);

  const handleExampleClick = (question: string) => {
    setInput(question);
    // Focus the input field after a short delay to ensure state update
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const handleCopy = async (content: string, index: number, question?: string) => {
    let textToCopy = content;
    if (question) {
      textToCopy = `Q: ${question}\n\nA: ${content}`;
    }

    try {
      await navigator.clipboard.writeText(textToCopy);
    } catch {
      // Fallback for non-HTTPS contexts (e.g., local IP)
      const textarea = document.createElement('textarea');
      textarea.value = textToCopy;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const question = input.trim();
    setInput("");
    setIsLoading(true);

    try {
      // Prepare conversation history (exclude sources, just role and content)
      const conversationHistory = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question,
          conversationHistory,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      let sources: Message["sources"] = [];
      let content = "";
      let assistantMessageIndex = -1;

      // Add empty assistant message that we'll update
      setMessages((prev) => {
        assistantMessageIndex = prev.length;
        return [
          ...prev,
          {
            role: "assistant",
            content: "",
            sources: [],
          },
        ];
      });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter((line) => line.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line);

            if (data.type === "sources") {
              sources = data.sources;
              setMessages((prev) => {
                const newMessages = [...prev];
                newMessages[assistantMessageIndex] = {
                  ...newMessages[assistantMessageIndex],
                  sources,
                };
                return newMessages;
              });
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
          } catch (parseError) {
            console.error("Error parsing chunk:", parseError);
          }
        }
      }

      setIsLoading(false);
    } catch (error) {
      console.error("Error:", error);
      const errorMessage: Message = {
        role: "assistant",
        content:
          "Sorry, I encountered an error while processing your question. Please try again.",
      };
      setMessages((prev) => [...prev, errorMessage]);
      setIsLoading(false);
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 sm:p-6">
      {/* Messages */}
      <div className="mb-4 sm:mb-6 space-y-4 min-h-[300px] sm:min-h-[400px] max-h-[500px] sm:max-h-[600px] overflow-y-auto">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 dark:text-gray-400 py-12">
            <p className="text-lg mb-4">
              Ask a question about I.F. Stone&apos;s Weekly
            </p>
            <div className="text-sm space-y-2">
              <p className="mb-3">Example questions:</p>
              <div className="space-y-2 max-w-2xl mx-auto">
                {[
                  "What did I.F. Stone write about McCarthy?",
                  "What was Stone's view on the Korean War armistice?",
                  "What did Stone write about atomic weapons?",
                ].map((question, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleExampleClick(question)}
                    className="w-full px-3 py-3 sm:px-4 sm:py-3 text-left text-sm sm:text-base bg-white dark:bg-gray-700 hover:bg-amber-50 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 rounded-lg transition-colors text-gray-700 dark:text-gray-200 hover:border-amber-300 dark:hover:border-amber-600 active:bg-amber-100 dark:active:bg-gray-500"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((message, index) => {
          // Find the previous user message for context when copying
          const previousUserMessage = index > 0 && messages[index - 1].role === "user"
            ? messages[index - 1].content
            : undefined;

          return (
            <div
              key={index}
              className={`${
                message.role === "user"
                  ? "bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500"
                  : "bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500"
              } p-3 sm:p-4 rounded-r-lg relative group`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold text-gray-900 dark:text-gray-100">
                  {message.role === "user" ? "You" : "I.F. Stone Bot"}
                </div>

                {/* Copy button for assistant messages */}
                {message.role === "assistant" && (
                  <button
                    onClick={() => handleCopy(message.content, index, previousUserMessage)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 rounded hover:bg-amber-100 dark:hover:bg-amber-900/30 text-gray-600 dark:text-gray-400"
                    title="Copy answer"
                  >
                    {copiedIndex === index ? (
                      <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Copied!
                      </span>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
              {message.content ? (
                <div className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                  {message.content}
                </div>
              ) : (
                <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                    <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                    <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
                  </div>
                  <span>Searching archives...</span>
                </div>
              )}

            {/* Sources */}
            {message.sources && message.sources.length > 0 && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-semibold text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100">
                  View Sources ({message.sources.length})
                </summary>
                <div className="mt-2 space-y-2">
                  {message.sources.map((source, idx) => (
                    <div
                      key={idx}
                      className="text-sm bg-white dark:bg-gray-700 p-3 rounded border border-gray-200 dark:border-gray-600"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {source.title}
                        </div>
                        {source.score && (
                          <span className="text-xs px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 font-semibold">
                            {(source.score * 100).toFixed(0)}% match
                          </span>
                        )}
                      </div>
                      <div className="text-gray-500 dark:text-gray-400 text-xs mb-2">
                        {[source.date, source.author, source.type].filter(Boolean).join(' · ')}
                      </div>
                      <div className="text-gray-700 dark:text-gray-300 text-xs mb-2">
                        {source.text.substring(0, 200)}...
                      </div>
                      {source.pdfUrl && (
                        <a
                          href={source.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs px-3 py-1.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white rounded transition-colors"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          View PDF
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            )}
            </div>
          );
        })}

        {isLoading && messages.length > 0 && messages[messages.length - 1].role !== "assistant" && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 p-4 rounded-r-lg">
            <div className="font-semibold mb-2 text-gray-900 dark:text-gray-100">
              I.F. Stone Bot
            </div>
            <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
              </div>
              <span>Searching archives...</span>
            </div>
          </div>
        )}
      </div>

      {/* Context Indicator & Clear Button */}
      {messages.length > 0 && (
        <div className="mb-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1 sm:gap-2 text-gray-500 dark:text-gray-400">
            <svg
              className="w-4 h-4 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
            <span className="truncate">
              Conversation active ({Math.floor(messages.length / 2)})
            </span>
          </div>
          <button
            onClick={() => setMessages([])}
            className="text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors whitespace-nowrap ml-2 px-2 py-1 sm:px-0 sm:py-0"
          >
            Clear
          </button>
        </div>
      )}

      {/* Input Form */}
      <form ref={formRef} onSubmit={handleSubmit} className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            messages.length > 0
              ? "Ask a follow-up..."
              : "Ask a question..."
          }
          className="flex-1 px-3 py-3 sm:px-4 sm:py-3 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-gray-700 dark:text-white"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="px-4 py-3 sm:px-6 sm:py-3 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm sm:text-base"
        >
          {isLoading ? "..." : "Ask"}
        </button>
      </form>

      {/* Keyboard shortcuts hint */}
      <div className="mt-2 text-xs text-gray-400 dark:text-gray-500 text-center">
        <span className="hidden sm:inline">
          <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600">⌘/Ctrl</kbd>
          {" + "}
          <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600">K</kbd>
          {" to focus • "}
          <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600">⌘/Ctrl</kbd>
          {" + "}
          <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600">Enter</kbd>
          {" to submit • "}
          <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600">Esc</kbd>
          {" to clear"}
        </span>
      </div>

    </div>
  );
}
