'use strict';
/* =====================================================================
   sim.js — logika simulasi. Rute, KPI, near-miss, charging dan HUD tetap seperti
   model asli; yang berubah: kendaraan berbelok dengan jari-jari, garpu rendah saat
   jalan, palet benar-benar masuk/keluar slot rak, barang berhenti di CNC/robot/QC.
   ===================================================================== */
const KMH = 3.6;
const sim = {
  speed: 1.0, timeSec: 0, throughput: 0, stgIn: 3, stgOut: 2, wipBuf1: 0, wipBuf2: 0,
  convItems: [], congestionCount: 0, totalWaitSec: 0, nearMissCount: 0, cycleTimes: [], depalT: 0
};
refreshStaging();
const V3 = THREE.Vector3;

/* ---------- node waypoint, cincin peringatan, vektor aliran (default tersembunyi: tampilan bersih) ---------- */
const wpNodesGroup = new THREE.Group(); wpNodesGroup.visible = false; scene.add(wpNodesGroup);
const wpDefinitions = [
  { id: 'WP-INT-01', pos: new V3(-8, .25, -12), type: 'int' }, { id: 'WP-INT-02', pos: new V3(-8, .25, 12), type: 'int' },
  { id: 'WP-INT-03', pos: new V3(-32, .25, 0), type: 'int' }, { id: 'WP-INT-04', pos: new V3(-8, .25, 0), type: 'int' },
  { id: 'WP-PU-DOCK', pos: new V3(-34.5, .25, -12), type: 'pu' }, { id: 'WP-DO-DOCK', pos: new V3(-34.5, .25, 12), type: 'do' },
  { id: 'WP-PU-WH', pos: new V3(-5, .25, -12), type: 'pu' }, { id: 'WP-DO-WH', pos: new V3(-5, .25, 12), type: 'do' }
];
const intAlertRings = {};
wpDefinitions.forEach(w => {
  const col = w.type === 'int' ? 0xfacc15 : (w.type === 'pu' ? 0x38bdf8 : 0x10b981);
  const sph = new THREE.Mesh(new THREE.SphereGeometry(.28, 12, 12), new THREE.MeshBasicMaterial({ color: col })); sph.position.copy(w.pos); wpNodesGroup.add(sph);
  if (w.type === 'int') {
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.55, 28), new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide, transparent: true, opacity: 0, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(w.pos.x, .07, w.pos.z); scene.add(ring); intAlertRings[w.id] = { ring, timer: 0, pos: w.pos };
  }
});
const safetyRing = new THREE.Mesh(new THREE.RingGeometry(1.4, 2.0, 28), new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide, transparent: true, opacity: 0, depthWrite: false }));
safetyRing.rotation.x = -Math.PI / 2; scene.add(safetyRing); let safetyRingTimer = 0;
const flowGroup = new THREE.Group(); flowGroup.visible = false; scene.add(flowGroup);
const flowArrows = [];
function addFlow(pts, color) {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], steps = Math.max(1, Math.floor(a.distanceTo(b) / 4));
    const q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 0, 1), new V3().subVectors(b, a).normalize());
    for (let s = 0; s < steps; s++) { const cone = new THREE.Mesh(new THREE.ConeGeometry(.26, .7, 8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .75 })); cone.rotation.x = Math.PI / 2; const wrap = new THREE.Group(); wrap.add(cone); wrap.quaternion.copy(q); flowGroup.add(wrap); flowArrows.push({ wrap, a, b, off: s / steps }); }
  }
}
addFlow([new V3(-37, .4, -12), new V3(-8, .4, -12), new V3(11, 1.7, -12), new V3(37, 1.7, -12)], 0x38bdf8);
addFlow([new V3(37, 1.7, -12), new V3(37, 1.7, 12), new V3(11, 1.7, 12), new V3(-8, .4, 12), new V3(-37, .4, 12)], 0x10b981);

/* ---------- log, tombol stress-test ---------- */
function addLog(msg, level = 'info') {
  const box = document.getElementById('event-log'), mm = String(Math.floor(sim.timeSec / 60)).padStart(2, '0'), ss = String(Math.floor(sim.timeSec % 60)).padStart(2, '0');
  const d = document.createElement('div'); d.className = level === 'danger' ? 'log-danger' : (level === 'warn' ? 'log-warn' : 'log-info'); d.textContent = `[${mm}:${ss}] ${msg}`;
  box.prepend(d); if (box.children.length > 35) box.removeChild(box.lastChild);
}
function triggerTruckSurge() { sim.stgIn += 5; sim.stgOut += 4; refreshStaging(); addLog('SURGE: truk bongkar muat serentak! STG-IN dan STG-OUT berpotensi OVERFLOW.', 'warn'); }
function forceChargeFL1() { flStates[0].battery = 18; addLog('FL-01 dijadwalkan charging baterai ke CHG-BAY setelah siklus ini.', 'info'); }
function toggleNodes(v) { wpNodesGroup.visible = v; }
function toggleFlow(v) { flowGroup.visible = v; }
function setSimSpeed(v) { sim.speed = parseFloat(v); document.getElementById('speed-val').textContent = sim.speed.toFixed(1) + 'x'; }

