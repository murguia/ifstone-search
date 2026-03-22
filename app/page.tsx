"use client";

import { useState, useEffect } from "react";
import { ChatInterface, Message } from "@/components/ChatInterface";
import { HistorySidebar } from "@/components/HistorySidebar";
import { TopicBrowser } from "@/components/TopicBrowser";
import { getHistory, HistoryEntry } from "@/lib/history";

interface IndexEntry {
  topic: string;
  year: number;
  filename: string;
  articles: Array<{
    title?: string;
    description: string;
    reference: string;
  }>;
  rawText: string;
}

export default function Home() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [selectedMessages, setSelectedMessages] = useState<Message[] | undefined>(undefined);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isTopicBrowserOpen, setIsTopicBrowserOpen] = useState(false);
  const [indexEntries, setIndexEntries] = useState<IndexEntry[]>([]);

  // Load history and index database on mount
  useEffect(() => {
    setHistory(getHistory());

    // Load index database
    fetch('/data/index-database.json')
      .then((res) => res.json())
      .then((data) => {
        setIndexEntries(data.entries || []);
      })
      .catch((err) => {
        console.error('Failed to load index database:', err);
      });
  }, []);

  const handleHistoryUpdate = () => {
    setHistory(getHistory());
  };

  const handleSelectHistoryEntry = (entry: HistoryEntry) => {
    setSelectedMessages([
      { role: "user", content: entry.question },
      { role: "assistant", content: entry.answer, sources: entry.sources },
    ]);
    setIsSidebarOpen(false); // Close sidebar on mobile after selection
  };

  const handleNewSearch = () => {
    setSelectedMessages(undefined);
  };

  return (
    <main className="min-h-screen flex bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Mobile backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* History Sidebar */}
      <div
        className={`
          fixed lg:static inset-y-0 left-0 z-50 lg:z-auto
          transform ${isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          transition-transform duration-300 ease-in-out
        `}
      >
        <HistorySidebar
          history={history}
          onSelectEntry={handleSelectHistoryEntry}
          onHistoryChange={handleHistoryUpdate}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header with menu button */}
        <div className="lg:hidden sticky top-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Toggle menu"
          >
            <svg
              className="w-6 h-6 text-gray-600 dark:text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">
            I.F. Stone&apos;s Weekly
          </h1>
          <div className="w-10" /> {/* Spacer for centering */}
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="container mx-auto px-4 py-8 max-w-4xl">
            <header className="text-center mb-8">
              <h1 className="hidden lg:block text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
                I.F. Stone&apos;s Weekly
              </h1>
              <p className="text-base lg:text-lg text-gray-700 dark:text-gray-300 mb-2">
                AI-Powered Search Engine
              </p>
              <p className="text-xs lg:text-sm text-gray-600 dark:text-gray-400">
                Explore 18 years of investigative journalism (1953-1971)
              </p>
              <div className="mt-4 flex flex-wrap gap-2 justify-center">
                {selectedMessages && (
                  <button
                    onClick={handleNewSearch}
                    className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white rounded-lg transition-colors"
                  >
                    + New Search
                  </button>
                )}
                <button
                  onClick={() => setIsTopicBrowserOpen(true)}
                  className="px-4 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 active:bg-gray-100 dark:active:bg-gray-500 rounded-lg transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  Browse Topics ({indexEntries.length})
                </button>
              </div>
            </header>

            <ChatInterface
              initialMessages={selectedMessages}
              onHistoryUpdate={handleHistoryUpdate}
            />

            <footer className="mt-12 text-center text-sm text-gray-600 dark:text-gray-400">
              <p>
                Powered by OpenAI embeddings and semantic search. Ask questions
                about I.F. Stone&apos;s reporting on civil rights, war, politics, and more.
              </p>
            </footer>
          </div>
        </div>
      </div>

      {/* Topic Browser Modal */}
      {isTopicBrowserOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-50"
            onClick={() => setIsTopicBrowserOpen(false)}
          />

          {/* Modal */}
          <div className="fixed inset-4 md:inset-8 lg:inset-16 z-50 flex items-center justify-center">
            <div className="w-full h-full max-w-5xl">
              <TopicBrowser
                entries={indexEntries}
                onTopicSelect={(entry) => {
                  // You could optionally pre-fill a question about this topic
                  console.log('Selected topic:', entry.topic, entry.year);
                }}
              />
            </div>
          </div>
        </>
      )}
    </main>
  );
}
