# 1uglysaint — strona (MKFlow) · v21

## Co nowego w v21
- **Kontakt tylko przez Instagram:** `@1uglysaint` (products.js → `SHOP.instagram`). E-mail usunięty ze strony kontaktu, z telefonu i z zamówienia.
- **Nowy koszyk i zamówienie** (`koszyk.css` + część `script.js`, to samo na każdej stronie): szuflada z prawej, na telefonie cały ekran.
  - **01 KOSZYK:** zdjęcie maski, ilość − / +, USUŃ z możliwością COFNIJ, „dorzuć do zamówienia” (maski, których jeszcze nie ma w koszyku), suma.
  - **02 DANE:** imię i nazwisko, telefon, adres, uwagi. Pola są sprawdzane, a dane nigdzie się nie zapisują.
  - **03 WYSYŁKA:** protokół zamówienia z numerem (np. № US-0711-4821). Przycisk kopiuje treść i otwiera rozmowę z @1uglysaint na Instagramie, potem klient wkleja i wysyła. Po wysłaniu „WYSŁAŁEM” czyści koszyk.
  - Płatności na stronie nie ma: koszt wysyłki i płatność potwierdzacie w odpowiedzi na DM.

## Wcześniej: v20
- W sklepie zostały 3 maski: **001 SINISTER**, **002 KROWN**, **003 NAILED**. Reszta masek usunięta (z plików też).
- Za nimi w szynie jedno miejsce **„04–08 · SOON”** (klik = komunikat, że kolejne maski są w drodze). Liczbę miejsc zmieniasz w `products.js` → `SHOP.soon` (0 = bez SOON).
- Każda maska ma dwa widoki, przełącznik po lewej (na telefonie po prawej): **3D** (pierwszy, jak dotąd) i **FOTO** — zdjęcie maski na materiale. Na komputerze też strzałki ↑ ↓.
  Zdjęcia: `assets/masks/m07-foto.webp` (SINISTER), `m01-foto.webp` (KROWN), `m05-foto.webp` (NAILED) + miniatury `-foto-sm.webp`.
  W `products.js`: `images[0]` = maska w 3D, `images[1]` = zdjęcie na materiale.
- Intro, dziennik i kontakt biorą już tylko te 3 maski. Wygląd 3D (połysk, faktura, oczy w lustrze) siedzi teraz w `products.js` → `stage`.

Otwórz `index.html` (najlepiej Chrome). Działa z dysku i z hostingu, bez internetu — wszystkie biblioteki są w `assets/vendor/`.

## Strony
1. **`index.html` — INTRO + HERO**
   - Intro „TAŚMA_07.VHS” (raz na sesję; `index.html?intro` puszcza je ponownie).
   - Ściana twarzy oświetlana na żywo, wisząca lampa i dźwięk.
   - Na dole po prawej (na telefonie na dole ekranu) trzy monitory monitoringu: CAM 01 Sklep / CAM 02 Dziennik / CAM 03 Kontakt. W szumie widać podgląd pokoju, po najechaniu obraz się czyści.
   - Podglądy to `assets/hero/ch-*.webp` (400×250) — można podmienić na inne kadry.
2. **`sklep.html` — PRZYMIERZALNIA** (jeden ekran; wybór maski 01–03 na dole, dalej miejsce SOON)
   - **SALA:** jedna maska naraz jako prawdziwa bryła 3D (WebGL, `sala.js`).
     - Głowa obraca się za kursorem, a kursor świeci jak latarka i rzuca cienie.
     - Na telefonie sterujesz palcem albo pochyleniem telefonu.
     - Przy zmianie maski jedna twarz przepala się w drugą.
     - Na ścianie za maską jest jej numer, widoczny tylko tam, gdzie pada światło; w świetle unosi się kurz, a pod brodą widać odbicie jak na czarnym szkle.
     - **SKAN 3D** (przytrzymaj spację albo przycisk SKAN, na telefonie przytrzymaj palec): warstwice, siatka, promień skanera i punkty twarzy z żywymi współrzędnymi.
   - **LUSTRO** (`lustro.js`): kamera i maska na twojej twarzy w czasie rzeczywistym.
     - Twoje oczy patrzą przez otwory, a maska łapie światło z pokoju.
     - Bez kamery można wgrać zdjęcie.
     - Przycisk migawki robi kartę 1080×1920 pod relację: pobierz albo udostępnij.
     - Wszystko liczy się w przeglądarce, obraz nigdzie nie wychodzi.
