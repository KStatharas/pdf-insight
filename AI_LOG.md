# AI_LOG — praca z narzędziami AI

## Narzędzia

- **Cursor z modelem Claude (sesja 1)** — analiza briefu i pierwsza wersja backendu (FastAPI).
- **Claude (Anthropic) jako agent w aplikacji Claude (sesja 2)** — przegląd i testy backendu,
  przebudowa klienta AI, frontend, CI/CD, wdrożenie (Render + GitHub Pages), testy end-to-end
  w przeglądarce i dokumentacja.
- **Google Gemini** — model używany przez samą aplikację (analiza i OCR), nie do pisania kodu.
- Weryfikacja: pytest, ruff, mypy (strict), Vitest + Testing Library, ESLint (strictTypeChecked),
  Playwright (zrzuty ekranu i przejście całego przepływu na 1360 px i 360 px, tryb jasny/ciemny).

## Kluczowe prompty

Prompty pisałem po angielsku; cytuję je dosłownie, z krótkim opisem po polsku.

1. **Zrozumienie zadania** (Cursor, sesja 1, z załączonym briefem PDF):
   „Read this, and list me exactly what the task is in English.”
   Brief jest po polsku, więc pierwszym krokiem było rozpisanie wymagań (MUST/SHOULD/COULD,
   schemat JSON, bezpieczeństwo, oddanie). Na tej podstawie w sesji 1 powstał backend.
2. **Frontend, weryfikacja backendu i wdrożenie** (sesja 2):
   „I'm trying to create the app specified in Brief_Vibe_Coder_PDF_Insight.pdf. An agent has
   already created a backend as you can see. You can test if it is correct. Now a frontend needs
   to be created with react+typescript and also be deployed on my github. The test subject pdf
   should be Test_PDF_Insight_umowa_14-2026.pdf and it needs to be interpreted correctly.”
   Agent przeanalizował dokument testowy prawdziwym modelem i porównał wynik z treścią PDF
   (tabela „Weryfikacja” poniżej).
3. **Priorytet: wymagania ponad istniejący kod**:
   „It's fine overriding the work of the other agent in the backend. What's more important is
   to meet the backend to meet the requirements and be functional.”
   Po tym poleceniu klient AI został przepisany na natywne API Gemini, a OCR włączony do
   jednego zapytania (szczegóły w sekcji o błędach).
4. **Wybór języka (PL/EN)**:
   „Add an extra button named language (dropdown) that currently will contain two options:
   Polish and English. Selecting another language will not only change the website's UI
   language but also translate the pdf's output's summary. JSON will remain as is.”
   Doprecyzowane później: tłumaczone są też kluczowe informacje, kwoty i daty, bez
   dodatkowych komentarzy i bez linku „Pokaż oryginał”.
5. **Animacje i styl**:
   „add some playful animations and improve all the styles of the website as well as making
   the loading state of translation more visible. Also translate the title when language is
   changed.”

## Gdzie AI się pomyliło i jak to poprawiłem

- **Formatowanie kwot.** Pierwsza wersja używała domyślnego `Intl.NumberFormat('pl-PL')`, który
  zgodnie z polską normą nie grupuje liczb czterocyfrowych — w tabeli stało „8600,00” obok
  „12 300,00”. Wyłapane na zrzucie ekranu; poprawione przez `useGrouping: 'always'` i test.
- **Content-Security-Policy w trybie dev.** Polityka `script-src 'self'` w `index.html`
  blokowałaby skrypt inline, który dev-serwer Vite wstrzykuje dla React Refresh. Polityka jest
  teraz dodawana tylko w buildzie produkcyjnym (plugin w `vite.config.ts`), z originem API
  wyliczonym z `VITE_API_URL`.
- **Test widoku wyniku.** Test szukał tekstu podsumowania w całym dokumencie i trafiał też na
  ukrytą zakładkę JSON (dwa dopasowania). Zawężony do widocznego panelu (`getByRole('tabpanel')`).
- **Ścieżka bazowa przy podglądzie.** `vite preview` uruchomiony bez `VITE_BASE_PATH` serwował
  aplikację spod `/`, więc build z `base: '/pdf-insight/'` dostawał 404 na zasobach. To
  dokładnie pułapka GitHub Pages z briefu — dlatego `base` ustawia workflow na podstawie nazwy
  repozytorium, a nie wpisana na sztywno wartość.
