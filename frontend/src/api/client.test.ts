import { afterEach, describe, expect, it, vi } from 'vitest';

import { sampleResult } from '../test/fixtures';
import { ApiError, interpretResponse, translateTexts } from './client';

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

describe('translateTexts', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('posts all texts and returns the validated translations', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ texts: ['The contract.', 'Go-live'], targetLanguage: 'en' })),
      );

    await expect(translateTexts(['Umowa.', 'Go-live'], 'en')).resolves.toEqual([
      'The contract.',
      'Go-live',
    ]);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(typeof url === 'string' ? url : '').toMatch(/\/api\/translate$/);
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe(JSON.stringify({ texts: ['Umowa.', 'Go-live'], targetLanguage: 'en' }));
  });

  it('rejects a reply for another language or with a different number of texts', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ texts: ['a'], targetLanguage: 'pl' })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ texts: ['a'], targetLanguage: 'en' })));
    await expect(translateTexts(['a'], 'en')).rejects.toMatchObject({ code: 'INVALID_RESULT' });
    await expect(translateTexts(['a', 'b'], 'en')).rejects.toMatchObject({
      code: 'INVALID_RESULT',
    });
  });

  it('turns server errors and network failures into ApiError', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { code: 'RATE_LIMITED', message: 'Za dużo.' } }), {
          status: 429,
        }),
      )
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(translateTexts(['a'], 'en')).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    await expect(translateTexts(['a'], 'en')).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });
});
