import { describe, expect, it } from 'vitest';

import { sampleResult } from '../test/fixtures';
import { flattenTexts, originalTexts, unflattenTexts } from './useTranslatedResult';

describe('translation texts', () => {
  it('flattens summary, key points and descriptions, skipping missing descriptions', () => {
    const result = sampleResult();
    result.amounts[1] = { value: 8600, currency: 'EUR', context: null };
    const texts = flattenTexts(originalTexts(result));

    expect(texts[0]).toBe(result.summary);
    expect(texts).toHaveLength(1 + 3 + 2 + 2);
    expect(texts).not.toContain(null);
  });

  it('puts translations back in their places', () => {
    const result = sampleResult();
    result.amounts[1] = { value: 8600, currency: 'EUR', context: null };
    const original = originalTexts(result);
    const translated = unflattenTexts(
      original,
      flattenTexts(original).map((text) => text.toUpperCase()),
    );

    expect(translated.summary).toBe(result.summary.toUpperCase());
    expect(translated.keyPoints).toEqual(result.keyPoints.map((p) => p.toUpperCase()));
    expect(translated.amountContexts).toEqual([
      'WYNAGRODZENIE ZA WDROŻENIE NETTO',
      null,
      'HOSTING MIESIĘCZNIE',
    ]);
    expect(translated.dateContexts).toEqual(['PLANOWANY GO-LIVE', 'ZAWARCIE UMOWY']);
  });
});
