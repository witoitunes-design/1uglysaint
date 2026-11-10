/* 1uglysaint — SKLEP / PRZYMIERZALNIA
   SALA   one mask at a time as a real 3D relief (sala.js). Cursor = torch, the head follows it.
          Drag / swipe on phones, tilt the phone, arrows, the rail. Hold SPACE (or the SKAN
          button / long-press) for the 3D scan with live landmarks.
   LUSTRO try the mask on your own face with the camera (lustro.js, loaded on demand).
   One screen. The rail is the whole catalogue: real masks, then SHOP.soon empty „SOON” places.
   Each mask: 3D first, FOTO (images[1], the mask on fabric) second. */
(() => {
  const US = window.US || {};
  const DATA = US.DATA || window.PRODUCTS || [];
  const GEO = window.MASK_GEO || { masks: {} };
  const $ = s => document.querySelector(s);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches;
  const mobile = innerWidth < 821 || !fine;
  const PLN = v => (US.formatPLN ? US.formatPLN(v) : `${v} zł`).replace(',00', '');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = n => String(n).padStart(3, '0');
  if (!DATA.length) return;

  /* look & behaviour per mask: gloss of the surface, strength of the photo bump, which eyes the mirror uses */
  /* comes from products.js (stage: spec, bump, eyes) */
  const STAGE = {};
  DATA.forEach(p => { if (p.stage) STAGE[p.id] = p.stage; });
  const base = p => (p.images && p.images[0] || '').replace(/\.(webp|png|jpe?g)$/i, '');
  const masks = DATA.map((p, i) => ({
    p, i, id: p.id, tex: base(p) + '-tex.webp', texM: base(p) + '-tex-m.webp', depth: base(p) + '-depth.png',
    thumb: base(p) + '-sm.webp', geo: GEO.masks[p.id], spec: .3, bump: 1.5, eyes: 'both', ...(STAGE[p.id] || {}),
    foto: (p.images || [])[1] || '', fotoSm: ((p.images || [])[1] || '').replace(/\.(webp|png|jpe?g)$/i, '-sm.webp')
  }));
  const SOON = Math.max(0, Math.min(12, +((window.SHOP || {}).soon) || 0));
  const plural = n => n === 1 ? 'MASKA' : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)) ? 'MASKI' : 'MASEK';
  window.SKLEP = { masks };
  const STATUS = { instock: 'DOSTĘPNA', limited: 'LIMITOWANA', soldout: 'WYPRZEDANA' };
  const inCart = id => !!(US.cart || {})[id];

  /* ================= SALA ================= */
  const sec = $('#sala'), canvas = $('#sala-gl'), anchor = $('#sala-anchor'), still = $('#sala-still');
  let cur = 0;
  let sala = { ok: false };
  if (!reduce && window.Sala) sala = window.Sala(canvas, { mobile, onFrame });
  if (!sala.ok) { sec.classList.add('static'); still.hidden = false; }
  if (fine) sec.classList.add('fine');

  let fit = { cx: 0, cy: 0, h: 1 }, secR = sec.getBoundingClientRect();
  function layout() {
    secR = sec.getBoundingClientRect();
    const a = anchor.getBoundingClientRect();
    fit = { cx: a.left - secR.left + a.width / 2, cy: a.top - secR.top + a.height / 2, h: a.height / 2 };
    if (sala.ok) sala.layout(fit);
  }
  addEventListener('resize', layout); layout();
  addEventListener('scroll', () => { secR = sec.getBoundingClientRect(); }, { passive: true });

  /* rail */
  const rail = $('#sc-rail');
  const ind = $('#sc-ind'), peek = $('#sc-peek');
  rail.insertAdjacentHTML('beforeend', masks.map((m, i) => `<button type="button" data-i="${i}" class="${m.p.status === 'limited' ? 'lim' : ''}${m.p.status === 'soldout' ? ' out' : ''}" aria-label="${esc(m.p.name)} — ${esc(PLN(m.p.price))}">${String(i + 1).padStart(2, '0')}</button>`).join(''));
  /* the next places of the drop: one wide slot „04–08 · SOON” */
  const soonFrom = String(masks.length + 1).padStart(2, '0'), soonTo = String(masks.length + SOON).padStart(2, '0');
  if (SOON) rail.insertAdjacentHTML('beforeend', `<button type="button" class="soon" data-soon style="--n:${SOON}" aria-label="Maski ${soonFrom}–${soonTo}: wkrótce"><span class="sn-n">${SOON > 1 ? soonFrom + '–' + soonTo : soonFrom}</span><span class="sn-t">SOON</span></button>`);
  const railBtns = [...rail.querySelectorAll('button[data-i]')];
  const soonMsg = () => { const ig = (window.SHOP || {}).instagram; return `${SOON > 1 ? soonFrom + '–' + soonTo : soonFrom} · SOON. KOLEJNE MASKI W DRODZE${ig ? ' · OBSERWUJ @' + ig.toUpperCase() : ''}`; };
  function moveInd() { const b = railBtns[cur]; if (!b) return; ind.style.transform = `translateX(${b.offsetLeft}px)`; ind.style.width = b.offsetWidth + 'px'; }
  addEventListener('resize', moveInd);
  document.fonts && document.fonts.ready.then(moveInd);
  if (fine) {
    rail.addEventListener('pointerover', e => {
      const b = e.target.closest('[data-i], [data-soon]'); if (!b) return;
      const m = b.dataset.soon != null ? null : masks[+b.dataset.i];
      peek.classList.toggle('is-soon', !m);
      if (m) peek.querySelector('img').src = m.thumb;
      peek.querySelector('b').textContent = m ? m.p.name : 'SOON';
      peek.querySelector('span').textContent = m ? `№ ${m.p.id} · ${PLN(m.p.price)}${m.p.status === 'limited' ? ' · LIMITOWANA' : ''}` : `№ ${pad(masks.length + 1)}${SOON > 1 ? '–' + pad(masks.length + SOON) : ''} · NOWE MASKI W DRODZE`;
      const r = b.getBoundingClientRect(), rr = rail.parentElement.getBoundingClientRect();
      peek.style.setProperty('--x', (r.left - rr.left + r.width / 2) + 'px');
      peek.classList.add('on');
    });
    rail.addEventListener('pointerleave', () => peek.classList.remove('on'));
  }
  rail.addEventListener('click', e => {
    if (e.target.closest('[data-soon]')) { US.notify?.(soonMsg()); return; }
    const b = e.target.closest('[data-i]'); if (b) { show(+b.dataset.i); if (e.detail) b.blur(); }
  });
  $('#sc-prev').addEventListener('click', e => { show(cur - 1, -1); if (e.detail) e.currentTarget.blur(); });
  $('#sc-next').addEventListener('click', e => { show(cur + 1, 1); if (e.detail) e.currentTarget.blur(); });
  $('#si-of').textContent = pad(masks.length);
  $('#st-count').innerHTML = `${String(masks.length).padStart(2, '0')} ${plural(masks.length)}${SOON ? `<span class="st-soon"> + ${String(SOON).padStart(2, '0')} SOON</span>` : ''}`;

  /* name + price: letters roll out and in */
  const nameEl = $('#si-name'), priceEl = $('#si-price');
  function roll(el, txt, animate, step = 22) {
    const html = txt.split(' ').map(w => `<span class="w">${[...w].map(ch => `<span class="c"><span>${esc(ch)}</span></span>`).join('')}</span>`).join(' ');
    if (!animate || reduce) { el.innerHTML = html; return; }
    el.classList.add('out');
    setTimeout(() => {
      el.classList.remove('out'); el.classList.add('pre');
      el.innerHTML = html;
      el.querySelectorAll('.c>span').forEach((s, k) => { s.style.transitionDelay = (k * step) + 'ms'; });
      void el.offsetWidth;
      el.classList.remove('pre');
    }, 330);
  }
  const setName = (t, a) => roll(nameEl, t, a);

  function fillInfo(m) {
    const p = m.p;
    $('#si-no').textContent = p.id;
    $('#si-latin').textContent = p.latin || '';
    $('#si-line').textContent = p.patron || '';
    const st = $('#si-status'); st.textContent = (p.status === 'limited' ? '● ' : '') + (STATUS[p.status] || '');
    st.className = 'si-status mono' + (p.status === 'limited' ? ' lim' : p.status === 'soldout' ? ' out' : '');
    $('#si-buy-p').textContent = PLN(p.price);
    still.src = m.texM; still.alt = p.name;
    syncView(m);
    syncBuy();
  }
  function syncBuy() {
    const m = masks[cur], b = $('#si-buy');
    const out = m.p.status === 'soldout';
    b.disabled = out;
    b.classList.toggle('in', inCart(m.id));
    b.querySelector('.bb-t').textContent = out ? 'WYPRZEDANA' : inCart(m.id) ? 'W KOSZYKU ✓' : 'DO KOSZYKA';
    $('#si-buy-p').textContent = inCart(m.id) ? 'ZOBACZ →' : PLN(m.p.price);
  }

  function whoosh() {
    const S = window.USSound; if (!S || !S.on || !S.ctx || !S.noiseBuf) return;
    const ctx = S.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = S.noiseBuf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(220, t); bp.frequency.exponentialRampToValueAtTime(2400, t + .55); bp.frequency.exponentialRampToValueAtTime(400, t + 1.1);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.2, t + .25); g.gain.exponentialRampToValueAtTime(.0001, t + 1.2);
    src.connect(bp).connect(g).connect(S.master); src.start(t, Math.random()); src.stop(t + 1.3);
  }

  function show(i, dir = 0, first) {
    const n = masks.length;
    i = ((i % n) + n) % n;
    if (i === cur && !first) return;
    cur = i;
    const m = masks[i];
    railBtns.forEach((b, k) => b.setAttribute('aria-current', k === i));
    moveInd();
    if (first) { setName(m.p.name, false); roll(priceEl, PLN(m.p.price), false); fillInfo(m); }
    else {
      setName(m.p.name, true); roll(priceEl, PLN(m.p.price), true, 40);
      sec.classList.add('swap');
      setTimeout(() => { fillInfo(m); sec.classList.remove('swap'); }, 320);
      whoosh();
    }
    if (sala.ok) {
      sala.set(m);
      sala.wall(String(i + 1).padStart(2, '0'));
      sala.preload(masks[(i + 1) % n]); sala.preload(masks[(i - 1 + n) % n]);
    }
    try { history.replaceState(null, '', `#${m.id}`); } catch (e) {}
    buildLabels(m);
  }

  /* ================= 3D / FOTO =================
     First the mask in 3D, second the real photo of the mask on fabric (images[1]). */
  const viewBox = $('#sala-view'), photo = $('#sala-photo');
  let view = '3d';
  const onStage = () => sec.getBoundingClientRect().bottom > 0 && !document.hidden;
  function setView(v) {
    const m = masks[cur];
    if (v === 'foto' && !(m && m.foto)) v = '3d';
    if (v === view) return;
    view = v;
    sec.classList.toggle('photo', v === 'foto');
    photo.setAttribute('aria-hidden', v !== 'foto');
    viewBox.querySelectorAll('[data-v]').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === v));
    if (v === 'foto') { if (scanBy) setScan(false); torch.classList.remove('on'); }
    if (sala.ok) sala.visible(v === '3d' && onStage());
    window.USSound?.crackle?.(.5);
  }
  function syncView(m) {
    viewBox.hidden = !m.foto;
    $('#sv-3d').src = m.thumb;
    if (m.foto) { $('#sv-foto').src = m.fotoSm || m.foto; photo.src = m.foto; photo.alt = `${m.p.name}: zdjęcie maski na materiale`; }
    else if (view === 'foto') setView('3d');
  }
  viewBox.addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) { setView(b.dataset.v); if (e.detail) b.blur(); } });
  photo.setAttribute('aria-hidden', 'true');

  /* buy / try */
  $('#si-buy').addEventListener('click', () => {
    const m = masks[cur];
    if (inCart(m.id)) { $('#cart-dialog')?.showModal(); return; }
    US.addToCart?.(m.id);
    syncBuy();
  });
  document.addEventListener('us:add', syncBuy);
  document.addEventListener('us:cart', syncBuy);
  $('#cart-dialog')?.addEventListener('close', syncBuy);
  document.addEventListener('click', e => { if (e.target.closest('#cart-lines button, #clear-cart')) setTimeout(syncBuy, 0); });

  let lustroLoading = null;
  function openLustro(id) {
    const go = () => window.Lustro.open({ masks, id, onAdd: mid => { if (!inCart(mid)) US.addToCart?.(mid); syncBuy(); } });
    if (window.Lustro) return go();
    if (!lustroLoading) lustroLoading = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'lustro.js?v=21'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    lustroLoading.then(go).catch(() => US.notify?.('LUSTRO SIĘ NIE ZAŁADOWAŁO'));
  }
  $('#si-try').addEventListener('click', () => openLustro(masks[cur].id));

  /* ================= pointer / touch / gyro ================= */
  const torch = document.createElement('div'); torch.className = 'torch'; torch.setAttribute('aria-hidden', 'true');
  if (fine && sala.ok) document.body.appendChild(torch);
  const uiSel = '.sala-info, .sala-ctl, .sala-hints, .sala-view, .pn, .task-cart';
  const toMask = (cx, cy) => [(cx - secR.left - fit.cx) / fit.h, -(cy - secR.top - fit.cy) / fit.h];
  if (fine && sala.ok) {
    sec.addEventListener('pointermove', e => {
      const [x, y] = toMask(e.clientX, e.clientY); sala.pointer(x, y);
      torch.style.transform = `translate(${e.clientX}px,${e.clientY}px)`;
      torch.classList.toggle('on', view === '3d' && !e.target.closest(uiSel));
      if (view === 'foto') photo.style.transform = `perspective(1400px) rotateY(${(Math.max(-1, Math.min(1, x)) * 7).toFixed(2)}deg) rotateX(${(Math.max(-1, Math.min(1, y)) * 4).toFixed(2)}deg)`;
    });
    sec.addEventListener('pointerleave', () => { torch.classList.remove('on'); sala.release(); });
  }
  // touch: drag = torch + look, quick horizontal flick = next/prev, long press = scan
  let drag = null, pressT = 0;
  if (!fine) {
    sec.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' || e.target.closest(uiSel)) return;
      drag = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, moved: false };
      const [x, y] = toMask(e.clientX, e.clientY); sala.ok && sala.pointer(x, y);
      clearTimeout(pressT); pressT = setTimeout(() => { if (drag && !drag.moved) { setScan(true, 'hold'); } }, 480);
    });
    sec.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 10) drag.moved = true;
      const [x, y] = toMask(e.clientX, e.clientY); sala.ok && sala.pointer(x, y);
    });
    const end = e => {
      if (!drag || e.pointerId !== drag.id) return;
      clearTimeout(pressT);
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y, dt = performance.now() - drag.t;
      if (e.type === 'pointerup' && Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4 && dt < 1000) show(cur + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
      if (scanBy === 'hold') setScan(false);
      drag = null; sala.ok && sala.release();
    };
    sec.addEventListener('pointerup', end); sec.addEventListener('pointercancel', end);
    // phone tilt: Android straight away, iPhone needs one tap (permission)
    const onTilt = e => {
      if (drag || e.gamma == null) return;
      const x = Math.max(-1, Math.min(1, e.gamma / 28)), y = Math.max(-1, Math.min(1, -(e.beta - 48) / 32));
      sala.ok && sala.pointer(x * .9, y * .7 + .15);
    };
    const DOE = window.DeviceOrientationEvent;
    if (DOE) {
      let got = false;
      const first = e => { if (e.gamma != null) { got = true; $('#sh-gyro').hidden = true; } };
      addEventListener('deviceorientation', first);
      addEventListener('deviceorientation', onTilt);
      // iPhone only sends tilt after one tap of permission
      if (typeof DOE.requestPermission === 'function') setTimeout(() => {
        if (got) return;
        const g = $('#sh-gyro'); g.hidden = false;
        g.addEventListener('click', () => DOE.requestPermission().then(s => { g.hidden = true; }).catch(() => { g.hidden = true; }), { once: true });
      }, 1200);
    }
  }

  /* ================= SKAN ================= */
  let scanBy = null;
  const scanBtn = $('#sh-scan');
  function setScan(on, by) {
    if (!sala.ok) return;
    if (on && view === 'foto') setView('3d');
    if (on && scanBy) return;
    scanBy = on ? by : null;
    sala.scan(on);
    sec.classList.toggle('scanning', on);
    torch.classList.toggle('scan', on);
    scanBtn.setAttribute('aria-pressed', on);
    if (on) { window.USSound?.crackle?.(1.4); try { navigator.vibrate && !fine && navigator.vibrate(12); } catch (e) {} }
  }
  scanBtn.addEventListener('click', () => setScan(!scanBy, 'btn'));
  addEventListener('keydown', e => {
    if (document.querySelector('dialog[open]') || e.target.closest('input, textarea')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); show(cur + 1, 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); show(cur - 1, -1); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { if (masks[cur].foto) { e.preventDefault(); setView(e.key === 'ArrowDown' ? 'foto' : '3d'); } }
    else if (e.code === 'Space' && !e.repeat && !e.target.closest('button, a, select') && sec.getBoundingClientRect().bottom > 120) { e.preventDefault(); setScan(true, 'key'); }
  });
  addEventListener('keyup', e => { if (e.code === 'Space' && scanBy === 'key') setScan(false); });

  // landmark labels that ride the rotating head
  const labelsEl = $('#sala-labels');
  const LBL = [
    { t: 'OKO P', ids: [33, 133], ang: 200, len: 70 },
    { t: 'OKO L', ids: [263, 362], ang: -20, len: 70 },
    { t: 'CZOŁO', ids: [10], ang: -150, len: 60 },
    { t: 'NOS', ids: [1], ang: 15, len: 90 },
    { t: 'USTA', ids: [13, 14], ang: 160, len: 100 },
    { t: 'BRODA', ids: [152], ang: 25, len: 70 }
  ];
  let labels = [];
  function buildLabels(m) {
    labels = [];
    labelsEl.innerHTML = '';
    const lm = m.geo && m.geo.lm; if (!lm) return;
    LBL.forEach(L => {
      let u = 0, v = 0; L.ids.forEach(k => { u += lm[k * 3]; v += lm[k * 3 + 1]; }); u /= L.ids.length; v /= L.ids.length;
      const el = document.createElement('div'); el.className = 'lbl';
      const a = L.ang * Math.PI / 180, tx = Math.cos(a) * L.len, ty = Math.sin(a) * L.len;
      const left = Math.cos(a) < 0;
      el.style.cssText = `--len:${L.len}px;--ang:${L.ang}deg;--tx:${tx + (left ? -4 : 4)}px;--ty:${ty - 10}px`;
      el.innerHTML = `<i></i><b></b><span style="${left ? 'transform:translateX(-100%)' : ''}">${L.t}<em>—</em></span>`;
      labelsEl.appendChild(el);
      labels.push({ el, em: el.querySelector('em'), u, v });
    });
  }

  /* ================= per frame ================= */
  const hud = { yaw: $('#hud-yaw'), pitch: $('#hud-pitch'), lux: $('#hud-lux') };
  const sg = v => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(1).padStart(4, '0');
  let fc = 0;
  function onFrame(S) {
    fc++;
    if (fc % 5 === 0 && !mobile) {
      hud.yaw.textContent = sg(S.yaw * 57.3) + '°';
      hud.pitch.textContent = sg(-S.pitch * 57.3) + '°';
      hud.lux.textContent = (S.pow * (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--lamp')) || 1)).toFixed(2);
    }
    if (S.scan > .02 && labels.length) {
      labels.forEach((L, k) => {
        const p = sala.project(L.u, L.v); if (!p) return;
        L.el.style.transform = `translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px)`;
        if ((fc + k) % 6 === 0 || L.em.textContent === '—') L.em.textContent = `x ${L.u.toFixed(3)}  y ${L.v.toFixed(3)}  z ${p.z.toFixed(3)}`;
      });
    }
  }

  /* run only while the stage is on screen */
  if (sala.ok) {
    const io = new IntersectionObserver(es => es.forEach(e => sala.visible(e.isIntersecting && view === '3d')), { threshold: 0 });
    io.observe(sec);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) sala.visible(view === '3d' && sec.getBoundingClientRect().bottom > 0); });
    sala.start();
  }

  /* little things */
  const title = document.title;
  document.addEventListener('visibilitychange', () => { document.title = document.hidden ? `WRÓĆ. ${masks[cur].p.name} CZEKA.` : title; });

  /* start */
  const want = (location.hash || '').slice(1) || new URLSearchParams(location.search).get('id');
  const start = Math.max(0, masks.findIndex(m => m.id === want));
  cur = -1; show(start, 0, true);
  if (sala.ok) { sala.state.pow = 0; sala.power(1); }
})();
