'use strict';
/* =====================================================================
   ui.js — kamera (orbit / 3rd / 1st person), input, label, HUD, loop utama
   ===================================================================== */
let camMode = 'orbit';
const orbit = { target: new THREE.Vector3(-8, 1, 0), theta: -0.52, phi: 0.96, radius: 60 };
const tpOrbit = { theta: 0, phi: 0.38, radius: 7.5 };
const fpState = { yaw: 0, pitch: -0.05 };
const walk = { yaw: 0, spd: 2.2 };
let shellMode = 'auto';

const keys = {};
window.addEventListener('keydown', e => { keys[e.code] = true; if (e.code === 'KeyH' && !e.repeat) document.body.classList.toggle('hud-off'); });
window.addEventListener('keyup', e => keys[e.code] = false);

let drag = false, dragBtn = 0, px = 0, py = 0;
const dom = renderer.domElement;
dom.addEventListener('contextmenu', e => e.preventDefault());
dom.addEventListener('mousedown', e => { drag = true; dragBtn = e.button; px = e.clientX; py = e.clientY; });
window.addEventListener('mouseup', () => drag = false);
window.addEventListener('mousemove', e => {
  let dx = 0, dy = 0;
  if (document.pointerLockElement === dom) { dx = e.movementX; dy = e.movementY; }
  else if (drag) { dx = e.clientX - px; dy = e.clientY - py; px = e.clientX; py = e.clientY; }
  else return;
  if (camMode === 'orbit') {
    if (dragBtn === 0) { orbit.theta -= dx * 0.006; orbit.phi = clamp(orbit.phi - dy * 0.006, 0.12, 1.5); }
    else if (dragBtn === 2 || dragBtn === 1) {
      const ps = orbit.radius * 0.0014;
      const r = new THREE.Vector3(Math.cos(orbit.theta), 0, -Math.sin(orbit.theta)), f = new THREE.Vector3(Math.sin(orbit.theta), 0, Math.cos(orbit.theta));
      orbit.target.addScaledVector(r, -dx * ps).addScaledVector(f, -dy * ps);
    }
  } else if (camMode.startsWith('tp_')) {
    tpOrbit.theta -= dx * 0.006; tpOrbit.phi = clamp(tpOrbit.phi + dy * 0.005, 0.08, 1.3);
  } else if (camMode === 'fp_walk') {
    walk.yaw -= dx * 0.004; fpState.pitch = clamp(fpState.pitch - dy * 0.004, -1.2, 1.2);
  } else if (camMode.startsWith('fp_')) {
    fpState.yaw = clamp(fpState.yaw - dx * 0.004, -1.6, 1.6); fpState.pitch = clamp(fpState.pitch - dy * 0.004, -0.8, 0.8);
  }
});
dom.addEventListener('wheel', e => {
  if (camMode === 'orbit') orbit.radius = clamp(orbit.radius + e.deltaY * 0.04, 10, 120);
  else if (camMode.startsWith('tp_')) tpOrbit.radius = clamp(tpOrbit.radius + e.deltaY * 0.01, 3.5, 22);
}, { passive: true });
window.addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

function requestFPSLock() { if (dom.requestPointerLock) dom.requestPointerLock(); }
function togglePanel(id) { const p = document.getElementById(id); p.classList.toggle('collapsed'); p.querySelector('.collapse-btn').textContent = p.classList.contains('collapsed') ? '+' : '–'; }
function switchTab(t, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  btn.classList.add('active'); document.getElementById('tab-' + t).classList.add('active');
}
function setShellMode(v) { shellMode = v; }

function setCameraMode(mode) {
  camMode = mode;
  document.querySelectorAll('[id^="cam-"]').forEach(b => b.classList.remove('active'));
  const map = { orbit: 'cam-orbit', tp_operator: 'cam-tp-op', fp_walk: 'cam-fp-walk', tp_fl1: 'cam-tp-fl1', fp_fl1: 'cam-fp-fl1', tp_fl2: 'cam-tp-fl2', tp_amr: 'cam-tp-amr', fp_amr: 'cam-fp-amr' };
  document.getElementById(map[mode]).classList.add('active');
  operator.visible = (mode !== 'fp_walk');
  if (typeof flStates !== 'undefined') flStates[0].mesh.userData.setDriverVisible(mode !== 'fp_fl1');
  fpState.yaw = 0; fpState.pitch = -0.05; tpOrbit.theta = 0;
  document.getElementById('crosshair').style.display = mode.startsWith('fp_') ? 'block' : 'none';
  document.getElementById('pointer-lock-row').style.display = mode.startsWith('fp_') ? 'flex' : 'none';
  document.getElementById('cab-hud').style.display = (mode === 'fp_fl1') ? 'flex' : 'none';
  const hint = document.getElementById('controls-hint');
  const H = '<span class="kbd">H</span> sembunyikan panel';
  if (mode === 'orbit') hint.innerHTML = '<strong>Orbit:</strong> Drag kiri = putar | Scroll = zoom | Drag kanan = geser | ' + H;
  else if (mode === 'tp_operator' || mode === 'fp_walk') hint.innerHTML = '<strong>Operator:</strong> <span class="kbd">W</span><span class="kbd">A</span><span class="kbd">S</span><span class="kbd">D</span> jalan (coba ke zebra cross) | <span class="kbd">Shift</span> lari | ' + H;
  else if (mode.startsWith('tp_')) hint.innerHTML = '<strong>3rd-Person kendaraan:</strong> Drag mouse = putar kamera | Scroll = zoom | ' + H;
  else hint.innerHTML = '<strong>1st-Person kendaraan:</strong> Drag mouse / PointerLock untuk melihat sekeliling | ' + H;
}

