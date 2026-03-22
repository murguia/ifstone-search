'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

function AboutModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-y-auto">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-[101] flex items-start justify-center min-h-full p-4 pt-24 pointer-events-none">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl max-w-lg w-full p-6 shadow-xl mb-8 pointer-events-auto">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            How This Search Works
          </h2>

          <div className="space-y-4 text-sm text-gray-600 dark:text-gray-300">
            <p>
              This app lets you explore I.F. Stone&apos;s Weekly using natural
              language. Instead of keyword search, it uses{' '}
              <span className="text-amber-600 dark:text-amber-400">semantic search</span>{' '}
              to find articles by meaning.
            </p>

            <div className="space-y-3">
              <div className="flex gap-3">
                <span className="bg-amber-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <p>
                  Your question is converted into a vector embedding that
                  captures its semantic meaning.
                </p>
              </div>
              <div className="flex gap-3">
                <span className="bg-amber-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <p>
                  The embedding is matched against article chunks in a vector
                  database to find the most relevant passages. Results are boosted
                  when they match topics from Stone&apos;s own annual index.
                </p>
              </div>
              <div className="flex gap-3">
                <span className="bg-amber-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <p>
                  An AI model synthesizes an answer grounded in those articles,
                  with citations you can verify against the original PDFs.
                </p>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h3 className="text-gray-800 dark:text-gray-200 font-medium mb-2">About the Weekly</h3>
              <p>
                I.F. Stone&apos;s Weekly (1953&ndash;1971) was one of the most
                influential independent political newsletters in American
                journalism. Stone was known for his meticulous reading of
                government documents and his fearless criticism of official
                narratives on McCarthyism, the Korean War, civil rights,
                Vietnam, and nuclear weapons policy.
              </p>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h3 className="text-gray-800 dark:text-gray-200 font-medium mb-2">Data source</h3>
              <p>
                The PDFs are from the{' '}
                <a
                  href="https://www.ifstone.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-600 dark:text-amber-400 hover:text-amber-500 underline"
                >
                  ifstone.org
                </a>{' '}
                archive. Each issue was converted into individual article chunks
                using a vision-language model pipeline, then reviewed for accuracy
                before indexing.
              </p>
            </div>

            <p className="text-gray-400 dark:text-gray-500 text-xs pt-2">
              Responses are AI-generated from historical documents and may
              contain errors. Always verify against the original PDFs.
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function AboutSection() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="text-gray-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors text-sm flex items-center gap-1"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        How it works
      </button>

      {isOpen && <AboutModal onClose={() => setIsOpen(false)} />}
    </>
  );
}
