/* =========================================================================
   1uglysaint — WSZYSTKIE MASKI SĄ TUTAJ.
   Zmieniasz tylko ten plik — przymierzalnia, dziennik, hero, intro i koszyk
   aktualizują się same.

   SHOP: dokąd idą zamówienia i wiadomości.
     instagram: nick BEZ @ (zamówienie i wiadomości otwierają DM na ig.me)
     soon:      ile pustych miejsc „SOON” pokazać w sklepie za maskami (0 = żadnych)

   Każda maska:
     id        unikalny, 3 cyfry ("004" dla kolejnej)
     name      nazwa na sklepie, np. "SINISTER"
     latin     inskrypcja pod nazwą
     price     cena w PLN (liczba)
     status    "instock" | "limited" | "soldout"
     latest    true = należy do aktualnego dropu (liczy się w hero)
     images    [0] = maska w 3D (wycięta, przezroczyste tło; z niej są pliki -tex/-depth/-sm)
               [1] = zdjęcie maski na materiale (w sklepie przycisk FOTO)
     frame     zdjęcie na czarnym tle (używa go intro)
     stage     wygląd w 3D: spec = połysk, bump = faktura, eyes = 'both' | 'left' | 'mask' (lustro)
     patron    linijka pod nazwą
     attr      to, co maska „ma przy sobie”
     description  1–3 zdania w tonie marki
     details   wiersze karty: Materiał, Wymiary, Waga, Wykonanie…
               'TO FILL' = na stronie pokazuje się jako zaczernione „do uzupełnienia”
   ========================================================================= */

window.SHOP = {
  instagram: '1uglysaint',  // nick BEZ @ — tu idą zamówienia i wiadomości (DM na ig.me)
  shippingNote: 'Koszt wysyłki i płatność potwierdzamy w odpowiedzi na zamówienie.',
  soon: 5
};

const TBD = 'TO FILL';
const D = () => ({ 'Materiał': TBD, 'Wymiary': TBD, 'Waga': TBD, 'Wykonanie': TBD });

window.PRODUCTS = [
  { id: '001', name: 'SINISTER', latin: 'SANCTA TERTII OCULI', price: 319, status: 'instock', latest: true,
    images: ['assets/masks/m07.webp', 'assets/masks/m07-foto.webp'], frame: 'assets/masks/m07-blk.webp',
    stage: { spec: .32, bump: 1.6, eyes: 'mask' },
    patron: 'patronka tych, którzy widzą za dużo',
    attr: 'oko w czole, puste oczodoły',
    description: 'Oddała dwoje oczu w zamian za jedno, które widzi wszystko. Nie żałuje. Ty byś żałował.',
    details: D() },

  { id: '002', name: 'KROWN', latin: 'SANCTUS CORONATUS', price: 329, status: 'limited', latest: true,
    images: ['assets/masks/m01.webp', 'assets/masks/m01-foto.webp'], frame: 'assets/masks/m01-blk.webp',
    stage: { spec: .38, bump: 1.8, eyes: 'both' },
    patron: 'patron tych, którzy uśmiechają się, kiedy boli',
    attr: 'korona z własnej skóry, srebrne ćwieki',
    description: 'Koronę wyhodował sam, warstwa po warstwie, aż przestała przypominać ciało. Uśmiecha się zawsze — nikt nie wie, z czego.',
    details: D() },

  { id: '003', name: 'NAILED', latin: 'SANCTUS SUBRIDENS', price: 289, status: 'instock', latest: true,
    images: ['assets/masks/m05.webp', 'assets/masks/m05-foto.webp'], frame: 'assets/masks/m05-blk.webp',
    stage: { spec: .30, bump: 1.6, eyes: 'both' },
    patron: 'patron rodzinnych zdjęć',
    attr: 'cztery gwoździe, za dużo zębów',
    description: 'Zawsze się uśmiecha. Zawsze. Nawet kiedy przybijano mu oczy, żeby nie mógł ich zamknąć.',
    details: D() }
];
