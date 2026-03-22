"use client";

import { ChatInterface } from "@/components/ChatInterface";
import AboutSection from "@/components/AboutSection";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <header className="border-b border-amber-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  I.F. Stone&apos;s Weekly
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  AI-Powered Search (1953-1971)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline text-xs text-gray-400 dark:text-gray-500">
                1953 &middot; 47 issues &middot; ~200 articles
              </span>
              <AboutSection />
            </div>
          </div>
        </div>
      </header>

      <ChatInterface />

      <footer className="border-t border-amber-200 dark:border-gray-700 py-4">
        <div className="max-w-4xl mx-auto px-4 text-center text-xs text-gray-500 dark:text-gray-400 space-y-1">
          <p>
            Archive courtesy of{' '}
            <a href="https://www.ifstone.org" target="_blank" rel="noopener noreferrer" className="text-amber-600 dark:text-amber-400 hover:underline">ifstone.org</a>.
            Use of these Weeklys for non-commercial purposes is authorized by the I.F. Stone family.
          </p>
          <p>
            The I.F. Stone heirs thank Ron Unz for scanning the newsletters and sharing the material.
          </p>
        </div>
      </footer>
    </main>
  );
}
