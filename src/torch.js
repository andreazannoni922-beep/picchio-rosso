// Torcia: la tecnica firma del sito.
// La foto è "bruciata" in una bicromia di brace; dove passa il dito o il mouse
// la torcia rivela il colore vero, con un bordo a fiamma e un leggero calore che deforma l'aria.
// Quando nessuno la muove, la torcia vaga da sola, così l'effetto si vede senza istruzioni.

const VERT = `
attribute vec2 p;
varying vec2 vUv;
void main(){ vUv = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uRes, uImg, uMouse;
uniform float uTime, uRadius, uReveal, uFocusY, uDim;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), u.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), u.x), u.y);
}
float fbm(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 4; i++){ v += a * noise(p); p *= 2.03; a *= .5; } return v; }

vec3 ember(float l){
  // nero -> brace -> rosso Flames -> arancio -> bianco caldo
  vec3 c0 = vec3(.035, .02, .016), c1 = vec3(.26, .035, .02), c2 = vec3(.77, .086, .11), c3 = vec3(1., .36, .12), c4 = vec3(1., .86, .66);
  l = clamp(l, 0., 1.);
  if (l < .25) return mix(c0, c1, l / .25);
  if (l < .5) return mix(c1, c2, (l - .25) / .25);
  if (l < .78) return mix(c2, c3, (l - .5) / .28);
  return mix(c3, c4, (l - .78) / .22);
}

void main(){
  // copertura tipo object-fit: cover, con fuoco verticale regolabile
  vec2 uv = vUv;
  float rs = uRes.x / uRes.y, ri = uImg.x / uImg.y;
  vec2 sc = rs > ri ? vec2(1., ri / rs) : vec2(rs / ri, 1.);
  vec2 off = (1. - sc) * vec2(.5, uFocusY);
  vec2 tuv = uv * sc + off;

  vec2 frag = vUv * uRes;
  vec2 d = frag - uMouse;
  // la fiamma è più alta che larga e sale verso l'alto
  d.y = d.y * .78 - uRadius * .12;
  float t = uTime;
  float n = fbm(vec2(atan(d.y, d.x) * 2.2, t * 1.4) + frag * .004);
  float r = uRadius * (.82 + .36 * n);
  float dist = length(d);
  float m = smoothstep(r, r * .42, dist) * uReveal;

  // calore: l'aria trema vicino alla torcia
  float haze = smoothstep(r * 1.7, r * .2, dist);
  vec2 h = vec2(fbm(frag * .02 + vec2(0., -t * 2.)) - .5, fbm(frag * .02 + vec2(5., -t * 2.3)) - .5) * .012 * haze;
  vec3 col = texture2D(uTex, tuv + h * vec2(1., uRes.x / uRes.y)).rgb;

  float l = dot(col, vec3(.299, .587, .114));
  l = pow(l, .92) * 1.08;
  // le luci del palco tremolano leggermente
  l += (fbm(vec2(tuv.x * 6., t * .8)) - .5) * .05 * smoothstep(.4, .9, l);
  vec3 duo = ember(l);

  vec3 outc = mix(duo, col * 1.06, m);
  float rim = smoothstep(.0, .5, m) * smoothstep(1., .5, m);
  outc += vec3(1., .42, .14) * rim * .55;
  // alone di luce oltre il bordo
  outc += vec3(1., .3, .08) * smoothstep(r * 1.9, r * .6, dist) * .07 * uReveal;

  // vignetta + grana
  vec2 q = vUv - .5;
  outc *= 1. - dot(q, q) * .9;
  outc += (hash(frag + fract(t) * 91.) - .5) * .035;
  gl_FragColor = vec4(outc * uDim, 1.);
}`;

export class Torch {
  constructor(canvas, src, opts = {}) {
    this.c = canvas;
    this.opts = Object.assign({ radius: 0.22, focusY: 0.5, dim: 1, wanderY: 0.5, wanderA: 0.22 }, opts);
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
    if (!gl) { canvas.classList.add('no-gl'); return; }
    this.gl = gl;
    const sh = (type, s) => { const o = gl.createShader(type); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(o)); return o; };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(pr); gl.useProgram(pr);
    this.pr = pr;
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p');
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.u = {};
    ['uTex', 'uRes', 'uImg', 'uMouse', 'uTime', 'uRadius', 'uReveal', 'uFocusY', 'uDim'].forEach(k => this.u[k] = gl.getUniformLocation(pr, k));

    this.mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    this.lastMove = -1e9;
    this.reveal = 0; this.revealT = 1;
    this.visible = false;
    this.t0 = performance.now();
    this.ready = false;

    this.tex = gl.createTexture();
    this.img = new Image();
    this.img.decoding = 'async';
    this.img.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, this.img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.ready = true;
      this.c.classList.add('is-ready');
    };
    this.img.src = src;

    this.resize = this.resize.bind(this);
    this.loop = this.loop.bind(this);
    new ResizeObserver(this.resize).observe(canvas);
    this.resize();

    const target = opts.target || canvas;
    const move = e => {
      const r = this.c.getBoundingClientRect();
      const p = e.touches ? e.touches[0] : e;
      this.mouse.tx = (p.clientX - r.left) * this.dpr;
      this.mouse.ty = (r.bottom - p.clientY) * this.dpr;
      this.lastMove = performance.now();
    };
    target.addEventListener('pointermove', move, { passive: true });
    target.addEventListener('touchmove', move, { passive: true });
    target.addEventListener('pointerdown', move, { passive: true });

    new IntersectionObserver(([en]) => {
      this.visible = en.isIntersecting;
      if (this.visible && !this.raf) this.raf = requestAnimationFrame(this.loop);
    }, { rootMargin: '100px' }).observe(canvas);
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.round(this.c.clientWidth * this.dpr), h = Math.round(this.c.clientHeight * this.dpr);
    if (w === this.c.width && h === this.c.height) return;
    this.c.width = w; this.c.height = h;
    if (!this.mouse.x) { this.mouse.x = this.mouse.tx = w * .5; this.mouse.y = this.mouse.ty = h * .45; }
  }

  loop(now) {
    this.raf = this.visible ? requestAnimationFrame(this.loop) : 0;
    if (!this.ready || !this.gl) return;
    const gl = this.gl, t = (now - this.t0) / 1000;
    const w = this.c.width, h = this.c.height;
    // inattiva da 2,5 s: la torcia vaga da sola
    if (now - this.lastMove > 2500) {
      this.mouse.tx = w * (.5 + .3 * Math.sin(t * .37)) ;
      this.mouse.ty = h * (this.opts.wanderY + this.opts.wanderA * Math.sin(t * .53 + 1.3));
    }
    const k = now - this.lastMove > 2500 ? .025 : .14;
    this.mouse.x += (this.mouse.tx - this.mouse.x) * k;
    this.mouse.y += (this.mouse.ty - this.mouse.y) * k;
    this.reveal += (this.revealT - this.reveal) * .08;

    gl.viewport(0, 0, w, h);
    gl.uniform2f(this.u.uRes, w, h);
    gl.uniform2f(this.u.uImg, this.img.naturalWidth, this.img.naturalHeight);
    gl.uniform2f(this.u.uMouse, this.mouse.x, this.mouse.y);
    gl.uniform1f(this.u.uTime, t);
    gl.uniform1f(this.u.uRadius, Math.min(w, h) * this.opts.radius + Math.max(w, h) * .04);
    gl.uniform1f(this.u.uReveal, this.reveal);
    gl.uniform1f(this.u.uFocusY, this.opts.focusY);
    gl.uniform1f(this.u.uDim, this.opts.dim);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
