'use strict';
/* =====================================================================
   zones.js — palet & muatan, rak selektif (state slot nyata), staging,
   dudukan serah-terima AMR, CHG-BAY, OPS-CTRL, packing, maintenance,
   stasiun keselamatan, railing jalur pejalan kaki.
   ===================================================================== */
const Bz = new Batcher();
const ZONES = { update() { }, anim: [] };

/* ---------- geometri muatan bersama ---------- */
function geoFrom(fn) { const b = new Batcher(); fn(b); const first = [...b.lists.values()][0]; b.lists.clear(); return mergeGeos(first); }
const CARGO = {
  pallet: geoFrom(b => {                                          // palet kayu: 5 papan atas, 3 papan bawah, 9 blok
    for (let i = -2; i <= 2; i++) b.box(M.wood, 1.25, .022, .19, 0, .139, i * .27);
    for (const z of [-.5, 0, .5]) b.box(M.wood, 1.25, .022, .14, 0, .011, z);
    for (const x of [-.54, 0, .54]) for (const z of [-.5, 0, .5]) b.box(M.wood, .13, .105, .14, x, .075, z);
  }),
  cartons: geoFrom(b => { for (let l = 0; l < 2; l++) for (const x of [-.275, .275]) for (const z of [-.275, .275]) b.box(M.cartonRaw, .535, .43, .535, x, .15 + .215 + l * .435, z); }),
  carton1: geoFrom(b => b.box(M.cartonRaw, .535, .43, .535, 0, 0, 0)),
  wrap: geoFrom(b => b.box(M.wrap, 1.1, .9, 1.1, 0, .15 + .45, 0))
};
const cartonMat = type => type === 'raw' ? M.cartonRaw : M.cartonFg;
/** satu unit muatan: palet + 8 karton + stretch film. withPallet=false untuk karton di sabuk. */
function createCargoUnit(type = 'raw', withPallet = true) {
  const g = new THREE.Group(), y = withPallet ? 0 : -.15;
  if (withPallet) { const p = new THREE.Mesh(CARGO.pallet, M.wood); p.castShadow = p.receiveShadow = true; g.add(p); }
  const c = new THREE.Mesh(CARGO.cartons, cartonMat(type)); c.position.y = y; c.castShadow = c.receiveShadow = true; g.add(c);
  if (withPallet) { const w = new THREE.Mesh(CARGO.wrap, M.wrap); w.receiveShadow = false; g.add(w); }
  g.userData.cartons = c; g.userData.type = type;
  return g;
}
function createCarton(type) { const m = new THREE.Mesh(CARGO.carton1, cartonMat(type)); m.castShadow = m.receiveShadow = true; return m; }
/** satu karton di sabuk konveyor (hasil depalet); asal grup ada di permukaan sabuk */
function createBeltItem(type) { const g = new THREE.Group(), m = createCarton(type); m.position.y = .215; g.add(m); g.userData.cartons = m; g.userData.type = type; return g; }
function setSlotCargo(slot, type) { while (slot.children.length) slot.remove(slot.children[0]); if (type) slot.add(createCargoUnit(type, true)); }

/* =====================================================================
   RAK SELEKTIF (3 tingkat) + slot dengan state nyata (InstancedMesh)
   ===================================================================== */
