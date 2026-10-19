import { useI18n } from '../i18n/context';
import { formatIsoDate, sortDates } from '../lib/format';
import type { DateItem } from '../lib/schema';

export function DatesTimeline({ dates, lang }: { dates: DateItem[]; lang: string | undefined }) {
  const { t, locale } = useI18n();
  if (dates.length === 0) {
    return <p className="muted">{t.dates.empty}</p>;
  }

  return (
    <ol className="timeline">
      {sortDates(dates).map((item, index) => (
        <li key={`${item.date}-${String(index)}`} className="timeline-item">
          <time dateTime={item.date} className="timeline-date">
            {formatIsoDate(item.date, locale)}
          </time>
          <span className="timeline-context" lang={lang}>
            {item.context ?? <span className="muted">{t.dates.noContext}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}
