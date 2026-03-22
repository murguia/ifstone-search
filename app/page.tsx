"use client";

import { useState, useEffect } from "react";
import { ChatInterface, Message } from "@/components/ChatInterface";
import { TopicBrowser } from "@/components/TopicBrowser";

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
  const [isTopicBrowserOpen, setIsTopicBrowserOpen] = useState(false);
  const [indexEntries, setIndexEntries] = useState<IndexEntry[]>([]);

  useEffect(() => {
    fetch('/data/index-database.json')
      .then((res) => res.json())
      .then((data) => {
        setIndexEntries(data.entries || []);
      })
      .catch((err) => {
        console.error('Failed to load index database:', err);
      });
  }, []);

  return (
    <main className="min-h-screen flex bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="container mx-auto px-4 py-8 max-w-4xl">
            <header className="text-center mb-8">
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
                I.F. Stone&apos;s Weekly
              </h1>
              <p className="text-base lg:text-lg text-gray-700 dark:text-gray-300 mb-2">
                AI-Powered Search Engine
              </p>
              <p className="text-xs lg:text-sm text-gray-600 dark:text-gray-400">
                Explore 18 years of investigative journalism (1953-1971)
              </p>
              <div className="mt-4 flex flex-wrap gap-2 justify-center">
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

            <ChatInterface />

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
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-50"
            onClick={() => setIsTopicBrowserOpen(false)}
          />
          <div className="fixed inset-4 md:inset-8 lg:inset-16 z-50 flex items-center justify-center">
            <div className="w-full h-full max-w-5xl">
              <TopicBrowser
                entries={indexEntries}
                onTopicSelect={(entry) => {
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
