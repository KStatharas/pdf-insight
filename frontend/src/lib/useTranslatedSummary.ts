import { useEffect, useState } from 'react';

import { ApiError, translateText } from '../api/client';
import type { Language } from '../i18n/messages';
import type { AnalysisResult } from './schema';

export const TRANSLATION_CACHE_KEY = 'pdf-insight:translations:v1';
const CACHE_LIMIT = 40;

type Cache = Record<string, string>;

function cacheKey(language: Language, text: string): string {
  return `${language}\u0000${text}`;
}

/** Translations are kept in the browser so switching back and forth costs one request. */
const memory = new Map<string, string>();

function readCache(): Cache {
  try {
    const raw = localStorage.getItem(TRANSLATION_CACHE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    );
  } catch {
    return {};
  }
}

function lookup(key: string): string | undefined {
  return memory.get(key) ?? readCache()[key];
}

function remember(key: string, translation: string): void {
  memory.set(key, translation);
  try {
    const entries = Object.entries({ ...readCache(), [key]: translation }).slice(-CACHE_LIMIT);
    localStorage.setItem(TRANSLATION_CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // Storage full or blocked: the in-memory copy still works for this visit.
  }
}

export function clearTranslationMemory(): void {
  memory.clear();
}

export type SummaryState =
  /** The summary is already in the interface language. */
  | { status: 'original' }
  | { status: 'loading' }
  | { status: 'translated'; text: string }
  | { status: 'failed'; error: ApiError };

/**
 * Shows the summary in the interface language. The result itself (and its JSON export) is never
 * changed: the translation is display-only.
 */
export function useTranslatedSummary(
  result: AnalysisResult,
  language: Language,
): { state: SummaryState; retry: () => void } {
  const { summary } = result;
  const needsTranslation = result.document.language !== language;
  const key = cacheKey(language, summary);
  const [attempt, setAttempt] = useState(0);
  // The outcome of the last request, tagged with what it was for. Everything else is derived
  // during render, so the effect only sets state from the request's callbacks.
  const [fetched, setFetched] = useState<{ key: string; state: SummaryState } | null>(null);
  const cached = needsTranslation ? lookup(key) : undefined;

  useEffect(() => {
    if (!needsTranslation || lookup(key)) return;
    const controller = new AbortController();
    translateText(summary, language, controller.signal)
      .then((text) => {
        remember(key, text);
        setFetched({ key, state: { status: 'translated', text } });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const apiError = error instanceof ApiError ? error : new ApiError('UNKNOWN');
        setFetched({ key, state: { status: 'failed', error: apiError } });
      });
    return () => {
      controller.abort();
    };
  }, [needsTranslation, key, summary, language, attempt]);

  const retry = (): void => {
    setFetched(null);
    setAttempt((value) => value + 1);
  };

  let state: SummaryState;
  if (!needsTranslation) state = { status: 'original' };
  else if (cached) state = { status: 'translated', text: cached };
  else if (fetched?.key === key) state = fetched.state;
  else state = { status: 'loading' };

  return { state, retry };
}
