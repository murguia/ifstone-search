"use client";

import { ChatInterface } from "@/components/ChatInterface";
import AboutSection from "@/components/AboutSection";

export default function Home() {
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
              <div className="mt-3 flex flex-col items-center gap-2">
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  <p><strong>Currently searchable:</strong> 1953 (47 issues, ~200 articles)</p>
                  <p><strong>Full archive:</strong> 1953–1971 (770 issues) — more years coming soon</p>
                </div>
                <AboutSection />
              </div>
            </header>

            <ChatInterface />

            <footer className="mt-12 text-center text-xs text-gray-500 dark:text-gray-400 space-y-2">
              <p>
                Archive courtesy of{' '}
                <a href="https://www.ifstone.org" target="_blank" rel="noopener noreferrer" className="text-amber-600 dark:text-amber-400 hover:underline">ifstone.org</a>.
                Use of these Weeklys for non-commercial purposes is authorized by the I.F. Stone family.
              </p>
              <p>
                The I.F. Stone heirs thank Ron Unz for scanning the newsletters and sharing the material.
              </p>
            </footer>
          </div>
        </div>
      </div>

    </main>
  );
}
