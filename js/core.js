'use strict';
/* =====================================================================
   core.js — renderer, cahaya, utilitas geometri, material, pemuat aset
   Skrip klasik (bukan module) supaya index.html bisa dibuka dengan klik ganda.
   ===================================================================== */
if (typeof THREE === 'undefined') {
  const f = document.getElementById('fatal');
  f.style.display = 'flex';
  f.textContent = 'three.js gagal dimuat. Sambungkan internet (CDN cdnjs.cloudflare.com) lalu muat ulang halaman.';
  throw new Error('THREE tidak tersedia');
}

/* three.js r128 menganggap warna hex sebagai linear; tanpa koreksi, cat tampak pucat. Semua warna hex dianggap sRGB. */
(function () { const sh = THREE.Color.prototype.setHex; THREE.Color.prototype.setHex = function (h) { sh.call(this, h); return this.convertSRGBToLinear(); }; })();

const QS = new URLSearchParams(location.search);
const OFFLINE = QS.has('offline');        // uji cadangan: anggap semua aset nyata gagal
const PH = 'https://dl.polyhaven.org/file/ph-assets/';

/* ---------- utilitas acak deterministik ---------- */
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rand = mulberry32(20261124);
const rr = (a, b) => a + (b - a) * rand();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

/* ---------- renderer, scene, kamera ---------- */
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa9bccd);
scene.fog = new THREE.Fog(0xb3c3d1, 150, 340);

const camera = new THREE.PerspectiveCamera(56, window.innerWidth / window.innerHeight, 0.12, 700);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);
const ANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy());
const SHADOW_RES = Math.min(4096, renderer.capabilities.maxTextureSize);

