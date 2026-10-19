import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ApiError } from '../api/client';
import { useI18n } from './context';
import { apiErrorMessage, fileCheckMessage } from './errors';
import { I18nProvider, LANGUAGE_KEY } from './I18nProvider';
import { MESSAGES } from './messages';

function Probe() {
  const { language, t } = useI18n();
  return <p>{`${language}: ${t.result.summary}`}</p>;
}

describe('I18nProvider', () => {
  it('defaults to Polish', () => {
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByText('pl: Podsumowanie')).toBeInTheDocument();
  });

  it('restores a saved language and ignores invalid values', () => {
    localStorage.setItem(LANGUAGE_KEY, 'en');
    const { unmount } = render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByText('en: Summary')).toBeInTheDocument();
    unmount();

    localStorage.setItem(LANGUAGE_KEY, 'de');
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByText('pl: Podsumowanie')).toBeInTheDocument();
  });
});

describe('messages', () => {
  it('shows the detailed server message in Polish and the own text in English', () => {
    const error = new ApiError('TOO_MANY_PAGES', 'Dokument jest zbyt długi (liczba stron: 600).');
    expect(apiErrorMessage(error, MESSAGES.pl, 'pl')).toBe(
      'Dokument jest zbyt długi (liczba stron: 600).',
    );
    expect(apiErrorMessage(error, MESSAGES.en, 'en')).toBe('The document has too many pages.');
    expect(apiErrorMessage(new ApiError('NETWORK_ERROR'), MESSAGES.pl, 'pl')).toMatch(
      /Nie udało się połączyć/,
    );
  });

  it('formats file problems with the size in the interface locale', () => {
    const check = { ok: false, problem: 'tooLarge', size: 12.5 * 1024 * 1024 } as const;
    expect(fileCheckMessage(check, MESSAGES.en, 'en-GB')).toBe(
      'The file is too large (12.5 MB). The maximum size is 10 MB.',
    );
    expect(fileCheckMessage(check, MESSAGES.pl, 'pl-PL')).toBe(
      'Plik jest za duży (12,5 MB). Maksymalny rozmiar to 10 MB.',
    );
    expect(fileCheckMessage({ ok: true }, MESSAGES.pl, 'pl-PL')).toBeNull();
  });

  it('has an English text for every Polish error code', () => {
    expect(Object.keys(MESSAGES.en.apiErrors).sort()).toEqual(
      Object.keys(MESSAGES.pl.apiErrors).sort(),
    );
  });
});
