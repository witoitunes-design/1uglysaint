/* 1uglysaint — HERO (index)
   The wall of faces lit live by the hanging lamp and your cursor. One screen, no scroll.
   From here the doors lead to the subpages (pages.js handles the TV transition). */
(() => {
  const GL = window.RelicGL || { ok: false, ready: Promise.resolve(), setScene() {}, setVisible() {} };
  const US = window.US || {};
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches;
  const html = document.documentElement;
  const hasGsap = !!window.gsap;
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  if (hasGsap) gsap.ticker.lagSmoothing(0);

  /* split title into letters */
  $$('[data-split]').forEach(el => {
    const txt = el.textContent;
    el.setAttribute('aria-label', txt);
    el.innerHTML = [...txt].map(ch => `<span class="ch-w"><span class="ch">${ch}</span></span>`).join('');
  });

  /* pitch numbers from products.js */
  const DATA = US.DATA || window.PRODUCTS || [];
  const drop = DATA.filter(p => p.latest).length ? DATA.filter(p => p.latest) : DATA.slice(0, 3);
  if (drop.length) {
    const n = drop.length, pl = (n === 1) ? 'maska' : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)) ? 'maski' : 'masek';
    $('#hp-count').textContent = n;
    if ($('#hp-noun')) $('#hp-noun').textContent = pl;
    if ($('#hc-count')) $('#hc-count').textContent = n;
    $('#hp-from').textContent = (US.formatPLN ? US.formatPLN(Math.min(...drop.map(p => p.price))) : Math.min(...drop.map(p => p.price)) + ' zł').replace(',00', '');
  }

  /* HUD clock */
  const pad = n => String(n).padStart(2, '0');
  (function clock() {
    const d = new Date(), el = $('#hud-time');
    if (el) el.textContent = `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}  ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    setTimeout(clock, 1000);
  })();

  /* hide the custom cursor while a dialog is open */
  const _show = HTMLDialogElement.prototype.showModal;
  HTMLDialogElement.prototype.showModal = function () {
    html.classList.add('modal-open');
    this.addEventListener('close', () => { if (!document.querySelector('dialog[open]')) html.classList.remove('modal-open'); }, { once: true });
    return _show.call(this);
  };

  /* cursor + magnets (mouse only) */
  if (fine && hasGsap && !reduce) {
    html.classList.add('has-cursor');
    const dot = $('.cursor-dot'), ring = $('.cursor-ring'), label = $('.cursor-label');
    const dx = gsap.quickTo(dot, 'x', { duration: .08 }), dy = gsap.quickTo(dot, 'y', { duration: .08 });
    const rx = gsap.quickTo(ring, 'x', { duration: .4, ease: 'power3' }), ry = gsap.quickTo(ring, 'y', { duration: .4, ease: 'power3' });
    addEventListener('pointermove', e => { dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY); }, { passive: true });
    const setMode = (mode, text = '') => { if (ring.dataset.mode !== mode) { ring.dataset.mode = mode; label.textContent = text; } };
    document.addEventListener('pointerover', e => {
      const t = e.target;
      if (t.closest('dialog')) return setMode('', '');
      if (t.closest('.cam')) return setMode('hover', 'WEJDŹ');
      if (t.closest('a, button, .lamp-head')) return setMode('hover', '');
      if (t.closest('.intro, .s-hero')) return setMode('light', 'ŚWIATŁO');
      setMode('', '');
    });
    $$('.magnet').forEach(m => {
      const mx = gsap.quickTo(m, 'x', { duration: .5, ease: 'elastic.out(1,.4)' }), my = gsap.quickTo(m, 'y', { duration: .5, ease: 'elastic.out(1,.4)' });
      m.addEventListener('pointermove', e => { const r = m.getBoundingClientRect(); mx((e.clientX - r.left - r.width / 2) * .3); my((e.clientY - r.top - r.height / 2) * .4); });
      m.addEventListener('pointerleave', () => { mx(0); my(0); });
    });
  }

  /* title letters scramble under the cursor */
  const glyphs = '█▓▒░#%&@*+=/\\<>†‡§¿01';
  $$('.hero-title .ch').forEach(ch => {
    const orig = ch.textContent;
    ch.addEventListener('pointerenter', () => {
      if (ch._busy || reduce) return; ch._busy = true;
      let n = 0;
      const it = setInterval(() => { ch.textContent = glyphs[Math.random() * glyphs.length | 0]; if (++n > 7) { clearInterval(it); ch.textContent = orig; ch._busy = false; } }, 45);
    });
  });

  /* the three room monitors: live snow, a tuning glitch when you pick a channel */
  const camCvs = $$('.cam-noise');
  if (camCvs.length) {
    const ctxs = camCvs.map(c => c.getContext('2d'));
    const img = ctxs[0].createImageData(80, 50), px = img.data;
    let fr = 0;
    (function snow() {
      if (!reduce) requestAnimationFrame(snow);
      if (document.hidden || (++fr & 1)) return;
      ctxs.forEach(cx => {
        for (let i = 0; i < px.length; i += 4) { const v = Math.random() * 255 | 0; px[i] = px[i + 1] = px[i + 2] = v; px[i + 3] = 255; }
        // a rolling bright band, like a bad sync
        const band = (fr * 0.7) % 70 - 10;
        for (let y = Math.max(0, band | 0); y < Math.min(50, band + 4); y++) for (let x = 0; x < 80; x++) { const o = (y * 80 + x) * 4; px[o] = px[o + 1] = px[o + 2] = Math.min(255, px[o] + 90); }
        cx.putImageData(img, 0, 0);
      });
    })();
    $$('.cam').forEach(c => c.addEventListener('pointerenter', () => {
      c.classList.remove('tune'); void c.offsetWidth; c.classList.add('tune');
      try { window.USSound?.crackle?.(.7); } catch (e) {}
    }));
  }

  /* the room */
  const glEl = $('#gl');
  const introPending = !!document.getElementById('intro') && hasGsap && !reduce;
  let introFade = introPending ? 0 : 1, ready = !introPending;
  if (introPending) {
    gsap.set('.hero-title .ch', { yPercent: 115, rotate: 6 });
    gsap.set('.hero-pitch > *, .hud > span, .hc-k, .cam', { autoAlpha: 0, y: 16 });
    gsap.set('.cine-nav, .lamp', { autoAlpha: 0 });
    GL.setVisible?.(false);
  }
  function update() {
    if (!GL.ok) return;
    GL.setScene(0, 0, 0, 1);
    GL.setVisible(ready && !document.hidden);
    glEl.style.opacity = String(introFade);
  }
  update();

  const intro = window.USIntro ? window.USIntro.finished : Promise.resolve();
  Promise.race([intro, new Promise(r => setTimeout(r, 15000))]).then(() => {
    ready = true;
    update();
    html.classList.add('intro-done');
    if (!introPending) return;
    const f = { v: 0 };
    const sync = () => { introFade = f.v; update(); };
    gsap.timeline()
      .to(f, { v: .7, duration: .08, ease: 'none', onUpdate: sync }, .05)
      .to(f, { v: .12, duration: .07, ease: 'none', onUpdate: sync })
      .to(f, { v: .85, duration: .06, ease: 'none', onUpdate: sync })
      .to(f, { v: .3, duration: .1, ease: 'none', onUpdate: sync })
      .to(f, { v: 1, duration: .8, ease: 'power2.out', onUpdate: sync })
      .to('.hero-title .ch', { yPercent: 0, rotate: 0, duration: 1.15, ease: 'expo.out', stagger: .04 }, .4)
      .to('.hero-pitch > *, .hud > span', { autoAlpha: 1, y: 0, duration: .8, ease: 'power3.out', stagger: .06, clearProps: 'transform,opacity,visibility' }, .8)
      .to('.hc-k, .cam', { autoAlpha: 1, y: 0, duration: .7, ease: 'power3.out', stagger: .1, clearProps: 'transform,opacity,visibility' }, 1.05)
      .to('.cine-nav', { autoAlpha: 1, duration: .8, ease: 'power2.out', clearProps: 'opacity,visibility' }, 1)
      .fromTo('.lamp', { autoAlpha: 1, y: -260 }, { y: 0, duration: 1.4, ease: 'elastic.out(1,.55)', clearProps: 'transform,opacity,visibility' }, .9);
  });
})();
