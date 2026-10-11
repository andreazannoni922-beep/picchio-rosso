import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CustomEase } from 'gsap/CustomEase';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger, CustomEase);
CustomEase.create('brace', '0.22, 1, 0.36, 1');
gsap.defaults({ ease: 'brace', duration: 1.2 });

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(pointer: fine)').matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
let overlayOpen = false;

/* ---------- Scroll morbido ---------- */

const lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
window.__lenis = lenis;
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((t) => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);

$$('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    const el = id === '#top' ? document.body : $(id);
    if (!el) return;
    e.preventDefault();
    closeOverlay();
    lenis.scrollTo(id === '#top' ? 0 : el, { offset: id === '#top' ? 0 : -8, duration: 1.4 });
  });
});

/* ---------- Video hero: verticale sul telefono, orizzontale sul computer ---------- */

const video = $('.hero__video');
{
  const tall = matchMedia('(max-aspect-ratio: 1/1)').matches;
  const key = tall ? 'Tall' : 'Wide';
  video.poster = video.dataset[`poster${key}`];
  video.style.backgroundImage = `url(${video.dataset[`poster${key}`]})`;
  // MP4 (H.264) ovunque sia supportato, WebM (VP9) come alternativa.
  const mp4 = video.canPlayType('video/mp4; codecs="avc1.640028"');
  video.src = mp4 ? video.dataset[`src${key}`] : video.dataset[`src${key}`].replace('.mp4', '.webm');
  const play = () => video.play().catch(() => {});
  video.addEventListener('canplay', play, { once: true });
  ScrollTrigger.create({
    trigger: '.hero', start: 'top bottom', end: 'bottom top',
    onToggle: (s) => (s.isActive ? play() : video.pause()),
  });
}

/* ---------- Scintille: la tecnica firma ----------
   Brace che sale dal fondo. Lo scroll le spinge, il dito/mouse le scansa.
   Sprite pre-renderizzato: niente shadowBlur sul canvas a tutto schermo. */

