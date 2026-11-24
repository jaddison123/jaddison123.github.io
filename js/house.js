// Chore Score: a low-poly "dollhouse" of four rooms. Scrolling lifts the roof
// and pulls the rooms apart; chore and bill cards orbit it, coins rise out of it.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { makeLoop, isMobile, roundRect } from './util.js';

const CORAL = 0xef5a4f;

function cardTexture({ title, sub, accent = '#ef5a4f', icon = '✓', money = false }) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 200;
  const g = c.getContext('2d');
  roundRect(g, 4, 4, 504, 192, 26);
  g.fillStyle = 'rgba(28,24,30,0.94)'; g.fill();
  g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,0.10)'; g.stroke();
  g.save(); g.clip(); g.fillStyle = accent; g.fillRect(4, 4, 10, 192); g.restore();
  // icon bubble
  g.beginPath(); g.arc(78, 100, 38, 0, Math.PI * 2); g.fillStyle = accent; g.fill();
  g.fillStyle = '#140a0a'; g.font = '600 40px "Space Grotesk", system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(icon, 78, 102);
  g.textAlign = 'left';
  g.fillStyle = '#f4ede7';
  g.font = money ? '400 64px Anton, Impact, sans-serif' : '600 38px "Space Grotesk", system-ui, sans-serif';
  g.fillText(title, 140, money ? 82 : 84);
  g.fillStyle = '#a39793'; g.font = '500 26px "JetBrains Mono", monospace';
  g.fillText(sub, 140, 142);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const CARDS = [
  { title: 'Take out the bins', sub: 'Sam · Mon', icon: '✓' },
  { title: '£42.18', sub: 'Electric · split 4 ways', icon: '£', money: true, accent: '#ffb547' },
  { title: 'Hoover the lounge', sub: 'Alex · due Fri', icon: '✓' },
  { title: 'who ate my pasta', sub: 'House chat · seen by 3', icon: '💬', accent: '#5aa9ff' },
  { title: '£12.50', sub: 'Takeaway · Priya owes you', icon: '£', money: true, accent: '#ffb547' },
  { title: 'Rotate the roster', sub: 'Weekly reset · Monday', icon: '↻' },
];

