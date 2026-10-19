import type { DateItem, DocumentType } from './schema';

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  faktura: 'Faktura',
  umowa: 'Umowa',
  oferta: 'Oferta',
  raport: 'Raport',
  inne: 'Inny dokument',
};

// Polish locale data skips the separator for 4-digit numbers ("8600,00"); a table column reads
// better when every value is grouped the same way.
const numberFormat = new Intl.NumberFormat('pl-PL', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: 'always',
});

/** "184 500,00" — the currency code is shown separately, in its own column. */
export function formatAmountValue(value: number): string {
  return numberFormat.format(value);
}

const longDate = new Intl.DateTimeFormat('pl-PL', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/** "2026-03-12" → "12 marca 2026". The value is a calendar day, so it is read as UTC. */
export function formatIsoDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? iso : longDate.format(date);
}

const dateTime = new Intl.DateTimeFormat('pl-PL', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : dateTime.format(date);
}

let languageNames: Intl.DisplayNames | null = null;
try {
  languageNames = new Intl.DisplayNames(['pl'], { type: 'language' });
} catch {
  languageNames = null;
}

/** "pl" → "polski" (falls back to the code itself). */
export function languageName(code: string | null): string {
  if (!code) return 'nieznany';
  try {
    return languageNames?.of(code) ?? code;
  } catch {
    return code;
  }
}

/** Dates in chronological order; items with the same day keep their original order. */
export function sortDates(dates: readonly DateItem[]): DateItem[] {
  return [...dates].sort((a, b) => a.date.localeCompare(b.date));
}

export function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1).replace('.', ',')} s`;
}

export function pluralPages(count: number): string {
  if (count === 1) return '1 strona';
  const lastDigit = count % 10;
  const lastTwo = count % 100;
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14)) return `${count} strony`;
  return `${count} stron`;
}
