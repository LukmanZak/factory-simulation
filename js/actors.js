'use strict';
/* =====================================================================
   actors.js — forklift counterbalance, AMR, pekerja berartikulasi, truk + trailer
   ===================================================================== */
const ACT = { forklifts: [], workers: [], trucks: [] };

function addMesh(parent, geo, mat, x, y, z, cast = true) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m; }
function labelTex(text, bg, fg, w = 256, h = 64, font = 'bold 40px Arial') {
  const c = cv(w, h), x = c.getContext('2d'); x.fillStyle = bg; x.fillRect(0, 0, w, h); x.fillStyle = fg; x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, w / 2, h / 2 + 2);
  x.strokeStyle = fg; x.lineWidth = 3; x.strokeRect(3, 3, w - 6, h - 6); return cTex(c, true, false);
}
const spotTex = (() => { const c = cv(128, 128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(120,200,255,.95)'); g.addColorStop(.5, 'rgba(70,160,255,.45)'); g.addColorStop(1, 'rgba(70,160,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return cTex(c, true, false); })();

/* =====================================================================
   FORKLIFT counterbalance 2 ton: overhead guard, mast 3 tahap, garpu, ban, operator
   Maju = +z. userData lama dipertahankan: carriage, cargoSlot, beacon, blueSpot.
   ===================================================================== */
function createForklift(id, bodyColor) {
  const fk = new THREE.Group(), B = new Batcher();
  const paint = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: .34, metalness: .28, envMapIntensity: IBL });
  const dark = new THREE.MeshStandardMaterial({ color: 0x23272d, roughness: .45, metalness: .5, envMapIntensity: IBL });
  // sasis, sayap ban, dasbor, lantai
  B.box(paint, 1.12, .6, 2.0, 0, .58, -.04); B.box(dark, 1.14, .08, 1.9, 0, .27, -.04);
  for (const s of [-1, 1]) { B.box(paint, .36, .16, .9, s * .58, .88, .72); B.box(dark, .38, .03, .9, s * .58, .8, .72); }
  B.box(paint, .96, .54, .34, 0, 1.12, .62); B.box(M.black, .9, .06, .3, 0, 1.4, .6, -.35, 0, 0);
  B.box(M.darkGlass, .26, .14, .02, 0, 1.28, .46, -.5, 0, 0); B.box(M.ledAmber, .05, .03, .02, .14, 1.355, .45, -.5, 0, 0);
  B.box(dark, .96, .05, .68, 0, .91, .1);                                                               // pijakan lantai
  // counterweight berbentuk membulat + bemper belakang
  B.box(paint, 1.28, .78, .78, 0, .86, -1.0); B.box(paint, 1.2, .16, .7, 0, 1.33, -1.0); B.box(dark, 1.22, .04, .72, 0, 1.43, -1.0);
  B.box(M.rubber, 1.2, .12, .06, 0, .52, -1.41); B.box(M.hazard, 1.0, .1, .02, 0, .68, -1.402);
  for (const s of [-1, 1]) { B.box(M.ledRed, .14, .09, .04, s * .5, 1.0, -1.4); B.box(M.white, .1, .07, .04, s * .5, .62, -1.41); }
  // kursi
  B.box(M.black, .5, .14, .48, 0, 1.0, -.28); B.box(M.black, .5, .64, .1, 0, 1.36, -.55, -.18, 0, 0); B.box(dark, .4, .12, .4, 0, .9, -.28);
  // overhead guard
  for (const sx of [-.56, .56]) for (const [pz, lean] of [[.62, .06], [-.5, -.03]]) B.box(dark, .05, 1.12, .05, sx, 1.62, pz, lean, 0, 0);
  for (const sx of [-.56, .56]) B.box(dark, .06, .05, 1.28, sx, 2.17, .06);
  for (let i = -5; i <= 5; i++) B.box(dark, .028, .028, 1.24, i * .1, 2.185, .06);
  for (const pz of [-.55, .0, .68]) B.box(dark, 1.16, .05, .05, 0, 2.17, pz);
  B.box(M.black, .4, .04, .03, 0, 1.5, .56, 0, 0, 0);
  for (const s of [-1, 1]) { B.box(dark, .1, .08, .08, s * .64, 2.02, .68); B.box(M.lamp, .06, .05, .02, s * .64, 2.02, .73); }   // lampu kerja
  B.cyl(M.steelRaw, .012, .012, .28, 5, .67, 1.68, .55);                                                // spion
  B.box(M.black, .12, .09, .02, .68, 1.82, .55);
  // mast tahap luar + silinder hidrolik + panel bawah
  for (const sx of [-.42, .42]) { B.box(dark, .1, 2.14, .16, sx, 1.2, 1.17); B.box(M.steelRaw, .04, 1.1, .04, sx * .5, 1.2, 1.05); }
  B.box(dark, 1.0, .1, .14, 0, .3, 1.17); B.box(dark, .98, .09, .14, 0, 2.22, 1.17);
  // steer axle belakang + penutup kabel
  B.box(dark, 1.0, .12, .12, 0, .3, -.92); B.box(dark, .6, .12, .12, 0, .3, .72);
  B.flush(fk);

  // decal ID unit di counterweight dan di sisi
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(.5, .125), new THREE.MeshBasicMaterial({ map: labelTex(id, '#f1c40f', '#111', 256, 64) })); plate.position.set(0, .86, -1.396); plate.rotation.y = Math.PI; fk.add(plate);
  for (const s of [-1, 1]) { const d = new THREE.Mesh(new THREE.PlaneGeometry(.5, .125), plate.material); d.position.set(s * .565, .6, -.04); d.rotation.y = s * Math.PI / 2; fk.add(d); }

  // ban: ban depan besar, ban belakang kecil (poros berputar sesuai jarak tempuh)
  const wheels = [], wmk = (r, w2, x, z) => {
    const g = new THREE.Group(); g.position.set(x, r, z); fk.add(g);
    const spin = new THREE.Group(); g.add(spin); const WB = new Batcher();
    WB.cyl(M.rubber, r, r, w2, 22, 0, 0, 0, 0, 0, Math.PI / 2);
    for (let k = 0; k < 14; k++) { const a = k / 14 * 6.283; WB.box(M.rubber, w2 * 1.02, r * .1, r * .16, 0, Math.sin(a) * r * .995, Math.cos(a) * r * .995, Math.PI / 2 - a, 0, 0); }
    WB.cyl(M.hub, r * .56, r * .56, w2 + .02, 18, 0, 0, 0, 0, 0, Math.PI / 2);
    for (let k = 0; k < 5; k++) { const a = k / 5 * 6.283; WB.cyl(M.hub, .02, .02, w2 + .05, 6, 0, Math.sin(a) * r * .32, Math.cos(a) * r * .32, 0, 0, Math.PI / 2); }
    WB.flush(spin); wheels.push({ spin, r }); return g;
  };
  wmk(.37, .25, -.62, .72); wmk(.37, .25, .62, .72); wmk(.27, .2, -.54, -.92); wmk(.27, .2, .54, -.92);

  // mast bagian dalam (memanjang), rantai, carriage + garpu
  const inner = new THREE.Group(); fk.add(inner);
  const inRail = []; for (const sx of [-.36, .36]) { const r = addMesh(inner, new THREE.BoxGeometry(.075, 1, .1), dark, sx, 1.7, 1.28); inRail.push(r); }
  const inTop = addMesh(inner, new THREE.BoxGeometry(.8, .07, .1), dark, 0, 2.2, 1.28);
  const chain = addMesh(fk, new THREE.CylinderGeometry(.012, .012, 1, 5), M.steelRaw, 0, 1.5, 1.35);
  const carriage = new THREE.Group(); carriage.position.set(0, .2, 1.42); fk.add(carriage);
  const CB = new Batcher();
  CB.box(dark, 1.0, .12, .09, 0, .06, 0); for (const sx of [-.5, .5]) CB.box(dark, .06, .98, .06, sx, .5, 0);
  for (const y of [.15, .42, .7, .97]) CB.box(dark, 1.0, .05, .045, 0, y, 0);
  for (const fx of [-.33, .33]) { CB.box(dark, .12, .045, 1.14, fx, .0225, .6); CB.box(dark, .12, .44, .05, fx, .2, .03); CB.box(dark, .12, .03, .14, fx, .015, 1.24, .12, 0, 0); }
  CB.flush(carriage);
  const cargoSlot = new THREE.Group(); cargoSlot.position.set(0, .0675, .7); carriage.add(cargoSlot);

  // lampu beacon amber berputar + lampu spotter biru 4,6 m di depan garpu
  const beacon = new THREE.Group(); beacon.position.set(.5, 2.22, -.45); fk.add(beacon);
  addMesh(fk, new THREE.CylinderGeometry(.05, .06, .05, 10), M.steelDark, .5, 2.215, -.45, false);
  const bl = addMesh(beacon, new THREE.SphereGeometry(.075, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffa21a, transparent: true, opacity: .9 }), 0, .05, 0, false);
  addMesh(beacon, new THREE.BoxGeometry(.01, .06, .1), M.black, 0, .06, 0, false);
  const blueSpot = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: spotTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .8, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }));
  blueSpot.rotation.x = -Math.PI / 2; blueSpot.position.set(0, .03, 4.6); fk.add(blueSpot);

  // operator duduk
  const driver = createWorker(0xff8a1a, 0xffffff, { shirt: 0x2f3946, scale: .96 }); scene.remove(driver); ACT.workers.splice(ACT.workers.indexOf(driver), 1);
  driver.position.set(0, 1.17, -.2); poseSeated(driver); fk.add(driver);

  const setLift = h => {
    carriage.position.y = h;
    const top = Math.max(2.2, h + 1.05), bot = 1.0;
    inRail.forEach(r => { r.scale.y = top - bot; r.position.y = (top + bot) / 2; });
    inTop.position.y = top; chain.scale.y = Math.max(.05, top - (h + .98)); chain.position.y = (top + h + .98) / 2;
  };
  setLift(.2);
  fk.userData = { id, carriage, cargoSlot, beacon, blueSpot, wheels, driver, setLift, setDriverVisible(v) { driver.userData.head.visible = v; driver.userData.helmet.visible = v; } };
  scene.add(fk); ACT.forklifts.push(fk); return fk;
}
const fl1Mesh = createForklift('FL-01', 0x1d72b8);
const fl2Mesh = createForklift('FL-02', 0x1f9a66);

