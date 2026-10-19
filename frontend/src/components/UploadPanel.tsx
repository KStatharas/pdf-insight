import { useId, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';

import type { HealthStatus } from '../api/client';
import { MAX_FILE_MB } from '../lib/validateFile';

interface UploadPanelProps {
  error: string | null;
  health: HealthStatus | 'checking';
  onFile: (file: File) => void;
}

export function UploadPanel({ error, health, onFile }: UploadPanelProps) {
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
        <h1 id="upload-title">Streszczenie i dane z dokumentu PDF w kilkanaście sekund</h1>
        <p className="lede">
          Wgraj umowę, fakturę, ofertę albo raport. Dostaniesz krótkie podsumowanie, kwoty, terminy
          i strony dokumentu oraz plik JSON do dalszej pracy.
        </p>
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
          {dragging ? 'Upuść plik, aby rozpocząć analizę' : 'Przeciągnij tutaj plik PDF'}
        </span>
        <span className="dropzone-or">albo</span>
        <span className="button button-primary">Wybierz plik z dysku</span>
        <span id={hintId} className="dropzone-hint">
          Tylko PDF, maksymalnie {MAX_FILE_MB} MB. Skany są odczytywane przez OCR.
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

      {health === 'offline' && (
        <p className="notice notice-warn">
          Serwer analizy nie odpowiada. Jeśli był uśpiony, uruchomi się po pierwszym żądaniu —
          możesz spróbować mimo to.
        </p>
      )}
      {health === 'not-configured' && (
        <p className="notice notice-warn">
          Serwer działa, ale nie ma skonfigurowanego klucza usługi AI, więc analiza się nie uda.
        </p>
      )}

      <aside className="privacy" aria-label="Informacja o przetwarzaniu pliku">
        <p>
          <strong>Twój plik trafia do usługi AI.</strong> Tekst dokumentu jest wysyłany do serwera
          aplikacji, a stamtąd do modelu Google Gemini. Serwer nie zapisuje pliku. Nie wgrywaj
          dokumentów, których nie możesz udostępnić zewnętrznemu dostawcy.
        </p>
      </aside>
    </section>
  );
}