const sparks = (() => {
  const cv = $('.sparks');
  const ctx = cv.getContext('2d');
  const dpr = Math.min(devicePixelRatio || 1, 2);
  let W = 0, H = 0;
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = 64;
  {
    const g = sprite.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,236,200,1)');
    grd.addColorStop(0.12, 'rgba(255,170,90,0.95)');
    grd.addColorStop(0.35, 'rgba(255,90,35,0.35)');
    grd.addColorStop(1, 'rgba(255,75,31,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
  }
  const N = innerWidth < 700 ? 46 : 90;
  const P = [];
  const spawn = (p, anywhere) => {
    p.x = Math.random() * W;
    p.y = anywhere ? Math.random() * H : H + 20 + Math.random() * 80;
    p.vx = (Math.random() - 0.5) * 0.25;
    p.vy = -(0.25 + Math.random() * 0.75);
    p.r = 3 + Math.random() * 9;
    p.life = 0;
    p.max = 260 + Math.random() * 420;
    p.ph = Math.random() * Math.PI * 2;
    return p;
  };
  const resize = () => {
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  addEventListener('resize', resize);
  for (let i = 0; i < N; i++) P.push(spawn({}, true));

  const ptr = { x: -999, y: -999 };
  addEventListener('pointermove', (e) => { ptr.x = e.clientX; ptr.y = e.clientY; }, { passive: true });
  addEventListener('pointerleave', () => { ptr.x = ptr.y = -999; });

  let boost = 0, intensity = 1, target = 1;
  lenis.on('scroll', ({ velocity }) => { boost = clamp(boost + Math.abs(velocity) * 0.04, 0, 6); });

  const tick = () => {
    intensity += (target - intensity) * 0.05;
    boost *= 0.92;
    ctx.clearRect(0, 0, W, H);
    if (intensity < 0.01) return;
    ctx.globalCompositeOperation = 'lighter';
    for (const p of P) {
      p.life++;
      p.ph += 0.03;
      const dx = p.x - ptr.x, dy = p.y - ptr.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 14000) { const f = (1 - d2 / 14000) * 0.6; p.vx += (dx / 120) * f; p.vy += (dy / 120) * f; }
      p.vx *= 0.97;
      p.x += p.vx + Math.sin(p.ph) * 0.35;
      p.y += p.vy * (1 + boost);
      if (p.y < -30 || p.life > p.max || p.x < -30 || p.x > W + 30) spawn(p, false);
      const k = p.life / p.max;
      const a = Math.sin(Math.PI * k) * (0.55 + 0.45 * Math.sin(p.ph * 2.3)) * intensity;
      if (a <= 0) continue;
      ctx.globalAlpha = a;
      const s = p.r * (1 - k * 0.6);
      ctx.drawImage(sprite, p.x - s, p.y - s, s * 2, s * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  };
  if (!reduced) gsap.ticker.add(tick);

  // Le scintille vivono solo vicino al fuoco: hero, forno, ordina, footer.
  const hot = new Set();
  $$('[data-sparks]').forEach((el) => {
    ScrollTrigger.create({
      trigger: el, start: 'top 85%', end: 'bottom 15%',
      onToggle: (s) => { s.isActive ? hot.add(el) : hot.delete(el); target = hot.size ? 1 : 0; },
    });
  });
  return { set: (v) => (target = v) };
})();

/* ---------- Intro: la brace si accende e apre la pagina ---------- */

const intro = $('.intro');
const heroLines = $$('.hero__title .line > span');
const heroBits = ['.hero__place', '.hero__actions', '.bar'];

if (reduced) {
  intro.remove();
} else {
  lenis.stop();
  gsap.set(heroLines, { yPercent: 110 });
  gsap.set(heroBits, { autoAlpha: 0, y: 18 });
  gsap.set(video, { scale: 1.12 });
  const radius = Math.hypot(innerWidth, innerHeight) * 0.6;
  const proxy = { r: 0 };
  gsap.timeline({ delay: 0.15, onComplete: () => { intro.remove(); lenis.start(); } })
    .to('.intro__ember', { scale: 1, duration: 0.9 })
    .to('.intro__ember', { scale: 2.4, duration: 0.5, ease: 'power1.inOut', yoyo: true, repeat: 1 })
    .to(proxy, {
      r: radius, duration: 1.6, ease: 'expo.inOut',
      onUpdate: () => intro.style.setProperty('--r', `${proxy.r}px`),
    }, '-=0.2')
    .to('.intro__ember', { autoAlpha: 0, duration: 0.4 }, '<')
    .to(video, { scale: 1, duration: 1.8 }, '<0.2')
    .to(heroLines, { yPercent: 0, duration: 1.3, stagger: 0.1 }, '<0.5')
    .to(heroBits, { autoAlpha: 1, y: 0, duration: 1.1, stagger: 0.12 }, '<0.45');
}

/* ---------- Hero allo scroll: il video si allontana in una cornice ---------- */

if (!reduced) {
  gsap.timeline({
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
  })
    .to('.hero__frame', { scale: 0.86, borderRadius: 36, yPercent: 6, ease: 'none' }, 0)
    .to('.hero__copy', { yPercent: -30, autoAlpha: 0, ease: 'none' }, 0);
}

/* ---------- Barra e dock: solidi dopo l'hero, si nascondono scendendo ----------
   Il dock di chiamata sparisce dove la pagina ha già il suo invito a chiamare. */

const bar = $('.bar');
const dock = $('.dock');
const ownCall = $$('.hero, .ordina, .foot');
let lastY = 0;
lenis.on('scroll', ({ scroll }) => {
  const past = scroll > innerHeight * 0.6;
  const down = scroll > lastY + 2;
  const up = scroll < lastY - 2;
  bar.classList.toggle('is-solid', past);
  if (!past || up || overlayOpen) bar.classList.remove('is-hidden');
  else if (down) bar.classList.add('is-hidden');
  const mid = innerHeight * 0.5;
  const inCall = ownCall.some((el) => { const r = el.getBoundingClientRect(); return r.top < innerHeight && r.bottom > mid * 0.4; });
  if (!past || inCall || down) dock.classList.remove('is-on');
  else if (up) dock.classList.add('is-on');
  lastY = scroll;
});

/* ---------- Overlay di navigazione ---------- */

const overlay = $('#overlay');
const toggle = $('.bar__toggle');
function openOverlay() {
  overlayOpen = true;
  overlay.hidden = false;
  toggle.setAttribute('aria-expanded', 'true');
  $('.bar__toggle-label').textContent = 'Chiudi';
  bar.classList.remove('is-hidden');
  lenis.stop();
  gsap.fromTo(overlay, { clipPath: 'circle(0% at 92% 4%)' }, { clipPath: 'circle(150% at 92% 4%)', duration: 1.1 });
  gsap.fromTo($$('.overlay__nav a'), { yPercent: 60, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, stagger: 0.06, duration: 1, delay: 0.15 });
}
function closeOverlay() {
  if (!overlayOpen) return;
  overlayOpen = false;
  toggle.setAttribute('aria-expanded', 'false');
  $('.bar__toggle-label').textContent = 'Menu';
  lenis.start();
  gsap.to(overlay, { clipPath: 'circle(0% at 92% 4%)', duration: 0.8, onComplete: () => (overlay.hidden = true) });
}
toggle.addEventListener('click', () => (overlayOpen ? closeOverlay() : openOverlay()));
addEventListener('keydown', (e) => e.key === 'Escape' && closeOverlay());
overlay.addEventListener('pointermove', (e) => {
  overlay.style.setProperty('--gx', `${(e.clientX / innerWidth) * 100}%`);
  overlay.style.setProperty('--gy', `${(e.clientY / innerHeight) * 100}%`);
});

/* ---------- Manifesto: le parole si accendono una a una ---------- */

$$('[data-words]').forEach((p) => {
  const walk = (node, hot) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((t) => {
          if (!t) return;
          if (/^\s+$/.test(t)) { frag.append(' '); return; }
          const s = document.createElement('span');
          s.className = hot ? 'w w--hot' : 'w';
          s.textContent = t;
          frag.append(s);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1) walk(n, hot || n.tagName === 'B');
    });
  };
  walk(p, false);
  const words = $$('.w', p);
  if (reduced) return;
  ScrollTrigger.create({
    trigger: p, start: 'top 78%', end: 'bottom 45%', scrub: true,
    onUpdate: (s) => {
      const lit = s.progress * words.length * 1.05;
      words.forEach((w, i) => {
        const a = clamp(lit - i, 0, 1);
        w.style.opacity = 0.16 + a * 0.84;
        if (w.classList.contains('w--hot')) {
          w.classList.toggle('is-hot', a > 0.6);
          w.style.color = a > 0.6 ? 'var(--fire-2)' : '';
        }
      });
    },
  });
});