/* label zona: kecil dan rapi */
const labelsLayer = document.getElementById('labels-layer');
let showLabels = true;
const labelItems = [
  { tag: 'RM-WH', txt: 'Raw Material', pos: new THREE.Vector3(-20, 7.2, -20), cls: '' },
  { tag: 'FG-WH', txt: 'Finished Goods', pos: new THREE.Vector3(-20, 7.2, 20), cls: '' },
  { tag: 'STG-IN', txt: 'Staging In', pos: new THREE.Vector3(-37.2, 3.4, -12), cls: '' },
  { tag: 'STG-OUT', txt: 'Staging Out', pos: new THREE.Vector3(-37.2, 3.4, 12), cls: '' },
  { tag: 'CHG-BAY', txt: 'Charging', pos: new THREE.Vector3(-24, 3.2, -6.5), cls: '' },
  { tag: 'OPS-CTRL', txt: 'Control Room', pos: new THREE.Vector3(-15, 3.9, -6), cls: '' },
  { tag: 'PED-PATH', txt: 'Jalur pekerja', pos: new THREE.Vector3(-20, 1.8, 0), cls: 'safety' },
  { tag: 'WIP-BUF-01', txt: 'Buffer mesin', pos: new THREE.Vector3(26, 2.8, -12), cls: '' },
  { tag: 'WIP-BUF-02', txt: 'Buffer QC', pos: new THREE.Vector3(37, 2.8, -3), cls: '' },
  { tag: 'CNC-01', txt: 'CNC', pos: new THREE.Vector3(18, 4.2, -12), cls: '' },
  { tag: 'ROB-01', txt: 'Robot', pos: new THREE.Vector3(34.5, 4.1, -9.5), cls: '' },
  { tag: 'QC-01', txt: 'QC scan', pos: new THREE.Vector3(37, 4.3, 5), cls: '' },
  { tag: 'DOCK-1', txt: 'Bongkar', pos: new THREE.Vector3(-49, 5.5, -12), cls: '' },
  { tag: 'DOCK-2', txt: 'Muat', pos: new THREE.Vector3(-49, 5.5, 12), cls: '' },
  { tag: 'WP-INT-01', txt: '', pos: new THREE.Vector3(-8, 1.3, -12), cls: 'wp' },
  { tag: 'WP-INT-02', txt: '', pos: new THREE.Vector3(-8, 1.3, 12), cls: 'wp' },
  { tag: 'WP-INT-03', txt: '', pos: new THREE.Vector3(-32, 1.3, 0), cls: 'wp' },
  { tag: 'WP-INT-04', txt: 'Crossing', pos: new THREE.Vector3(-8, 1.3, 0), cls: 'wp' }
];
labelItems.forEach(l => {
  const d = document.createElement('div'); d.className = 'zone-label ' + l.cls;
  d.innerHTML = `<b>${l.tag}</b>${l.txt}`; labelsLayer.appendChild(d); l.el = d;
});
function toggleLabels(v) { showLabels = v; labelsLayer.style.display = v ? 'block' : 'none'; }
function updateLabels() {
  if (!showLabels) return;
  const w = innerWidth, h = innerHeight, v = new THREE.Vector3();
  const wpOn = document.getElementById('chk-nodes').checked;
  labelItems.forEach(l => {
    if (l.cls === 'wp' && !wpOn) { l.el.style.display = 'none'; return; }
    v.copy(l.pos).project(camera);
    const d = camera.position.distanceTo(l.pos);
    if (v.z > 1 || d > 95 || camMode.startsWith('fp_') && d > 40) l.el.style.display = 'none';
    else { l.el.style.display = 'flex'; l.el.style.left = ((v.x * .5 + .5) * w) + 'px'; l.el.style.top = ((-v.y * .5 + .5) * h) + 'px'; l.el.style.opacity = d > 70 ? .65 : 1; }
  });
}

