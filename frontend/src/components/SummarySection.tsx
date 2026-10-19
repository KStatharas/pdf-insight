import { useId, useState } from 'react';

import { useI18n } from '../i18n/context';
import { apiErrorMessage } from '../i18n/errors';
import { languageName } from '../lib/format';
import type { AnalysisResult } from '../lib/schema';
import { useTranslatedSummary } from '../lib/useTranslatedSummary';

/**
 * The summary in the interface language. Only the display changes: the result, its history entry
 * and the downloaded JSON keep the summary in the document's language.
 */
export function SummarySection({ result }: { result: AnalysisResult }) {
  const { t, language, locale } = useI18n();
  const id = useId();
  const { state, retry } = useTranslatedSummary(result, language);
  const [showOriginal, setShowOriginal] = useState(false);
  const docLang = result.document.language ?? undefined;
  const sourceLanguage = languageName(result.document.language, locale) ?? t.result.unknownLanguage;

  const translated = state.status === 'translated' && !showOriginal;
  const text = translated ? state.text : result.summary;

  return (
    <section aria-labelledby={id} aria-busy={state.status === 'loading'}>
      <h2 id={id} className="section-title">
        {t.result.summary}
      </h2>
      <p
        className={`summary${state.status === 'loading' ? ' is-pending' : ''}`}
        lang={translated ? language : docLang}
      >
        {text}
      </p>

      {state.status === 'loading' && (
        <p className="translation-note" role="status">
          <span className="spinner" aria-hidden="true" />
          {t.translation.translating}
        </p>
      )}

      {state.status === 'translated' && (
        <p className="translation-note">
          {t.translation.translatedFrom(sourceLanguage)}{' '}
          <button
            type="button"
            className="link-button"
            aria-pressed={showOriginal}
            onClick={() => {
              setShowOriginal((value) => !value);
            }}
          >
            {showOriginal ? t.translation.showTranslation : t.translation.showOriginal}
          </button>
        </p>
      )}

      {state.status === 'failed' && (
        <p className="translation-note translation-failed" role="alert">
          {t.translation.failed} {apiErrorMessage(state.error, t, language)}{' '}
          <button type="button" className="link-button" onClick={retry}>
            {t.translation.retry}
          </button>
        </p>
      )}
    </section>
  );
}
