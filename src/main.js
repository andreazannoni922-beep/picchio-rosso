import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CustomEase } from 'gsap/CustomEase';
import Lenis from 'lenis';
import { Torch } from './torch.js';
import { FLAMES_D, LETTER_X } from './flames-path.js';

gsap.registerPlugin(ScrollTrigger, CustomEase);
// una sola curva per tutto il sito
CustomEase.create('flame', '0.22,1,0.36,1');
gsap.defaults({ ease: 'flame', duration: 1.2 });

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = () => innerWidth < 900;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = t => t * t * (3 - 2 * t);

/* ---------- scroll morbido ---------- */
const lenis = reduced ? null : new Lenis({ lerp: 0.1, smoothWheel: true });
if (lenis) {
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
const scrollToHash = hash => {
  const el = hash && hash.length > 1 ? document.getElementById(hash.slice(1)) : null;
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { offset: 0, duration: 1.6, easing: t => 1 - Math.pow(1 - t, 4) });
  else el.scrollIntoView();
};
$$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
  e.preventDefault();
  closeMenu();
  scrollToHash(a.getAttribute('href'));
}));

/* ---------- barra: si nasconde scendendo, torna salendo ---------- */
const bar = $('[data-bar]');
let lastY = 0;
const onScrollBar = y => {
  bar.classList.toggle('is-hidden', y > lastY && y > 200 && !menu.classList.contains('is-open'));
  lastY = y;
};
if (lenis) lenis.on('scroll', ({ scroll }) => onScrollBar(scroll));
else addEventListener('scroll', () => onScrollBar(scrollY), { passive: true });

/* ---------- menu ---------- */
const menu = $('[data-menu]');
const menuBtn = $('[data-menu-btn]');
$$('.menu__nav a').forEach((a, i) => a.style.setProperty('--d', i * 60));
function closeMenu() {
  if (!menu.classList.contains('is-open')) return;
  menu.classList.remove('is-open');
  menu.setAttribute('aria-hidden', 'true');
  menuBtn.setAttribute('aria-expanded', 'false');
  lenis && lenis.start();
}
menuBtn.addEventListener('click', () => {
  const open = !menu.classList.contains('is-open');
  if (!open) return closeMenu();
  menu.classList.add('is-open');
  menu.setAttribute('aria-hidden', 'false');
  menuBtn.setAttribute('aria-expanded', 'true');
  lenis && lenis.stop();
});
addEventListener('keydown', e => e.key === 'Escape' && closeMenu());

/* ---------- torce WebGL ---------- */
$$('[data-torch]').forEach(c => {
  const portrait = innerHeight > innerWidth;
  const src = portrait ? c.dataset.srcV : c.dataset.srcH;
  c._torch = new Torch(c, src, {
    focusY: parseFloat(c.dataset.focus || '0.5'),
    dim: parseFloat(c.dataset.dim || '1'),
    radius: portrait ? 0.3 : 0.2,
    wanderY: parseFloat(c.dataset.wanderY || '0.5'),
    wanderA: parseFloat(c.dataset.wanderA || '0.22'),
    target: c.closest('section, footer'),
  });
});

/* ---------- torce CSS: foto artisti e menu ---------- */
const ctorches = $$('[data-ctorch]');
const ctState = new Map();
ctorches.forEach((el, i) => {
  const s = { x: 50, y: 45, tx: 50, ty: 45, last: -1e9, seed: i * 1.7, vis: false, size: 300 };
  ctState.set(el, s);
  // il raggio della torcia segue la misura della foto (in px: il cerchio del gradiente non accetta %)
  new ResizeObserver(([en]) => (s.size = Math.min(en.contentRect.width, en.contentRect.height) || 300)).observe(el);
  const move = e => {
    const r = el.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    s.tx = ((p.clientX - r.left) / r.width) * 100;
    s.ty = ((p.clientY - r.top) / r.height) * 100;
    s.last = performance.now();
  };
  const host = el.closest('.night') || el.closest('.menu') || el;
  host.addEventListener('pointermove', move, { passive: true });
  host.addEventListener('touchmove', move, { passive: true });
  new IntersectionObserver(([en]) => (s.vis = en.isIntersecting)).observe(el);
});
gsap.ticker.add(() => {
  const now = performance.now(), t = now / 1000;
  ctState.forEach((s, el) => {
    if (!s.vis) return;
    const idle = now - s.last > 2200;
    if (idle) {
      s.tx = 50 + 26 * Math.sin(t * 0.45 + s.seed);
      s.ty = 46 + 20 * Math.sin(t * 0.62 + s.seed * 2);
    }
    const k = idle ? 0.03 : 0.16;
    s.x += (s.tx - s.x) * k;
    s.y += (s.ty - s.y) * k;
    const flicker = 1 + 0.05 * Math.sin(t * 9 + s.seed) * Math.sin(t * 13.7);
    el.style.setProperty('--mx', s.x.toFixed(2) + '%');
    el.style.setProperty('--my', s.y.toFixed(2) + '%');
    el.style.setProperty('--r', (s.size * 0.6 * flicker).toFixed(1) + 'px');
  });
});