const RACK = { bayW: 2.7, tiers: 3, tierH: 2.15, depth: 1.65, startX: -28, bays: 6, raw: null, fg: null };
function rackFrames(B, z) {
  const { bayW, tiers, tierH, depth, startX, bays } = RACK, H = tiers * tierH + .4;
  for (let b = 0; b <= bays; b++) {
    const x = startX + b * bayW;
    for (const dz of [-depth / 2, depth / 2]) {
      B.box(M.rackBlue, .1, H, .08, x, H / 2, z + dz);
      B.box(M.steelDark, .2, .02, .16, x, .01, z + dz);                             // pelat dasar
      for (let k = 0; k < 6; k++) B.box(M.black, .012, .035, .082, x + .0, .6 + k * 1.1, z + dz);       // lubang perforasi
    }
    for (let t = 0; t <= tiers; t++) B.box(M.rackBlue, .05, .05, depth, x, .45 + t * tierH, z);        // pengikat horizontal
    for (let t = 0; t < tiers; t++) {                                                                  // bracing diagonal
      const y0 = .45 + t * tierH, y1 = y0 + tierH, len = Math.hypot(depth, tierH);
      B.box(M.rackBlue, .04, .04, len, x, (y0 + y1) / 2, z, (t % 2 ? 1 : -1) * Math.atan2(tierH, depth), 0, 0);
    }
    // pelindung tiang (kuning) di kaki rak
    for (const dz of [-depth / 2, depth / 2]) B.box(M.yellow, .2, .42, .17, x, .21, z + dz);
  }
  for (let b = 0; b < bays; b++) {
    const xc = startX + b * bayW + bayW / 2;
    for (let t = 0; t < tiers; t++) {
      const y = t * tierH + .15;
      for (const dz of [-depth / 2 + .05, depth / 2 - .05]) B.box(M.rackOrange, bayW - .08, .12, .06, xc, y, z + dz);
      for (const dx of [-.5, .5]) B.box(M.steel, .06, .035, depth - .1, xc + dx, y + .0775, z);          // palang penopang palet
    }
  }
}
function buildRackType(type, rows, aisleZ) {
  const { bayW, tiers, tierH, startX, bays } = RACK, slots = [];
  for (const z of rows) {
    rackFrames(Bz, z);
    for (let b = 0; b < bays; b++) for (let t = 0; t < tiers; t++) slots.push({ x: startX + b * bayW + bayW / 2, y: t * tierH + .15 + .0975 + .0, z, tier: t, aisleZ, occ: false, rot: (rand() * 4 | 0) * Math.PI / 2, idx: slots.length });
  }
  const N = slots.length, mk = (geo, mat, shadow) => { const m = new THREE.InstancedMesh(geo, mat, N); m.castShadow = shadow; m.receiveShadow = true; m.frustumCulled = false; scene.add(m); return m; };
  const R = { type, slots, aisleZ, occ: 0, pal: mk(CARGO.pallet, M.wood, true), car: mk(CARGO.cartons, cartonMat(type), true), wr: mk(CARGO.wrap, M.wrap, false) };
  R.setOcc = (s, on) => {
    if (s.occ !== on) R.occ += on ? 1 : -1; s.occ = on;
    const m = xf(s.x, s.y, s.z, 0, s.rot, 0, on ? 1 : 0, on ? 1 : 0, on ? 1 : 0);
    R.pal.setMatrixAt(s.idx, m); R.car.setMatrixAt(s.idx, m); R.wr.setMatrixAt(s.idx, m);
    R.pal.instanceMatrix.needsUpdate = R.car.instanceMatrix.needsUpdate = R.wr.instanceMatrix.needsUpdate = true;
  };
  slots.forEach(s => R.setOcc(s, false));
  return R;
}
function pickSlots(R, count) {                                      // sebar acak, lebih banyak di tingkat bawah
  const pool = R.slots.slice().sort(() => rand() - .5).sort((a, b) => (a.tier * rand()) - (b.tier * rand()));
  pool.slice(0, count).forEach(s => R.setOcc(s, true));
}
RACK.raw = buildRackType('raw', [-24.5, -15.5], -20); pickSlots(RACK.raw, 22);
RACK.fg = buildRackType('fg', [15.5, 24.5], 20); pickSlots(RACK.fg, 10);
RACK.free = (type, nearX) => { const R = RACK[type]; let best = null, bd = 1e9; for (const s of R.slots) if (!s.occ) { const d = Math.abs(s.x - nearX) + s.tier * .6 + rand() * .4; if (d < bd) { bd = d; best = s; } } return best; };
RACK.taken = (type, nearX) => { const R = RACK[type]; let best = null, bd = 1e9; for (const s of R.slots) if (s.occ) { const d = Math.abs(s.x - nearX) + s.tier * .5 + rand() * .4; if (d < bd) { bd = d; best = s; } } return best; };