/* =====================================================================
   RUTE KENDARAAN. spd dalam m/s (lane 10 km/h = 2.7; aisle 5 km/h = 1.35).
   face = arah hadap saat mengerjakan aksi.
   ===================================================================== */
const P = (x, z, spd, act = null, extra = {}) => Object.assign({ pos: new V3(x, 0, z), spd, act }, extra);
const LANE = 2.7, SPINE = 2.5, AISLE = 1.35, APPR = 1.1;
const fl1Route = [
  P(-34.5, -12, APPR, 'pick_stgin'), P(-32, -12, LANE), P(-8, -12, LANE), P(-8, -20, AISLE), P(-20, -20, AISLE, 'store_rm'), P(-8, -20, AISLE),
  P(-8, -12, SPINE), P(-5, -12, APPR, 'drop_amr_in'), P(-8, -12, SPINE), P(-8, 12, SPINE), P(-32, 12, LANE), P(-32, 0, SPINE), P(-32, -12, SPINE)
];
const fl2Route = [
  P(-5, 12, APPR, 'pick_amr_out'), P(-8, 12, SPINE), P(-8, 20, AISLE), P(-20, 20, AISLE, 'store_fg'), P(-8, 20, AISLE), P(-8, 12, SPINE),
  P(-32, 12, LANE), P(-34.5, 12, APPR, 'drop_stgout'), P(-32, 12, LANE), P(-32, -12, LANE), P(-8, -12, LANE), P(-8, 12, SPINE)
];
fl1Mesh.position.set(-34.5, 0, -12); fl1Mesh.rotation.y = -Math.PI / 2;
fl2Mesh.position.set(-5, 0, 12); fl2Mesh.rotation.y = Math.PI / 2;
const mkFl = (id, mesh, route, bat, chg) => ({ id, mesh, route, wpIdx: 0, hasCargo: false, cargoType: null, forkY: .22, visY: .22, battery: bat, charging: false, chStage: -1, chg, loadedDist: 0, emptyDist: 0, curSpeedKmh: 0, cycleStart: 0, nearMissCD: {}, blockCD: 0, task: null, resume: false });
const flStates = [mkFl('FL-01', fl1Mesh, fl1Route, 96, -25.5), mkFl('FL-02', fl2Mesh, fl2Route, 92, -22.5)];
flStates[0].chPath = [[-8, -12], [-25.5, -12], [-25.5, -8.8], [-25.5, -6.3]];
flStates[1].chPath = [[-32, 12], [-32, -12], [-22.5, -12], [-22.5, -8.8], [-22.5, -6.3]];

/* AMR berbasis misi: parkir di area AMR PARK; dikirim hanya bila ada palet yang perlu dipindah */
const PARK = [{ x: 2.5, z: -8.2 }, { x: 6.5, z: -8.2 }, { x: 4.5, z: 8.2 }];
const amrs = PARK.map((pk, i) => {
  const m = createAMR(i + 1); m.position.set(pk.x, 0, pk.z); m.rotation.y = i < 2 ? Math.PI : 0;
  return { id: 'AMR-0' + (i + 1), mesh: m, park: pk, mission: null, steps: [], si: 0, wait: 0, cargo: null, dist: 0, blockCD: 0 };
});
const missionSteps = (kind, a) => kind === 'raw'
  ? [{ x: ST.rawIn.x, z: ST.rawIn.z, act: 'pick_raw' }, { x: ST.head.x, z: ST.head.z, act: 'drop_head' }, { x: a.park.x, z: a.park.z, act: 'park' }]
  : [{ x: ST.end.x, z: ST.end.z, act: 'pick_fg' }, { x: ST.fgOut.x, z: ST.fgOut.z, act: 'drop_fgout' }, { x: a.park.x, z: a.park.z, act: 'park' }];

const npcState = npcWorkers;

/* =====================================================================
   PEMANDU JALUR: belok dengan jari-jari (tidak berputar di tempat); melambat di tikungan
   ===================================================================== */
