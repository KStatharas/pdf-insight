import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { analyzePdf, ApiError, checkHealth } from './api/client';
import { App } from './App';
import { sampleResult } from './test/fixtures';

vi.mock('./api/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('./api/client')>();
  return { ...original, analyzePdf: vi.fn(), checkHealth: vi.fn() };
});

const analyzeMock = vi.mocked(analyzePdf);

function pdf(name = 'umowa.pdf'): File {
  return new File(['%PDF-1.4\n%test'], name, { type: 'application/pdf' });
}

describe('App', () => {
  beforeEach(() => {
    analyzeMock.mockReset();
    vi.mocked(checkHealth).mockResolvedValue('ready');
  });

  it('shows the empty state with an upload area and a privacy note', async () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Przeciągnij tutaj plik PDF/ })).toBeInTheDocument();
    expect(screen.getByText(/Twój plik trafia do usługi AI/)).toBeInTheDocument();
    expect(await screen.findByText('Serwer gotowy')).toBeInTheDocument();
  });

  it('analyses a PDF and shows the summary, amounts and dates', async () => {
    analyzeMock.mockResolvedValue(sampleResult());
    const user = userEvent.setup();
    render(<App />);

    await user.upload(screen.getByTestId('file-input'), pdf());

    expect(
      await screen.findByRole('heading', { level: 1, name: /Umowa ramowa nr 14\/2026/ }),
    ).toBeInTheDocument();
    // The JSON tab is hidden, so look only inside the visible results panel.
    const panel = within(screen.getByRole('tabpanel', { name: 'Wyniki' }));
    expect(panel.getByText(/dotyczy wdrożenia i utrzymania systemu CRM/)).toBeInTheDocument();
    expect(panel.getByText('wynagrodzenie za wdrożenie netto')).toBeInTheDocument();
    expect(panel.getByText('EUR')).toBeInTheDocument();
    expect(panel.getByText('planowany Go-live')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pobierz JSON' })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'JSON' }));
    expect(screen.getByLabelText('Podgląd JSON')).toHaveTextContent('"type": "umowa"');

    expect(screen.getByRole('button', { name: 'Historia (1)' })).toBeInTheDocument();
  });

  it('rejects a non-PDF file without calling the API', async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<App />);

    await user.upload(
      screen.getByTestId('file-input'),
      new File(['hello'], 'notatka.txt', { type: 'text/plain' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('To nie jest plik PDF');
    expect(analyzeMock).not.toHaveBeenCalled();
  });

  it('shows an error with a retry option', async () => {
    analyzeMock
      .mockRejectedValueOnce(
        new ApiError('AI_TIMEOUT', 'Usługa AI nie odpowiedziała na czas.', true),
      )
      .mockResolvedValueOnce(sampleResult());
    const user = userEvent.setup();
    render(<App />);

    await user.upload(screen.getByTestId('file-input'), pdf());
    expect(await screen.findByText('Usługa AI nie odpowiedziała na czas.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
    expect(await screen.findByRole('heading', { name: /Umowa ramowa/ })).toBeInTheDocument();
    expect(analyzeMock).toHaveBeenCalledTimes(2);
  });

  it('opens a saved result from the history', async () => {
    analyzeMock.mockResolvedValue(sampleResult());
    const user = userEvent.setup();
    render(<App />);
    await user.upload(screen.getByTestId('file-input'), pdf());
    await screen.findByRole('heading', { name: /Umowa ramowa/ });

    await user.click(screen.getByRole('button', { name: 'Analizuj kolejny plik' }));
    await user.click(screen.getByRole('button', { name: 'Historia (1)' }));
    await user.click(screen.getByRole('button', { name: /Umowa ramowa nr 14\/2026/ }));

    expect(await screen.findByText(/z historii/)).toBeInTheDocument();
  });
});
