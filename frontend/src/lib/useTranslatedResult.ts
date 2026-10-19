import { useEffect, useState } from 'react';

import { ApiError, translateTexts } from '../api/client';
import type { Language } from '../i18n/messages';
import type { AnalysisResult } from './schema';

export const TRANSLATION_CACHE_KEY = 'pdf-insight:translations:v2';
const CACHE_LIMIT = 20;

/** The texts of a result that are shown in the interface language. */
export interface DisplayTexts {
  summary: string;
  keyPoints: string[];
  /** Same order as `result.amounts`; `null` where the amount has no description. */
  amountContexts: (string | null)[];
  /** Same order as `result.dates`. */
  dateContexts: (string | null)[];
}

export type TranslationStatus =
  /** The document is already in the interface language. */
  | { status: 'original' }
  | { status: 'loading' }
  | { status: 'translated' }
  | { status: 'failed'; error: ApiError };

export function originalTexts(result: AnalysisResult): DisplayTexts {
  return {
    summary: result.summary,
    keyPoints: result.keyPoints,
    amountContexts: result.amounts.map((amount) => amount.context),
    dateContexts: result.dates.map((date) => date.context),
  };
}

/** Flattens the texts into one list for a single request (descriptions that are null skipped). */
export function flattenTexts(texts: DisplayTexts): string[] {
  return [
    texts.summary,
    ...texts.keyPoints,
    ...texts.amountContexts.filter((context): context is string => context !== null),
    ...texts.dateContexts.filter((context): context is string => context !== null),
  ];
}

/** Puts translations back in place of the originals, in the order `flattenTexts` produced. */
export function unflattenTexts(
  original: DisplayTexts,
  translations: readonly string[],
): DisplayTexts {
  let index = 0;
  const next = (): string => translations[index++] ?? '';
  const nextOrNull = (context: string | null): string | null => (context === null ? null : next());
  return {
    summary: next(),
    keyPoints: original.keyPoints.map(next),
    amountContexts: original.amountContexts.map(nextOrNull),
    dateContexts: original.dateContexts.map(nextOrNull),
  };
}

/** Translations are kept in the browser so switching back and forth costs one request. */
const memory = new Map<string, string[]>();

function readCache(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(TRANSLATION_CACHE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string[]] =>
          Array.isArray(entry[1]) && entry[1].every((item) => typeof item === 'string'),
      ),
    );
  } catch {
    return {};
  }
}

function lookup(key: string, count: number): string[] | undefined {
  const found = memory.get(key) ?? readCache()[key];
  return found?.length === count ? found : undefined;
}

function remember(key: string, translations: string[]): void {
  memory.set(key, translations);
  try {
    const entries = Object.entries({ ...readCache(), [key]: translations }).slice(-CACHE_LIMIT);
    localStorage.setItem(TRANSLATION_CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // Storage full or blocked: the in-memory copy still works for this visit.
  }
}

export function clearTranslationMemory(): void {
  memory.clear();
}

/**
 * The summary, key points and amount/date descriptions in the interface language. Only the
 * display changes: the result, its history entry and the downloaded JSON keep the document's
 * language.
 */
export function useTranslatedResult(
  result: AnalysisResult,
  language: Language,
): { texts: DisplayTexts; status: TranslationStatus; retry: () => void } {
  const original = originalTexts(result);
  const sources = flattenTexts(original);
  const needsTranslation = result.document.language !== language;
  const key = `${language}\u0000${JSON.stringify(sources)}`;
  const [attempt, setAttempt] = useState(0);
  // The outcome of the last request, tagged with what it was for. Everything else is derived
  // during render, so the effect only sets state from the request's callbacks.
  const [fetched, setFetched] = useState<
    { key: string; translations: string[] } | { key: string; error: ApiError } | null
  >(null);

  useEffect(() => {
    if (!needsTranslation || lookup(key, sources.length)) return;
    const controller = new AbortController();
    translateTexts(sources, language, controller.signal)
      .then((translations) => {
        remember(key, translations);
        setFetched({ key, translations });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setFetched({ key, error: error instanceof ApiError ? error : new ApiError('UNKNOWN') });
      });
    return () => {
      controller.abort();
    };
    // `sources` is derived from `key`; listing the key alone avoids re-running on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsTranslation, key, language, attempt]);

  const retry = (): void => {
    setFetched(null);
    setAttempt((value) => value + 1);
  };

  if (!needsTranslation) return { texts: original, status: { status: 'original' }, retry };
  const translations =
    lookup(key, sources.length) ??
    (fetched?.key === key && 'translations' in fetched ? fetched.translations : undefined);
  if (translations) {
    return {
      texts: unflattenTexts(original, translations),
      status: { status: 'translated' },
      retry,
    };
  }
  if (fetched?.key === key && 'error' in fetched) {
    return { texts: original, status: { status: 'failed', error: fetched.error }, retry };
  }
  return { texts: original, status: { status: 'loading' }, retry };
}
