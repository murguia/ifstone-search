import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import ArticleReader from '../components/ArticleReader';

const source = {
  id: '1964-08-10_03',
  title: 'The Tonkin Bay Mystery',
  date: '1964-08-10',
  author: 'I.F. Stone',
  type: 'analysis',
  pdfUrl: 'https://example.com/x.pdf',
};

describe('ArticleReader', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('fetches the full text by id and renders it', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ full_text: 'First paragraph.\nSecond paragraph.' }),
    }) as unknown as typeof fetch;

    render(<ArticleReader source={source} onClose={() => {}} />);

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/article/1964-08-10_03')
    );
    await waitFor(() => expect(screen.getByText('First paragraph.')).toBeTruthy());
    expect(screen.getByText('Second paragraph.')).toBeTruthy();
    expect(screen.getByText('The Tonkin Bay Mystery')).toBeTruthy();
  });

  it('shows a fallback when the fetch fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 }) as unknown as typeof fetch;

    render(<ArticleReader source={source} onClose={() => {}} />);

    await waitFor(() =>
      expect(screen.getByText(/Couldn.t load the full text/i)).toBeTruthy()
    );
  });
});