// pelindung ujung rak + papan lorong
for (const z of [-24.5, -15.5, 15.5, 24.5]) {
  const dir = z < 0 ? -1 : 1;
  Bz.box(M.hazard, .22, .9, 1.9, -10.9, .45, z); Bz.box(M.yellow, .08, .08, 2.0, -10.8, .9, z);
}
const zoneSigns = new THREE.Group(); scene.add(zoneSigns);
signPlane(zoneSigns, 'info', 'RM-WH', 'Lorong A  Rak 1-2', -11.1, 6.2, -20, Math.PI / 2, 1.0);
signPlane(zoneSigns, 'info', 'FG-WH', 'Lorong B  Rak 3-4', -11.1, 6.2, 20, Math.PI / 2, 1.0);

/* =====================================================================
   STAGING IN / OUT (isi mengikuti sim.stgIn / sim.stgOut)
   ===================================================================== */
const stgInVisual = new THREE.Group(); stgInVisual.position.set(-37.2, 0, -12); scene.add(stgInVisual);
const stgOutVisual = new THREE.Group(); stgOutVisual.position.set(-37.2, 0, 12); scene.add(stgOutVisual);
const stgInAlertFloor = new THREE.Mesh(new THREE.PlaneGeometry(6.0, 5.6), new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0, depthWrite: false }));
stgInAlertFloor.rotation.x = -Math.PI / 2; stgInAlertFloor.position.set(-37.2, .03, -12); scene.add(stgInAlertFloor);
const stgOutAlertFloor = stgInAlertFloor.clone(); stgOutAlertFloor.material = stgInAlertFloor.material.clone(); stgOutAlertFloor.position.set(-37.2, .03, 12); scene.add(stgOutAlertFloor);
function fillStaging(group, count, type) {
  while (group.children.length) { const c = group.children[0]; group.remove(c); }
  for (let i = 0; i < Math.min(count, 9); i++) {
    const c = createCargoUnit(type, true), col = i % 3, row = Math.floor(i / 3) % 2, tier = Math.floor(i / 6);
    c.position.set((col - 1) * 1.65, tier * 1.05, (row - .5) * 1.7); c.rotation.y = ((i * 37) % 7 - 3) * .012; group.add(c);
  }
}
function refreshStaging() { fillStaging(stgInVisual, sim.stgIn, 'raw'); fillStaging(stgOutVisual, sim.stgOut, 'fg'); }

/* =====================================================================
   DUDUKAN SERAH-TERIMA (AMR masuk di bawahnya), depalet di kepala konveyor,
   penumpukan palet di ujung konveyor
   ===================================================================== */
