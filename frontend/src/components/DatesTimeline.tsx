import { useI18n } from '../i18n/context';
import { formatIsoDate, sortDates } from '../lib/format';
import type { DateItem } from '../lib/schema';

interface DatesTimelineProps {
  dates: DateItem[];
  /** Descriptions to show (translated or original), in the order of `dates`. */
  contexts: (string | null)[];
  lang: string | undefined;
  pending: boolean;
}

export function DatesTimeline({ dates, contexts, lang, pending }: DatesTimelineProps) {
  const { t, locale } = useI18n();
  if (dates.length === 0) {
    return <p className="muted">{t.dates.empty}</p>;
  }

  return (
    <ol className="timeline">
      {sortDates(
        dates.map((item, index) => ({ ...item, context: contexts[index] ?? item.context })),
      ).map((item, index) => (
        <li key={`${item.date}-${String(index)}`} className="timeline-item">
          <time dateTime={item.date} className="timeline-date">
            {formatIsoDate(item.date, locale)}
          </time>
          <span className={`timeline-context${pending ? ' is-pending' : ''}`} lang={lang}>
            {item.context ?? <span className="muted">{t.dates.noContext}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}