function driveTo(u, tx, tz, vmax, dt, o) {
  const m = u.mesh, dx = tx - m.position.x, dz = tz - m.position.z, dist = Math.hypot(dx, dz);
  const want = Math.atan2(dx, dz), err = angDiff(m.rotation.y, want);
  let k = 1 - Math.min(1, Math.abs(err) / 1.15); k = Math.max(o.spin ? 0 : .2, k);
  let v = vmax * k; if (o.stop) v *= clamp(dist / 2.0, .3, 1);
  const omega = o.spin ? 3.0 : clamp(v / o.R, .85, 1.9);
  m.rotation.y += clamp(err, -omega * dt, omega * dt);
  const step = Math.min(dist, v * dt);
  m.position.x += Math.sin(m.rotation.y) * step; m.position.z += Math.cos(m.rotation.y) * step;
  return { moved: step, dist };
}

/* ---------- deteksi lalu lintas dan keselamatan (logika asli) ---------- */
function checkTrafficBlocking(unitPos, unitRotY, selfId) {
  const fwd = new V3(Math.sin(unitRotY), 0, Math.cos(unitRotY)), prio = id => id.startsWith('FL') ? 2 : 1;
  const others = [...flStates.map(f => ({ id: f.id, pos: f.mesh.position, rot: f.mesh.rotation.y })), ...amrs.map(a => ({ id: a.id, pos: a.mesh.position, rot: a.mesh.rotation.y }))];
  for (const o of others) {
    if (o.id === selfId) continue;
    const v = new V3().subVectors(o.pos, unitPos), d = v.length();
    if (d < 4.2 && v.clone().normalize().dot(fwd) > .55) {
      // bila saling menghadang, yang prioritasnya lebih tinggi (forklift > AMR, lalu urutan id) jalan terus: mencegah kebuntuan
      const vb = v.clone().negate().normalize(), mutual = vb.dot(new V3(Math.sin(o.rot), 0, Math.cos(o.rot))) > .55;
      if (mutual && (prio(selfId) > prio(o.id) || (prio(selfId) === prio(o.id) && selfId < o.id))) continue;
      return o.id;
    }
  }
  return null;
}
function checkSafetyProximity(fk) {
  const fwd = new V3(Math.sin(fk.mesh.rotation.y), 0, Math.cos(fk.mesh.rotation.y));
  const peds = [...npcState.map(n => ({ id: n.id, pos: n.mesh.position })), { id: 'Operator-Anda', pos: operator.position }];
  let yieldPed = false;
  for (const p of peds) {
    const d = fk.mesh.position.distanceTo(p.pos), toPed = new V3().subVectors(p.pos, fk.mesh.position).normalize();
    if (d < 3.4 && toPed.dot(fwd) > .35) yieldPed = true;
    if (d < 3.1 && fk.curSpeedKmh > 1.0) {
      if (!fk.nearMissCD[p.id] || sim.timeSec - fk.nearMissCD[p.id] > 5.0) {
        fk.nearMissCD[p.id] = sim.timeSec; sim.nearMissCount++; safetyRing.position.set(p.pos.x, .09, p.pos.z); safetyRingTimer = 1.6;
        addLog(`NEAR-MISS: ${fk.id} vs ${p.id} (${d.toFixed(1)}m) @ ${Math.abs(p.pos.x + 8) < 4 ? 'WP-INT-04 (Crossing)' : 'PED-PATH'}`, 'danger');
      }
    }
  }
  return yieldPed;
}
function flagIntersectionCongestion(pos) {
  let nearest = null, minD = 99;
  for (const id in intAlertRings) { const d = pos.distanceTo(intAlertRings[id].pos); if (d < minD) { minD = d; nearest = id; } }
  if (nearest && minD < 6.5) { intAlertRings[nearest].timer = 1.2; return nearest; }
  return 'LANE-FL';
}

/* =====================================================================
   TUGAS FORKLIFT: urutan langkah bertahap (putar, geser, angkat, maju, taruh/ambil, mundur)
   ===================================================================== */
