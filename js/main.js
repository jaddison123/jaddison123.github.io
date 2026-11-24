import { initSun } from './sun.js';
import { initHouse } from './house.js';
import { initGlobe } from './globe.js';
import { initStory } from './story.js';
import { pointer } from './util.js';

const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
const { gsap, ScrollTrigger, Lenis } = window;
const hasGsap = !!(gsap && ScrollTrigger);

const webgl = (() => {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); }
  catch { return false; }
})();
if (!webgl || reduced || !hasGsap) root.classList.add('no-webgl'); // story falls back to a plain image stack
if (hasGsap) root.classList.add('js');

const safe = (fn, fallback) => { try { return fn(); } catch (e) { console.warn(e); return fallback; } };

// ── 3D scenes ─────────────────────────────────────────
const sun = webgl ? safe(() => initSun(document.getElementById('sun-canvas'), { reduced }), { zoom: 0 }) : { zoom: 0 };
const house = { open: 0 };
if (webgl) initHouse(document.getElementById('house-canvas'), { reduced }).then((s) => {
  Object.defineProperty(house, 'open', { get: () => s.open, set: (v) => { s.open = v; } });
}).catch(console.warn);

const regionLabel = document.getElementById('globe-region');
let globe = null;
if (webgl) initGlobe(document.getElementById('globe-canvas'), { reduced, onRegion: (n) => { regionLabel.textContent = n; } })
  .then((g) => { globe = g; }).catch(console.warn);

const story = webgl && !reduced && hasGsap ? safe(() => initStory(document.getElementById('story-canvas'), { reduced }), null) : null;
if (!story) root.classList.add('no-webgl');

// ── Loading intro: wait for fonts + a minimum beat so the eclipse can form ──
const loader = document.getElementById('loader');
const loaderDone = new Promise((resolve) => {
  if (!loader) { resolve(); return; }
  const minShow = new Promise((r) => setTimeout(r, Math.max(0, (reduced ? 200 : 1900) - performance.now())));
  const maxWait = new Promise((r) => setTimeout(r, 6000));
  Promise.race([Promise.all([document.fonts?.ready, minShow]), maxWait]).then(() => {
    loader.classList.add('is-done');
    setTimeout(() => loader.remove(), 1200);
    resolve();
  });
});

document.querySelectorAll('.chip').forEach((chip) => chip.addEventListener('click', () => {
  document.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-active', c === chip));
  globe?.flyTo(chip.dataset.region);
}));

// touch screens can't drag the scenes (it would trap scrolling), so drop that hint
if (!fine) document.querySelectorAll('.stage-hint').forEach((h) => {
  const t = h.textContent.replace(/^Drag to spin · /, '');
  h.textContent = t.charAt(0).toUpperCase() + t.slice(1);
});

// ── Split titles into characters ─────────────────────
document.querySelectorAll('[data-split]').forEach((el) => {
  const text = el.textContent.trim();
  el.setAttribute('aria-label', text);
  el.innerHTML = text.split(' ').map((word) =>
    `<span class="char-wrap" aria-hidden="true">${[...word].map((ch) => `<span class="char">${ch}</span>`).join('')}</span>`
  ).join(' ');
});

// ── Cursor ────────────────────────────────────────────
if (fine && !reduced) {
  document.body.classList.add('has-cursor');
  const cur = document.querySelector('.cursor');
  const dot = cur.querySelector('.cursor-dot'), ring = cur.querySelector('.cursor-ring');
  let rx = pointer.x, ry = pointer.y;
  const step = () => {
    rx += (pointer.x - rx) * 0.18; ry += (pointer.y - ry) * 0.18;
    dot.style.transform = `translate(${pointer.x}px, ${pointer.y}px)`;
    ring.style.transform = `translate(${rx}px, ${ry}px)`;
    requestAnimationFrame(step);
  };
  step();
  document.addEventListener('pointerover', (e) => cur.classList.toggle('is-hover', !!e.target.closest('a, button')));
  // match the cursor colour to the section under it
  const setAccent = (c) => cur.style.setProperty('--accent', c);
  [['#chore', '#ef5a4f'], ['#fish', '#2ee6c9']].forEach(([sel, c]) => {
    new IntersectionObserver(([en]) => { if (en.isIntersecting) setAccent(c); else if (cur.style.getPropertyValue('--accent') === c) setAccent('#ff3b2a'); }, { rootMargin: '-45% 0px -45% 0px' }).observe(document.querySelector(sel));
  });
}