/* ---------- Il forno: la luce rivela le mani sotto la brace ---------- */

{
  const lens = $('.forno__lens');
  const stage = $('.forno__stage');
  const st = { x: 50, y: 42, r: 22, tx: 50, ty: 42, user: 0 };
  const setLens = () => {
    lens.style.setProperty('--lx', `${st.x}%`);
    lens.style.setProperty('--ly', `${st.y}%`);
    lens.style.setProperty('--lr', `${st.r}vmax`);
  };
  setLens();
  const move = (e) => {
    const r = stage.getBoundingClientRect();
    st.tx = ((e.clientX - r.left) / r.width) * 100;
    st.ty = ((e.clientY - r.top) / r.height) * 100;
    st.user = performance.now();
  };
  stage.addEventListener('pointermove', move, { passive: true });
  stage.addEventListener('pointerdown', move, { passive: true });
  let t0 = 0;
  const loop = (time) => {
    // Senza input, la luce gira lenta come la fiamma nel forno.
    if (performance.now() - st.user > 2200) {
      t0 += 0.006;
      st.tx = 50 + Math.cos(t0) * 18;
      st.ty = 40 + Math.sin(t0 * 1.3) * 12;
    }
    st.x += (st.tx - st.x) * 0.08;
    st.y += (st.ty - st.y) * 0.08;
    setLens();
  };
  if (!reduced) {
    gsap.ticker.add(loop);
    // Scorrendo, la lente si allarga fino a mostrare tutta la foto.
    gsap.timeline({
      scrollTrigger: { trigger: '.forno', start: 'top top', end: '+=140%', pin: '.forno__pin', scrub: true },
    })
      .fromTo(st, { r: 20 }, { r: 120, ease: 'power2.in', onUpdate: setLens }, 0)
      .from('.forno__copy > *', { y: 40, autoAlpha: 0, stagger: 0.1, ease: 'none', duration: 0.25 }, 0.05)
      .fromTo('.forno__dark', { scale: 1.15 }, { scale: 1, ease: 'none' }, 0);
  } else {
    st.r = 120; setLens();
  }
}