function standFrame(B, x, z) {
  for (const sx of [-.8, .8]) for (const sz of [-.8, .8]) B.box(M.steelDark, .07, .5, .07, x + sx, .25, z + sz);
  B.box(M.steelDark, 1.7, .06, .07, x, .47, z - .8); B.box(M.steelDark, 1.7, .06, .07, x, .47, z + .8);
  B.box(M.steelDark, .07, .06, 1.7, x - .8, .47, z); B.box(M.steelDark, .07, .06, 1.7, x + .8, .47, z);
  B.box(M.hazard, 1.9, .012, 1.9, x, .006, z);
}
const ST = {
  rawIn: { x: -2.5, z: -12, unit: null }, fgOut: { x: -2.5, z: 12, unit: null },
  head: { x: 10, z: -12, count: 0, pal: null, cartons: [] }, end: { x: 10, z: 12, count: 0, pal: null, cartons: [], complete: false }
};
for (const s of [ST.rawIn, ST.fgOut, ST.head, ST.end]) standFrame(Bz, s.x, s.z);
function palletOnly() { const p = new THREE.Mesh(CARGO.pallet, M.wood); p.castShadow = p.receiveShadow = true; return p; }
for (const k of ['rawIn', 'fgOut']) {
  const s = ST[k], u = createCargoUnit(k === 'rawIn' ? 'raw' : 'fg', true); u.position.set(s.x, .5, s.z); u.visible = false; scene.add(u); s.unit = u;
  s.has = () => u.visible; s.put = on => { u.visible = on; };
}
ST.rawIn.put(true);                              // satu palet bahan baku sudah menunggu AMR
(function initStack(s, type) {
  s.pal = palletOnly(); s.pal.position.set(s.x, .5, s.z); s.pal.visible = false; scene.add(s.pal);
  for (let i = 0; i < 8; i++) { const c = createCarton(type); const l = i >> 2, q = i & 3; c.position.set(s.x + (q & 1 ? .275 : -.275), .5 + .15 + .215 + l * .435, s.z + (q & 2 ? .275 : -.275)); c.visible = false; scene.add(c); s.cartons.push(c); }
})(ST.head, 'raw');
(function initStack(s, type) {
  s.pal = palletOnly(); s.pal.position.set(s.x, .5, s.z); s.pal.visible = true; scene.add(s.pal);
  for (let i = 0; i < 8; i++) { const c = createCarton(type); const l = i >> 2, q = i & 3; c.position.set(s.x + (q & 1 ? .275 : -.275), .5 + .15 + .215 + l * .435, s.z + (q & 2 ? .275 : -.275)); c.visible = false; scene.add(c); s.cartons.push(c); }
})(ST.end, 'fg');
ST.head.load = () => { ST.head.count = 8; ST.head.pal.visible = true; ST.head.cartons.forEach(c => c.visible = true); };
ST.head.release = () => { const s = ST.head; if (s.count <= 0) return false; s.cartons[s.count - 1].visible = false; s.count--; if (s.count === 0) s.pal.visible = false; return true; };
ST.end.add = () => { const s = ST.end; if (s.count >= 8) return false; s.cartons[s.count].visible = true; s.count++; if (s.count === 8) s.complete = true; return true; };
ST.end.clear = () => { ST.end.cartons.forEach(c => c.visible = false); ST.end.count = 0; ST.end.complete = false; };

/* =====================================================================
   CHG-BAY: charger industri dengan layar dan kabel
   ===================================================================== */
for (const cx of [-25.5, -22.5]) {                                  // charger di tepi selatan bay; kendaraan masuk dari utara
  Bz.box(M.white, .75, 2.0, .62, cx, 1.0, -4.3); Bz.box(M.machineAccent, .77, .22, .64, cx, 1.78, -4.3); Bz.box(M.darkGlass, .46, .32, .02, cx, 1.35, -4.62);
  Bz.box(M.ledGreen, .12, .06, .02, cx, 1.62, -4.62); Bz.box(M.black, .18, .22, .12, cx + .52, .85, -4.62);
  Bz.cyl(M.black, .028, .028, 1.0, 6, cx + .56, .45, -4.7); Bz.box(M.black, .1, .18, .08, cx + .56, .08, -4.8);
  Bz.box(M.yellow, .18, .9, .18, cx - .98, .45, -5.2); Bz.box(M.yellow, .18, .9, .18, cx + .98, .45, -5.2);
}
signPlane(zoneSigns, 'info', 'CHG-BAY', 'Charging forklift & AMR', -24, 2.6, -4.15, Math.PI, .9);

/* =====================================================================
   OPS-CTRL: ruang kontrol prefab berdinding kaca (-15, -6), 5.5 x 4.2
   ===================================================================== */