/* ---------- cahaya ---------- */
const SUN_DIR = new THREE.Vector3(-26, 46, 36).normalize();
const sun = new THREE.DirectionalLight(0xfff0d9, 1.4);
sun.position.copy(SUN_DIR).multiplyScalar(110).add(new THREE.Vector3(-8, 0, 0));
sun.target.position.set(-8, 0, 0);
sun.castShadow = true;
sun.shadow.mapSize.set(SHADOW_RES, SHADOW_RES);
Object.assign(sun.shadow.camera, { near: 20, far: 260, left: -84, right: 84, top: 70, bottom: -70 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05;
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0xd3e4ff, 0x6a655d, 0.34);
scene.add(hemi);

/* ---------- kanvas dan tekstur prosedural ---------- */
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function cTex(c, srgb = true, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  t.encoding = srgb ? THREE.sRGBEncoding : THREE.LinearEncoding;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = ANISO;
  return t;
}
function blotches(x, w, h, n, r0, r1, rgb, a) {
  for (let i = 0; i < n; i++) {
    const r = rr(r0, r1), gx = rr(0, w), gy = rr(0, h);
    const g = x.createRadialGradient(gx, gy, 0, gx, gy, r);
    g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
    x.fillStyle = g; x.fillRect(gx - r, gy - r, 2 * r, 2 * r);
  }
}
function specks(x, w, h, n, rgb, a, s = 2) { for (let i = 0; i < n; i++) { x.fillStyle = `rgba(${rgb},${rr(a * .3, a)})`; x.fillRect(rr(0, w), rr(0, h), rr(1, s), rr(1, s)); } }

const PROC = {
  concrete() {
    const c = cv(512, 512), x = c.getContext('2d');
    x.fillStyle = '#8d9298'; x.fillRect(0, 0, 512, 512);
    blotches(x, 512, 512, 90, 30, 110, '255,255,255', .05);
    blotches(x, 512, 512, 90, 30, 110, '0,0,0', .06);
    specks(x, 512, 512, 5000, '0,0,0', .12); specks(x, 512, 512, 3500, '255,255,255', .1);
    return cTex(c);
  },
  cladding() {
    const c = cv(256, 256), x = c.getContext('2d');
    for (let i = 0; i < 8; i++) {
      const x0 = i * 32, g = x.createLinearGradient(x0, 0, x0 + 32, 0);
      g.addColorStop(0, '#aeb5bd'); g.addColorStop(.18, '#dfe3e7'); g.addColorStop(.5, '#d2d7dc'); g.addColorStop(.82, '#b4bbc3'); g.addColorStop(1, '#8e969f');
      x.fillStyle = g; x.fillRect(x0, 0, 32, 256);
    }
    blotches(x, 256, 256, 30, 20, 70, '60,70,80', .05);
    return cTex(c);
  },
  wood() {
    const c = cv(256, 256), x = c.getContext('2d');
    x.fillStyle = '#b48a52'; x.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 64) {
      x.fillStyle = `rgba(${rr(0, 40) | 0},${rr(0, 20) | 0},0,${rr(.05, .22)})`; x.fillRect(0, y, 256, 64);
      x.fillStyle = 'rgba(40,24,8,.55)'; x.fillRect(0, y, 256, 2);
    }
    for (let i = 0; i < 160; i++) { x.strokeStyle = `rgba(70,42,14,${rr(.06, .2)})`; x.lineWidth = rr(.5, 1.4); const y = rr(0, 256); x.beginPath(); x.moveTo(rr(-20, 200), y); x.lineTo(rr(60, 280), y + rr(-2, 2)); x.stroke(); }
    return cTex(c);
  },
  asphalt() {
    const c = cv(512, 512), x = c.getContext('2d');
    x.fillStyle = '#44474c'; x.fillRect(0, 0, 512, 512);
    blotches(x, 512, 512, 80, 30, 120, '255,255,255', .035); blotches(x, 512, 512, 80, 30, 120, '0,0,0', .08);
    specks(x, 512, 512, 9000, '255,255,255', .18, 2); specks(x, 512, 512, 6000, '0,0,0', .3, 2);
    return cTex(c);
  },
  /** karton: kraft untuk bahan baku (label biru), putih bercetak untuk barang jadi (label hijau) */
  carton(kind) {
    const c = cv(256, 256), x = c.getContext('2d');
    const raw = kind === 'raw';
    x.fillStyle = raw ? '#b88f58' : '#e7eaed'; x.fillRect(0, 0, 256, 256);
    blotches(x, 256, 256, 26, 20, 80, raw ? '90,60,20' : '120,130,140', .08);
    specks(x, 256, 256, 1400, raw ? '70,45,15' : '90,100,110', .12);
    x.fillStyle = 'rgba(0,0,0,.08)'; x.fillRect(0, 78, 256, 2); x.fillRect(0, 200, 256, 1.5);        // lipatan flap
    x.fillStyle = raw ? 'rgba(225,212,170,.55)' : 'rgba(120,130,140,.18)'; x.fillRect(118, 0, 20, 256); // lakban
    const lc = raw ? '#2f6fe0' : '#16a870';
    x.fillStyle = '#f7f8f9'; x.fillRect(26, 100, 120, 78);
    x.fillStyle = lc; x.fillRect(26, 100, 120, 17);
    x.fillStyle = '#0f172a'; x.font = 'bold 13px sans-serif'; x.fillText(raw ? 'RM-LOT 2411' : 'FG-SKU 7730', 32, 112);
    x.fillStyle = '#0f172a'; for (let bx = 32; bx < 140; bx += 4) x.fillRect(bx, 126, rand() > .45 ? 2.2 : 1, 36);
    if (!raw) { x.fillStyle = '#16a870'; x.fillRect(160, 30, 70, 14); x.fillStyle = '#9aa4ad'; x.fillRect(160, 52, 70, 4); x.fillRect(160, 62, 50, 4); }
    x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(168, 200, 6, 36); x.fillRect(180, 206, 6, 30); // ikon "fragile" kasar
    x.strokeStyle = 'rgba(0,0,0,.12)'; x.lineWidth = 3; x.strokeRect(2, 2, 252, 252);
    return cTex(c);
  },
  hazard() {
    const c = cv(128, 128), x = c.getContext('2d');
    x.fillStyle = '#f2c200'; x.fillRect(0, 0, 128, 128);
    x.fillStyle = '#16181b';
    for (let i = -2; i < 6; i++) { x.beginPath(); x.moveTo(i * 32, 128); x.lineTo(i * 32 + 16, 128); x.lineTo(i * 32 + 16 + 128, 0); x.lineTo(i * 32 + 128, 0); x.fill(); }
    specks(x, 128, 128, 300, '0,0,0', .2);
    return cTex(c);
  },
  belt() {
    const c = cv(64, 128), x = c.getContext('2d');
    x.fillStyle = '#26282c'; x.fillRect(0, 0, 64, 128);
    specks(x, 64, 128, 900, '255,255,255', .06); specks(x, 64, 128, 500, '0,0,0', .3);
    x.fillStyle = 'rgba(0,0,0,.4)'; x.fillRect(0, 0, 64, 3); x.fillStyle = 'rgba(255,255,255,.05)'; x.fillRect(0, 3, 64, 1);
    return cTex(c);
  },
  wireMesh() {
    const c = cv(64, 64), x = c.getContext('2d');
    x.clearRect(0, 0, 64, 64); x.strokeStyle = 'rgba(190,198,206,.95)'; x.lineWidth = 2.2;
    for (let i = 0; i <= 64; i += 8) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 64); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(64, i); x.stroke(); }
    return cTex(c);
  },
  skyGradient() {
    const c = cv(16, 256), x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#5f8fc4'); g.addColorStop(.45, '#a7c3dd'); g.addColorStop(.5, '#e5dccb'); g.addColorStop(.52, '#9aa3a8'); g.addColorStop(1, '#6e7478');
    x.fillStyle = g; x.fillRect(0, 0, 16, 256);
    const t = cTex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
  }
};

