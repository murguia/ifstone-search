"use client";

import { useState, useEffect } from "react";

interface ArticleViewerProps {
  filename: string;
  year: string;
  onClose: () => void;
  highlightTerms?: string[];
}

export function ArticleViewer({
  filename,
  year,
  onClose,
  highlightTerms = [],
}: ArticleViewerProps) {
  const [content, setContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadArticle = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Convert PDF filename to TXT filename
        const txtFilename = filename.replace('.pdf', '.txt');
        const articlePath = `/articles/${year}/${txtFilename}`;

        const response = await fetch(articlePath);

        if (!response.ok) {
          throw new Error(`Failed to load article: ${response.statusText}`);
        }

        const text = await response.text();
        setContent(text);
      } catch (err) {
        console.error('Error loading article:', err);
        setError(err instanceof Error ? err.message : 'Failed to load article');
      } finally {
        setIsLoading(false);
      }
    };

    loadArticle();
  }, [filename, year]);

  // Simple highlight function
  const highlightText = (text: string): string => {
    if (highlightTerms.length === 0) return text;

    let highlightedText = text;
    highlightTerms.forEach((term) => {
      const regex = new RegExp(`(${term})`, 'gi');
      highlightedText = highlightedText.replace(
        regex,
        '<mark class="bg-yellow-200 dark:bg-yellow-600">$1</mark>'
      );
    });
    return highlightedText;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {filename}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Year: {year}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Close"
          >
            <svg
              className="w-6 h-6 text-gray-600 dark:text-gray-400"
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
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-gray-600 dark:text-gray-400">
                  Loading article...
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg
                  className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div>
                  <h3 className="font-semibold text-red-800 dark:text-red-300">
                    Error Loading Article
                  </h3>
                  <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                    {error}
                  </p>
                </div>
              </div>
            </div>
          )}

          {!isLoading && !error && content && (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <pre
                className="whitespace-pre-wrap font-sans text-gray-800 dark:text-gray-200 leading-relaxed"
                dangerouslySetInnerHTML={{
                  __html: highlightText(content),
                }}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {highlightTerms.length > 0 && (
              <span>
                Highlighting: {highlightTerms.join(', ')}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