/* ---------- Menu: schede impilate, la pizza gira come sulla pala ---------- */

{
  const cards = $$('.card');
  cards.forEach((c, i) => c.style.setProperty('--i', i));
  if (!reduced) {
    cards.forEach((card, i) => {
      const img = $('img', card);
      gsap.fromTo(img, { rotate: -50 }, {
        rotate: 40, ease: 'none',
        scrollTrigger: { trigger: card, start: 'top bottom', end: 'bottom top', scrub: true },
      });
      const next = cards[i + 1];
      if (!next) return;
      gsap.to(card, {
        scale: 0.94, filter: 'brightness(0.62)', ease: 'none',
        scrollTrigger: { trigger: next, start: 'top 70%', end: 'top 15%', scrub: true },
      });
    });
  }
}

/* ---------- Formati: normale, gigante, mezzo metro ---------- */

{
  const root = $('.sizer');
  const stage = $('.sizer__stage');
  const round = $('.sizer__round');
  const long = $('.sizer__long');
  const ruler = $('.sizer__ruler');
  const thumb = $('.sizer__thumb');
  const btns = $$('.sizer__controls button');
  const caption = $('.sizer__caption');
  const texts = [
    'La misura classica, una pizza a testa.',
    'Più grande, da dividere in due o da tenere tutta per te.',
    'Mezzo metro di pizza da mettere al centro del tavolo.',
  ];
  const state = { v: 0 };
  const wide = () => stage.clientWidth / stage.clientHeight > 1.2;

  const render = () => {
    const v = state.v;
    const a = clamp(v, 0, 1);        // normale → gigante
    const b = clamp(v - 1, 0, 1);    // gigante → mezzo metro
    const s0 = wide() ? 0.5 : 0.62, s1 = wide() ? 0.86 : 1;
    const rs = s0 + (s1 - s0) * a;
    round.style.transform = `translate(-50%,-50%) scale(${rs * (1 - b * 0.25)}) rotate(${v * 40}deg)`;
    round.style.opacity = String(1 - b);
    long.style.transform = `translate(-50%,-50%) scale(${0.7 + 0.3 * b})`;
    long.style.opacity = String(b);
    ruler.style.opacity = String(clamp((b - 0.6) / 0.4, 0, 1));
    thumb.style.transform = `translateX(${v * 100}%)`;
  };
  render();

  let current = 0;
  const go = (i, fromDrag) => {
    current = i;
    btns.forEach((b, k) => b.setAttribute('aria-checked', String(k === i)));
    gsap.to(state, { v: i, duration: fromDrag ? 0.8 : 1.2, onUpdate: render, overwrite: true });
    gsap.fromTo(caption, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.9 });
    caption.textContent = texts[i];
    root.dataset.size = i;
  };
  btns.forEach((b, i) => b.addEventListener('click', () => go(i)));
  stage.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') go(Math.min(2, current + 1));
    if (e.key === 'ArrowLeft') go(Math.max(0, current - 1));
  });

  // Trascinando sul piatto la pizza cresce o si restringe.
  let drag = null;
  stage.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY, v: state.v, id: e.pointerId, moved: false };
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.abs(dx) < 8) return;
    if (!drag.moved && Math.abs(dy) > Math.abs(dx)) { drag = null; return; }
    drag.moved = true;
    stage.setPointerCapture(e.pointerId);
    gsap.killTweensOf(state);
    state.v = clamp(drag.v + (dx / stage.clientWidth) * 2.4, 0, 2);
    render();
  });
  const end = () => {
    if (drag && drag.moved) go(Math.round(state.v), true);
    drag = null;
  };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);
  addEventListener('resize', render);

  // Arrivando alla sezione la pizza "esce dal forno" e si mostra.
  if (!reduced) {
    gsap.from(stage, {
      clipPath: 'inset(20% 10% 20% 10% round 28px)', duration: 1.4,
      scrollTrigger: { trigger: stage, start: 'top 80%' },
    });
  }
}

