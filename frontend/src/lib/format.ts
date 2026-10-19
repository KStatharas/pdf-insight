import type { DateItem } from './schema';

/** Formatters are created once per locale. */
function cached<T>(create: (locale: string) => T): (locale: string) => T {
  const cache = new Map<string, T>();
  return (locale) => {
    let value = cache.get(locale);
    if (value === undefined) {
      value = create(locale);
      cache.set(locale, value);
    }
    return value;
  };
}

// Polish locale data skips the separator for 4-digit numbers ("8600,00"); a table column reads
// better when every value is grouped the same way.
const amountFormat = cached(
  (locale) =>
    new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: 'always',
    }),
);

/** "184 500,00" (pl) / "184,500.00" (en) — the currency code is shown in its own column. */
export function formatAmountValue(value: number, locale = 'pl-PL'): string {
  return amountFormat(locale).format(value);
}

const longDate = cached(
  (locale) =>
    new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }),
);

/** "2026-03-12" → "12 marca 2026". The value is a calendar day, so it is read as UTC. */
export function formatIsoDate(iso: string, locale = 'pl-PL'): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? iso : longDate(locale).format(date);
}

const dateTime = cached(
  (locale) =>
    new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }),
);

export function formatTimestamp(iso: string, locale = 'pl-PL'): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : dateTime(locale).format(date);
}

const languageNames = cached((locale) => {
  try {
    return new Intl.DisplayNames([locale], { type: 'language' });
  } catch {
    return null;
  }
});

/** "pl" → "polski" (pl) / "Polish" (en); falls back to the code itself. */
export function languageName(code: string | null, locale = 'pl-PL'): string | null {
  if (!code) return null;
  try {
    return languageNames(locale)?.of(code) ?? code;
  } catch {
    return code;
  }
}

/** Dates in chronological order; items with the same day keep their original order. */
export function sortDates(dates: readonly DateItem[]): DateItem[] {
  return [...dates].sort((a, b) => a.date.localeCompare(b.date));
}

export function formatSeconds(ms: number, locale = 'pl-PL'): string {
  const seconds = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(ms / 1000);
  return `${seconds} s`;
}

export function formatSize(bytes: number, locale = 'pl-PL'): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const megabytes = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(bytes / (1024 * 1024));
  return `${megabytes} MB`;
}
