'use strict';
/* =====================================================================
   hall.js — lantai epoxy + marka, dinding berkulit metal, atap & rangka baja,
   kolom, dock, lampu high-bay, instalasi atas, halaman luar.
   Koordinat sama dengan model asli: hall 98 x 64 m, barat = dock (x = -49).
   ===================================================================== */
const HALL = {
  W: 98, D: 64, H: 9.5, RIDGE: 12.2, YARD: -1.15,
  roof: new THREE.Group(),        // atap, skylight, purlin, rangka: tampil saat kamera di dalam
  southFull: new THREE.Group(),   // dinding selatan penuh
  southLow: new THREE.Group(),    // dinding selatan rendah (potongan "dollhouse" untuk overview)
  openings: { dockN: [-13.8, -10.2], door: [-1, 1], dockS: [10.2, 13.8] },
  lamps: [],
  setShell(full) { HALL.roof.visible = full; HALL.southFull.visible = full; HALL.southLow.visible = !full; }
};
scene.add(HALL.roof, HALL.southFull, HALL.southLow);
const { W: HW, D: HD, H: HH, RIDGE, YARD } = HALL;
const roofY = z => HH + (RIDGE - HH) * (1 - Math.abs(z) / 32);   // tinggi permukaan atap pada koordinat z

/* ---------- bahan lantai: variasi makro agar pola tekstur tidak terlihat berulang ---------- */
function macroTexture() {
  const c = cv(256, 256), x = c.getContext('2d');
  x.fillStyle = '#808080'; x.fillRect(0, 0, 256, 256);
  blotches(x, 256, 256, 70, 18, 70, '255,255,255', .22); blotches(x, 256, 256, 70, 18, 70, '0,0,0', .22);
  const t = cTex(c, false); return t;
}
function addMacro(mat, scale, lo = .8, hi = 1.12) {
  const tex = macroTexture();
  mat.onBeforeCompile = sh => {
    sh.uniforms.macroMap = { value: tex };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vWXZ;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWXZ = (modelMatrix * vec4(position, 1.0)).xz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vWXZ;\nuniform sampler2D macroMap;')
      .replace('#include <map_fragment>', `#include <map_fragment>\n float mc = texture2D(macroMap, vWXZ * ${scale.toFixed(4)}).r; diffuseColor.rgb *= mix(${lo.toFixed(2)}, ${hi.toFixed(2)}, mc);`);
  };
}
addMacro(M.floor, 0.017, .78, 1.14);
addMacro(M.asphalt, 0.011, .7, 1.2);

/* =====================================================================
   1. LANTAI + marka cat (satu kanvas besar, bukan puluhan bidang menyala)
   ===================================================================== */
const floor = new THREE.Mesh(new THREE.PlaneGeometry(HW, HD), M.floor);
planeUV(floor.geometry, HW, HD, M.floor.userData.tile);
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

