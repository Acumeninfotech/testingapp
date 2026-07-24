import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchUniversities } from './client';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('api client', () => {
  it('times out university loading instead of leaving the UI waiting forever', async () => {
    vi.useFakeTimers();
    vi.spyOn(window, 'fetch').mockImplementation((_input, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Request timed out', 'AbortError'));
        });
      });
    });

    const request = fetchUniversities();
    const assertion = expect(request).rejects.toThrow(/aborted|timed out/i);
    await vi.advanceTimersByTimeAsync(10_000);

    await assertion;
  });
});