/* ---------- HERO: FLAMES come finestra, zoom attraverso la A ---------- */
(() => {
  const hero = $('[data-hero]');
  const cv = $('[data-mask]', hero);
  const ctx = cv.getContext('2d');
  const intro = $('[data-hero-intro]', hero);
  const after = $('[data-hero-after]', hero);
  const torch = $('[data-torch]', hero)._torch;

  // separo i sottotracciati per lettera, così sul telefono la parola va su due righe
  const subs = FLAMES_D.split('M').filter(Boolean).map(s => 'M' + s);
  const firstX = s => parseFloat(s.slice(1));
  const starts = LETTER_X.map(x => Math.max(0, x));
  const letterOf = x => { let li = 0; starts.forEach((s, i) => { if (x >= s - 2) li = i; }); return li; };
  const byLetter = [[], [], [], [], [], []];
  subs.forEach(s => byLetter[letterOf(firstX(s))].push(s));
  const pathFull = new Path2D(FLAMES_D);
  const line1 = new Path2D(byLetter.slice(0, 3).flat().join(''));
  const line2Raw = byLetter.slice(3).flat().join('');
  const line2 = new Path2D();
  const m2 = 1316; // inizio della M
  line2.addPath(new Path2D(line2Raw), new DOMMatrix().translate(-m2, 0));
  const FOCAL = { x: 900, y: 600 }; // dentro la gamba sinistra della A: lo zoom finisce sulla folla
  const W_FULL = 2898, W_L1 = 1256, W_L2 = 2898 - m2, H = 820;

  let dpr = 1, w = 0, h = 0, layout = null, progress = 0;

  function computeLayout() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = cv.clientWidth; h = cv.clientHeight;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    const g = isMobile() ? 16 : innerWidth * 0.04;
    const introH = intro.getBoundingClientRect().height;
    if (w / h < 0.85) {
      // telefono: FLA / MES su due righe, larghe quanto lo schermo
      const avail = w - g * 2;
      const s = Math.min(avail / W_L2, (h - introH - 150) / (H * 2.1));
      const x = g, y1 = Math.max(72, (h - introH - 40 - s * H * 2.1) * 0.45 + 58);
      const y2 = y1 + s * H * 1.1;
      layout = { items: [{ p: line1, x, y: y1, s }, { p: line2, x, y: y2, s }], focal: { x: x + FOCAL.x * s, y: y1 + FOCAL.y * s }, s };
    } else {
      const s = Math.min((w - g * 2) / W_FULL, (h * 0.5) / H);
      const x = g, y = Math.max(96, (h - introH - 60 - H * s) * 0.5 + 30);
      layout = { items: [{ p: pathFull, x, y, s }], focal: { x: x + FOCAL.x * s, y: y + FOCAL.y * s }, s };
    }
  }

  function draw() {
    if (!layout) return;
    const p = progress;
    const zp = smooth(clamp(p / 0.6));
    const zoom = Math.pow(70, zp * zp);
    const fx = layout.focal.x + (w / 2 - layout.focal.x) * zp;
    const fy = layout.focal.y + (h / 2 - layout.focal.y) * zp;
    const alpha = 1 - smooth(clamp((p - 0.42) / 0.2));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (alpha <= 0) return;
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#0b0706';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = 1;
    const base = new DOMMatrix().scale(dpr).translate(fx, fy).scale(zoom).translate(-layout.focal.x, -layout.focal.y);
    for (const it of layout.items) {
      const m = base.translate(it.x, it.y).scale(it.s);
      ctx.setTransform(m);
      ctx.fill(it.p);
    }
    // bordo di luce sottile intorno alle lettere
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = alpha * (1 - zp) * 0.9;
    ctx.strokeStyle = '#ff8a1f';
    for (const it of layout.items) {
      const m = base.translate(it.x, it.y).scale(it.s);
      ctx.setTransform(m);
      ctx.lineWidth = 1.1 / (it.s * zoom);
      ctx.stroke(it.p);
    }
    ctx.globalAlpha = 1;
  }

  computeLayout(); draw();
  addEventListener('resize', () => { computeLayout(); draw(); });
  document.fonts && document.fonts.ready.then(() => { computeLayout(); draw(); });

  // ingresso: la parola si accende dal basso, poi il titolo
  if (!reduced) {
    gsap.from(cv, { opacity: 0, duration: 1.4, delay: 0.1 });
    gsap.from($$('.hero__title, .hero__meta', intro), { y: 30, opacity: 0, stagger: 0.12, delay: 0.35 });
  }

  if (reduced) { after.style.cssText = ''; return; }
  ScrollTrigger.create({
    trigger: hero, start: 'top top', end: 'bottom bottom', scrub: true,
    onUpdate: st => {
      progress = st.progress;
      draw();
      gsap.set(intro, { opacity: 1 - smooth(clamp(progress / 0.16)), y: -40 * clamp(progress / 0.16) });
      const a = smooth(clamp((progress - 0.6) / 0.14));
      gsap.set(after, { opacity: a, visibility: a > 0 ? 'visible' : 'hidden', y: 30 * (1 - a) });
      if (torch) torch.opts.radius = (innerHeight > innerWidth ? 0.3 : 0.2) * (1 + 0.5 * clamp((progress - 0.5) / 0.3));
    },
  });
})();

