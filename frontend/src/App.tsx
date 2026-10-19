import { useCallback, useEffect, useRef, useState } from 'react';

import { analyzePdf, ApiError, checkHealth, type HealthStatus } from './api/client';
import { AnalysisProgress } from './components/AnalysisProgress';
import { ErrorPanel } from './components/ErrorPanel';
import { Header } from './components/Header';
import { HistoryPanel } from './components/HistoryPanel';
import { ResultView } from './components/ResultView';
import { UploadPanel } from './components/UploadPanel';
import { useI18n } from './i18n/context';
import { apiErrorMessage, fileCheckMessage } from './i18n/errors';
import {
  addToHistory,
  clearHistory,
  loadHistory,
  removeFromHistory,
  type HistoryEntry,
} from './lib/history';
import type { AnalysisResult } from './lib/schema';
import { checkFile, type FileCheck } from './lib/validateFile';

const SAMPLE_NAME = 'Test_PDF_Insight_umowa_14-2026.pdf';
const SAMPLE_URL = `${import.meta.env.BASE_URL}samples/${SAMPLE_NAME}`;

/** Problems are stored as data, not text, so they follow a later language change. */
type UploadProblem = FileCheck | 'sampleFailed' | null;

type View =
  | { status: 'idle'; problem: UploadProblem }
  | {
      status: 'working';
      file: File;
      phase: 'upload' | 'analysis';
      progress: number;
      startedAt: number;
    }
  | { status: 'error'; file: File; error: ApiError }
  | { status: 'done'; result: AnalysisResult; savedAt: string | null };

export function App() {
  const { t, language, locale } = useI18n();
  const [view, setView] = useState<View>({ status: 'idle', problem: null });
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [historyOpen, setHistoryOpen] = useState(false);
  const [health, setHealth] = useState<HealthStatus | 'checking'>('checking');
  const abortRef = useRef<AbortController | null>(null);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    void checkHealth(controller.signal).then((status) => {
      if (!controller.signal.aborted) setHealth(status);
    });
    return () => {
      controller.abort();
    };
  }, []);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  // Move focus to the new content when the view changes, so keyboard and screen-reader users
  // are not left on a button that no longer exists.
  useEffect(() => {
    if (view.status !== 'idle' && view.status !== 'working') mainRef.current?.focus();
  }, [view.status]);

  const analyze = useCallback(async (file: File) => {
    const check = await checkFile(file);
    if (!check.ok) {
      setView({ status: 'idle', problem: check });
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setView({ status: 'working', file, phase: 'upload', progress: 0, startedAt: Date.now() });

    try {
      const result = await analyzePdf(file, {
        signal: controller.signal,
        onPhase: (phase) => {
          setView((current) => (current.status === 'working' ? { ...current, phase } : current));
        },
        onUploadProgress: (progress) => {
          setView((current) => (current.status === 'working' ? { ...current, progress } : current));
        },
      });
      setHistory(addToHistory(result));
      setHealth('ready');
      setView({ status: 'done', result, savedAt: null });
    } catch (error) {
      if (controller.signal.aborted) {
        setView({ status: 'idle', problem: null });
        return;
      }
      setView({
        status: 'error',
        file,
        error: error instanceof ApiError ? error : new ApiError('UNKNOWN'),
      });
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, []);

  const analyzeSample = useCallback(async () => {
    let file: File;
    try {
      const response = await fetch(SAMPLE_URL);
      if (!response.ok) throw new Error(String(response.status));
      const bytes = await response.arrayBuffer();
      file = new File([bytes], SAMPLE_NAME, { type: 'application/pdf' });
    } catch {
      setView({ status: 'idle', problem: 'sampleFailed' });
      return;
    }
    await analyze(file);
  }, [analyze]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setView({ status: 'idle', problem: null });
  }, []);

  const openEntry = useCallback((entry: HistoryEntry) => {
    abortRef.current?.abort();
    setHistoryOpen(false);
    setView({ status: 'done', result: entry.result, savedAt: entry.savedAt });
  }, []);

  const uploadError =
    view.status !== 'idle' || view.problem === null
      ? null
      : view.problem === 'sampleFailed'
        ? t.upload.sampleFailed
        : fileCheckMessage(view.problem, t, locale);

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        {t.skipLink}
      </a>
      <Header
        health={health}
        historyCount={history.length}
        historyOpen={historyOpen}
        onToggleHistory={() => {
          setHistoryOpen((open) => !open);
        }}
        onHome={reset}
      />

      {historyOpen && (
        <HistoryPanel
          entries={history}
          onOpen={openEntry}
          onRemove={(id) => {
            setHistory(removeFromHistory(id));
          }}
          onClear={() => {
            clearHistory();
            setHistory([]);
          }}
          onClose={() => {
            setHistoryOpen(false);
          }}
        />
      )}

      <main id="main" ref={mainRef} tabIndex={-1} className="main">
        {view.status === 'idle' && (
          <UploadPanel
            error={uploadError}
            health={health}
            onFile={(file) => {
              void analyze(file);
            }}
            onSample={() => {
              void analyzeSample();
            }}
          />
        )}

        {view.status === 'working' && (
          <AnalysisProgress
            fileName={view.file.name}
            fileSize={view.file.size}
            phase={view.phase}
            progress={view.progress}
            startedAt={view.startedAt}
            onCancel={reset}
          />
        )}

        {view.status === 'error' && (
          <ErrorPanel
            fileName={view.file.name}
            message={apiErrorMessage(view.error, t, language)}
            retryable={view.error.retryable}
            onRetry={() => {
              void analyze(view.file);
            }}
            onReset={reset}
          />
        )}

        {view.status === 'done' && (
          <ResultView result={view.result} savedAt={view.savedAt} onNew={reset} />
        )}
      </main>

      <footer className="footer">
        <p>{t.footer}</p>
      </footer>
    </div>
  );
}
