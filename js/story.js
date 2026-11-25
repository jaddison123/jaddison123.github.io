// Eclipse: the three renders as a pinned, full-screen scroll sequence.
// Shots change through an expanding eclipse wipe with a burning corona edge.
// Each shot gets a small living detail: lantern flicker, puddle ripples, corona pulse.
import * as THREE from 'three';
import { makeLoop, pointer, isMobile } from './util.js';

const frag = /* glsl */`
precision highp float;
uniform sampler2D t0, t1, t2;
uniform vec2 uRes;
uniform float uTime, uProgress;
uniform vec2 uMouse;
varying vec2 vUv;

float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y); }

// contain-fit UVs for a 16:9 image: the whole render is always visible,
// letterboxed if the screen shape differs, with a gentle mouse parallax
vec2 fitUv(vec2 uv, float scale){
  float sa = uRes.x/uRes.y, ia = 16.0/9.0;
  vec2 s = sa > ia ? vec2(sa/ia, 1.0) : vec2(1.0, ia/sa);
  uv = (uv - 0.5) * s / scale + 0.5;
  uv += uMouse * 0.006;
  return uv;
}

vec3 shot(int i, vec2 sUv){
  float s = uProgress - float(i);
  // a slow drift between 94% and 97% size, so nothing is ever cropped
  float scale = 0.955 + 0.015*clamp(s, -1.0, 1.0);
  vec2 uv = fitUv(sUv, scale);
  vec3 col;
  if (i == 0) {
    col = texture2D(t0, uv).rgb;
    // lantern flicker
    float fl = 0.6*sin(uTime*11.0) + 0.4*sin(uTime*23.7 + 1.3) + 0.5*(noise(vec2(uTime*6.0, 0.0)) - 0.5);
    float d = length((uv - vec2(0.414, 0.713)) * vec2(16.0/9.0, 1.0));
    col *= 1.0 + 0.05*fl + (0.22 + 0.12*fl)*exp(-d*d*28.0);
  } else if (i == 1) {
    // puddle ripples
    float m = smoothstep(0.31, 0.36, uv.x) * (1.0 - smoothstep(0.6, 0.65, uv.x)) * smoothstep(0.17, 0.21, uv.y) * (1.0 - smoothstep(0.38, 0.42, uv.y));
    uv.x += m * 0.0035 * sin(uv.y*240.0 + uTime*3.0) * (0.6 + 0.4*sin(uv.x*40.0 + uTime));
    uv.y += m * 0.0015 * sin(uv.x*180.0 - uTime*2.0);
    col = texture2D(t1, uv).rgb;
  } else {
    col = texture2D(t2, uv).rgb;
    // corona pulse: the glow around the eclipse breathes and flickers like plasma
    vec2 cq = (uv - vec2(0.5, 0.646)) * vec2(16.0/9.0, 1.0);
    float d = length(cq);
    float red = clamp(col.r - max(col.g, col.b), 0.0, 1.0);
    float flick = noise(vec2(atan(cq.y, cq.x) * 6.0, uTime * 0.8)) * 0.6 + 0.4 + 0.25*sin(uTime*1.3);
    float rim = smoothstep(0.43, 0.46, d) * (1.0 - smoothstep(0.5, 0.68, d));
    col += col * red * 0.55 * flick * rim;
  }
  // soft letterbox outside the image
  float e = 0.002;
  float inb = smoothstep(-e, 0.0, uv.x) * (1.0 - smoothstep(1.0, 1.0 + e, uv.x))
            * smoothstep(-e, 0.0, uv.y) * (1.0 - smoothstep(1.0, 1.0 + e, uv.y));
  return col * inb;
}

void main(){
  vec2 uv = vUv;
  float p = clamp(uProgress, 0.0, 2.0);
  float idx = min(floor(p), 1.0);
  float tr = smoothstep(0.55, 0.98, p - idx);
  if (p >= 2.0) tr = 1.0;

  // aspect-correct coords for the wipe circle
  vec2 q = (uv - vec2(0.5, 0.55)) * vec2(uRes.x/uRes.y, 1.0);
  float a = atan(q.y, q.x);
  float R = tr * 1.45;
  float d = length(q) - R + 0.03*noise(vec2(a*5.0, uTime*0.6)) + 0.01*sin(a*30.0 + uTime*2.0);

  vec3 A = idx < 0.5 ? shot(0, uv) : shot(1, uv);
  vec3 B = idx < 0.5 ? shot(1, uv) : shot(2, uv);

  vec3 col = A;
  if (tr > 0.0 && tr < 1.0) {
    // inside the disc: the void, then the next shot emerging from it
    float inside = 1.0 - smoothstep(-0.004, 0.004, d);
    float reveal = 1.0 - smoothstep(-0.22 - 0.3*(1.0-tr), -0.03, d);
    vec3 inner = mix(vec3(0.0), B, reveal);
    col = mix(A, inner, inside);
    // corona on the edge
    float outside = max(d, 0.0);
    float bands = 0.5 + 0.5*sin(outside*140.0 - uTime*4.0 + 6.0*noise(vec2(a*8.0, uTime)));
    float env = exp(-outside*22.0);
    col += vec3(1.0, 0.18, 0.08) * env * (0.5 + 0.5*bands) * 1.4 * (1.0 - inside);
    col += vec3(1.0, 0.9, 0.85) * exp(-outside*90.0) * (1.0 - inside);
    col += vec3(1.0, 0.15, 0.05) * exp(-abs(d)*400.0);
  } else if (tr >= 1.0) {
    col = B;
  }

  // vignette + grain
  vec2 v = uv - 0.5;
  col *= 1.0 - 0.55*dot(v, v)*1.6;
  col += (hash(gl_FragCoord.xy + fract(uTime)*100.0) - 0.5) * 0.045;
  gl_FragColor = vec4(col, 1.0);
}`;

export function initStory(canvas, { reduced }) {
  const small = isMobile();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const loader = new THREE.TextureLoader();
  const suffix = small ? '-960' : '';
  const load = (name) => {
    const t = loader.load(`assets/img/render-${name}${suffix}.webp`, () => loop.renderOnce());
    t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
    return t;
  };
  const uniforms = {
    t0: { value: load('room') }, t1: { value: load('door') }, t2: { value: load('town') },
    uRes: { value: new THREE.Vector2() }, uTime: { value: 0 }, uProgress: { value: 0 }, uMouse: { value: new THREE.Vector2() },
  };
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms, fragmentShader: frag,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  })));

  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const dpr = Math.min(devicePixelRatio, small ? 1.25 : 1.5);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    uniforms.uRes.value.set(w * dpr, h * dpr);
  };
  resize();
  new ResizeObserver(resize).observe(canvas);

  const state = { progress: 0 };
  const target = new THREE.Vector2();
  const loop = makeLoop(canvas, (dt, t) => {
    target.set(pointer.nx, pointer.ny);
    uniforms.uMouse.value.lerp(target, Math.min(1, dt * 2.5));
    uniforms.uTime.value = reduced ? 0 : t;
    uniforms.uProgress.value += (state.progress - uniforms.uProgress.value) * Math.min(1, dt * 6 || 1);
    renderer.render(scene, camera);
  });
  return state;
}
