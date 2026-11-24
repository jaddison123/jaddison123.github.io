// Shared helpers: global pointer position and a render loop that only runs
// while its canvas is on screen (keeps four WebGL scenes cheap).

export const pointer = { x: innerWidth / 2, y: innerHeight / 2, nx: 0, ny: 0 };
addEventListener('pointermove', (e) => {
  pointer.x = e.clientX; pointer.y = e.clientY;
  pointer.nx = (e.clientX / innerWidth) * 2 - 1;
  pointer.ny = -((e.clientY / innerHeight) * 2 - 1);
}, { passive: true });

export function makeLoop(el, fn) {
  let visible = false, raf = 0, last = performance.now(), elapsed = 0;
  const tick = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now; elapsed += dt;
    fn(dt, elapsed);
    raf = visible ? requestAnimationFrame(tick) : 0;
  };
  const start = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } };
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) start();
  }, { rootMargin: '100px' }).observe(el);
  // draw one frame straight away so nothing is blank
  fn(0, 0);
  return { renderOnce: () => fn(0, elapsed) };
}

export function isMobile() { return matchMedia('(max-width: 700px), (pointer: coarse)').matches; }

// Rounded-rect helper for canvas textures
export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