const S = (d, start, upd, end, until) => ({ d, start, upd, end, until, t: 0, on: false });
const fwdOf = r => new V3(Math.sin(r), 0, Math.cos(r));
function sAlign(fk, x, z, ang, dMin = .7) {                  // geser + putar menuju pose siap (manuver pelan)
  let p0, a0;
  const st = S(dMin, () => {
    p0 = fk.mesh.position.clone(); a0 = fk.mesh.rotation.y;
    const dd = Math.hypot(x - p0.x, z - p0.z);
    st.d = Math.max(dMin, dd / .9, Math.abs(angDiff(a0, ang)) / 1.5);
    fk.mesh.userData.speedMS = dd / st.d; fk.mesh.userData.dirSign = 1;
  }, u => { const e = smooth(u); fk.mesh.position.x = lerp(p0.x, x, e); fk.mesh.position.z = lerp(p0.z, z, e); fk.mesh.rotation.y = a0 + angDiff(a0, ang) * e; },
    () => { fk.mesh.userData.speedMS = 0; });
  return st;
}
function sMove(fk, dist, d) {                                // maju (+) atau mundur (-) sepanjang arah hadap
  let p0, dir;
  return S(d, () => { p0 = fk.mesh.position.clone(); dir = fwdOf(fk.mesh.rotation.y); fk.mesh.userData.speedMS = Math.abs(dist) / d; fk.mesh.userData.dirSign = Math.sign(dist); },
    u => { const e = smooth(u); fk.mesh.position.set(p0.x + dir.x * dist * e, 0, p0.z + dir.z * dist * e); }, () => { fk.mesh.userData.speedMS = 0; });
}
function sLift(fk, h, dMin = .6) {
  let h0; const st = S(dMin, () => { h0 = fk.forkY; st.d = Math.max(dMin, .5 + Math.abs(h - h0) / .55); }, u => { fk.forkY = lerp(h0, h, smooth(u)); });
  return st;
}
const sDo = fn => S(.05, null, null, fn);
const sWait = (cond, maxT = 25) => { const st = S(maxT, null, null, null, cond); return st; };
function setCargo(fk, type) { fk.hasCargo = !!type; fk.cargoType = type; setSlotCargo(fk.mesh.userData.cargoSlot, type); }

/** operasi rak: put / take pada slot tertentu dari lorong */
function rackOps(fk, R, slot, mode) {
  const sign = slot.z > slot.aisleZ ? 1 : -1, face = sign > 0 ? 0 : Math.PI, reach = 2.12, ready = Math.abs(slot.z - slot.aisleZ) - reach;
  const hPut = slot.y + .02, hTake = slot.y - .1;
  const st = [sAlign(fk, slot.x, slot.aisleZ, face, .9)];
  if (mode === 'put') st.push(sLift(fk, hPut + .09), sMove(fk, ready, 1.7), sLift(fk, hPut - .13, .6), sDo(() => { setCargo(fk, null); R.setOcc(slot, true); }), sMove(fk, -ready, 1.5));
  else st.push(sLift(fk, hTake), sMove(fk, ready, 1.7), sLift(fk, hTake + .2, .6), sDo(() => { R.setOcc(slot, false); setCargo(fk, R.type); }), sMove(fk, -ready, 1.5));
  return st;
}
function buildTask(fk, wp) {
  const act = wp.act, m = fk.mesh;
  const finishDrive = () => sLift(fk, .22, .5);
  if (act === 'pick_stgin') {
    fk.cycleStart = sim.timeSec;
    if (sim.stgIn <= 0 || fk.hasCargo) return [sAlign(fk, -34.5, -12, -Math.PI / 2, .6)];
    let best = null; for (const c of stgInVisual.children) { if (!best || c.position.x > best.position.x) best = c; }
    const px = stgInVisual.position.x + (best ? best.position.x : 0), pz = stgInVisual.position.z + (best ? best.position.z : 0);
    return [sAlign(fk, px + reach2() + 1.1, pz, -Math.PI / 2, .8), sLift(fk, .0), sMove(fk, 1.1, 1.0), sLift(fk, .14, .5),
      sDo(() => { if (best) stgInVisual.remove(best); sim.stgIn = Math.max(0, sim.stgIn - 1); setCargo(fk, 'raw'); }), sMove(fk, -1.1, 1.0), finishDrive()];
  }
  if (act === 'store_rm' || act === 'store_fg') {
    const type = act === 'store_rm' ? 'raw' : 'fg', R = RACK[type], steps = [], x0 = m.position.x;
    let a = null, b = null;
    if (fk.hasCargo && R.occ < 36) a = RACK.free(type, x0);
    if (a) steps.push(...rackOps(fk, R, a, 'put'));
    const floorOcc = type === 'raw' ? 12 : 2;
    if (R.occ + (a ? 1 : 0) > floorOcc && (a || !fk.hasCargo)) { b = RACK.taken(type, x0); if (b) steps.push(...rackOps(fk, R, b, 'take')); }
    steps.push(sAlign(fk, wp.pos.x, wp.pos.z, m.rotation.y, .5), finishDrive());
    return steps;
  }
  if (act === 'drop_amr_in') {
    const S0 = ST.rawIn; if (!fk.hasCargo) return [finishDrive(), sDo(() => { recordCycle(fk); })];
    return [sAlign(fk, S0.x - reach2() - 1.0, S0.z, Math.PI / 2, .7), sWait(() => !S0.has() && !amrNear(S0, 1.3), 40), sLift(fk, .52), sMove(fk, 1.0, 0.9), sLift(fk, .38, .5),
      sDo(() => { setCargo(fk, null); S0.put(true); }), sMove(fk, -1.0, .9), finishDrive(), sDo(() => { recordCycle(fk); })];
  }
  if (act === 'pick_amr_out') {
    const S1 = ST.fgOut; fk.cycleStart = sim.timeSec;
    if (!S1.has() || fk.hasCargo) return [sAlign(fk, -5, 12, Math.PI / 2, .6)];
    return [sAlign(fk, S1.x - reach2() - 1.0, S1.z, Math.PI / 2, .7), sWait(() => !amrNear(S1, 1.3), 30), sLift(fk, .48), sMove(fk, 1.0, .9), sLift(fk, .62, .5), sDo(() => { S1.put(false); setCargo(fk, 'fg'); }), sMove(fk, -1.0, .9), finishDrive()];
  }
  if (act === 'drop_stgout') {
    if (!fk.hasCargo) return [finishDrive(), sDo(() => { recordCycle(fk); })];
    const n = Math.min(sim.stgOut, 8), col = n % 3, row = Math.floor(n / 3) % 2, tier = Math.floor(n / 6);
    const px = stgOutVisual.position.x + (col - 1) * 1.65, pz = stgOutVisual.position.z + (row - .5) * 1.7;
    return [sAlign(fk, px + reach2() + 1.1, pz, -Math.PI / 2, .8), sLift(fk, tier * 1.05 + .1), sMove(fk, 1.1, 1.0), sLift(fk, tier * 1.05 - .0, .5),
      sDo(() => { setCargo(fk, null); sim.stgOut++; refreshStaging(); }), sMove(fk, -1.1, 1.0), finishDrive(), sDo(() => { recordCycle(fk); })];
  }
  return [];
}
const reach2 = () => 2.12;
function amrNear(stand, r) { return amrs.some(a => Math.hypot(a.mesh.position.x - stand.x, a.mesh.position.z - stand.z) < r); }
function recordCycle(fk) {
  if (fk.cycleStart > 0) { sim.cycleTimes.push(sim.timeSec - fk.cycleStart); if (sim.cycleTimes.length > 10) sim.cycleTimes.shift(); }
  if (fk.battery < 35) { fk.charging = true; fk.chStage = 0; addLog(`${fk.id} menuju CHG-BAY (baterai ${Math.round(fk.battery)}%).`, 'info'); }
}
function runTask(fk, dt) {
  const T = fk.task; if (!T) return false;
  const st = T.steps[T.i];
  if (!st) { fk.task = null; return false; }
  if (!st.on) { st.on = true; st.t = 0; st.start && st.start(); }
  st.t += dt;
  if (st.until) { if (st.until() || st.t >= st.d) { st.end && st.end(); T.i++; } }
  else { const u = clamp(st.t / st.d, 0, 1); st.upd && st.upd(u); if (st.t >= st.d) { st.end && st.end(); T.i++; } }
  if (T.i >= T.steps.length) { fk.task = null; fk.mesh.userData.speedMS = 0; }
  return true;
}

