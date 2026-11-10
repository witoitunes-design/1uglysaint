/* 1uglysaint — KONTAKT: an incoming call.
   The phone rings (and shakes) a moment after you arrive. Decline and it calls back.
   Answer: a voice on the line, a keypad menu (1 order · 2 question · 3 other), and then the
   message you'll send writes itself with you — out through Instagram or the clipboard.
   Plain contact details stay visible next to the phone the whole time. */
(() => {
  const US = window.US || {};
  const SHOP = window.SHOP || {};
  const DATA = US.DATA || window.PRODUCTS || [];
  const $ = s => document.querySelector(s);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  const kt = $('#main'), phone = $('#phone');

  /* ---------------- plain contact (always there) ---------------- */
  const ig = $('#ki-ig');
  if (SHOP.instagram) { ig.textContent = '@' + SHOP.instagram; ig.href = `https://instagram.com/${encodeURIComponent(SHOP.instagram)}`; }
  else ig.removeAttribute('href');
  $('#pm-ig').hidden = !SHOP.instagram;
  $('#pm-note').hidden = !!SHOP.instagram;
  if (!SHOP.instagram) $('#pm-copy').classList.add('solid');

  /* ---------------- caller: one of the masks ---------------- */
  function face() {
    const p = DATA[Math.random() * DATA.length | 0];
    const src = p ? (p.images && p.images[0] || '').replace(/\.webp$/, '-sm.webp') : '';
    ['#pr-img', '#pc-img', '#pm-img'].forEach(s => { const im = $(s); if (im && src) im.src = src; });
  }

  /* ---------------- status bar clock ---------------- */
  const clock = $('#ph-clock');
  const tick = () => { const d = new Date(); clock.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  tick(); setInterval(tick, 15000);

  /* ---------------- sound (only when the visitor turned sound on) ---------------- */
  const snd = () => { const S = window.USSound; return S && S.on && S.ctx ? S : null; };
  function ringTone() {
    const S = snd(); if (!S) return;
    const ctx = S.ctx, t = ctx.currentTime;
    const g = ctx.createGain(); g.gain.value = 0; g.connect(S.master);
    [440, 480].forEach(f => { const o = ctx.createOscillator(); o.frequency.value = f; o.connect(g); o.start(t); o.stop(t + 1.1); });
    [[0, .4], [.6, 1.0]].forEach(([a, b]) => { g.gain.setValueAtTime(0, t + a); g.gain.linearRampToValueAtTime(.06, t + a + .02); g.gain.setValueAtTime(.06, t + b - .02); g.gain.linearRampToValueAtTime(0, t + b); });
  }
  const DT = { '1': [697, 1209], '2': [697, 1336], '3': [697, 1477], '4': [770, 1209], '5': [770, 1336], '6': [770, 1477], '7': [852, 1209], '8': [852, 1336], '9': [852, 1477], '*': [941, 1209], '0': [941, 1336], '#': [941, 1477] };
  function dtmf(k) {
    const S = snd(); if (!S || !DT[k]) return;
    const ctx = S.ctx, t = ctx.currentTime, g = ctx.createGain();
    g.gain.setValueAtTime(.07, t); g.gain.exponentialRampToValueAtTime(.0001, t + .18); g.connect(S.master);
    DT[k].forEach(f => { const o = ctx.createOscillator(); o.frequency.value = f; o.connect(g); o.start(t); o.stop(t + .2); });
  }
  function blip() {
    const S = snd(); if (!S) return;
    const ctx = S.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(75 + Math.random() * 50, t); o.frequency.exponentialRampToValueAtTime(50, t + .09);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900 + Math.random() * 500; f.Q.value = 3;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.08, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + .1);
    o.connect(f).connect(g).connect(S.master); o.start(t); o.stop(t + .11);
  }
  const buzz = ms => { try { navigator.vibrate && !fine && navigator.vibrate(ms); } catch (e) {} };

  /* ---------------- state ---------------- */
  let state = 'idle', declines = 0, tok = 0, ringI = 0, ringTO = 0, callT0 = 0, timeI = 0, talking = 0, lastVoice = '';
  const setState = s => { state = s; phone.dataset.state = s; kt.classList.toggle('ringing', s === 'ring'); };
  const prK = $('#pr-k'), prNum = $('#pr-num');

  function ring() {
    tok++;
    face();
    setState('ring');
    const again = declines > 0;
    prK.textContent = again ? 'DZWONI PONOWNIE' : 'POŁĄCZENIE PRZYCHODZĄCE';
    prK.classList.toggle('warn', again);
    prNum.textContent = again ? 'nie rozłączaj się.' : 'numer zastrzeżony';
    prNum.classList.toggle('warn', again);
    clearInterval(ringI); ringTone(); ringI = setInterval(ringTone, 2400);
    clearTimeout(ringTO); ringTO = setTimeout(() => { if (state === 'ring') missed(); }, 32000);
  }
  function stopRing() { clearInterval(ringI); clearTimeout(ringTO); }

  $('#pb-no').addEventListener('click', () => {
    stopRing(); declines++; buzz(15);
    if (declines >= 2) { missed(); return; }
    prK.textContent = 'ODRZUCONO'; prNum.textContent = '…';
    setState('declined');
    const my = ++tok;
    setTimeout(() => { if (my === tok) ring(); }, 1700);
  });
  $('#pb-yes').addEventListener('click', answer);
  addEventListener('keydown', e => {
    if (document.querySelector('dialog[open]') || e.target.closest('input, textarea')) return;
    if (state === 'ring' && (e.key === 'Enter')) { e.preventDefault(); answer(); }
    else if (state === 'ring' && e.key === 'Escape') $('#pb-no').click();
    else if (state === 'call' && DT[e.key]) press(e.key);
  });

  /* ---------------- the call ---------------- */
  const lines = $('#pc-lines'), menu = $('#pc-menu'), timeEl = $('#pc-time');
  function answer() {
    if (state !== 'ring') return;
    stopRing(); buzz(30);
    setState('call');
    lines.innerHTML = ''; menu.hidden = true;
    callT0 = performance.now();
    clearInterval(timeI); timeI = setInterval(() => { const s = (performance.now() - callT0) / 1000 | 0; timeEl.textContent = `${pad(s / 60 | 0)}:${pad(s % 60)}`; }, 500);
    const my = ++tok;
    wait(700).then(() => my === tok && say('Wiedziałem, że odbierzesz.', my))
      .then(() => my === tok && wait(500))
      .then(() => my === tok && say('Czego chcesz?', my))
      .then(() => { if (my === tok) menu.hidden = false; });
  }
  const wait = ms => new Promise(r => setTimeout(r, ms));
  function say(text, my) {
    lastVoice = text;
    return new Promise(res => {
      lines.querySelectorAll('p').forEach(p => p.classList.add('old'));
      const olds = lines.querySelectorAll('p.old'); if (olds.length > 2) olds[0].remove();
      const p = document.createElement('p'); p.className = 'typing'; lines.appendChild(p);
      if (reduce) { p.textContent = text; p.classList.remove('typing'); res(); return; }
      let i = 0; talking = 1;
      const it = setInterval(() => {
        if (my !== tok) { clearInterval(it); talking = 0; res(); return; }
        i++; p.textContent = text.slice(0, i);
        if (i % 3 === 0) blip();
        if (i >= text.length) { clearInterval(it); p.classList.remove('typing'); talking = 0; setTimeout(res, 260); }
      }, 34);
    });
  }

  /* keypad */
  const keys = $('#pc-keys');
  keys.innerHTML = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map(k => `<button type="button" data-key="${k}" aria-label="${k}">${k}</button>`).join('');
  keys.addEventListener('click', e => { const b = e.target.closest('[data-key]'); if (b) press(b.dataset.key); });
  menu.addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) press(b.dataset.k); });
  function press(k) {
    dtmf(k); buzz(8);
    const b = keys.querySelector(`[data-key="${CSS.escape(k)}"]`); if (b) { b.classList.add('hit'); setTimeout(() => b.classList.remove('hit'), 160); }
    if (state !== 'call' || menu.hidden) return;
    menu.hidden = true;
    const my = ++tok;
    const cartN = US.totals ? US.totals().count : 0;
    if (k === '1') {
      if (cartN) say('Widzę, co wybrałeś.', my).then(() => my === tok && say('Napisz, gdzie mam to wysłać.', my)).then(() => my === tok && wait(400)).then(() => my === tok && compose('order'));
      else say('Najpierw wybierz twarz.', my).then(() => my === tok && wait(400)).then(() => my === tok && compose('order-empty'));
    } else if (k === '2') say('Pytaj. Odpiszemy.', my).then(() => my === tok && wait(400)).then(() => my === tok && compose('ask'));
    else if (k === '3') say('Słucham.', my).then(() => my === tok && wait(400)).then(() => my === tok && compose('other'));
    else say('Nie ma takiej opcji.', my).then(() => { if (my === tok) menu.hidden = false; });
  }
  $('#pb-end').addEventListener('click', () => end('hang'));

  /* waveform: the voice when it talks, line noise when it doesn't */
  const wv = $('#pc-wave'), wx = wv.getContext('2d');
  const hist = new Array(48).fill(0);
  function wave() {
    requestAnimationFrame(wave);
    if (state !== 'call' || document.hidden) return;
    const r = wv.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2);
    if (wv.width !== Math.round(r.width * d)) { wv.width = Math.round(r.width * d); wv.height = Math.round(r.height * d); }
    const W = wv.width, H = wv.height;
    hist.push(talking ? .25 + Math.random() * .75 : .03 + Math.random() * .05); hist.shift();
    wx.clearRect(0, 0, W, H);
    const bw = W / hist.length;
    hist.forEach((v, i) => {
      const h = Math.max(2 * d, v * H * .9);
      wx.fillStyle = talking ? `rgba(255,${110 + v * 90 | 0},${110 + v * 60 | 0},${.45 + v * .55})` : 'rgba(189,179,170,.3)';
      wx.fillRect(i * bw + d, (H - h) / 2, Math.max(d, bw - 2 * d), h);
    });
  }
  if (!reduce) requestAnimationFrame(wave);

  /* ---------------- the message ---------------- */
  const thread = $('#pm-thread'), text = $('#pm-text'), nameIn = $('#pm-name');
  let topic = 'other';
  function compose(kind) {
    topic = kind;
    const bubbles = [];
    if (kind === 'order') { bubbles.push('Widzę, co wybrałeś.', 'Dopisz imię, adres i telefon. Odpiszemy z płatnością i wysyłką.'); text.value = US.orderText ? US.orderText() : ''; text.placeholder = ''; }
    else if (kind === 'order-empty') { bubbles.push('Najpierw wybierz twarz.', '<a href="sklep.html">Przymierzalnia →</a> — albo napisz, czego szukasz.'); text.value = ''; text.placeholder = 'Chcę zamówić maskę…'; }
    else if (kind === 'ask') { bubbles.push('Pytaj. Odpiszemy.'); text.value = ''; text.placeholder = 'Twoje pytanie…'; }
    else { bubbles.push(lastVoice && kind === 'other' ? lastVoice : 'Pisz.'); text.value = ''; text.placeholder = 'Pisz, słucham…'; }
    thread.innerHTML = bubbles.map((b, i) => `<p style="animation-delay:${i * .25}s">${b.startsWith('<a') ? b : esc(b)}</p>`).join('');
    setState('msg');
    if (fine) setTimeout(() => text.focus({ preventScroll: true }), 450);
  }
  $('#pm-back').addEventListener('click', () => { setState('call'); menu.hidden = false; });
  const message = () => {
    const m = text.value.trim(), n = nameIn.value.trim();
    return m ? m + (n ? `\n\n— ${n}` : '') : '';
  };
  const emptyMsg = () => { if (message()) return false; US.notify?.('NIC NIE NAPISAŁEŚ'); text.focus(); return true; };
  $('#pm-ig').addEventListener('click', async () => {
    if (emptyMsg()) return;
    try { await navigator.clipboard.writeText(message()); } catch (e) {}
    window.open(`https://ig.me/m/${encodeURIComponent(SHOP.instagram)}`, '_blank', 'noopener');
    end('ig');
  });
  $('#pm-copy').addEventListener('click', async () => {
    if (emptyMsg()) return;
    try { await navigator.clipboard.writeText(message()); end('copy'); }
    catch (e) { text.select(); US.notify?.('ZAZNACZONE — SKOPIUJ RĘCZNIE'); }
  });

  /* ---------------- after ---------------- */
  const END = {
    ig: ['Wklej i wyślij.', 'Wiadomość jest w schowku. Otworzyłem Instagram.'],
    copy: ['Skopiowane.', 'Wyślij, gdzie chcesz. Odpiszemy.'],
    hang: ['Rozłączyłeś się.', 'Zadzwonimy jeszcze. Albo napisz pierwszy.'],
    missed: ['Nie odebrałeś.', 'Zadzwonimy jeszcze. Albo napisz pierwszy.']
  };
  function end(why) {
    tok++; stopRing(); clearInterval(timeI); talking = 0;
    const s = callT0 ? (performance.now() - callT0) / 1000 | 0 : 0;
    $('#pe-k').textContent = why === 'missed' ? `${declines || 1} NIEODEBRANE POŁĄCZENIA`.replace(/^1 NIEODEBRANE POŁĄCZENIA/, '1 NIEODEBRANE POŁĄCZENIE') : 'POŁĄCZENIE ZAKOŃCZONE';
    $('#pe-time').textContent = why === 'missed' ? 'od: 1uglysaint' : `${pad(s / 60 | 0)}:${pad(s % 60)}`;
    $('#pe-h').textContent = END[why][0];
    $('#pe-p').textContent = END[why][1];
    $('#pe-again').textContent = why === 'missed' ? 'ODDZWOŃ' : 'ZADZWOŃ PONOWNIE';
    setState('end');
    if (why !== 'hang' && why !== 'missed') buzz([20, 40, 20]);
  }
  function missed() { declines = Math.max(declines, 2); end('missed'); }
  $('#pe-again').addEventListener('click', () => { declines = 0; callT0 = 0; ring(); });
  $('#pe-write').addEventListener('click', () => compose('other-direct'));

  /* ---------------- go ---------------- */
  face();
  setTimeout(() => { if (state === 'idle') ring(); }, reduce ? 0 : 1300);
})();
