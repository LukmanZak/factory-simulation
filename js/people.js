'use strict';
/* =====================================================================
   people.js — pekerja: badan berproporsi, wajah bertekstur, helm K3 mengilap, rompi hi-vis
   terbuka di depan, sarung tangan, sepatu bot, ikat pinggang. Gaya jalan dengan putaran
   pinggul, gerak kaki-telapak, ayunan lengan; idle bernapas; duduk untuk operator forklift.
   Semua bagian kecil digabung per sendi (vertex color) agar draw call tetap rendah.
   ===================================================================== */
const SKIN_TONES = [0xcf9a72, 0xb97c52, 0x9a6540, 0xe2b48e, 0x7d4e32];
const HAIR_TONES = [0x16120f, 0x241a14, 0x2d2118, 0x0e0b09];
M.vc.roughness = .82;   // kain: tanpa bump (bump frekuensi tinggi tampak berbintik pada jarak jauh)

/* ---------- wajah: tekstur kulit + mata, alis, hidung, bibir, rambut, kacamata K3 ---------- */
const FACE_CACHE = {};
function faceMaterial(skin, hair, male, glasses) {
  const key = [skin, hair, male, glasses].join('_'); if (FACE_CACHE[key]) return FACE_CACHE[key];
  const c = cv(1024, 512), x = c.getContext('2d'), hex = h => '#' + h.toString(16).padStart(6, '0');
  const sk = hex(skin), dark = hex((((skin >> 16) * .72 | 0) << 16) | ((((skin >> 8) & 255) * .66 | 0) << 8) | ((skin & 255) * .62 | 0)), lite = hex((Math.min(255, (skin >> 16) * 1.08 | 0) << 16) | (Math.min(255, ((skin >> 8) & 255) * 1.06 | 0) << 8) | Math.min(255, (skin & 255) * 1.05 | 0));
  x.fillStyle = sk; x.fillRect(0, 0, 1024, 512);
  const rg = (cx, cy, r, col, a) => { const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, col.replace('A', a)); g.addColorStop(1, col.replace('A', 0)); x.fillStyle = g; x.fillRect(cx - r, cy - r, 2 * r, 2 * r); };
  // bentuk: dahi terang, rahang dan leher lebih gelap
  const lg = x.createLinearGradient(0, 0, 0, 512); lg.addColorStop(0, lite); lg.addColorStop(.45, sk); lg.addColorStop(1, dark); x.fillStyle = lg; x.globalAlpha = .85; x.fillRect(0, 0, 1024, 512); x.globalAlpha = 1;
  for (const u of [.25, .75]) for (let k = 0; k < 40; k++) { x.fillStyle = `rgba(0,0,0,${.012})`; x.fillRect(u * 1024 - 60 + rand() * 120, rand() * 512, 2, 2); }
  const fx = 256;                                                                   // pusat wajah (u = .25)
  rg(fx - 80, 330, 40, 'rgba(180,70,60,A)', .16); rg(fx + 80, 330, 40, 'rgba(180,70,60,A)', .16);   // pipi
  rg(fx, 300, 22, 'rgba(0,0,0,A)', .10);                                             // bayangan hidung
  for (const s of [-1, 1]) {
    const ex = fx + s * 58, ey = 238;
    rg(ex, ey - 6, 34, 'rgba(0,0,0,A)', .16);                                        // cekungan mata
    x.fillStyle = '#eee9e2'; x.beginPath(); x.ellipse(ex, ey, 21, 9, 0, 0, 7); x.fill();  // putih mata
    x.fillStyle = '#4a3020'; x.beginPath(); x.arc(ex + s * -1, ey, 8.5, 0, 7); x.fill();   // iris
    x.fillStyle = '#0a0706'; x.beginPath(); x.arc(ex + s * -1, ey, 4.2, 0, 7); x.fill();   // pupil
    x.fillStyle = 'rgba(255,255,255,.85)'; x.beginPath(); x.arc(ex - 3, ey - 3, 2, 0, 7); x.fill();
    x.strokeStyle = 'rgba(30,18,12,.85)'; x.lineWidth = 2.4; x.beginPath(); x.ellipse(ex, ey, 21, 9, 0, Math.PI * 1.05, Math.PI * 1.95); x.stroke();   // kelopak atas
    x.strokeStyle = hex(hair); x.lineWidth = 8; x.lineCap = 'round'; x.beginPath(); x.moveTo(ex - s * 26, 214); x.quadraticCurveTo(ex, 200, ex + s * 26, 210); x.stroke();   // alis
  }
  x.strokeStyle = 'rgba(60,30,20,.55)'; x.lineWidth = 2; x.beginPath(); x.moveTo(fx - 8, 320); x.quadraticCurveTo(fx, 326, fx + 8, 320); x.stroke();  // lubang hidung
  x.fillStyle = 'rgba(70,25,20,.55)'; x.beginPath(); x.ellipse(fx - 11, 320, 4, 2.2, 0, 0, 7); x.fill(); x.beginPath(); x.ellipse(fx + 11, 320, 4, 2.2, 0, 0, 7); x.fill();
  x.fillStyle = 'rgba(160,70,62,.85)'; x.beginPath(); x.ellipse(fx, 357, 26, 5.5, 0, 0, Math.PI); x.fill();            // bibir bawah
  x.fillStyle = 'rgba(130,52,46,.9)'; x.beginPath(); x.moveTo(fx - 26, 357); x.quadraticCurveTo(fx - 8, 348, fx, 352); x.quadraticCurveTo(fx + 8, 348, fx + 26, 357); x.quadraticCurveTo(fx, 360, fx - 26, 357); x.fill();
  if (male) { x.fillStyle = 'rgba(25,18,14,.16)'; for (let i = 0; i < 2600; i++) { const px = fx - 90 + rand() * 180, py = 330 + rand() * 120; if (Math.abs(px - fx) < 70 || py > 360) x.fillRect(px, py, 1.6, 1.6); } }
  // rambut: bagian atas dan belakang kepala
  const hh = hex(hair); x.fillStyle = hh; x.fillRect(0, 0, 1024, 135);
  x.fillRect(614, 0, 310, 360);
  const hg = x.createLinearGradient(0, 120, 0, 175); hg.addColorStop(0, hh); hg.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = hg; x.fillRect(0, 120, 1024, 55);
  for (const u of [.13, .37]) { x.fillStyle = hh; x.fillRect(u * 1024 - 14, 100, 28, 150); }  // cambang
  for (let i = 0; i < 4000; i++) { x.fillStyle = `rgba(255,255,255,${rr(0, .05)})`; x.fillRect(rr(0, 1024), rr(0, 180), 1, rr(2, 7)); }
  if (glasses) { x.fillStyle = 'rgba(160,210,235,.22)'; for (const s of [-1, 1]) { x.fillRect(fx + s * 58 - 32, 222, 64, 32); x.strokeStyle = 'rgba(20,24,28,.9)'; x.lineWidth = 3; x.strokeRect(fx + s * 58 - 32, 222, 64, 32); } x.fillStyle = 'rgba(20,24,28,.9)'; x.fillRect(fx - 8, 232, 16, 3); }
  const t = cTex(c, true, false); t.anisotropy = ANISO;
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: .6, metalness: 0, envMapIntensity: .6 });
  return FACE_CACHE[key] = m;
}
function headGeometry() {
  const g = new THREE.SphereGeometry(1, 40, 30), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const jaw = smooth(clamp((-y - .05) / .95, 0, 1)), front = clamp(z, 0, 1);
    x *= .088 * (1 - .24 * jaw); z *= .104 * (1 - .12 * jaw) + .004; y *= .112;
    if (y < -.03) z += front * jaw * .012;                                        // dagu maju
    if (y > .02) z *= 1 - (y - .02) * .35 * (1 - front);                           // tengkuk
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}
function addUVConst(geo, u, v) { const a = geo.attributes.uv; for (let i = 0; i < a.count; i++) a.setXY(i, u, v); return geo; }

