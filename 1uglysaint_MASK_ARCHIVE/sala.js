/* 1uglysaint — SALA: every mask as a real 3D relief.
   Geometry: a dense grid displaced by a depth map that was built offline from the face mesh
   detected on each photo (assets/masks/mNN-depth.png, 16-bit packed in R/G).
   Light: your cursor is a torch in front of the mask; the head turns to look at it.
   Switching masks morphs one face into the next and burns the texture through.
   SKAN: topographic lines + the mesh grid + a scanning beam over the real surface. */
(() => {
  const OFF = window.__salaTex || {};           // data-URI textures when opened from disk (file://)
  const src = p => OFF[p] || p;
  const isFile = location.protocol === 'file:';

  function Sala(canvas, o = {}) {
    const api = { ok: false };
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: true });
    if (!gl) return api;
    const derivExt = gl.getExtension('OES_standard_derivatives');
    const mobile = o.mobile;
    const N = mobile ? 128 : 176;                 // grid resolution
    const RELIEF = 0.86;                          // depth map 1.0 = 1.2 world units; flattened a touch
    const ZMAX = 1.2 * RELIEF;
    let DPR = Math.min(devicePixelRatio || 1, mobile ? 1.6 : 1.75);
    let shadows = !mobile, reflect = true, ema = 1 / 60, nFr = 0, degraded = false;

    /* ---------------- shaders ---------------- */
    const VS_BG = `attribute vec2 p;varying vec2 vU;void main(){vU=p*.5+.5;gl_Position=vec4(p,0.,1.);}`;
    const FS_BG = `precision mediump float;varying vec2 vU;
      uniform vec2 uRes;uniform vec2 uL;uniform float uPow,uT,uScan,uAsp,uWM;uniform sampler2D uWA,uWB;uniform vec4 uWall;
      float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float n2(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),u.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),u.x),u.y);}
      void main(){
        vec2 q=vU;q.x*=uAsp;vec2 l=uL;l.x*=uAsp;
        float d=distance(q,l);
        float fog=n2(q*3.+vec2(uT*.03,uT*.017))*.6+n2(q*7.-uT*.04)*.4;
        float spot=exp(-d*d*5.5)*(.75+.5*fog);
        vec3 c=vec3(.010,.008,.009)+vec3(.105,.092,.085)*spot*uPow;
        // the number painted on the back wall: you only read it where the torch lands
        vec2 wu=(vU-uWall.xy)/uWall.zw+.5;
        if(wu.x>0.&&wu.x<1.&&wu.y>0.&&wu.y<1.){
          vec2 tu=vec2(wu.x,1.-wu.y);
          float wl=mix(texture2D(uWA,tu).r,texture2D(uWB,tu).r,uWM);
          float sw=exp(-d*d*16.);
          c+=vec3(.95,.88,.82)*wl*(.003+sw*.085*uPow);
        }
        // dust hanging in the beam
        float du=0.;
        for(int k=0;k<2;k++){
          float sc=k==0?30.:57.;
          vec2 gq=q*sc+vec2(uT*(.10+.08*float(k)),-uT*.06);
          vec2 id=floor(gq);vec2 f=fract(gq)-.5;vec2 o=vec2(h(id),h(id+7.1))-.5;
          float r=step(.84,h(id+3.3));
          du+=r*smoothstep(.1,0.,length(f-o*.7))*(.5+.5*sin(uT*1.6+h(id)*6.28));
        }
        c+=vec3(1.,.95,.9)*du*spot*spot*.6*uPow;
        float vig=smoothstep(1.25,.2,distance(vU,vec2(.5,.48))*1.25);
        c*=.35+.65*vig;
        // scan: faint lab grid on the wall
        vec2 g=abs(fract(gl_FragCoord.xy/42.)-.5);
        float gg=step(.485,max(g.x,g.y));
        c+=vec3(.55,.53,.5)*gg*.045*uScan;
        c+=(h(gl_FragCoord.xy+uT)-.5)*.018;
        gl_FragColor=vec4(c,1.);
      }`;
    const VS = `attribute vec2 aUV;attribute float aZA,aZB;attribute vec3 aNA,aNB;
      uniform mat4 uPV;uniform mat3 uR;uniform vec3 uPiv;uniform float uM,uRel,uFit,uT,uRefl,uFloor;uniform vec2 uSh;
      varying vec2 vUV;varying vec3 vN,vP,vLoc;varying float vZ;
      void main(){
        float m=smoothstep(0.,1.,clamp(uM*1.15-.05,0.,1.));
        float z=mix(aZA,aZB,m);
        // the surface "breathes" while one face turns into the next
        float wob=sin(uM*3.14159)*.06*sin(aUV.y*18.+uT*6.)*z;
        vec3 p=vec3(aUV.x*2.-1.,1.-aUV.y*2.,z*uRel+wob);
        vec3 n=normalize(mix(aNA,aNB,m));
        vec3 w=uR*(p-uPiv)+uPiv;
        if(uRefl>.5)w.y=2.*uFloor-w.y;
        vec4 c=uPV*vec4(w,1.);
        c.xy=c.xy*uFit+uSh*c.w;
        gl_Position=c;
        vUV=aUV;vN=uR*n;vP=w;vZ=z;vLoc=p;
      }`;
    const FS = `${derivExt ? '#extension GL_OES_standard_derivatives : enable\n' : ''}precision highp float;
      varying vec2 vUV;varying vec3 vN,vP,vLoc;varying float vZ;
      uniform sampler2D uA,uB,uDA,uDB;uniform vec3 uLl;uniform float uShad,uRel,uRefl,uFloor;uniform float uM,uPow,uScan,uBeam,uT,uSpA,uSpB,uBump,uTx;
      uniform vec3 uL,uEye;uniform mat3 uR;
      float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float n2(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),u.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),u.x),u.y);}
      float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n2(p);p*=2.03;a*=.5;}return v;}
      float lu(vec3 c){return dot(c,vec3(.299,.587,.114));}
      vec4 tx(vec2 uv,float w){return mix(texture2D(uA,uv),texture2D(uB,uv),w);}
      float aa(float x,float px){${derivExt ? 'float f=fwidth(x)*px;' : 'float f=.02*px;'}return 1.-smoothstep(0.,f,x);}
      void main(){
        // burn-through between the old and the new face
        float nz=fbm(vUV*4.2+vec2(0.,uT*.05));
        float t=uM*1.3-.15;
        float wB=smoothstep(nz-.025,nz+.025,t);
        float ember=(1.-smoothstep(0.,.06,abs(t-nz)))*step(.001,uM)*step(uM,.999);
        vec4 c=tx(vUV,wB);
        if(c.a<.03)discard;
        if(uRefl>.5&&vP.y>uFloor)discard;
        // fine detail: luminance of the photo as a bump map
        float l0=lu(c.rgb);
        float lx=lu(tx(vUV+vec2(uTx,0.),wB).rgb)-lu(tx(vUV-vec2(uTx,0.),wB).rgb);
        float ly=lu(tx(vUV+vec2(0.,uTx),wB).rgb)-lu(tx(vUV-vec2(0.,uTx),wB).rgb);
        vec3 N=normalize(vN+uR*vec3(-lx,ly,0.)*uBump);
        vec3 Lv=uL-vP;float d=length(Lv);vec3 L=Lv/d;
        float att=1./(1.+.16*d*d);
        // cast shadows: march from the surface toward the torch over the depth map
        float sh=1.;
        if(uShad>.5){
          float mm=smoothstep(0.,1.,clamp(uM*1.15-.05,0.,1.));
          vec3 dir=normalize(uLl-vLoc);
          float occ=0.;
          for(int i=1;i<=14;i++){
            float tt=float(i)*.034;
            vec3 q=vLoc+dir*tt;
            vec2 qu=vec2(q.x*.5+.5,.5-q.y*.5);
            float hq=mix(texture2D(uDA,qu).r,texture2D(uDB,qu).r,mm)*1.2*uRel;
            occ=max(occ,clamp((hq-q.z-.012)*9.,0.,1.)*(1.-tt*.9));
          }
          sh=1.-occ*.88;
        }
        float dif=max(dot(N,L),0.);
        float wrap=max((dot(N,L)+.3)/1.3,0.);
        vec3 V=normalize(uEye-vP);vec3 H=normalize(L+V);
        float gloss=mix(uSpA,uSpB,wB);
        float sp=pow(max(dot(N,H),0.),mix(18.,70.,gloss))*gloss*(.35+.9*l0);
        float rim=pow(1.-max(dot(N,V),0.),3.);
        vec3 alb=c.rgb;
        vec3 col=alb*(.035+ (dif*.75+wrap*.25)*sh*att*uPow*vec3(1.,.95,.88)*2.6);
        col+=sp*sh*att*uPow*vec3(1.,.97,.92)*1.8;
        col+=alb*rim*vec3(.7,.1,.12)*.55;          // a red rim from somewhere behind
        col=col/(1.+col*.35);
        col+=ember*vec3(1.,.34,.12)*1.6;
        // SKAN
        if(uScan>.001){
          float iso=abs(fract(vZ*26.)-.5)*2.;
          float isoL=aa(iso,1.4);
          vec2 g=abs(fract(vUV*58.)-.5)*2.;
          float gr=max(aa(g.x,1.),aa(g.y,1.));
          float beam=exp(-pow((vP.y-uBeam)*14.,2.));
          float above=step(uBeam,vP.y);
          vec3 sc=alb*.07+vec3(.86,.84,.8)*(isoL*.75+gr*.22)*(.45+.55*above);
          sc+=vec3(.9,.16,.18)*beam*1.4+vec3(1.)*beam*beam*.6;
          col=mix(col,sc,uScan);
        }
        if(uRefl>.5){float dd=uFloor-vP.y;float fa=.34*exp(-dd*3.2);gl_FragColor=vec4(col*.75*c.a*fa,c.a*fa);return;}
        gl_FragColor=vec4(col*c.a,c.a);
      }`;

    function sh(type, s) { const x = gl.createShader(type); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(x)); return null; } return x; }
    function prog(v, f) { const p = gl.createProgram(); const a = sh(gl.VERTEX_SHADER, v), b = sh(gl.FRAGMENT_SHADER, f); if (!a || !b) return null; gl.attachShader(p, a); gl.attachShader(p, b); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.warn(gl.getProgramInfoLog(p)); return null; } return p; }
    const PB = prog(VS_BG, FS_BG), PM = prog(VS, FS);
    if (!PB || !PM) return api;
    const U = (p, names) => Object.fromEntries(names.map(n => [n, gl.getUniformLocation(p, n)]));
    const ub = U(PB, ['uRes', 'uL', 'uPow', 'uT', 'uScan', 'uAsp', 'uWA', 'uWB', 'uWM', 'uWall']);
    const um = U(PM, ['uPV', 'uR', 'uPiv', 'uM', 'uRel', 'uFit', 'uT', 'uSh', 'uA', 'uB', 'uPow', 'uScan', 'uBeam', 'uSpA', 'uSpB', 'uBump', 'uTx', 'uL', 'uEye', 'uDA', 'uDB', 'uLl', 'uShad', 'uRefl', 'uFloor']);
    const am = { uv: gl.getAttribLocation(PM, 'aUV'), za: gl.getAttribLocation(PM, 'aZA'), zb: gl.getAttribLocation(PM, 'aZB'), na: gl.getAttribLocation(PM, 'aNA'), nb: gl.getAttribLocation(PM, 'aNB') };
    const abg = gl.getAttribLocation(PB, 'p');

    /* ---------------- buffers ---------------- */
    const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const uv = new Float32Array(N * N * 2);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const k = (j * N + i) * 2; uv[k] = i / (N - 1); uv[k + 1] = j / (N - 1); }
    const idx = new Uint16Array((N - 1) * (N - 1) * 6); let q = 0;
    for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) { const a = j * N + i, b = a + 1, c = a + N, d = c + 1; idx.set([a, c, b, b, c, d], q); q += 6; }
    const bUV = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bUV); gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW);
    const bIdx = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bIdx); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    const bZ = [gl.createBuffer(), gl.createBuffer()], bN = [gl.createBuffer(), gl.createBuffer()];
    const zero = new Float32Array(N * N), up = new Float32Array(N * N * 3); for (let k = 0; k < N * N; k++) up[k * 3 + 2] = 1;
    [0, 1].forEach(s => { gl.bindBuffer(gl.ARRAY_BUFFER, bZ[s]); gl.bufferData(gl.ARRAY_BUFFER, zero, gl.DYNAMIC_DRAW); gl.bindBuffer(gl.ARRAY_BUFFER, bN[s]); gl.bufferData(gl.ARRAY_BUFFER, up, gl.DYNAMIC_DRAW); });
    const blank = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, blank); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    let slot = 0;                                 // which buffer set is "A"
    const WC = document.createElement('canvas'); WC.width = 2048; WC.height = 1024;
    const wTex = [0, 1].map(() => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; });
    let wA = 0, wMix = 1, wT0 = 0;
    function paintWall(big, small) {
      const x = WC.getContext('2d');
      x.fillStyle = '#000'; x.fillRect(0, 0, WC.width, WC.height);
      x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.font = '400 980px "SaintSpire", Georgia, serif';
      x.fillText(big, WC.width / 2, WC.height * .52);
      if (small) {
        x.font = '34px ui-monospace, Consolas, monospace';
        const t = small.split('').join(String.fromCharCode(8202, 8202));
        x.fillText(t, WC.width / 2, WC.height * .955);
      }
      const b = 1 - wA;
      gl.bindTexture(gl.TEXTURE_2D, wTex[b]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, WC);
      gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      wMix = 0; wT0 = performance.now();
    }
    api.wall = (big, small) => {
      if (wMix < 1) { wA = 1 - wA; wMix = 1; }
      const go = () => paintWall(big, small);
      (document.fonts && document.fonts.load ? document.fonts.load('400 120px "SaintSpire"').catch(() => {}) : Promise.resolve()).then(go);
    };
    const texOf = [blank, blank], dOf = [blank, blank];

    /* ---------------- mask loading ---------------- */
    const cache = new Map();
    const loadImg = s => new Promise((res, rej) => { const im = new Image(); im.decoding = 'async'; im.onload = () => res(im); im.onerror = rej; im.src = src(s); });
    function makeTex(im) {
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
      const pot = (im.width & (im.width - 1)) === 0;
      if (pot) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); }
      else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    }
    function geometry(dim) {
      const W = dim.width, H = dim.height;
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(dim, 0, 0);
      const px = cx.getImageData(0, 0, W, H).data;
      const D = new Float32Array(W * H);
      for (let k = 0; k < W * H; k++) D[k] = (px[k * 4] * 256 + px[k * 4 + 1]) / 65535;
      const sample = (u, v) => {
        const x = Math.min(W - 1.001, Math.max(0, u * (W - 1))), y = Math.min(H - 1.001, Math.max(0, v * (H - 1)));
        const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, i = y0 * W + x0;
        return (D[i] * (1 - fx) + D[i + 1] * fx) * (1 - fy) + (D[i + W] * (1 - fx) + D[i + W + 1] * fx) * fy;
      };
      const z = new Float32Array(N * N);
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) z[j * N + i] = sample(i / (N - 1), j / (N - 1)) * 1.2;
      const n = new Float32Array(N * N * 3), st = 2 / (N - 1);
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const k = j * N + i;
        const zl = z[j * N + Math.max(i - 1, 0)], zr = z[j * N + Math.min(i + 1, N - 1)];
        const zu = z[Math.max(j - 1, 0) * N + i], zd = z[Math.min(j + 1, N - 1) * N + i];
        const dzdu = (zr - zl) * RELIEF / (2 * st), dzdv = (zd - zu) * RELIEF / (2 * st);
        let nx = -dzdu, ny = dzdv, nz = 1; const l = Math.hypot(nx, ny, nz); n[k * 3] = nx / l; n[k * 3 + 1] = ny / l; n[k * 3 + 2] = nz / l;
      }
      let jmax = 0;
      for (let j = N - 1; j >= 0 && !jmax; j--) for (let i = 0; i < N; i++) if (z[j * N + i] > .03) { jmax = j; break; }
      return { z, n, sample, chin: jmax / (N - 1) };
    }
    function load(m) {
      if (cache.has(m.id)) return cache.get(m.id);
      const p = Promise.all([loadImg(mobile || isFile ? m.texM : m.tex), loadImg(m.depth)]).then(([ti, di]) => {
        const g = geometry(di);
        return { id: m.id, tex: makeTex(ti), dtex: makeTex(di), z: g.z, n: g.n, sample: g.sample, chin: g.chin, spec: m.spec || .3, bump: m.bump ?? 1.6, texel: 1 / ti.width };
      });
      cache.set(m.id, p);
      p.catch(() => cache.delete(m.id));
      return p;
    }

    /* ---------------- state ---------------- */
    const S = {
      cur: null, next: null, mix: 0, mixing: false, mixT0: 0,
      yaw: 0, pitch: 0, vy: 0, vp: 0, ty: 0, tp: 0,
      lx: .1, ly: .15, tlx: .1, tly: .15, pow: 0, tpow: 1,
      scan: 0, tscan: 0, beam: 1, t0: performance.now(), last: performance.now(),
      pointerAt: 0, lightLock: false, lz: 2.3, talk: 0, ttalk: 0, w: 1, h: 1, fit: { cx: 0, cy: 0, h: 1 }, visible: true
    };
    let spA = .3, spB = .3, bump = 1.6, texel = 1 / 1024;

    function upload(slotI, M) {
      gl.bindBuffer(gl.ARRAY_BUFFER, bZ[slotI]); gl.bufferSubData(gl.ARRAY_BUFFER, 0, M.z);
      gl.bindBuffer(gl.ARRAY_BUFFER, bN[slotI]); gl.bufferSubData(gl.ARRAY_BUFFER, 0, M.n);
      texOf[slotI] = M.tex; dOf[slotI] = M.dtex;
    }
    let pending = null;
    api.set = async (m, onShown) => {
      const token = (pending = {});
      const M = await load(m);
      if (pending !== token) return;
      if (S.mixing) finishMix();
      if (!S.cur) { upload(slot, M); S.cur = M; spA = M.spec; bump = M.bump; texel = M.texel; S.tpow = 1; onShown && onShown(); return; }
      if (S.cur.id === M.id) return;
      upload(1 - slot, M); S.next = M; spB = M.spec; S.mix = 0; S.mixing = true; S.mixT0 = performance.now();
      onShown && onShown();
    };
    function finishMix() {
      slot = 1 - slot; S.cur = S.next; S.next = null; S.mix = 0; S.mixing = false; spA = spB; bump = S.cur.bump; texel = S.cur.texel;
    }
    api.preload = m => load(m).catch(() => {});

    /* pointer in "mask space": (0,0) mask centre, ±1 = mask half-height */
    api.pointer = (x, y) => { S.pointerAt = performance.now(); S.ty = Math.max(-1, Math.min(1, x)) * .42; S.tp = -Math.max(-1, Math.min(1, y)) * .24; S.tlx = x; S.tly = y; };
    api.release = () => { S.pointerAt = 0; };
    // separate controls (used by the interrogation room): head only, light only, talking
    api.look = (x, y) => { S.pointerAt = performance.now(); S.ty = Math.max(-1, Math.min(1, x)) * .42; S.tp = -Math.max(-1, Math.min(1, y)) * .24; };
    api.light = (x, y, z) => { S.lightLock = true; S.tlx = x; S.tly = y; if (z != null) S.lz = z; };
    api.talk = v => { S.ttalk = v; };
    api.scan = on => { S.tscan = on ? 1 : 0; if (on) S.beam = 1.25; };
    api.power = v => { S.tpow = v; };
    api.layout = (fit) => { S.fit = fit; resize(); };
    api.state = S;
    api.visible = v => { S.visible = v; if (v) loop(); };

    function resize() {
      const r = canvas.getBoundingClientRect();
      S.w = Math.max(1, r.width); S.h = Math.max(1, r.height);
      canvas.width = Math.round(S.w * DPR); canvas.height = Math.round(S.h * DPR);
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    addEventListener('resize', resize); resize();

    /* ---------------- maths ---------------- */
    const FOV = 30 * Math.PI / 180, DIST = 4.4, F = 1 / Math.tan(FOV / 2), PIV = [0, 0, -.55];
    function matPV(asp) {
      const n = .1, f = 20, nf = 1 / (n - f);
      // perspective * translate(0,0,-DIST)
      return new Float32Array([F / asp, 0, 0, 0, 0, F, 0, 0, 0, 0, (f + n) * nf, -1, 0, 0, (f + n) * nf * -DIST + 2 * f * n * nf, DIST]);
    }
    function rot(yaw, pitch, roll) {
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
      // R = Ry * Rx * Rz  (column-major for GLSL)
      const Ry = [cy, 0, -sy, 0, 1, 0, sy, 0, cy], Rx = [1, 0, 0, 0, cp, sp, 0, -sp, cp], Rz = [cr, sr, 0, -sr, cr, 0, 0, 0, 1];
      const mul = (A, B) => { const C = new Array(9); for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) C[c * 3 + r] = A[r] * B[c * 3] + A[3 + r] * B[c * 3 + 1] + A[6 + r] * B[c * 3 + 2]; return C; };
      return new Float32Array(mul(mul(Ry, Rx), Rz));
    }
    const apply3 = (R, v) => [R[0] * v[0] + R[3] * v[1] + R[6] * v[2], R[1] * v[0] + R[4] * v[1] + R[7] * v[2], R[2] * v[0] + R[5] * v[1] + R[8] * v[2]];
    let R = rot(0, 0, 0), PV = matPV(1), fitScale = 1, shift = [0, 0];

    /* project a point on the current mask (uv) to CSS pixels in the canvas */
    api.project = (u, v) => {
      const M = S.cur; if (!M) return null;
      const z = M.sample(u, v) * 1.2 * RELIEF;
      const p = [u * 2 - 1, 1 - v * 2, z];
      const w = apply3(R, [p[0] - PIV[0], p[1] - PIV[1], p[2] - PIV[2]]); w[0] += PIV[0]; w[1] += PIV[1]; w[2] += PIV[2];
      const c = [0, 0, 0, 0];
      for (let r = 0; r < 4; r++) c[r] = PV[r] * w[0] + PV[4 + r] * w[1] + PV[8 + r] * w[2] + PV[12 + r];
      const x = (c[0] * fitScale + shift[0] * c[3]) / c[3], y = (c[1] * fitScale + shift[1] * c[3]) / c[3];
      return { x: (x * .5 + .5) * S.w, y: (1 - (y * .5 + .5)) * S.h, z, front: w[2] };
    };

    /* ---------------- loop ---------------- */
    let raf = 0;
    const lampVar = () => { const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--lamp')); return isNaN(v) ? 1 : v; };
    let lampV = 1, frame = 0;
    function loop() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(draw);
    }
    function draw(now) {
      if (!S.visible || document.hidden) return;
      raf = requestAnimationFrame(draw);
      const dt = Math.min(.05, (now - S.last) / 1000); S.last = now;
      // adaptive quality: a slow GPU gets fewer pixels and no cast shadows, once
      if (!degraded && ++nFr > 30) { ema += (dt - ema) * .05; if (nFr > 120 && ema > .026) { degraded = true; shadows = false; DPR = 1; resize(); } }
      const t = (now - S.t0) / 1000;
      if (++frame % 3 === 0) lampV = lampVar();

      // idle drift when nobody is holding the torch
      if (now - S.pointerAt > 2600) {
        S.ty = Math.sin(t * .23) * .2 + Math.sin(t * .61) * .05;
        S.tp = Math.sin(t * .17 + 1) * .08 - .02;
        if (!S.lightLock) { S.tlx = Math.sin(t * .31) * .55; S.tly = .28 + Math.sin(t * .21) * .2; }
      }
      // spring for the head, lerp for the light
      const k = 26, d = 9;
      S.vy += ((S.ty - S.yaw) * k - S.vy * d) * dt; S.yaw += S.vy * dt;
      S.vp += ((S.tp - S.pitch) * k - S.vp * d) * dt; S.pitch += S.vp * dt;
      const ll = 1 - Math.exp(-dt * 7); S.lx += (S.tlx - S.lx) * ll; S.ly += (S.tly - S.ly) * ll;
      S.pow += (S.tpow - S.pow) * (1 - Math.exp(-dt * 3));
      S.scan += (S.tscan - S.scan) * (1 - Math.exp(-dt * 6));
      if (S.tscan) { S.beam -= dt * .7; if (S.beam < -1.25) S.beam = 1.25; }
      if (S.mixing) { S.mix = Math.min(1, (now - S.mixT0) / 1250); if (S.mix >= 1) finishMix(); }
      // light dips a little while faces swap
      const dip = S.mixing ? 1 - Math.sin(S.mix * Math.PI) * .45 : 1;
      const pow = S.pow * lampV * dip;

      const asp = S.w / S.h;
      PV = matPV(asp);
      S.talk += ((S.ttalk || 0) - S.talk) * (1 - Math.exp(-dt * 6));
      const tn = S.talk ? S.talk * (Math.sin(t * 11) * .035 + Math.sin(t * 17.3) * .02) : 0;
      R = rot(S.yaw + (S.talk ? S.talk * Math.sin(t * 5.1) * .025 : 0), S.pitch + tn, -S.yaw * .08 + (S.talk ? S.talk * Math.sin(t * 3.7) * .02 : 0));
      // fit: plane half-height (1) -> fit.h CSS px, centred at fit.cx/cy
      const kNdc = F / DIST;                            // NDC per world unit at the plane
      fitScale = (2 * S.fit.h / S.h) / kNdc;
      shift = [(S.fit.cx / S.w) * 2 - 1, 1 - (S.fit.cy / S.h) * 2];

      gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      // background wall + torch spot
      gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
      gl.useProgram(PB);
      gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(abg); gl.vertexAttribPointer(abg, 2, gl.FLOAT, false, 0, 0);
      const lsx = (S.fit.cx + S.lx * S.fit.h * 1.1) / S.w, lsy = 1 - (S.fit.cy - S.ly * S.fit.h * 1.1) / S.h;
      gl.uniform2f(ub.uRes, canvas.width, canvas.height); gl.uniform2f(ub.uL, lsx, lsy); gl.uniform1f(ub.uPow, pow);
      gl.uniform1f(ub.uT, t); gl.uniform1f(ub.uScan, S.scan); gl.uniform1f(ub.uAsp, asp);
      if (wMix < 1) { wMix = Math.min(1, (now - wT0) / 900); if (wMix >= 1) wA = 1 - wA; }
      const wm = wMix >= 1 ? 0 : wMix;
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, wTex[wA]); gl.uniform1i(ub.uWA, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, wTex[1 - wA]); gl.uniform1i(ub.uWB, 1);
      gl.uniform1f(ub.uWM, wm);
      { const wh = 2.15 * S.fit.h / S.h; gl.uniform4f(ub.uWall, S.fit.cx / S.w, 1 - (S.fit.cy - S.fit.h * .06) / S.h, wh * 2 * S.h / S.w, wh); }
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.disableVertexAttribArray(abg);

      if (S.cur) {
        gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.useProgram(PM);
        gl.bindBuffer(gl.ARRAY_BUFFER, bUV); gl.enableVertexAttribArray(am.uv); gl.vertexAttribPointer(am.uv, 2, gl.FLOAT, false, 0, 0);
        const B = S.mixing ? 1 - slot : slot;
        gl.bindBuffer(gl.ARRAY_BUFFER, bZ[slot]); gl.enableVertexAttribArray(am.za); gl.vertexAttribPointer(am.za, 1, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, bZ[B]); gl.enableVertexAttribArray(am.zb); gl.vertexAttribPointer(am.zb, 1, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, bN[slot]); gl.enableVertexAttribArray(am.na); gl.vertexAttribPointer(am.na, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, bN[B]); gl.enableVertexAttribArray(am.nb); gl.vertexAttribPointer(am.nb, 3, gl.FLOAT, false, 0, 0);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texOf[slot]); gl.uniform1i(um.uA, 0);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texOf[B]); gl.uniform1i(um.uB, 1);
        gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, dOf[slot]); gl.uniform1i(um.uDA, 2);
        gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, dOf[B]); gl.uniform1i(um.uDB, 3);
        { // torch in mask-local space (inverse rotation about the pivot)
          const L = [S.lx * 1.5 - PIV[0], S.ly * 1.3 - PIV[1], S.lz - PIV[2]];
          const Ll = [R[0] * L[0] + R[1] * L[1] + R[2] * L[2], R[3] * L[0] + R[4] * L[1] + R[5] * L[2], R[6] * L[0] + R[7] * L[1] + R[8] * L[2]];
          gl.uniform3f(um.uLl, Ll[0] + PIV[0], Ll[1] + PIV[1], Ll[2] + PIV[2]);
          gl.uniform1f(um.uShad, shadows ? 1 : 0);
        }
        gl.uniformMatrix4fv(um.uPV, false, PV); gl.uniformMatrix3fv(um.uR, false, R);
        gl.uniform3f(um.uPiv, PIV[0], PIV[1], PIV[2]);
        gl.uniform1f(um.uM, S.mixing ? S.mix : 0); gl.uniform1f(um.uRel, RELIEF); gl.uniform1f(um.uFit, fitScale); gl.uniform2f(um.uSh, shift[0], shift[1]);
        gl.uniform1f(um.uT, t); gl.uniform1f(um.uPow, pow); gl.uniform1f(um.uScan, S.scan); gl.uniform1f(um.uBeam, S.beam);
        gl.uniform1f(um.uSpA, spA); gl.uniform1f(um.uSpB, spB); gl.uniform1f(um.uBump, bump); gl.uniform1f(um.uTx, texel * 1.5);
        gl.uniform3f(um.uL, S.lx * 1.5, S.ly * 1.3, S.lz); gl.uniform3f(um.uEye, 0, 0, DIST);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bIdx);
        // floor just under the chin (follows the head when it nods)
        const M = S.cur, chinV = S.mixing && S.next ? Math.max(M.chin, S.next.chin) : M.chin;
        const cz = M.sample(.5, Math.max(0, chinV - .04)) * 1.2 * RELIEF;
        const cw = apply3(R, [0 - PIV[0], 1 - chinV * 2 - PIV[1], cz - PIV[2]]);
        const floorY = Math.min(1 - chinV * 2, cw[1] + PIV[1]) - .035;
        gl.uniform1f(um.uFloor, floorY);
        if (reflect) {
          gl.uniform1f(um.uRefl, 1); gl.uniform1f(um.uShad, 0); gl.uniform1f(um.uScan, 0);
          gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0);
          gl.uniform1f(um.uShad, shadows ? 1 : 0); gl.uniform1f(um.uScan, S.scan);
        }
        gl.uniform1f(um.uRefl, 0);
        gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0);
        [am.uv, am.za, am.zb, am.na, am.nb].forEach(a => gl.disableVertexAttribArray(a));
      }
      o.onFrame && o.onFrame(S, t);
    }
    api.start = () => { S.visible = true; loop(); };
    api.ok = true;
    api.ZMAX = ZMAX;
    return api;
  }
  window.Sala = Sala;
})();
