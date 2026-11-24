// Hero: a live, shader-drawn version of the black sun from the Blender renders.
// Wavy red/white corona rings, a spotted red sky, cursor ripples, and a scroll
// "zoom" that lets the disc swallow the screen.
import * as THREE from 'three';
import { makeLoop, pointer } from './util.js';

const frag = /* glsl */`
precision highp float;
uniform vec2  uRes;
uniform float uTime;
uniform vec2  uMouse;   // -1..1
uniform float uZoom;    // 0..1 scroll progress
varying vec2 vUv;

float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y);
}
float fbm(vec2 p){ float v = 0.0, a = 0.5; for(int i=0;i<4;i++){ v += a*noise(p); p = p*2.03 + 7.1; a *= 0.5; } return v; }

// Dark spots in the sky (like the bokeh blobs in the render)
float spots(vec2 p, float t){
  p += vec2(t*0.015, -t*0.01);
  vec2 g = floor(p), f = fract(p);
  float d = 1.0;
  for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){
    vec2 o = vec2(x,y);
    vec2 r = o + vec2(hash(g+o), hash(g+o+17.0)) - f;
    float s = 0.18 + 0.22*hash(g+o+3.0);
    d = min(d, length(r)/s);
  }
  return 1.0 - smoothstep(0.85, 1.0, d);
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*uRes) / uRes.y;
  float t = uTime;
  float z = smoothstep(0.0, 1.0, uZoom);

  vec2 p = uv - vec2(0.0, 0.05) - uMouse*0.025*(1.0-z);
  float R = mix(0.36, 1.6, z*z*z);
  float r = length(p);
  float a = atan(p.y, p.x);
  vec2 dir = p / max(r, 1e-4);

  // cursor ripple
  vec2 m = uMouse * vec2(uRes.x/uRes.y, 1.0) * 0.5;
  float md = length(uv - m);
  float ripple = 0.02*sin(md*40.0 - t*4.0) * exp(-md*4.0);

  // warp the radius with smooth noise (sampled on the unit circle so there is
  // no seam) — gives the wobbly, hand-drawn rings of the render
  float d = r - R;
  float warp = 0.07*(fbm(dir*2.2 + vec2(r*3.0 - t*0.12, t*0.05)) - 0.5)
             + 0.018*(noise(dir*9.0 + r*14.0 - t*0.3) - 0.5)
             + ripple;
  float rr = d + warp*smoothstep(0.0, 0.1, d);

  // concentric bands
  float b = 0.5 + 0.5*sin(rr*30.0 - t*0.9);
  float env = exp(-max(d,0.0)*2.6);

  vec3 sky   = vec3(0.50, 0.035, 0.02);
  vec3 red   = vec3(1.0, 0.16, 0.07);
  vec3 white = vec3(1.0, 0.92, 0.88);

  // sky + spots
  vec2 sp = uv*vec2(6.0, 6.0);
  float spot = spots(sp, t) * smoothstep(0.35, 0.8, d);
  vec3 col = sky * (0.75 + 0.25*fbm(uv*3.0 + t*0.05));
  col *= 1.0 - 0.55*spot;

  // bands fade out with distance
  float redBand   = smoothstep(0.25, 0.55, b) * env;
  float whiteBand = smoothstep(0.78, 0.96, b) * env * env;
  col = mix(col, red, redBand*0.95);
  col = mix(col, white, whiteBand*0.9);

  // hot white halo hugging the disc and a thin red rim
  float halo = exp(-max(d,0.0)*14.0);
  col = mix(col, white, halo*0.95);
  col = mix(col, red*1.2, exp(-abs(d)*160.0));

  // the disc itself
  float disc = 1.0 - smoothstep(-0.002, 0.003, d);
  vec3 inner = vec3(0.012, 0.0, 0.0) + vec3(0.25,0.02,0.01)*exp((d)*60.0);
  col = mix(col, inner, disc);

  // vignette + fade to black as we zoom in
  float vig = 1.0 - smoothstep(0.3, 1.4, length(uv*vec2(0.8,1.0)));
  col *= mix(0.55, 1.0, vig);
  col = mix(col, vec3(0.0), smoothstep(0.75, 1.0, uZoom));

  // a touch of grain
  col += (hash(gl_FragCoord.xy + t) - 0.5)*0.03;
  gl_FragColor = vec4(col, 1.0);
}`;

export function initSun(canvas, { reduced }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const uniforms = {
    uRes: { value: new THREE.Vector2() },
    uTime: { value: 0 },
    uMouse: { value: new THREE.Vector2() },
    uZoom: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, fragmentShader: frag,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  });
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));

  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const dpr = Math.min(window.devicePixelRatio, w < 700 ? 1 : 1.5);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    uniforms.uRes.value.set(w * dpr, h * dpr);
  };
  resize();
  window.addEventListener('resize', resize);

  const target = new THREE.Vector2();
  const state = { zoom: 0 };
  makeLoop(canvas, (dt, t) => {
    target.set(pointer.nx, pointer.ny);
    uniforms.uMouse.value.lerp(target, Math.min(1, dt * 3));
    uniforms.uTime.value = reduced ? 4.0 : t;
    uniforms.uZoom.value = state.zoom;
    renderer.render(scene, camera);
  }, { once: reduced });

  return state;
}
