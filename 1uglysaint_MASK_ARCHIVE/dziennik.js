/* 1uglysaint — DZIENNIK / PRZESŁUCHANIE
   One screen. A mask sits under a swinging lamp (it lights the 3D face for real — sala.js).
   You pick a question; the mask lifts its head, looks into the camera and answers in subtitles.
   Left alone for a while, it talks by itself. ⟳ swaps the suspect (faces morph). */
(() => {
  const US = window.US || {};
  const SHOP = window.SHOP || {};
  const DATA = US.DATA || window.PRODUCTS || [];
  const GEO = window.MASK_GEO || { masks: {} };
  const $ = s => document.querySelector(s);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches;
  const mobile = innerWidth < 821 || !fine;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  if (!DATA.length) return;

  /* =================================================================
     PYTANIA I ODPOWIEDZI — tu wpisujesz treść.
     a     odpowiedź maski (pierwsza osoba, krótko)
     note  dopisek „do uzupełnienia” — usuń, kiedy wpiszesz prawdziwą odpowiedź
     cta   przyciski pod odpowiedzią: [tekst, link]
     ================================================================= */
  const QA = [
    { q: 'Wysyłka — ile i kiedy?', a: SHOP.shippingNote || 'Koszt wysyłki i płatność potwierdzamy w odpowiedzi na zamówienie.', note: 'do uzupełnienia: przewoźnik, czas realizacji i dostawy, wysyłka za granicę' },
    { q: 'Mogę ją oddać?', a: 'Niektóre wracają same.', note: 'do uzupełnienia: zasady zwrotów i reklamacji — zgodnie z regulaminem', refuse: true },
    { q: 'Jak się z wami skontaktować?', a: 'Wejdź w kontakt. Zadzwonię do ciebie.', cta: [['KONTAKT →', 'kontakt.html']] }
  ];
  const IDLE = ['Wiem, że tam jesteś.', 'Pytaj.', 'Długo jeszcze?', 'To światło… zgaś je.', 'Ktoś stoi za lustrem.', '…'];

  /* wygląd w 3D bierze się z products.js (stage: spec, bump) */
  const STAGE = {};
  DATA.forEach(p => { if (p.stage) STAGE[p.id] = [p.stage.spec ?? .3, p.stage.bump ?? 1.5]; });
  const base = p => (p.images && p.images[0] || '').replace(/\.(webp|png|jpe?g)$/i, '');
  const masks = DATA.map((p, i) => ({ p, i, id: p.id, tex: base(p) + '-tex.webp', texM: base(p) + '-tex-m.webp', depth: base(p) + '-depth.png', geo: GEO.masks[p.id], spec: (STAGE[p.id] || [.3])[0], bump: (STAGE[p.id] || [0, 1.5])[1] }));

  /* ---------------- room ---------------- */
  const room = $('#room'), canvas = $('#room-gl'), anchor = $('#room-anchor'), still = $('#room-still');
  let sala = { ok: false };
  if (!reduce && window.Sala) sala = window.Sala(canvas, { mobile });
  if (!sala.ok) { room.classList.add('static'); still.hidden = false; }
  let fit = { cx: 0, cy: 0, h: 1 }, roomR = room.getBoundingClientRect();
  const lampx = $('#lampx');
  let cordL = 200;
  function layout() {
    roomR = room.getBoundingClientRect();
    const a = anchor.getBoundingClientRect();
    fit = { cx: a.left - roomR.left + a.width / 2, cy: a.top - roomR.top + a.height / 2, h: a.height / 2 };
    if (sala.ok) sala.layout(fit);
    // the bulb hangs just above the head
    cordL = Math.max(90, a.top - roomR.top + a.height * (mobile ? .02 : .06) - 34);
    lampx.style.setProperty('--lx', fit.cx + 'px');
    lampx.style.setProperty('--ll', cordL + 'px');
    const qsEl = document.getElementById('qs'); if (qsEl) room.style.setProperty('--qh', qsEl.offsetHeight + 'px');
  }
  addEventListener('resize', layout); layout();

  /* ---------------- suspect ---------------- */
  let cur = 0;
  const susName = $('#sus-name'), susTry = $('#sus-try');
  function setSuspect(i) {
    cur = ((i % masks.length) + masks.length) % masks.length;
    const m = masks[cur];
    susName.textContent = m.p.name;
    susTry.href = `sklep.html#${encodeURIComponent(m.id)}`;
    still.src = m.texM; still.alt = m.p.name;
    if (sala.ok) { sala.set(m); sala.preload(masks[(cur + 1) % masks.length]); }
  }
  $('#sus-next').addEventListener('click', () => {
    setSuspect(cur + 1);
    try { window.USSound?.thud?.(); } catch (e) {}
    setTimeout(() => say(['Następny.', 'Teraz ja.', 'Pytaj mnie.'][Math.random() * 3 | 0], { who: 'idle' }), 900);
  });

  /* ---------------- lamp: a real pendulum that lights the face ---------------- */
  let th = reduce ? 0 : .24, om = 0, lastT = performance.now();
  const lampHead = $('#lx-head');
  lampHead.querySelector('.lx-shade').addEventListener('pointerdown', e => {
    e.preventDefault();
    om += (e.clientX < roomR.left + fit.cx + Math.sin(th) * cordL ? 1 : -1) * (1.3 + Math.random() * .6);
    try { window.USSound?.crackle?.(.8); } catch (er) {}
  });
  function lampStep(now) {
    const dt = Math.min(.04, (now - lastT) / 1000); lastT = now;
    if (!reduce) {
      om += (-5.6 * Math.sin(th) - .1 * om) * dt;
      if (Math.random() < .004) om += (Math.random() - .5) * .35;      // a draught
      th += om * dt;
    }
    lampx.style.setProperty('--la', th.toFixed(4) + 'rad');
    // bulb position -> light for the 3D face (mask space: centre 0,0; ±1 = half height)
    const L = cordL + 32;
    const bx = fit.cx + Math.sin(th) * L, by = Math.cos(th) * L;
    const xm = (bx - fit.cx) / fit.h, ym = (fit.cy - by) / fit.h;
    if (sala.ok) sala.light(xm / 1.5, ym / 1.3, .95);
  }

  /* ---------------- head: looks at you, at the camera when it talks ---------------- */
  let talking = false;
  const toMask = (x, y) => [(x - roomR.left - fit.cx) / fit.h, -(y - roomR.top - fit.cy) / fit.h];
  if (fine) room.addEventListener('pointermove', e => {
    if (!sala.ok || talking) return;
    const [x, y] = toMask(e.clientX, e.clientY); sala.look(x * .8, y * .8);
  });
  if (!fine) room.addEventListener('pointermove', e => {
    if (!sala.ok || talking || e.pointerType === 'mouse' || e.target.closest('button, a')) return;
    const [x, y] = toMask(e.clientX, e.clientY); sala.look(x * .8, y * .8);
  });

  /* ---------------- voice: low murmur under the subtitles (only with sound on) ---------------- */
  function blip() {
    const S = window.USSound; if (!S || !S.on || !S.ctx) return;
    const ctx = S.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(70 + Math.random() * 55, t); o.frequency.exponentialRampToValueAtTime(48 + Math.random() * 20, t + .09);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 520 + Math.random() * 380; f.Q.value = 6;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.09, t + .012); g.gain.exponentialRampToValueAtTime(.0001, t + .1);
    o.connect(f).connect(g).connect(S.master); o.start(t); o.stop(t + .11);
  }

  /* ---------------- subtitles ---------------- */
  const subs = $('#subs'), subWho = $('#sub-who'), subT = $('#sub-t'), subNote = $('#sub-note'), subCta = $('#sub-cta');
  const pad = n => String(n).padStart(2, '0');
  const clock = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };
  let typer = 0, idleT = 0, token = 0;
  function say(text, o = {}) {
    const my = ++token;
    clearInterval(typer); clearTimeout(idleT);
    const m = masks[cur];
    subWho.textContent = o.who === 'idle' ? `PODEJRZANY № ${m.id} · NIEPYTANY · ${clock()}` : `PODEJRZANY № ${m.id} · ${clock()}`;
    subNote.hidden = true; subCta.innerHTML = '';
    subs.classList.remove('glitch');
    if (o.refuse) { void subs.offsetWidth; subs.classList.add('glitch'); if (sala.ok) { sala.power(.25); setTimeout(() => sala.power(1), 380); } try { window.USSound?.crackle?.(1.4); } catch (e) {} }
    talking = true;
    if (sala.ok) { sala.look(0, .06); sala.talk(1); }
    const done = () => {
      if (my !== token) return;
      subT.classList.remove('typing'); subT.textContent = text;
      talking = false; if (sala.ok) sala.talk(0);
      if (o.note) { subNote.textContent = o.note; subNote.hidden = false; }
      if (o.cta) subCta.innerHTML = o.cta.map(([t, h]) => `<a href="${esc(h)}">${esc(t)}</a>`).join('');
      armIdle();
    };
    if (reduce) { done(); return; }
    let i = 0;
    subT.textContent = ''; subT.classList.add('typing');
    const delay = o.refuse ? 520 : 260;           // a pause before it answers
    setTimeout(() => {
      if (my !== token) return;
      typer = setInterval(() => {
        if (my !== token) { clearInterval(typer); return; }
        i = Math.min(text.length, i + (text.length > 120 ? 2 : 1));
        subT.textContent = text.slice(0, i);
        if (i % 3 === 0 && /\S/.test(text[i - 1] || '')) blip();
        if (i >= text.length) { clearInterval(typer); setTimeout(done, 120); }
      }, 26);
    }, delay);
  }
  function armIdle() {
    clearTimeout(idleT);
    idleT = setTimeout(() => { if (!document.hidden && !document.querySelector('dialog[open]')) say(IDLE[Math.random() * IDLE.length | 0], { who: 'idle' }); }, 17000 + Math.random() * 8000);
  }
  ['pointerdown', 'keydown'].forEach(t => addEventListener(t, () => { if (!talking) armIdle(); }, { passive: true }));

  /* ---------------- questions ---------------- */
  const qs = $('#qs');
  qs.innerHTML = QA.map((x, i) => `<li><button type="button" class="q" data-i="${i}" aria-pressed="false"><span class="qn">${pad(i + 1)}</span><span class="qt">${esc(x.q)}</span><span class="qs-s" aria-hidden="true">ZAPYTAJ</span></button></li>`).join('');
  const qBtns = [...qs.querySelectorAll('.q')];
  layout();
  document.fonts && document.fonts.ready.then(layout);
  function ask(i) {
    const x = QA[i];
    qBtns.forEach((b, k) => b.setAttribute('aria-pressed', k === i));
    const b = qBtns[i]; b.classList.add('done'); b.querySelector('.qs-s').textContent = 'ZAPROTOKOŁOWANO';
    say(x.a, x);
  }
  qs.addEventListener('click', e => { const b = e.target.closest('.q'); if (b) ask(+b.dataset.i); });
  addEventListener('keydown', e => {
    if (document.querySelector('dialog[open]') || e.target.closest('input, textarea')) return;
    const n = parseInt(e.key, 10); if (n >= 1 && n <= QA.length) ask(n - 1);
  });

  /* ---------------- OSD: timecode + date ---------------- */
  const tc = $('#osd-tc'), dateEl = $('#osd-date'), t0 = performance.now();
  { const d = new Date(); dateEl.textContent = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`; }
  let fr = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    if (document.hidden) return;
    lampStep(now);
    if (++fr % 2 === 0) {
      const s = (now - t0) / 1000, f = Math.floor((s % 1) * 25);
      tc.textContent = `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(Math.floor(s) % 60)}:${pad(f)}`;
    }
  }
  requestAnimationFrame(loop);

  /* ---------------- start ---------------- */
  setSuspect(Math.random() * masks.length | 0);
  if (sala.ok) {
    new IntersectionObserver(es => es.forEach(e => sala.visible(e.isIntersecting))).observe(room);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) sala.visible(true); });
    sala.state.pow = 0; sala.power(1);
    sala.start();
  }
  setTimeout(() => { if (token === 0) say('Pytaj.', { who: 'idle' }); }, 1500);
})();
