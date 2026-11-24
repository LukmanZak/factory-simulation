'use strict';
/* =====================================================================
   line.js — lini produksi U: konveyor sabuk, CNC-01 (pintu geser, spindel, tower light),
   ROB-01 (6 sumbu + pagar pengaman + light curtain), QC-01 (gerbang kamera + laser),
   WIP-BUF, monorail hoist, papan andon.
   ===================================================================== */
const BELT_Y = 1.012, BELT_V = 0.9;                    // tinggi permukaan sabuk, kecepatan sabuk (m/s)
const CONV_PATH = [new THREE.Vector3(11, 1.012, -12), new THREE.Vector3(37, 1.012, -12), new THREE.Vector3(37, 1.012, 12), new THREE.Vector3(11, 1.012, 12)];
const LINE = { belts: [], cnc: null, rob: null, qc: null, hoist: null, andon: null, running: true };
const Bl = new Batcher();

/* ---------- konveyor sabuk dengan rangka, kaki, rel pemandu dan penggerak ---------- */
function addBelt(x1, z1, x2, z2, opt = {}) {
  const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz), g = new THREE.Group();
  g.position.set((x1 + x2) / 2, 0, (z1 + z2) / 2); g.rotation.y = Math.atan2(dx, dz); scene.add(g);
  const B = new Batcher();
  for (const s of [-.62, .62]) { B.box(M.convFrame, .07, .2, len, s, .9, 0); B.box(M.steel, .03, .05, len, s * 1.04, 1.1, 0); }   // rangka dan rel pemandu
  B.box(M.steelDark, 1.2, .04, len, 0, .8, 0);
  for (let p = -len / 2 + .5; p <= len / 2 - .3; p += 1.3) { for (const s of [-1, 1]) B.box(M.steel, .02, .2, .02, s * 1.04, 1.0, p); }
  for (let p = -len / 2 + .5; p <= len / 2 - .4; p += 2.6) {
    for (const s of [-.58, .58]) { B.box(M.convFrame, .09, .8, .09, s, .4, p); B.box(M.steelDark, .22, .02, .22, s, .01, p); }
    B.box(M.convFrame, 1.22, .05, .05, 0, .55, p); B.box(M.convFrame, .05, .05, .9, -.58, .24, p, 0, 0, 0);
  }
  B.cyl(M.steelRaw, .1, .1, 1.2, 14, 0, .93, -len / 2 + .05, 0, 0, Math.PI / 2); B.cyl(M.steelRaw, .1, .1, 1.2, 14, 0, .93, len / 2 - .05, 0, 0, Math.PI / 2);   // drum ujung
  if (opt.motor !== false) { B.box(M.machineAccent, .34, .28, .36, .9, .55, len / 2 - .5); B.cyl(M.steelDark, .09, .09, .28, 10, .9, .55, len / 2 - .2, Math.PI / 2, 0, 0); }
  for (const p of opt.eyes || []) { B.box(M.black, .06, .1, .06, -.66, 1.17, p); B.box(M.ledRed, .02, .02, .02, -.66, 1.23, p); B.box(M.black, .06, .1, .06, .66, 1.17, p); }
  B.flush(g);
  const tex = PROC.belt(); tex.repeat.set(1, Math.max(1, len)); tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: .88, envMapIntensity: .6 });
  const belt = new THREE.Mesh(new THREE.PlaneGeometry(1.16, len - .08), mat); belt.rotation.x = -Math.PI / 2; belt.position.y = BELT_Y; belt.receiveShadow = true; g.add(belt);
  LINE.belts.push(tex); return g;
}
function addCorner(x, z) {                                 // meja transfer sudut 90°
  const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
  const B = new Batcher(); B.box(M.convFrame, 1.5, .2, 1.5, 0, .9, 0); B.box(M.steelDark, 1.3, .04, 1.3, 0, 1.0, 0);
  for (const sx of [-.7, .7]) for (const sz of [-.7, .7]) { B.box(M.convFrame, .09, .8, .09, sx, .4, sz); B.box(M.steelDark, .22, .02, .22, sx, .01, sz); }
  B.cyl(M.steelRaw, .08, .08, .1, 12, 0, .98, 0); B.flush(g);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), new THREE.MeshStandardMaterial({ map: PROC.belt(), roughness: .85 })); m.rotation.x = -Math.PI / 2; m.position.y = BELT_Y; m.receiveShadow = true; g.add(m);
}
addBelt(11, -12, 36.2, -12, { eyes: [6, 13, 22] });
addCorner(37, -12); addBelt(37, -11.25, 37, 11.25, { motor: false, eyes: [-4, 3, 12] }); addCorner(37, 12);
addBelt(36.2, 12, 11, 12, { eyes: [-6, 6] });

