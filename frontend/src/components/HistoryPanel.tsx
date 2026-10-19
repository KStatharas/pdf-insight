import { useEffect, useRef } from 'react';

import { useI18n } from '../i18n/context';
import { formatTimestamp } from '../lib/format';
import type { HistoryEntry } from '../lib/history';

interface HistoryPanelProps {
  entries: HistoryEntry[];
  onOpen: (entry: HistoryEntry) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onClose: () => void;
}

export function HistoryPanel({ entries, onOpen, onRemove, onClear, onClose }: HistoryPanelProps) {
  const { t, locale } = useI18n();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section
      id="history"
      className="history"
      aria-labelledby="history-title"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
    >
      <div className="history-head">
        <h2 id="history-title" ref={headingRef} tabIndex={-1}>
          {t.history.title}
        </h2>
        <div className="button-row">
          {entries.length > 0 && (
            <button type="button" className="button button-quiet" onClick={onClear}>
              {t.history.clear}
            </button>
          )}
          <button type="button" className="button button-quiet" onClick={onClose}>
            {t.history.close}
          </button>
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="muted">{t.history.empty}</p>
      ) : (
        <ul className="history-list">
          {entries.map((entry) => (
            <li key={entry.id} className="history-item">
              <button
                type="button"
                className="history-open"
                onClick={() => {
                  onOpen(entry);
                }}
              >
                <span className="history-name">
                  {entry.result.document.title ?? entry.result.document.fileName}
                </span>
                <span className="history-meta">
                  <span>{t.documentTypes[entry.result.document.type]}</span>
                  <span>{entry.result.document.fileName}</span>
                  <span>{formatTimestamp(entry.savedAt, locale)}</span>
                </span>
              </button>
              <button
                type="button"
                className="button button-quiet button-small"
                aria-label={t.history.removeLabel(entry.result.document.fileName)}
                onClick={() => {
                  onRemove(entry.id);
                }}
              >
                {t.history.remove}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
