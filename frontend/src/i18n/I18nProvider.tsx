import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { I18nContext, type I18n } from './context';
import { isLanguage, LOCALES, MESSAGES, type Language } from './messages';

export const LANGUAGE_KEY = 'pdf-insight:language';

function storedLanguage(): Language {
  try {
    const value = localStorage.getItem(LANGUAGE_KEY);
    if (isLanguage(value)) return value;
  } catch {
    // Storage is unavailable (private mode, blocked cookies); use the default.
  }
  // Polish is the default: the brief asks for Polish messages.
  return 'pl';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(storedLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    try {
      localStorage.setItem(LANGUAGE_KEY, next);
    } catch {
      // The choice still applies for this visit.
    }
  }, []);

  const value = useMemo<I18n>(
    () => ({ language, locale: LOCALES[language], t: MESSAGES[language], setLanguage }),
    [language, setLanguage],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
