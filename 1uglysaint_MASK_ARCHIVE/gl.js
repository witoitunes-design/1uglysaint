/* 1uglysaint — RELIC ENGINE (raw WebGL, no libraries)
   - relief lighting: surface normals are derived from image luminance, a point light
     (your cursor / finger / an orbiting lamp) rakes across it, so a flat photo reads as carved stone
   - burn transition: noise-threshold dissolve with an ember edge between any two images
   - lens bulge + chromatic split driven by pointer velocity, grain, vignette, scanlines
   API: window.RelicGL = { ready, setScene(a, b, mix), setLight(x, y), progress }  */
(() => {
  const canvas = document.getElementById('gl');
  if (!canvas) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches;
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  const api = window.RelicGL = { ok: !!gl, ready: null, progress: 0 };
  if (!gl) { document.documentElement.classList.add('no-gl'); api.ready = Promise.resolve(); return; }

  const vs = `attribute vec2 p; varying vec2 vUv; void main(){ vUv = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;
  const fs = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uA, uB;
  uniform vec2 uRes, uSizeA, uSizeB;
  uniform float uFitA, uFitB;     // 0 = cover screen, 1 = relic plinth
  uniform vec3 uPlinth;           // center.xy (0..1), size (fraction of height)
  uniform float uMix, uTime, uLightI, uVel, uZoom;
  uniform vec2 uLight, uMouse;

  float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.-2.*f);
    return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y); }
  float fbm(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 4; i++){ v += a * noise(p); p *= 2.03; a *= .5; } return v; }

  // map screen uv -> image uv for a given fit; returns uv and a 0..1 visibility mask
  vec3 fitUV(vec2 uv, vec2 img, float fit){
    float aspect = uRes.x / uRes.y;
    if (fit < .5){
      float ri = img.x / img.y;
      vec2 s = aspect > ri ? vec2(1., ri / aspect) : vec2(aspect / ri, 1.);
      vec2 c = (uv - .5) / uZoom * s + .5;
      return vec3(c, 1.);
    }
    vec2 q = uv - uPlinth.xy; q.x *= aspect;
    vec2 c = q / uPlinth.z + .5;
    float r = length(q / uPlinth.z);
    float m = 1. - smoothstep(.36, .52, r);           // soft round fade, like a lit plinth
    return vec3(c, m);
  }
  float lum(vec3 c){ return dot(c, vec3(.299, .587, .114)); }

  // relief-lit sample of one image
  vec3 relic(sampler2D t, vec2 uv, vec2 img, float fit, vec2 suv, float split){
    vec3 f = fitUV(uv, img, fit);
    vec2 c = f.xy;
    vec2 px = 1.5 / img;
    vec3 base;
    base.r = texture2D(t, c + vec2(split, 0.)).r;
    base.g = texture2D(t, c).g;
    base.b = texture2D(t, c - vec2(split, 0.)).b;
    float l = lum(texture2D(t, c - vec2(px.x, 0.)).rgb), r = lum(texture2D(t, c + vec2(px.x, 0.)).rgb);
    float d = lum(texture2D(t, c - vec2(0., px.y)).rgb), u = lum(texture2D(t, c + vec2(0., px.y)).rgb);
    vec3 n = normalize(vec3((l - r) * 2.1, (d - u) * 2.1, 1.));
    float aspect = uRes.x / uRes.y;
    vec3 P = vec3((suv.x - .5) * aspect, suv.y - .5, 0.);
    vec3 Lp = vec3((uLight.x - .5) * aspect, uLight.y - .5, .32);
    vec3 L = normalize(Lp - P);
    float dist = length(Lp.xy - P.xy) * (1. + .9 * (1. - min(aspect, 1.)));
    float att = 1. / (1. + dist * dist * 9.);
    float diff = max(dot(n, L), 0.);
    float spec = pow(max(dot(reflect(-L, n), vec3(0., 0., 1.)), 0.), 28.);
    vec3 warm = vec3(1., .78, .58);
    vec3 col = base * (.1 + (.3 + diff * .85) * att * 1.6 * uLightI * warm) + spec * att * .35 * uLightI * warm;
    float inside = step(0., c.x) * step(c.x, 1.) * step(0., c.y) * step(c.y, 1.);
    return col * f.z * inside;
  }

  void main(){
    vec2 uv = vUv;
    // lens bulge around the pointer
    float aspect = uRes.x / uRes.y;
    vec2 dm = uv - uMouse; dm.x *= aspect;
    float md = length(dm);
    uv -= (uv - uMouse) * .06 * exp(-md * md * 18.) * (1. + uVel * 2.);
    float split = .0015 + uVel * .012;

    vec3 a = relic(uA, uv, uSizeA, uFitA, vUv, split);
    if (uMix < .001) {
      vec3 c0 = pow(a, vec3(1.08));
      vec2 v0 = vUv - .5; v0.x *= aspect * .8;
      c0 *= 1. - smoothstep(.35, 1.05, length(v0));
      c0 += (hash(vUv * uRes + fract(uTime) * 91.) - .5) * .06;
      gl_FragColor = vec4(c0, 1.); return;
    }
    vec3 b = relic(uB, uv, uSizeB, uFitB, vUv, split);

    // burn: B eats through A along a noise front, ember at the edge
    float n = fbm(vUv * vec2(aspect, 1.) * 3.2 + uTime * .03);
    float m = uMix * 1.2 - .1;
    float e = smoothstep(m - .05, m, n) - smoothstep(m, m + .02, n);
    float showB = 1. - smoothstep(m - .01, m + .01, n);
    vec3 col = mix(a, b, showB);
    vec3 ember = mix(vec3(.9, .18, .08), vec3(1., .75, .35), e);
    col += ember * e * 1.6 * step(.001, uMix) * step(uMix, .999);
    // ash just behind the front
    col *= 1. - .6 * (smoothstep(m - .12, m - .02, n) - smoothstep(m - .02, m, n)) * step(.001, uMix) * step(uMix, .999);

    // grade: crush, vignette, scanlines, grain
    col = pow(col, vec3(1.08));
    vec2 v = vUv - .5; v.x *= aspect * .8;
    col *= 1. - smoothstep(.35, 1.05, length(v));
    col *= .94 + .06 * sin(vUv.y * uRes.y * 1.6);
    col += (hash(vUv * uRes + fract(uTime) * 91.) - .5) * .06;
    gl_FragColor = vec4(col, 1.);
  }`;

  function sh(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
  let prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (e) { console.warn('RelicGL disabled:', e); document.documentElement.classList.add('no-gl'); api.ok = false; api.ready = Promise.resolve(); return; }
  gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = {}; ['uA', 'uB', 'uRes', 'uSizeA', 'uSizeB', 'uFitA', 'uFitB', 'uPlinth', 'uMix', 'uTime', 'uLightI', 'uVel', 'uZoom', 'uLight', 'uMouse'].forEach(k => U[k] = gl.getUniformLocation(prog, k));

  /* ---------- textures ---------- */
  // data-textures="auto": the wall of faces + the cover photo of every product in the current drop
  const auto = canvas.dataset.textures === 'auto';
  const P = window.PRODUCTS || [];
  const dropP = P.filter(p => p.latest).length ? P.filter(p => p.latest) : P.slice(0, 3);
  const srcs = auto ? ['assets/hero-preview-bw.webp', ...dropP.map(p => (p.images || [])[0]).filter(Boolean)]
                    : canvas.dataset.textures.split(',').map(s => s.trim()).filter(Boolean);
  api.textures = srcs;
  const tex = [];
  let loaded = 0;
  // opened from disk: browsers refuse local files as WebGL textures, so use embedded copies
  const offline = location.protocol === 'file:' ? (window.__usTex = window.__usTex || new Promise(res => {
    const s = document.createElement('script'); s.src = 'assets/textures-offline.js';
    s.onload = s.onerror = res; document.head.append(s);
  })) : Promise.resolve();
  const fail = () => { api.ok = false; document.documentElement.classList.add('no-gl'); canvas.style.display = 'none'; };
  api.ready = offline.then(() => Promise.all(srcs.map((src, i) => new Promise(res => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img); }
      catch (err) { console.warn('RelicGL texture blocked:', err.message); fail(); }
      tex[i] = { t, w: img.naturalWidth, h: img.naturalHeight };
      api.progress = ++loaded / srcs.length;
      res();
    };
    img.onerror = () => { tex[i] = null; api.progress = ++loaded / srcs.length; res(); };
    img.src = (window.US_TEX && window.US_TEX[src]) || src;
  }))));

  /* ---------- state ---------- */
  const st = { a: 0, b: 1, mix: 0, zoom: 1, lx: .5, ly: .62, tlx: .5, tly: .62, mx: .5, my: .5, tmx: .5, tmy: .5, vel: 0, light: 1, user: 0 };
  api.setScene = (a, b, mix, zoom = 1) => { st.a = a; st.b = b; st.mix = mix; st.zoom = zoom; };
  api.setLight = (x, y) => { st.tlx = x; st.tly = y; st.user = performance.now(); };

  let lastX = 0, lastY = 0, lastT = 0;
  addEventListener('pointermove', e => {
    const x = e.clientX / innerWidth, y = 1 - e.clientY / innerHeight;
    const now = performance.now(), dt = Math.max(16, now - lastT);
    st.vel = Math.min(1, st.vel + Math.hypot(e.clientX - lastX, e.clientY - lastY) / dt * .06);
    lastX = e.clientX; lastY = e.clientY; lastT = now;
    st.tmx = x; st.tmy = y; st.tlx = x; st.tly = y; st.user = now;
  }, { passive: true });
  addEventListener('pointerdown', e => { st.tlx = e.clientX / innerWidth; st.tly = 1 - e.clientY / innerHeight; st.user = performance.now(); }, { passive: true });

  /* ---------- resize ---------- */
  let W = 0, H = 0;
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 1) * (innerWidth * innerHeight > 2.2e6 ? .8 : 1);
    W = Math.floor(innerWidth * dpr); H = Math.floor(innerHeight * dpr);
    canvas.width = W; canvas.height = H; gl.viewport(0, 0, W, H);
  }
  addEventListener('resize', resize); resize();

  function plinth() {
    const mobile = innerWidth < 820;
    return mobile ? [.5, .6, Math.min(.62, .95 * innerWidth / innerHeight)] : [.34, .5, .92];
  }

  /* ---------- loop ---------- */
  let running = true, visible = true, t0 = performance.now();
  api.setVisible = v => { visible = v; };
  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    if (!visible) return;
    const t = (now - t0) / 1000;
    // idle: the light drifts like a lamp on a cable
    if (now - st.user > 2600 || reduce) {
      const lp = window.USLampPos;
      if (lp && lp.on && st.a === 0) { st.tlx = lp.x; st.tly = lp.y; }   // the hanging lamp is the light
      else {
        const pl = plinth();
        st.tlx = pl[0] + Math.sin(t * .55) * .16;
        st.tly = .58 + Math.cos(t * .37) * .14;
      }
    }
    const k = reduce ? 1 : .085;
    st.lx += (st.tlx - st.lx) * k; st.ly += (st.tly - st.ly) * k;
    st.mx += (st.tmx - st.mx) * .12; st.my += (st.tmy - st.my) * .12;
    st.vel *= .92;
    const lamp = parseFloat(document.documentElement.style.getPropertyValue('--lamp')) || 1;
    const A = tex[st.a], B = tex[st.b];
    if (!A || !B) return;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, A.t); gl.uniform1i(U.uA, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, B.t); gl.uniform1i(U.uB, 1);
    gl.uniform2f(U.uRes, W, H);
    gl.uniform2f(U.uSizeA, A.w, A.h); gl.uniform2f(U.uSizeB, B.w, B.h);
    gl.uniform1f(U.uFitA, st.a === 0 ? 0 : 1); gl.uniform1f(U.uFitB, st.b === 0 ? 0 : 1);
    gl.uniform3fv(U.uPlinth, plinth());
    gl.uniform1f(U.uMix, st.mix); gl.uniform1f(U.uTime, reduce ? 0 : t);
    gl.uniform1f(U.uLightI, .35 + .65 * lamp); gl.uniform1f(U.uVel, reduce ? 0 : st.vel);
    gl.uniform1f(U.uZoom, st.zoom);
    gl.uniform2f(U.uLight, st.lx, st.ly); gl.uniform2f(U.uMouse, fine ? st.mx : -9, fine ? st.my : -9);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) requestAnimationFrame(frame); });
  api.ready.then(() => requestAnimationFrame(frame));
})();
