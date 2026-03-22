"use client";

import { useState, useMemo } from "react";

interface IndexArticle {
  title?: string;
  description: string;
  reference: string;
  issueNumber?: number;
  pageNumber?: string;
  date?: string;
}

interface IndexEntry {
  topic: string;
  year: number;
  filename: string;
  articles: IndexArticle[];
  rawText: string;
}

interface TopicBrowserProps {
  entries: IndexEntry[];
  onTopicSelect?: (entry: IndexEntry) => void;
}

export function TopicBrowser({ entries, onTopicSelect }: TopicBrowserProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedYear, setSelectedYear] = useState<number | "all">("all");
  const [selectedTopic, setSelectedTopic] = useState<IndexEntry | null>(null);

  // Get unique years
  const years = useMemo(() => {
    const uniqueYears = Array.from(new Set(entries.map((e) => e.year))).sort();
    return uniqueYears;
  }, [entries]);

  // Filter topics
  const filteredTopics = useMemo(() => {
    return entries.filter((entry) => {
      const matchesSearch = entry.topic
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesYear =
        selectedYear === "all" || entry.year === selectedYear;
      return matchesSearch && matchesYear;
    });
  }, [entries, searchQuery, selectedYear]);

  // Group by first letter
  const groupedTopics = useMemo(() => {
    const groups: Record<string, IndexEntry[]> = {};
    filteredTopics.forEach((entry) => {
      const firstLetter = entry.topic[0].toUpperCase();
      if (!groups[firstLetter]) {
        groups[firstLetter] = [];
      }
      groups[firstLetter].push(entry);
    });
    return groups;
  }, [filteredTopics]);

  const handleTopicClick = (entry: IndexEntry) => {
    setSelectedTopic(entry);
    onTopicSelect?.(entry);
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
          Browse Topics
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {entries.length} topics from I.F. Stone's Weekly Index (1953-1971)
        </p>

        {/* Search */}
        <input
          type="text"
          placeholder="Search topics..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-gray-700 dark:text-white mb-3"
        />

        {/* Year filter */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedYear("all")}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
              selectedYear === "all"
                ? "bg-amber-500 text-white"
                : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            All Years
          </button>
          {years.map((year) => (
            <button
              key={year}
              onClick={() => setSelectedYear(year)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                selectedYear === year
                  ? "bg-amber-500 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
            >
              {year}
            </button>
          ))}
        </div>

        {/* Results count */}
        <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          {filteredTopics.length} topic{filteredTopics.length !== 1 ? "s" : ""} found
        </div>
      </div>

      {/* Topics List */}
      <div className="flex-1 overflow-y-auto p-4">
        {Object.keys(groupedTopics).length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            No topics found
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedTopics)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([letter, topics]) => (
                <div key={letter}>
                  <h3 className="text-sm font-bold text-amber-600 dark:text-amber-400 mb-2 sticky top-0 bg-white dark:bg-gray-800 py-1">
                    {letter}
                  </h3>
                  <div className="space-y-1">
                    {topics
                      .sort((a, b) => a.topic.localeCompare(b.topic))
                      .map((entry, idx) => (
                        <button
                          key={`${entry.topic}-${entry.year}-${idx}`}
                          onClick={() => handleTopicClick(entry)}
                          className={`w-full text-left p-3 rounded-lg transition-colors ${
                            selectedTopic?.topic === entry.topic &&
                            selectedTopic?.year === entry.year
                              ? "bg-amber-100 dark:bg-amber-900/30 border-l-4 border-amber-500"
                              : "hover:bg-gray-50 dark:hover:bg-gray-700 border-l-4 border-transparent"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {entry.topic}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {entry.year} • {entry.articles.length} article
                                {entry.articles.length !== 1 ? "s" : ""}
                              </div>
                            </div>
                            <svg
                              className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                          </div>
                        </button>
                      ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Selected Topic Details */}
      {selectedTopic && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900 max-h-64 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-900 dark:text-white">
              {selectedTopic.topic} ({selectedTopic.year})
            </h3>
            <button
              onClick={() => setSelectedTopic(null)}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              <svg
                className="w-4 h-4 text-gray-500"
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

          <div className="space-y-2">
            {selectedTopic.articles.map((article, idx) => (
              <div
                key={idx}
                className="text-xs bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    {article.title && (
                      <div className="font-medium text-gray-900 dark:text-white mb-1">
                        "{article.title}"
                      </div>
                    )}
                    <div className="text-gray-600 dark:text-gray-400">
                      {article.description}
                    </div>
                  </div>
                  <div className="flex-shrink-0 px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded font-mono text-xs">
                    {article.reference}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
