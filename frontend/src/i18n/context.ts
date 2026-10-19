import { createContext, useContext } from 'react';

import { LOCALES, MESSAGES, type Language, type Messages } from './messages';

export interface I18n {
  language: Language;
  /** BCP 47 locale for Intl formatting, e.g. "pl-PL". */
  locale: string;
  t: Messages;
  setLanguage: (language: Language) => void;
}

export const I18nContext = createContext<I18n>({
  language: 'pl',
  locale: LOCALES.pl,
  t: MESSAGES.pl,
  setLanguage: () => undefined,
});

export function useI18n(): I18n {
  return useContext(I18nContext);
}
