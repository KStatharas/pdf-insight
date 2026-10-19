import { describe, expect, it } from 'vitest';

import { sampleResult } from '../test/fixtures';
import {
  addToHistory,
  clearHistory,
  HISTORY_KEY,
  HISTORY_LIMIT,
  loadHistory,
  removeFromHistory,
} from './history';

describe('history', () => {
  it('starts empty', () => {
    expect(loadHistory()).toEqual([]);
  });

  it('saves results newest first', () => {
    const first = sampleResult();
    const second = sampleResult();
    second.document.fileName = 'faktura.pdf';
    addToHistory(first);
    addToHistory(second);
    const entries = loadHistory();
    expect(entries.map((e) => e.result.document.fileName)).toEqual([
      'faktura.pdf',
      'Test_PDF_Insight_umowa_14-2026.pdf',
    ]);
  });

  it(`keeps only the last ${HISTORY_LIMIT} results`, () => {
    for (let i = 0; i < HISTORY_LIMIT + 3; i += 1) addToHistory(sampleResult());
    expect(loadHistory()).toHaveLength(HISTORY_LIMIT);
  });

  it('removes a single entry and clears all entries', () => {
    addToHistory(sampleResult());
    const [entry] = addToHistory(sampleResult());
    expect(entry).toBeDefined();
    expect(removeFromHistory(entry?.id ?? '')).toHaveLength(1);
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });

  it('ignores corrupted or outdated data', () => {
    localStorage.setItem(HISTORY_KEY, '{not json');
    expect(loadHistory()).toEqual([]);

    const valid = { id: 'a', savedAt: '2026-10-19T10:00:00Z', result: sampleResult() };
    const broken = { id: 'b', savedAt: '2026-10-19T10:00:00Z', result: { summary: 'x' } };
    localStorage.setItem(HISTORY_KEY, JSON.stringify([broken, valid]));
    expect(loadHistory().map((e) => e.id)).toEqual(['a']);
  });

  it('survives storage that throws', () => {
    const failing: Storage = {
      length: 0,
      clear: () => undefined,
      key: () => null,
      removeItem: () => undefined,
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(loadHistory(failing)).toEqual([]);
    expect(addToHistory(sampleResult(), failing)).toEqual([]);
  });
});