(function office() {
  const ox = -15, oz = -6, w = 5.5, d = 4.2, y0 = .28;
  Bz.box(M.steelDark, w + .2, y0, d + .2, ox, y0 / 2, oz);                                    // pondasi baja
  Bz.box(M.office, w, 1.0, d, ox, y0 + .5, oz);                                               // panel bawah
  for (const s of [-1, 1]) { Bz.box(M.darkGlass, w - .1, 1.1, .05, ox, y0 + 1.55, oz + s * (d / 2)); Bz.box(M.darkGlass, .05, 1.1, d - .1, ox + s * (w / 2), y0 + 1.55, oz); }
  for (let i = -2; i <= 2; i++) { Bz.box(M.steel, .07, 1.2, .08, ox + i * w / 4.4, y0 + 1.55, oz + d / 2); Bz.box(M.steel, .07, 1.2, .08, ox + i * w / 4.4, y0 + 1.55, oz - d / 2); }
  for (const s of [-1, 1]) for (let i = -1; i <= 1; i++) Bz.box(M.steel, .08, 1.2, .07, ox + s * w / 2, y0 + 1.55, oz + i * d / 3);
  Bz.box(M.steel, w + .1, .12, d + .1, ox, y0 + 2.18, oz);
  Bz.box(M.steelDark, w + .6, .2, d + .6, ox, y0 + 2.36, oz);                                 // atap + overhang
  Bz.box(M.duct, 1.4, .6, 1.0, ox - 1.2, y0 + 2.8, oz - .5); Bz.cyl(M.steelRaw, .3, .3, .05, 12, ox - 1.2, y0 + 3.12, oz - .5);  // unit AC
  Bz.cyl(M.steelDark, .02, .02, 1.4, 5, ox + 2, y0 + 3.0, oz + 1);                            // antena
  Bz.box(M.steelDark, 1.4, .32, 1.2, ox, y0 / 2 + .05, oz + d / 2 + .8);                       // tangga masuk (2 anak tangga)
  Bz.box(M.steelDark, 1.4, .14, .6, ox, .07, oz + d / 2 + 1.1);
  Bz.box(M.office, .95, 2.0, .06, ox + 1.0, y0 + 1.0, oz + d / 2 + .02); Bz.box(M.steel, .05, .5, .05, ox + 1.35, y0 + 1.0, oz + d / 2 + .08);  // daun pintu
  // isi: meja, monitor menyala, kursi, rak
  for (const dx of [-1.6, -.4, .8]) { Bz.box(M.white, 1.0, .05, .6, ox + dx, y0 + .74, oz - 1.2); Bz.box(M.steelDark, .05, .7, .5, ox + dx - .45, y0 + .38, oz - 1.2); Bz.box(M.steelDark, .05, .7, .5, ox + dx + .45, y0 + .38, oz - 1.2);
    Bz.box(M.black, .5, .3, .03, ox + dx, y0 + 1.0, oz - 1.4); Bz.box(M.led, .46, .26, .01, ox + dx, y0 + 1.0, oz - 1.38);
    Bz.cyl(M.black, .22, .22, .06, 10, ox + dx, y0 + .5, oz - .65); Bz.cyl(M.steelDark, .03, .03, .3, 6, ox + dx, y0 + .3, oz - .65); }
  Bz.box(M.steel, 2.2, 1.9, .4, ox + 1.7, y0 + .95, oz - 1.8);                                 // lemari berkas
  Bz.box(M.lamp, 1.2, .03, .3, ox - 1, y0 + 2.1, oz); Bz.box(M.lamp, 1.2, .03, .3, ox + 1, y0 + 2.1, oz);
})();

/* =====================================================================
   PACKING (-42, 27) dan MAINTENANCE (-42, -27)
   ===================================================================== */