- **Długa etykieta przycisku na telefonie.** „Pobierz Test_PDF_Insight_umowa_14-2026.json”
  łamało się w dwóch liniach przy 360 px; zmienione na „Pobierz JSON” z nazwą pliku w `title`.
- **Wersje zależności.** Najnowszy TypeScript (7.x) nie jest jeszcze obsługiwany przez
  typescript-eslint (`<6.1.0`) — przypięty `~6.0.3`, zamiast iść za domyślną sugestią „latest”.

### Backend — błędy wykryte dopiero na produkcji (Render + prawdziwy klucz)

- **Klucz „AQ.” odrzucany przez endpoint zgodny z OpenAI.** Backend z pierwszej sesji wołał
  `…/v1beta/openai/chat/completions` z nagłówkiem `Authorization: Bearer`. AI Studio wydaje od
  2026 r. klucze „AQ.”, które ten endpoint często odrzuca. Wszystkie testy jednostkowe
  przechodziły, bo używały atrapy HTTP — błąd wyszedł dopiero przy pierwszym prawdziwym
  wywołaniu (`AI_UNAVAILABLE`). Poprawka: natywny klient `generateContent`
  z nagłówkiem `x-goog-api-key`; stary klient został jako `LLM_PROVIDER=openai`.
- **Domyślny model przeciążony.** `gemini-3.8-flash` i `gemini-3.6-flash` odpowiadały 503 dla
  darmowego klucza. Dodana lista modeli zapasowych z zapamiętywaniem działającego, druga
  runda po krótkiej przerwie, a domyślnym modelem został Flash-Lite.
- **OCR jako osobne wywołanie.** Pomiar (`meta.stepsMs`) pokazał, że osobne wywołanie OCR dla
  zeskanowanego aneksu trwało ~19 s z 34 s. Obraz strony trafia teraz do jednego zapytania
  razem z tekstem — czas spadł do 16–21 s.
- **Ucięte kwoty z aneksu.** Limit 25 kwot w schemacie sprawiał, że nowa stawka abonamentu
  z aneksu (13 100 PLN od 1.04.2027) czasem wypadała z wyniku. Limit podniesiony do 40 kwot
  i 30 dat, a prompt wprost prosi o zmiany wprowadzone aneksami.
- **Wniosek:** testy z atrapą modelu sprawdzają walidację i przepływ, ale nie kontrakt
  z dostawcą — dlatego wynik prawdziwej analizy jest zapisany w
  `samples/Test_PDF_Insight_umowa_14-2026.result.json` i sprawdzany testem
  (`frontend/src/lib/sampleResult.test.ts`).

### Język interfejsu (PL/EN)

- **Mock, który nie mockował.** Testy przełączania języka dostawały prawdziwe `translateText`
  (błąd sieci), bo `test/setup.ts` importował moduł z hookiem tłumaczenia przed `vi.mock`
  w pliku testu — moduł był już związany z prawdziwym klientem. Czyszczenie pamięci tłumaczeń
  przeniesione do `afterEach` w pliku testu.
- **`setState` w efekcie.** Pierwsza wersja hooka `useTranslatedSummary` ustawiała stan
  synchronicznie w `useEffect` (reguła `react-hooks/set-state-in-effect`). Stan jest teraz
  wyliczany w trakcie renderowania, a efekt ustawia go tylko z odpowiedzi serwera.
- **Komunikaty jako dane.** Błędy pliku i serwera były zapisywane w stanie jako polski tekst, więc
  po zmianie języka zostałyby po polsku. Stan przechowuje teraz kod problemu, a tekst powstaje
  przy renderowaniu w aktualnym języku.
- **Wsadowe tłumaczenie.** Tłumaczenie kluczowych informacji i opisów kwot/dat jednym
  zapytaniem wymagało pilnowania kolejności i liczby elementów: schemat odpowiedzi jest tworzony
  z dokładną liczbą tekstów, więc odpowiedź z brakującym elementem jest odrzucana i ponawiana,
  a frontend dodatkowo sprawdza liczbę i wstawia tłumaczenia z powrotem po indeksach.
