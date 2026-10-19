import { formatIsoDate, sortDates } from '../lib/format';
import type { DateItem } from '../lib/schema';

export function DatesTimeline({ dates }: { dates: DateItem[] }) {
  if (dates.length === 0) {
    return <p className="muted">Dokument nie zawiera dat.</p>;
  }

  return (
    <ol className="timeline">
      {sortDates(dates).map((item, index) => (
        <li key={`${item.date}-${String(index)}`} className="timeline-item">
          <time dateTime={item.date} className="timeline-date">
            {formatIsoDate(item.date)}
          </time>
          <span className="timeline-context">
            {item.context ?? <span className="muted">brak opisu</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}
