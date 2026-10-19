interface ErrorPanelProps {
  fileName: string;
  message: string;
  retryable: boolean;
  onRetry: () => void;
  onReset: () => void;
}

export function ErrorPanel({ fileName, message, retryable, onRetry, onReset }: ErrorPanelProps) {
  return (
    <section className="error-panel" role="alert" aria-labelledby="error-title">
      <h1 id="error-title">Analiza się nie udała</h1>
      <p className="error-message">{message}</p>
      <p className="muted">Plik: {fileName}</p>
      <div className="button-row">
        {retryable && (
          <button type="button" className="button button-primary" onClick={onRetry}>
            Spróbuj ponownie
          </button>
        )}
        <button
          type="button"
          className={retryable ? 'button button-quiet' : 'button button-primary'}
          onClick={onReset}
        >
          Wybierz inny plik
        </button>
      </div>
    </section>
  );
}