/* ---------- pekerja ---------- */
function createWorker(vestHex, helmetHex, opt = {}) {
  const skin = opt.skin !== undefined ? opt.skin : (opt.dark ? 0x8a5a38 : SKIN_TONES[rand() * 4 | 0]), hair = HAIR_TONES[rand() * 4 | 0];
  const SHIRT = opt.shirt || 0x39414d, PANTS = opt.pants || 0x26334f, BOOT = 0x3a2c22, GLOVE = opt.glove || 0xe7e3d8, REF = 0xdce3dc, BELT = 0x1d1a18;
  const sc = opt.scale || (.95 + rand() * .1), w = new THREE.Group(); w.scale.setScalar(sc);
  const hips = new THREE.Group(); hips.position.y = .93; w.add(hips);
  const spine = new THREE.Group(); spine.position.y = .08; hips.add(spine);
  const CYL = (r0, r1, h, seg = 14) => new THREE.CylinderGeometry(r0, r1, h, seg), SPH = (r, a = 14, b = 10) => new THREE.SphereGeometry(r, a, b), BOX = (a, b, c) => new THREE.BoxGeometry(a, b, c);
  const lathe = (pts, seg, ps, pl) => new THREE.LatheGeometry(pts.map(q => new THREE.Vector2(q[0], q[1])), seg, ps, pl);

  // pinggul: celana + ikat pinggang + gesper
  vcMesh(hips, [vcGeo(lathe([[.148, -.1], [.158, -.04], [.16, .03], [.152, .09]], 22), PANTS, 0, 0, 0, 0, 0, 0, 1.12, 1, .82),
    vcGeo(CYL(.158, .158, .045, 22), BELT, 0, .075, 0, 0, 0, 0, 1.12, 1, .84), vcGeo(BOX(.045, .035, .012), 0xb5b8bb, 0, .075, .142),
    vcGeo(BOX(.07, .09, .05), 0x2c2825, .15, .0, .02), vcGeo(CYL(.012, .012, .1, 6), 0x777b80, -.16, .02, .0, 0, 0, 0)]);
  // badan: kemeja, rompi hi-vis terbuka di depan, strip reflektif, kerah, leher
  const torsoProfile = [[.15, -.01], [.152, .06], [.158, .14], [.172, .22], [.18, .3], [.178, .37], [.158, .43], [.1, .47], [.052, .5]];
  const vestProfile = torsoProfile.slice(0, 7).map(q => [q[0] + .012, q[1] + .01]);
  const arc = [.62, Math.PI * 2 - 1.24];
  const torso = [vcGeo(lathe(torsoProfile, 24), SHIRT, 0, 0, 0, 0, 0, 0, 1.24, 1, .72), vcGeo(lathe(vestProfile, 24, arc[0], arc[1]), vestHex, 0, 0, 0, 0, 0, 0, 1.24, 1, .72)];
  for (const yy of [.1, .27]) torso.push(vcGeo(lathe([[.171, yy], [.173, yy + .04]].map(q => [q[0] + .012, q[1]]), 24, arc[0], arc[1]), REF, 0, 0, 0, 0, 0, 0, 1.24, 1, .72));
  for (const s of [-1, 1]) {
    torso.push(vcGeo(BOX(.05, .34, .012), vestHex, s * .1, .36, .122, -.12, 0, s * .1));                  // tali bahu depan
    torso.push(vcGeo(BOX(.034, .26, .014), REF, s * .1, .25, .126, -.12, 0, s * .05));                   // strip vertikal depan
    torso.push(vcGeo(BOX(.034, .3, .014), REF, s * .075, .22, -.128));                                   // strip vertikal belakang
    torso.push(vcGeo(SPH(.058, 14, 10), SHIRT, s * .205, .43, 0, 0, 0, 0, 1, 1, .9));                    // bahu
  }
  torso.push(vcGeo(BOX(.08, .06, .02), 0x2d2f33, .09, .3, .128), vcGeo(BOX(.05, .035, .006), 0xffffff, -.08, .33, .13)); // saku radio + tanda pengenal
  torso.push(vcGeo(CYL(.058, .066, .05, 14), SHIRT, 0, .5, 0), vcGeo(CYL(.046, .05, .1, 12), skin, 0, .5, 0.004));      // kerah + leher
  vcMesh(spine, torso);

  // kepala (grup): wajah bertekstur, telinga, hidung; helm K3
  const head = new THREE.Group(); head.position.set(0, .64, 0); spine.add(head);
  const hg = [headGeometry(), addUVConst(SPH(.017, 10, 8), .25, .34).scale(.8, 1.3, 1.1).translate(0, -.026, .099)];
  for (const s of [-1, 1]) hg.push(addUVConst(SPH(.026, 10, 8), .25, .34).scale(.38, 1, .7).translate(s * .088, -.012, -.006));
  hg.forEach(g => { if (!g.attributes.uv) return; });
  const headMesh = new THREE.Mesh(mergeGeos(hg), faceMaterial(skin, hair, opt.female ? 0 : 1, opt.glasses !== false)); headMesh.castShadow = headMesh.receiveShadow = true; head.add(headMesh);
  const helmMat = new THREE.MeshStandardMaterial({ color: helmetHex, roughness: .22, metalness: .05, envMapIntensity: 1.1 });
  const hm = new THREE.Mesh(mergeGeos([
    new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2).scale(.123, .098, .136).translate(0, .042, -.008),
    BOX(.02, .018, .2).translate(0, .144, -.01), BOX(.2, .012, .06).rotateX(.18).translate(0, .042, .122),
    new THREE.TorusGeometry(.118, .007, 6, 24).rotateX(Math.PI / 2).scale(1, 1, 1.1).translate(0, .036, -.004)
  ].map(g => { if (!g.attributes.uv) return g; return g; })), helmMat);
  hm.castShadow = hm.receiveShadow = true; head.add(hm);

  // lengan: bahu -> siku -> pergelangan -> sarung tangan
  const arm = s => {
    const sh = new THREE.Group(); sh.position.set(s * .213, .43, 0); spine.add(sh);
    vcMesh(sh, [vcGeo(CYL(.052, .043, .29, 12), SHIRT, 0, -.145, 0), vcGeo(SPH(.044, 10, 8), SHIRT, 0, -.29, 0)]);
    const el = new THREE.Group(); el.position.y = -.29; sh.add(el);
    vcMesh(el, [vcGeo(CYL(.043, .033, .26, 12), SHIRT, 0, -.13, 0), vcGeo(CYL(.036, .036, .03, 12), 0x2b3138, 0, -.265, 0),                 // lengan bawah + manset
      vcGeo(SPH(.04, 12, 9), GLOVE, 0, -.335, .004, 0, 0, 0, .95, 1.35, .65), vcGeo(SPH(.016, 8, 6), GLOVE, s * -.033, -.31, .016, 0, 0, 0, 1, 1.5, 1),
      vcGeo(BOX(.075, .012, .06), 0xe05a1a, 0, -.3, -.002)]);
    return [sh, el];
  };
  const [armL, elbowL] = arm(-1), [armR, elbowR] = arm(1);

  // kaki: pinggul -> lutut -> pergelangan -> sepatu bot
  const leg = s => {
    const th = new THREE.Group(); th.position.set(s * .098, -.04, 0); hips.add(th);
    vcMesh(th, [vcGeo(CYL(.088, .064, .4, 14), PANTS, 0, -.2, 0), vcGeo(BOX(.1, .12, .02), PANTS, s * .0, -.12, .075), vcGeo(SPH(.064, 10, 8), PANTS, 0, -.4, 0)]);
    const kn = new THREE.Group(); kn.position.y = -.4; th.add(kn);
    vcMesh(kn, [vcGeo(CYL(.063, .047, .4, 14), PANTS, 0, -.2, 0), vcGeo(SPH(.052, 10, 8), 0x2c2f35, 0, -.01, .02, 0, 0, 0, 1, .9, .6), vcGeo(CYL(.05, .05, .02, 12), 0x23262b, 0, -.385, 0)]);
    const ft = new THREE.Group(); ft.position.y = -.4; kn.add(ft);
    vcMesh(ft, [vcGeo(CYL(.05, .056, .13, 12), BOOT, 0, -.03, -.005), vcGeo(BOX(.1, .03, .29), 0x131110, 0, -.075, .04), vcGeo(BOX(.092, .06, .2), BOOT, 0, -.04, .025),
      vcGeo(SPH(.052, 10, 8), 0x2e2219, 0, -.05, .115, 0, 0, 0, 1, .75, 1.3), vcGeo(BOX(.05, .006, .09), 0x22374d, 0, -.011, .05)]);
    return [th, kn, ft];
  };
  const [legL, kneeL, footL] = leg(-1), [legR, kneeR, footR] = leg(1);

  w.userData = { hips, spine, head, helmet: head, armL, armR, elbowL, elbowR, legL, legR, kneeL, kneeR, footL, footR, anim: rand() * 6, phase: rand() * 6, walking: false, speed: 0, mode: opt.mode || 'stand', speedF: 1, baseY: .93 };
  if (opt.prop) attachProp(w, opt.prop);
  scene.add(w); ACT.workers.push(w); return w;
}
function attachProp(w, kind) {
  const el = w.userData.elbowR, g = new THREE.Group(); el.add(g);
  if (kind === 'clipboard') {
    const b = new THREE.Mesh(new THREE.BoxGeometry(.2, .27, .012), new THREE.MeshStandardMaterial({ color: 0xb08b58, roughness: .7 })); b.position.set(0, -.27, .05); b.castShadow = true;
    const pg = new THREE.Mesh(new THREE.BoxGeometry(.18, .24, .004), new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: .8 })); pg.position.z = .008; b.add(pg);
    const c = new THREE.Mesh(new THREE.BoxGeometry(.07, .03, .016), new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: .7, roughness: .4 })); c.position.set(0, .12, .012); b.add(c); g.add(b);
  } else if (kind === 'tablet') {
    const b = new THREE.Mesh(new THREE.BoxGeometry(.17, .24, .012), new THREE.MeshStandardMaterial({ color: 0x1a1d21, roughness: .4 })); b.position.set(0, -.27, .05); b.castShadow = true;
    const s = new THREE.Mesh(new THREE.PlaneGeometry(.15, .21), M.led); s.position.z = .007; b.add(s); g.add(b);
  }
}

