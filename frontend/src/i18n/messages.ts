import type { DocumentType } from '../lib/schema';

export const LANGUAGES = ['pl', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

/** Locale used by Intl for numbers and dates in each interface language. */
export const LOCALES: Record<Language, string> = { pl: 'pl-PL', en: 'en-GB' };

/** Language names in their own language, as shown in the language picker. */
export const LANGUAGE_NAMES: Record<Language, string> = { pl: 'Polski', en: 'English' };

export type ApiErrorCode =
  | 'NOT_A_PDF'
  | 'FILE_TOO_LARGE'
  | 'EMPTY_FILE'
  | 'PDF_UNREADABLE'
  | 'PDF_ENCRYPTED'
  | 'PDF_NO_TEXT'
  | 'TOO_MANY_PAGES'
  | 'RATE_LIMITED'
  | 'AI_NOT_CONFIGURED'
  | 'AI_UNAVAILABLE'
  | 'AI_TIMEOUT'
  | 'AI_RATE_LIMITED'
  | 'AI_INVALID_RESPONSE'
  | 'AI_REFUSED'
  | 'SERVER_BUSY'
  | 'INTERNAL_ERROR'
  | 'BAD_REQUEST'
  | 'LENGTH_REQUIRED'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'HTTP_ERROR'
  | 'INVALID_RESULT'
  | 'ABORTED'
  | 'UNKNOWN';

const pl = {
  skipLink: 'Przejdź do treści',
  languageLabel: 'Język',
  header: {
    history: 'Historia',
    health: {
      checking: 'Łączenie z serwerem…',
      ready: 'Serwer gotowy',
      'not-configured': 'Serwer bez konfiguracji AI',
      offline: 'Serwer niedostępny',
    },
  },
  footer:
    'PDF Insight · plik jest przesyłany do serwera aplikacji i usługi AI (Google Gemini) wyłącznie w celu analizy i nie jest przechowywany. Historia analiz zostaje tylko w tej przeglądarce.',
  upload: {
    title: 'Streszczenie i dane z dokumentu PDF w kilkanaście sekund',
    lede: 'Wgraj umowę, fakturę, ofertę albo raport. Dostaniesz krótkie podsumowanie, kwoty, terminy i strony dokumentu oraz plik JSON do dalszej pracy.',
    dropTitle: 'Przeciągnij tutaj plik PDF',
    dropActive: 'Upuść plik, aby rozpocząć analizę',
    or: 'albo',
    choose: 'Wybierz plik z dysku',
    hint: (maxMb: number) => `Tylko PDF, maksymalnie ${maxMb} MB. Skany są odczytywane przez OCR.`,
    offline:
      'Serwer analizy nie odpowiada. Jeśli był uśpiony, uruchomi się po pierwszym żądaniu — możesz spróbować mimo to.',
    notConfigured:
      'Serwer działa, ale nie ma skonfigurowanego klucza usługi AI, więc analiza się nie uda.',
    samplePrompt: 'Nie masz pod ręką pliku?',
    sampleButton: 'Przeanalizuj przykładową umowę',
    sampleNote: '(12 stron, w tym skan aneksu)',
    sampleFailed: 'Nie udało się pobrać przykładowej umowy.',
    privacyLabel: 'Informacja o przetwarzaniu pliku',
    privacyStrong: 'Twój plik trafia do usługi AI.',
    privacy:
      'Tekst dokumentu jest wysyłany do serwera aplikacji, a stamtąd do modelu Google Gemini. Serwer nie zapisuje pliku. Nie wgrywaj dokumentów, których nie możesz udostępnić zewnętrznemu dostawcy.',
  },
  fileErrors: {
    notPdf: 'To nie jest plik PDF. Wybierz plik z rozszerzeniem .pdf.',
    empty: 'Plik jest pusty.',
    tooLarge: (size: string, maxMb: number) =>
      `Plik jest za duży (${size}). Maksymalny rozmiar to ${maxMb} MB.`,
    badSignature: 'Plik ma rozszerzenie .pdf, ale nie jest poprawnym dokumentem PDF.',
  },
  progress: {
    title: 'Analizuję dokument',
    upload: 'Wysyłanie pliku',
    analysis: 'Odczyt tekstu, OCR skanów i analiza AI',
    done: 'gotowe',
    running: 'w toku',
    waiting: 'czeka',
    elapsed: (seconds: number) => `Upłynęło ${seconds} s. Zwykle trwa to 10–25 sekund.`,
    statusUpload: 'Wysyłanie pliku',
    statusAnalysis: 'Trwa analiza dokumentu',
    cancel: 'Anuluj',
  },
  error: {
    title: 'Analiza się nie udała',
    file: 'Plik',
    retry: 'Spróbuj ponownie',
    other: 'Wybierz inny plik',
  },
  apiErrors: {
    NOT_A_PDF: 'Plik nie jest poprawnym dokumentem PDF.',
    FILE_TOO_LARGE: 'Plik jest za duży. Maksymalny rozmiar to 10 MB.',
    EMPTY_FILE: 'Przesłany plik jest pusty.',
    PDF_UNREADABLE: 'Nie udało się odczytać pliku PDF. Plik może być uszkodzony.',
    PDF_ENCRYPTED: 'Plik PDF jest zabezpieczony hasłem. Usuń zabezpieczenie i spróbuj ponownie.',
    PDF_NO_TEXT:
      'Nie udało się odczytać tekstu z pliku PDF. Dokument jest pusty albo jest nieczytelnym skanem.',
    TOO_MANY_PAGES: 'Dokument ma zbyt wiele stron.',
    RATE_LIMITED: 'Wykonano zbyt wiele zapytań w krótkim czasie. Spróbuj ponownie za kilka minut.',
    AI_NOT_CONFIGURED: 'Usługa AI jest nieprawidłowo skonfigurowana po stronie serwera.',
    AI_UNAVAILABLE: 'Usługa AI jest chwilowo niedostępna. Spróbuj ponownie za chwilę.',
    AI_TIMEOUT: 'Usługa AI nie odpowiedziała na czas. Spróbuj ponownie.',
    AI_RATE_LIMITED: 'Wyczerpano chwilowy limit zapytań do usługi AI. Spróbuj ponownie za minutę.',
    AI_INVALID_RESPONSE: 'Model AI zwrócił niepoprawną odpowiedź. Spróbuj ponownie za chwilę.',
    AI_REFUSED: 'Usługa AI odmówiła analizy tego dokumentu (filtr bezpieczeństwa dostawcy).',
    SERVER_BUSY: 'Serwer analizuje teraz inne dokumenty. Spróbuj ponownie za chwilę.',
    INTERNAL_ERROR: 'Wystąpił nieoczekiwany błąd serwera. Spróbuj ponownie.',
    BAD_REQUEST: 'Serwer odrzucił żądanie jako niepoprawne.',
    LENGTH_REQUIRED: 'Serwer odrzucił żądanie jako niepoprawne.',
    NETWORK_ERROR:
      'Nie udało się połączyć z serwerem. Sprawdź połączenie z internetem i spróbuj ponownie.',
    TIMEOUT: 'Serwer nie odpowiedział na czas. Spróbuj ponownie.',
    HTTP_ERROR: 'Serwer zwrócił nieoczekiwany błąd. Spróbuj ponownie.',
    INVALID_RESULT: 'Odpowiedź serwera nie jest zgodna ze schematem wyniku. Spróbuj ponownie.',
    ABORTED: 'Analizę anulowano.',
    UNKNOWN: 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie.',
  } satisfies Record<ApiErrorCode, string>,
  history: {
    title: 'Ostatnie analizy',
    clear: 'Wyczyść historię',
    close: 'Zamknij',
    empty:
      'Nie ma jeszcze zapisanych analiz. Wyniki zapisują się automatycznie w tej przeglądarce.',
    remove: 'Usuń',
    removeLabel: (name: string) => `Usuń z historii: ${name}`,
  },
  result: {
    documentType: 'Typ dokumentu',
    documentDate: (date: string) => `Data dokumentu: ${date}`,
    noDate: 'Brak daty dokumentu',
    fromHistory: (when: string) => `z historii, ${when}`,
    tabsLabel: 'Widok wyniku',
    tabView: 'Wyniki',
    tabJson: 'JSON',
    download: 'Pobierz JSON',
    downloaded: 'Pobrano',
    downloadTitle: (name: string) => `Zapisz plik ${name}`,
    analyseAnother: 'Analizuj kolejny plik',
    warningsLabel: 'Ostrzeżenia',
    summary: 'Podsumowanie',
    keyPoints: 'Najważniejsze informacje',
    amounts: 'Kwoty',
    dates: 'Terminy',
    document: 'Dokument',
    file: 'Plik',
    type: 'Typ',
    length: 'Długość',
    language: 'Język',
    analysisTime: 'Czas analizy',
    ocr: 'OCR',
    ocrPages: (pages: number[]) =>
      `${pages.length === 1 ? 'strona' : 'strony'} ${pages.join(', ')}`,
    model: 'Model',
    organizations: 'Organizacje',
    people: 'Osoby',
    keywords: 'Słowa kluczowe',
    none: 'Brak.',
    notMentioned: 'Nie wymieniono.',
    unknownLanguage: 'nieznany',
  },
  translation: {
    translating: 'Tłumaczę…',
    failed: 'Nie udało się przetłumaczyć wyników.',
    retry: 'Spróbuj ponownie',
  },
  notices: {
    PROMPT_INJECTION:
      'Dokument zawiera tekst wyglądający na polecenia dla systemu AI. Został potraktowany jako zwykła treść dokumentu i nie został wykonany.',
    UNREAD_PAGES: (pages: number[]) =>
      `Nie odczytano tekstu ze stron bez warstwy tekstowej: ${pages.join(', ')}.`,
    TRUNCATED: (percent: number | null) =>
      `Dokument jest bardzo długi, dlatego przeanalizowano tylko jego początkową część (ok. ${String(percent ?? '?')}% treści).`,
  },
  amounts: {
    caption: 'Kwoty wymienione w dokumencie',
    context: 'Czego dotyczy',
    value: 'Kwota',
    currency: 'Waluta',
    empty: 'Dokument nie zawiera kwot.',
    noContext: 'brak opisu',
  },
  dates: {
    empty: 'Dokument nie zawiera dat.',
    noContext: 'brak opisu',
  },
  json: {
    note: 'Wynik zgodny ze schematem z briefu, sprawdzony przed wyświetleniem, zawsze w języku dokumentu. Pole meta zawiera dodatkowe informacje o przebiegu analizy.',
    copy: 'Kopiuj JSON',
    copied: 'Skopiowano',
    copyFailed: 'Nie udało się skopiować',
    previewLabel: 'Podgląd JSON',
  },
  documentTypes: {
    faktura: 'Faktura',
    umowa: 'Umowa',
    oferta: 'Oferta',
    raport: 'Raport',
    inne: 'Inny dokument',
  } satisfies Record<DocumentType, string>,
  pages: (count: number) => {
    if (count === 1) return '1 strona';
    const lastDigit = count % 10;
    const lastTwo = count % 100;
    if (lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14))
      return `${count} strony`;
    return `${count} stron`;
  },
};