/* ---------- papan tanda (ikon sederhana, tanpa aset luar) ---------- */
function signTex(kind, label, sub) {
  const c = cv(256, 256), x = c.getContext('2d');
  const pal = {
    exit: ['#12834b', '#ffffff'], fire: ['#c32a1c', '#ffffff'], ppe: ['#1c5fb0', '#ffffff'],
    warn: ['#f2c200', '#111111'], speed: ['#ffffff', '#c32a1c'], forklift: ['#f2c200', '#111111'],
    first: ['#12834b', '#ffffff'], panel: ['#f2c200', '#111111'], info: ['#1c5fb0', '#ffffff']
  }[kind] || ['#1c5fb0', '#fff'];
  const [bg, fg] = pal;
  x.fillStyle = bg; x.fillRect(0, 0, 256, 256);
  x.strokeStyle = fg; x.lineWidth = 8; x.strokeRect(10, 10, 236, 236);
  x.fillStyle = fg; x.strokeStyle = fg; x.lineCap = 'round'; x.lineJoin = 'round';
  const cx = 128, cy = 102;
  if (kind === 'exit') { // orang berlari ke pintu
    x.beginPath(); x.arc(cx - 6, cy - 44, 12, 0, 7); x.fill();
    x.lineWidth = 12; x.beginPath(); x.moveTo(cx - 6, cy - 28); x.lineTo(cx - 14, cy + 6); x.lineTo(cx + 12, cy + 30); x.moveTo(cx - 14, cy + 6); x.lineTo(cx - 34, cy + 36);
    x.moveTo(cx - 6, cy - 20); x.lineTo(cx + 22, cy - 6); x.moveTo(cx - 6, cy - 20); x.lineTo(cx - 32, cy - 6); x.stroke();
    x.lineWidth = 6; x.strokeRect(cx + 38, cy - 54, 30, 96);
  } else if (kind === 'fire' || kind === 'first') { // APAR / palang P3K
    if (kind === 'fire') { x.fillRect(cx - 18, cy - 30, 36, 74); x.fillRect(cx - 8, cy - 46, 16, 18); x.lineWidth = 7; x.beginPath(); x.moveTo(cx + 8, cy - 42); x.lineTo(cx + 40, cy - 36); x.stroke(); }
    else { x.fillRect(cx - 14, cy - 44, 28, 88); x.fillRect(cx - 44, cy - 14, 88, 28); }
  } else if (kind === 'ppe') { // helm
    x.beginPath(); x.arc(cx, cy + 6, 44, Math.PI, 0); x.fill(); x.fillRect(cx - 54, cy + 6, 108, 14); x.fillRect(cx - 7, cy - 38, 14, 44);
  } else if (kind === 'warn' || kind === 'forklift' || kind === 'panel') { // segitiga peringatan
    x.lineWidth = 12; x.beginPath(); x.moveTo(cx, cy - 56); x.lineTo(cx + 58, cy + 40); x.lineTo(cx - 58, cy + 40); x.closePath(); x.stroke();
    x.font = 'bold 66px sans-serif'; x.textAlign = 'center'; x.fillText(kind === 'panel' ? '⚡' : '!', cx, cy + 30);
  } else if (kind === 'speed') {
    x.lineWidth = 16; x.beginPath(); x.arc(cx, cy, 58, 0, 7); x.stroke();
    x.fillStyle = '#111'; x.font = 'bold 74px sans-serif'; x.textAlign = 'center'; x.fillText(label || '10', cx, cy + 26);
    label = 'BATAS KECEPATAN';
  }
  x.fillStyle = kind === 'speed' ? '#111' : fg; x.textAlign = 'center';
  x.font = 'bold 28px sans-serif'; x.fillText((label || '').toUpperCase().slice(0, 18), 128, 196);
  x.font = '20px sans-serif'; x.fillText((sub || '').slice(0, 26), 128, 226);
  const t = cTex(c, true, false); return t;
}