function buildFloorPaint() {
  const CW = 4096, CH = 2048, c = cv(CW, CH), x = c.getContext('2d');
  const X = v => (v + 49) / 98 * CW, Z = v => (v + 32) / 64 * CH, sx = CW / 98, sz = CH / 64;
  const COL = { y: '#e0b100', w: '#e6e6e0', g: '#1b8a4b', b: '#2660b4', c: '#1fa3b8', r: '#b3261e' };
  const rect = (x0, z0, x1, z1, col, a = 1) => { x.globalAlpha = a; x.fillStyle = col; x.fillRect(X(x0), Z(z0), (x1 - x0) * sx, (z1 - z0) * sz); x.globalAlpha = 1; };
  const segs = (a0, a1, skips) => { // potong [a0,a1] di luar rentang skip
    let out = [[a0, a1]];
    for (const [s0, s1] of skips || []) { const n = []; for (const [p, q] of out) { if (s1 <= p || s0 >= q) n.push([p, q]); else { if (s0 > p) n.push([p, s0]); if (s1 < q) n.push([s1, q]); } } out = n; }
    return out;
  };
  const hline = (z, x0, x1, w, col, skips, a = 1) => segs(x0, x1, skips).forEach(([p, q]) => rect(p, z - w / 2, q, z + w / 2, col, a));
  const vline = (xx, z0, z1, w, col, skips, a = 1) => segs(z0, z1, skips).forEach(([p, q]) => rect(xx - w / 2, p, xx + w / 2, q, col, a));
  const hdash = (z, x0, x1, w, d, g, col, skips) => { for (let p = x0; p < x1; p += d + g) segs(p, Math.min(p + d, x1), skips).forEach(([a, b]) => rect(a, z - w / 2, b, z + w / 2, col)); };
  const vdash = (xx, z0, z1, w, d, g, col, skips) => { for (let p = z0; p < z1; p += d + g) segs(p, Math.min(p + d, z1), skips).forEach(([a, b]) => rect(xx - w / 2, a, xx + w / 2, b, col)); };
  const text = (s, xx, zz, size, col, rot = 0, a = 1) => { x.save(); x.translate(X(xx), Z(zz)); x.scale(sx, sz); x.rotate(rot); x.globalAlpha = a; x.fillStyle = col; x.font = `bold ${size}px "Arial Narrow", Arial, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(s, 0, 0); x.restore(); };
  const arrow = (xx, zz, dir, col) => { x.save(); x.translate(X(xx), Z(zz)); x.scale(sx, sz); x.rotate(dir); x.fillStyle = col; x.globalAlpha = .9; x.beginPath(); x.moveTo(1.1, 0); x.lineTo(0.1, -0.85); x.lineTo(0.1, -0.32); x.lineTo(-1.1, -0.32); x.lineTo(-1.1, 0.32); x.lineTo(0.1, 0.32); x.lineTo(0.1, 0.85); x.closePath(); x.fill(); x.restore(); };
  const soft = (x0, z0, x1, z1, spread, a) => { for (let i = 5; i >= 0; i--) { const e = spread * i / 5; rect(x0 - e, z0 - e, x1 + e, z1 + e, '#000', a / 6); } };
  const hazard = (x0, z0, x1, z1, t) => {
    x.save(); x.beginPath(); x.rect(X(x0 - t), Z(z0 - t), (x1 - x0 + 2 * t) * sx, (z1 - z0 + 2 * t) * sz); x.rect(X(x0), Z(z0), (x1 - x0) * sx, (z1 - z0) * sz);
    x.clip('evenodd'); x.fillStyle = x.createPattern(PROC.hazard().image, 'repeat'); x.globalAlpha = .96; x.fillRect(X(x0 - t), Z(z0 - t), (x1 - x0 + 2 * t) * sx, (z1 - z0 + 2 * t) * sz); x.restore();
  };
  const outline = (x0, z0, x1, z1, w, col) => { hline(z0, x0 - w / 2, x1 + w / 2, w, col); hline(z1, x0 - w / 2, x1 + w / 2, w, col); vline(x0, z0, z1, w, col); vline(x1, z0, z1, w, col); };
  const brackets = (x0, z0, x1, z1, L, w, col) => { for (const [px, pz, dx, dz] of [[x0, z0, 1, 1], [x1, z0, -1, 1], [x0, z1, 1, -1], [x1, z1, -1, -1]]) { rect(Math.min(px, px + dx * L), pz - w / 2, Math.max(px, px + dx * L), pz + w / 2, col); rect(px - w / 2, Math.min(pz, pz + dz * L), px + w / 2, Math.max(pz, pz + dz * L), col); } };

  /* alas: sambungan slab tiap 6 m dan jejak ban */
  for (let xx = -48; xx <= 48; xx += 6) vline(xx, -32, 32, .035, '#20252b', null, .35);
  for (let zz = -30; zz <= 30; zz += 6) hline(zz, -49, 49, .035, '#20252b', null, .35);
  const wheel = (z, x0, x1, vert) => { for (const o of [-.9, .9]) for (let k = 0; k < 4; k++) { const w = .5 + k * .18; if (vert) rect(z + o - w / 2, x0, z + o + w / 2, x1, '#000', .02); else rect(x0, z + o - w / 2, x1, z + o + w / 2, '#000', .02); } };
  wheel(-12, -38, -5); wheel(12, -38, -5); wheel(-20, -33, -7); wheel(20, -33, -7); wheel(-8, -21, 21, true); wheel(-32, -13, 13, true);
  // bayangan kontak di bawah rak, mesin dan konveyor
  for (const zr of [-24.5, -15.5, 15.5, 24.5]) soft(-28.15, zr - .95, -11.65, zr + .95, 1.0, .55);
  soft(16, -13.8, 20, -10.2, .9, .5); soft(10.7, -12.85, 37.8, -11.15, .55, .35); soft(36.2, -12.85, 37.8, 12.85, .55, .35); soft(10.7, 11.15, 37.8, 12.85, .55, .35);
  soft(-17.9, -8.3, -12.1, -3.7, .8, .5); soft(-27.2, -8.6, -20.8, -4.4, .5, .0);

  /* jalur forklift: garis tepi kuning (lane satu arah penuh, aisle putus-putus) */
  const crossN = [-13.7, -10.3], crossS = [10.3, 13.7], spine = [-9.8, -6.2], dockX = [-33.7, -30.3], ped = [-1.1, 1.1];
  hline(-13.7, -38, -5, .13, COL.y, [spine, dockX]); hline(-10.3, -38, -5, .13, COL.y, [spine, dockX]);
  hline(10.3, -38, -5, .13, COL.y, [spine, dockX]); hline(13.7, -38, -5, .13, COL.y, [spine, dockX]);
  vline(-9.8, -21, 21, .13, COL.y, [crossN, crossS, ped, [-21.9, -18.1], [18.1, 21.9]]); vline(-6.2, -21, 21, .13, COL.y, [crossN, crossS, ped, [-21.9, -18.1], [18.1, 21.9]]);
  vline(-33.7, -13, 13, .13, COL.y, [crossN, crossS, ped]); vline(-30.3, -13, 13, .13, COL.y, [crossN, crossS, ped]);
  hdash(-21.8, -33, -9.8, .12, 1.4, .9, COL.y); hdash(-18.2, -33, -9.8, .12, 1.4, .9, COL.y);
  hdash(18.2, -33, -9.8, .12, 1.4, .9, COL.y); hdash(21.8, -33, -9.8, .12, 1.4, .9, COL.y);
  hdash(-12, -37.5, -5.5, .1, 2.2, 1.6, COL.y, [spine, dockX]); hdash(12, -37.5, -5.5, .1, 2.2, 1.6, COL.y, [spine, dockX]);
  vdash(-8, -20.5, 20.5, .1, 2.2, 1.6, COL.y, [crossN, crossS, ped, [-21.9, -18.1], [18.1, 21.9]]);
  vdash(-32, -12.5, 12.5, .1, 2.2, 1.6, COL.y, [crossN, crossS, ped]);
  for (const ax of [-26, -17]) { arrow(ax, -12, 0, COL.w); arrow(ax + 2, 12, Math.PI, COL.w); }
  arrow(-8, -16.5, Math.PI / 2, COL.w); arrow(-8, 16.5, -Math.PI / 2, COL.w);
  text('LANE-FL  1-WAY', -22, -14.9, .55, COL.w, 0, .9); text('LANE-FL  1-WAY', -22, 14.9, .55, COL.w, Math.PI, .9);
  text('AISLE-01', -20, -18.9, .62, COL.y, 0, .85); text('AISLE-02', -20, 18.9, .62, COL.y, 0, .85);
  text('AISLE-01', -20, -21.1, .62, COL.y, Math.PI, .0);
  // batas kecepatan
  for (const [sxp, szp, lbl] of [[-35.5, -12, '10'], [-35.5, 12, '10'], [-9.5, -17, '5'], [-9.5, 17, '5']]) {
    x.save(); x.translate(X(sxp), Z(szp)); x.scale(sx, sz); x.lineWidth = .16; x.strokeStyle = COL.r; x.globalAlpha = .9; x.fillStyle = 'rgba(230,230,224,.9)'; x.beginPath(); x.arc(0, 0, .72, 0, 7); x.fill(); x.stroke();
    x.fillStyle = '#16181b'; x.font = 'bold 0.9px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(lbl, 0, .04); x.restore();
  }

  /* koridor AMR: garis biru putus-putus */
  const amrSkips = [[-13.9, -10.1], [10.1, 13.9]];
  vdash(8.9, -14, 14, .1, 1.6, 1, COL.b, [ped]); vdash(11.1, -14, 14, .1, 1.6, 1, COL.b, [ped]);
  hdash(-13.2, -5, 11, .1, 1.6, 1, COL.b); hdash(-10.8, -5, 8.8, .1, 1.6, 1, COL.b); hdash(10.8, -5, 8.8, .1, 1.6, 1, COL.b); hdash(13.2, -5, 11, .1, 1.6, 1, COL.b);
  vdash(-3.3, -11, 11, .1, 1.6, 1, COL.b, [ped]); vdash(-1.7, -11, 11, .1, 1.6, 1, COL.b, [ped]);
  outline(1.4, -9.5, 7.6, -6.9, .1, COL.b); outline(3.4, 6.9, 5.6, 9.5, .1, COL.b); text('AMR PARK', 4.5, -9.9, .42, COL.b, 0, .9);
  text('AMR CORRIDOR', 3, -14.1, .5, COL.b, 0, .95); text('AUTO-GUIDED', 3, -9.9, .4, COL.b, Math.PI, .0);

  /* jalur pejalan kaki: hijau + garis putih, zebra cross di tiap persimpangan */
  rect(-45, ped[0], 39, ped[1], COL.g, .92); hline(-1.1, -45, 39, .1, COL.w, null, .9); hline(1.1, -45, 39, .1, COL.w, null, .9);
  for (const zc of [-32, -8, -2.5, 10]) { rect(zc - 2.1, -1.55, zc + 2.1, 1.55, '#2d3135', .0); for (let i = 0; i < 6; i++) rect(zc - 2.2 + i * .8, -1.1, zc - 2.2 + i * .8 + .46, 1.1, COL.w, .95); }
  text('PED-PATH  WALKWAY ONLY', -20, 0, .5, COL.w, 0, .9); text('PED-PATH', 24, 0, .5, COL.w, 0, .85);

  /* zona */
  outline(-40, -14.6, -34.4, -9.4, .12, COL.b); brackets(-40.2, -14.8, -34.2, -9.2, 1.3, .3, COL.b); text('STG-IN', -37.2, -14.0, .5, COL.b, 0, .9);
  outline(-40, 9.4, -34.4, 14.6, .12, COL.g); brackets(-40.2, 9.2, -34.2, 14.8, 1.3, .3, COL.g); text('STG-OUT', -37.2, 14.0, .5, COL.g, 0, .9);
  outline(-27.25, -8.25, -20.75, -3.75, .12, COL.c); for (let i = -10; i < 26; i++) { x.save(); x.beginPath(); x.rect(X(-27.2), Z(-8.2), 6.4 * sx, 4.4 * sz); x.clip(); x.strokeStyle = 'rgba(31,163,184,.4)'; x.lineWidth = .08 * sz; x.beginPath(); x.moveTo(X(-27.2 + i * .9), Z(-8.2)); x.lineTo(X(-27.2 + i * .9 + 2), Z(-3.8)); x.stroke(); x.restore(); }
  text('CHG-BAY', -24, -4.4, .5, COL.c, 0, .95);
  hazard(-17.9, -8.3, -12.1, -3.7, .3);        // area kantor OPS-CTRL
  hazard(15.8, -13.8, 20.2, -10.2, .28);       // CNC
  hazard(30.1, -14.5, 38.7, -5.5, .3);         // sel robot
  hazard(35.4, 2.8, 38.6, 7.2, .25);           // gerbang QC
  hazard(24.4, -13.1, 27.6, -10.9, .2);        // WIP-BUF-01
  hazard(35.6, -4.4, 38.4, -1.6, .2);          // WIP-BUF-02
  for (const [bx, bz] of [[-25.5, -6], [-22.5, -6]]) rect(bx - .5, bz - 1.5, bx + .5, bz + 1.5, COL.c, .35);
  // pos APAR / panel listrik: area bebas parkir (hatch merah)
  const nopark = (x0, z0, x1, z1) => { outline(x0, z0, x1, z1, .08, COL.r); x.save(); x.beginPath(); x.rect(X(x0), Z(z0), (x1 - x0) * sx, (z1 - z0) * sz); x.clip(); x.strokeStyle = 'rgba(179,38,30,.8)'; x.lineWidth = .07 * sz; for (let i = -6; i < 14; i++) { x.beginPath(); x.moveTo(X(x0 + i * .45), Z(z0)); x.lineTo(X(x0 + i * .45 + 1.2), Z(z1)); x.stroke(); } x.restore(); };
  nopark(-47.2, -31, -45, -27.8); nopark(46.5, -4, 48.2, -0.8); nopark(-3.2, 29.6, 0.6, 31.4);
  // tepi dock + area bongkar muat
  for (const dz of [-12, 12]) { hazard(-48.8, dz - 2.4, -46.2, dz + 2.4, .0); rect(-48.9, dz - 2.1, -46.6, dz + 2.1, '#000', 0); text('DOCK ' + (dz < 0 ? '1' : '2'), -44.4, dz, .8, COL.w, -Math.PI / 2, .9); }

  /* area packing */
  outline(-44.5, 23.8, -39.5, 30, .1, COL.y); text('PACKING', -42, 30.6, .5, COL.y, 0, .85);
  outline(-44.5, -30, -39.5, -23.8, .1, COL.y); text('MAINT.', -42, -30.6, .5, COL.y, 0, .85);

  /* keausan dan noda: cat terkelupas, bercak oli */
  x.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 26000; i++) { x.fillStyle = `rgba(0,0,0,${rr(.12, .55)})`; const s = rr(1.2, 5); x.fillRect(rr(0, CW), rr(0, CH), s * rr(.6, 2.2), s); }
  for (let i = 0; i < 90; i++) { const gx = rr(0, CW), gy = rr(0, CH), r = rr(14, 70), g = x.createRadialGradient(gx, gy, 0, gx, gy, r); g.addColorStop(0, 'rgba(0,0,0,.28)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(gx - r, gy - r, 2 * r, 2 * r); }
  x.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 70; i++) { const gx = X(rr(-46, 46)), gy = Z(rr(-28, 28)), r = rr(8, 30), g = x.createRadialGradient(gx, gy, 0, gx, gy, r); g.addColorStop(0, 'rgba(10,12,14,.30)'); g.addColorStop(1, 'rgba(10,12,14,0)'); x.fillStyle = g; x.fillRect(gx - r, gy - r, 2 * r, 2 * r); }
  const t = cTex(c, true, false); t.anisotropy = ANISO; return t;
}
const paintMat = new THREE.MeshStandardMaterial({ map: buildFloorPaint(), transparent: true, roughness: .55, metalness: 0, envMapIntensity: IBL, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
paintMat.userData.noCast = true;
const floorPaint = new THREE.Mesh(new THREE.PlaneGeometry(HW, HD), paintMat);
floorPaint.rotation.x = -Math.PI / 2; floorPaint.position.y = 0.006; floorPaint.receiveShadow = true; floorPaint.renderOrder = 1; scene.add(floorPaint);

/* =====================================================================
   2. DINDING: plinth beton + kulit metal + jendela clerestory + bukaan dock
   ===================================================================== */
const Bw = new Batcher();          // dinding yang selalu tampak
const BsF = new Batcher(), BsL = new Batcher(); // selatan penuh / rendah
const Br = new Batcher();          // atap dan rangka (tampil bila kamera di dalam)
const Bo = new Batcher();          // instalasi atas yang selalu tampak (lampu, duct, pipa)

const WIN0 = 6.4, WIN1 = 8.2, PLINTH_TOP = 1.1, WT = 0.34;
/** Satu lajur dinding sepanjang sumbu `ax` ('x' atau 'z') pada koordinat tetap `fix`. */
function wallRun(B, ax, fix, s0, s1, opts = {}) {
  const th = WT, put = (mat, a, b, y0, y1, off = 0, t = th) => {
    const len = b - a, mid = (a + b) / 2, h = y1 - y0, y = (y0 + y1) / 2;
    if (len <= 0.001 || h <= 0.001) return;
    if (ax === 'x') B.box(mat, len, h, t, mid, y, fix + off, 0, 0, 0); else B.box(mat, t, h, len, fix + off, y, mid, 0, 0, 0);
  };
  const ops = (opts.openings || []).slice().sort((p, q) => p[0] - q[0]);
  let cur = s0; const free = [];
  for (const [a, b, top] of ops) { if (a > cur) free.push([cur, a, 0]); free.push([a, b, top]); cur = b; }
  if (cur < s1) free.push([cur, s1, 0]);
  for (const [a, b, top] of free) {
    const isOpen = top > 0;
    if (isOpen) put(M.slab, a, b, YARD, 0, 0, .5);                     // ambang dock
    else put(M.slab, a, b, YARD, PLINTH_TOP, 0, .5);                    // plinth beton
    const lowTop = opts.low ? 2.8 : WIN0;
    put(M.cladding, a, b, isOpen ? top : PLINTH_TOP, lowTop, .08);
    if (opts.low) { put(M.steel, a, b, 2.8, 2.92, 0.0, .5); continue; }
    if (opts.windows !== false && !isOpen) {
      put(M.steel, a, b, WIN0, WIN0 + .1, 0, .22); put(M.steel, a, b, WIN1 - .1, WIN1, 0, .22);
      for (let p = a + .01; p <= b + .01; p += 2.5) put(M.steel, p - .04, p + .04, WIN0, WIN1, 0, .2);
      const g = (ax === 'x') ? [b - a, WIN1 - WIN0 - .2] : [b - a, WIN1 - WIN0 - .2];
      if (ax === 'x') B.plane(M.glass, g[0], g[1], (a + b) / 2, (WIN0 + WIN1) / 2, fix, 0, 0, 0); else B.plane(M.glass, g[0], g[1], fix, (WIN0 + WIN1) / 2, (a + b) / 2, 0, Math.PI / 2, 0);
    } else if (!isOpen) put(M.cladding, a, b, WIN0, WIN1, .08);
    put(M.cladding, a, b, WIN1, HH, .08);
    put(M.claddingBand, a, b, HH - .65, HH - .02, ax === 'x' ? (fix > 0 ? .2 : -.2) : (fix > 0 ? .2 : -.2), .06); // pita aksen biru di luar
    put(M.steel, a, b, HH, HH + .12, 0, .55);                            // balok tepi/coping
  }
}
// utara dan timur: penuh; selatan: dua varian; barat: dengan bukaan dock dan pintu personel
wallRun(Bw, 'x', -32, -49, 49);
wallRun(Bw, 'z', 49, -32, 32);
wallRun(BsF, 'x', 32, -49, 49);
wallRun(BsL, 'x', 32, -49, 49, { low: true });
wallRun(Bw, 'z', -49, -32, 32, { openings: [[-13.8, -10.2, 4.4], [-1, 1, 2.6], [10.2, 13.8, 4.4]] });

// gable timur/barat di atas dinding (segitiga hingga bubungan)
function gable(xc) {
  const sh = new THREE.Shape(); sh.moveTo(-32, 0); sh.lineTo(32, 0); sh.lineTo(0, RIDGE - HH); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: .34, bevelEnabled: false });
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2, uv.getY(i) / 2);
  Bw.geo(M.cladding, g, xf(xc, HH, 0, 0, -Math.PI / 2, 0));
}
gable(49.17); gable(-48.83);

/* kolom baja di dinding (penampang silang) + pelindung kolom bergaris hazard */
function pilaster(B, x, z) {
  B.box(M.steel, .32, HH - .1, .026, x, HH / 2, z);
  B.box(M.steel, .026, HH - .1, .32, x, HH / 2, z);
  B.box(M.steelDark, .5, .06, .5, x, .03, z); B.box(M.slab, .6, .1, .6, x, .05, z);
  for (const [bx, bz] of [[-.18, -.18], [.18, -.18], [-.18, .18], [.18, .18]]) B.cyl(M.steelRaw, .022, .022, .1, 6, x + bx, .12, z + bz);
}
for (let xx = -45; xx <= 45; xx += 10) for (const zz of [-31.55, 31.55]) { const B = zz > 0 ? BsF : Bw; pilaster(B, xx, zz); B.box(M.hazard, .62, 1.0, .62, xx, .5, zz + (zz > 0 ? -.25 : .25)); }
for (const zz of [-30, -20, -10, 10, 20, 30]) { pilaster(Bw, 48.55, zz); Bw.box(M.hazard, .62, 1.0, .62, 48.3, .5, zz); if (!(zz === -10 || zz === 10)) { pilaster(Bw, -48.55, zz); Bw.box(M.hazard, .62, 1.0, .62, -48.3, .5, zz); } }

/* dock: rolling door setengah terangkat, seal karet, bumper, leveler, lampu */
function dock(z) {
  const a = z - 1.8, b = z + 1.8, xw = -49;
  Bw.box(M.steel, .12, 4.4, .16, xw + .02, 2.2, a - .08); Bw.box(M.steel, .12, 4.4, .16, xw + .02, 2.2, b + .08);   // rangka pintu
  Bw.box(M.steel, .18, .14, 3.9, xw + .02, 4.42, z);
  Bw.box(M.steelDark, .5, .52, 4.0, xw + .22, 4.7, z);                                                             // rumah gulungan
  for (let y = 4.0; y < 4.4; y += .1) Bw.box(M.white, .06, .08, 3.6, xw + .06, y + .05, z);                       // sisa tirai
  // dock seal (karet hitam) di sisi luar
  Bw.box(M.rubber, .35, 4.0, .3, xw - .35, 2.0, a - .1); Bw.box(M.rubber, .35, 4.0, .3, xw - .35, 2.0, b + .1); Bw.box(M.rubber, .35, .35, 3.9, xw - .35, 4.3, z);
  // bumper karet di sisi luar bawah
  for (const o of [-1.9, 1.9]) Bw.box(M.rubber, .22, .4, .45, xw - .15, .15, z + o);
  // dock leveler dengan bingkai hazard
  Bw.box(M.hazard, 2.5, .02, 3.6, xw + 1.4, .012, z, 0, 0, 0); Bw.box(M.steelRaw, 2.2, .035, 3.2, xw + 1.4, .03, z);
  Bw.box(M.steelRaw, .6, .03, 3.2, xw - .08, .02, z, 0, 0, .15);
  // lampu lengan dock dan lampu lalu lintas
  Bw.cyl(M.steelDark, .03, .03, 1.1, 6, xw + .5, 3.2, a - .35, 0, 0, 1.2); Bw.sph(M.lamp, .1, xw + 1.0, 3.55, a - .4);
  for (const [c, dy] of [[M.ledRed, 0], [M.ledGreen, .4]]) Bw.sph(c, .1, xw - .5, 5.2 + dy, z - 2.5);
  Bw.box(M.black, .12, .85, .26, xw - .45, 5.4, z - 2.5);
  // ganjal roda
  for (const o of [-1.2, 1.2]) Bw.box(M.yellow, .55, .2, .22, xw - 3.2, YARD + .1, z + o, 0, 0, 0);
}
dock(-12); dock(12);

/* pintu personel + tangga + papan APD */
(function personnelDoor() {
  const xw = -49;
  Bw.box(M.steel, .12, 2.6, .12, xw + .02, 1.3, -1.06); Bw.box(M.steel, .12, 2.6, .12, xw + .02, 1.3, 1.06); Bw.box(M.steel, .12, .12, 2.2, xw + .02, 2.64, 0);
  Bw.box(M.green, .06, 2.45, 1.0, xw + .1, 1.27, -.5, 0, 0, 0);                    // daun pintu hijau, terbuka separuh (sisi kiri)
  Bw.box(M.steelRaw, .04, .09, .5, xw + .03, 1.1, -.9);
  let sy = YARD; for (let i = 0; i < 4; i++) { sy += .2875; Bw.box(M.slab, .32, sy - YARD, 2.6, xw - .5 - (3 - i) * .32, (sy + YARD) / 2, 0); }
  Bw.box(M.slab, 1.4, 1.15, 2.6, xw - .7, YARD + .575, 0);
  for (const sz of [-1.3, 1.3]) { Bw.box(M.yellow, 1.7, .06, .06, xw - 1.65, .75 + YARD * 0 - .1, sz); Bw.cyl(M.yellow, .03, .03, 1.1, 6, xw - 1.0, .45, sz); Bw.cyl(M.yellow, .03, .03, 1.0, 6, xw - 2.3, -.2, sz); }
})();

/* gerbang: papan tanda dipasang sebagai plane bertekstur */
function signPlane(parent, kind, label, sub, x, y, z, ry, w = .55) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w), new THREE.MeshStandardMaterial({ map: signTex(kind, label, sub), roughness: .5, metalness: .1, envMapIntensity: .5 }));
  m.position.set(x, y, z); m.rotation.y = ry; m.receiveShadow = true; parent.add(m); return m;
}
const signs = new THREE.Group(); scene.add(signs);
signPlane(signs, 'exit', 'EXIT', 'Pintu keluar', -48.78, 3.0, 0, Math.PI / 2, .8);
signPlane(signs, 'ppe', 'WAJIB APD', 'Helm, rompi, sepatu', -50.2, 1.9, 2.0, -Math.PI / 2, .7);
signPlane(signs, 'forklift', 'FORKLIFT', 'Awas kendaraan', -50.2, 1.9, -2.0, -Math.PI / 2, .7);
signPlane(signs, 'speed', '10', '', -8, 2.0, -21.3, Math.PI, .5); signPlane(signs, 'speed', '5', '', -8, 2.0, 21.4, 0, .5);

/* =====================================================================
   3. ATAP, RANGKA BAJA, SKYLIGHT (roofGroup), INSTALASI ATAS (selalu tampak)
   ===================================================================== */
const ang = Math.atan((RIDGE - HH) / 32), slopeLen = Math.hypot(32.7, RIDGE - HH);
for (const sgn of [-1, 1]) {
  const zc = sgn * 16.15, yc = roofY(zc) + .06;
  Br.box(M.roofMetal, HW + 1.2, .09, slopeLen + .2, 0, yc, zc, sgn < 0 ? -ang : ang, 0, 0);
  for (let i = 0; i < 7; i++) {                                                         // skylight translusen
    const sx2 = -42 + i * 14, zs = sgn * 14, ys = roofY(zs) + .1;
    Br.box(M.skylight || (M.skylight = new THREE.MeshStandardMaterial({ color: 0xf4fbff, emissive: 0xc6e0ff, emissiveIntensity: .55, roughness: .3, transparent: true, opacity: .8, envMapIntensity: 1 })), 8, .06, 2.6, sx2, ys + .02, zs, sgn < 0 ? -ang : ang, 0, 0);
  }
}
M.skylight.userData.noCast = true;
// rangka (truss) tiap 10 m + purlin
for (let xx = -45; xx <= 45; xx += 10) {
  const yb = HH - .6;
  for (const sgn of [-1, 1]) Br.box(M.truss, .14, .34, slopeLen, xx, (HH + RIDGE) / 2 - .24, sgn * 16, sgn < 0 ? -ang : ang, 0, 0);
  Br.box(M.truss, .14, .28, 63.2, xx, yb, 0);
  for (let k = -8; k <= 8; k++) {
    const zk = k * 4, top = roofY(zk) - .3; if (Math.abs(zk) > 31.5) continue;
    Br.box(M.truss, .1, top - yb, .1, xx, (top + yb) / 2, zk);
    if (k < 8) { const z1 = (k + 1) * 4, t1 = roofY(z1) - .3, dz = z1 - zk; if (Math.abs(z1) > 31.5) continue;
      const lowFirst = k < 0, y0 = lowFirst ? yb : t1, y1 = lowFirst ? t1 : yb, dy = y1 - y0, len = Math.hypot(dz, dy);
      Br.box(M.truss, .08, .08, len, xx, (y0 + y1) / 2, (zk + z1) / 2, -Math.atan2(dy, dz), 0, 0); }
  }
}
for (const sgn of [-1, 1]) for (let zp = 1.6; zp < 32; zp += 3.2) Br.box(M.truss, HW, .12, .12, 0, roofY(sgn * zp) - .14, sgn * zp, 0, 0, 0);

/* lampu LED high-bay (UFO) berderet tiap 14 m, dengan batang gantung ke atap */
function highBay(B, x, z) {
  const y = 8.0, top = roofY(z) - .2;
  B.cyl(M.steelDark, .03, .03, top - y - .2, 5, x, (top + y + .2) / 2, z);
  B.cyl(M.steel, .26, .38, .22, 20, x, y + .12, z);                          // badan + heatsink
  B.cyl(M.steelDark, .14, .1, .16, 12, x, y + .3, z);                        // driver
  B.cyl(M.steel, .42, .2, .22, 24, x, y - .06, z, 0, 0, 0, true);           // reflektor
  B.cyl(M.lamp, .3, .3, .03, 24, x, y - .15, z);                             // lensa menyala
  HALL.lamps.push([x, z]);
}
for (const xx of [-42, -28, -14, 0, 14, 28, 42]) for (const zz of [-20, 0, 20]) highBay(Bo, xx, zz);

/* duct HVAC, pipa sprinkler, cable tray, pipa gas dan udara di dinding */
for (const zz of [-26, 26]) {
  Bo.box(M.duct, 96, .62, 1.1, 0, 8.25, zz);
  for (let xx = -46; xx <= 46; xx += 6) { Bo.box(M.steelDark, .14, .72, 1.2, xx, 8.25, zz); Bo.cyl(M.steelDark, .02, .02, 1.3, 4, xx, 8.95, zz + .45); Bo.cyl(M.steelDark, .02, .02, 1.3, 4, xx, 8.95, zz - .45); }
  for (const xx of [-34, -6, 22]) Bo.cyl(M.duct, .28, .28, 1.5, 12, xx, 7.2, zz + (zz > 0 ? -.2 : .2));
}
for (const zz of [-8.5, 8.5]) {
  Bo.cyl(M.pipeRed, .09, .09, 96, 10, 0, 8.55, zz, 0, 0, Math.PI / 2);
  for (let xx = -45; xx <= 45; xx += 10) { Bo.cyl(M.steelDark, .015, .015, .6, 4, xx, 8.85, zz); for (const dz of [-3, 3]) Bo.cyl(M.pipeRed, .04, .04, 3, 6, xx, 8.5, zz + dz / 2, Math.PI / 2, 0, 0); Bo.sph(M.red, .06, xx, 8.42, zz + (zz > 0 ? 3 : -3)); Bo.sph(M.red, .06, xx, 8.42, zz + (zz > 0 ? -3 : 3)); }
}
for (const zz of [-4.5, 4.5]) {
  Bo.box(M.truss, 96, .05, .4, 0, 7.5, zz);
  for (let k = 0; k < 3; k++) Bo.cyl(M.steelDark, .02, .02, 96, 6, 0, 7.55, zz - .12 + k * .12, 0, 0, Math.PI / 2);
  for (let xx = -46; xx <= 46; xx += 4) { Bo.box(M.steelDark, .04, .06, .44, xx, 7.5, zz); Bo.cyl(M.steelDark, .012, .012, 1.4, 4, xx, 8.25, zz + .26); Bo.cyl(M.steelDark, .012, .012, 1.4, 4, xx, 8.25, zz - .26); }
}
for (const [yy, mat] of [[6.7, M.pipeGreen], [6.3, M.pipeBlue]]) { Bo.cyl(mat, .07, .07, 94, 10, 0, yy, -31.4, 0, 0, Math.PI / 2); for (let xx = -46; xx <= 46; xx += 5) Bo.box(M.steelDark, .12, .1, .22, xx, yy, -31.55); }
Bo.cyl(M.pipeBlue, .06, .06, 60, 10, 48.4, 6.5, 0, Math.PI / 2, 0, 0);

/* lampu dinding, kipas ventilasi, penunjuk keluar di dinding dalam */
for (const zz of [-24, -4, 18]) { Bo.box(M.steelDark, .22, .26, .5, 48.7, 5.6, zz); Bo.box(M.lamp, .04, .18, .4, 48.58, 5.6, zz); }

/* pool cahaya aditif di bawah lampu */
const poolTex = (() => { const c = cv(128, 128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,244,222,.55)'); g.addColorStop(.45, 'rgba(255,240,214,.22)'); g.addColorStop(1, 'rgba(255,236,206,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return cTex(c, true, false); })();
const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .45, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
poolMat.userData.noCast = true;
for (const [lx, lz] of HALL.lamps) Bo.plane(poolMat, 17, 17, lx, .02, lz, -Math.PI / 2, 0, 0);

/* =====================================================================
   4. HALAMAN LUAR: aspal, marka, pagar, tiang lampu, gardu, kontainer
   ===================================================================== */
const ground = new THREE.Mesh(new THREE.PlaneGeometry(520, 520), M.asphalt);
planeUV(ground.geometry, 520, 520, M.asphalt.userData.tile);
ground.rotation.x = -Math.PI / 2; ground.position.y = YARD; ground.receiveShadow = true; scene.add(ground);

(function yardPaint() {
  const CW = 2048, CH = 2048, X0 = -122, X1 = -49.4, Z0 = -46, Z1 = 46, c = cv(CW, CH), x = c.getContext('2d');
  const sx = CW / (X1 - X0), sz = CH / (Z1 - Z0), X = v => (v - X0) * sx, Z = v => (v - Z0) * sz;
  const rect = (x0, z0, x1, z1, col, a = 1) => { x.globalAlpha = a; x.fillStyle = col; x.fillRect(X(x0), Z(z0), (x1 - x0) * sx, (z1 - z0) * sz); x.globalAlpha = 1; };
  const text = (s, xx, zz, size, col, rot = 0) => { x.save(); x.translate(X(xx), Z(zz)); x.scale(sx, sz); x.rotate(rot); x.fillStyle = col; x.font = `bold ${size}px Arial`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(s, 0, 0); x.restore(); };
  for (const dz of [-12, 12]) {                                                 // petak bongkar muat truk
    for (const o of [-2.2, 2.2]) rect(-101, dz + o - .08, -49.6, dz + o + .08, '#e8e8e2', .92);
    rect(-101.1, dz - 2.3, -100.95, dz + 2.3, '#e8e8e2', .92);
    for (let i = 0; i < 5; i++) rect(-56 + i * 1.4, dz - 2.2, -56 + i * 1.4 + .6, dz + 2.2, '#e0b100', .9);
    text('DOCK ' + (dz < 0 ? '1' : '2'), -95, dz, 1.6, '#e8e8e2', -Math.PI / 2);
  }
  for (let i = 0; i < 6; i++) rect(-60 + i * .9, -1.5, -60 + i * .9 + .5, 1.5, '#e8e8e2', .9);
  for (const zz of [-34, 34]) rect(-120, zz - .1, -49.6, zz + .1, '#e0b100', .9);
  rect(-120, -.1, -105, .1, '#e8e8e2', .0);
  for (let i = 0; i < 4; i++) { x.save(); x.translate(X(-76 + i * 12), Z(0)); x.scale(sx, sz); x.fillStyle = '#e8e8e2'; x.globalAlpha = .85; x.beginPath(); x.moveTo(1.4, 0); x.lineTo(.2, -1); x.lineTo(.2, -.35); x.lineTo(-1.4, -.35); x.lineTo(-1.4, .35); x.lineTo(.2, .35); x.lineTo(.2, 1); x.closePath(); x.fill(); x.restore(); }
  x.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 22000; i++) { x.fillStyle = `rgba(0,0,0,${rr(.15, .6)})`; const s = rr(1, 5); x.fillRect(rr(0, CW), rr(0, CH), s * rr(.6, 2), s); }
  x.globalCompositeOperation = 'source-over';
  const t = cTex(c, true, false);
  const m = new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: .6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, envMapIntensity: IBL });
  const p = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, Z1 - Z0), m); p.rotation.x = -Math.PI / 2; p.position.set((X0 + X1) / 2, YARD + .006, 0); p.receiveShadow = true; p.renderOrder = 1; scene.add(p);
})();

const Bx = new Batcher();    // halaman luar: statis
// pagar keliling + gerbang di barat
function fence(x0, z0, x1, z1) {
  const len = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 3));
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(len, 2.2), M.mesh); M.mesh.map.repeat.set(1, 1);
  planeUV(mesh.geometry, len, 2.2, 1.0); mesh.position.set((x0 + x1) / 2, YARD + 1.2, (z0 + z1) / 2); mesh.rotation.y = a - Math.PI / 2; scene.add(mesh);
  for (let i = 0; i <= n; i++) { const px = lerp(x0, x1, i / n), pz = lerp(z0, z1, i / n); Bx.box(M.steelDark, .09, 2.45, .09, px, YARD + 1.22, pz); }
  Bx.box(M.steelDark, Math.abs(x1 - x0) || .06, .06, Math.abs(z1 - z0) || .06, (x0 + x1) / 2, YARD + 2.4, (z0 + z1) / 2);
}
fence(-122, -44, 62, -44); fence(-122, 44, 62, 44); fence(62, -44, 62, 44); fence(-122, -44, -122, -6); fence(-122, 6, -122, 44);
// gardu jaga + palang
Bx.box(M.office, 3.2, 2.7, 3.0, -116, YARD + 1.35, -10); Bx.box(M.darkGlass, 3.22, 1.0, 2.2, -116, YARD + 1.7, -10); Bx.box(M.steelDark, 3.8, .16, 3.6, -116, YARD + 2.78, -10);
Bx.box(M.red, .4, 1.2, .4, -121.2, YARD + .6, 2.2); Bx.box(M.red, .1, .1, 4.4, -121.2, YARD + 1.1, 0.0); Bx.box(M.white, .11, .11, .7, -121.2, YARD + 1.1, -1.5); Bx.box(M.white, .11, .11, .7, -121.2, YARD + 1.1, 0.5);
// tiang lampu halaman
for (const [px, pz] of [[-70, -36], [-70, 36], [-95, -22], [-95, 22], [-70, 0], [-110, 0]]) {
  Bx.cyl(M.steelDark, .09, .13, 10, 8, px, YARD + 5, pz); Bx.box(M.steelDark, 1.6, .08, .1, px + .7, YARD + 10, pz); Bx.box(M.steel, .9, .14, .45, px + 1.35, YARD + 9.95, pz); Bx.box(M.lamp, .8, .03, .38, px + 1.35, YARD + 9.86, pz);
}
// kontainer pengiriman (bahan bergelombang bertinta)
function shipContainer(x, z, color, rot = 0, stack = 1) {
  const m = new THREE.MeshStandardMaterial({ map: M.cladding.map, color, roughness: .6, metalness: .45, envMapIntensity: IBL }); m.userData.tile = 2.2;
  for (let s = 0; s < stack; s++) {
    Bx.box(m, 12.2, 2.6, 2.44, x, YARD + 1.3 + s * 2.6, z, 0, rot, 0);
    const cx = Math.cos(rot), sz2 = -Math.sin(rot);
    for (const o of [-6.1, 6.1]) { Bx.box(M.steelDark, .12, 2.65, 2.5, x + o * cx, YARD + 1.3 + s * 2.6, z + o * sz2, 0, rot, 0); }
  }
}
shipContainer(-84, -37.4, 0x2b5ea8, 0, 2); shipContainer(-84, 37.4, 0xb4412e, 0, 1); shipContainer(-70, 37.4, 0x2f7d58, 0, 2); shipContainer(-96, -37.4, 0xc9c3b4, 0, 1);
// semak, tong sampah luar, rak palet kosong di luar
for (const [px, pz] of [[-114, -16], [-114, -4], [-118, 12], [-112, 14]]) Bx.sph(new THREE.MeshStandardMaterial({ color: 0x2f5a30, roughness: .95 }), 1.1, px, YARD + .8, pz, 1.4, .8, 1.2);
// tiang rambu + bangunan utilitas kecil
Bx.box(M.slab, 4, 3, 4, 58, YARD + 1.5, -38); Bx.box(M.steelDark, 4.3, .2, 4.3, 58, YARD + 3.1, -38);

/* tangki udara dan kompresor di luar sisi timur (utilitas) */
Bx.cyl(M.steel, 1.2, 1.2, 5, 20, 56, YARD + 2.5, 20, 0, 0, Math.PI / 2); Bx.sph(M.steel, 1.2, 53.5, YARD + 2.5, 20); Bx.sph(M.steel, 1.2, 58.5, YARD + 2.5, 20);
for (const px of [54.5, 57.5]) Bx.box(M.steelDark, .3, 1.4, 1.8, px, YARD + .7, 20);

/* --- flush semua batch ke scene --- */
Bw.flush(scene); BsF.flush(HALL.southFull); BsL.flush(HALL.southLow); Br.flush(HALL.roof, { cast: false }); Bo.flush(scene); Bx.flush(scene);

/* unggah tekstur nyata (bertahap): lantai + kulit dinding dahulu, aspal dan kayu menyusul */
AM.pbr('concrete_floor_worn_001', 1).then(s => { applyPBR(M.floor, s, { normalScale: .8 }); applyPBR(M.slab, s, { normalScale: .5, color: 0xd0d0d0 }); });
AM.pbr('corrugated_iron', 1).then(s => { applyPBR(M.cladding, s, { roughness: 1, normalScale: .9 }); applyPBR(M.roofMetal, s, { roughness: 1 }); M.cladding.metalness = .35; M.roofMetal.metalness = .35; });
AM.pbr('asphalt_04', 4).then(s => applyPBR(M.asphalt, s, { normalScale: .9, color: 0xb4b8be }));
AM.pbr('wood_planks', 4).then(s => applyPBR(M.wood, s, { normalScale: .8 }));