/* ---------- WIP-BUF: pelat penyangga + sensor (zona antrean sebelum robot dan QC) ---------- */
function bufferMarks(x, z, rot) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; scene.add(g);
  const B = new Batcher();
  for (const s of [-1, 1]) { B.box(M.yellow, .06, .5, .06, s * .85, 1.5, 0); B.box(M.yellow, .06, .06, 1.2, s * .85, 1.75, 0); }
  B.box(M.hazard, .2, .08, 1.7, -.0, 1.04, 0); B.flush(g);
}
bufferMarks(26, -12, Math.PI / 2); bufferMarks(37, -3, 0);

/* =====================================================================
   CNC-01 di (18, -12): terowongan konveyor, pintu geser berjendela, spindel, tower light
   ===================================================================== */
(function buildCNC() {
  const g = new THREE.Group(); g.position.set(18, 0, -12); scene.add(g);
  const B = new Batcher(), X = 1.8, Z = 1.6;
  B.box(M.steelDark, 3.8, .25, 3.4, 0, .125, 0);
  // dinding ujung dengan bukaan terowongan (z -.8..+.8, y .95..2.2)
  for (const s of [-1, 1]) {
    B.box(M.machine, .12, 3.0, .8, s * X, 1.75, -1.2); B.box(M.machine, .12, 3.0, .8, s * X, 1.75, 1.2);
    B.box(M.machine, .12, 1.0, 1.6, s * X, .75, 0); B.box(M.machineAccent, .12, .9, 1.6, s * X, 2.75, 0);
    B.box(M.rubber, .05, 1.25, .06, s * X, 1.575, -.82); B.box(M.rubber, .05, 1.25, .06, s * X, 1.575, .82);
    for (const dz of [-.5, -.25, 0, .25, .5]) B.box(M.rubber, .03, 1.2, .1, s * (X + .09), 1.58, dz, 0, 0, 0);   // tirai strip PVC
  }
  B.box(M.machine, 3.6, 3.0, .12, 0, 1.75, -Z);                                                          // dinding belakang
  B.box(M.machineAccent, 3.6, .22, .13, 0, .55, -Z); B.box(M.machineAccent, 3.6, .22, .13, 0, 2.4, -Z);
  B.box(M.machine, 3.7, .12, 3.3, 0, 3.3, 0); B.box(M.machineAccent, 3.7, .06, .5, 0, 3.38, Z - .1);   // atap
  B.box(M.machine, 3.6, .9, .12, 0, .7, Z); B.box(M.machine, 3.6, .5, .12, 0, 3.0, Z);                   // panel depan atas/bawah
  B.box(M.machineAccent, 3.6, .08, .14, 0, 1.17, Z); B.box(M.machineAccent, 3.6, .08, .14, 0, 2.75, Z);
  // rel pintu geser
  B.box(M.steelRaw, 3.6, .05, .06, 0, 2.78, Z + .1); B.box(M.steelRaw, 3.6, .05, .06, 0, 1.15, Z + .1);
  // tangki coolant + conveyor serpih di belakang, duct ke atap
  B.box(M.steel, 1.4, .7, .8, -.6, .45, -Z - .5); B.box(M.steelDark, 1.4, .06, .85, -.6, .83, -Z - .5); B.cyl(M.steelRaw, .06, .06, .7, 8, .3, 1.0, -Z - .3, 0, 0, 0);
  B.box(M.machine, .8, 1.5, .7, 1.1, .85, -Z - .5);
  B.cyl(M.duct, .26, .26, 5.4, 14, -1.1, 3.35 + 2.7, -.9); B.cyl(M.steelDark, .33, .33, .1, 14, -1.1, 3.4, -.9);
  B.box(M.hazard, .5, .02, .5, 0, .26, Z + .3, 0, 0, 0);
  // tanda dan stiker
  B.box(M.yellow, .3, .3, .01, -1.5, 1.9, Z + .07); B.box(M.black, .26, .26, .01, -1.5, 1.9, Z + .075);
  B.flush(g);
  // pegangan, jendela gelap tetap di panel samping belakang
  const win = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.45, .04), M.darkGlass); win.position.set(0, 1.95, Z + .02); g.add(win);   // jendela utama (di belakang pintu geser)
  // pintu geser: panel dengan jendela kaca gelap, bergeser ke kanan saat terbuka
  const door = new THREE.Group(); door.position.set(0, 1.95, Z + .17); g.add(door);
  const dB = new Batcher(); dB.box(M.machine, 2.1, 1.5, .06, 0, 0, 0); dB.box(M.steelRaw, 2.1, .05, .09, 0, .74, 0); dB.box(M.steelRaw, 2.1, .05, .09, 0, -.74, 0); dB.box(M.steelRaw, .05, 1.5, .09, -1.04, 0, 0); dB.box(M.steelRaw, .05, 1.5, .09, 1.04, 0, 0);
  dB.box(M.steelRaw, .04, .55, .1, -.9, 0, .05); dB.flush(door);
  const doorGlass = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.15, .065), M.darkGlass); doorGlass.position.z = .004; door.add(doorGlass);
  // spindel di dalam: kepala bergerak
  const sp = new THREE.Group(); sp.position.set(0, 3.0, 0); g.add(sp);
  addMesh(sp, new THREE.BoxGeometry(.5, .5, .5), M.steel, 0, 0, 0); addMesh(sp, new THREE.CylinderGeometry(.12, .12, .5, 12), M.steelDark, 0, -.4, 0); addMesh(sp, new THREE.CylinderGeometry(.02, .02, .6, 6), M.steelRaw, 0, -.85, 0);
  const rail = addMesh(g, new THREE.BoxGeometry(3.2, .12, .14), M.steelDark, 0, 3.15, 0, false);
  // layar HMI pada lengan
  const hc = cv(256, 160), hx = hc.getContext('2d'); const htex = new THREE.CanvasTexture(hc); htex.encoding = THREE.sRGBEncoding;
  const hmiMat = new THREE.MeshBasicMaterial({ map: htex }); const hmi = new THREE.Mesh(new THREE.PlaneGeometry(.52, .34), hmiMat);
  const arm = new THREE.Group(); arm.position.set(X + .3, 1.6, Z + .15); g.add(arm);
  addMesh(arm, new THREE.BoxGeometry(.64, .46, .1), M.steelDark, 0, 0, 0); hmi.position.set(0, 0, .055); arm.add(hmi); addMesh(arm, new THREE.CylinderGeometry(.04, .04, 1.6, 8), M.steelDark, 0, -.95, 0); addMesh(arm, new THREE.BoxGeometry(.4, .04, .4), M.steelDark, 0, -1.74, 0);
  // tower light 3 warna
  const tw = new THREE.Group(); tw.position.set(-1.55, 3.36, Z - .35); g.add(tw);
  addMesh(tw, new THREE.CylinderGeometry(.03, .03, .35, 8), M.steelDark, 0, .17, 0);
  const lamps = {}; let yy = .43;
  for (const [k, c] of [['green', 0x24d46a], ['amber', 0xffb02e], ['red', 0xff3b30]]) { const m = new THREE.MeshBasicMaterial({ color: c }); const l = addMesh(tw, new THREE.CylinderGeometry(.075, .075, .12, 14), m, 0, yy, 0, false); lamps[k] = m; yy += .125; }
  addMesh(tw, new THREE.CylinderGeometry(.04, .075, .04, 10), M.steelDark, 0, yy + .02, 0, false);
  LINE.cnc = { g, door, sp, hmiCtx: hx, hmiTex: htex, lamps, busy: 0, doorOpen: 1 };
})();
function drawHMI(ctx, tex, title, lines, runCol) {
  ctx.fillStyle = '#0b1c2a'; ctx.fillRect(0, 0, 256, 160); ctx.fillStyle = '#143a56'; ctx.fillRect(0, 0, 256, 26);
  ctx.fillStyle = '#d8f1ff'; ctx.font = 'bold 15px sans-serif'; ctx.fillText(title, 8, 18); ctx.fillStyle = runCol; ctx.fillRect(214, 6, 34, 14);
  ctx.fillStyle = '#9ad7ff'; ctx.font = '13px monospace'; lines.forEach((l, i) => ctx.fillText(l, 10, 52 + i * 22)); tex.needsUpdate = true;
}