/* ---------- util geometri: transform, UV, merge, Batcher ---------- */
const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
function xf(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  _e.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
}
function boxUV(g, w, h, d, tile) {
  const uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
    const k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0] / tile, uv.getY(k) * dims[f][1] / tile);
  }
}
function planeUV(g, w, h, tile) {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / tile, uv.getY(i) * h / tile);
}
function mergeGeos(list) {
  let vc = 0, ic = 0;
  for (const g of list) { vc += g.attributes.position.count; ic += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(vc * 3), nor = new Float32Array(vc * 3), uv = new Float32Array(vc * 2);
  const hasCol = !!list[0].attributes.color, col = hasCol ? new Float32Array(vc * 3) : null;
  const idx = vc > 65535 ? new Uint32Array(ic) : new Uint16Array(ic);
  let vo = 0, io = 0;
  for (const g of list) {
    const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv, cnt = p.count;
    pos.set(p.array, vo * 3); nor.set(n.array, vo * 3); if (u) uv.set(u.array, vo * 2); if (hasCol) col.set(g.attributes.color.array, vo * 3);
    if (g.index) { const a = g.index.array; for (let i = 0; i < a.length; i++) idx[io + i] = a[i] + vo; io += a.length; }
    else { for (let i = 0; i < cnt; i++) idx[io + i] = vo + i; io += cnt; }
    vo += cnt; g.dispose();
  }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  m.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  m.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (hasCol) m.setAttribute('color', new THREE.BufferAttribute(col, 3));
  m.setIndex(new THREE.BufferAttribute(idx, 1));
  m.computeBoundingSphere(); m.computeBoundingBox();
  return m;
}
/** Menumpuk banyak bentuk statis lalu menggabungkannya per material: satu draw call per material. */
class Batcher {
  constructor() { this.lists = new Map(); this.count = 0; }
  _add(mat, g, m) { g.applyMatrix4(m); let a = this.lists.get(mat); if (!a) this.lists.set(mat, a = []); a.push(g); this.count++; }
  box(mat, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
    const g = new THREE.BoxGeometry(w, h, d); if (mat.userData.tile) boxUV(g, w, h, d, mat.userData.tile);
    this._add(mat, g, xf(x, y, z, rx, ry, rz)); return this;
  }
  cyl(mat, rt, rb, h, seg, x, y, z, rx = 0, ry = 0, rz = 0, open = false) {
    this._add(mat, new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), xf(x, y, z, rx, ry, rz)); return this;
  }
  sph(mat, r, x, y, z, sx = 1, sy = 1, sz = 1, seg = 14) {
    this._add(mat, new THREE.SphereGeometry(r, seg, Math.max(6, seg >> 1)), xf(x, y, z, 0, 0, 0, sx, sy, sz)); return this;
  }
  plane(mat, w, h, x, y, z, rx = 0, ry = 0, rz = 0) {
    const g = new THREE.PlaneGeometry(w, h); if (mat.userData.tile) planeUV(g, w, h, mat.userData.tile);
    this._add(mat, g, xf(x, y, z, rx, ry, rz)); return this;
  }
  geo(mat, g, m) { this._add(mat, g, m || new THREE.Matrix4()); return this; }
  flush(parent = scene, opt = {}) {
    const out = [];
    for (const [mat, list] of this.lists) {
      const mesh = new THREE.Mesh(mergeGeos(list), mat);
      mesh.castShadow = opt.cast !== undefined ? opt.cast : !mat.userData.noCast;
      mesh.receiveShadow = opt.receive !== undefined ? opt.receive : true;
      parent.add(mesh); out.push(mesh);
    }
    this.lists.clear(); return out;
  }
}

