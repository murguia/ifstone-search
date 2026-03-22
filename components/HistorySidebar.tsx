"use client";

import { useState } from "react";
import {
  HistoryEntry,
  clearHistory,
  deleteHistoryEntry,
  formatRelativeTime,
  groupHistoryByDate,
} from "@/lib/history";

interface HistorySidebarProps {
  history: HistoryEntry[];
  onSelectEntry: (entry: HistoryEntry) => void;
  onHistoryChange: () => void;
}

export function HistorySidebar({
  history,
  onSelectEntry,
  onHistoryChange,
}: HistorySidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const filteredHistory = history.filter((entry) =>
    entry.question.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedHistory = groupHistoryByDate(filteredHistory);

  const handleClearHistory = () => {
    clearHistory();
    onHistoryChange();
    setShowClearConfirm(false);
  };

  const handleDeleteEntry = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteHistoryEntry(id);
    onHistoryChange();
  };

  return (
    <aside className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Search History
          </h2>
          {history.length > 0 && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="text-sm px-2 py-1 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 active:bg-red-50 dark:active:bg-red-900/20 rounded transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* Search */}
        {history.length > 0 && (
          <input
            type="text"
            placeholder="Search history..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-gray-700 dark:text-white"
          />
        )}
      </div>

      {/* Clear Confirmation */}
      {showClearConfirm && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
          <p className="text-sm text-red-800 dark:text-red-300 mb-3">
            Clear all search history? This cannot be undone.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleClearHistory}
              className="flex-1 px-3 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 active:bg-red-800"
            >
              Clear All
            </button>
            <button
              onClick={() => setShowClearConfirm(false)}
              className="flex-1 px-3 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600 active:bg-gray-400 dark:active:bg-gray-500"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* History List */}
      <div className="flex-1 overflow-y-auto p-4">
        {history.length === 0 ? (
          <div className="text-center py-12">
            <svg
              className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600 mb-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No search history yet
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Your searches will appear here
            </p>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No results for &quot;{searchQuery}&quot;
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedHistory).map(([dateLabel, entries]) => (
              <div key={dateLabel}>
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  {dateLabel}
                </h3>
                <div className="space-y-1">
                  {entries.map((entry) => (
                    <div
                      key={entry.id}
                      className="group relative"
                    >
                      <button
                        onClick={() => onSelectEntry(entry)}
                        className="w-full text-left p-3 sm:p-3 py-3.5 sm:py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 active:bg-gray-100 dark:active:bg-gray-600 transition-colors"
                      >
                        <div className="text-sm font-medium text-gray-900 dark:text-white mb-1 pr-8 sm:pr-6 line-clamp-2">
                          {entry.question}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                          <span>{formatRelativeTime(entry.timestamp)}</span>
                          {entry.sources.length > 0 && (
                            <>
                              <span>•</span>
                              <span>{entry.sources.length} sources</span>
                            </>
                          )}
                        </div>
                      </button>
                      <button
                        onClick={(e) => handleDeleteEntry(entry.id, e)}
                        className="absolute top-2.5 right-2 opacity-100 sm:opacity-0 group-hover:opacity-100 p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-600 active:bg-gray-300 dark:active:bg-gray-500 transition-opacity"
                        title="Delete"
                      >
                        <svg
                          className="w-5 h-5 text-gray-500 dark:text-gray-400"
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
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      {history.length > 0 && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
          {history.length} {history.length === 1 ? "search" : "searches"} saved
        </div>
      )}
    </aside>
  );
}