/* ---------- MANIFESTO: le parole si accendono ---------- */
(() => {
  const el = $('[data-burn]');
  const words = el.textContent.trim().split(/\s+/);
  el.innerHTML = words.map(w => `<span class="w">${w}</span>`).join(' ');
  const spans = $$('.w', el);
  if (reduced) return spans.forEach(s => s.classList.add('on'));
  ScrollTrigger.create({
    trigger: el, start: 'top 82%', end: 'bottom 45%', scrub: true,
    onUpdate: st => {
      const n = st.progress * (spans.length + 3);
      spans.forEach((s, i) => {
        s.classList.toggle('on', i < n);
        s.classList.toggle('hot', i < n && i > n - 3.5);
      });
    },
  });
})();

/* ---------- TABELLONE: le cifre rullano come su un tabellone di gara ---------- */
(() => {
  $$('[data-roll]').forEach(el => {
    const val = el.dataset.roll;
    const txt = el.hasAttribute('data-plain') ? val : Number(val).toLocaleString('it-IT');
    el.innerHTML = '';
    el.classList.add('roll');
    const strips = [];
    [...txt].forEach(ch => {
      const d = document.createElement('span');
      d.className = 'roll__d';
      if (/\d/.test(ch)) {
        const s = document.createElement('span');
        s.className = 'roll__s';
        const turns = 10 + Number(ch);
        s.innerHTML = Array.from({ length: turns + 1 }, (_, i) => `<span>${i % 10}</span>`).join('');
        d.appendChild(s);
        strips.push({ s, turns });
      } else d.textContent = ch;
      el.appendChild(d);
    });
    el.setAttribute('aria-label', txt);
    if (reduced) return strips.forEach(({ s, turns }) => (s.style.transform = `translateY(-${turns * 0.85}em)`));
    ScrollTrigger.create({
      trigger: el, start: 'top 88%', once: true,
      onEnter: () => strips.forEach(({ s, turns }, i) =>
        gsap.fromTo(s, { y: 0 }, { y: `-${turns * 0.85}em`, duration: 1.6, delay: i * 0.1 })),
    });
  });
  if (!reduced) gsap.from($$('.board__row'), { scrollTrigger: { trigger: '[data-board]', start: 'top 85%' }, y: 40, opacity: 0, stagger: 0.1 });
})();