/* ---------- material ---------- */
const M = {};
const IBL = 0.68;
function stdMat(name, p, tile) {
  const m = new THREE.MeshStandardMaterial(Object.assign({ roughness: .6, metalness: 0, envMapIntensity: IBL }, p));
  if (tile) m.userData.tile = tile;
  M[name] = m; return m;
}
function basicMat(name, color, extra) { const m = new THREE.MeshBasicMaterial(Object.assign({ color }, extra)); M[name] = m; return m; }

stdMat('floor', { map: PROC.concrete(), roughness: .62 }, 3.2);
stdMat('slab', { map: PROC.concrete(), color: 0xc9ccd0, roughness: .9 }, 3.2);
stdMat('cladding', { map: PROC.cladding(), roughness: .5, metalness: .55 }, 2);
stdMat('roofMetal', { map: PROC.cladding(), color: 0xd5dae0, roughness: .55, metalness: .5, side: THREE.DoubleSide }, 2);
stdMat('claddingBand', { color: 0x275f9c, roughness: .5, metalness: .4 });
stdMat('asphalt', { map: PROC.asphalt(), roughness: .95 }, 4);
stdMat('paving', { color: 0x9ea2a6, roughness: .9 });
stdMat('wood', { map: PROC.wood(), roughness: .85 }, 1.1);
stdMat('woodDark', { color: 0x6b4a28, roughness: .9 });
stdMat('cartonRaw', { map: PROC.carton('raw'), roughness: .85 });
stdMat('cartonFg', { map: PROC.carton('fg'), roughness: .7 });
stdMat('wrap', { color: 0xdbe9f7, transparent: true, opacity: .13, roughness: .08, metalness: 0, depthWrite: false }); M.wrap.userData.noCast = true;
stdMat('steel', { color: 0xc4c9d0, roughness: .48, metalness: .55 });
stdMat('steelDark', { color: 0x3a4047, roughness: .5, metalness: .6 });
stdMat('steelRaw', { color: 0x8d949c, roughness: .4, metalness: .85 });
stdMat('truss', { color: 0xb7bec8, roughness: .55, metalness: .5 });
stdMat('rackBlue', { color: 0x1d55a6, roughness: .5, metalness: .35 });
stdMat('rackOrange', { color: 0xe4560e, roughness: .45, metalness: .35 });
stdMat('yellow', { color: 0xf1bf00, roughness: .5, metalness: .15 });
stdMat('hazard', { map: PROC.hazard(), roughness: .55 }, .5);
stdMat('red', { color: 0xbf2a1d, roughness: .45, metalness: .2 });
stdMat('green', { color: 0x1f9a58, roughness: .5, metalness: .15 });
stdMat('white', { color: 0xe9ecef, roughness: .45, metalness: .1 });
stdMat('black', { color: 0x15181c, roughness: .75, metalness: .2 });
stdMat('rubber', { color: 0x1a1b1d, roughness: .95 });
stdMat('hub', { color: 0xaeb4bb, roughness: .35, metalness: .8 });
stdMat('glass', { color: 0xa9d6f2, transparent: true, opacity: .22, roughness: .05, metalness: 0, envMapIntensity: 1.4, depthWrite: false }); M.glass.userData.noCast = true;
stdMat('darkGlass', { color: 0x16222f, transparent: true, opacity: .62, roughness: .08, metalness: 0, envMapIntensity: 1.3, depthWrite: false }); M.darkGlass.userData.noCast = true;
stdMat('belt', { map: PROC.belt(), roughness: .9 }, 1);
stdMat('convFrame', { color: 0x7e8892, roughness: .45, metalness: .65 });
stdMat('machine', { color: 0xdfe3e6, roughness: .38, metalness: .25 });
stdMat('machineAccent', { color: 0x0f6d68, roughness: .4, metalness: .3 });
stdMat('robotOrange', { color: 0xf0661a, roughness: .33, metalness: .3 });
stdMat('office', { color: 0xdfe4e8, roughness: .7 });
stdMat('skin', { color: 0xd9a47a, roughness: .7 });
stdMat('skin2', { color: 0x9c6a45, roughness: .7 });
stdMat('jeans', { color: 0x24365e, roughness: .85 });
stdMat('boot', { color: 0x2a2623, roughness: .7 });
stdMat('reflective', { color: 0xdfe6df, roughness: .4, metalness: .2 });
stdMat('duct', { color: 0xc9ced4, roughness: .4, metalness: .7 });
stdMat('pipeBlue', { color: 0x2b66c3, roughness: .4, metalness: .5 });
stdMat('pipeRed', { color: 0xc42d20, roughness: .4, metalness: .5 });
stdMat('pipeGreen', { color: 0x2a9a5a, roughness: .4, metalness: .5 });
stdMat('mesh', { map: PROC.wireMesh(), transparent: true, alphaTest: .3, side: THREE.DoubleSide, roughness: .6, metalness: .5 }); M.mesh.userData.noCast = true;
basicMat('lamp', 0xfff3da); basicMat('led', 0x6fd6ff); basicMat('ledGreen', 0x3dff8c); basicMat('ledRed', 0xff4a3a); basicMat('ledAmber', 0xffb02e);
basicMat('beacon', 0xffa21a); basicMat('laser', 0x37ff95, { transparent: true, opacity: .4, side: THREE.DoubleSide, depthWrite: false });
M.laser.userData.noCast = true;

