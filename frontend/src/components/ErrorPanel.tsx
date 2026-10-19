import { useI18n } from '../i18n/context';

interface ErrorPanelProps {
  fileName: string;
  message: string;
  retryable: boolean;
  onRetry: () => void;
  onReset: () => void;
}

export function ErrorPanel({ fileName, message, retryable, onRetry, onReset }: ErrorPanelProps) {
  const { t } = useI18n();
  return (
    <section className="error-panel" role="alert" aria-labelledby="error-title">
      <h1 id="error-title">{t.error.title}</h1>
      <p className="error-message">{message}</p>
      <p className="muted">
        {t.error.file}: {fileName}
      </p>
      <div className="button-row">
        {retryable && (
          <button type="button" className="button button-primary" onClick={onRetry}>
            {t.error.retry}
          </button>
        )}
        <button
          type="button"
          className={retryable ? 'button button-quiet' : 'button button-primary'}
          onClick={onReset}
        >
          {t.error.other}
        </button>
      </div>
    </section>
  );
}
