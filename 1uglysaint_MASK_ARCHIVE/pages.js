/* 1uglysaint — PAGE TRANSITIONS (all pages)
   Leaving: the picture catches interference and collapses into a line, like the TV at the end of the intro.
   Arriving: the new page switches on like a television (CSS-driven, works even if JS fails).
   Also: active nav link, tiny helpers. */
(() => {
  const html = document.documentElement;
  // opened from disk: Chrome blocks local font files, so load the brand font from data
  if (location.protocol === 'file:') { const f = document.createElement('script'); f.src = 'assets/fonts/font-offline.js'; document.head.append(f); }
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let px = document.querySelector('.px');
  if (!px) {
    px = document.createElement('div');
    px.className = 'px';
    px.innerHTML = '<canvas class="px-noise" width="160" height="90"></canvas><i class="px-line"></i><span class="px-label">UTRATA SYGNAŁU</span>';
    document.body.append(px);
  }
  const cv = px.querySelector('.px-noise');
  const cx = cv.getContext('2d');
  const img = cx.createImageData(cv.width, cv.height);
  let noiseOn = 0;
  function noise() {
    if (!noiseOn) return;
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) { const v = Math.random() * 255 | 0; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
    cx.putImageData(img, 0, 0);
    requestAnimationFrame(noise);
  }
  const startNoise = ms => { noiseOn++; if (noiseOn === 1) requestAnimationFrame(noise); setTimeout(() => { noiseOn = Math.max(0, noiseOn - 1); }, ms); };

  // arrival: CSS plays the switch-on; we only animate the static while it does
  if (!reduce && !html.classList.contains('intro-lock')) startNoise(900);
  px.addEventListener('animationend', e => { if (e.animationName === 'pxHold' && !px.classList.contains('leave')) px.classList.add('done'); });
  setTimeout(() => { if (!px.classList.contains('leave')) px.classList.add('done'); }, 1600);

  // leaving
  let leaving = false;
  function go(url) {
    if (leaving) return;
    leaving = true;
    if (reduce) { location.href = url; return; }
    px.classList.remove('done');
    px.classList.add('leave');
    startNoise(800);
    try { window.US_click?.(); } catch (e) {}
    setTimeout(() => { location.href = url; }, 620);
  }
  window.USGo = go;
  document.addEventListener('click', e => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a[href]');
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || /^(mailto:|tel:|https?:)/i.test(href)) return;
    const u = new URL(href, location.href);
    if (u.pathname === location.pathname && u.search === location.search) return;
    e.preventDefault();
    go(u.href);
  });
  // back/forward cache: never come back to a dead screen
  addEventListener('pageshow', e => {
    if (!e.persisted) return;
    leaving = false;
    px.classList.remove('leave', 'done');
    void px.offsetWidth;
    px.classList.add('replay');
    startNoise(900);
  });

  // active nav item
  const here = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.pn-links a').forEach(a => { if (a.getAttribute('href') === here) a.setAttribute('aria-current', 'page'); });

  // credit: who made the site -> mkflow.pl (edge of the screen on desktop, bottom menu on phones)
  if (!document.querySelector('.mk-credit')) {
    const mk = document.createElement('a');
    mk.className = 'mk-credit'; mk.href = 'https://mkflow.pl'; mk.target = '_blank'; mk.rel = 'noopener';
    mk.setAttribute('aria-label', 'Strona zrobiona przez MKFlow — otwórz mkflow.pl');
    mk.innerHTML = '<span>STRONA ZROBIONA PRZEZ</span><b>MKFLOW</b><i aria-hidden="true">→</i>';
    document.body.appendChild(mk);
    const bar = document.querySelector('.pn-links');
    if (bar) {
      const m = document.createElement('a');
      m.className = 'mk-nav'; m.href = 'https://mkflow.pl'; m.target = '_blank'; m.rel = 'noopener';
      m.setAttribute('aria-label', 'Strona zrobiona przez MKFlow — otwórz mkflow.pl');
      m.innerHTML = '<small>wykonanie</small>MKFLOW';
      bar.appendChild(m);
    }
  }

})();