/* =====================================================================
   ROB-01: lengan 6 sumbu di (34.5, -10) di dalam pagar pengaman; IK 2 link
   ===================================================================== */
(function buildRobot() {
  const bx = 34.5, bz = -10.0, SH = 1.2, L1 = 1.5, L2 = 1.45, GR = .3;
  const base = new THREE.Group(); base.position.set(bx, 0, bz); scene.add(base);
  addMesh(base, new THREE.BoxGeometry(1.1, .5, 1.1), M.steelDark, 0, .25, 0); addMesh(base, new THREE.BoxGeometry(1.3, .04, 1.3), M.steel, 0, .02, 0, false);
  for (const sx of [-.5, .5]) for (const sz of [-.5, .5]) addMesh(base, new THREE.CylinderGeometry(.03, .03, .05, 6), M.steelRaw, sx, .52, sz, false);
  const j1 = new THREE.Group(); j1.position.y = .5; base.add(j1);
  addMesh(j1, new THREE.CylinderGeometry(.38, .42, .3, 20), M.robotOrange, 0, .15, 0);
  const j2 = new THREE.Group(); j2.position.y = SH - .5; j1.add(j2);
  addMesh(j2, new THREE.BoxGeometry(.5, .55, .44), M.robotOrange, 0, -.05, 0); const jc = addMesh(j2, new THREE.CylinderGeometry(.2, .2, .56, 16), M.steelDark, 0, 0, 0); jc.rotation.z = Math.PI / 2;
  const a1 = new THREE.Group(); j2.add(a1);
  addMesh(a1, new THREE.BoxGeometry(.3, L1, .27), M.robotOrange, 0, L1 / 2, 0); addMesh(a1, new THREE.BoxGeometry(.18, L1 * .7, .06), M.steelDark, 0, L1 / 2, .15, false);
  const a2 = new THREE.Group(); a2.position.y = L1; a1.add(a2);
  const ec = addMesh(a2, new THREE.CylinderGeometry(.17, .17, .38, 16), M.robotOrange, 0, 0, 0); ec.rotation.z = Math.PI / 2;
  addMesh(a2, new THREE.BoxGeometry(.23, L2, .23), M.robotOrange, 0, L2 / 2, 0);
  const wr = new THREE.Group(); wr.position.y = L2; a2.add(wr);
  addMesh(wr, new THREE.CylinderGeometry(.1, .1, .26, 14), M.steelDark, 0, .08, 0); addMesh(wr, new THREE.CylinderGeometry(.14, .14, .04, 14), M.steel, 0, .22, 0);
  const grip = new THREE.Group(); grip.position.y = .24; wr.add(grip);
  addMesh(grip, new THREE.BoxGeometry(.3, .06, .1), M.steelDark, 0, .03, 0);
  const fingers = [-1, 1].map(s => { const f = new THREE.Group(); f.position.set(s * .12, .06, 0); grip.add(f); addMesh(f, new THREE.BoxGeometry(.04, .22, .08), M.steelRaw, 0, .11, 0); return f; });
  const part = addMesh(grip, new THREE.BoxGeometry(.2, .12, .2), M.cartonFg, 0, .2, 0); part.visible = false;
  // meja pengumpan komponen
  const feeder = new THREE.Group(); feeder.position.set(32.4, 0, -8.3); scene.add(feeder);
  addMesh(feeder, new THREE.BoxGeometry(1.1, .06, .9), M.steel, 0, .92, 0); for (const sx of [-.5, .5]) for (const sz of [-.4, .4]) addMesh(feeder, new THREE.BoxGeometry(.06, .9, .06), M.steelDark, sx, .45, sz);
  addMesh(feeder, new THREE.BoxGeometry(.8, .22, .6), M.pipeBlue, 0, 1.06, 0); for (let i = 0; i < 6; i++) addMesh(feeder, new THREE.BoxGeometry(.2, .1, .2), M.cartonFg, -.25 + (i % 3) * .25, 1.2, -.12 + (i >> 2 & 1) * .25 + (i < 3 ? 0 : .0), false);
  // pagar pengaman (rangka kuning + jaring) dengan celah masuk-keluar sabuk, gerbang, light curtain, E-stop
  const fence = (x1, z1, x2, z2) => {
    const len = Math.hypot(x2 - x1, z2 - z1), ry = Math.atan2(x2 - x1, z2 - z1) - Math.PI / 2, n = Math.max(1, Math.round(len / 1.4));
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(len, 1.8), M.mesh); planeUV(mesh.geometry, len, 1.8, .55); mesh.position.set((x1 + x2) / 2, 1.05, (z1 + z2) / 2); mesh.rotation.y = ry; scene.add(mesh);
    for (let i = 0; i <= n; i++) Bl.box(M.yellow, .07, 2.0, .07, lerp(x1, x2, i / n), 1.0, lerp(z1, z2, i / n));
    Bl.box(M.yellow, Math.abs(x2 - x1) || .06, .06, Math.abs(z2 - z1) || .06, (x1 + x2) / 2, 1.97, (z1 + z2) / 2); Bl.box(M.yellow, Math.abs(x2 - x1) || .06, .05, Math.abs(z2 - z1) || .06, (x1 + x2) / 2, .15, (z1 + z2) / 2);
  };
  fence(30.4, -14.3, 38.5, -14.3); fence(38.5, -14.3, 38.5, -5.9); fence(30.4, -14.3, 30.4, -13.1); fence(30.4, -10.9, 30.4, -5.9); fence(30.4, -5.9, 35.8, -5.9); fence(38.1, -5.9, 38.5, -5.9);
  for (const [px, pz] of [[30.4, -13.0], [30.4, -11.0], [35.9, -5.9], [38.0, -5.9]]) { Bl.box(M.steelDark, .1, 1.6, .1, px, .8, pz); Bl.box(M.ledRed, .03, 1.4, .03, px + (px < 31 ? .07 : 0), .8, pz + (pz > -6 ? -.07 : 0)); Bl.box(M.ledGreen, .05, .05, .05, px, 1.7, pz); }
  Bl.box(M.red, .16, .16, .12, 35.9, 1.2, -5.9);                                                           // E-stop
  Bl.box(M.yellow, .14, .5, .06, 31.5, 1.15, -5.9); Bl.box(M.steelDark, .06, 1.9, .06, 31.4, .95, -5.9);   // gerbang + interlock
  const pdx = new THREE.Mesh(new THREE.PlaneGeometry(.55, .55), new THREE.MeshStandardMaterial({ map: signTex('warn', 'ROBOT', 'Area otomatis'), roughness: .5 })); pdx.position.set(33.5, 1.55, -5.84); scene.add(pdx);
  LINE.rob = {
    base, j1, a1, a2, wr, fingers, part, SH, L1, L2, GR, bx, bz,
    ik(tx, ty, tz) {                                                    // arahkan ujung gripper ke titik dunia
      const dx = tx - bx, dz = tz - bz, r = Math.hypot(dx, dz), h = ty - SH, L2e = L2 + GR + .12;
      let d = Math.hypot(r, h); d = clamp(d, Math.abs(L1 - L2e) + .08, L1 + L2e - .02);
      const phi = Math.atan2(r, h), cg = (L1 * L1 + L2e * L2e - d * d) / (2 * L1 * L2e), gam = Math.acos(clamp(cg, -1, 1));
      const del = Math.acos(clamp((L1 * L1 + d * d - L2e * L2e) / (2 * L1 * d), -1, 1));
      j1.rotation.y = Math.atan2(dx, dz); a1.rotation.x = phi - del; a2.rotation.x = Math.PI - gam; wr.rotation.x = 0;
    },
    grip(o) { fingers[0].position.x = -.12 + (1 - o) * .06; fingers[1].position.x = .12 - (1 - o) * .06; },
    pose(u) {                                                           // u 0..1: ambil komponen dari feeder, pasang ke barang di sabuk
      const K = [[0, 34.9, 2.9, -10.4], [.12, 32.4, 1.62, -8.35], [.24, 32.4, 1.4, -8.35], [.3, 32.4, 1.4, -8.35], [.42, 32.4, 1.8, -8.35], [.6, 33.6, 2.6, -11.6], [.7, 33.6, 2.18, -12], [.8, 33.6, 2.18, -12], [.92, 33.6, 2.6, -11.6], [1, 34.9, 2.9, -10.4]];
      let i = 0; while (i < K.length - 2 && u > K[i + 1][0]) i++;
      const a = K[i], b = K[i + 1], f = smooth(clamp((u - a[0]) / (b[0] - a[0]), 0, 1));
      this.ik(lerp(a[1], b[1], f), lerp(a[2], b[2], f), lerp(a[3], b[3], f));
      const holding = u > .24 && u < .7; this.grip(holding ? .0 : (u > .7 && u < .78 ? .0 : 1)); part.visible = holding;
    },
    idle(t) { this.ik(34.9 + Math.sin(t * .6) * .15, 2.9 + Math.sin(t * .9) * .05, -10.4); this.grip(1); part.visible = false; }
  };
  LINE.rob.idle(0);
})();