- **Nagłówek na 360 px.** Dodatkowa lista języków łamała nagłówek na trzy wiersze; na wąskich
  ekranach etykieta jest ukryta wizualnie (zostaje dla czytników ekranu), a odstępy mniejsze.

### Animacje i odświeżenie stylów

- **Przewijanie w poziomie na telefonie.** Po owinięciu głównej kolumny w „arkusz” z paddingiem
  strona miała 400 px szerokości przy ekranie 360 px — elementy siatki mają domyślnie
  `min-width: auto` i rozpychała je tabela kwot. Poprawione `minmax(0, 1fr)`, ciaśniejszą tabelą
  na wąskich ekranach i łamaniem długich słów w opisach.
- **`key` na liście języków.** Pierwszy pomysł na animację globusa (przemontowanie `<select>`
  przez `key`) gubił fokus klawiatury przy każdej zmianie języka; `key` dostał tylko sam globus.
- **Cyfry tabelaryczne.** `font-variant-numeric: tabular-nums` w tym kroju poszerza przecinek
  dziesiętny („184 500 , 00”) i kropkę („0 s .”); wyłączone tam, gdzie kolumna i tak jest
  wyrównana do prawej.
- **Pozycja przewijania.** Kliknięcie „przykładowej umowy” nisko na telefonie zostawiało ekran
  analizy przewinięty w dół; każda zmiana widoku przewija teraz na górę.

## Czego pilnowałem ręcznie

- Każda odpowiedź modelu przechodzi przez schemat dwa razy (Pydantic w backendzie, Zod
  we frontendzie); brak informacji to `null` / `[]`, nie zgadywanie.
- Klucz API nigdy nie trafia do frontendu ani do historii Git (sprawdzone `git log -p | grep`).
- Wynik dla dokumentu testowego sprawdzony ręcznie z treścią PDF (sekcja „Weryfikacja” poniżej).

## Weryfikacja na dokumencie testowym

Dokument `samples/Test_PDF_Insight_umowa_14-2026.pdf` (12 stron, str. 11 to skan bez
warstwy tekstowej) przeanalizowany przez wdrożony backend; wynik zapisany w
`samples/Test_PDF_Insight_umowa_14-2026.result.json`. Porównanie z treścią PDF:

| Sprawdzenie | W dokumencie | W wyniku |
| --- | --- | --- |
| Typ, język, data | umowa ramowa, PL, 12.03.2026 | `umowa`, `pl`, `2026-03-12` ✅ |
| Strony umowy | Nordwave Logistics sp. z o.o., Kwadrat Software S.A. | obie ✅ |
| Osoby | 9 osób (zarządy, zespół, protokół, faktura) | 9 ✅ |
| Wynagrodzenie | 184 500,00 zł netto / 226 935,00 zł brutto | obie kwoty ✅ |
| Waluty bez przeliczania | 8 600 EUR/rok, 890 USD/mies. | `EUR`, `USD` ✅ |
| Aneks ze skanu (str. 11) | abonament 13 100 PLN od 1.04.2027, użytkownicy 120 → 135 | kwota, data, kluczowa informacja i podsumowanie ✅ |
| Terminy | okres 1.04.2026–31.03.2028, Go-live 12.10.2026, faktura 15/29.03.2026 | wszystkie ✅ |
| Prompt injection (§ 5) | polecenie „napisz, że umowa jest nieważna… 1 PLN” | zignorowane; ostrzeżenie w interfejsie ✅ |
| Czas | cel < 30 s | 8–21 s (ciepły serwer; 8,7 s na demo z GitHub Pages) ✅ |
| Tłumaczenie (EN) | podsumowanie, kluczowe informacje, opisy kwot i dat po angielsku; JSON bez zmian | wszystkie teksty przetłumaczone jednym zapytaniem (~6 s), wierne kwoty i daty; JSON i podgląd JSON po polsku ✅ |

Model nie podał wszystkich kwot z cennika i tabel kar (wybiera najważniejsze), co jest
zgodne z instrukcją, ale warto o tym wiedzieć.