/* ---------- pose dan gerak ---------- */
const HIP_Y = .93;
function poseStand(w) {
  const u = w.userData; for (const k of ['legL', 'legR', 'kneeL', 'kneeR', 'footL', 'footR', 'armL', 'armR']) u[k].rotation.set(0, 0, 0);
  u.elbowL.rotation.set(-.18, 0, 0); u.elbowR.rotation.set(-.18, 0, 0); u.armL.rotation.z = .05; u.armR.rotation.z = -.05;
  u.hips.position.set(0, HIP_Y, 0); u.hips.rotation.set(0, 0, 0); u.spine.rotation.set(0, 0, 0); u.head.rotation.set(0, 0, 0);
}
/** siklus jalan: ph = fase (rad), amp 0..1.8 (jalan ... lari kecil) */
function poseWalk(w, ph, amp) {
  const u = w.userData, s = Math.sin(ph), c = Math.cos(ph), a = Math.min(amp, 1.15);
  u.hips.position.set(Math.sin(ph) * .016 * a, HIP_Y - .022 * a * s * s + .006 * a, 0);
  u.hips.rotation.set(0, s * .1 * a, Math.sin(ph) * .03 * a); u.spine.rotation.set(.04 + .05 * Math.max(0, amp - 1), -s * .13 * a, -Math.sin(ph) * .025 * a);
  for (const [sg, th, kn, ft, ar, el] of [[1, u.legL, u.kneeL, u.footL, u.armL, u.elbowL], [-1, u.legR, u.kneeR, u.footR, u.armR, u.elbowR]]) {
    const ss = sg * s, cc = sg * c;                                                  // fase kaki ini: ss>0 = kaki di depan
    th.rotation.x = -ss * .44 * a - .02;
    kn.rotation.x = (.08 + .92 * Math.max(0, cc)) * .7 * a + (ss > .6 ? .05 : 0);
    ft.rotation.x = -(th.rotation.x + kn.rotation.x) + .32 * Math.max(0, -ss) * a - .26 * Math.max(0, ss - .55) * a;   // telapak: tumit mendarat, jinjit saat dorong
    ar.rotation.x = ss * .46 * a; el.rotation.x = -(.22 + .5 * Math.max(0, -ar.rotation.x)) * Math.min(1, amp);
    ar.rotation.z = sg * .06 + (sg > 0 ? -.03 : .03);
  }
  u.head.rotation.set(-.03 * a - .02 * s * s, -u.spine.rotation.y * .5 - u.hips.rotation.y * .4, 0);
}
function poseSeated(w) {
  const u = w.userData; u.hips.position.set(0, 0, 0); u.hips.rotation.set(0, 0, 0); u.spine.rotation.set(-.1, 0, 0); u.head.rotation.set(.12, 0, 0);
  u.legL.rotation.set(-Math.PI / 2 + .06, 0, -.04); u.legR.rotation.set(-Math.PI / 2 + .06, 0, .04); u.kneeL.rotation.x = u.kneeR.rotation.x = Math.PI / 2 - .12;
  u.footL.rotation.x = u.footR.rotation.x = -(u.legL.rotation.x + u.kneeL.rotation.x) + .18;
  u.armL.rotation.set(-.95, 0, .08); u.armR.rotation.set(-.95, 0, -.08); u.elbowL.rotation.x = u.elbowR.rotation.x = -.7;
}
/** napas dan gerak kepala halus untuk pekerja yang berdiri */
function idleLife(w, t) {
  const u = w.userData, p = u.phase;
  u.spine.rotation.x = .015 + Math.sin(t * 1.6 + p) * .012; u.hips.position.x = Math.sin(t * .35 + p) * .012; u.hips.rotation.z = Math.sin(t * .35 + p) * .012;
  u.head.rotation.y = Math.sin(t * .31 + p) * .2; u.head.rotation.x = Math.sin(t * .23 + p * 2) * .04;
}