/* geometri berwarna per-vertex: banyak bagian kecil digabung jadi satu mesh (hemat draw call) */
M.vc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .72, metalness: .05, envMapIntensity: IBL });
function vcGeo(geo, hex, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  geo.applyMatrix4(xf(x, y, z, rx, ry, rz, sx, sy, sz));
  const n = geo.attributes.position.count, c = new THREE.Color(hex), a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[3 * i] = c.r; a[3 * i + 1] = c.g; a[3 * i + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); return geo;
}
function vcMesh(parent, geos, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(mergeGeos(geos), M.vc); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; }

/* ---------- langit ---------- */
const sky = new THREE.Mesh(new THREE.SphereGeometry(460, 40, 20), new THREE.MeshBasicMaterial({ map: PROC.skyGradient(), side: THREE.BackSide, fog: false, depthWrite: false }));
sky.scale.x = -1; sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky);

/* ---------- lingkungan (IBL): cadangan prosedural dulu, HDRI nyata menyusul ---------- */
const pmrem = new THREE.PMREMGenerator(renderer);
function fallbackEnv() {
  const s = new THREE.Scene();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(60, 24, 12), new THREE.MeshBasicMaterial({ map: PROC.skyGradient(), side: THREE.BackSide }));
  dome.scale.x = -1; s.add(dome);
  const lampM = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 5, 4.6), side: THREE.DoubleSide });
  for (let i = 0; i < 6; i++) { const p = new THREE.Mesh(new THREE.PlaneGeometry(14, 3), lampM); p.position.set((i % 3 - 1) * 22, 28, (i < 3 ? -12 : 12)); p.rotation.x = Math.PI / 2; s.add(p); }
  const t = pmrem.fromScene(s, 0.02).texture; return t;
}
scene.environment = fallbackEnv();

/* =====================================================================
   AssetManager: muat bertahap dari Poly Haven (CC0). Jika gagal -> cadangan.
   ===================================================================== */