/* =====================================================================
   QC-01 di (37, 5): gerbang portal, 2 kamera, laser sweep, indikator
   ===================================================================== */
(function buildQC() {
  const g = new THREE.Group(); g.position.set(37, 0, 5); scene.add(g);
  const B = new Batcher();
  for (const s of [-1, 1]) { B.box(M.steelDark, .3, 3.1, .5, s * 1.15, 1.55, 0); B.box(M.steel, .5, .08, .8, s * 1.15, .04, 0); B.box(M.hazard, .5, .5, .5, s * 1.15, .25, 0); }
  B.box(M.steelDark, 2.9, .45, .6, 0, 3.0, 0); B.box(M.steel, 2.6, .1, .7, 0, 3.27, 0);
  for (const s of [-.5, .5]) { B.box(M.black, .26, .2, .3, s, 2.65, 0); B.cyl(M.black, .07, .07, .1, 10, s, 2.5, 0); B.cyl(M.led, .05, .05, .02, 10, s, 2.44, 0); }
  B.box(M.led, 2.4, .04, .05, 0, 2.77, .2); B.box(M.led, 2.4, .04, .05, 0, 2.77, -.2);
  B.box(M.steelDark, .22, .35, .1, 1.35, 1.5, .3); B.box(M.darkGlass, .16, .22, .02, 1.35, 1.52, .36);
  B.flush(g);
  const laser = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.35), M.laser); laser.position.set(0, 1.75, 0); laser.visible = false; g.add(laser);
  const lm = new THREE.MeshBasicMaterial({ color: 0x24d46a }); const lamp = addMesh(g, new THREE.CylinderGeometry(.08, .08, .16, 12), lm, -1.15, 3.42, 0, false);
  LINE.qc = { g, laser, lm, sweep(u) { laser.visible = u != null; if (u != null) { laser.position.z = lerp(-.95, .95, 1 - Math.abs(2 * u - 1)); lm.color.setHex(0xffb02e); } else lm.color.setHex(0x24d46a); } };
})();

