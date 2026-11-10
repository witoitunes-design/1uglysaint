/* 1uglysaint — ATMOSPHERE
   Hanging lamp (pendulum physics, grab & swing, broken flicker, light cone, dust),
   synthesized room sound (WebAudio, opt-in), WATCHER.EXE eye, scrambled window titles.
   No libraries, no media files. prefers-reduced-motion → static lamp, no flicker. */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches;
  const US = window.US || {};
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (a, b) => a + Math.random() * (b - a);

  /* =================================================================
     SOUND — synthesized, off until the visitor turns it on
     ================================================================= */
  const Sound = {
    ctx: null, on: false, hum: null, master: null,
    init() {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      const ctx = this.ctx = new AC();
      const master = this.master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
      // mains hum: 50 Hz saw + 100 Hz sine, darkened
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
      const hum = this.hum = ctx.createGain(); hum.gain.value = 0.05;
      const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 50;
      const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 100;
      const g2 = ctx.createGain(); g2.gain.value = 0.6;
      o1.connect(lp); o2.connect(g2).connect(lp); lp.connect(hum).connect(master);
      // room drone: two detuned lows breathing against each other
      const drone = ctx.createGain(); drone.gain.value = 0.07; drone.connect(master);
      [41, 43.6].forEach(f => { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.connect(drone); o.start(); });
      // air: filtered noise
      const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
      const air = ctx.createBufferSource(); air.buffer = buf; air.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 600; bp.Q.value = 0.4;
      const ag = ctx.createGain(); ag.gain.value = 0.012;
      air.connect(bp).connect(ag).connect(master); air.start();
      o1.start(); o2.start();
      return true;
    },
    toggle() {
      if (!this.ctx && !this.init()) return false;
      this.on = !this.on;
      this.ctx.resume?.();
      this.master.gain.setTargetAtTime(this.on ? 0.55 : 0, this.ctx.currentTime, 0.25);
      return this.on;
    },
    level(i) { if (this.on && this.hum) this.hum.gain.setTargetAtTime(0.012 + 0.05 * i, this.ctx.currentTime, 0.02); },
    crackle(strength = 1) {
      if (!this.on) return;
      const ctx = this.ctx, t = ctx.currentTime;
      const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = rnd(1800, 4200); bp.Q.value = 2;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.18 * strength, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + rnd(0.04, 0.12));
      src.connect(bp).connect(g).connect(this.master);
      src.start(t, rnd(0, 1.5)); src.stop(t + 0.2);
    },
    thud() {
      if (!this.on) return;
      const ctx = this.ctx, t = ctx.currentTime;
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(35, t + 0.4);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.6, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.55);
      this.crackle(2);
    }
  };

  window.USSound = Sound;
  const soundBtn = document.createElement('button');
  soundBtn.type = 'button'; soundBtn.className = 'task-sound'; soundBtn.setAttribute('aria-pressed', 'false');
  soundBtn.innerHTML = '<span class="snd-bars" aria-hidden="true"><i></i><i></i><i></i></span><span class="snd-label">DŹWIĘK OFF</span>';
  soundBtn.title = 'Room sound';
  const setSoundUI = on => {
    soundBtn.setAttribute('aria-pressed', on); soundBtn.classList.toggle('on', on);
    soundBtn.querySelector('.snd-label').textContent = on ? 'DŹWIĘK ON' : 'DŹWIĘK OFF';
  };
  soundBtn.addEventListener('click', () => setSoundUI(Sound.toggle()));
  document.querySelector('.task-cart')?.before(soundBtn);

  /* =================================================================
     LAMP
     ================================================================= */
  const lamp = document.createElement('div');
  lamp.className = 'lamp';
  lamp.setAttribute('aria-hidden', 'true');
  lamp.innerHTML = `
    <div class="lamp-arm">
      <div class="lamp-cord"></div>
      <div class="lamp-head" title="">
        <svg class="lamp-shade" viewBox="0 0 64 44" width="64" height="44">
          <defs>
            <linearGradient id="shadeMetal" x1="0" x2="1">
              <stop offset="0" stop-color="#0d0909"/><stop offset=".35" stop-color="#4a3a35"/>
              <stop offset=".55" stop-color="#86716a"/><stop offset=".75" stop-color="#2c2120"/><stop offset="1" stop-color="#0b0808"/>
            </linearGradient>
            <linearGradient id="shadeIn" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#1a1010"/><stop offset="1" stop-color="#ffd9b0" class="shade-inner-stop"/>
            </linearGradient>
          </defs>
          <rect x="28" y="0" width="8" height="7" fill="#2a2020" stroke="#5c4943" stroke-width=".8"/>
          <path d="M24 7 h16 l20 30 h-56z" fill="url(#shadeMetal)" stroke="#9c847b" stroke-width=".8"/>
          <ellipse class="shade-mouth" cx="32" cy="37" rx="28" ry="5" fill="url(#shadeIn)"/>
          <path d="M12 26 q20 -4 40 0" stroke="#a88f86" stroke-width=".6" fill="none" opacity=".5"/>
          <circle cx="45" cy="22" r="1.2" fill="#3b2b28"/><path d="M18 18 l2 6" stroke="#6b2c2c" stroke-width="1.6" opacity=".7"/>
        </svg>
        <div class="lamp-bulb"></div>
      </div>
    </div>`;
  const glow = document.createElement('div'); glow.className = 'lamp-glow'; glow.setAttribute('aria-hidden', 'true');
  const dim = document.createElement('div'); dim.className = 'power-dim'; dim.setAttribute('aria-hidden', 'true');
  const dust = document.createElement('canvas'); dust.className = 'lamp-dust'; dust.setAttribute('aria-hidden', 'true');
  document.body.append(dim, glow, dust, lamp);

  const arm = lamp.querySelector('.lamp-arm');
  const cord = lamp.querySelector('.lamp-cord');
  const head = lamp.querySelector('.lamp-head');
  const bulb = lamp.querySelector('.lamp-bulb');
  const dctx = dust.getContext('2d');

  // geometry (document coords): anchor at top, hanging over the hero
  let ax = 0, L = 150, Ltarget = 150;
  function layout() {
    const room = document.querySelector('.room');
    const sHero = document.querySelector('.s-hero');
    const hero = document.querySelector('.welcome-window .hero') || document.querySelector('.main-column .sys-window');
    const r = hero?.getBoundingClientRect();
    const mobile = innerWidth < 760;
    if (sHero) {
      ax = innerWidth * .755;
      Ltarget = clamp(innerHeight * .17, 90, 200);
    } else if (room) {
      const rr = room.getBoundingClientRect();
      ax = rr.left + scrollX + rr.width * (mobile ? 0.5 : 0.5);
      Ltarget = clamp(innerHeight * (mobile ? 0.1 : 0.12), 50, 170);
    } else if (r) {
      ax = r.left + scrollX + r.width * (mobile ? 0.8 : 0.66);
      Ltarget = clamp(r.top + scrollY + (mobile ? 18 : 30), 70, 260);
    } else { ax = innerWidth * 0.7; Ltarget = 120; }
    if (state !== 'lowering') L = Ltarget;
    lamp.style.left = `${ax}px`;
    lamp.classList.toggle('small', mobile);
    const dpr = Math.min(devicePixelRatio || 1, 2);
    dust.width = innerWidth * dpr; dust.height = innerHeight * dpr;
    dust.style.width = innerWidth + 'px'; dust.style.height = innerHeight + 'px';
    dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // pendulum state
  let th = reduce ? 0 : 0.22, om = 0, state = 'hanging'; // hanging | grabbed | fallen | lowering
  let I = 1, Itarget = 1; // light intensity
  let fallY = 0, fallV = 0, fallRot = 0;
  const G = 2100, DAMP = 0.32;

  /* ---------- flicker director ---------- */
  let seq = [], seqT = 0, nextEvent = performance.now() + rnd(1500, 3500), killedUntil = 0;
  function schedule(now) {
    const r = Math.random();
    if (r < 0.5) { // stutter
      seq = []; const n = 3 + (Math.random() * 6 | 0);
      for (let i = 0; i < n; i++) seq.push([rnd(0, .35), rnd(30, 80)], [rnd(.7, 1), rnd(25, 110)]);
      seq.push([1, 0]);
    } else if (r < 0.8) { // brown-out
      seq = [[rnd(.35, .6), rnd(500, 1600)], [rnd(.1, .3), 60], [1, 0]];
    } else if (r < 0.93) { // dies for a moment
      seq = [[0, rnd(250, 900)], [.6, 50], [0, 80], [1, 0]];
    } else { // long dread
      seq = [[.85, 300], [.5, 300], [.25, 900], [0, 400], [.9, 60], [0, 120], [1, 0]];
    }
    seqT = now; nextEvent = now + rnd(2200, 7500);
  }
  function setLevel(v) {
    if (Math.abs(v - Itarget) > .3) Sound.crackle(Math.abs(v - Itarget));
    Itarget = v;
  }

  /* ---------- interaction: grab, swing, click to kill ---------- */
  let grabbing = false, downX = 0, downY = 0, moved = 0, lastTh = 0, lastT = 0, clicks = 0, clickTimer;
  function pointerTheta(e) {
    const ay = -scrollY; // anchor y in viewport (document top)
    return clamp(Math.atan2(e.clientX - (ax - scrollX), Math.max(10, e.clientY - ay)), -1.25, 1.25);
  }
  head.addEventListener('pointerdown', e => {
    if (state === 'fallen' || state === 'lowering') return;
    grabbing = true; state = 'grabbed'; moved = 0; downX = e.clientX; downY = e.clientY;
    lastTh = th; lastT = performance.now();
    head.setPointerCapture(e.pointerId); lamp.classList.add('grabbed');
    e.preventDefault();
  });
  head.addEventListener('pointermove', e => {
    if (!grabbing) return;
    moved = Math.max(moved, Math.hypot(e.clientX - downX, e.clientY - downY));
    const now = performance.now(), nt = pointerTheta(e);
    const dt = Math.max(1, now - lastT) / 1000;
    om = clamp((nt - lastTh) / dt, -9, 9);
    th = nt; lastTh = nt; lastT = now;
  });
  const release = () => {
    if (!grabbing) return;
    grabbing = false; lamp.classList.remove('grabbed'); state = 'hanging';
    if (moved < 5) kill();
  };
  head.addEventListener('pointerup', release); head.addEventListener('pointercancel', release);

  function kill() {
    clicks++; clearTimeout(clickTimer); clickTimer = setTimeout(() => { clicks = 0; }, 4000);
    om += (Math.random() < .5 ? -1 : 1) * rnd(1.2, 2.2);
    if (clicks >= 5) { clicks = 0; return breakLamp(); }
    seq = [[0, 70], [1, 40], [0, rnd(600, 1300)], [.5, 60], [0, 90], [1, 0]]; seqT = performance.now();
    spark();
    const lines = ['DON’T.', 'THAT WAS THE ONLY LIGHT.', 'STOP.', 'IT DOES NOT LIKE THAT.'];
    if (clicks > 1) US.notify?.(lines[(clicks - 2) % lines.length]);
  }
  function spark() {
    Sound.crackle(1.6);
    for (let i = 0; i < 14; i++) sparks.push({ x: 0, y: 0, vx: rnd(-160, 160), vy: rnd(-200, 40), life: rnd(.3, .7) });
  }
  function breakLamp() {
    state = 'fallen'; fallY = 0; fallV = 0; fallRot = 0;
    spark(); Sound.thud();
    seq = [[0, 99999]]; seqT = performance.now();
    lamp.classList.add('fallen');
    US.notify?.('ROZBIŁEŚ TO. ARCHIWUM PAMIĘTA.');
    store.set('us-lamps-broken', String((+store.get('us-lamps-broken') || 0) + 1));
    setTimeout(lowerNew, 5200);
  }
  function lowerNew() {
    lamp.classList.remove('fallen');
    state = 'lowering'; L = 0; th = 0; om = 0; fallY = 0; fallRot = 0;
    seq = [[0, 600], [.4, 80], [0, 140], [1, 0]]; seqT = performance.now();
    US.notify?.('ZAMONTOWANO NOWĄ.');
  }

  // scroll gives the lamp a push
  let lastScroll = scrollY;
  addEventListener('scroll', () => {
    const d = scrollY - lastScroll; lastScroll = scrollY;
    if (state === 'hanging' && !reduce) om += clamp(d * 0.0016, -0.6, 0.6);
  }, { passive: true });

  /* ---------- dust ---------- */
  const motes = [];
  const MOTES = reduce ? 0 : (fine ? 46 : 22);
  for (let i = 0; i < MOTES; i++) motes.push({ u: rnd(-1, 1), v: rnd(.05, 1), s: rnd(.6, 1.8), du: rnd(-.03, .03), dv: rnd(-.02, .02), tw: rnd(0, 6.28) });
  const sparks = [];

  /* ---------- main loop ---------- */
  const isCine = document.body.classList.contains('cine');
  let noLamp = (isCine && innerWidth < 820) || document.body.dataset.lamp === 'off';
  if (noLamp) { lamp.style.display = 'none'; glow.style.display = 'none'; dust.style.display = 'none'; }
  const roomEl = document.querySelector('.room');
  const hudLamp = document.getElementById('hud-lamp');
  let last = performance.now(), running = true;
  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;

    // physics
    if (state === 'hanging' && !reduce) {
      const wind = (Math.sin(now / 2300) * 0.6 + Math.sin(now / 900) * 0.25 + rnd(-.5, .5)) * 0.16;
      om += (-(G / Math.max(60, L)) * Math.sin(th) - DAMP * om + wind) * dt;
      th += om * dt;
    } else if (state === 'lowering') {
      L += (Ltarget - L) * Math.min(1, dt * 2.2);
      if (Math.abs(Ltarget - L) < 1) { L = Ltarget; state = 'hanging'; om = 0.6; }
    } else if (state === 'fallen') {
      fallV += 2600 * dt; fallY += fallV * dt; fallRot += dt * 4 * Math.sign(th || 1);
    }

    // flicker
    if (!reduce && state !== 'fallen') {
      if (!seq.length && now > nextEvent) schedule(now);
      if (seq.length) {
        let t = now - seqT, acc = 0, lvl = 1, done = true;
        for (const [v, d] of seq) { acc += d; lvl = v; if (t < acc) { done = false; break; } }
        if (done) { seq = []; lvl = 1; }
        if (lvl !== Itarget) setLevel(lvl);
      }
    } else if (state === 'fallen') Itarget = 0;
    I += (Itarget + (Itarget > .9 ? rnd(-.04, .02) : 0) - I) * Math.min(1, dt * 40);
    Sound.level(I);
    if (noLamp) {
      document.documentElement.style.setProperty('--lamp', I.toFixed(3));
      dim.style.opacity = ((1 - I) * .22).toFixed(3);
      requestAnimationFrame(frame);
      return;
    }

    // render lamp
    cord.style.height = `${L}px`;
    head.style.top = `${L}px`;
    arm.style.transform = `rotate(${-th}rad)`;
    const sc = innerWidth < 760 ? ' scale(.78)' : ' scale(1.25)';
    head.style.transform = state === 'fallen' ? `translateY(${fallY}px) rotate(${fallRot}rad)${sc}` : sc.trim();
    cord.classList.toggle('snapped', state === 'fallen');
    lamp.style.setProperty('--i', I.toFixed(3));
    document.documentElement.style.setProperty('--lamp', I.toFixed(3));

    // bulb in viewport coords
    const R = L + (innerWidth < 760 ? 30 : 48);
    const bx = ax - scrollX + Math.sin(th) * R;
    const by = -scrollY + Math.cos(th) * R;
    const visible = by > -120 && by < innerHeight + 200;
    const gh = glow.offsetWidth / 2;
    glow.style.transform = `translate(${bx - gh}px, ${by}px) rotate(${-th}rad)`;
    glow.style.opacity = state === 'fallen' ? 0 : (I * (visible ? 1 : 0) * (isCine ? .5 : 1)).toFixed(3);
    window.USLampPos = { x: bx / innerWidth, y: 1 - (by + 40) / innerHeight, on: visible && state !== 'fallen' && by > -20 && by < innerHeight * .9 };
    dim.style.opacity = ((1 - I) * (visible ? .42 : .18)).toFixed(3);
    if (roomEl) {
      const ry = roomEl.offsetTop;
      const cone = 210;
      roomEl.style.setProperty('--lx', `${bx + scrollX - roomEl.offsetLeft + Math.sin(th) * cone}px`);
      roomEl.style.setProperty('--ly', `${by + scrollY - ry + Math.cos(th) * cone}px`);
      roomEl.style.setProperty('--li', state === 'fallen' ? 0 : I.toFixed(3));
      if (hudLamp && (now | 0) % 6 === 0) hudLamp.textContent = state === 'fallen' ? 'LIGHT: NO SIGNAL' : `LIGHT: ${Math.min(100, Math.round(I * 100))}%`;
    }

    // dust + sparks
    dctx.clearRect(0, 0, innerWidth, innerHeight);
    if (visible && state !== 'fallen' && I > .05) {
      dctx.save(); dctx.translate(bx, by); dctx.rotate(-th);
      for (const m of motes) {
        m.u += m.du * dt; m.v += m.dv * dt; m.tw += dt * 2;
        if (m.v < .03 || m.v > 1 || Math.abs(m.u) > 1) { m.u = rnd(-.8, .8); m.v = rnd(.1, .9); }
        const y = m.v * 480, x = m.u * (40 + m.v * 260);
        const a = I * (1 - m.v) * (1 - Math.abs(m.u)) * (.45 + .35 * Math.sin(m.tw));
        if (a <= 0.01) continue;
        dctx.fillStyle = `rgba(255,222,196,${a.toFixed(3)})`;
        dctx.beginPath(); dctx.arc(x, y, m.s, 0, 6.283); dctx.fill();
      }
      dctx.restore();
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.vy += 700 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      if (s.life <= 0) { sparks.splice(i, 1); continue; }
      dctx.strokeStyle = `rgba(255,${180 + (s.life * 100 | 0)},120,${Math.min(1, s.life * 2)})`;
      dctx.lineWidth = 1.4;
      dctx.beginPath(); dctx.moveTo(bx + s.x, by + s.y); dctx.lineTo(bx + s.x - s.vx * .02, by + s.y - s.vy * .02); dctx.stroke();
    }

    requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running) { last = performance.now(); requestAnimationFrame(frame); }
  });
  addEventListener('resize', layout);
  addEventListener('load', layout);
  layout();
  requestAnimationFrame(frame);

  window.USLamp = { kill: () => { if (state === 'hanging') kill(); }, break: () => { if (state !== 'fallen') breakLamp(); } };

  /* =================================================================
     WATCHER.EXE — an eye that follows you
     ================================================================= */
  const widgets = document.querySelector('.widget-column');
  if (widgets) {
    const visits = (+store.get('us-visits') || 0) + 1; store.set('us-visits', String(visits));
    widgets.insertAdjacentHTML('beforeend', `
      <section class="sys-window widget eye-window" aria-label="Watcher">
        <div class="window-bar"><div class="window-name">WATCHER.EXE</div><div class="window-actions"><span class="rec-dot" aria-hidden="true"></span></div></div>
        <div class="eye-wrap">
          <svg class="eye" viewBox="0 0 220 110" aria-hidden="true">
            <defs>
              <clipPath id="eyeClip"><path d="M12 55 Q110 -12 208 55 Q110 122 12 55Z"/></clipPath>
              <radialGradient id="sclera" cx="50%" cy="50%" r="60%"><stop offset="0" stop-color="#d9c6b8"/><stop offset=".7" stop-color="#a18779"/><stop offset="1" stop-color="#3b2622"/></radialGradient>
              <radialGradient id="iris" cx="45%" cy="40%" r="60%"><stop offset="0" stop-color="#b8484f"/><stop offset=".55" stop-color="#5a1a1f"/><stop offset="1" stop-color="#160607"/></radialGradient>
            </defs>
            <g clip-path="url(#eyeClip)">
              <rect width="220" height="110" fill="url(#sclera)"/>
              <path d="M30 40 q30 10 50 4 M150 70 q20 -6 40 4 M40 72 q14 -2 26 6" stroke="#8a2a2e" stroke-width="1" fill="none" opacity=".55"/>
              <g class="eye-iris"><circle r="27" fill="url(#iris)"/><circle class="pupil" r="11" fill="#030101"/><circle cx="-8" cy="-9" r="4" fill="#fff" opacity=".75"/></g>
              <rect class="lid lid-top" x="0" y="-110" width="220" height="110" fill="#140c0c"/>
              <rect class="lid lid-bot" x="0" y="110" width="220" height="110" fill="#140c0c"/>
            </g>
            <path d="M12 55 Q110 -12 208 55 Q110 122 12 55Z" fill="none" stroke="#6d5750" stroke-width="2"/>
          </svg>
          <div class="eye-caption" aria-live="polite">${visits === 1 ? 'PIERWSZY RAZ TUTAJ. ZAUWAŻYŁO.' : `BYŁEŚ TU JUŻ ${visits} RAZY.`}</div>
        </div>
      </section>`);
    const ew = widgets.querySelector('.eye-window');
    const svg = ew.querySelector('.eye');
    const iris = ew.querySelector('.eye-iris');
    const pupil = ew.querySelector('.pupil');
    const cap = ew.querySelector('.eye-caption');
    let look = { x: 0, y: 0 }, cur = { x: 0, y: 0 }, forced = 0, shy = false, idleT = performance.now();
    const say = t => { cap.textContent = t; };
    const target = (cx, cy) => {
      const r = svg.getBoundingClientRect();
      const ex = r.left + r.width / 2, ey = r.top + r.height / 2;
      const dx = cx - ex, dy = cy - ey, d = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, d / 400);
      look = { x: dx / d * 62 * k, y: dy / d * 22 * k };
    };
    addEventListener('pointermove', e => { idleT = performance.now(); if (performance.now() > forced) target(e.clientX, e.clientY); }, { passive: true });
    const setLid = c => ew.classList.toggle('closed', c);
    const blink = () => { if (shy) return; ew.classList.add('blink'); setTimeout(() => ew.classList.remove('blink'), 140); };
    (function blinkLoop() { if (!reduce) blink(); setTimeout(blinkLoop, rnd(2200, 6500)); })();
    ew.addEventListener('pointerenter', () => { shy = true; setLid(true); say('NIE DOTYKAJ.'); });
    ew.addEventListener('pointerleave', () => { shy = false; setLid(false); say('WCIĄŻ PATRZY.'); });
    document.addEventListener('us:add', () => {
      const c = document.querySelector('.task-cart')?.getBoundingClientRect();
      if (c) { target(c.left + c.width / 2, c.top); forced = performance.now() + 1600; }
      say('WIDZIAŁO TO.');
    });
    document.addEventListener('us:open', e => say(`WIE, ŻE OGLĄDAŁEŚ ${e.detail.id}.`));
    let eyeOn = true;
    if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { eyeOn = e.isIntersecting; }).observe(ew);
    (function eyeLoop() {
      if (!eyeOn) return setTimeout(() => requestAnimationFrame(eyeLoop), 250);
      cur.x += (look.x - cur.x) * 0.12; cur.y += (look.y - cur.y) * 0.12;
      iris.setAttribute('transform', `translate(${110 + cur.x} ${55 + cur.y})`);
      // pupil reacts to the lamp: dark → wide
      const lampI = parseFloat(document.documentElement.style.getPropertyValue('--lamp')) || 1;
      pupil.setAttribute('r', (8 + (1 - lampI) * 9).toFixed(2));
      const sleepy = performance.now() - idleT > 20000;
      if (!shy) setLid(sleepy);
      requestAnimationFrame(eyeLoop);
    })();
  }

  /* =================================================================
     Window titles decode from noise when they come into view
     ================================================================= */
  if (!reduce && 'IntersectionObserver' in window) {
    const glyphs = '█▓▒░#$%&@*+=/\\<>†‡¤§¿?01';
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      const node = [...e.target.childNodes].find(n => n.nodeType === 3 && n.textContent.trim());
      if (!node) return;
      const final = node.textContent; let f = 0;
      const total = 18;
      (function step() {
        f++;
        node.textContent = final.split('').map((ch, i) => (ch === ' ' || i < (f / total) * final.length) ? ch : glyphs[Math.random() * glyphs.length | 0]).join('');
        if (f < total) setTimeout(step, 38); else node.textContent = final;
      })();
    }), { threshold: .6 });
    setTimeout(() => document.querySelectorAll('.site-grid .window-name').forEach(n => io.observe(n)), 300);
  }

  /* =================================================================
     terminal hooks
     ================================================================= */
  const C = window.US_CMDS, T = window.US_TERM;
  if (C && T && !document.body.classList.contains('cine')) {
    C.lamp = () => {
      const b = +store.get('us-lamps-broken') || 0;
      T.print(state === 'fallen' ? 'LAMP: ON THE FLOOR.' : `LAMP: ${I > .8 ? 'ON' : 'STRUGGLING'}. ${b ? `YOU HAVE BROKEN ${b}.` : 'NOBODY HAS BROKEN IT. YET.'}`);
    };
    C.light = C.lamp;
    C.fix = () => { if (state === 'fallen') { lowerNew(); T.print('FINE.'); } else T.print('NOTHING TO FIX. FOR NOW.'); };
    C.break = () => { T.print('IF YOU INSIST.'); setTimeout(breakLamp, 400); };
    C.sound = () => { setSoundUI(Sound.toggle()); T.print(Sound.on ? 'POKÓJ SŁUCHA.' : 'CISZA.'); };
  }
})();
