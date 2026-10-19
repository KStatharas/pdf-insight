import { z } from 'zod';

import { analysisResultSchema, type AnalysisResult } from './schema';

export const HISTORY_KEY = 'pdf-insight:history:v1';
export const HISTORY_LIMIT = 10;

const entrySchema = z.object({
  id: z.string().min(1),
  savedAt: z.string().min(1),
  result: analysisResultSchema,
});

export type HistoryEntry = z.infer<typeof entrySchema>;

/**
 * Reads the saved analyses. Storage can be unavailable (private mode, blocked cookies) or hold
 * data from an older version, so every entry is validated and broken ones are skipped.
 */
export function loadHistory(storage: Storage = localStorage): HistoryEntry[] {
  let raw: string | null;
  try {
    raw = storage.getItem(HISTORY_KEY);
  } catch {
    return [];
  }
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  return parsed.flatMap((item: unknown) => {
    const entry = entrySchema.safeParse(item);
    return entry.success ? [entry.data] : [];
  });
}

function save(entries: HistoryEntry[], storage: Storage): boolean {
  try {
    storage.setItem(HISTORY_KEY, JSON.stringify(entries));
    return true;
  } catch {
    return false;
  }
}

function newId(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** Adds a result at the top of the history and keeps only the newest entries. */
export function addToHistory(
  result: AnalysisResult,
  storage: Storage = localStorage,
  now: Date = new Date(),
): HistoryEntry[] {
  const entry: HistoryEntry = { id: newId(), savedAt: now.toISOString(), result };
  const entries = [entry, ...loadHistory(storage)].slice(0, HISTORY_LIMIT);
  // If the quota is exceeded, drop the oldest entries until the list fits.
  for (let size = entries.length; size > 0; size -= 1) {
    if (save(entries.slice(0, size), storage)) return entries.slice(0, size);
  }
  return [];
}

export function removeFromHistory(id: string, storage: Storage = localStorage): HistoryEntry[] {
  const entries = loadHistory(storage).filter((entry) => entry.id !== id);
  save(entries, storage);
  return entries;
}

export function clearHistory(storage: Storage = localStorage): void {
  try {
    storage.removeItem(HISTORY_KEY);
  } catch {
    // Storage is unavailable; there is nothing to clear.
  }
}