/* =====================================================================
   AMR (lift-AMR) dengan dek roller, scanner LiDAR dan strip LED status
   ===================================================================== */
function createAMR(num) {
  const g = new THREE.Group(), B = new Batcher();
  const paint = new THREE.MeshStandardMaterial({ color: 0xf0a000, roughness: .35, metalness: .3, envMapIntensity: IBL });
  const led = new THREE.MeshBasicMaterial({ color: 0x6fd6ff });
  B.box(M.steelDark, 1.28, .16, 1.76, 0, .15, 0); B.box(paint, 1.35, .2, 1.85, 0, .31, 0);
  for (const sx of [-.675, .675]) for (const sz of [-.925, .925]) B.cyl(paint, .06, .06, .2, 10, sx, .31, sz);
  B.box(M.rubber, 1.3, .08, .06, 0, .13, .93); B.box(M.rubber, 1.3, .08, .06, 0, .13, -.93);
  B.box(M.steelDark, 1.1, .03, 1.5, 0, .43, 0);
  for (let i = -3; i <= 3; i++) B.cyl(M.steelRaw, .032, .032, 1.12, 8, 0, .465, i * .21, 0, 0, Math.PI / 2);
  for (const sx of [-.58, .58]) B.box(M.steelDark, .05, .1, 1.5, sx, .5, 0);
  B.cyl(M.black, .1, .11, .1, 14, 0, .475, .78); B.cyl(M.steelDark, .02, .02, .08, 6, 0, .53, .78);
  for (const sx of [-.58, .58]) { B.box(M.black, .14, .07, .12, sx, .17, .92); B.box(M.black, .14, .07, .12, sx, .17, -.92); }
  B.box(M.darkGlass, .3, .12, .02, 0, .36, -.935); B.box(M.white, .1, .06, .01, .4, .37, -.94);
  B.flush(g);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(1.37, .035, 1.87), led); strip.position.set(0, .23, 0); g.add(strip);
  const decal = new THREE.Mesh(new THREE.PlaneGeometry(.55, .13), new THREE.MeshBasicMaterial({ map: labelTex('AMR-0' + num, '#161a20', '#f0a000', 256, 64, 'bold 34px Arial') }));
  for (const s of [-1, 1]) { const d = decal.clone(); d.position.set(s * .676, .32, 0); d.rotation.y = s * Math.PI / 2; g.add(d); }
  const slot = new THREE.Group(); slot.position.set(0, .5, 0); g.add(slot);
  g.userData = { slot, led: strip };
  scene.add(g); return g;
}