(function packing() {
  for (const [tx, tz] of [[-41, 28.5], [-41, 26.2]]) {
    Bz.box(M.steel, 2.0, .06, .85, tx, .92, tz); for (const [lx, lz] of [[-.9, -.35], [.9, -.35], [-.9, .35], [.9, .35]]) Bz.box(M.steelDark, .06, .9, .06, tx + lx, .45, tz + lz);
    Bz.box(M.steelDark, 2.0, .04, .8, tx, .28, tz);
    Bz.box(M.cartonRaw, .5, .35, .4, tx - .5, 1.13, tz); Bz.box(M.cartonFg, .4, .25, .35, tx + .3, 1.08, tz);
    Bz.box(M.black, .35, .08, .28, tx + .75, .99, tz - .1); Bz.box(M.white, .3, .02, .22, tx + .75, 1.04, tz - .1);   // printer label
  }
  // stretch wrapper: turntable + tiang film (berputar)
  const tt = new THREE.Group(); tt.position.set(-42.2, 0, 24.9);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.2, .1, 28), M.steelDark); base.position.y = .05; base.castShadow = base.receiveShadow = true;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, .03, 28), M.steel); top.position.y = .115; top.castShadow = top.receiveShadow = true;
  tt.add(base, top);
  const unit = createCargoUnit('fg', true); unit.position.y = .13; unit.userData.noWrap = true; tt.add(unit); scene.add(tt);
  Bz.box(M.steelDark, .1, 2.8, .1, -43.9, 1.4, 24.9); Bz.box(M.white, .22, .6, .2, -43.9, 1.6, 24.9); Bz.cyl(M.steelDark, .13, .13, .5, 12, -43.7, 1.6, 24.9, 0, 0, 0);
  Bz.box(M.yellow, .14, 1.0, .14, -43.9, .5, 23.5); Bz.box(M.yellow, .14, 1.0, .14, -43.9, .5, 26.3);
  ZONES.wrapper = tt;
  // tumpukan palet kosong dan karton lipat
  for (let i = 0; i < 7; i++) { const p = palletOnly(); p.position.set(-40.2, i * .15, 29.4); p.rotation.y = (i % 2) * .05; scene.add(p); }
  for (let i = 0; i < 4; i++) { const p = palletOnly(); p.position.set(-44.0, i * .15, 28.9); scene.add(p); }
  Bz.box(M.cartonRaw, 1.2, .03, .9, -43.8, .18, 26.4);
  Bz.cyl(M.steelDark, .3, .3, .5, 12, -44.4, .25, 29.9); Bz.cyl(M.steelDark, .29, .3, .08, 12, -44.4, .52, 29.9);   // tempat sampah
})();
(function maintenance() {
  Bz.box(M.steel, 2.6, .06, .9, -41.5, .95, -29.4); for (const [lx, lz] of [[-1.2, -.4], [1.2, -.4], [-1.2, .4], [1.2, .4]]) Bz.box(M.steelDark, .07, .93, .07, -41.5 + lx, .465, -29.4 + lz);
  Bz.box(M.steelDark, 2.5, .05, .8, -41.5, .3, -29.4); Bz.box(M.red, .9, .32, .5, -41.0, 1.14, -29.4); Bz.box(M.steelRaw, .26, .2, .22, -42.3, 1.08, -29.5);  // meja kerja + kotak alat + ragum
  Bz.box(M.steelRaw, .3, .05, .15, -42.3, 1.19, -29.5);
  // rak suku cadang
  for (let t = 0; t < 4; t++) Bz.box(M.rackBlue, 2.2, .04, .5, -46.2, .4 + t * .55, -27.3); for (const [px, pz] of [[-47.2, -27.55], [-47.2, -27.05], [-45.2, -27.55], [-45.2, -27.05]]) Bz.box(M.rackBlue, .05, 2.3, .05, px, 1.15, pz);
  for (let t = 0; t < 3; t++) { Bz.box(M.cartonRaw, .45, .3, .4, -46.8, .58 + t * .55, -27.3); Bz.box(M.cartonFg, .4, .3, .35, -45.7, .58 + t * .55, -27.3); }
  // tabung gas dalam rantai
  for (const [gx, gc] of [[-44.4, M.pipeBlue], [-43.9, M.red]]) { Bz.cyl(gc, .1, .1, 1.3, 12, gx, .65, -31); Bz.sph(gc, .1, gx, 1.3, -31); Bz.cyl(M.steelRaw, .03, .03, .1, 6, gx, 1.42, -31); }
  Bz.box(M.steelDark, 1.0, .05, .05, -44.15, .9, -31); Bz.box(M.hazard, 1.0, .02, .6, -44.15, .01, -30.4);
  // pos eyewash dan P3K
  Bz.box(M.green, .5, .12, .3, -47.3, 1.5, -24.8); Bz.cyl(M.green, .05, .05, 1.1, 8, -47.0, .55, -24.8); Bz.sph(M.green, .09, -47.0, 1.05, -24.8);
  Bz.box(M.white, .45, .55, .2, -48.7, 1.55, -25.9);
})();

/* =====================================================================
   STASIUN KESELAMATAN (APAR, hose reel, panel listrik, cermin cembung, papan)
   ===================================================================== */
