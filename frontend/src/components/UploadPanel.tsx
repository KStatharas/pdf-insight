import { useId, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';

import type { HealthStatus } from '../api/client';
import { useI18n } from '../i18n/context';
import { MAX_FILE_MB } from '../lib/validateFile';

interface UploadPanelProps {
  error: string | null;
  health: HealthStatus | 'checking';
  onFile: (file: File) => void;
  /** Analyses the bundled sample contract, for visitors without a PDF at hand. */
  onSample: () => void;
}

export function UploadPanel({ error, health, onFile, onSample }: UploadPanelProps) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const errorId = useId();
  const hintId = useId();

  const pick = (files: FileList | null): void => {
    const file = files?.[0];
    if (file) onFile(file);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    setDragging(false);
    pick(event.dataTransfer.files);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      inputRef.current?.click();
    }
  };

  return (
    <section className="upload" aria-labelledby="upload-title">
      <div className="upload-intro">
        <h1 id="upload-title">{t.upload.title}</h1>
        <p className="lede">{t.upload.lede}</p>
      </div>

      <div
        className={`dropzone${dragging ? ' is-dragging' : ''}${error ? ' has-error' : ''}`}
        role="button"
        tabIndex={0}
        aria-describedby={error ? `${hintId} ${errorId}` : hintId}
        onClick={() => inputRef.current?.click()}
        onKeyDown={onKeyDown}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={onDrop}
      >
        <span className="sheet" aria-hidden="true">
          <span className="sheet-fold" />
          <span className="sheet-line" />
          <span className="sheet-line" />
          <span className="sheet-line sheet-line-short" />
        </span>
        <span className="dropzone-title">
          {dragging ? t.upload.dropActive : t.upload.dropTitle}
        </span>
        <span className="dropzone-or">{t.upload.or}</span>
        <span className="button button-primary">{t.upload.choose}</span>
        <span id={hintId} className="dropzone-hint">
          {t.upload.hint(MAX_FILE_MB)}
        </span>
        <input
          ref={inputRef}
          className="visually-hidden"
          type="file"
          accept="application/pdf,.pdf"
          tabIndex={-1}
          aria-hidden="true"
          data-testid="file-input"
          onChange={(event) => {
            pick(event.target.files);
            event.target.value = '';
          }}
        />
      </div>

      {error && (
        <p id={errorId} className="field-error" role="alert">
          {error}
        </p>
      )}

      {health === 'offline' && <p className="notice notice-warn">{t.upload.offline}</p>}
      {health === 'not-configured' && (
        <p className="notice notice-warn">{t.upload.notConfigured}</p>
      )}

      <p className="sample">
        {t.upload.samplePrompt}{' '}
        <button type="button" className="link-button" onClick={onSample}>
          {t.upload.sampleButton}
        </button>{' '}
        <span className="muted">{t.upload.sampleNote}</span>
      </p>

      <aside className="privacy" aria-label={t.upload.privacyLabel}>
        <p>
          <strong>{t.upload.privacyStrong}</strong> {t.upload.privacy}
        </p>
      </aside>
    </section>
  );
}
