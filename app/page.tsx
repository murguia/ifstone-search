"use client";

import { ChatInterface } from "@/components/ChatInterface";
import AboutSection from "@/components/AboutSection";
import { COVERAGE, COVERAGE_RANGE } from "@/lib/coverage";

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
                {COVERAGE_RANGE} &middot; {COVERAGE.issues} issues &middot; {COVERAGE.articles.toLocaleString()} articles
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
          <p className="pt-2">
            Built by{' '}
            <a href="https://murguia.org" target="_blank" rel="noopener noreferrer" className="text-amber-600 dark:text-amber-400 hover:underline">Raul Murguia</a>{' '}
            <a
              href="https://github.com/murguia/ifstone-search"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block align-middle text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label="GitHub repository"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
            </a>
          </p>
        </div>
      </footer>
    </main>
  );
}
