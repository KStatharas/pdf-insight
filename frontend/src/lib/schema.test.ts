import { describe, expect, it } from 'vitest';

import { sampleResult } from '../test/fixtures';
import { isIsoDate, parseAnalysisResult } from './schema';

type Mutable = Record<string, unknown>;

/** Returns a copy of the sample result with one nested value replaced (or removed). */
function withChange(path: string, value: unknown): unknown {
  const copy = structuredClone(sampleResult()) as unknown as Mutable;
  const keys = path.split('.');
  const last = keys.pop() ?? '';
  let target: Mutable = copy;
  for (const key of keys) target = target[key] as Mutable;
  if (value === undefined) {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete target[last];
  } else {
    target[last] = value;
  }
  return copy;
}

describe('parseAnalysisResult', () => {
  it('accepts a valid result', () => {
    const parsed = parseAnalysisResult(sampleResult());
    expect(parsed.success).toBe(true);
  });

  it('accepts null and empty values for missing information', () => {
    const result = sampleResult();
    result.document.title = null;
    result.document.date = null;
    result.document.language = null;
    result.entities.people = [];
    result.amounts = [{ value: 10, currency: null, context: null }];
    result.dates = [];
    result.keywords = [];
    expect(parseAnalysisResult(result).success).toBe(true);
  });

  it('accepts a result without the optional meta field', () => {
    expect(parseAnalysisResult(withChange('meta', undefined)).success).toBe(true);
  });

  it('keeps additional fields out of the validated result', () => {
    const parsed = parseAnalysisResult({ ...sampleResult(), extra: 'value' });
    expect(parsed.success && 'extra' in parsed.data).toBe(false);
  });

  it.each([
    ['document', undefined],
    ['summary', undefined],
    ['summary', '   '],
    ['keyPoints', ['jeden', 'dwa']],
    ['keyPoints', ['1', '2', '3', '4', '5', '6', '7', '8']],
    ['entities.people', undefined],
    ['document.type', 'contract'],
    ['document.pages', 0],
    ['document.language', 'polish'],
    ['document.date', '12.03.2026'],
    ['document.date', '2026-02-30'],
    ['amounts', [{ value: '184 500,00', currency: 'PLN', context: 'x' }]],
    ['amounts', [{ value: 100, currency: 'zł', context: 'x' }]],
    ['amounts', [{ value: Number.POSITIVE_INFINITY, currency: 'PLN', context: 'x' }]],
    ['dates', [{ date: '2026-13-01', context: 'x' }]],
    ['keywords', 'CRM'],
  ])('rejects %s = %j', (path, value) => {
    const parsed = parseAnalysisResult(withChange(path, value));
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.issues.length).toBeGreaterThan(0);
  });

  it('rejects data that is not an object', () => {
    expect(parseAnalysisResult(null).success).toBe(false);
    expect(parseAnalysisResult('{"summary": "x"}').success).toBe(false);
  });

  it('reports the path of the problem', () => {
    const parsed = parseAnalysisResult(withChange('document.date', 'jutro'));
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.issues[0]).toMatch(/^document\.date:/);
  });
});

describe('isIsoDate', () => {
  it.each(['2026-03-12', '2024-02-29', '2028-03-31'])('accepts %s', (value) => {
    expect(isIsoDate(value)).toBe(true);
  });

  it.each(['2026-3-12', '2025-02-29', '2026-03-12T10:00:00Z', '', '12.03.2026'])(
    'rejects %j',
    (value) => {
      expect(isIsoDate(value)).toBe(false);
    },
  );
});
