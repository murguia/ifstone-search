export interface HistoryEntry {
  id: string;
  question: string;
  answer: string;
  sources: Array<{
    text: string;
    year: string;
    filename: string;
    pdfUrl?: string;
    score?: number;
  }>;
  timestamp: number;
}

const MAX_HISTORY_ITEMS = 50;
const STORAGE_KEY = 'ifstone_search_history';

export function saveToHistory(entry: Omit<HistoryEntry, 'id' | 'timestamp'>): HistoryEntry {
  const history = getHistory();

  const newEntry: HistoryEntry = {
    ...entry,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  };

  // Add to beginning
  history.unshift(newEntry);

  // Limit to MAX_HISTORY_ITEMS
  const trimmedHistory = history.slice(0, MAX_HISTORY_ITEMS);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedHistory));
  } catch (error) {
    console.error('Error saving to history:', error);
    // If quota exceeded, try removing old entries
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      const reducedHistory = history.slice(0, Math.floor(MAX_HISTORY_ITEMS / 2));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reducedHistory));
    }
  }

  return newEntry;
}

export function getHistory(): HistoryEntry[] {
  if (typeof window === 'undefined') return [];

  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error reading history:', error);
    return [];
  }
}

export function clearHistory(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

export function deleteHistoryEntry(id: string): void {
  const history = getHistory();
  const filtered = history.filter(entry => entry.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return new Date(timestamp).toLocaleDateString();
}

export function groupHistoryByDate(history: HistoryEntry[]): Record<string, HistoryEntry[]> {
  return history.reduce((groups, entry) => {
    const date = new Date(entry.timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const daysDiff = Math.floor((today.getTime() - date.getTime()) / 86400000);

    let key: string;
    if (date.toDateString() === today.toDateString()) {
      key = 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      key = 'Yesterday';
    } else if (daysDiff < 7) {
      key = 'This Week';
    } else {
      key = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }

    if (!groups[key]) groups[key] = [];
    groups[key].push(entry);
    return groups;
  }, {} as Record<string, HistoryEntry[]>);
}