function updateForklifts(dt) {
  flStates.forEach(fk => {
    const m = fk.mesh, ud = m.userData;
    fk.visY += (fk.forkY - fk.visY) * Math.min(1, dt * 7); ud.setLift(fk.visY);
    ud.speedMS = ud.speedMS || 0;
    // pengisian baterai
    if (fk.charging) {
      if (fk.chStage >= 0 && fk.chStage < fk.chPath.length) {
        const tgt = fk.chPath[fk.chStage], blocker = checkTrafficBlocking(m.position, m.rotation.y, fk.id);
        if (blocker) { ud.speedMS = 0; fk.curSpeedKmh = 0; return; }
        const last = fk.chStage === fk.chPath.length - 1, r = driveTo(fk, tgt[0], tgt[1], last ? .9 : LANE, dt, { R: 1.9, stop: last });
        ud.speedMS = r.moved / Math.max(dt, .001); ud.dirSign = 1; fk.curSpeedKmh = ud.speedMS * KMH; fk.emptyDist += r.moved; fk.battery = Math.max(5, fk.battery - r.moved * .14);
        if (r.dist < (last ? .3 : 1.4)) { fk.chStage++; if (fk.chStage >= fk.chPath.length) { fk.chStage = 99; fk.faceTarget = 0; } }
      } else {
        ud.speedMS = 0; fk.curSpeedKmh = 0;
        m.rotation.y += angDiff(m.rotation.y, 0) * Math.min(1, dt * 3);
        fk.battery = Math.min(100, fk.battery + dt * 1.6);
        if (fk.battery >= 99.5) { fk.charging = false; fk.chStage = -1; addLog(`${fk.id} selesai charging (100%) di CHG-BAY.`, 'info'); fk.task = { steps: [sMove(fk, -3.3, 2.4)], i: 0 }; }
      }
      return;
    }
    if (fk.task) { fk.curSpeedKmh = ud.speedMS * KMH; if (runTask(fk, dt)) { if (fk.hasCargo) fk.loadedDist += ud.speedMS * dt; else fk.emptyDist += ud.speedMS * dt; return; } }
    fk.forkY = fk.forkY > .3 ? .22 : fk.forkY;

    const blocker = checkTrafficBlocking(m.position, m.rotation.y, fk.id), yieldPed = checkSafetyProximity(fk);
    if (blocker || yieldPed) {
      ud.speedMS = 0; fk.curSpeedKmh = 0; sim.totalWaitSec += dt;
      if (sim.timeSec - fk.blockCD > 4.5) { fk.blockCD = sim.timeSec; sim.congestionCount++; addLog(`MACET: ${fk.id} tertahan (${blocker || 'Pejalan Kaki'}) @ ${flagIntersectionCongestion(m.position)}`, 'warn'); }
      return;
    }
    const wp = fk.route[fk.wpIdx], v = wp.spd * (fk.hasCargo ? .88 : 1);
    const r = driveTo(fk, wp.pos.x, wp.pos.z, v, dt, { R: 1.9, stop: !!wp.act });
    ud.speedMS = r.moved / Math.max(dt, .001); ud.dirSign = 1; fk.curSpeedKmh = ud.speedMS * KMH;
    if (fk.hasCargo) fk.loadedDist += r.moved; else fk.emptyDist += r.moved;
    fk.battery = Math.max(5, fk.battery - r.moved * .14);
    const arrive = wp.act ? r.dist < .4 : r.dist < 1.6;
    if (arrive) {
      fk.wpIdx = (fk.wpIdx + 1) % fk.route.length;
      if (wp.act) { const steps = buildTask(fk, wp); if (steps.length) fk.task = { steps, i: 0 }; }
    }
  });
}

