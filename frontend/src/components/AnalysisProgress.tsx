import { useEffect, useState } from 'react';

import { formatSize } from '../lib/validateFile';

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
    <section className="progress" aria-labelledby="progress-title" aria-busy="true">
      <h1 id="progress-title" className="progress-title">
        Analizuję dokument
      </h1>
      <p className="progress-file">
        {fileName} <span className="muted">({formatSize(fileSize)})</span>
      </p>

      <ol className="steps">
        <li className={phase === 'upload' ? 'step is-active' : 'step is-done'}>
          <span className="step-name">Wysyłanie pliku</span>
          <span className="step-state">{phase === 'upload' ? `${uploadPercent}%` : 'gotowe'}</span>
          <span className="bar" aria-hidden="true">
            <span
              className="bar-fill"
              style={{ width: `${phase === 'upload' ? uploadPercent : 100}%` }}
            />
          </span>
        </li>
        <li className={phase === 'analysis' ? 'step is-active' : 'step'}>
          <span className="step-name">Odczyt tekstu, OCR skanów i analiza AI</span>
          <span className="step-state">{phase === 'analysis' ? 'w toku' : 'czeka'}</span>
          <span className="bar bar-indeterminate" aria-hidden="true">
            {phase === 'analysis' && <span className="bar-fill" />}
          </span>
        </li>
      </ol>

      <p className="progress-time" aria-live="off">
        Upłynęło {seconds} s. Zwykle trwa to 10–25 sekund.
      </p>
      <p className="visually-hidden" role="status">
        {phase === 'upload' ? 'Wysyłanie pliku' : 'Trwa analiza dokumentu'}
      </p>

      <button type="button" className="button button-quiet" onClick={onCancel}>
        Anuluj
      </button>
    </section>
  );
}