/* ---------- LINEUP: le notti si impilano ---------- */
(() => {
  const cards = $$('.night');
  if (reduced) return;
  cards.forEach((card, i) => {
    const next = cards[i + 1];
    if (!next) return;
    gsap.to(card, {
      scale: 0.9, '--shade': 0.85, ease: 'none',
      scrollTrigger: { trigger: next, start: 'top bottom', end: 'top top+=100', scrub: true },
    });
  });
  cards.forEach(card => gsap.from($$('.night__name, .night__desc, .night__date', card), {
    scrollTrigger: { trigger: card, start: 'top 75%' }, y: 50, opacity: 0, stagger: 0.1,
  }));
})();

/* ---------- 33 SECONDI: flipbook di scatti veri ---------- */
(() => {
  const sec = $('[data-flip]');
  const img = $('[data-flip-img]', sec);
  const clock = $('[data-flip-clock]', sec);
  const times = ['00:54:51', '00:54:53', '00:54:54', '00:54:56', '00:55:00', '00:55:00', '00:55:12', '00:55:14', '00:55:15', '00:55:17', '00:55:19', '00:55:21', '00:55:24'];
  const srcs = times.map((_, i) => `/media/seq-${String(i).padStart(2, '0')}.webp`);
  let loaded = false, cur = 0;
  const preload = () => { if (loaded) return; loaded = true; srcs.forEach(s => { const im = new Image(); im.src = s; }); };
  new IntersectionObserver(([en]) => en.isIntersecting && preload(), { rootMargin: '600px' }).observe(sec);
  if (reduced) return;
  ScrollTrigger.create({
    trigger: sec, start: 'top top', end: 'bottom bottom', scrub: true,
    onUpdate: st => {
      const i = Math.min(srcs.length - 1, Math.floor(st.progress * srcs.length));
      if (i === cur) return;
      cur = i;
      img.src = srcs[i];
      clock.textContent = times[i];
    },
  });
  gsap.from($$('.flip__text > *', sec), { scrollTrigger: { trigger: sec, start: 'top 60%' }, y: 50, opacity: 0, stagger: 0.12 });
})();

/* ---------- SPORT: la pista si disegna, una luce corre in prima corsia ---------- */
(() => {
  const sec = $('[data-sport]');
  const svg = $('[data-track]', sec);
  const NS = 'http://www.w3.org/2000/svg';
  let lanes = [], comet, trail, lane1Len = 0, lane1 = null, prog = 0;

  const stadium = (x0, y0, x1, y1) => {
    const ww = x1 - x0, hh = y1 - y0;
    if (ww >= hh) {
      const r = hh / 2;
      return `M${x0 + r} ${y1} H${x1 - r} A${r} ${r} 0 0 0 ${x1 - r} ${y0} H${x0 + r} A${r} ${r} 0 0 0 ${x0 + r} ${y1} Z`;
    }
    const r = ww / 2;
    return `M${x1} ${y1 - r} V${y0 + r} A${r} ${r} 0 0 0 ${x0} ${y0 + r} V${y1 - r} A${r} ${r} 0 0 0 ${x1} ${y1 - r} Z`;
  };

  function build() {
    const w = sec.clientWidth, h = innerHeight;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.innerHTML = '';
    const mob = isMobile();
    const pad = mob ? 6 : Math.max(28, w * 0.035), gap = mob ? 8 : 13;
    const top = mob ? 64 : 92;
    lanes = [];
    for (let i = 5; i >= 0; i--) {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', stadium(pad + i * gap, top + i * gap, w - pad - i * gap, h - pad - i * gap));
      p.setAttribute('class', 'lane' + (i === 5 ? ' lane--1' : ''));
      svg.appendChild(p);
      lanes.push(p);
    }
    lane1 = lanes[0];
    lane1Len = lane1.getTotalLength();
    trail = document.createElementNS(NS, 'path');
    trail.setAttribute('d', lane1.getAttribute('d'));
    trail.setAttribute('class', 'trail');
    trail.setAttribute('stroke', '#ff8a1f');
    svg.appendChild(trail);
    comet = document.createElementNS(NS, 'circle');
    comet.setAttribute('r', mob ? 4 : 5);
    comet.setAttribute('class', 'comet');
    svg.appendChild(comet);
    lanes.forEach(l => { const L = l.getTotalLength(); l.style.strokeDasharray = L; l._len = L; });
    render();
  }

  function render() {
    // le corsie si disegnano nel primo terzo, poi la luce fa due giri
    lanes.forEach((l, i) => {
      const t = smooth(clamp((prog - i * 0.03) / 0.3));
      l.style.strokeDashoffset = l._len * (1 - t);
    });
    const run = clamp((prog - 0.12) / 0.88);
    const pos = (run * 2 * lane1Len) % lane1Len;
    const pt = lane1.getPointAtLength(pos);
    comet.setAttribute('cx', pt.x); comet.setAttribute('cy', pt.y);
    comet.style.opacity = run > 0 ? 1 : 0;
    const tl = Math.min(lane1Len * 0.16, run * 2 * lane1Len);
    trail.style.strokeDasharray = `${tl} ${lane1Len}`;
    trail.style.strokeDashoffset = -(pos - tl);
    trail.style.opacity = run > 0 ? 0.75 : 0;
  }

  build();
  let rw = innerWidth;
  addEventListener('resize', () => { if (Math.abs(innerWidth - rw) > 40 || !isMobile()) { rw = innerWidth; build(); } });
  if (reduced) { prog = 0.4; render(); return; }
  ScrollTrigger.create({ trigger: sec, start: 'top bottom', end: 'bottom bottom', scrub: true, onUpdate: st => { prog = st.progress; render(); } });
  gsap.from($$('.sport__inner > *, .sport__cols > div', sec), { scrollTrigger: { trigger: sec, start: 'top 20%' }, y: 50, opacity: 0, stagger: 0.12 });
})();