/* =====================================================================
   AMR
   ===================================================================== */
function dispatchAMR() {
  const busy = k => amrs.some(a => a.mission === k), nearest = pt => amrs.filter(a => !a.mission && a.wait <= 0).sort((p, q) => Math.hypot(p.mesh.position.x - pt.x, p.mesh.position.z - pt.z) - Math.hypot(q.mesh.position.x - pt.x, q.mesh.position.z - pt.z))[0];
  if (!busy('raw') && ST.rawIn.has() && ST.head.count === 0) { const a = nearest(ST.rawIn); if (a) { a.mission = 'raw'; a.steps = missionSteps('raw', a); a.si = 0; } }
  if (!busy('fg') && ST.end.complete && !ST.fgOut.has()) { const a = nearest(ST.end); if (a) { a.mission = 'fg'; a.steps = missionSteps('fg', a); a.si = 0; } }
}
function updateAMRs(dt) {
  dispatchAMR();
  amrs.forEach(a => {
    const ud = a.mesh.userData;
    if (a.wait > 0) { a.wait -= dt; ud.led.material.color.setHex(0x34e089); return; }
    if (!a.mission) { ud.led.material.color.setHex(0x6fd6ff); return; }                          // parkir: menunggu misi
    const blocker = checkTrafficBlocking(a.mesh.position, a.mesh.rotation.y, a.id);
    if (blocker) { ud.led.material.color.setHex(0xff4a3a); sim.totalWaitSec += dt; return; }
    ud.led.material.color.setHex(a.cargo ? 0xffb02e : 0x6fd6ff);
    const st = a.steps[a.si]; if (!st) { a.mission = null; return; }
    const r = driveTo(a, st.x, st.z, 1.6, dt, { R: .7, spin: true, stop: true }); a.dist += r.moved;
    if (r.dist < .12) {
      a.wait = .9;
      if (st.act === 'pick_raw') { if (ST.rawIn.has()) { ST.rawIn.put(false); a.cargo = 'raw'; setSlotCargo(ud.slot, 'raw'); a.si++; } else a.si = a.steps.length - 1; }
      else if (st.act === 'drop_head') { if (ST.head.count === 0) { ST.head.load(); a.cargo = null; setSlotCargo(ud.slot, null); a.si++; } else a.wait = .8; }
      else if (st.act === 'pick_fg') { if (ST.end.complete) { ST.end.clear(); a.cargo = 'fg'; setSlotCargo(ud.slot, 'fg'); a.si++; } else a.si = a.steps.length - 1; }
      else if (st.act === 'drop_fgout') { if (!ST.fgOut.has()) { ST.fgOut.put(true); a.cargo = null; setSlotCargo(ud.slot, null); a.si++; } else a.wait = .8; }
      else { a.mission = null; a.steps = []; a.si = 0; }
    }
  });
}

