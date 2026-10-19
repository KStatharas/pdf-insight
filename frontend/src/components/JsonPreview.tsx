import { useEffect, useState } from 'react';

import { resultToJson } from '../lib/download';
import type { AnalysisResult } from '../lib/schema';

type CopyState = 'idle' | 'copied' | 'failed';

export function JsonPreview({ result }: { result: AnalysisResult }) {
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

  return (
    <div className="json">
      <div className="json-head">
        <p className="muted">
          Wynik zgodny ze schematem z briefu, sprawdzony przed wyświetleniem. Pole <code>meta</code>{' '}
          zawiera dodatkowe informacje o przebiegu analizy.
        </p>
        <button
          type="button"
          className="button button-quiet"
          onClick={() => {
            void onCopy();
          }}
        >
          {copy === 'copied'
            ? 'Skopiowano'
            : copy === 'failed'
              ? 'Nie udało się skopiować'
              : 'Kopiuj JSON'}
        </button>
      </div>
      <pre className="json-code" tabIndex={0} aria-label="Podgląd JSON">
        <code>{json}</code>
      </pre>
    </div>
  );
}