/* ---------- DOVE: il punto sulla mappa si apre sulla prima fila ---------- */
(() => {
  const sec = $('[data-where]');
  const photo = $('[data-where-photo]', sec);
  const stage = $('.where__stage', sec);
  if (reduced) return;
  ScrollTrigger.create({
    trigger: sec, start: 'top top', end: 'bottom bottom', scrub: true,
    onUpdate: st => {
      const p = smooth(clamp(st.progress / 0.7));
      const diag = Math.hypot(innerWidth, innerHeight) * 1.1;
      photo.style.setProperty('--rr', (9 + p * diag).toFixed(1) + 'px');
      stage.style.setProperty('--pin', (1 - clamp(st.progress / 0.15)).toFixed(3));
    },
  });
  gsap.from($$('.where__text > *', sec), { y: 40, opacity: 0, stagger: 0.1, scrollTrigger: { trigger: sec, start: 'top 60%' } });
})();

/* ---------- DOMANDE: apertura morbida ---------- */
$$('[data-faq] details').forEach(d => {
  const sum = $('summary', d), body = $('p', d);
  sum.addEventListener('click', e => {
    if (reduced) return;
    e.preventDefault();
    if (d.open) {
      gsap.to(body, { height: 0, opacity: 0, duration: 0.8, onComplete: () => { d.open = false; gsap.set(body, { clearProps: 'all' }); ScrollTrigger.refresh(); } });
    } else {
      d.open = true;
      gsap.fromTo(body, { height: 0, opacity: 0, overflow: 'hidden' }, { height: 'auto', opacity: 1, duration: 1, onComplete: () => { gsap.set(body, { clearProps: 'all' }); ScrollTrigger.refresh(); } });
    }
  });
});

/* ---------- PARTNER: il pulsante si accende dal punto d'ingresso ---------- */
$$('[data-ignite]').forEach(b => {
  const set = e => { const r = b.getBoundingClientRect(); b.style.setProperty('--x', e.clientX - r.left + 'px'); b.style.setProperty('--y', e.clientY - r.top + 'px'); };
  b.addEventListener('pointerenter', set);
  b.addEventListener('pointerleave', set);
});
if (!reduced) gsap.from($$('.partner__grid > *, .faq > .h2'), { scrollTrigger: { trigger: '.faq', start: 'top 75%' }, y: 50, opacity: 0, stagger: 0.12 });

/* ---------- 2027: modulo (bozza, non collegato) ---------- */
$('[data-signup]').addEventListener('submit', e => {
  e.preventDefault();
  $('.signup__ok').textContent = 'Bozza: il modulo non è ancora collegato. Nessun dato è stato inviato.';
});

addEventListener('load', () => ScrollTrigger.refresh());