/* =====================================================================
   TRUK + TRAILER: kabin, sasis, trailer berdinding bergelombang, pintu belakang terbuka
   Ujung belakang trailer menghadap +x (dock). Sumbu panjang = x.
   ===================================================================== */
function createTruck(x, z, bodyHex, cabHex, loadN) {
  const t = new THREE.Group(), B = new Batcher(), yard = HALL.YARD;
  const body = new THREE.MeshStandardMaterial({ map: M.cladding.map, color: bodyHex, roughness: .5, metalness: .35, envMapIntensity: IBL }); body.userData.tile = 2;
  const cab = new THREE.MeshStandardMaterial({ color: cabHex, roughness: .32, metalness: .3, envMapIntensity: IBL });
  // sasis + dek
  for (const s of [-.8, .8]) B.box(M.steelDark, 10.4, .22, .14, 0, .98, s);
  for (let i = -4; i <= 4; i += 1.3) B.box(M.steelDark, .1, .16, 1.7, i, .98, 0);
  B.box(M.steelDark, 10.5, .12, 2.5, 0, 1.09, 0);
  // dinding trailer
  for (const s of [-1, 1]) B.box(body, 10.5, 2.55, .07, 0, 1.15 + 1.275, s * 1.275);
  B.box(body, .07, 2.55, 2.5, -5.22, 1.15 + 1.275, 0); B.box(M.white, 10.5, .08, 2.6, 0, 3.74, 0);
  for (const s of [-1, 1]) { B.box(M.steelRaw, 10.5, .08, .1, 0, 3.72, s * 1.3); B.box(M.steelRaw, 10.5, .06, .1, 0, 1.2, s * 1.3); }
  for (let i = -5; i <= 5; i += 1.75) for (const s of [-1, 1]) B.box(M.steelRaw, .06, 2.6, .06, i, 2.45, s * 1.3);
  const band = new THREE.MeshStandardMaterial({ color: cabHex, roughness: .4, metalness: .3 });
  for (const s of [-1, 1]) B.box(band, 9.0, .5, .09, -.2, 3.05, s * 1.28);
  // pintu belakang terbuka (menempel di sisi luar), rangka belakang, bumper underride
  for (const s of [-1, 1]) { B.box(M.white, 2.42, 2.5, .06, 4.0, 2.4, s * 1.4); B.box(M.steelRaw, 2.42, .06, .08, 4.0, 3.62, s * 1.4); B.box(M.steelRaw, .07, 2.5, .09, 5.2, 2.4, s * 1.4); B.cyl(M.steelRaw, .035, .035, 2.5, 6, 5.25, 2.4, s * 1.27); }
  B.box(M.steelDark, .12, .14, 2.4, 5.35, .62, 0); for (const s of [-1, 1]) { B.box(M.steelDark, .1, .55, .1, 5.3, .8, s * 1.05); B.box(M.red, .06, .1, .24, 5.3, .62, s * .9); }
  for (const s of [-1, 1]) { B.box(M.ledRed, .06, .35, .14, 5.3, 1.7, s * 1.28); B.box(M.ledAmber, .05, .12, .14, 5.3, 1.45, s * 1.28); B.box(M.white, .05, .12, .14, 5.3, 1.25, s * 1.28); }
  B.box(M.steel, .04, .5, 1.2, 5.3, .98, 0);                                                            // plat nomor
  // roda tandem 3 as, mud flap, tangki
  for (const ax of [1.8, 3.1, 4.4]) { for (const s of [-1, 1]) for (const dz of [.88, 1.2]) { B.cyl(M.rubber, .52, .52, .3, 22, ax, .52, s * dz, Math.PI / 2, 0, 0); B.cyl(M.hub, .28, .28, .32, 14, ax, .52, s * dz, Math.PI / 2, 0, 0); } B.cyl(M.steelDark, .09, .09, 2.3, 8, ax, .52, 0, Math.PI / 2, 0, 0); }
  for (const s of [-1, 1]) B.box(M.rubber, .04, .5, .55, 5.05, .45, s * 1.05);
  B.box(M.steelDark, .6, .12, .1, -4.6, .8, .0); for (const s of [-1, 1]) B.box(M.steelDark, .12, .9, .12, -4.4, .55 + .0, s * .7);   // landing gear
  // kabin cab-over + traktor
  const cx = -7.2;
  for (const s of [-1, 1]) B.box(M.steelDark, 5.2, .22, .14, -6.7, .98, s * .8);
  B.box(M.steelDark, 1.6, .1, 1.7, -5.3, 1.18, 0); B.cyl(M.steelDark, .5, .5, .08, 16, -5.3, 1.25, 0);
  B.box(cab, 2.3, 2.1, 2.45, cx, 2.15, 0); B.box(cab, 1.2, .5, 2.3, cx - .2, 3.45, 0, 0, 0, 0);                    // kabin + atap tinggi
  B.box(cab, .3, .5, 2.4, cx - 1.1, 1.3, 0);                                                                       // bumper bawah
  B.box(M.darkGlass, .05, 1.1, 2.1, cx - 1.17, 2.55, 0); for (const s of [-1, 1]) { B.box(M.darkGlass, 1.35, .8, .04, cx - .25, 2.55, s * 1.23); B.box(cab, 1.3, .06, .06, cx - .2, 2.1, s * 1.24); }
  B.box(M.steelDark, .06, .6, 1.4, cx - 1.18, 1.72, 0); B.box(M.black, .05, .32, 1.1, cx - 1.19, 1.72, 0);              // grille
  for (const s of [-1, 1]) { B.box(M.lamp, .07, .2, .42, cx - 1.18, 1.7, s * .9); B.box(M.ledAmber, .06, .1, .25, cx - 1.18, 1.4, s * .95); B.box(M.black, .1, .5, .12, cx - 1.05, 2.5, s * 1.4); B.box(M.steelRaw, .08, .5, .04, cx - .9, 2.6, s * 1.42); }
  for (const s of [-1, 1]) B.cyl(M.steelRaw, .3, .3, 1.15, 14, cx + .7, .85, s * 1.18, 0, 0, Math.PI / 2);          // tangki solar
  B.cyl(M.steelRaw, .07, .07, 2.7, 8, cx + 1.25, 2.45, 1.15);                                                      // knalpot tegak
  for (const dz of [-.88, .88]) { B.cyl(M.rubber, .55, .55, .34, 22, cx - .5, .55, dz * 1.25, Math.PI / 2, 0, 0); B.cyl(M.hub, .3, .3, .36, 14, cx - .5, .55, dz * 1.25, Math.PI / 2, 0, 0); }
  for (const ax of [-6.3, -5.0]) for (const s of [-1, 1]) for (const dz of [.88, 1.18]) { B.cyl(M.rubber, .55, .55, .3, 22, ax, .55, s * dz, Math.PI / 2, 0, 0); B.cyl(M.hub, .3, .3, .32, 14, ax, .55, s * dz, Math.PI / 2, 0, 0); }
  B.cyl(M.steelDark, .09, .09, 2.4, 8, -6.3, .55, 0, Math.PI / 2, 0, 0); B.cyl(M.steelDark, .09, .09, 2.4, 8, -5.0, .55, 0, Math.PI / 2, 0, 0); B.cyl(M.steelDark, .09, .09, 2.5, 8, cx - .5, .55, 0, Math.PI / 2, 0, 0);
  B.flush(t);
  // muatan di dalam trailer (terlihat dari pintu belakang): loadN palet
  const colsX = [-4.0, -2.7, -1.4, -.1, 1.2]; let n = 0;
  for (let ci = 0; ci < colsX.length && n < loadN; ci++) for (const dz of [-.62, .62]) { if (n >= loadN) break; const u = createCargoUnit(loadN > 4 ? 'raw' : 'fg', true); u.position.set(colsX[ci] + (loadN > 5 ? 0 : 3.4), 1.15, dz); u.rotation.y = Math.PI / 2; t.add(u); n++; }
  t.position.set(x, yard, z); scene.add(t); ACT.trucks.push(t); return t;
}
createTruck(-54.55, -12, 0xf1f4f7, 0x1d5fb4, 8);
createTruck(-54.55, 12, 0xe9eef2, 0xc8651b, 3);