if (!hasGsap) {
  console.warn('GSAP failed to load — running without scroll effects.');
} else {
  gsap.registerPlugin(ScrollTrigger);

  // ── Smooth scroll ─────────────────────────────────────
  let lenis = null;
  if (Lenis && !reduced) {
    lenis = new Lenis({ lerp: 0.09 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  document.querySelectorAll('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(target, { duration: 1.6 });
    else target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
  }));

  // ── Hero: intro (plays as the loader opens) + the sun swallowing the screen ──
  const intro = gsap.timeline({ paused: true });
  if (!reduced) {
    intro.from('.hero-title .char', { yPercent: 115, rotate: 8, duration: 1.3, ease: 'expo.out', stagger: 0.05 }, 0.35)
      .from('.hero .eyebrow, .hero-sub, .scroll-hint', { autoAlpha: 0, y: 20, duration: 1, ease: 'power3.out', stagger: 0.12 }, 0.8);
  }
  if (lenis) lenis.stop();
  loaderDone.then(() => { intro.play(); lenis?.start(); });
  gsap.timeline({ scrollTrigger: { trigger: '.hero', start: 'top top', end: '+=110%', pin: true, scrub: true } })
    .to(sun, { zoom: 1, ease: 'none', duration: 1 }, 0)
    .to('.hero-inner', { autoAlpha: 0, scale: 0.82, filter: 'blur(8px)', ease: 'power1.in', duration: 0.55 }, 0)
    .to('.scroll-hint', { autoAlpha: 0, duration: 0.15 }, 0);

  // ── Titles and reveals ────────────────────────────────
  document.querySelectorAll('.project-title, .footer-title').forEach((t) => {
    if (reduced) return;
    gsap.from(t.querySelectorAll('.char'), {
      yPercent: 115, rotate: 6, duration: 1.1, ease: 'expo.out', stagger: 0.035,
      scrollTrigger: { trigger: t, start: 'top 88%' },
    });
  });
  gsap.utils.toArray('.reveal').forEach((el) => {
    gsap.to(el, { autoAlpha: 1, y: 0, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%' } });
  });
  gsap.utils.toArray('.tags').forEach((el) => {
    if (!reduced) gsap.from(el.children, { autoAlpha: 0, y: 12, scale: 0.9, stagger: 0.05, duration: 0.5, ease: 'back.out(2)', scrollTrigger: { trigger: el, start: 'top 90%' } });
  });

  // ── Chore Score: the roof lifts as you scroll past ──
  ScrollTrigger.create({
    trigger: '#house-stage', start: 'top 65%', end: 'bottom 25%', scrub: true,
    onUpdate: (s) => { house.open = Math.min(1, s.progress * 1.7); },
  });

  // ── Device frames: tip up on scroll, tilt with the mouse ──
  gsap.utils.toArray('.device').forEach((fig) => {
    gsap.set(fig, { transformPerspective: 1400 });
    if (!reduced) gsap.fromTo(fig, { rotationX: 32, scale: 0.88, y: 60 }, {
      rotationX: 0, scale: 1, y: 0, ease: 'none',
      scrollTrigger: { trigger: fig, start: 'top bottom', end: 'top 30%', scrub: true },
    });
    if (fine && !reduced) {
      const ry = gsap.quickTo(fig, 'rotationY', { duration: 0.6, ease: 'power3' });
      fig.addEventListener('pointermove', (e) => {
        const r = fig.getBoundingClientRect();
        ry(((e.clientX - r.left) / r.width - 0.5) * 12);
      });
      fig.addEventListener('pointerleave', () => ry(0));
    }
  });

  // ── Magnetic buttons ─────────────────────────────────
  if (fine && !reduced) {
    document.querySelectorAll('.magnetic').forEach((btn) => {
      const x = gsap.quickTo(btn, 'x', { duration: 0.5, ease: 'power3' });
      const y = gsap.quickTo(btn, 'y', { duration: 0.5, ease: 'power3' });
      btn.addEventListener('pointermove', (e) => {
        const r = btn.getBoundingClientRect();
        x((e.clientX - r.left - r.width / 2) * 0.35);
        y((e.clientY - r.top - r.height / 2) * 0.45);
      });
      btn.addEventListener('pointerleave', () => { x(0); y(0); });
    });
  }

  // ── Black Sun: pinned three-shot sequence ────────────
  if (story) {
    const chapters = document.querySelectorAll('.story-chapters li');
    const bar = document.querySelector('.story-bar i');
    const title = document.querySelector('.story-title');
    ScrollTrigger.create({
      trigger: '.story', start: 'top top', end: '+=320%', pin: true, scrub: true,
      onUpdate: (s) => {
        const p = Math.min(2, s.progress * 2.3);
        story.progress = p;
        const active = p < 0.78 ? 0 : p < 1.78 ? 1 : 2;
        chapters.forEach((li, i) => li.classList.toggle('is-active', i === active));
        bar.style.transform = `scaleX(${s.progress})`;
        title.style.opacity = String(Math.max(0, 1 - Math.max(0, p - 0.25) * 2.5));
      },
    });
  }

  // ── Nav state ─────────────────────────────────────────
  document.querySelectorAll('.nav nav a').forEach((a) => {
    const sec = document.querySelector(a.getAttribute('href'));
    ScrollTrigger.create({ trigger: sec, start: 'top 50%', end: 'bottom 50%', onToggle: (s) => a.classList.toggle('is-active', s.isActive) });
  });

  document.fonts?.ready.then(() => ScrollTrigger.refresh());
  addEventListener('load', () => ScrollTrigger.refresh());
}

// ── Live status badges ────────────────────────────────
// The apps don't allow cross-site reads, so this times a no-cors request:
// Render holds requests while a sleeping free-tier app boots (~30s), so a quick
// reply means it's awake and a slow one means it's waking up. The request
// itself also starts waking the app while the visitor reads the page.
document.querySelectorAll('.status[data-ping]').forEach((el) => {
  const label = el.querySelector('span');
  const set = (state, text) => { el.className = `status ${state}`; label.textContent = text; };
  const ctrl = new AbortController();
  const slow = setTimeout(() => set('is-waking', 'Waking up · about 30s'), 2500);
  const giveUp = setTimeout(() => ctrl.abort(), 90000);
  fetch(el.dataset.ping, { mode: 'no-cors', cache: 'no-store', signal: ctrl.signal })
    .then(() => set('is-live', 'Live now'))
    .catch(() => set('is-down', 'Not responding right now'))
    .finally(() => { clearTimeout(slow); clearTimeout(giveUp); });
});

// ── Visitor stats (GoatCounter: free, no cookies, no consent banner) ──
// Sign up at https://www.goatcounter.com, then put your site code here,
// e.g. 'jaddison' for https://jaddison.goatcounter.com. Leave empty to disable.
const GOATCOUNTER_CODE = '';
if (GOATCOUNTER_CODE && location.hostname.endsWith('github.io')) {
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://gc.zgo.at/count.js';
  s.dataset.goatcounter = `https://${GOATCOUNTER_CODE}.goatcounter.com/count`;
  document.head.appendChild(s);
}
