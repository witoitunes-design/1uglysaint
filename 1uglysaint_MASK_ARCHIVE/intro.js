/* 1uglysaint — INTRO: "TAŚMA_07.VHS"
   A found tape from the archive basement, rendered live in one WebGL shader:
   CRT warm-up line → snow → the wall of faces fights through tracking errors, tearing,
   block corruption, breathing warp → subliminal mask frames + words that jerk on screen →
   everything calms into a warm, lit wall and "WITAJ W ARCHIWUM." → the TV switches off into the site.
   The cursor/finger is a warm light that calms the signal inside its circle (the pleasant part).
   Optional live-synthesized sound (tape hiss, heartbeat, CRT zap). ~5 s, skippable.
   Flash safety: no full-screen strobing; subliminal frames are dim and ≥400 ms apart.
   API: window.USIntro = { finished: Promise }  — resolves when the TV switches off. */
(() => {
  const root = document.getElementById('intro');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let resolveFinished;
  const finished = new Promise(r => { resolveFinished = r; });
  window.USIntro = { finished, sound: false };
  const html = document.documentElement;
  const bail = () => { root?.remove(); html.classList.remove('intro-lock'); resolveFinished(); };
  if (!root || reduce) return bail();
  // the tape plays once per visit; coming back from a subpage goes straight to the room (?intro replays it)
  try {
    if (sessionStorage.getItem('us-intro') && !/[?&]intro\b/.test(location.search)) return bail();
    sessionStorage.setItem('us-intro', '1');
  } catch (e) {}
  // the visitor always lands on the hero, and can't scroll the page away under the tape
  html.classList.add('intro-lock');
  try { history.scrollRestoration = 'manual'; } catch (e) {}
  scrollTo(0, 0);
  const canvas = root.querySelector('canvas');
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });
  if (!gl) return bail();
  const mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 820;

  window.__usTex = window.__usTex || (location.protocol === 'file:' ? new Promise(res => {
    const s = document.createElement('script'); s.src = 'assets/textures-offline.js'; s.onload = s.onerror = res; document.head.append(s);
  }) : Promise.resolve());

  /* ---------------- shader ---------------- */
  const vs = 'attribute vec2 p; varying vec2 vUv; void main(){ vUv = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }';
  const fs = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uC, uM0, uM1, uM2;
  uniform vec2 uRes, uSizeC, uMouse;
  uniform float uT, uStatic, uTear, uBlock, uRoll, uWarp, uSplit, uSub, uSubIdx, uBright, uLens, uOpen, uZoom, uWarm;
  float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
  float fbm(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 3; i++){ v += a * noise(p); p *= 2.1; a *= .5; } return v; }
  vec2 cover(vec2 uv){
    float aspect = uRes.x / uRes.y, ri = uSizeC.x / uSizeC.y;
    vec2 s = aspect > ri ? vec2(1., ri / aspect) : vec2(aspect / ri, 1.);
    return (uv - .5) * s / uZoom + .5;
  }
  vec3 mask(vec2 uv){
    float aspect = uRes.x / uRes.y;
    vec2 q = uv - .5; q.x *= aspect;
    vec2 c = q / .95 + .5;
    if (c.x < 0. || c.x > 1. || c.y < 0. || c.y > 1.) return vec3(0.);
    vec3 m = uSubIdx < .5 ? texture2D(uM0, c).rgb : (uSubIdx < 1.5 ? texture2D(uM1, c).rgb : texture2D(uM2, c).rgb);
    return m * (1. - smoothstep(.3, .5, length(c - .5)));
  }
  void main(){
    vec2 uv = vUv;
    float aspect = uRes.x / uRes.y;
    vec2 dm = (vUv - uMouse) * vec2(aspect, 1.);
    float lens = uLens * (1. - smoothstep(.07, .27, length(dm)));
    float bt = floor(uT * 18.);
    // ---- the corrupted signal ----
    uv.y = fract(uv.y + uRoll);
    float band = floor(uv.y * 46.);
    float h = hash(vec2(band, bt));
    uv.x += (h - .5) * .14 * uTear * step(.8, h);
    uv.x += sin(uv.y * 240. + uT * 34.) * .0016 * uTear;
    vec2 blk = floor(uv * vec2(14., 9.));
    float bh = hash(blk + bt * 1.7);
    if (bh > 1. - uBlock * .3) uv += (vec2(hash(blk + 3.), hash(blk + 7.)) - .5) * .2;
    uv += (vec2(fbm(uv * 3. + uT * .3), fbm(uv * 3. + 7. + uT * .27)) - .5) * .045 * uWarp;
    float sp = uSplit + .0015;
    vec2 cu = cover(uv);
    vec3 col = vec3(texture2D(uC, cu + vec2(sp, 0.)).r, texture2D(uC, cu).g, texture2D(uC, cu - vec2(sp, 0.)).b);
    float g = dot(col, vec3(.3, .59, .11));
    col = mix(vec3(g), col, .45) * uBright;
    // ---- inside your light: the clean picture, warm and lit ----
    vec3 clean = texture2D(uC, cover(vUv + (vec2(fbm(vUv * 2. + uT * .2), fbm(vUv * 2. + 3.)) - .5) * .01)).rgb;
    clean = mix(vec3(dot(clean, vec3(.3, .59, .11))), clean, .6) * vec3(1.35, 1.02, .74) * (.55 + .9 * max(uBright, .5));
    col = mix(col, clean, lens);
    vec3 warm = vec3(1.15, .86, .62);
    col = mix(col, col * warm * 1.25, uWarm * (1. - lens));
    if (uSub > .001) col = mix(col, mask(vUv + (vec2(hash(vec2(bt, 2.)), hash(vec2(bt, 5.))) - .5) * .03) * vec3(1.3, .9, .8), uSub);
    float n = hash(vUv * uRes * .5 + fract(uT * 7.) * 100.);
    col = mix(col, vec3(n) * .7, uStatic * (1. - lens * .95));
    col *= .9 + .1 * sin(vUv.y * uRes.y * 1.35);
    col *= .9 + .1 * hash(vec2(floor(uT * 24.), 1.));
    vec2 v = vUv - .5; v.x *= aspect * .7;
    col *= 1. - smoothstep(.32, .98, length(v));
    float open = step(abs(vUv.y - .5), uOpen * .5);
    float edge = smoothstep(.008, 0., abs(abs(vUv.y - .5) - uOpen * .5)) * (1. - uOpen);
    col = col * open + vec3(1., .94, .88) * edge * 1.6;
    gl_FragColor = vec4(col, 1.);
  }`;
  const mk = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
  let prog;
  try { prog = gl.createProgram(); gl.attachShader(prog, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(prog); if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link'); }
  catch (e) { console.warn('intro off', e); return bail(); }
  gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const pl = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(pl); gl.vertexAttribPointer(pl, 2, gl.FLOAT, false, 0, 0);
  const U = {};
  ['uC', 'uM0', 'uM1', 'uM2', 'uRes', 'uSizeC', 'uMouse', 'uT', 'uStatic', 'uTear', 'uBlock', 'uRoll', 'uWarp', 'uSplit', 'uSub', 'uSubIdx', 'uBright', 'uLens', 'uOpen', 'uZoom', 'uWarm'].forEach(k => U[k] = gl.getUniformLocation(prog, k));

  const load = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = (window.US_TEX && window.US_TEX[src]) || src; });
  const texFrom = (img, unit) => {
    const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER].forEach(p => gl.texParameteri(gl.TEXTURE_2D, p, gl.LINEAR));
    [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(p => gl.texParameteri(gl.TEXTURE_2D, p, gl.CLAMP_TO_EDGE));
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
  };

  /* ---------------- UI ---------------- */
  const word = root.querySelector('.in-word');
  const calm = root.querySelector('.in-calm');
  const log = root.querySelector('.in-log');
  const tc = root.querySelector('.in-tc');
  const sndBtn = root.querySelector('.in-sound');
  const glyphs = '█▓▒░#%&@*+=/\\<>†‡§¿01';
  let wordTimer = null;
  function showWord(text, dur) {
    clearInterval(wordTimer);
    word.textContent = text; word.classList.add('on');
    let f = 0;
    wordTimer = setInterval(() => {
      f++;
      word.textContent = [...text].map((ch, i) => ch === ' ' || Math.random() < f / 6 ? ch : glyphs[Math.random() * glyphs.length | 0]).join('');
      word.style.transform = `translate(${(Math.random() - .5) * 18}px,${(Math.random() - .5) * 10}px) skewX(${(Math.random() - .5) * 14}deg)`;
    }, 45);
    setTimeout(() => { clearInterval(wordTimer); word.classList.remove('on'); word.style.transform = ''; }, dur);
    thump();
  }

  /* ---------------- sound (opt-in) ---------------- */
  let A = null;
  function audioOn() {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = new AC();
    const master = ctx.createGain(); master.gain.value = .7; master.connect(ctx.destination);
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const hiss = ctx.createBufferSource(); hiss.buffer = buf; hiss.loop = true;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1200;
    const hg = ctx.createGain(); hg.gain.value = 0; hiss.connect(hp).connect(hg).connect(master); hiss.start();
    const drone = ctx.createGain(); drone.gain.value = .0; drone.connect(master);
    [38, 40.5, 57].forEach(f => { const o = ctx.createOscillator(); o.frequency.value = f; o.connect(drone); o.start(); });
    drone.gain.setTargetAtTime(.12, ctx.currentTime, .6);
    A = { ctx, master, hg, drone };
    window.USIntro.sound = true;
  }
  function thump() {
    if (!A) return;
    const { ctx, master } = A, t = ctx.currentTime;
    [0, .22].forEach((dt, k) => {
      const o = ctx.createOscillator(); o.frequency.setValueAtTime(70, t + dt); o.frequency.exponentialRampToValueAtTime(32, t + dt + .25);
      const g = ctx.createGain(); g.gain.setValueAtTime(k ? .45 : .7, t + dt); g.gain.exponentialRampToValueAtTime(.001, t + dt + .3);
      o.connect(g).connect(master); o.start(t + dt); o.stop(t + dt + .32);
    });
  }
  function zap() {
    if (!A) return;
    const { ctx, master } = A, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(1400, t); o.frequency.exponentialRampToValueAtTime(40, t + .35);
    const g = ctx.createGain(); g.gain.setValueAtTime(.25, t); g.gain.exponentialRampToValueAtTime(.001, t + .4);
    o.connect(g).connect(master); o.start(t); o.stop(t + .42);
    A.hg.gain.setTargetAtTime(0, t, .05);
    A.drone.gain.setTargetAtTime(0, t + .2, .4);
    setTimeout(() => { try { A.ctx.close(); } catch (e) {} }, 1600);
  }
  sndBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (A) return;
    audioOn();
    sndBtn.textContent = 'DŹWIĘK: ON';
    sndBtn.classList.add('on');
  });

  /* ---------------- timeline ---------------- */
  // tracks: [time ms, value]; linear between keys
  const T = {
    open:   [[0, 0], [380, 0], [820, 1]],
    stat:   [[0, .5], [820, 1], [1500, .5], [2900, .45], [3500, .06], [4600, .04]],
    bright: [[0, 0], [900, 0], [1500, .7], [2900, .75], [3400, 1], [4600, 1]],
    tear:   [[0, 0], [900, .5], [1600, .9], [2900, 1], [3300, 0]],
    block:  [[0, 0], [1500, .3], [1800, 1], [2900, 1], [3200, 0]],
    warp:   [[0, 0], [1100, .6], [2900, 1.2], [3400, .25], [4600, .2]],
    split:  [[0, .002], [1600, .012], [2900, .02], [3300, .003]],
    lens:   [[0, 0], [1200, .6], [3000, .8], [3400, 1]],
    warm:   [[0, 0], [3000, 0], [3600, .8]],
    zoom:   [[0, 1.12], [4600, 1]]
  };
  const at = (track, t) => {
    if (t <= track[0][0]) return track[0][1];
    for (let i = 1; i < track.length; i++) if (t <= track[i][0]) { const [t0, v0] = track[i - 1], [t1, v1] = track[i]; const k = (t - t0) / (t1 - t0); return v0 + (v1 - v0) * (k * k * (3 - 2 * k)); }
    return track[track.length - 1][1];
  };
  const subs = [[1950, 0], [2420, 1], [2880, 2]]; // dim subliminal frames, ≥400 ms apart
  const words = [[1800, 'NIE PATRZ.', 380], [2280, 'ONO CIĘ WIDZI.', 420], [2760, 'ZA PÓŹNO.', 300]];
  const OFF = 4650;

  const mouse = { x: .5, y: .45, tx: .5, ty: .45 };
  addEventListener('pointermove', e => { mouse.tx = e.clientX / innerWidth; mouse.ty = 1 - e.clientY / innerHeight; }, { passive: true });
  addEventListener('touchmove', e => { const t = e.touches[0]; mouse.tx = t.clientX / innerWidth; mouse.ty = 1 - t.clientY / innerHeight; }, { passive: true });

  let dpr = 1, W = 0, H = 0;
  function resize() { dpr = Math.min(devicePixelRatio || 1, 1); W = canvas.width = Math.floor(innerWidth * dpr * (mobile ? 1 : .85)); H = canvas.height = Math.floor(innerHeight * dpr * (mobile ? 1 : .85)); gl.viewport(0, 0, W, H); }
  resize(); addEventListener('resize', resize);

  let t0 = 0, raf = 0, off = false, firedW = 0, imgC = null, startedAt = performance.now();
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const t = window.__introT != null ? window.__introT : now - t0;   // __introT: test hook to freeze time
    if (t >= OFF && !off && window.__introT == null) return tvOff();
    // idle light drifts when no pointer
    if (performance.now() - lastMove > 1400) { mouse.tx = .5 + Math.sin(t / 700) * .18; mouse.ty = .5 + Math.cos(t / 900) * .12; }
    mouse.x += (mouse.tx - mouse.x) * .12; mouse.y += (mouse.ty - mouse.y) * .12;
    let sub = 0, subIdx = 0;
    for (const [s, i] of subs) if (t > s && t < s + 90) { sub = .5; subIdx = i; }
    while (firedW < words.length && t >= words[firedW][0]) { const [, w, d] = words[firedW++]; showWord(w, d); }
    // random tracking bursts during chaos
    const burst = t > 1500 && t < 2950 && Math.random() < .08 ? Math.random() * .6 : 0;
    if (A) A.hg.gain.setTargetAtTime(at(T.stat, t) * .09, A.ctx.currentTime, .05);
    if (tc) { const s = Math.floor(t / 1000), fr = Math.floor((t % 1000) / 40); tc.textContent = `00:03:1${s}:${String(fr).padStart(2, '0')}`; }
    if (t > 3150 && !calm.classList.contains('on')) calm.classList.add('on');
    gl.uniform2f(U.uRes, W, H); gl.uniform2f(U.uSizeC, imgC.naturalWidth, imgC.naturalHeight); gl.uniform2f(U.uMouse, mouse.x, mouse.y);
    gl.uniform1f(U.uT, t / 1000);
    gl.uniform1f(U.uOpen, at(T.open, t)); gl.uniform1f(U.uStatic, at(T.stat, t)); gl.uniform1f(U.uBright, at(T.bright, t));
    gl.uniform1f(U.uTear, at(T.tear, t) + burst); gl.uniform1f(U.uBlock, at(T.block, t)); gl.uniform1f(U.uWarp, at(T.warp, t));
    gl.uniform1f(U.uSplit, at(T.split, t) + burst * .03); gl.uniform1f(U.uLens, at(T.lens, t)); gl.uniform1f(U.uWarm, at(T.warm, t));
    gl.uniform1f(U.uZoom, at(T.zoom, t)); gl.uniform1f(U.uRoll, t > 950 && t < 3000 ? (t / 1000 * (.6 + burst)) % 1 : 0);
    gl.uniform1f(U.uSub, sub); gl.uniform1f(U.uSubIdx, subIdx);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  let lastMove = 0;
  addEventListener('pointermove', () => { lastMove = performance.now(); }, { passive: true });
  addEventListener('touchmove', () => { lastMove = performance.now(); }, { passive: true });

  function tvOff() {
    if (off) return; off = true;
    zap();
    // 1) the picture collapses into a line, then a dot — on black
    root.classList.add('tvoff');
    // 2) the black falls away while the room powers on underneath
    setTimeout(() => {
      cancelAnimationFrame(raf);
      try { gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch (e) {}
      html.classList.remove('intro-lock');
      root.classList.add('fade');
      resolveFinished();
    }, 560);
    setTimeout(() => {
      root.remove();
      if (window.USIntro.sound) document.querySelector('.task-sound:not(.on)')?.click();
    }, 1700);
  }
  const skip = e => { if (e && e.target.closest('.in-sound')) return; if (t0) tvOff(); else { off = true; bail(); } };
  root.querySelector('.in-skip').addEventListener('click', e => { e.stopPropagation(); skip(); });
  addEventListener('keydown', e => { if (!off && (e.key === 'Escape' || e.key === 'Enter')) skip(); });

  /* ---------------- go ---------------- */
  /* klatki podprogowe: maski z products.js (pole frame), zawsze trzy */
  const INTRO_FRAMES = (() => { const f = (window.PRODUCTS || []).map(p => p.frame).filter(Boolean); const d = ['assets/masks/m07-blk.webp', 'assets/masks/m01-blk.webp', 'assets/masks/m05-blk.webp']; return [0, 1, 2].map(i => f.length ? f[i % f.length] : d[i]); })();
  (async () => {
    const lines = ['▶ ODTWARZANIE: TAŚMA_07.VHS', 'CAM_01 · POKÓJ B · ARCHIWUM −2', 'SYGNAŁ: NIESTABILNY'];
    let li = 0;
    const logT = setInterval(() => { if (li < lines.length) log.textContent += (li ? '\n' : '') + lines[li++]; else clearInterval(logT); }, 420);
    await window.__usTex;
    try {
      const [c, m0, m1, m2] = await Promise.all(['assets/hero-preview-bw.webp', ...INTRO_FRAMES].map(load));
      imgC = c; texFrom(c, 0); texFrom(m0, 1); texFrom(m1, 2); texFrom(m2, 3);
    } catch (e) { console.warn('intro textures', e); return bail(); }
    if (off) return;
    gl.uniform1i(U.uC, 0); gl.uniform1i(U.uM0, 1); gl.uniform1i(U.uM1, 2); gl.uniform1i(U.uM2, 3);
    root.classList.add('live');
    t0 = performance.now();
    raf = requestAnimationFrame(frame);
  })();
  // safety: never hold the visitor longer than 9 s
  setTimeout(() => { if (!off && window.__introT == null) skip(); }, 9000);
})();