/* =====================================================================
   OPERATOR (pemain), NPC pejalan kaki di PED-PATH, dan pekerja di stasiun
   ===================================================================== */
const operator = createWorker(0xb8e824, 0xffd21a); operator.position.set(-14, 0, 0);
const npcWorkers = [
  { id: 'Pekerja-01', mesh: createWorker(0xff7a1a, 0xffffff, { dark: true }), xMin: -36, xMax: 14, dir: 1, spd: 1.6, z: -.35 },
  { id: 'Pekerja-02', mesh: createWorker(0x4fc3ff, 0xffd21a), xMin: -35, xMax: 15, dir: -1, spd: 1.4, z: .35 }
];
npcWorkers[0].mesh.position.set(-22, 0, -.35); npcWorkers[1].mesh.position.set(4, 0, .35);
const stationWorkers = [
  { mesh: createWorker(0xffb21a, 0xffffff), pos: [18, -9.35], rot: Math.PI, act: 'cnc' },
  { mesh: createWorker(0xb8e824, 0xffffff, { dark: true, prop: 'tablet', pants: 0x3a3f46 }), pos: [35.4, 6.1], rot: Math.PI * .5, act: 'qc' },
  { mesh: createWorker(0xff7a1a, 0xffd21a), pos: [-41.0, 27.35], rot: Math.PI * .5, act: 'pack' },
  { mesh: createWorker(0x4fc3ff, 0xf4f4f0, { prop: 'clipboard', shirt: 0xe8e8e2, pants: 0x1e2a44 }), pos: [-12.6, -2.6], rot: 0, act: 'sup' }
];
for (const s of stationWorkers) { s.mesh.position.set(s.pos[0], 0, s.pos[1]); s.mesh.rotation.y = s.rot; poseStand(s.mesh); }