/* =====================================================================
   Monorail hoist di atas CNC (rel digantung dari rangka atap) + papan andon
   ===================================================================== */
(function hoist() {
  const z = -12, y = 6.9, x0 = 7, x1 = 41;
  Bl.box(M.steelDark, x1 - x0, .26, .12, (x0 + x1) / 2, y, z); Bl.box(M.steel, x1 - x0, .045, .3, (x0 + x1) / 2, y + .14, z); Bl.box(M.steel, x1 - x0, .045, .3, (x0 + x1) / 2, y - .14, z);
  for (const hx of [10, 20, 30, 40]) { Bl.cyl(M.steelDark, .025, .025, 1.9, 6, hx, y + 1.1, z - .2); Bl.cyl(M.steelDark, .025, .025, 1.9, 6, hx, y + 1.1, z + .2); Bl.box(M.steelDark, .06, .06, .6, hx, y + .24, z); }
  const tr = new THREE.Group(); tr.position.set(18, y - .2, z); scene.add(tr);
  addMesh(tr, new THREE.BoxGeometry(.5, .25, .5), M.machineAccent, 0, -.2, 0); addMesh(tr, new THREE.BoxGeometry(.5, .08, .9), M.steelDark, 0, .02, 0);
  addMesh(tr, new THREE.BoxGeometry(.4, .5, .4), M.yellow, 0, -.55, 0);
  const chain = addMesh(tr, new THREE.CylinderGeometry(.015, .015, 1, 5), M.steelRaw, 0, -1.4, 0, false);
  const hook = new THREE.Group(); tr.add(hook); addMesh(hook, new THREE.BoxGeometry(.14, .22, .1), M.red, 0, 0, 0); const hk = addMesh(hook, new THREE.TorusGeometry(.1, .025, 6, 12, 4.5), M.steelDark, 0, -.2, 0, false); hk.rotation.y = Math.PI / 2;
  LINE.hoist = { tr, hook, chain, x0: 12, x1: 36, y };
  // papan andon: layar LED besar di atas lini, menampilkan status dan throughput
  const ac = cv(512, 192), ax = ac.getContext('2d'), atex = new THREE.CanvasTexture(ac); atex.encoding = THREE.sRGBEncoding; atex.anisotropy = ANISO;
  const am = new THREE.MeshBasicMaterial({ map: atex });
  const ag = new THREE.Group(); ag.position.set(24, 5.6, -8.2); scene.add(ag);
  addMesh(ag, new THREE.BoxGeometry(3.4, 1.3, .16), M.black, 0, 0, 0);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.2), am); face.position.z = .085; ag.add(face);
  const back = face.clone(); back.rotation.y = Math.PI; back.position.z = -.085; ag.add(back);
  for (const s of [-1, 1]) addMesh(ag, new THREE.CylinderGeometry(.02, .02, 3.3, 5), M.steelDark, s * 1.4, 2.0, 0, false);
  LINE.andon = { ctx: ax, tex: atex, t: -9 };
})();
Bl.flush(scene);