export async function initHouse(canvas, { reduced }) {
  // make sure web fonts are ready before drawing text into textures
  try { await document.fonts.ready; } catch { /* ignore */ }

  const mobile = isMobile();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(8.4, 6.8, 10.4);

  // lights
  scene.add(new THREE.HemisphereLight(0xffeee6, 0x2a1010, 2.2));
  const sun = new THREE.DirectionalLight(0xfff4ec, 3.0);
  sun.position.set(4, 8, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 });
  scene.add(sun);
  const warm = new THREE.PointLight(0xff8a5a, 14, 14, 1.2);
  warm.position.set(0, 1.4, 0);
  scene.add(warm);

  // ground: shadow catcher and glowing ring
  const ground = new THREE.Mesh(new THREE.CircleGeometry(6, 64), new THREE.ShadowMaterial({ opacity: 0.45 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  scene.add(ground);
  const ring = new THREE.Mesh(new THREE.RingGeometry(3.05, 3.12, 96),
    new THREE.MeshBasicMaterial({ color: CORAL, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.005;
  scene.add(ring);

  // materials
  const M = {
    wall: new THREE.MeshStandardMaterial({ color: 0x5d4f57, roughness: 0.9 }),
    wallTop: new THREE.MeshStandardMaterial({ color: 0x4a3e44, roughness: 0.8 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x8a4a2e, roughness: 0.7 }),
    fabric: new THREE.MeshStandardMaterial({ color: 0x3b3f52, roughness: 1 }),
    sheet: new THREE.MeshStandardMaterial({ color: 0xe9e2da, roughness: 1 }),
    coral: new THREE.MeshStandardMaterial({ color: CORAL, roughness: 0.55 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x111014, roughness: 0.6 }),
    window: new THREE.MeshBasicMaterial({ color: 0xffb56b }),
    floors: [0x7a5a4c, 0x4f5566, 0x6e5163, 0x4c6359].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1 })),
  };
  const box = (w, h, d, mat, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y + h / 2, z); m.castShadow = true; m.receiveShadow = true;
    return m;
  };

  // four rooms, each its own group so they can drift apart
  const W = 2, D = 1.5, H = 0.85, T = 0.07;
  const house = new THREE.Group();
  scene.add(house);
  const rooms = [];
  const quads = [[-1, 1], [1, 1], [-1, -1], [1, -1]]; // [sx, sz]
  quads.forEach(([sx, sz], i) => {
    const g = new THREE.Group();
    g.userData = { sx, sz };
    g.position.set(sx * W / 2, 0, sz * D / 2);
    g.add(box(W, 0.08, D, M.floors[i], 0, 0, 0));
    const wallY = 0.08;
    // four walls (with a doorway gap on the inner x wall)
    g.add(box(W, H, T, M.wall, 0, wallY, -D / 2 + T / 2));
    g.add(box(W, H, T, M.wall, 0, wallY, D / 2 - T / 2));
    g.add(box(T, H, D, M.wall, -W / 2 + T / 2, wallY, 0));
    g.add(box(T, H, D * 0.3, M.wall, W / 2 - T / 2, wallY, -D * 0.35));
    g.add(box(T, H, D * 0.3, M.wall, W / 2 - T / 2, wallY, D * 0.35));
    if (sx > 0) { // the doorway should face the inside of the house
      g.children.slice(-2).forEach((m) => { m.position.x *= -1; });
      g.children[3].position.x *= -1;
    }
    // lit windows on the outside walls
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.32), M.window);
    win.position.set(0, wallY + H * 0.55, sz * (D / 2 + 0.002));
    if (sz < 0) win.rotation.y = Math.PI;
    g.add(win);
    const win2 = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.32), M.window);
    win2.position.set(sx * (W / 2 + 0.002), wallY + H * 0.55, 0);
    win2.rotation.y = sx * Math.PI / 2;
    g.add(win2);

    // furniture
    if (i === 0) { // kitchen
      g.add(box(1.2, 0.42, 0.32, M.sheet, -0.2, 0.08, D / 2 - 0.26));
      g.add(box(0.7, 0.04, 0.5, M.wood, 0.1, 0.42, -0.15));
      g.add(box(0.06, 0.34, 0.06, M.wood, 0.1, 0.08, -0.15));
      g.add(box(0.18, 0.22, 0.18, M.coral, -0.4, 0.08, -0.15));
      g.add(box(0.18, 0.22, 0.18, M.coral, 0.6, 0.08, -0.15));
    } else if (i === 1) { // lounge
      g.add(box(1.1, 0.22, 0.4, M.fabric, 0.1, 0.08, D / 2 - 0.3));
      g.add(box(1.1, 0.3, 0.12, M.fabric, 0.1, 0.08, D / 2 - 0.13));
      g.add(box(0.6, 0.1, 0.35, M.wood, 0.1, 0.08, -0.05));
      g.add(box(0.8, 0.45, 0.05, M.dark, 0.1, 0.3, -D / 2 + 0.12));
    } else { // bedrooms
      const s = i === 2 ? 1 : -1;
      g.add(box(0.62, 0.2, 1.05, M.wood, s * -0.55, 0.08, 0));
      g.add(box(0.58, 0.08, 1.0, M.sheet, s * -0.55, 0.28, 0));
      g.add(box(0.42, 0.08, 0.2, M.sheet, s * -0.55, 0.36, sz * 0.36));
      g.add(box(0.5, 0.03, 0.3, M.wood, s * 0.45, 0.5, sz * 0.42));
      g.add(box(0.12, 0.1, 0.12, M.coral, s * 0.45, 0.53, sz * 0.42));
    }
    house.add(g); rooms.push(g);
  });

  // gable roof with a chimney and an antenna (a nod to the renders)
  const roof = new THREE.Group();
  const roofTop = 0.08 + H;
  const slope = Math.atan2(0.75, D);
  const panelLen = Math.hypot(D, 0.75) + 0.1;
  [-1, 1].forEach((s) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(W * 2 + 0.3, 0.07, panelLen), M.coral);
    p.castShadow = true;
    p.rotation.x = s * slope;
    p.position.set(0, 0.375, s * D / 2);
    roof.add(p);
  });
  const chim = box(0.25, 0.55, 0.25, M.wallTop, 1.2, 0.2, -0.5); roof.add(chim);
  const ant = box(0.02, 0.6, 0.02, M.dark, -1.4, 0.4, 0.2); roof.add(ant);
  roof.position.y = roofTop;
  house.add(roof);

  // orbiting cards
  const cards = CARDS.map((cfg, i) => {
    const mat = new THREE.MeshBasicMaterial({ map: cardTexture(cfg), transparent: true, side: THREE.DoubleSide, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.85, 0.723), mat);
    mesh.userData = { a: (i / CARDS.length) * Math.PI * 2, y: 1.1 + (i % 3) * 0.55, r: 2.75 + (i % 2) * 0.3 };
    mesh.renderOrder = 2;
    scene.add(mesh);
    return mesh;
  });

  // rising coins
  const coinGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.035, 28);
  const coinMat = new THREE.MeshStandardMaterial({ color: 0xffc04d, metalness: 0.7, roughness: 0.3, emissive: 0x3a2000 });
  const coins = Array.from({ length: mobile ? 6 : 10 }, (_, i) => {
    const c = new THREE.Mesh(coinGeo, coinMat);
    c.rotation.x = Math.PI / 2;
    c.userData = { phase: i / 10, x: (Math.random() - 0.5) * 2.6, z: (Math.random() - 0.5) * 1.8, spin: 1 + Math.random() * 2 };
    c.castShadow = true;
    scene.add(c);
    return c;
  });

  // controls (mouse only — on touch screens the canvas must not trap scrolling)
  let controls = null;
  if (!mobile) {
    controls = new OrbitControls(camera, canvas);
    Object.assign(controls, { enableZoom: false, enablePan: false, enableDamping: true, dampingFactor: 0.06, autoRotate: !reduced, autoRotateSpeed: 0.9, minPolarAngle: 0.55, maxPolarAngle: 1.25 });
    controls.target.set(0, 0.7, 0);
    canvas.addEventListener('pointerdown', () => document.querySelector('.cursor')?.classList.add('is-drag'));
    addEventListener('pointerup', () => document.querySelector('.cursor')?.classList.remove('is-drag'));
  }
  camera.lookAt(0, 0.7, 0);

  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 1 ? 40 : 32;
    camera.updateProjectionMatrix();
  };
  resize();
  new ResizeObserver(resize).observe(canvas);

  const state = { open: 0 };
  let open = 0, spin = 0;
  makeLoop(canvas, (dt, t) => {
    open += (state.open - open) * Math.min(1, dt * 4);
    const e = open * open * (3 - 2 * open);
    roof.position.y = roofTop + e * 1.9;
    roof.rotation.z = e * 0.12;
    roof.rotation.x = -e * 0.08;
    rooms.forEach((r) => {
      const { sx, sz } = r.userData;
      r.position.x = sx * (W / 2 + e * 0.6);
      r.position.z = sz * (D / 2 + e * 0.45);
      r.position.y = e * 0.08 * (1 + Math.sin(t * 1.5 + sx + sz * 2));
    });
    warm.intensity = 14 + Math.sin(t * 7.3) * 0.4 + Math.sin(t * 13.1) * 0.3;

    cards.forEach((c) => {
      const u = c.userData;
      const a = u.a + t * (reduced ? 0 : 0.18);
      c.position.set(Math.cos(a) * u.r, u.y + Math.sin(t * 1.2 + u.a * 3) * 0.12, Math.sin(a) * u.r * 0.8);
      c.quaternion.copy(camera.quaternion);
    });
    coins.forEach((c) => {
      const u = c.userData;
      const k = (u.phase + t * 0.12) % 1;
      c.position.set(u.x * (1 - k * 0.3), 0.3 + k * 3.2, u.z * (1 - k * 0.3));
      c.rotation.z = t * u.spin;
      c.scale.setScalar(Math.sin(k * Math.PI));
      c.visible = !reduced;
    });

    if (controls) controls.update();
    else {
      spin += dt * (reduced ? 0 : 0.25);
      camera.position.set(Math.sin(spin + 0.7) * 14.5, 8, Math.cos(spin + 0.7) * 14.5);
      camera.lookAt(0, 0.7, 0);
    }
    renderer.render(scene, camera);
  });

  return state;
}
