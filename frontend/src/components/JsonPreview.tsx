import { useEffect, useState } from 'react';

import { useI18n } from '../i18n/context';
import { resultToJson } from '../lib/download';
import type { AnalysisResult } from '../lib/schema';

type CopyState = 'idle' | 'copied' | 'failed';

/** Always shows the result as it was analysed, regardless of the interface language. */
export function JsonPreview({ result }: { result: AnalysisResult }) {
  const { t } = useI18n();
  const [copy, setCopy] = useState<CopyState>('idle');
  const json = resultToJson(result);

  useEffect(() => {
    if (copy === 'idle') return;
    const timer = window.setTimeout(() => {
      setCopy('idle');
    }, 2500);
    return () => {
      window.clearTimeout(timer);
    };
  }, [copy]);

  const onCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(json);
      setCopy('copied');
    } catch {
      setCopy('failed');
    }
  };

  const copyLabel =
    copy === 'copied' ? t.json.copied : copy === 'failed' ? t.json.copyFailed : t.json.copy;

  return (
    <div className="json">
      <div className="json-head">
        <p className="muted">{t.json.note}</p>
        <button
          type="button"
          className="button button-quiet"
          onClick={() => {
            void onCopy();
          }}
        >
          {copyLabel}
        </button>
      </div>
      <pre className="json-code" tabIndex={0} aria-label={t.json.previewLabel}>
        <code>{json}</code>
      </pre>
    </div>
  );
}