const AM = {
  q: [], pend: 0, max: 5, total: 0, done: 0, fail: 0, failed: [], t0: performance.now(), doneTimer: null,
  tl: new THREE.TextureLoader(), rgbe: new THREE.RGBELoader(), modelCache: {}, logs: [],
  run(label, prio, job) {
    this.total++; this._ui();
    return new Promise(res => {
      this.q.push({ label, prio, job, res }); this.q.sort((a, b) => a.prio - b.prio); this._pump();
    });
  },
  _pump() {
    while (this.pend < this.max && this.q.length) {
      const t = this.q.shift(); this.pend++;
      const fin = v => { this.pend--; this.done++; if (v == null) { this.fail++; this.failed.push(t.label); } this._ui(); t.res(v); this._pump(); };
      if (OFFLINE) { setTimeout(() => fin(null), 30); continue; }
      let p; try { p = t.job(); } catch (e) { p = Promise.reject(e); }
      p.then(fin, e => { console.warn('[aset gagal]', t.label, e && e.message || e); fin(null); });
    }
  },
  _ui() {
    const bar = document.getElementById('loadbar'), txt = document.getElementById('loadtxt'), chip = document.getElementById('loadchip');
    if (!bar) return;
    bar.style.width = (this.total ? 100 * this.done / this.total : 0) + '%';
    const finished = this.done >= this.total && this.q.length === 0;
    txt.textContent = finished ? 'Aset nyata selesai dimuat' : `Memuat aset nyata… ${this.done}/${this.total}`;
    clearTimeout(this.doneTimer);
    if (finished) this.doneTimer = setTimeout(() => {
      chip.classList.add('done');
      const st = document.getElementById('credit-st');
      if (st) st.textContent = this.fail ? `${this.total - this.fail} aset dimuat, ${this.fail} memakai cadangan prosedural` : `${this.total} aset dimuat`;
    }, 900);
  },
  tex(url, srgb) {
    return new Promise((ok, err) => this.tl.load(url, t => {
      t.encoding = srgb ? THREE.sRGBEncoding : THREE.LinearEncoding;
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = ANISO; ok(t);
    }, undefined, () => err(new Error('gagal ' + url))));
  },
  /** set PBR 1k (Diffuse + Rough + Normal GL) dari Poly Haven */
  pbr(id, prio = 2) {
    const b = `${PH}Textures/jpg/1k/${id}/${id}`;
    return this.run('tekstur:' + id, prio, () => Promise.all([this.tex(b + '_diff_1k.jpg', true), this.tex(b + '_rough_1k.jpg', false), this.tex(b + '_nor_gl_1k.jpg', false)])
      .then(([map, rough, normal]) => ({ map, rough, normal })));
  },
  hdr(id, prio = 1) {
    return this.run('hdri:' + id, prio, () => new Promise((ok, err) => this.rgbe.load(`${PH}HDRIs/hdr/1k/${id}_1k.hdr`, t => { t.mapping = THREE.EquirectangularReflectionMapping; ok(t); }, undefined, () => err(new Error('hdri ' + id)))));
  },
  /** model GLB Poly Haven; hasil di-cache, panggil clone() untuk tiap salinan */
  model(id, prio = 3) {
    if (this.modelCache[id]) return this.modelCache[id];
    const man = PH_MODELS[id];
    return this.modelCache[id] = this.run('model:' + id, prio, () => new Promise((ok, err) => {
      if (!man) return err(new Error('tidak ada di manifest'));
      const base = PH + man.gltf.replace(/[^/]+$/, '');
      const mgr = new THREE.LoadingManager();
      mgr.setURLModifier(url => { if (url.startsWith(base)) { const rel = url.slice(base.length); if (man.map[rel]) return PH + man.map[rel]; } return url; });
      new THREE.GLTFLoader(mgr).load(PH + man.gltf, g => {
        g.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.material) o.material.envMapIntensity = IBL; } });
        ok(g.scene);
      }, undefined, () => err(new Error('gagal ' + id)));
    }));
  },
  /** ambil salinan model setelah termuat; resolve null bila gagal */
  inst(id, prio) { return this.model(id, prio).then(s => s ? s.clone(true) : null); }
};

function applyPBR(mat, set, o = {}) {
  if (!set) return;
  mat.map = set.map; mat.roughnessMap = set.rough; mat.normalMap = set.normal;
  mat.roughness = o.roughness !== undefined ? o.roughness : 1;
  if (o.normalScale) mat.normalScale.set(o.normalScale, o.normalScale);
  if (o.color !== undefined) mat.color.setHex(o.color);
  mat.needsUpdate = true;
}

/* HDRI interior (cahaya dan refleksi hall) */
AM.hdr('empty_warehouse_01', 0).then(t => {
  if (!t) return;
  const env = pmrem.fromEquirectangular(t).texture; t.dispose();
  scene.environment = env;
});
/* HDRI langit: dipakai langsung pada kubah langit */
AM.hdr('industrial_sunset_puresky', 5).then(t => {
  if (!t) return;
  sky.material.map = t; sky.material.color.setScalar(.78); sky.material.needsUpdate = true;
});