/* =====================================================================
   KONVEYOR + STASIUN (CNC, robot, QC). posisi barang = jarak s sepanjang jalur U (76 m)
   ===================================================================== */
const SEG = [26, 24, 26], S_END = 76;
const STATIONS = { cnc: { s: 7, dwell: 3.6 }, rob: { s: 22.5, dwell: 3.4 }, qc: { s: 43, dwell: 2.2 } };
function posAt(s, out) {
  if (s <= 26) return out.set(11 + s, BELT_Y, -12);
  if (s <= 50) return out.set(37, BELT_Y, -12 + (s - 26));
  return out.set(37 - (s - 50), BELT_Y, 12);
}
const lineSt = { cncBusy: false, robU: null, qcU: null, throughput: 0, wip: 0 };
function spawnItem() {
  const mesh = createBeltItem('raw'); posAt(0, mesh.position); scene.add(mesh);
  sim.convItems.push({ mesh, s: 0, dwell: 0, st: null, done: {}, type: 'raw' });
}
function updateConveyor(dt) {
  // depalet di kepala konveyor: satu karton tiap ±3,2 s
  sim.depalT += dt;
  if (ST.head.count > 0 && sim.depalT > 3.2 && !sim.convItems.some(i => i.s < 1.6)) { sim.depalT = 0; if (ST.head.release()) spawnItem(); }
  const items = sim.convItems.slice().sort((a, b) => b.s - a.s);
  lineSt.cncBusy = false; lineSt.robU = null; lineSt.qcU = null; sim.wipBuf1 = 0; sim.wipBuf2 = 0;
  let ahead = ST.end.complete ? S_END + .35 : Infinity;   // bila palet di ujung penuh, barang antre di belakangnya
  for (const it of items) {
    if (it.st) {                                                           // sedang diproses di stasiun
      const S1 = STATIONS[it.st]; it.dwell += dt; const u = clamp(it.dwell / S1.dwell, 0, 1);
      if (it.st === 'cnc') { lineSt.cncBusy = true; if (u > .5 && it.type === 'raw') { it.type = 'fg'; it.mesh.userData.cartons.material = M.cartonFg; } }
      if (it.st === 'rob') lineSt.robU = u; if (it.st === 'qc') lineSt.qcU = u;
      if (u >= 1) { it.done[it.st] = true; it.st = null; }
    } else {
      let ns = Math.min(it.s + BELT_V * dt, ahead - 1.0);
      for (const k in STATIONS) { if (!it.done[k] && it.s < STATIONS[k].s && ns >= STATIONS[k].s - .001) { ns = STATIONS[k].s; it.st = k; it.dwell = 0; break; } }
      it.s = Math.max(it.s, ns);
    }
    ahead = it.s;
    posAt(it.s, it.mesh.position);
    if (it.s > 12.5 && it.s < 18) sim.wipBuf1++; if (it.s > 30 && it.s < 38) sim.wipBuf2++;
    if (it.s >= S_END - .01) { scene.remove(it.mesh); sim.convItems.splice(sim.convItems.indexOf(it), 1); sim.throughput++; ST.end.add(); }
  }
  lineSt.throughput = sim.throughput; lineSt.wip = sim.wipBuf1 + sim.wipBuf2;
}

/* ---------- NPC pejalan kaki di PED-PATH ---------- */
function updateNPC(dt) {
  npcState.forEach(n => {
    n.mesh.position.x += n.dir * n.spd * dt;
    if (n.mesh.position.x > n.xMax) n.dir = -1; if (n.mesh.position.x < n.xMin) n.dir = 1;
    n.mesh.rotation.y = n.dir > 0 ? Math.PI / 2 : -Math.PI / 2; n.mesh.userData.walking = true; n.mesh.userData.speed = n.spd; n.mesh.userData.useSim = true;
  });
}

