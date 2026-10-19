import { z } from 'zod';

import type { ApiErrorCode, Language } from '../i18n/messages';
import { parseAnalysisResult, type AnalysisResult } from '../lib/schema';

const DEFAULT_API_URL = 'http://localhost:8000';
/** The backend gives the AI up to ~40 s per call (plus one retry); allow for that and the upload. */
const ANALYZE_TIMEOUT_MS = 120_000;
const HEALTH_TIMEOUT_MS = 70_000;
const TRANSLATE_TIMEOUT_MS = 60_000;

export const API_URL = (import.meta.env.VITE_API_URL ?? DEFAULT_API_URL).replace(/\/+$/, '');

const KNOWN_CODES = new Set<string>([
  'NOT_A_PDF',
  'FILE_TOO_LARGE',
  'EMPTY_FILE',
  'PDF_UNREADABLE',
  'PDF_ENCRYPTED',
  'PDF_NO_TEXT',
  'TOO_MANY_PAGES',
  'RATE_LIMITED',
  'AI_NOT_CONFIGURED',
  'AI_UNAVAILABLE',
  'AI_TIMEOUT',
  'AI_RATE_LIMITED',
  'AI_INVALID_RESPONSE',
  'AI_REFUSED',
  'SERVER_BUSY',
  'INTERNAL_ERROR',
  'BAD_REQUEST',
  'LENGTH_REQUIRED',
] satisfies ApiErrorCode[]);

/** Sending the same file again cannot fix these. */
const NOT_RETRYABLE = new Set<ApiErrorCode>([
  'NOT_A_PDF',
  'FILE_TOO_LARGE',
  'EMPTY_FILE',
  'PDF_UNREADABLE',
  'PDF_ENCRYPTED',
  'PDF_NO_TEXT',
  'TOO_MANY_PAGES',
  'AI_REFUSED',
]);

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  /** The server's own message (Polish). The interface shows its own text for the code. */
  readonly serverMessage: string | null;
  readonly retryable: boolean;

  constructor(code: ApiErrorCode, serverMessage: string | null = null) {
    super(serverMessage ?? code);
    this.name = 'ApiError';
    this.code = code;
    this.serverMessage = serverMessage;
    this.retryable = !NOT_RETRYABLE.has(code);
  }
}

export type UploadPhase = 'upload' | 'analysis';

export interface AnalyzeOptions {
  signal?: AbortSignal;
  onPhase?: (phase: UploadPhase) => void;
  onUploadProgress?: (fraction: number) => void;
}

const errorBodySchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) });

function parseJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

function errorFromResponse(data: unknown): ApiError {
  const parsed = errorBodySchema.safeParse(data);
  if (!parsed.success) return new ApiError('HTTP_ERROR');
  const { code, message } = parsed.data.error;
  return new ApiError(KNOWN_CODES.has(code) ? (code as ApiErrorCode) : 'HTTP_ERROR', message);
}

/** Turns an HTTP status and body into a validated result or an `ApiError`. Exported for tests. */
export function interpretResponse(status: number, body: string): AnalysisResult {
  const data = parseJson(body);
  if (status < 200 || status >= 300) throw errorFromResponse(data);

  const parsed = parseAnalysisResult(data);
  if (!parsed.success) throw new ApiError('INVALID_RESULT');
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
      reject(new ApiError('ABORTED'));
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
      reject(new ApiError('NETWORK_ERROR'));
    });
    xhr.addEventListener('timeout', () => {
      cleanup();
      reject(new ApiError('TIMEOUT'));
    });
    xhr.addEventListener('abort', () => {
      cleanup();
      reject(new ApiError('ABORTED'));
    });

    const form = new FormData();
    form.append('file', file, file.name);
    onPhase?.('upload');
    xhr.send(form);
  });
}

const translationSchema = z.object({ text: z.string().min(1), targetLanguage: z.string() });

/** Translates a short text (the summary) into the interface language. */
export async function translateText(
  text: string,
  targetLanguage: Language,
  signal?: AbortSignal,
): Promise<string> {
  const timeout = AbortSignal.timeout(TRANSLATE_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, targetLanguage }),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch {
    if (signal?.aborted) throw new ApiError('ABORTED');
    throw new ApiError(timeout.aborted ? 'TIMEOUT' : 'NETWORK_ERROR');
  }

  const data = parseJson(await response.text());
  if (!response.ok) throw errorFromResponse(data);
  const parsed = translationSchema.safeParse(data);
  if (!parsed.success || parsed.data.targetLanguage !== targetLanguage) {
    throw new ApiError('INVALID_RESULT');
  }
  return parsed.data.text;
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