/* animasi ringan semua aktor (roda forklift, jalan kaki, gerak pekerja stasiun) */
function animateActors(rawDt, dt, t) {
  for (const fk of ACT.forklifts) {
    const sp = fk.userData.speedMS || 0; for (const w of fk.userData.wheels) w.spin.rotation.x += (sp * (fk.userData.dirSign || 1) * dt) / w.r;
    fk.userData.beacon.rotation.y += dt * 9; fk.userData.blueSpot.material.opacity = .65 + .15 * Math.sin(t * 6);
  }
  for (const w of ACT.workers) {
    const u = w.userData;
    if (u.walking) { u.anim += (u.useSim ? dt : rawDt) * (u.speed || 1.5) * 3.7; poseWalk(w, u.anim, clamp((u.speed || 1.5) / 1.7, .55, 1.4)); }
    else if (!u.station) { poseStand(w); idleLife(w, t); }
  }
  for (const s of stationWorkers) {
    const u = s.mesh.userData; u.station = true; idleLife(s.mesh, t); const ph = t * (s.act === 'pack' ? 2.6 : 1.1);
    if (s.act === 'cnc') { u.armL.rotation.x = -.55 - Math.sin(ph) * .08; u.armR.rotation.x = -.75; u.elbowL.rotation.x = -.9; u.elbowR.rotation.x = -.8; u.head.rotation.y = Math.sin(t * .4) * .3; }
    else if (s.act === 'qc') { u.armR.rotation.x = -.6; u.elbowR.rotation.x = -1.3; u.armL.rotation.x = -.5; u.elbowL.rotation.x = -1.2; u.head.rotation.y = Math.sin(t * .6) * .35; }
    else if (s.act === 'pack') { u.armL.rotation.x = -.9 + Math.sin(ph) * .22; u.armR.rotation.x = -.9 - Math.sin(ph) * .22; u.elbowL.rotation.x = -.5; u.elbowR.rotation.x = -.5; u.hips.rotation.x = .12 + Math.sin(ph) * .03; }
    else { u.armR.rotation.x = -.55; u.elbowR.rotation.x = -1.35; u.armL.rotation.x = -.1; u.head.rotation.y = Math.sin(t * .35) * .5; }
  }
}
