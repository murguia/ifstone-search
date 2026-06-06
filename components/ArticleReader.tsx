'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatPages } from '@/lib/pages';

export interface ReaderSource {
  id: string;
  title: string;
  date?: string;
  author?: string;
  type?: string;
  pages?: number[];
  pdfUrl?: string;
}

// Modal reader for a full article. The chat response only carries a snippet,
// so the complete text is fetched from /api/article/[id] when this opens.
export default function ArticleReader({
  source,
  onClose,
}: {
  source: ReaderSource;
  onClose: () => void;
}) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setText(null);
    setError(false);
    fetch(`/api/article/${encodeURIComponent(source.id)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        if (!cancelled) setText(d.full_text || '');
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [source.id]);

  const meta = [source.date, source.author, source.type, formatPages(source.pages)]
    .filter(Boolean)
    .join(' · ');

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-y-auto">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-[101] flex items-start justify-center min-h-full p-4 pt-16 pointer-events-none">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl max-w-2xl w-full p-6 shadow-xl mb-8 pointer-events-auto">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1 pr-8">
            {source.title}
          </h2>
          {meta && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-4">{meta}</div>
          )}

          <div className="max-h-[68vh] overflow-y-auto">
            {text === null && !error && (
              <div className="flex items-center gap-2 text-gray-400 py-8 justify-center">
                <span className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <span className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                <span className="text-sm ml-1">Loading article…</span>
              </div>
            )}

            {error && (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-6">
                Couldn&apos;t load the full text.{' '}
                {source.pdfUrl && (
                  <a
                    href={source.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-600 dark:text-amber-400 underline"
                  >
                    View the original PDF
                  </a>
                )}
              </p>
            )}

            {text !== null && (
              <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed space-y-3">
                {text.split('\n').filter(Boolean).map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            )}
          </div>

          {source.pdfUrl && (
            <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
              <a
                href={source.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors inline-flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                View original PDF
              </a>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