/* ---------- pembaruan visual per frame (dipanggil sim.js) ---------- */
LINE.updateVisual = function (dt, t, st) {
  if (LINE.running) for (const tx of LINE.belts) tx.offset.y += BELT_V * dt;
  // CNC: pintu menutup saat memesin, spindel bergerak, tower light
  const c = LINE.cnc, target = st.cncBusy ? 0 : 1;
  c.doorOpen += (target - c.doorOpen) * Math.min(1, dt * 4); c.door.position.x = c.doorOpen * 1.9;
  const mv = st.cncBusy ? 1 : 0.0;
  c.sp.position.x = Math.sin(t * 1.7) * .9 * mv; c.sp.position.z = Math.cos(t * 1.3) * .4 * mv; c.sp.position.y = 3.0 - (st.cncBusy ? .25 + .2 * Math.sin(t * 5) : 0);
  c.lamps.green.color.setHex(st.cncBusy ? 0x24d46a : 0x0e3d22); c.lamps.amber.color.setHex(st.cncBusy ? 0x3d2a08 : 0xffb02e); c.lamps.red.color.setHex(0x3a0e0b);
  if (Math.floor(t * 2) !== c.lastH) { c.lastH = Math.floor(t * 2); drawHMI(c.hmiCtx, c.hmiTex, 'CNC-01  VMC', ['STATUS ' + (st.cncBusy ? 'RUNNING' : 'LOAD'), 'SPINDLE ' + (st.cncBusy ? '8000 rpm' : '0 rpm'), 'JOB ' + String(st.throughput).padStart(4, '0'), 'FEED ' + (st.cncBusy ? '1200' : '0') + ' mm/min'], st.cncBusy ? '#24d46a' : '#ffb02e'); }
  // robot dan QC
  if (st.robU != null) LINE.rob.pose(st.robU); else LINE.rob.idle(t);
  LINE.qc.sweep(st.qcU);
  // hoist: berjalan pelan dan menurunkan kait di atas CNC
  const h = LINE.hoist, ph = (Math.sin(t * .18) * .5 + .5);
  h.tr.position.x = lerp(h.x0, h.x1, ph);
  const nearCnc = Math.exp(-Math.pow((h.tr.position.x - 18) / 2, 2)), drop = .55 + nearCnc * 2.6 + Math.sin(t * .8) * .04;
  h.chain.scale.y = drop; h.chain.position.y = -.7 - drop / 2; h.hook.position.y = -.7 - drop - .1;
  // andon
  if (t - LINE.andon.t > .5) {
    LINE.andon.t = t; const x = LINE.andon.ctx; x.fillStyle = '#050a10'; x.fillRect(0, 0, 512, 192);
    x.fillStyle = st.cncBusy ? '#24d46a' : '#ffb02e'; x.fillRect(14, 14, 20, 20);
    x.fillStyle = '#e8f6ff'; x.font = 'bold 34px sans-serif'; x.fillText('LINI PRODUKSI U-01', 46, 34);
    x.fillStyle = '#8fd0ff'; x.font = '24px sans-serif'; x.fillText('OUTPUT', 22, 86); x.fillText('WIP', 280, 86);
    x.fillStyle = '#ffffff'; x.font = 'bold 66px monospace'; x.fillText(String(st.throughput).padStart(4, '0'), 22, 156); x.fillText(String(st.wip).padStart(2, '0') + '/08', 280, 156);
    LINE.andon.tex.needsUpdate = true;
  }
};