const mirrorMat = new THREE.MeshStandardMaterial({ color: 0xdfe8ee, metalness: 1, roughness: .04, envMapIntensity: 1.8 });
function convexMirror(x, z, face) {
  Bz.cyl(M.steelDark, .04, .05, 2.6, 8, x, 1.3, z); Bz.cyl(M.yellow, .31, .31, .04, 24, x, 2.55, z, Math.PI / 2, face, 0);
  const m = new THREE.Mesh(new THREE.SphereGeometry(.28, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2.4), mirrorMat); m.position.set(x, 2.55, z); m.rotation.set(Math.PI / 2, 0, 0); m.rotation.order = 'YXZ'; m.rotation.y = face; scene.add(m);
}
convexMirror(-10.7, -14.3, Math.PI * .75); convexMirror(-5.3, -9.7, Math.PI * .25 * -1); convexMirror(-10.7, 9.7, Math.PI * .75); convexMirror(-5.3, 14.3, -Math.PI * .25);
convexMirror(-34.4, 1.9, -Math.PI * .5); convexMirror(12.6, 1.9, Math.PI * .5 * -1);

function fireStation(x, z, ry) {                                       // papan APAR + hose reel di dinding
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(.55, .06, .06), M.steelDark); bar.position.set(0, 1.02, .05); g.add(bar);
  signPlane(g, 'fire', 'APAR', 'Alat pemadam', 0, 2.0, .02, 0, .5);
  const reel = new THREE.Mesh(new THREE.BoxGeometry(.6, .8, .22), M.red); reel.position.set(.75, 1.2, .12); reel.castShadow = true; g.add(reel);
  const disk = new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, .1, 16), M.white); disk.rotation.x = Math.PI / 2; disk.position.set(.75, 1.2, .24); g.add(disk);
  const ext = fallbackExtinguisher(); ext.position.set(0, .95, .12); g.add(ext);
  g.userData.ext = ext; return g;
}
function fallbackExtinguisher() {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.CylinderGeometry(.075, .075, .38, 14), M.red); b.position.y = .22; b.castShadow = true; g.add(b);
  const n = new THREE.Mesh(new THREE.CylinderGeometry(.03, .06, .08, 10), M.steelRaw); n.position.y = .45; g.add(n);
  const h = new THREE.Mesh(new THREE.BoxGeometry(.12, .03, .03), M.black); h.position.set(.04, .5, 0); g.add(h);
  g.userData.fallback = true; return g;
}
const fire1 = fireStation(-47.4, -29.5, Math.PI / 2), fire2 = fireStation(47.9, -5.2, -Math.PI / 2), fire3 = fireStation(-28.5, -31.5, 0), fire4 = fireStation(18, -31.5, 0);
// panel listrik (MDP) + tanda bahaya, diberi area bebas di lantai
function electricalPanel(x, z, ry) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
  for (let i = 0; i < 2; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(.9, 2.0, .5), M.machine); b.position.set(i * .95, 1.0, .25); b.castShadow = b.receiveShadow = true; g.add(b);
    const d = new THREE.Mesh(new THREE.BoxGeometry(.04, .2, .02), M.steelDark); d.position.set(.32 + i * .95, 1.0, .52); g.add(d); }
  signPlane(g, 'panel', 'PANEL LISTRIK', 'Awas bahaya listrik', .47, 2.3, .02, 0, .5);
  g.userData.fallback = true; return g;
}
const panelA = electricalPanel(47.5, -3.1, -Math.PI / 2), panelB = electricalPanel(-2.4, 31.4, Math.PI);
// papan tanda pada kolom utara dan timur
for (let xx = -35; xx <= 25; xx += 20) signPlane(zoneSigns, 'warn', 'FORKLIFT', 'Awas lalu lintas', xx, 2.5, -31.35, 0, .6);
signPlane(zoneSigns, 'ppe', 'WAJIB APD', 'Helm, rompi, sepatu', 48.28, 2.4, -22, -Math.PI / 2, .6);
signPlane(zoneSigns, 'first', 'P3K', 'Kotak pertolongan', -48.82, 1.7, -25.9, Math.PI / 2, .45);
signPlane(zoneSigns, 'exit', 'EXIT', 'Pintu darurat', 48.78, 3.0, 17, -Math.PI / 2, .7);

