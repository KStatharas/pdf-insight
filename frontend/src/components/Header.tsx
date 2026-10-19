import type { HealthStatus } from '../api/client';

const HEALTH_LABELS: Record<HealthStatus | 'checking', string> = {
  checking: 'Łączenie z serwerem…',
  ready: 'Serwer gotowy',
  'not-configured': 'Serwer bez konfiguracji AI',
  offline: 'Serwer niedostępny',
};

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
  return (
    <header className="header">
      <button type="button" className="wordmark" onClick={onHome}>
        <span className="wordmark-mark" aria-hidden="true" />
        PDF Insight
      </button>
      <div className="header-actions">
        <p className={`health health-${health}`} role="status">
          <span className="health-dot" aria-hidden="true" />
          {HEALTH_LABELS[health]}
        </p>
        <button
          type="button"
          className="button button-quiet"
          aria-expanded={historyOpen}
          aria-controls="history"
          onClick={onToggleHistory}
        >
          Historia{historyCount > 0 ? ` (${historyCount})` : ''}
        </button>
      </div>
    </header>
  );
}
