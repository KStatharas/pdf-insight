import { useId, useState } from 'react';

import { downloadResult, jsonFileName } from '../lib/download';
import {
  DOCUMENT_TYPE_LABELS,
  formatIsoDate,
  formatSeconds,
  formatTimestamp,
  languageName,
  pluralPages,
} from '../lib/format';
import type { AnalysisResult } from '../lib/schema';
import { AmountsTable } from './AmountsTable';
import { DatesTimeline } from './DatesTimeline';
import { JsonPreview } from './JsonPreview';

interface ResultViewProps {
  result: AnalysisResult;
  /** Set when the result was opened from the history. */
  savedAt: string | null;
  onNew: () => void;
}

type Tab = 'view' | 'json';

export function ResultView({ result, savedAt, onNew }: ResultViewProps) {
  const [tab, setTab] = useState<Tab>('view');
  const baseId = useId();
  const { document: doc, meta } = result;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'view', label: 'Wyniki' },
    { id: 'json', label: 'JSON' },
  ];

  return (
    <article className="result" aria-labelledby="result-title">
      <header className="result-head">
        <div className={`stamp stamp-${doc.type}`} aria-hidden="true">
          {DOCUMENT_TYPE_LABELS[doc.type]}
        </div>
        <div className="result-heading">
          <h1 id="result-title">{doc.title ?? doc.fileName}</h1>
          <p className="result-sub">
            <span className="visually-hidden">
              Typ dokumentu: {DOCUMENT_TYPE_LABELS[doc.type]}.{' '}
            </span>
            {doc.date ? <>Data dokumentu: {formatIsoDate(doc.date)}</> : 'Brak daty dokumentu'}
            {savedAt && <span className="muted"> · z historii, {formatTimestamp(savedAt)}</span>}
          </p>
        </div>
      </header>

      <div className="result-toolbar">
        <div className="tabs" role="tablist" aria-label="Widok wyniku">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`${baseId}-tab-${item.id}`}
              aria-selected={tab === item.id}
              aria-controls={`${baseId}-panel-${item.id}`}
              tabIndex={tab === item.id ? 0 : -1}
              className="tab"
              onClick={() => {
                setTab(item.id);
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                  const next = tab === 'view' ? 'json' : 'view';
                  setTab(next);
                  document.getElementById(`${baseId}-tab-${next}`)?.focus();
                }
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="button-row">
          <button
            type="button"
            className="button button-primary"
            title={`Zapisz plik ${jsonFileName(doc.fileName)}`}
            onClick={() => {
              downloadResult(result);
            }}
          >
            Pobierz JSON
          </button>
          <button type="button" className="button button-quiet" onClick={onNew}>
            Analizuj kolejny plik
          </button>
        </div>
      </div>

      {meta && meta.warnings.length > 0 && (
        <ul className="warnings" aria-label="Ostrzeżenia">
          {meta.warnings.map((warning) => (
            <li key={warning} className="notice notice-warn">
              {warning}
            </li>
          ))}
        </ul>
      )}

      <div
        role="tabpanel"
        id={`${baseId}-panel-view`}
        aria-labelledby={`${baseId}-tab-view`}
        hidden={tab !== 'view'}
        className="result-grid"
      >
        <div className="result-main">
          <section aria-labelledby={`${baseId}-summary`}>
            <h2 id={`${baseId}-summary`} className="section-title">
              Podsumowanie
            </h2>
            <p className="summary" lang={doc.language ?? undefined}>
              {result.summary}
            </p>
          </section>

          <section aria-labelledby={`${baseId}-points`}>
            <h2 id={`${baseId}-points`} className="section-title">
              Najważniejsze informacje
            </h2>
            <ul className="key-points" lang={doc.language ?? undefined}>
              {result.keyPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </section>

          <section aria-labelledby={`${baseId}-amounts`}>
            <h2 id={`${baseId}-amounts`} className="section-title">
              Kwoty <span className="count">{result.amounts.length}</span>
            </h2>
            <AmountsTable amounts={result.amounts} />
          </section>

          <section aria-labelledby={`${baseId}-dates`}>
            <h2 id={`${baseId}-dates`} className="section-title">
              Terminy <span className="count">{result.dates.length}</span>
            </h2>
            <DatesTimeline dates={result.dates} />
          </section>
        </div>

        <aside className="result-side">
          <section aria-labelledby={`${baseId}-doc`} className="facts">
            <h2 id={`${baseId}-doc`} className="section-title">
              Dokument
            </h2>
            <dl>
              <dt>Plik</dt>
              <dd className="break">{doc.fileName}</dd>
              <dt>Typ</dt>
              <dd>{DOCUMENT_TYPE_LABELS[doc.type]}</dd>
              <dt>Długość</dt>
              <dd>{pluralPages(doc.pages)}</dd>
              <dt>Język</dt>
              <dd>
                {languageName(doc.language)}
                {doc.language && <span className="muted"> ({doc.language})</span>}
              </dd>
              {meta && (
                <>
                  <dt>Czas analizy</dt>
                  <dd>{formatSeconds(meta.processingMs)}</dd>
                  {meta.ocrPages.length > 0 && (
                    <>
                      <dt>OCR</dt>
                      <dd>
                        {meta.ocrPages.length === 1 ? 'strona' : 'strony'}{' '}
                        {meta.ocrPages.join(', ')}
                      </dd>
                    </>
                  )}
                  <dt>Model</dt>
                  <dd className="break">{meta.model}</dd>
                </>
              )}
            </dl>
          </section>

          <EntityList title="Organizacje" items={result.entities.organizations} />
          <EntityList title="Osoby" items={result.entities.people} />

          <section aria-labelledby={`${baseId}-keywords`}>
            <h2 id={`${baseId}-keywords`} className="section-title">
              Słowa kluczowe
            </h2>
            {result.keywords.length > 0 ? (
              <ul className="keywords">
                {result.keywords.map((keyword) => (
                  <li key={keyword}>{keyword}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">Brak.</p>
            )}
          </section>
        </aside>
      </div>

      <div
        role="tabpanel"
        id={`${baseId}-panel-json`}
        aria-labelledby={`${baseId}-tab-json`}
        hidden={tab !== 'json'}
      >
        <JsonPreview result={result} />
      </div>
    </article>
  );
}

function EntityList({ title, items }: { title: string; items: string[] }) {
  const id = useId();
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="section-title">
        {title} <span className="count">{items.length}</span>
      </h2>
      {items.length > 0 ? (
        <ul className="entities">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="muted">Nie wymieniono.</p>
      )}
    </section>
  );
}