/* railing pejalan kaki (kuning) + bollard di sudut zebra */
(function railings() {
  const rail = (x1, x2, z) => {
    for (const y of [.52, .98]) Bz.box(M.yellow, Math.abs(x2 - x1), .06, .06, (x1 + x2) / 2, y, z);
    Bz.box(M.yellow, Math.abs(x2 - x1), .14, .02, (x1 + x2) / 2, .08, z);
    for (let px = x1; px <= x2 + .01; px += 2) { Bz.box(M.yellow, .07, 1.04, .07, px, .52, z); Bz.box(M.steelDark, .16, .02, .16, px, .01, z); }
  };
  rail(-29.4, -10.6, -1.25); rail(-29.4, -10.6, 1.25); rail(-0.2, 7.8, -1.25); rail(-0.2, 7.8, 1.25);
  for (const zc of [-32, -8, -2.5, 10]) for (const bx of [zc - 2.2, zc + 2.2]) for (const bz of [-1.45, 1.45]) { Bz.cyl(M.hazard, .1, .1, 1.0, 10, bx, .5, bz); Bz.cyl(M.yellow, .105, .105, .1, 10, bx, 1.0, bz); }
})();

/* area istirahat kecil + dispenser air di dekat kantor */
Bz.box(M.white, .45, 1.1, .4, -11.4, .55, -3.0); Bz.box(M.pipeBlue, .3, .35, .3, -11.4, 1.28, -3.0);

Bz.flush(scene);

/* =====================================================================
   MODEL NYATA (Poly Haven CC0): ditambahkan setelah termuat, cadangan procedural di atas
   ===================================================================== */
function placeModel(parent, obj, x, y, z, ry = 0, h = null) {
  obj.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(obj);
  if (h) { obj.scale.multiplyScalar(h / (box.max.y - box.min.y)); obj.updateMatrixWorld(true); box = new THREE.Box3().setFromObject(obj); }
  const c = box.getCenter(new THREE.Vector3()), g = new THREE.Group();
  obj.position.sub(new THREE.Vector3(c.x, box.min.y, c.z)); g.add(obj); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g); return g;
}
AM.inst('korean_fire_extinguisher_01', 6).then(m => {
  if (!m) return;
  for (const st of [fire1, fire2, fire3, fire4]) { const old = st.userData.ext; old.visible = false; placeModel(st, m.clone(true), 0, .95, .12, 0, .55); }
});
AM.inst('power_box_01', 6).then(m => {
  if (!m) return;
  for (const [p, x, z, ry] of [[panelA, 47.5, -4.9, -Math.PI / 2], [panelB, -4.4, 31.3, Math.PI]]) { p.children.forEach(c => { if (c.isMesh && c.geometry.type === 'BoxGeometry') c.visible = false; }); placeModel(scene, m.clone(true), x, 0, z, ry, 1.3); }
});
AM.inst('Barrel_01', 6).then(m => {
  if (!m) return;
  const spill = new THREE.Mesh(new THREE.BoxGeometry(1.4, .12, 1.4), M.yellow); spill.position.set(-47.3, .06, -22); spill.castShadow = spill.receiveShadow = true; scene.add(spill);
  for (const [bx, bz] of [[-47.65, -22.3], [-46.95, -22.3], [-47.65, -21.7], [-46.95, -21.7]]) placeModel(scene, m.clone(true), bx, .12, bz, rand() * 6, .9);
});
AM.inst('cardboard_box_01', 6).then(m => {
  if (!m) return;
  for (const [bx, bz, s] of [[-39.4, 31.2, .5], [-39.9, 31.2, .42], [-39.65, 31.2, .38]]) placeModel(scene, m.clone(true), bx, s < .4 ? .55 : s < .45 ? .5 : 0, bz, rand() * 6, s);
});
AM.inst('portable_welding_cart', 7).then(m => { if (m) placeModel(scene, m, -37.6, 0, -30.2, 2.6, 1.35); });
AM.inst('industrial_storage_cart', 7).then(m => { if (m) placeModel(scene, m, -37.0, 0, 27.2, -.4, 1.1); });
