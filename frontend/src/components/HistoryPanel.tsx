import { useEffect, useRef } from 'react';

import { DOCUMENT_TYPE_LABELS, formatTimestamp } from '../lib/format';
import type { HistoryEntry } from '../lib/history';

interface HistoryPanelProps {
  entries: HistoryEntry[];
  onOpen: (entry: HistoryEntry) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onClose: () => void;
}

export function HistoryPanel({ entries, onOpen, onRemove, onClear, onClose }: HistoryPanelProps) {
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
          Ostatnie analizy
        </h2>
        <div className="button-row">
          {entries.length > 0 && (
            <button type="button" className="button button-quiet" onClick={onClear}>
              Wyczyść historię
            </button>
          )}
          <button type="button" className="button button-quiet" onClick={onClose}>
            Zamknij
          </button>
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="muted">
          Nie ma jeszcze zapisanych analiz. Wyniki zapisują się automatycznie w tej przeglądarce.
        </p>
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
                  {DOCUMENT_TYPE_LABELS[entry.result.document.type]} ·{' '}
                  {entry.result.document.fileName} · {formatTimestamp(entry.savedAt)}
                </span>
              </button>
              <button
                type="button"
                className="button button-quiet button-small"
                aria-label={`Usuń z historii: ${entry.result.document.fileName}`}
                onClick={() => {
                  onRemove(entry.id);
                }}
              >
                Usuń
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
