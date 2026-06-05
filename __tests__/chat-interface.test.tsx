import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ChatInterface } from '../components/ChatInterface';

// Minimal stand-in for the streaming Response the chat route returns: a body
// whose reader yields the given newline-delimited JSON lines, then done.
function streamResponse(lines: string[]) {
  const encoder = new TextEncoder();
  const chunks = lines.map((l) => encoder.encode(l + '\n'));
  let i = 0;
  return {
    ok: true,
    body: {
      getReader: () => ({
        read: async () =>
          i < chunks.length
            ? { done: false, value: chunks[i++] }
            : { done: true, value: undefined },
      }),
    },
  };
}

describe('ChatInterface sample questions', () => {
  beforeEach(() => {
    // jsdom doesn't implement scrollIntoView; the auto-scroll effect calls it.
    Element.prototype.scrollIntoView = vi.fn();
    global.fetch = vi.fn().mockResolvedValue(
      streamResponse([
        JSON.stringify({ type: 'content', content: 'Stone attacked McCarthy.' }),
      ])
    ) as unknown as typeof fetch;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('submits the search (with its author filter) when a sample question is clicked', async () => {
    render(<ChatInterface />);

    fireEvent.click(
      screen.getByRole('button', {
        name: /What did I\.F\. Stone write about McCarthy\?/i,
      })
    );

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('/api/chat');

    const body = JSON.parse(init.body);
    expect(body.question).toBe('What did I.F. Stone write about McCarthy?');
    expect(body.filters).toEqual({ author: 'I.F. Stone' });

    // The streamed answer renders, proving the full submit→stream→render path.
    await waitFor(() =>
      expect(screen.getByText('Stone attacked McCarthy.')).toBeTruthy()
    );
  });
});
