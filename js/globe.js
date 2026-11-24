// Codsquad: a dotted 3D globe with glowing, pulsing "fishing effort" hotspots
// hugging the coastlines (like the AIS heatmap in the app), schools of fish
// circling the planet, and fly-to buttons for each region the app supports.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { makeLoop, isMobile } from './util.js';

const MASK_URL = 'https://cdn.jsdelivr.net/npm/three-globe@2.31.0/example/img/earth-water.png';

export const REGIONS = {
  world:      { name: 'Whole world',      lat: 22,  lon: 10,   d: 3.5 },
  northsea:   { name: 'North Sea',        lat: 56,  lon: 3,    d: 2.75 },
  barents:    { name: 'Barents Sea',      lat: 72,  lon: 38,   d: 2.75 },
  med:        { name: 'Mediterranean',    lat: 38,  lon: 15,   d: 2.75 },
  westafrica: { name: 'West Africa',      lat: 13,  lon: -17,  d: 2.75 },
  grandbanks: { name: 'Grand Banks',      lat: 46,  lon: -50,  d: 2.75 },
  gulf:       { name: 'Gulf of Mexico',   lat: 25,  lon: -90,  d: 2.75 },
  peru:       { name: 'Peru & Chile',     lat: -18, lon: -75,  d: 2.75 },
  patagonia:  { name: 'Patagonian Shelf', lat: -45, lon: -62,  d: 2.75 },
  ecs:        { name: 'East China Sea',   lat: 30,  lon: 125,  d: 2.75 },
  scs:        { name: 'South China Sea',  lat: 14,  lon: 114,  d: 2.75 },
};

// [lat, lon, weight] — rough centres of heavy fishing effort
const HOTSPOTS = [
  [30, 124, 2.6], [36, 122, 1.6], [14, 112, 1.8], [10, 107, 1.2], [10, 101, 0.9], [35, 129, 0.9], [38, 142, 1.0],
  [-4, 112, 1.2], [-6, 120, 0.7], [16, 72, 0.9], [10, 76, 0.6], [56, 3, 1.3], [60, 4, 0.7], [66, 12, 0.8],
  [71, 30, 0.9], [74, 45, 0.5], [51, -9, 0.7], [64, -21, 0.6], [43, -9, 0.6], [39, 15, 0.8], [41, 5, 0.6], [43, 30, 0.5],
  [20, -17, 0.9], [9, -15, 0.7], [5, -2, 0.5], [-30, 16, 0.5], [-34, 20, 0.5], [46, -52, 0.9], [42, -68, 0.7],
  [28, -90, 0.8], [22, -88, 0.4], [-12, -78, 1.3], [-28, -72, 0.7], [-44, -61, 0.9], [-50, -66, 0.5], [57, -160, 0.6],
  [48, -126, 0.5], [-42, 174, 0.4], [-36, 150, 0.4], [6, 80, 0.4], [26, 52, 0.4], [-20, 40, 0.3],
];

function ll2v(lat, lon, r = 1) {
  const phi = (90 - lat) * Math.PI / 180, th = (lon + 180) * Math.PI / 180;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th));
}

function loadMask() {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const w = 720, h = 360;
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0, w, h);
      const data = g.getImageData(0, 0, w, h).data;
      resolve((lat, lon) => {
        const x = Math.floor(((lon + 180) / 360) * w) % w;
        const y = Math.min(h - 1, Math.max(0, Math.floor(((90 - lat) / 180) * h)));
        return data[(y * w + ((x + w) % w)) * 4] < 128; // dark = land
      });
    };
    img.onerror = () => resolve(null);
    img.src = MASK_URL;
  });
}

const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

