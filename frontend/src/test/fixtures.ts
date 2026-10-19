import type { AnalysisResult } from '../lib/schema';

/** A valid result shaped like the analysis of the sample contract. */
export function sampleResult(): AnalysisResult {
  return {
    document: {
      fileName: 'Test_PDF_Insight_umowa_14-2026.pdf',
      pages: 12,
      language: 'pl',
      type: 'umowa',
      title: 'Umowa ramowa nr 14/2026 o wdrożenie i utrzymanie systemu CRM',
      date: '2026-03-12',
    },
    summary:
      'Umowa ramowa zawarta 12 marca 2026 r. między Nordwave Logistics sp. z o.o. a Kwadrat ' +
      'Software S.A. dotyczy wdrożenia i utrzymania systemu CRM. Wynagrodzenie za wdrożenie ' +
      'wynosi 184 500,00 zł netto. Umowa obowiązuje od 1 kwietnia 2026 r. do 31 marca 2028 r.',
    keyPoints: [
      'Wynagrodzenie za wdrożenie: 184 500,00 zł netto',
      'Abonament: 12 300,00 PLN netto miesięcznie',
      'Go-live: 12 października 2026 r.',
    ],
    entities: {
      organizations: ['Nordwave Logistics sp. z o.o.', 'Kwadrat Software S.A.'],
      people: ['Anna Kowalczyk', 'Paweł Dąbrowski'],
    },
    amounts: [
      { value: 184500, currency: 'PLN', context: 'wynagrodzenie za wdrożenie netto' },
      { value: 8600, currency: 'EUR', context: 'licencje rocznie' },
      { value: 890, currency: 'USD', context: 'hosting miesięcznie' },
    ],
    dates: [
      { date: '2026-10-12', context: 'planowany Go-live' },
      { date: '2026-03-12', context: 'zawarcie umowy' },
    ],
    keywords: ['CRM', 'SLA', 'wdrożenie'],
    meta: {
      model: 'test-model',
      chunks: 1,
      ocrPages: [11],
      truncated: false,
      warnings: [],
      processingMs: 12345,
    },
  };
}