/* ---------- Fritti: la foto si apre e scorre ---------- */

if (!reduced) {
  gsap.to('.fritti__media', {
    clipPath: 'inset(0% 0% 0% 0% round 28px)', ease: 'none',
    scrollTrigger: { trigger: '.fritti', start: 'top 85%', end: 'center 55%', scrub: true },
  });
  gsap.fromTo('.fritti__media img', { yPercent: -12 }, {
    yPercent: 0, ease: 'none',
    scrollTrigger: { trigger: '.fritti', start: 'top bottom', end: 'bottom top', scrub: true },
  });
}

/* ---------- Ordina: il numero si scalda mentre lo guardi ---------- */

{
  const digits = $('.ordina__digits');
  if (reduced) digits.style.setProperty('--fill', '100%');
  else {
    gsap.fromTo(digits, { '--fill': '0%' }, {
      '--fill': '100%', ease: 'none',
      scrollTrigger: { trigger: '.ordina', start: 'top 70%', end: 'center 45%', scrub: true },
    });
  }
}

/* ---------- Comparse a cascata per titoli e testi ---------- */

if (!reduced) {
  $$('.menu__head, .formati__head, .fritti__copy, .ordina > .title, .ordina > .lead, .dove__copy, .dove__hours, .faq > .title, .faq__list, .foot__grid').forEach((el) => {
    gsap.from(el.children.length > 1 ? el.children : el, {
      y: 36, autoAlpha: 0, duration: 1.2, stagger: 0.1,
      scrollTrigger: { trigger: el, start: 'top 86%' },
    });
  });
}

/* ---------- FAQ: apertura morbida ---------- */

$$('.faq details').forEach((d) => {
  const sum = $('summary', d);
  const body = $('.faq__a', d);
  sum.addEventListener('click', (e) => {
    e.preventDefault();
    if (d.open) {
      gsap.to(body, { height: 0, duration: 0.8, onComplete: () => { d.open = false; gsap.set(body, { clearProps: 'height' }); ScrollTrigger.refresh(); } });
    } else {
      d.open = true;
      gsap.fromTo(body, { height: 0 }, { height: 'auto', duration: 1, onComplete: () => ScrollTrigger.refresh() });
    }
  });
});

/* ---------- Footer: la luce segue il dito ---------- */

{
  const foot = $('.foot');
  const glow = { x: 50, y: 100 };
  foot.addEventListener('pointermove', (e) => {
    const r = foot.getBoundingClientRect();
    gsap.to(glow, {
      x: ((e.clientX - r.left) / r.width) * 100,
      y: ((e.clientY - r.top) / r.height) * 100,
      duration: 1.2, overwrite: true,
      onUpdate: () => { foot.style.setProperty('--gx', `${glow.x}%`); foot.style.setProperty('--gy', `${glow.y}%`); },
    });
  });
}

/* ---------- Font e immagini caricati: ricalcola le posizioni ---------- */

document.fonts?.ready.then(() => ScrollTrigger.refresh());
addEventListener('load', () => ScrollTrigger.refresh());
if (!finePointer) document.documentElement.classList.add('touch');
