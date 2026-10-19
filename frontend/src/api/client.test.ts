import { describe, expect, it } from 'vitest';

import { sampleResult } from '../test/fixtures';
import { ApiError, interpretResponse } from './client';

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
    expect(error.message).toBe('Plik za duży.');
    expect(error.retryable).toBe(false);
  });

  it('marks temporary server errors as retryable', () => {
    const body = JSON.stringify({ error: { code: 'AI_TIMEOUT', message: 'Za długo.' } });
    expect(catchError(() => interpretResponse(504, body)).retryable).toBe(true);
  });

  it('handles non-JSON error pages', () => {
    const error = catchError(() => interpretResponse(502, '<html>Bad gateway</html>'));
    expect(error.code).toBe('HTTP_ERROR');
    expect(error.message).toContain('502');
  });
});
