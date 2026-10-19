import { useEffect, useState } from 'react';

import { useI18n } from '../i18n/context';
import { formatSize } from '../lib/format';

interface AnalysisProgressProps {
  fileName: string;
  fileSize: number;
  phase: 'upload' | 'analysis';
  progress: number;
  startedAt: number;
  onCancel: () => void;
}

/** The server does extraction, OCR and AI in one request, so only the upload has real progress. */
export function AnalysisProgress({
  fileName,
  fileSize,
  phase,
  progress,
  startedAt,
  onCancel,
}: AnalysisProgressProps) {
  const { t, locale } = useI18n();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 250);
    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  const uploadPercent = Math.round(progress * 100);

  return (
    <section
      className={`progress progress-${phase}`}
      aria-labelledby="progress-title"
      aria-busy="true"
    >
      <div className="scanner" aria-hidden="true">
        <span className="scanner-sheet">
          <span className="scanner-line" />
          <span className="scanner-line" />
          <span className="scanner-line scanner-line-short" />
          <span className="scanner-line" />
          <span className="scanner-line scanner-line-short" />
          <span className="scanner-beam" />
        </span>
        <span className="scanner-glow" />
      </div>
      <h1 id="progress-title" className="progress-title">
        {t.progress.title}
      </h1>
      <p className="progress-file">
        {fileName} <span className="muted">({formatSize(fileSize, locale)})</span>
      </p>

      <ol className="steps">
        <li className={phase === 'upload' ? 'step is-active' : 'step is-done'}>
          <span className="step-name">{t.progress.upload}</span>
          <span className="step-state">
            {phase === 'upload' ? `${uploadPercent}%` : t.progress.done}
          </span>
          <span className="bar" aria-hidden="true">
            <span
              className="bar-fill"
              style={{ width: `${phase === 'upload' ? uploadPercent : 100}%` }}
            />
          </span>
        </li>
        <li className={phase === 'analysis' ? 'step is-active' : 'step'}>
          <span className="step-name">{t.progress.analysis}</span>
          <span className="step-state">
            {phase === 'analysis' ? t.progress.running : t.progress.waiting}
          </span>
          <span className="bar bar-indeterminate" aria-hidden="true">
            {phase === 'analysis' && <span className="bar-fill" />}
          </span>
        </li>
      </ol>

      <p className="progress-time" aria-live="off">
        {t.progress.elapsed(seconds)}
      </p>
      <p className="visually-hidden" role="status">
        {phase === 'upload' ? t.progress.statusUpload : t.progress.statusAnalysis}
      </p>

      <button type="button" className="button button-quiet" onClick={onCancel}>
        {t.progress.cancel}
      </button>
    </section>
  );
}
