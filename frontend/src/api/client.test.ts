import { afterEach, describe, expect, it, vi } from 'vitest';

import { sampleResult } from '../test/fixtures';
import { ApiError, interpretResponse, translateText } from './client';

function catchError(fn: () => unknown): ApiError {
  try {
    fn();
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('expected an ApiError');
}

describe('interpretResponse', () => {
  it('returns a validated result for a 200 response', () => {
    const result = interpretResponse(200, JSON.stringify(sampleResult()));
    expect(result.document.type).toBe('umowa');
  });

  it('rejects a 200 response that breaks the schema', () => {
    const body = JSON.stringify({ ...sampleResult(), keyPoints: [] });
    const error = catchError(() => interpretResponse(200, body));
    expect(error.code).toBe('INVALID_RESULT');
    expect(error.retryable).toBe(true);
  });

  it('passes on the server error message', () => {
    const body = JSON.stringify({ error: { code: 'FILE_TOO_LARGE', message: 'Plik za duży.' } });
    const error = catchError(() => interpretResponse(413, body));
    expect(error.code).toBe('FILE_TOO_LARGE');
    expect(error.serverMessage).toBe('Plik za duży.');
    expect(error.retryable).toBe(false);
  });

  it('marks temporary server errors as retryable', () => {
    const body = JSON.stringify({ error: { code: 'AI_TIMEOUT', message: 'Za długo.' } });
    expect(catchError(() => interpretResponse(504, body)).retryable).toBe(true);
  });

  it('handles non-JSON error pages', () => {
    const error = catchError(() => interpretResponse(502, '<html>Bad gateway</html>'));
    expect(error.code).toBe('HTTP_ERROR');
    expect(error.serverMessage).toBeNull();
  });

  it('maps unknown server codes to a generic error but keeps the message', () => {
    const body = JSON.stringify({ error: { code: 'SOMETHING_NEW', message: 'Coś nowego.' } });
    const error = catchError(() => interpretResponse(500, body));
    expect(error.code).toBe('HTTP_ERROR');
    expect(error.serverMessage).toBe('Coś nowego.');
  });
});

describe('translateText', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('posts the text and returns the validated translation', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ text: 'The contract.', targetLanguage: 'en' })),
      );

    await expect(translateText('Umowa.', 'en')).resolves.toBe('The contract.');
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(typeof url === 'string' ? url : '').toMatch(/\/api\/translate$/);
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe(JSON.stringify({ text: 'Umowa.', targetLanguage: 'en' }));
  });

  it('rejects a reply for another language', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ text: 'Umowa.', targetLanguage: 'pl' })),
    );
    await expect(translateText('Umowa.', 'en')).rejects.toMatchObject({ code: 'INVALID_RESULT' });
  });

  it('turns server errors and network failures into ApiError', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { code: 'RATE_LIMITED', message: 'Za dużo.' } }), {
          status: 429,
        }),
      )
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(translateText('a', 'en')).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    await expect(translateText('a', 'en')).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });
});