function updateOperator(dt) {
  if (camMode !== 'tp_operator' && camMode !== 'fp_walk') { operator.userData.walking = false; return; }
  let mf = 0, mr = 0;
  if (keys.KeyW || keys.ArrowUp) mf += 1; if (keys.KeyS || keys.ArrowDown) mf -= 1;
  if (keys.KeyA || keys.ArrowLeft) mr -= 1; if (keys.KeyD || keys.ArrowRight) mr += 1;
  const spr = (keys.ShiftLeft || keys.ShiftRight) ? 2.4 : 1.0;
  if (mf !== 0 || mr !== 0) {
    const bYaw = (camMode === 'fp_walk') ? walk.yaw : tpOrbit.theta;
    const fwd = new THREE.Vector3(-Math.sin(bYaw), 0, -Math.cos(bYaw)), rgt = new THREE.Vector3(Math.cos(bYaw), 0, -Math.sin(bYaw));
    const dir = new THREE.Vector3().addScaledVector(fwd, mf).addScaledVector(rgt, mr).normalize();
    operator.position.addScaledVector(dir, walk.spd * spr * dt);
    operator.position.x = clamp(operator.position.x, -46, 46); operator.position.z = clamp(operator.position.z, -30, 30);
    operator.rotation.y = (camMode === 'tp_operator') ? Math.atan2(dir.x, dir.z) : walk.yaw + Math.PI;
    operator.userData.walking = true; operator.userData.speed = walk.spd * spr;
  } else operator.userData.walking = false;
}

function updateCamera() {
  if (camMode === 'orbit') {
    camera.position.set(orbit.target.x + orbit.radius * Math.sin(orbit.phi) * Math.sin(orbit.theta), Math.max(1.5, orbit.target.y + orbit.radius * Math.cos(orbit.phi)), orbit.target.z + orbit.radius * Math.sin(orbit.phi) * Math.cos(orbit.theta));
    camera.lookAt(orbit.target);
  } else if (camMode.startsWith('tp_')) {
    let obj = operator, h = 1.6;
    if (camMode === 'tp_fl1') { obj = flStates[0].mesh; h = 1.8; }
    if (camMode === 'tp_fl2') { obj = flStates[1].mesh; h = 1.8; }
    if (camMode === 'tp_amr') { obj = amrs[0].mesh; h = 1.0; }
    const ang = (camMode === 'tp_operator') ? tpOrbit.theta : (obj.rotation.y + Math.PI + tpOrbit.theta);
    const focus = obj.position.clone().add(new THREE.Vector3(0, h, 0));
    camera.position.set(focus.x + tpOrbit.radius * Math.cos(tpOrbit.phi) * Math.sin(ang), Math.max(0.8, focus.y + tpOrbit.radius * Math.sin(tpOrbit.phi)), focus.z + tpOrbit.radius * Math.cos(tpOrbit.phi) * Math.cos(ang));
    camera.lookAt(focus);
  } else if (camMode === 'fp_walk') {
    const eye = operator.position.clone().add(new THREE.Vector3(0, 1.72, 0)); camera.position.copy(eye);
    camera.lookAt(eye.clone().add(new THREE.Vector3(-Math.sin(walk.yaw) * Math.cos(fpState.pitch), Math.sin(fpState.pitch), -Math.cos(walk.yaw) * Math.cos(fpState.pitch))));
  } else if (camMode === 'fp_fl1' || camMode === 'fp_amr') {
    const veh = camMode === 'fp_fl1' ? flStates[0].mesh : amrs[0].mesh;
    const localEye = camMode === 'fp_fl1' ? new THREE.Vector3(0, 1.98, -0.12) : new THREE.Vector3(0, 1.12, 0.45);
    const worldEye = localEye.clone().applyMatrix4(veh.matrixWorld); camera.position.copy(worldEye);
    const yaw = veh.rotation.y + fpState.yaw;
    camera.lookAt(worldEye.clone().add(new THREE.Vector3(Math.sin(yaw) * Math.cos(fpState.pitch), Math.sin(fpState.pitch), Math.cos(yaw) * Math.cos(fpState.pitch))));
  }
  sky.position.copy(camera.position);
}

function updateShell() {
  const full = shellMode === 'on' ? true : shellMode === 'off' ? false : camMode !== 'orbit';
  HALL.setShell(full);
}

/* ---------- loop utama ---------- */
let lastT = performance.now(), errOnce = false;
const FPS = { n: 0, t: 0, v: 0 };
function animate(now) {
  requestAnimationFrame(animate);
  const rawDt = Math.min((now - lastT) / 1000, 0.1); lastT = now;
  try {
    const dt = rawDt * (typeof sim !== 'undefined' ? sim.speed : 1);
    if (typeof SIM !== 'undefined') SIM.update(dt, rawDt, now);
    updateOperator(rawDt);
    if (typeof SIM !== 'undefined') SIM.animateActors(rawDt, dt);
    scene.updateMatrixWorld();
    updateCamera(); updateShell(); updateLabels();
    if (typeof SIM !== 'undefined') SIM.updateHUD();
  } catch (e) { if (!errOnce) { errOnce = true; console.error('Kesalahan frame:', e); } }
  renderer.render(scene, camera);
  FPS.n++; FPS.t += rawDt; if (FPS.t > 1) { FPS.v = FPS.n / FPS.t; FPS.n = 0; FPS.t = 0; }
}
window.__twin = { FPS, renderer, scene, camera, get mode() { return camMode; } };   // untuk pengujian
requestAnimationFrame(animate);
