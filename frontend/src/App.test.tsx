import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { analyzePdf, ApiError, checkHealth, translateTexts } from './api/client';
import { App } from './App';
import { I18nProvider, LANGUAGE_KEY } from './i18n/I18nProvider';
import { clearTranslationMemory } from './lib/useTranslatedResult';
import { sampleResult } from './test/fixtures';

vi.mock('./api/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('./api/client')>();
  return { ...original, analyzePdf: vi.fn(), checkHealth: vi.fn(), translateTexts: vi.fn() };
});

const analyzeMock = vi.mocked(analyzePdf);
const translateMock = vi.mocked(translateTexts);

function renderApp() {
  return render(
    <I18nProvider>
      <App />
    </I18nProvider>,
  );
}

function pdf(name = 'umowa.pdf'): File {
  return new File(['%PDF-1.4\n%test'], name, { type: 'application/pdf' });
}

describe('App', () => {
  afterEach(() => {
    clearTranslationMemory();
  });

  beforeEach(() => {
    analyzeMock.mockReset();
    translateMock.mockReset();
    vi.mocked(checkHealth).mockResolvedValue('ready');
  });

  it('shows the empty state with an upload area and a privacy note', async () => {
    renderApp();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Przeciągnij tutaj plik PDF/ })).toBeInTheDocument();
    expect(screen.getByText(/Twój plik trafia do usługi AI/)).toBeInTheDocument();
    expect(await screen.findByText('Serwer gotowy')).toBeInTheDocument();
  });

  it('analyses a PDF and shows the summary, amounts and dates', async () => {
    analyzeMock.mockResolvedValue(sampleResult());
    const user = userEvent.setup();
    renderApp();

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
    renderApp();

    await user.upload(
      screen.getByTestId('file-input'),
      new File(['hello'], 'notatka.txt', { type: 'text/plain' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('To nie jest plik PDF');
    expect(analyzeMock).not.toHaveBeenCalled();
  });

  it('shows an error with a retry option', async () => {
    analyzeMock
      .mockRejectedValueOnce(new ApiError('AI_TIMEOUT', 'Usługa AI nie odpowiedziała na czas.'))
      .mockResolvedValueOnce(sampleResult());
    const user = userEvent.setup();
    renderApp();

    await user.upload(screen.getByTestId('file-input'), pdf());
    expect(await screen.findByText('Usługa AI nie odpowiedziała na czas.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
    expect(await screen.findByRole('heading', { name: /Umowa ramowa/ })).toBeInTheDocument();
    expect(analyzeMock).toHaveBeenCalledTimes(2);
  });

  it('analyses the bundled sample contract', async () => {
    analyzeMock.mockResolvedValue(sampleResult());
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('%PDF-1.4\n%sample'));
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('button', { name: 'Przeanalizuj przykładową umowę' }));

    expect(await screen.findByRole('heading', { name: /Umowa ramowa/ })).toBeInTheDocument();
    const url = fetchMock.mock.calls[0]?.[0];
    expect(typeof url === 'string' ? url : '').toContain(
      'samples/Test_PDF_Insight_umowa_14-2026.pdf',
    );
    expect(analyzeMock.mock.calls[0]?.[0].name).toBe('Test_PDF_Insight_umowa_14-2026.pdf');
    fetchMock.mockRestore();
  });

  it('opens a saved result from the history', async () => {
    analyzeMock.mockResolvedValue(sampleResult());
    const user = userEvent.setup();
    renderApp();
    await user.upload(screen.getByTestId('file-input'), pdf());
    await screen.findByRole('heading', { name: /Umowa ramowa/ });

    await user.click(screen.getByRole('button', { name: 'Analizuj kolejny plik' }));
    await user.click(screen.getByRole('button', { name: 'Historia (1)' }));
    await user.click(screen.getByRole('button', { name: /Umowa ramowa nr 14\/2026/ }));

    expect(await screen.findByText(/z historii/)).toBeInTheDocument();
  });

  /** Fake translation: prefixes every text, so the test can see what was translated. */
  function englishOf(texts: string[]): string[] {
    return texts.map((text) => `EN ${text}`);
  }

  it('switches to English and translates summary, key points, amounts and dates', async () => {
    analyzeMock.mockResolvedValue(sampleResult());
    translateMock.mockImplementation((texts) => Promise.resolve(englishOf(texts)));
    const user = userEvent.setup();
    renderApp();
    await user.upload(screen.getByTestId('file-input'), pdf());
    await screen.findByRole('heading', { name: /Umowa ramowa/ });

    await user.selectOptions(screen.getByLabelText('Język'), 'en');

    expect(screen.getByLabelText('Language')).toHaveValue('en');
    expect(document.documentElement.lang).toBe('en');
    expect(localStorage.getItem(LANGUAGE_KEY)).toBe('en');
    expect(screen.getByRole('button', { name: 'Download JSON' })).toBeInTheDocument();

    const result = sampleResult();
    const summary = await screen.findByText(`EN ${result.summary}`);
    expect(summary).toHaveAttribute('lang', 'en');
    const panel = within(screen.getByRole('tabpanel', { name: 'Results' }));
    for (const point of result.keyPoints)
      expect(panel.getByText(`EN ${point}`)).toBeInTheDocument();
    expect(panel.getByText('EN wynagrodzenie za wdrożenie netto')).toBeInTheDocument();
    expect(panel.getByText('EN planowany Go-live')).toBeInTheDocument();
    expect(panel.getByText('184,500.00')).toBeInTheDocument();
    // One request for everything, no notes or links about the translation.
    expect(translateMock).toHaveBeenCalledTimes(1);
    expect(translateMock.mock.calls[0]?.[0]).toHaveLength(
      1 + result.keyPoints.length + result.amounts.length + result.dates.length,
    );
    expect(screen.queryByText(/translated automatically/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /original/i })).not.toBeInTheDocument();

    // The JSON keeps the document's language.
    await user.click(screen.getByRole('tab', { name: 'JSON' }));
    const json = screen.getByLabelText('JSON preview');
    expect(json).toHaveTextContent('dotyczy wdrożenia i utrzymania systemu CRM');
    expect(json).not.toHaveTextContent('EN ');

    // Back to Polish: the originals, no further request.
    await user.selectOptions(screen.getByLabelText('Language'), 'pl');
    await user.click(screen.getByRole('tab', { name: 'Wyniki' }));
    expect(
      screen.getByText(/dotyczy wdrożenia i utrzymania systemu CRM/, { selector: '.summary' }),
    ).toHaveAttribute('lang', 'pl');
    expect(screen.getByText('planowany Go-live')).toBeInTheDocument();
    expect(translateMock).toHaveBeenCalledTimes(1);
  });

  it('reuses a translation when the language is selected again', async () => {
    analyzeMock.mockResolvedValue(sampleResult());
    translateMock.mockImplementation((texts) => Promise.resolve(englishOf(texts)));
    const user = userEvent.setup();
    renderApp();
    await user.upload(screen.getByTestId('file-input'), pdf());
    await screen.findByRole('heading', { name: /Umowa ramowa/ });

    await user.selectOptions(screen.getByLabelText('Język'), 'en');
    await screen.findByText(`EN ${sampleResult().summary}`);
    await user.selectOptions(screen.getByLabelText('Language'), 'pl');
    await user.selectOptions(screen.getByLabelText('Język'), 'en');

    expect(await screen.findByText(`EN ${sampleResult().summary}`)).toBeInTheDocument();
    expect(translateMock).toHaveBeenCalledTimes(1);
  });

  it('keeps the original texts when the translation fails', async () => {
    analyzeMock.mockResolvedValue(sampleResult());
    translateMock
      .mockRejectedValueOnce(new ApiError('AI_UNAVAILABLE', 'Niedostępna.'))
      .mockImplementationOnce((texts) => Promise.resolve(englishOf(texts)));
    const user = userEvent.setup();
    renderApp();
    await user.upload(screen.getByTestId('file-input'), pdf());
    await screen.findByRole('heading', { name: /Umowa ramowa/ });

    await user.selectOptions(screen.getByLabelText('Język'), 'en');

    expect(await screen.findByText(/The results could not be translated/)).toBeInTheDocument();
    expect(screen.getByText(/The AI service is temporarily unavailable/)).toBeInTheDocument();
    expect(
      screen.getByText(/dotyczy wdrożenia i utrzymania systemu CRM/, { selector: '.summary' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(`EN ${sampleResult().summary}`)).toBeInTheDocument();
    expect(screen.queryByText(/could not be translated/)).not.toBeInTheDocument();
  });

  it('shows errors and file problems in the selected language', async () => {
    localStorage.setItem(LANGUAGE_KEY, 'en');
    analyzeMock.mockRejectedValue(new ApiError('PDF_NO_TEXT', 'Nie udało się odczytać tekstu.'));
    const user = userEvent.setup({ applyAccept: false });
    renderApp();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/structured data/);
    await user.upload(
      screen.getByTestId('file-input'),
      new File(['hello'], 'note.txt', { type: 'text/plain' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('This is not a PDF file');

    await user.upload(screen.getByTestId('file-input'), pdf());
    expect(await screen.findByText(/No text could be read from the PDF/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });

  it('does not translate a summary that is already in the interface language', async () => {
    const english = sampleResult();
    english.document.language = 'en';
    analyzeMock.mockResolvedValue(english);
    localStorage.setItem(LANGUAGE_KEY, 'en');
    const user = userEvent.setup();
    renderApp();
    await user.upload(screen.getByTestId('file-input'), pdf());

    await screen.findByRole('heading', { name: /Umowa ramowa/ });
    expect(screen.queryByText(/translated automatically/)).not.toBeInTheDocument();
    expect(translateMock).not.toHaveBeenCalled();
  });
});