3. **`maska.html`** — już tylko przekierowanie: stare linki `maska.html?id=003` otwierają tę maskę w sklepie (`sklep.html#003`).
4. **`dziennik.html` — DZIENNIK = PRZESŁUCHANIE** (jeden ekran)
   - Maska w 3D siedzi pod wiszącą lampą. Lampa się buja i naprawdę oświetla twarz; można ją pchnąć.
   - Trzy pytania: wysyłka (ile i kiedy), zwrot, kontakt.
   - Klikasz pytanie (albo klawisze 1–3), a maska podnosi głowę, patrzy w kamerę i odpowiada napisami jak w nagraniu z przesłuchania. Z włączonym dźwiękiem mruczy.
   - Zostawiona sama sobie, co jakiś czas odzywa się bez pytania. „⟳ INNY” zmienia podejrzanego.
   - **Treść odpowiedzi:** `dziennik.js` → tablica `QA` na górze pliku. `note` to dopisek „do uzupełnienia” — usuń go, kiedy wpiszesz prawdziwą odpowiedź.
5. **`kontakt.html` — KONTAKT = POŁĄCZENIE PRZYCHODZĄCE** (jeden ekran)
   - Chwilę po wejściu dzwoni telefon z maską na zdjęciu i trzęsie się jak na wibracji. Na telefonie cały ekran staje się tym połączeniem.
   - Odrzucisz — dzwoni jeszcze raz („nie rozłączaj się”). Odbierzesz — głos na linii i menu z klawiaturą: 1 zamówienie, 2 pytanie, 3 coś innego.
   - Potem wiadomość pisze się z tobą (przy zamówieniu wkleja się lista z koszyka i suma) i leci przez Instagram, e-mail albo schowek.
   - Obok telefonu (na telefonie — pasek u góry) zawsze widać zwykły kontakt: Instagram, e-mail, koszyk.

Koszyk jest wspólny dla wszystkich stron. ZAMAWIAM → gotowa wiadomość na Instagram / e-mail (bez bramki płatności).

**Podpis twórcy:** „STRONA ZROBIONA PRZEZ MKFLOW →” na każdej stronie — na komputerze pionowo przy prawej krawędzi, na telefonie jako czwarty przycisk w dolnym menu (na starcie pod monitorami). Klik otwiera `https://mkflow.pl` w nowej karcie. Adres i tekst: `pages.js`, blok `credit`.

## Gdzie co zmieniasz
- **Maski:** `products.js` — nazwa, łacina, patron, żywot, cena, status (`instock` / `limited` / `soldout`), szczegóły (`TO FILL` = zaczernione).
  - **Imiona, łacina, żywoty i ceny to propozycje — do potwierdzenia z właścicielem.**
- **Kontakt do zamówień:** `products.js` → `SHOP.instagram` (bez @) i/lub `SHOP.email`.
- **Wygląd masek w 3D:** `sklep.js` → `STAGE`
  - `spec` = połysk (lateks, chrom wyżej), `bump` = faktura.
  - `eyes` = w lustrze widać `both` (twoje oczy), `left` (tylko lewe) albo `mask` (oczy z maski).

## Nowa maska = nowe pliki 3D
Każda maska w sali i w lustrze potrzebuje plików wygenerowanych z jej zdjęcia:
- `assets/masks/mNN-tex.webp` / `-tex-m.webp` (kwadrat, przezroczyste tło),
- `mNN-depth.png` (mapa głębi),
- wpis w `assets/masks/geo.js` (468 punktów twarzy).

Robi to skrypt na komputerze (wykrywanie twarzy + mapa głębi), nie ręcznie — przy nowej masce daj znać, wygeneruję. Zdjęcie: twarz na wprost, przezroczyste albo jednolite tło, min. 2000 px.

## Pliki
| Pliki | Co robią |
|---|---|
| `sklep.html`, `sklep.css`, `sklep.js` | przymierzalnia |
| `sala.js` | silnik 3D sali |
| `lustro.js` | przymierzanie kamerą (ładuje się dopiero po kliknięciu) |
| `assets/vendor/facemesh/` | model twarzy MediaPipe (Apache 2.0) |
| `pages.css`, `pages.js` | wspólna skorupa podstron, przejścia TV |
| `cine.*`, `gl.js`, `intro.js`, `atmos.js` | hero, intro, lampa, dźwięk |
| `script.js`, `products.js` | koszyk, zamówienie, dane |

`*/offline.js` i `assets/fonts/font-offline.js` ładują się tylko przy otwarciu z dysku (`file://`), żeby wszystko działało bez serwera. Na hostingu nigdy się nie wczytują.

Na hostingu lustro wymaga **https** (przeglądarki dają kamerę tylko po https). Ograniczony ruch w systemie albo brak WebGL → wersja statyczna, wszystko czytelne i kupowalne.
