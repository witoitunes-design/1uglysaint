/* 1uglysaint — LUSTRO: try the mask on your own face.
   Camera -> MediaPipe Face Mesh (runs locally, assets/vendor/facemesh) -> 468 live points.
   Each mask carries the same 468 points measured on its photo (assets/masks/geo.js), so the
   photo is stretched over your face triangle by triangle, plus two outer rings for crowns,
   hoods and hair. The mask takes the light of your room (blurred camera luminance) and,
   for masks with real eye openings, your own eyes show through. One tap = a 9:16 card. */
(() => {
  const DIR = 'assets/vendor/facemesh/';
  const isFile = location.protocol === 'file:';
  const OFF = () => window.__salaTex || {};
  const US = window.US || {};
  const fine = matchMedia('(pointer: fine)').matches;
  const mobile = innerWidth < 821 || !fine;
  const PLN = v => (US.formatPLN ? US.formatPLN(v) : `${v} zł`).replace(',00', '');
  const loadScript = s => new Promise((res, rej) => { const e = document.createElement('script'); e.src = s; e.onload = res; e.onerror = () => rej(new Error('script ' + s)); document.head.appendChild(e); });

  let dlg, els = {}, masks = [], cur = 0, opts = {};
  let fm = null, fmReady = null, stream = null, video = null, mode = 'idle', busy = false, raf = 0;
  let R = null;            // renderer
  let lastLm = null, lastFrame = null, lastSeen = 0, eyesOwn = true, wantShot = false;
  let frames = 0, fpsT = performance.now();

  /* ---------------- DOM ---------------- */
  function build() {
    dlg = document.createElement('dialog');
    dlg.className = 'lu'; dlg.setAttribute('aria-label', 'Lustro — przymierz maskę');
    dlg.innerHTML = `
      <div class="lu-stage">
        <canvas class="lu-gl"></canvas>
        <video class="lu-video" playsinline muted></video>
        <div class="lu-frame" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
        <p class="lu-name"><span></span><small></small></p>
        <p class="lu-hint" role="status">NIE WIDZĘ TWARZY.<br>STAŃ PRZODEM DO ŚWIATŁA.</p>
        <div class="lu-flash"></div>
      </div>
      <div class="lu-bar"><span class="live"><i class="rec"></i> LUSTRO · NA ŻYWO</span><span class="fps"></span><button type="button" class="lu-x" aria-label="Zamknij lustro">×</button></div>
      <div class="lu-dock">
        <div class="lu-picks" role="group" aria-label="Wybierz maskę"></div>
        <button type="button" class="lu-shot" aria-label="Zrób zdjęcie"></button>
        <div class="lu-side"><button type="button" data-eyes>OCZY: TWOJE</button><button type="button" data-add>DO KOSZYKA</button></div>
      </div>
      <div class="lu-gate">
        <div class="lg-box">
          <p class="lg-k"><i class="rec"></i> LUSTRO</p>
          <h2 class="lg-h">Załóż ją.</h2>
          <p class="lg-p"></p>
          <div class="lg-bar" hidden><i></i></div>
          <div class="lg-btns"></div>
          <p class="lg-small"></p>
        </div>
      </div>
      <div class="lu-card" hidden>
        <img alt="Twoje zdjęcie w masce">
        <div class="lc-side"><h3></h3><p>Gotowe pod relację. Oznacz nas — niech inni też się boją.</p>
          <div class="lc-btns">
            <button type="button" class="lu-btn solid" data-share>UDOSTĘPNIJ</button>
            <a class="lu-btn" data-dl download="1uglysaint.jpg" style="display:grid;place-items:center;text-decoration:none">POBIERZ ZDJĘCIE</a>
            <button type="button" class="lu-btn" data-cart>DO KOSZYKA</button>
            <button type="button" class="lu-btn" data-again>JESZCZE RAZ</button>
          </div>
        </div>
      </div>
      <input type="file" accept="image/*" hidden>`;
    document.body.appendChild(dlg);
    const q = s => dlg.querySelector(s);
    els = { gl: q('.lu-gl'), video: q('.lu-video'), name: q('.lu-name span'), sub: q('.lu-name small'), hint: q('.lu-hint'), flash: q('.lu-flash'),
      fps: q('.fps'), picks: q('.lu-picks'), shot: q('.lu-shot'), eyes: q('[data-eyes]'), add: q('[data-add]'), gate: q('.lu-gate'),
      gp: q('.lg-p'), gh: q('.lg-h'), gbar: q('.lg-bar'), gbtns: q('.lg-btns'), gsmall: q('.lg-small'), card: q('.lu-card'), cimg: q('.lu-card img'),
      ch: q('.lc-side h3'), share: q('[data-share]'), dl: q('[data-dl]'), again: q('[data-again]'), ccart: q('[data-cart]'), file: q('input[type=file]'), x: q('.lu-x') };
    video = els.video;
    els.picks.innerHTML = masks.map((m, i) => `<button type="button" data-i="${i}" aria-label="${m.p.name}" style="background-image:url('${m.thumb}')"></button>`).join('');
    els.picks.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) pick(+b.dataset.i); });
    els.x.addEventListener('click', close);
    dlg.addEventListener('close', stop);
    dlg.addEventListener('cancel', e => { if (!els.card.hidden) { e.preventDefault(); els.card.hidden = true; } });
    els.shot.addEventListener('click', () => { wantShot = true; if (mode === 'photo') render(); });
    els.eyes.addEventListener('click', () => { eyesOwn = !eyesOwn; syncEyes(); if (mode === 'photo') render(); });
    els.add.addEventListener('click', () => { opts.onAdd && opts.onAdd(masks[cur].id); syncAdd(); });
    els.ccart.addEventListener('click', () => { opts.onAdd && opts.onAdd(masks[cur].id); syncAdd(); close(); setTimeout(() => document.getElementById('cart-dialog')?.showModal(), 80); });
    els.again.addEventListener('click', () => { els.card.hidden = true; });
    els.file.addEventListener('change', () => { const f = els.file.files && els.file.files[0]; if (f) usePhoto(f); els.file.value = ''; });
    dlg.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') pick(cur + 1); else if (e.key === 'ArrowLeft') pick(cur - 1);
      else if (e.code === 'Space' && els.card.hidden && mode !== 'idle') { e.preventDefault(); els.shot.click(); }
    });
  }

  function gate(kind, extra = '') {
    const G = els;
    G.gate.hidden = kind === 'none';
    G.gbar.hidden = kind !== 'load';
    G.gbtns.innerHTML = '';
    const btn = (t, cls, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'lu-btn ' + (cls || ''); b.textContent = t; b.addEventListener('click', fn); G.gbtns.appendChild(b); return b; };
    if (kind === 'ask') {
      G.gh.textContent = 'Załóż ją.';
      G.gp.textContent = 'Potrzebuję kamery, żeby położyć maskę na twojej twarzy. Obraz zostaje u ciebie — nic nie jest wysyłane ani zapisywane.';
      btn('WŁĄCZ KAMERĘ', 'solid', startCam).focus();
      btn('WGRAJ ZDJĘCIE', '', () => els.file.click());
      G.gsmall.textContent = 'Najlepiej przodem do światła, cała twarz w kadrze.';
    } else if (kind === 'load') {
      G.gh.textContent = 'Budzę lustro…';
      G.gp.textContent = extra || 'Ładuję model twarzy. Pierwszy raz trwa chwilę, potem już od ręki.';
      G.gsmall.textContent = '468 punktów · liczone w twojej przeglądarce';
    } else if (kind === 'err') {
      G.gh.textContent = 'Lustro milczy.';
      G.gp.textContent = extra;
      btn('WGRAJ ZDJĘCIE', 'solid', () => els.file.click());
      btn('SPRÓBUJ JESZCZE RAZ', '', startCam);
      G.gsmall.textContent = '';
    }
  }
  let progT = 0;
  function progress(on) {
    clearInterval(progT);
    const bar = els.gbar.querySelector('i');
    if (!on) { bar.style.setProperty('--p', 1); return; }
    let p = 0; bar.style.setProperty('--p', 0);
    progT = setInterval(() => { p += (0.93 - p) * .06; bar.style.setProperty('--p', p.toFixed(3)); }, 120);
  }

  /* ---------------- face mesh ---------------- */
  function loadFM() {
    if (fmReady) return fmReady;
    fmReady = (async () => {
      let locate = f => DIR + f;
      if (isFile) {
        // opened from disk: the browser refuses to fetch local files, so the model ships as base64 too
        await loadScript(DIR + 'offline.js');
        const B = window.__fmB64 || {}, urls = {};
        for (const name of Object.keys(B)) {
          const bin = await (await fetch('data:application/octet-stream;base64,' + B[name])).arrayBuffer();
          urls[name] = URL.createObjectURL(new Blob([bin], { type: name.endsWith('.wasm') ? 'application/wasm' : name.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' }));
        }
        locate = f => urls[f] || DIR + f;
      }
      if (!window.FaceMesh) await loadScript(DIR + 'face_mesh.js');
      const f = new window.FaceMesh({ locateFile: locate });
      f.setOptions({ maxNumFaces: 1, refineLandmarks: !mobile, minDetectionConfidence: .5, minTrackingConfidence: .5 });
      f.onResults(onResults);
      await f.initialize();
      fm = f;
      return f;
    })();
    fmReady.catch(() => { fmReady = null; });
    return fmReady;
  }

  async function startCam() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return gate('err', 'Ta przeglądarka nie daje dostępu do kamery (albo strona nie jest na https). Możesz wgrać zdjęcie.');
    gate('load', 'Pytam o kamerę i ładuję model twarzy.'); progress(true);
    try {
      const [s] = await Promise.all([
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: mobile ? 720 : 1280 }, height: { ideal: mobile ? 960 : 720 } }, audio: false }),
        loadFM()
      ]);
      stream = s; video.srcObject = s; await video.play();
      mode = 'live'; lastSeen = performance.now();
      progress(false); gate('none');
      loop();
    } catch (e) {
      progress(false);
      const n = e && e.name;
      gate('err', n === 'NotAllowedError' ? 'Kamera zablokowana. Zezwól na nią w pasku adresu albo wgraj zdjęcie.' :
        n === 'NotFoundError' ? 'Nie widzę żadnej kamery. Wgraj zdjęcie — zadziała tak samo.' :
          'Coś poszło nie tak przy starcie lustra. Wgraj zdjęcie albo spróbuj w Chrome / Safari.');
    }
  }

  async function usePhoto(file) {
    stopCam();
    gate('load', 'Szukam twarzy na zdjęciu.'); progress(true);
    try {
      await loadFM();
      const img = new Image(); img.src = URL.createObjectURL(file); await img.decode();
      const c = document.createElement('canvas'); const s = Math.min(1, 1600 / Math.max(img.width, img.height));
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      mode = 'photo'; lastLm = null;
      fm.reset && fm.reset();
      await fm.send({ image: c }); await fm.send({ image: c });
      progress(false);
      if (!lastLm) { gate('err', 'Nie znalazłem twarzy na tym zdjęciu. Spróbuj takiego, gdzie patrzysz prosto w obiektyw.'); return; }
      gate('none');
    } catch (e) { progress(false); gate('err', 'Nie udało się otworzyć zdjęcia.'); }
  }

  function loop() {
    cancelAnimationFrame(raf);
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (mode !== 'live' || busy || !fm || video.readyState < 2 || document.hidden) return;
      busy = true;
      fm.send({ image: video }).then(() => { busy = false; }, () => { busy = false; });
    };
    raf = requestAnimationFrame(tick);
  }

  function onResults(r) {
    const lm = r.multiFaceLandmarks && r.multiFaceLandmarks[0];
    lastFrame = r.image;
    if (lm) { lastLm = lm; lastSeen = performance.now(); }
    else if (mode === 'live' && performance.now() - lastSeen > 400) lastLm = null;
    els.hint.classList.toggle('on', mode === 'live' && !lm && performance.now() - lastSeen > 900);
    render();
    frames++;
    const now = performance.now();
    if (now - fpsT > 1000) { els.fps.textContent = mode === 'live' ? `${Math.round(frames * 1000 / (now - fpsT))} KL/S · 468 PKT` : 'ZDJĘCIE · 468 PKT'; frames = 0; fpsT = now; }
  }

  /* ---------------- renderer ---------------- */
  function renderer(canvas) {
    const gl = canvas.getContext('webgl', { alpha: false, antialias: true, preserveDrawingBuffer: true });
    if (!gl) return null;
    const VQ = `attribute vec2 p;varying vec2 vN;void main(){vN=p;gl_Position=vec4(p,0.,1.);}`;
    const COMMON = `precision mediump float;
      uniform vec2 uK;uniform float uMir,uT;
      vec2 vid(vec2 n){vec2 X=vec2(n.x/uK.x,n.y/uK.y)*.5+.5;X.y=1.-X.y;if(uMir>.5)X.x=1.-X.x;return X;}
      float lu(vec3 c){return dot(c,vec3(.299,.587,.114));}
      float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      vec3 grade(vec3 c,vec2 n,float sat){float l=lu(c);c=mix(vec3(l),c,sat);c=(c-.5)*1.12+.47;c*=vec3(1.,.96,.93);
        float v=smoothstep(1.55,.35,length(n*vec2(.9,1.)));return c*(.45+.55*v);}`;
    const FQ = `${COMMON}varying vec2 vN;uniform sampler2D uV;
      void main(){vec3 c=texture2D(uV,vid(vN)).rgb;c=grade(c*.86,vN,.32);c+=(h(gl_FragCoord.xy+uT)-.5)*.05;gl_FragColor=vec4(c,1.);}`;
    const VM = `attribute vec3 p;attribute vec2 uv;attribute float f;varying vec2 vUV;varying float vF;
      void main(){vUV=uv;vF=f;gl_Position=vec4(p,1.);}`;
    const FM = `${COMMON}varying vec2 vUV;varying float vF;uniform sampler2D uM,uL;uniform vec2 uRes;uniform float uFL;
      void main(){vec4 m=texture2D(uM,vUV);float a=m.a*vF;if(a<.01)discard;
        vec2 n=gl_FragCoord.xy/uRes*2.-1.;
        float L=lu(texture2D(uL,vid(n)).rgb);
        float sh=clamp(pow(L/max(uFL,.04),.75),.3,1.55);
        vec3 c=m.rgb*mix(1.,sh,.9)*.97;
        c=grade(c,n,.85);c+=(h(gl_FragCoord.xy+uT)-.5)*.04;
        gl_FragColor=vec4(c*a,a);}`;
    const FE = `${COMMON}varying vec2 vUV;varying float vF;uniform sampler2D uV;uniform vec2 uRes;
      void main(){vec2 n=gl_FragCoord.xy/uRes*2.-1.;vec3 c=texture2D(uV,vid(n)).rgb;c=grade(c*.86,n,.32);float a=vF;gl_FragColor=vec4(c*a*.92,a);}`;
    const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) console.warn(gl.getShaderInfoLog(x)); return x; };
    const prog = (v, f) => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, v)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, f)); gl.linkProgram(p); return p; };
    const PQ = prog(VQ, FQ), PM = prog(VM, FM), PE = prog(VM, FE);
    const loc = (p, n) => gl.getUniformLocation(p, n);
    const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const mkTex = () => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; };
    const tV = mkTex(), tL = mkTex();
    const small = document.createElement('canvas'); small.width = 32; small.height = 24;
    const sx = small.getContext('2d', { willReadFrequently: true });
    const maskTex = new Map();

    // mesh topology: face triangles + 2 rings around the oval
    const G = window.MASK_GEO, TRI = G.tri, OV = G.oval, NO = OV.length;
    const NV = 468 + NO * 2;
    const ind = [...TRI];
    for (let k = 0; k < NO; k++) {
      const a = OV[k], b = OV[(k + 1) % NO], a1 = 468 + k, b1 = 468 + (k + 1) % NO, a2 = 468 + NO + k, b2 = 468 + NO + (k + 1) % NO;
      ind.push(a, b, a1, b, b1, a1, a1, b1, a2, b1, b2, a2);
    }
    const bI = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bI); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(ind), gl.STATIC_DRAW);
    const NI = ind.length;
    const bP = gl.createBuffer(), bU = gl.createBuffer(), bF = gl.createBuffer();
    const P = new Float32Array(NV * 3), UV = new Float32Array(NV * 2), FA = new Float32Array(NV).fill(1);
    for (let k = 0; k < NO; k++) FA[468 + NO + k] = .0;
    gl.bindBuffer(gl.ARRAY_BUFFER, bF); gl.bufferData(gl.ARRAY_BUFFER, FA, gl.STATIC_DRAW);
    // eyes: strip between an inner (opaque) and an outer (transparent) contour + a fan inside
    const eyeBuf = gl.createBuffer(), eyeF = gl.createBuffer(), eyeU = gl.createBuffer(), eyeI = gl.createBuffer();
    const EYEN = 16, EV = 1 + EYEN * 2;
    const eInd = [];
    for (let k = 0; k < EYEN; k++) { const a = 1 + k, b = 1 + (k + 1) % EYEN, a2 = 1 + EYEN + k, b2 = 1 + EYEN + (k + 1) % EYEN; eInd.push(0, a, b, a, a2, b, b, a2, b2); }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, eyeI); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(eInd), gl.STATIC_DRAW);
    const EF = new Float32Array(EV); EF[0] = 1; for (let k = 0; k < EYEN; k++) { EF[1 + k] = 1; EF[1 + EYEN + k] = 0; }
    gl.bindBuffer(gl.ARRAY_BUFFER, eyeF); gl.bufferData(gl.ARRAY_BUFFER, EF, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, eyeU); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(EV * 2), gl.STATIC_DRAW);
    const EP = new Float32Array(EV * 3);

    function loadMask(m) {
      if (maskTex.has(m.id)) return maskTex.get(m.id);
      const pr = new Promise((res, rej) => {
        const im = new Image(); im.onload = () => {
          const t = mkTex(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
          gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); res(t);
        }; im.onerror = rej; im.src = OFF()[m.texM] || m.texM;
      });
      maskTex.set(m.id, pr); return pr;
    }
    const texReady = {};
    function draw(frame, lm, m, eyes) {
      const W = canvas.width, H = canvas.height;
      const fw = frame.videoWidth || frame.width, fh = frame.videoHeight || frame.height;
      if (!fw || !fh) return;
      const va = fw / fh, ca = W / H;
      const kx = va > ca ? va / ca : 1, ky = va > ca ? 1 : ca / va;
      const mir = mode === 'live' ? 1 : 0;
      gl.viewport(0, 0, W, H);
      gl.bindTexture(gl.TEXTURE_2D, tV); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frame);
      // blurred light of the room
      sx.drawImage(frame, 0, 0, 32, 24);
      gl.bindTexture(gl.TEXTURE_2D, tL); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, small);
      const t = performance.now() / 1000;
      // background
      gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
      gl.useProgram(PQ);
      gl.bindBuffer(gl.ARRAY_BUFFER, quad); const ap = gl.getAttribLocation(PQ, 'p'); gl.enableVertexAttribArray(ap); gl.vertexAttribPointer(ap, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(loc(PQ, 'uK'), kx, ky); gl.uniform1f(loc(PQ, 'uMir'), mir); gl.uniform1f(loc(PQ, 'uT'), t);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tV); gl.uniform1i(loc(PQ, 'uV'), 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); gl.disableVertexAttribArray(ap);
      if (!lm || !m || !m.geo) return;
      const tex = texReady[m.id]; if (!tex) { loadMask(m).then(tt => { texReady[m.id] = tt; render(); }); return; }

      // landmarks -> NDC (mirrored for the live mirror), in an isotropic pixel space for the rings
      const toN = (x, y) => [((mir ? 1 - x : x) * 2 - 1) * kx, (1 - y * 2) * ky];
      const ML = m.geo.lm, ring = m.geo.ring;
      let cxp = 0, cyp = 0, cu = 0, cv = 0;
      for (let k = 0; k < NO; k++) { const i = OV[k]; cxp += lm[i].x * fw; cyp += lm[i].y * fh; cu += ML[i * 3]; cv += ML[i * 3 + 1]; }
      cxp /= NO; cyp /= NO; cu /= NO; cv /= NO;
      let fsum = 0, fn = 0;
      for (let i = 0; i < 468; i++) {
        const L = lm[i], n = toN(L.x, L.y);
        P[i * 3] = n[0]; P[i * 3 + 1] = n[1]; P[i * 3 + 2] = Math.max(-.9, Math.min(.9, L.z * 2));
        UV[i * 2] = ML[i * 3]; UV[i * 2 + 1] = ML[i * 3 + 1];
      }
      for (let k = 0; k < NO; k++) {
        const i = OV[k], L = lm[i], r = ring[k];
        const px = L.x * fw - cxp, py = L.y * fh - cyp, du = ML[i * 3] - cu, dv = ML[i * 3 + 1] - cv;
        [[1 + (r - 1) * .55, 468 + k], [r, 468 + NO + k]].forEach(([s, vi]) => {
          const n = toN((cxp + px * s) / fw, (cyp + py * s) / fh);
          P[vi * 3] = n[0]; P[vi * 3 + 1] = n[1]; P[vi * 3 + 2] = Math.max(-.9, Math.min(.9, L.z * 2 + .02 * s));
          UV[vi * 2] = cu + du * s; UV[vi * 2 + 1] = cv + dv * s;
        });
      }
      // face brightness for the relighting (from the small frame, inside the face box)
      const d = sx.getImageData(0, 0, 32, 24).data;
      let x0 = 1, x1 = 0, y0 = 1, y1 = 0;
      for (let k = 0; k < NO; k++) { const L = lm[OV[k]]; x0 = Math.min(x0, L.x); x1 = Math.max(x1, L.x); y0 = Math.min(y0, L.y); y1 = Math.max(y1, L.y); }
      for (let y = Math.floor(y0 * 24); y <= Math.min(23, Math.floor(y1 * 24)); y++) for (let x = Math.floor(x0 * 32); x <= Math.min(31, Math.floor(x1 * 32)); x++) {
        const o = (y * 32 + x) * 4; fsum += (d[o] * .299 + d[o + 1] * .587 + d[o + 2] * .114) / 255; fn++;
      }
      const FL = fn ? fsum / fn : .5;

      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(PM);
      const aP = gl.getAttribLocation(PM, 'p'), aU = gl.getAttribLocation(PM, 'uv'), aF = gl.getAttribLocation(PM, 'f');
      gl.bindBuffer(gl.ARRAY_BUFFER, bP); gl.bufferData(gl.ARRAY_BUFFER, P, gl.DYNAMIC_DRAW); gl.enableVertexAttribArray(aP); gl.vertexAttribPointer(aP, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, bU); gl.bufferData(gl.ARRAY_BUFFER, UV, gl.DYNAMIC_DRAW); gl.enableVertexAttribArray(aU); gl.vertexAttribPointer(aU, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, bF); gl.enableVertexAttribArray(aF); gl.vertexAttribPointer(aF, 1, gl.FLOAT, false, 0, 0);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(loc(PM, 'uM'), 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tL); gl.uniform1i(loc(PM, 'uL'), 1);
      gl.uniform2f(loc(PM, 'uK'), kx, ky); gl.uniform1f(loc(PM, 'uMir'), mir); gl.uniform1f(loc(PM, 'uT'), t);
      gl.uniform2f(loc(PM, 'uRes'), W, H); gl.uniform1f(loc(PM, 'uFL'), FL);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bI); gl.drawElements(gl.TRIANGLES, NI, gl.UNSIGNED_SHORT, 0);
      [aP, aU, aF].forEach(a => gl.disableVertexAttribArray(a));

      // your own eyes through the openings
      if (eyes && eyes !== 'mask') {
        gl.disable(gl.DEPTH_TEST);
        gl.useProgram(PE);
        const bP2 = gl.getAttribLocation(PE, 'p'), bF2 = gl.getAttribLocation(PE, 'f'), bU2 = gl.getAttribLocation(PE, 'uv');
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tV); gl.uniform1i(loc(PE, 'uV'), 0);
        gl.uniform2f(loc(PE, 'uK'), kx, ky); gl.uniform1f(loc(PE, 'uMir'), mir); gl.uniform1f(loc(PE, 'uT'), t); gl.uniform2f(loc(PE, 'uRes'), W, H);
        const lists = eyes === 'left' ? [G.leye] : [G.leye, G.reye];
        lists.forEach(list => {
          let ex = 0, ey = 0; list.forEach(i => { ex += lm[i].x * fw; ey += lm[i].y * fh; }); ex /= list.length; ey /= list.length;
          const put = (vi, x, y) => { const n = toN(x / fw, y / fh); EP[vi * 3] = n[0]; EP[vi * 3 + 1] = n[1]; EP[vi * 3 + 2] = 0; };
          put(0, ex, ey);
          list.forEach((i, k) => {
            const px = lm[i].x * fw - ex, py = lm[i].y * fh - ey;
            put(1 + k, ex + px * .9, ey + py * .78);
            put(1 + EYEN + k, ex + px * 1.18, ey + py * 1.45);
          });
          gl.bindBuffer(gl.ARRAY_BUFFER, eyeBuf); gl.bufferData(gl.ARRAY_BUFFER, EP, gl.DYNAMIC_DRAW); gl.enableVertexAttribArray(bP2); gl.vertexAttribPointer(bP2, 3, gl.FLOAT, false, 0, 0);
          gl.bindBuffer(gl.ARRAY_BUFFER, eyeF); gl.enableVertexAttribArray(bF2); gl.vertexAttribPointer(bF2, 1, gl.FLOAT, false, 0, 0);
          if (bU2 >= 0) { gl.bindBuffer(gl.ARRAY_BUFFER, eyeU); gl.enableVertexAttribArray(bU2); gl.vertexAttribPointer(bU2, 2, gl.FLOAT, false, 0, 0); }
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, eyeI); gl.drawElements(gl.TRIANGLES, eInd.length, gl.UNSIGNED_SHORT, 0);
          gl.disableVertexAttribArray(bP2); gl.disableVertexAttribArray(bF2); if (bU2 >= 0) gl.disableVertexAttribArray(bU2);
        });
      }
    }
    function resize() {
      const d = Math.min(devicePixelRatio || 1, mobile ? 1.5 : 2), r = canvas.getBoundingClientRect();
      canvas.width = Math.max(2, Math.round(r.width * d)); canvas.height = Math.max(2, Math.round(r.height * d));
    }
    return { draw, resize, loadMask, canvas };
  }

  function render() {
    if (!R || !lastFrame) return;
    const m = masks[cur];
    R.draw(lastFrame, lastLm, m, eyesOwn ? m.eyes : 'mask');
    if (wantShot) { wantShot = false; if (lastLm) shot(); else US.notify?.('NAJPIERW POKAŻ TWARZ'); }
  }

  /* ---------------- picking ---------------- */
  function pick(i) {
    const n = masks.length; cur = ((i % n) + n) % n;
    const m = masks[cur];
    els.picks.querySelectorAll('button').forEach((b, k) => b.setAttribute('aria-current', k === cur));
    els.picks.children[cur]?.scrollIntoView({ block: 'nearest', inline: 'center' });
    els.name.textContent = m.p.name;
    els.sub.textContent = `№ ${m.p.id} · ${PLN(m.p.price)}`;
    syncEyes(); syncAdd();
    R && R.loadMask(m);
    if (mode === 'photo') render();
    try { window.USSound?.crackle?.(.8); } catch (e) {}
  }
  function syncEyes() {
    const m = masks[cur];
    const can = m.eyes !== 'mask';
    els.eyes.hidden = !can;
    els.eyes.textContent = eyesOwn ? 'OCZY: TWOJE' : 'OCZY: MASKI';
  }
  function syncAdd() {
    const m = masks[cur], inC = !!(US.cart || {})[m.id];
    els.add.textContent = inC ? 'W KOSZYKU ✓' : `DO KOSZYKA · ${PLN(m.p.price)}`;
    els.ccart.textContent = inC ? 'ZOBACZ KOSZYK' : `DO KOSZYKA · ${PLN(m.p.price)}`;
  }

  /* ---------------- the card ---------------- */
  async function shot() {
    els.flash.classList.remove('go'); void els.flash.offsetWidth; els.flash.classList.add('go');
    try { navigator.vibrate && !fine && navigator.vibrate(18); } catch (e) {}
    const m = masks[cur], src = R.canvas;
    const W = 1080, H = 1920, c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    try { await document.fonts.load('120px "SaintSpire"'); } catch (e) {}
    x.fillStyle = '#050404'; x.fillRect(0, 0, W, H);
    // photo 1080x1350, cover-cropped from the mirror
    const PH = 1350, sa = src.width / src.height, ta = W / PH;
    let sw = src.width, shh = src.height, sx0 = 0, sy0 = 0;
    if (sa > ta) { sw = src.height * ta; sx0 = (src.width - sw) / 2; } else { shh = src.width / ta; sy0 = (src.height - shh) / 2.4; }
    x.drawImage(src, sx0, sy0, sw, shh, 0, 0, W, PH);
    const g = x.createLinearGradient(0, PH - 380, 0, PH); g.addColorStop(0, 'rgba(5,4,4,0)'); g.addColorStop(1, 'rgba(5,4,4,1)');
    x.fillStyle = g; x.fillRect(0, PH - 380, W, 380);
    const tg = x.createLinearGradient(0, 0, 0, 220); tg.addColorStop(0, 'rgba(5,4,4,.85)'); tg.addColorStop(1, 'rgba(5,4,4,0)');
    x.fillStyle = tg; x.fillRect(0, 0, W, 220);
    // viewfinder corners
    x.strokeStyle = 'rgba(236,229,220,.55)'; x.lineWidth = 2;
    [[60, 150, 1, 1], [W - 60, 150, -1, 1], [60, PH - 120, 1, -1], [W - 60, PH - 120, -1, -1]].forEach(([a, b, dx, dy]) => { x.beginPath(); x.moveTo(a, b + 56 * dy); x.lineTo(a, b); x.lineTo(a + 56 * dx, b); x.stroke(); });
    const mono = '"Cascadia Mono","SF Mono",Consolas,"Liberation Mono",monospace';
    x.fillStyle = '#ece5dc'; x.textBaseline = 'alphabetic';
    x.font = `52px "SaintSpire", Georgia, serif`; x.fillText('1uglysaint', 60, 100);
    x.font = `22px ${mono}`; x.textAlign = 'right'; x.fillStyle = '#bdb3aa';
    spaced(x, 'LUSTRO · NA ŻYWO', W - 60, 92, 5, 'right');
    x.fillStyle = '#d12b35'; x.beginPath(); x.arc(W - 60 - measureSpaced(x, 'LUSTRO · NA ŻYWO', 5) - 26, 85, 8, 0, Math.PI * 2); x.fill();
    // text block
    x.textAlign = 'left';
    x.fillStyle = '#7d746d'; x.font = `22px ${mono}`;
    spaced(x, `№ ${m.p.id} / PRZYMIERZALNIA`, 60, 1440, 5);
    x.fillStyle = '#ece5dc';
    let fs = 132; x.font = `${fs}px "SaintSpire", Georgia, serif`;
    while (x.measureText(m.p.name).width > W - 120 && fs > 60) { fs -= 6; x.font = `${fs}px "SaintSpire", Georgia, serif`; }
    x.fillText(m.p.name, 56, 1440 + 24 + fs * .86);
    const yb = 1440 + 24 + fs * .86;
    x.fillStyle = '#7d746d'; x.font = `22px ${mono}`; spaced(x, m.p.latin || '', 60, yb + 56, 8);
    x.fillStyle = 'rgba(236,229,220,.24)'; x.fillRect(60, yb + 100, W - 120, 2);
    x.fillStyle = '#bdb3aa'; x.font = `italic 40px "SaintSpire", Georgia, serif`; x.fillText('Przymierzone na żywo.', 60, yb + 170);
    x.fillStyle = '#ece5dc'; x.font = `64px "SaintSpire", Georgia, serif`; x.textAlign = 'right'; x.fillText(PLN(m.p.price), W - 60, yb + 176);
    x.textAlign = 'left'; x.fillStyle = '#4a4441'; x.font = `20px ${mono}`;
    const d = new Date(), p2 = n => String(n).padStart(2, '0');
    spaced(x, `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()} · ${p2(d.getHours())}:${p2(d.getMinutes())}`, 60, H - 70, 5);
    x.textAlign = 'right'; spaced(x, '1UGLYSAINT.ONLINE', W - 60, H - 70, 5, 'right');
    let blob = null;
    try { blob = await new Promise(r => c.toBlob(r, 'image/jpeg', .92)); } catch (e) {}
    if (!blob) { US.notify?.('NIE UDAŁO SIĘ ZAPISAĆ ZDJĘCIA'); return; }
    const url = URL.createObjectURL(blob);
    els.cimg.src = url; els.dl.href = url; els.dl.download = `1uglysaint-${m.p.id}.jpg`;
    els.ch.textContent = m.p.name;
    const file = new File([blob], `1uglysaint-${m.p.id}.jpg`, { type: 'image/jpeg' });
    const canShare = navigator.canShare && navigator.canShare({ files: [file] });
    els.share.hidden = !canShare;
    els.share.onclick = () => navigator.share({ files: [file], title: '1uglysaint', text: `${m.p.name} — 1uglysaint` }).catch(() => {});
    syncAdd();
    els.card.hidden = false;
  }
  function measureSpaced(x, s, sp) { let w = 0; for (const ch of s) w += x.measureText(ch).width + sp; return w - sp; }
  function spaced(x, s, X, Y, sp, align) {
    const al = x.textAlign; x.textAlign = 'left';
    let cx = align === 'right' ? X - measureSpaced(x, s, sp) : X;
    for (const ch of s) { x.fillText(ch, cx, Y); cx += x.measureText(ch).width + sp; }
    x.textAlign = al;
  }

  /* ---------------- open / close ---------------- */
  function stopCam() { if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; } cancelAnimationFrame(raf); }
  function stop() { stopCam(); mode = 'idle'; lastLm = null; lastFrame = null; els.card.hidden = true; document.documentElement.classList.remove('lu-open'); }
  function close() { if (dlg.open) dlg.close(); }

  window.Lustro = {
    open(o) {
      opts = o; masks = o.masks;
      if (!dlg) build();
      if (!R) { R = renderer(els.gl); if (!R) { US.notify?.('TA PRZEGLĄDARKA NIE MA WEBGL'); return; } }
      const i = Math.max(0, masks.findIndex(m => m.id === o.id));
      eyesOwn = true;
      dlg.showModal(); document.documentElement.classList.add('lu-open');
      R.resize(); addEventListener('resize', R.resize);
      pick(i);
      // warm the model up while the visitor reads the permission text
      loadFM().catch(() => {});
      if (o.autostart) startCam(); else gate('ask');
    },
    _test: { onResults: r => onResults(r), get mode() { return mode; } }
  };
})();
