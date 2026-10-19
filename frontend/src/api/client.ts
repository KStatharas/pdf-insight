import { parseAnalysisResult, type AnalysisResult } from '../lib/schema';

const DEFAULT_API_URL = 'http://localhost:8000';
/** The backend gives the AI up to ~40 s per call (plus one retry); allow for that and the upload. */
const ANALYZE_TIMEOUT_MS = 120_000;
const HEALTH_TIMEOUT_MS = 70_000;

export const API_URL = (import.meta.env.VITE_API_URL ?? DEFAULT_API_URL).replace(/\/+$/, '');

export class ApiError extends Error {
  readonly code: string;
  /** False when sending the same file again cannot help (wrong type, too large, no text). */
  readonly retryable: boolean;

  constructor(code: string, message: string, retryable: boolean) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.retryable = retryable;
  }
}

const NOT_RETRYABLE = new Set([
  'NOT_A_PDF',
  'FILE_TOO_LARGE',
  'EMPTY_FILE',
  'PDF_UNREADABLE',
  'PDF_ENCRYPTED',
  'PDF_NO_TEXT',
  'TOO_MANY_PAGES',
  'AI_REFUSED',
]);

export type UploadPhase = 'upload' | 'analysis';

export interface AnalyzeOptions {
  signal?: AbortSignal;
  onPhase?: (phase: UploadPhase) => void;
  onUploadProgress?: (fraction: number) => void;
}

interface ErrorBody {
  error: { code: string; message: string };
}

function isErrorBody(value: unknown): value is ErrorBody {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false;
  const error: unknown = value.error;
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    typeof error.code === 'string' &&
    typeof error.message === 'string'
  );
}

/** Turns an HTTP status and body into a validated result or an `ApiError`. Exported for tests. */
export function interpretResponse(status: number, body: string): AnalysisResult {
  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    data = undefined;
  }

  if (status < 200 || status >= 300) {
    if (isErrorBody(data)) {
      throw new ApiError(data.error.code, data.error.message, !NOT_RETRYABLE.has(data.error.code));
    }
    throw new ApiError(
      'HTTP_ERROR',
      `Serwer zwrócił nieoczekiwany błąd (kod ${status}). Spróbuj ponownie.`,
      true,
    );
  }

  const parsed = parseAnalysisResult(data);
  if (!parsed.success) {
    throw new ApiError(
      'INVALID_RESULT',
      'Odpowiedź serwera nie jest zgodna ze schematem wyniku. Spróbuj ponownie.',
      true,
    );
  }
  return parsed.data;
}

/**
 * Sends the PDF to the backend. XMLHttpRequest is used instead of fetch because only XHR
 * reports upload progress.
 */
export function analyzePdf(file: File, options: AnalyzeOptions = {}): Promise<AnalysisResult> {
  const { signal, onPhase, onUploadProgress } = options;

  return new Promise<AnalysisResult>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new ApiError('ABORTED', 'Analizę anulowano.', true));
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}/api/analyze`);
    xhr.timeout = ANALYZE_TIMEOUT_MS;

    const onAbort = (): void => {
      xhr.abort();
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    const cleanup = (): void => {
      signal?.removeEventListener('abort', onAbort);
    };

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && event.total > 0) onUploadProgress?.(event.loaded / event.total);
    });
    xhr.upload.addEventListener('load', () => {
      onUploadProgress?.(1);
      onPhase?.('analysis');
    });

    xhr.addEventListener('load', () => {
      cleanup();
      try {
        resolve(interpretResponse(xhr.status, xhr.responseText));
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
    xhr.addEventListener('error', () => {
      cleanup();
      reject(
        new ApiError(
          'NETWORK_ERROR',
          'Nie udało się połączyć z serwerem. Sprawdź połączenie z internetem i spróbuj ponownie.',
          true,
        ),
      );
    });
    xhr.addEventListener('timeout', () => {
      cleanup();
      reject(new ApiError('TIMEOUT', 'Serwer nie odpowiedział na czas. Spróbuj ponownie.', true));
    });
    xhr.addEventListener('abort', () => {
      cleanup();
      reject(new ApiError('ABORTED', 'Analizę anulowano.', true));
    });

    const form = new FormData();
    form.append('file', file, file.name);
    onPhase?.('upload');
    xhr.send(form);
  });
}

export type HealthStatus = 'ready' | 'not-configured' | 'offline';

/** Pings the backend. On free hosting this also wakes a sleeping server before the upload. */
export async function checkHealth(signal?: AbortSignal): Promise<HealthStatus> {
  const timeout = AbortSignal.timeout(HEALTH_TIMEOUT_MS);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  try {
    const response = await fetch(`${API_URL}/api/health`, { signal: combined });
    if (!response.ok) return 'offline';
    const body: unknown = await response.json();
    const configured =
      typeof body === 'object' &&
      body !== null &&
      'aiConfigured' in body &&
      body.aiConfigured === true;
    return configured ? 'ready' : 'not-configured';
  } catch {
    return 'offline';
  }
}