export async function initGlobe(canvas, { reduced, onRegion }) {
  const mobile = isMobile();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  const startDir = ll2v(REGIONS.world.lat, REGIONS.world.lon).normalize();
  camera.position.copy(startDir).multiplyScalar(REGIONS.world.d);
  camera.lookAt(0, 0, 0);
  const px = Math.min(devicePixelRatio, mobile ? 1.5 : 2);

  const globe = new THREE.Group();
  scene.add(globe);

  // ocean body (also occludes the far side)
  globe.add(new THREE.Mesh(new THREE.SphereGeometry(0.995, 64, 64),
    new THREE.MeshBasicMaterial({ color: 0x06121c })));

  // atmosphere glow
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(1.13, 64, 64), new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    vertexShader: 'varying vec3 vN; varying vec3 vP; void main(){ vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.0); vP = mv.xyz; gl_Position = projectionMatrix*mv; }',
    fragmentShader: 'varying vec3 vN; varying vec3 vP; void main(){ float f = pow(clamp(-dot(vN, normalize(-vP)) * 2.2, 0.0, 1.0), 3.0); gl_FragColor = vec4(vec3(0.18,0.9,0.8)*f*0.55, 1.0); }',
  }));
  scene.add(atmo);

  // graticule
  const gratMat = new THREE.LineBasicMaterial({ color: 0x2ee6c9, transparent: true, opacity: 0.07 });
  for (let lat = -60; lat <= 60; lat += 30) {
    const pts = []; for (let lon = -180; lon <= 180; lon += 4) pts.push(ll2v(lat, lon, 1.001));
    globe.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gratMat));
  }
  for (let lon = -180; lon < 180; lon += 30) {
    const pts = []; for (let lat = -90; lat <= 90; lat += 4) pts.push(ll2v(lat, lon, 1.001));
    globe.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gratMat));
  }

  const pointVert = /* glsl */`
    attribute float aSize; attribute float aPhase; attribute vec3 aColor;
    uniform float uTime; uniform float uPx; uniform float uPulse;
    varying vec3 vColor; varying float vFace;
    void main(){
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vec3 n = normalize(normalMatrix * normalize(position));
      vFace = smoothstep(-0.1, 0.35, dot(n, normalize(-mv.xyz)));
      float pulse = 1.0 + uPulse * 0.55 * sin(uTime * 2.2 + aPhase * 6.283);
      vColor = aColor;
      gl_PointSize = aSize * pulse * uPx * (3.0 / -mv.z);
      gl_Position = projectionMatrix * mv;
    }`;

  // land dots
  const isLand = await loadMask();
  if (isLand) {
    const N = mobile ? 9000 : 18000;
    const pos = [], col = [], size = [], phase = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = golden * i;
      const v = new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r);
      const lat = Math.asin(v.y) * 180 / Math.PI;
      const lon = (Math.atan2(v.z, -v.x) * 180 / Math.PI) - 180;
      const lonN = ((lon + 540) % 360) - 180;
      if (!isLand(lat, lonN)) continue;
      const p = ll2v(lat, lonN, 1.002);
      pos.push(p.x, p.y, p.z);
      const k = 0.75 + Math.random() * 0.25;
      col.push(0.42 * k, 0.56 * k, 0.66 * k);
      size.push(mobile ? 3.2 : 2.6); phase.push(0);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.Float32BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.Float32BufferAttribute(size, 1));
    geo.setAttribute('aPhase', new THREE.Float32BufferAttribute(phase, 1));
    globe.add(new THREE.Points(geo, new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPx: { value: px }, uPulse: { value: 0 } },
      vertexShader: pointVert, transparent: true,
      fragmentShader: 'varying vec3 vColor; varying float vFace; void main(){ vec2 c = gl_PointCoord-0.5; if(dot(c,c)>0.25) discard; gl_FragColor = vec4(vColor, vFace); }',
    })));
  }

  // fishing hotspots: points in water, close to a coast
  const coastal = (lat, lon) => {
    if (!isLand) return true;
    if (isLand(lat, lon)) return false;
    for (let a = 0; a < 8; a++) {
      const r = 2.2 + Math.random() * 2.5;
      if (isLand(lat + Math.sin(a * 0.785) * r, lon + Math.cos(a * 0.785) * r)) return true;
    }
    return Math.random() < 0.06;
  };
  const hp = [], hc = [], hs = [], hph = [];
  const cyan = new THREE.Color(0x2ee6c9), white = new THREE.Color(0xd8fff8);
  HOTSPOTS.forEach(([lat, lon, w]) => {
    const n = Math.round(w * (mobile ? 90 : 160));
    for (let i = 0, tries = 0; i < n && tries < n * 30; tries++) {
      const la = lat + gauss() * 7, lo = lon + gauss() * 9;
      if (la > 82 || la < -70 || !coastal(la, lo)) continue;
      const p = ll2v(la, lo, 1.006);
      hp.push(p.x, p.y, p.z);
      const c = cyan.clone().lerp(white, Math.random() ** 3 * 0.7);
      hc.push(c.r, c.g, c.b);
      hs.push((mobile ? 5 : 4) + Math.random() * 6 * w ** 0.3);
      hph.push(Math.random());
      i++;
    }
  });
  const hGeo = new THREE.BufferGeometry();
  hGeo.setAttribute('position', new THREE.Float32BufferAttribute(hp, 3));
  hGeo.setAttribute('aColor', new THREE.Float32BufferAttribute(hc, 3));
  hGeo.setAttribute('aSize', new THREE.Float32BufferAttribute(hs, 1));
  hGeo.setAttribute('aPhase', new THREE.Float32BufferAttribute(hph, 1));
  const hMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPx: { value: px }, uPulse: { value: reduced ? 0 : 1 } },
    vertexShader: pointVert, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    fragmentShader: 'varying vec3 vColor; varying float vFace; void main(){ vec2 c = gl_PointCoord-0.5; float d = length(c); float a = 1.0 - smoothstep(0.0, 0.5, d); a = a*a*0.75 + (1.0 - smoothstep(0.05, 0.16, d))*0.6; gl_FragColor = vec4(vColor * a * vFace, 1.0); }',
  });
  globe.add(new THREE.Points(hGeo, hMat));

  // selection ping
  const ping = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 64),
    new THREE.MeshBasicMaterial({ color: 0x2ee6c9, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  ping.visible = false;
  globe.add(ping);
  let pingT = 1;

  // schools of fish circling the planet
  const fishGeo = new THREE.ConeGeometry(0.008, 0.036, 5).rotateX(Math.PI / 2);
  const schools = Array.from({ length: 4 }, (_, i) => ({
    axis: new THREE.Vector3(Math.random() - 0.5, 1.4, Math.random() - 0.5).normalize(),
    r: 1.14 + i * 0.05, speed: (0.12 + Math.random() * 0.1) * (i % 2 ? 1 : -1), off: Math.random() * 6.28,
  }));
  const perSchool = mobile ? 18 : 34;
  const fish = new THREE.InstancedMesh(fishGeo, new THREE.MeshBasicMaterial({ color: 0xbffcf2, transparent: true, opacity: 0.85 }), schools.length * perSchool);
  const fishData = Array.from({ length: schools.length * perSchool }, () => ({ da: Math.random() * 0.5, dh: gauss() * 0.06, dr: gauss() * 0.03, wob: Math.random() * 6.28 }));
  scene.add(fish);
  const dummy = new THREE.Object3D(), tmp = new THREE.Vector3(), q = new THREE.Quaternion(), ref = new THREE.Vector3();

  // controls
  let controls = null;
  if (!mobile) {
    controls = new OrbitControls(camera, canvas);
    Object.assign(controls, { enableZoom: false, enablePan: false, enableDamping: true, dampingFactor: 0.07, rotateSpeed: 0.6, autoRotate: !reduced, autoRotateSpeed: 0.5 });
  }

  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setPixelRatio(px);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  addEventListener('resize', resize);

  // fly the camera to a region along a great-circle arc
  let resumeTimer = 0, flying = null;
  function flyTo(key) {
    const R = REGIONS[key]; if (!R) return;
    const from = camera.position.clone(), fromLen = from.length();
    const dir = ll2v(R.lat, R.lon).normalize();
    const rot = new THREE.Quaternion().setFromUnitVectors(from.clone().normalize(), dir);
    flying = { from, fromLen, rot, k: 0, toLen: R.d };
    if (controls) controls.autoRotate = false;
    clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => { if (controls && !reduced) controls.autoRotate = true; }, 6000);
    if (key !== 'world') {
      ping.position.copy(dir).multiplyScalar(1.01);
      ping.lookAt(dir.clone().multiplyScalar(2));
      ping.visible = true; pingT = 0;
    } else ping.visible = false;
    onRegion?.(R.name);
  }

  const idQ = new THREE.Quaternion();
  makeLoop(canvas, (dt, t) => {
    hMat.uniforms.uTime.value = t;
    if (flying) {
      flying.k = Math.min(1, flying.k + dt / (reduced ? 0.01 : 1.6));
      const e = flying.k < 0.5 ? 4 * flying.k ** 3 : 1 - (-2 * flying.k + 2) ** 3 / 2;
      q.copy(idQ).slerp(flying.rot, e);
      const len = THREE.MathUtils.lerp(flying.fromLen, flying.toLen, e) + Math.sin(e * Math.PI) * 0.6;
      camera.position.copy(flying.from).normalize().applyQuaternion(q).multiplyScalar(len);
      camera.lookAt(0, 0, 0);
      if (flying.k >= 1) flying = null;
    } else if (controls) {
      controls.update();
    } else if (!reduced) {
      camera.position.applyAxisAngle(ref.set(0, 1, 0), dt * 0.12);
      camera.lookAt(0, 0, 0);
    }

    if (ping.visible) {
      pingT = (pingT + dt * 0.7) % 1;
      ping.scale.setScalar(0.015 + pingT * 0.07);
      ping.material.opacity = 1 - pingT;
    }

    let i = 0;
    schools.forEach((s) => {
      for (let j = 0; j < perSchool; j++, i++) {
        const f = fishData[i];
        const a = s.off + t * s.speed + f.da * Math.sign(s.speed) * -1;
        // build a point on a tilted circle
        q.setFromAxisAngle(s.axis, a);
        tmp.set(1, f.dh + Math.sin(t * 3 + f.wob) * 0.01, 0).normalize().multiplyScalar(s.r + f.dr).applyQuaternion(q);
        // tangent = axis × position
        ref.copy(s.axis).cross(tmp).normalize().multiplyScalar(Math.sign(s.speed));
        dummy.position.copy(tmp);
        dummy.lookAt(tmp.clone().add(ref));
        dummy.updateMatrix();
        fish.setMatrixAt(i, dummy.matrix);
      }
    });
    fish.instanceMatrix.needsUpdate = true;

    renderer.render(scene, camera);
  });

  return { flyTo };
}