export type Messages = typeof pl;

const en: Messages = {
  skipLink: 'Skip to content',
  languageLabel: 'Language',
  header: {
    history: 'History',
    health: {
      checking: 'Connecting to the server…',
      ready: 'Server ready',
      'not-configured': 'Server has no AI configured',
      offline: 'Server unavailable',
    },
  },
  footer:
    'PDF Insight · your file is sent to the application server and the AI service (Google Gemini) only to be analysed, and is not stored. The analysis history stays in this browser only.',
  upload: {
    title: 'A summary and structured data from any PDF in seconds',
    lede: 'Upload a contract, invoice, offer or report. You get a short summary, the amounts, dates and parties, and a JSON file for further work.',
    dropTitle: 'Drag a PDF file here',
    dropActive: 'Drop the file to start the analysis',
    or: 'or',
    choose: 'Choose a file',
    hint: (maxMb: number) => `PDF only, up to ${maxMb} MB. Scanned pages are read with OCR.`,
    offline:
      'The analysis server is not responding. If it was asleep, it starts on the first request, so you can try anyway.',
    notConfigured:
      'The server is running but has no AI service key configured, so the analysis will fail.',
    samplePrompt: 'No file at hand?',
    sampleButton: 'Analyse a sample contract',
    sampleNote: '(12 pages in Polish, including a scanned annex)',
    sampleFailed: 'Could not load the sample contract.',
    privacyLabel: 'How your file is processed',
    privacyStrong: 'Your file is sent to an AI service.',
    privacy:
      'The document text goes to the application server and from there to the Google Gemini model. The server does not store the file. Do not upload documents you cannot share with an external provider.',
  },
  fileErrors: {
    notPdf: 'This is not a PDF file. Choose a file with the .pdf extension.',
    empty: 'The file is empty.',
    tooLarge: (size: string, maxMb: number) =>
      `The file is too large (${size}). The maximum size is ${maxMb} MB.`,
    badSignature: 'The file has a .pdf extension but is not a valid PDF document.',
  },
  progress: {
    title: 'Analysing the document',
    upload: 'Uploading the file',
    analysis: 'Reading text, OCR of scans and AI analysis',
    done: 'done',
    running: 'in progress',
    waiting: 'waiting',
    elapsed: (seconds: number) => `${seconds} s elapsed. This usually takes 10–25 seconds.`,
    statusUpload: 'Uploading the file',
    statusAnalysis: 'Analysing the document',
    cancel: 'Cancel',
  },
  error: {
    title: 'The analysis failed',
    file: 'File',
    retry: 'Try again',
    other: 'Choose another file',
  },
  apiErrors: {
    NOT_A_PDF: 'The file is not a valid PDF document.',
    FILE_TOO_LARGE: 'The file is too large. The maximum size is 10 MB.',
    EMPTY_FILE: 'The uploaded file is empty.',
    PDF_UNREADABLE: 'The PDF file could not be read. It may be damaged.',
    PDF_ENCRYPTED: 'The PDF file is password-protected. Remove the protection and try again.',
    PDF_NO_TEXT: 'No text could be read from the PDF. The document is empty or an unreadable scan.',
    TOO_MANY_PAGES: 'The document has too many pages.',
    RATE_LIMITED: 'Too many requests in a short time. Try again in a few minutes.',
    AI_NOT_CONFIGURED: 'The AI service is not configured correctly on the server.',
    AI_UNAVAILABLE: 'The AI service is temporarily unavailable. Try again in a moment.',
    AI_TIMEOUT: 'The AI service did not respond in time. Try again.',
    AI_RATE_LIMITED: 'The AI service request limit is used up for now. Try again in a minute.',
    AI_INVALID_RESPONSE: 'The AI model returned an invalid answer. Try again in a moment.',
    AI_REFUSED: "The AI service refused to analyse this document (the provider's safety filter).",
    SERVER_BUSY: 'The server is analysing other documents right now. Try again in a moment.',
    INTERNAL_ERROR: 'An unexpected server error occurred. Try again.',
    BAD_REQUEST: 'The server rejected the request as invalid.',
    LENGTH_REQUIRED: 'The server rejected the request as invalid.',
    NETWORK_ERROR: 'Could not connect to the server. Check your internet connection and try again.',
    TIMEOUT: 'The server did not respond in time. Try again.',
    HTTP_ERROR: 'The server returned an unexpected error. Try again.',
    INVALID_RESULT: 'The server response does not match the result schema. Try again.',
    ABORTED: 'The analysis was cancelled.',
    UNKNOWN: 'An unexpected error occurred. Try again.',
  },
  history: {
    title: 'Recent analyses',
    clear: 'Clear history',
    close: 'Close',
    empty: 'No saved analyses yet. Results are saved automatically in this browser.',
    remove: 'Remove',
    removeLabel: (name: string) => `Remove from history: ${name}`,
  },
  result: {
    documentType: 'Document type',
    documentDate: (date: string) => `Document date: ${date}`,
    noDate: 'No document date',
    fromHistory: (when: string) => `from history, ${when}`,
    tabsLabel: 'Result view',
    tabView: 'Results',
    tabJson: 'JSON',
    download: 'Download JSON',
    downloaded: 'Downloaded',
    downloadTitle: (name: string) => `Save ${name}`,
    analyseAnother: 'Analyse another file',
    warningsLabel: 'Warnings',
    summary: 'Summary',
    keyPoints: 'Key points',
    amounts: 'Amounts',
    dates: 'Dates',
    document: 'Document',
    file: 'File',
    type: 'Type',
    length: 'Length',
    language: 'Language',
    analysisTime: 'Analysis time',
    ocr: 'OCR',
    ocrPages: (pages: number[]) => `${pages.length === 1 ? 'page' : 'pages'} ${pages.join(', ')}`,
    model: 'Model',
    organizations: 'Organisations',
    people: 'People',
    keywords: 'Keywords',
    none: 'None.',
    notMentioned: 'None mentioned.',
    unknownLanguage: 'unknown',
  },
  translation: {
    translating: 'Translating…',
    failed: 'The results could not be translated.',
    retry: 'Try again',
  },
  notices: {
    PROMPT_INJECTION:
      'The document contains text that looks like instructions for an AI system. It was treated as ordinary document content and was not followed.',
    UNREAD_PAGES: (pages: number[]) =>
      `Text could not be read from pages without a text layer: ${pages.join(', ')}.`,
    TRUNCATED: (percent: number | null) =>
      `The document is very long, so only its first part was analysed (about ${String(percent ?? '?')}% of the content).`,
  },
  amounts: {
    caption: 'Amounts mentioned in the document',
    context: 'What it is for',
    value: 'Amount',
    currency: 'Currency',
    empty: 'The document contains no amounts.',
    noContext: 'no description',
  },
  dates: {
    empty: 'The document contains no dates.',
    noContext: 'no description',
  },
  json: {
    note: "The result matches the brief's schema, is validated before it is shown and always stays in the document's language. The meta field holds extra details about the analysis.",
    copy: 'Copy JSON',
    copied: 'Copied',
    copyFailed: 'Could not copy',
    previewLabel: 'JSON preview',
  },
  documentTypes: {
    faktura: 'Invoice',
    umowa: 'Contract',
    oferta: 'Offer',
    raport: 'Report',
    inne: 'Other document',
  },
  pages: (count: number) => (count === 1 ? '1 page' : `${count} pages`),
};

export const MESSAGES: Record<Language, Messages> = { pl, en };

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}
