import { useId, useState } from 'react';

import { useI18n } from '../i18n/context';
import { apiErrorMessage } from '../i18n/errors';
import type { Messages } from '../i18n/messages';
import { downloadResult, jsonFileName } from '../lib/download';
import { formatIsoDate, formatSeconds, formatTimestamp, languageName } from '../lib/format';
import type { AnalysisMeta, AnalysisResult } from '../lib/schema';
import { useTranslatedResult } from '../lib/useTranslatedResult';
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

/** Warnings in the interface language; results saved before notices existed keep their text. */
function warningTexts(meta: AnalysisMeta, t: Messages): string[] {
  if (!meta.notices) return meta.warnings;
  return meta.notices.map((notice) => {
    switch (notice.code) {
      case 'PROMPT_INJECTION':
        return t.notices.PROMPT_INJECTION;
      case 'UNREAD_PAGES':
        return t.notices.UNREAD_PAGES(notice.pages);
      case 'TRUNCATED':
        return t.notices.TRUNCATED(notice.percent);
    }
  });
}

export function ResultView({ result, savedAt, onNew }: ResultViewProps) {
  const { t, locale, language } = useI18n();
  const [tab, setTab] = useState<Tab>('view');
  const baseId = useId();
  const { document: doc, meta } = result;
  // Values written by the model stay in the document's language; mark them for screen readers.
  const docLang = doc.language ?? undefined;
  // Summary, key points and descriptions follow the interface language (display only).
  const { texts, status, retry } = useTranslatedResult(result, language);
  const textLang = status.status === 'translated' ? language : docLang;
  const pending = status.status === 'loading';
  const warnings = meta ? warningTexts(meta, t) : [];

  const tabs: { id: Tab; label: string }[] = [
    { id: 'view', label: t.result.tabView },
    { id: 'json', label: t.result.tabJson },
  ];

  return (
    <article className="result" aria-labelledby="result-title">
      <header className="result-head">
        <div className={`stamp stamp-${doc.type}`} aria-hidden="true">
          {t.documentTypes[doc.type]}
        </div>
        <div className="result-heading">
          <h1 id="result-title" lang={docLang}>
            {doc.title ?? doc.fileName}
          </h1>
          <p className="result-sub">
            <span className="visually-hidden">
              {t.result.documentType}: {t.documentTypes[doc.type]}.{' '}
            </span>
            {doc.date ? t.result.documentDate(formatIsoDate(doc.date, locale)) : t.result.noDate}
            {savedAt && (
              <span className="muted">
                {' '}
                · {t.result.fromHistory(formatTimestamp(savedAt, locale))}
              </span>
            )}
          </p>
        </div>
      </header>

      <div className="result-toolbar">
        <div className="tabs" role="tablist" aria-label={t.result.tabsLabel}>
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
            title={t.result.downloadTitle(jsonFileName(doc.fileName))}
            onClick={() => {
              downloadResult(result);
            }}
          >
            {t.result.download}
          </button>
          <button type="button" className="button button-quiet" onClick={onNew}>
            {t.result.analyseAnother}
          </button>
        </div>
      </div>

      {warnings.length > 0 && (
        <ul className="warnings" aria-label={t.result.warningsLabel}>
          {warnings.map((warning) => (
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
          {pending && (
            <p className="visually-hidden" role="status">
              {t.translation.translating}
            </p>
          )}
          {status.status === 'failed' && (
            <p className="notice notice-warn" role="alert">
              {t.translation.failed} {apiErrorMessage(status.error, t, language)}{' '}
              <button type="button" className="link-button" onClick={retry}>
                {t.translation.retry}
              </button>
            </p>
          )}

          <section aria-labelledby={`${baseId}-summary`} aria-busy={pending}>
            <h2 id={`${baseId}-summary`} className="section-title">
              {t.result.summary}
            </h2>
            <p className={`summary${pending ? ' is-pending' : ''}`} lang={textLang}>
              {texts.summary}
            </p>
          </section>

          <section aria-labelledby={`${baseId}-points`} aria-busy={pending}>
            <h2 id={`${baseId}-points`} className="section-title">
              {t.result.keyPoints}
            </h2>
            <ul className={`key-points${pending ? ' is-pending' : ''}`} lang={textLang}>
              {texts.keyPoints.map((point, index) => (
                <li key={`${String(index)}-${point}`}>{point}</li>
              ))}
            </ul>
          </section>

          <section aria-labelledby={`${baseId}-amounts`} aria-busy={pending}>
            <h2 id={`${baseId}-amounts`} className="section-title">
              {t.result.amounts} <span className="count">{result.amounts.length}</span>
            </h2>
            <AmountsTable
              amounts={result.amounts}
              contexts={texts.amountContexts}
              lang={textLang}
              pending={pending}
            />
          </section>

          <section aria-labelledby={`${baseId}-dates`} aria-busy={pending}>
            <h2 id={`${baseId}-dates`} className="section-title">
              {t.result.dates} <span className="count">{result.dates.length}</span>
            </h2>
            <DatesTimeline
              dates={result.dates}
              contexts={texts.dateContexts}
              lang={textLang}
              pending={pending}
            />
          </section>
        </div>

        <aside className="result-side">
          <section aria-labelledby={`${baseId}-doc`} className="facts">
            <h2 id={`${baseId}-doc`} className="section-title">
              {t.result.document}
            </h2>
            <dl>
              <dt>{t.result.file}</dt>
              <dd className="break">{doc.fileName}</dd>
              <dt>{t.result.type}</dt>
              <dd>{t.documentTypes[doc.type]}</dd>
              <dt>{t.result.length}</dt>
              <dd>{t.pages(doc.pages)}</dd>
              <dt>{t.result.language}</dt>
              <dd>
                {languageName(doc.language, locale) ?? t.result.unknownLanguage}
                {doc.language && <span className="muted"> ({doc.language})</span>}
              </dd>
              {meta && (
                <>
                  <dt>{t.result.analysisTime}</dt>
                  <dd>{formatSeconds(meta.processingMs, locale)}</dd>
                  {meta.ocrPages.length > 0 && (
                    <>
                      <dt>{t.result.ocr}</dt>
                      <dd>{t.result.ocrPages(meta.ocrPages)}</dd>
                    </>
                  )}
                  <dt>{t.result.model}</dt>
                  <dd className="break">{meta.model}</dd>
                </>
              )}
            </dl>
          </section>

          <EntityList title={t.result.organizations} items={result.entities.organizations} />
          <EntityList title={t.result.people} items={result.entities.people} />

          <section aria-labelledby={`${baseId}-keywords`}>
            <h2 id={`${baseId}-keywords`} className="section-title">
              {t.result.keywords}
            </h2>
            {result.keywords.length > 0 ? (
              <ul className="keywords" lang={docLang}>
                {result.keywords.map((keyword) => (
                  <li key={keyword}>{keyword}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">{t.result.none}</p>
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
  const { t } = useI18n();
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
        <p className="muted">{t.result.notMentioned}</p>
      )}
    </section>
  );
}
