import { describe, expect, it } from 'vitest';

import { jsonFileName } from './download';
import { MESSAGES } from '../i18n/messages';
import {
  formatAmountValue,
  formatIsoDate,
  formatSeconds,
  formatSize,
  languageName,
  sortDates,
} from './format';

const NBSP = new RegExp('[\\u00a0\\u202f]', 'g');

describe('format', () => {
  it('formats amounts the Polish way', () => {
    expect(formatAmountValue(184500).replace(NBSP, ' ')).toBe('184 500,00');
    expect(formatAmountValue(68080.5).replace(NBSP, ' ')).toBe('68 080,50');
    expect(formatAmountValue(8600).replace(NBSP, ' ')).toBe('8 600,00');
  });

  it('formats amounts, dates and sizes for English', () => {
    expect(formatAmountValue(184500, 'en-GB')).toBe('184,500.00');
    expect(formatAmountValue(8600, 'en-GB')).toBe('8,600.00');
    expect(formatIsoDate('2026-03-12', 'en-GB')).toBe('12 March 2026');
    expect(formatSeconds(21190, 'en-GB')).toBe('21.2 s');
    expect(formatSeconds(21190).replace(NBSP, ' ')).toBe('21,2 s');
    expect(formatSize(5 * 1024 * 1024, 'en-GB')).toBe('5.0 MB');
    expect(MESSAGES.en.pages(1)).toBe('1 page');
    expect(MESSAGES.en.pages(12)).toBe('12 pages');
  });

  it('formats ISO dates in Polish without shifting the day', () => {
    expect(formatIsoDate('2026-03-12')).toBe('12 marca 2026');
    expect(formatIsoDate('2026-10-01')).toBe('1 października 2026');
  });

  it('sorts dates chronologically without mutating the input', () => {
    const dates = [
      { date: '2026-10-12', context: 'b' },
      { date: '2026-03-12', context: 'a' },
    ];
    expect(sortDates(dates).map((d) => d.context)).toEqual(['a', 'b']);
    expect(dates[0]?.context).toBe('b');
  });

  it('names languages', () => {
    expect(languageName('pl')).toBe('polski');
    expect(languageName('pl', 'en-GB')).toBe('Polish');
    expect(languageName(null)).toBeNull();
  });

  it.each([
    [1, '1 strona'],
    [3, '3 strony'],
    [5, '5 stron'],
    [12, '12 stron'],
    [22, '22 strony'],
  ])('pluralises %d pages', (count, expected) => {
    expect(MESSAGES.pl.pages(count)).toBe(expected);
  });

  it('builds a safe JSON file name', () => {
    expect(jsonFileName('Test_PDF_Insight_umowa_14-2026.pdf')).toBe(
      'Test_PDF_Insight_umowa_14-2026.json',
    );
    expect(jsonFileName('a/b:c.PDF')).toBe('a-b-c.json');
    expect(jsonFileName('.pdf')).toBe('analiza.json');
  });
});
