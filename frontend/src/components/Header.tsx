import { useId } from 'react';

import type { HealthStatus } from '../api/client';
import { useI18n } from '../i18n/context';
import { isLanguage, LANGUAGE_NAMES, LANGUAGES } from '../i18n/messages';

interface HeaderProps {
  health: HealthStatus | 'checking';
  historyCount: number;
  historyOpen: boolean;
  onToggleHistory: () => void;
  onHome: () => void;
}

export function Header({
  health,
  historyCount,
  historyOpen,
  onToggleHistory,
  onHome,
}: HeaderProps) {
  const { t, language, setLanguage } = useI18n();
  const languageId = useId();

  return (
    <header className="header">
      <button type="button" className="wordmark" onClick={onHome}>
        <span className="wordmark-mark" aria-hidden="true" />
        PDF Insight
      </button>
      <div className="header-actions">
        <p className={`health health-${health}`} role="status">
          <span className="health-dot" aria-hidden="true" />
          {t.header.health[health]}
        </p>
        <div className="language">
          <label htmlFor={languageId} className="language-label">
            {t.languageLabel}
          </label>
          <span className="language-control">
            {/* Keyed by language so the globe gives a little spin on every switch. */}
            <span key={language} className="language-globe" aria-hidden="true" />
            <select
              id={languageId}
              className="language-select"
              value={language}
              onChange={(event) => {
                if (isLanguage(event.target.value)) setLanguage(event.target.value);
              }}
            >
              {LANGUAGES.map((code) => (
                <option key={code} value={code} lang={code}>
                  {LANGUAGE_NAMES[code]}
                </option>
              ))}
            </select>
          </span>
        </div>
        <button
          type="button"
          className="button button-quiet"
          aria-expanded={historyOpen}
          aria-controls="history"
          onClick={onToggleHistory}
        >
          {t.header.history}
          {historyCount > 0 ? ` (${historyCount})` : ''}
        </button>
      </div>
    </header>
  );
}