/* ---------- HUD ---------- */
function updateHUD() {
  const $ = id => document.getElementById(id);
  $('kpi-tp').textContent = sim.throughput;
  const avg = sim.cycleTimes.length ? sim.cycleTimes.reduce((a, b) => a + b, 0) / sim.cycleTimes.length : 0; $('kpi-cycle').textContent = avg.toFixed(1) + 's';
  const rm = RACK.raw.occ, fg = RACK.fg.occ;
  $('txt-rm').textContent = `${rm} / 36`; $('bar-rm').style.width = Math.min(100, rm / 36 * 100) + '%';
  $('txt-fg').textContent = `${fg} / 36`; $('bar-fg').style.width = Math.min(100, fg / 36 * 100) + '%';
  const ovfIn = sim.stgIn > 6, ovfOut = sim.stgOut > 6;
  $('txt-stgin').textContent = `${sim.stgIn} / 6`; $('bar-stgin').style.width = Math.min(100, sim.stgIn / 6 * 100) + '%'; $('bar-stgin').style.background = ovfIn ? '#ef4444' : '#38bdf8'; $('ovf-in').style.display = ovfIn ? 'inline-block' : 'none';
  stgInAlertFloor.material.opacity = ovfIn ? (.3 + Math.sin(sim.timeSec * 6) * .15) : 0;
  $('txt-stgout').textContent = `${sim.stgOut} / 6`; $('bar-stgout').style.width = Math.min(100, sim.stgOut / 6 * 100) + '%'; $('bar-stgout').style.background = ovfOut ? '#ef4444' : '#10b981'; $('ovf-out').style.display = ovfOut ? 'inline-block' : 'none';
  stgOutAlertFloor.material.opacity = ovfOut ? (.3 + Math.sin(sim.timeSec * 6) * .15) : 0;
  const wip = sim.wipBuf1 + sim.wipBuf2; $('txt-wip').textContent = `${wip} / 8`; $('bar-wip').style.width = Math.min(100, wip / 8 * 100) + '%';
  const f1 = flStates[0], f2 = flStates[1], t1 = Math.max(1, f1.loadedDist + f1.emptyDist), t2 = Math.max(1, f2.loadedDist + f2.emptyDist);
  const stat = f => f.charging ? 'CHARGING @ CHG-BAY' : (f.hasCargo ? 'LOADED' : 'EMPTY');
  $('fl1-status').textContent = stat(f1); $('fl1-spd').textContent = f1.curSpeedKmh.toFixed(1); $('fl1-bat').textContent = Math.round(f1.battery) + '%'; $('fl1-load').textContent = Math.round(f1.loadedDist); $('fl1-emp').textContent = Math.round(f1.emptyDist); $('fl1-emp-pct').textContent = Math.round(f1.emptyDist / t1 * 100) + '%';
  $('fl2-status').textContent = stat(f2); $('fl2-spd').textContent = f2.curSpeedKmh.toFixed(1); $('fl2-bat').textContent = Math.round(f2.battery) + '%'; $('fl2-load').textContent = Math.round(f2.loadedDist); $('fl2-emp').textContent = Math.round(f2.emptyDist); $('fl2-emp-pct').textContent = Math.round(f2.emptyDist / t2 * 100) + '%';
  $('amr-dist').textContent = Math.round(amrs.reduce((s, a) => s + a.dist, 0));
  if (typeof camMode !== 'undefined' && camMode === 'fp_fl1') { $('cab-spd').textContent = f1.curSpeedKmh.toFixed(1); $('cab-bat').textContent = Math.round(f1.battery) + '%'; $('cab-load').textContent = f1.hasCargo ? '1 PALLET (RM)' : 'EMPTY'; }
  $('kpi-cong').textContent = sim.congestionCount; $('kpi-wait').textContent = sim.totalWaitSec.toFixed(1) + 's'; $('kpi-nearmiss').textContent = sim.nearMissCount;
}

/* ---------- loop simulasi ---------- */
let truckArrivalTimer = 0;
const SIM = {
  update(dt, rawDt, now) {
    if (dt > 0) {
      sim.timeSec += dt; truckArrivalTimer += dt;
      if (truckArrivalTimer > 60) { truckArrivalTimer = 0; sim.stgIn += 1; if (sim.stgOut > 1) sim.stgOut -= 1; refreshStaging(); }
      updateForklifts(dt); updateAMRs(dt); updateConveyor(dt); updateNPC(dt);
      flowArrows.forEach(fa => fa.wrap.position.lerpVectors(fa.a, fa.b, (fa.off + sim.timeSec * .2) % 1));
      if (ZONES.wrapper) ZONES.wrapper.rotation.y += dt * .5;
    }
    LINE.updateVisual(dt, sim.timeSec, lineSt);
    for (const id in intAlertRings) { const ir = intAlertRings[id]; if (ir.timer > 0) { ir.timer -= rawDt; ir.ring.material.opacity = .55 + Math.sin(now * .02) * .3; } else ir.ring.material.opacity = 0; }
    if (safetyRingTimer > 0) { safetyRingTimer -= rawDt; safetyRing.material.opacity = .85; const sc = 1 + (1.6 - safetyRingTimer) * .9; safetyRing.scale.set(sc, sc, 1); } else safetyRing.material.opacity = 0;
  },
  animateActors(rawDt, dt) { animateActors(rawDt, dt, sim.timeSec); },
  updateHUD
};
