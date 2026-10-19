/* Mission Clean-Out: live 3D hero. A black dump trailer with plywood sideboards, heaped with junk.
   Everything is modeled here from primitives and canvas textures; no external models.
   <div class="stage" data-3d><img ...fallback></div>   ?still=3840 renders one frame at that width for exports. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const host = document.querySelector('[data-3d]');
const params = new URLSearchParams(location.search);
const stillW = +params.get('still') || 0;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches || !!stillW;

/* ---------- canvas textures ---------- */
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
function rand(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

const plywood = canvasTex(1024, 256, (g, w, h) => {
  const r = rand(7);
  g.fillStyle = '#b88d5a'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) {                 // grain
    const y = r() * h, a = 0.05 + r() * 0.12;
    g.strokeStyle = `rgba(${r() > .5 ? '90,60,30' : '230,200,150'},${a})`;
    g.lineWidth = 0.6 + r() * 2.2;
    g.beginPath(); g.moveTo(0, y);
    for (let x = 0; x <= w; x += 64) g.lineTo(x, y + Math.sin(x * 0.01 + i) * (2 + r() * 5));
    g.stroke();
  }
  for (let i = 0; i < 14; i++) {                  // knots
    const x = r() * w, y = r() * h, rx = 6 + r() * 14;
    g.fillStyle = 'rgba(95,62,32,.35)'; g.beginPath(); g.ellipse(x, y, rx, rx * .45, 0, 0, 7); g.fill();
  }
  g.fillStyle = 'rgba(40,28,15,.55)';             // weathering along bottom
  const grd = g.createLinearGradient(0, h * .7, 0, h); grd.addColorStop(0, 'rgba(60,40,20,0)'); grd.addColorStop(1, 'rgba(60,40,20,.35)');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
});

const fabric = canvasTex(256, 256, (g, w, h) => {
  const r = rand(3); g.fillStyle = '#7b5a43'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${r() > .5 ? '40,25,15' : '160,120,90'},${.05 + r() * .08})`; g.fillRect(r() * w, r() * h, 1.5, 1.5); }
}, [3, 3]);

const ticking = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#eef0ee'; g.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 32) { g.fillStyle = '#9fb3c8'; g.fillRect(x, 0, 8, h); }
  const r = rand(11); for (let i = 0; i < 1800; i++) { g.fillStyle = `rgba(120,110,90,${r() * .06})`; g.fillRect(r() * w, r() * h, 3, 3); }
}, [2, 2]);

const kraft = canvasTex(256, 256, (g, w, h) => {
  const r = rand(5); g.fillStyle = '#bf9363'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(${r() > .5 ? '120,80,40' : '220,180,130'},${r() * .1})`; g.fillRect(r() * w, r() * h, 2, 1); }
  g.fillStyle = 'rgba(205,170,120,.9)'; g.fillRect(w * .44, 0, w * .12, h);   // packing tape
});

/* ---------- scene ---------- */
const W = () => host.clientWidth, H = () => host.clientHeight;
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: !!stillW });
renderer.setPixelRatio(stillW ? stillW / W() : Math.min(devicePixelRatio || 1, 2));
renderer.setSize(W(), H());
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const pm = new THREE.PMREMGenerator(renderer);
scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(25, W() / H(), 0.1, 100);
camera.position.set(6.3, 3.1, 7.0);
const look = new THREE.Vector3(0.05, 1.25, 0);
camera.lookAt(look);

scene.add(new THREE.HemisphereLight('#f4f1ea', '#5d6b60', 0.55));
const sun = new THREE.DirectionalLight('#fff1dc', 2.6);
sun.position.set(5, 9, 4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 30 });
sun.shadow.bias = -0.0004; sun.shadow.radius = 4;
scene.add(sun);
const rim = new THREE.DirectionalLight('#cfe3ff', 0.6); rim.position.set(-6, 4, -5); scene.add(rim);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.22 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

const rig = new THREE.Group(); scene.add(rig);

/* ---------- materials ---------- */
const M = {
  steel: new THREE.MeshStandardMaterial({ color: '#1b1d1e', roughness: .45, metalness: .7 }),
  steelWorn: new THREE.MeshStandardMaterial({ color: '#2a2c2d', roughness: .6, metalness: .55 }),
  tire: new THREE.MeshStandardMaterial({ color: '#141414', roughness: .9 }),
  rim: new THREE.MeshStandardMaterial({ color: '#b9bdbf', roughness: .3, metalness: .9 }),
  ply: new THREE.MeshStandardMaterial({ map: plywood, roughness: .82 }),
  red: new THREE.MeshStandardMaterial({ color: '#c0261d', emissive: '#7a0d08', emissiveIntensity: .8, roughness: .3 }),
  couch: new THREE.MeshStandardMaterial({ map: fabric, roughness: .95 }),
  mattress: new THREE.MeshStandardMaterial({ map: ticking, roughness: .9 }),
  fridge: new THREE.MeshStandardMaterial({ color: '#e7e9e5', roughness: .25, metalness: .1 }),
  chrome: new THREE.MeshStandardMaterial({ color: '#d8dadb', roughness: .15, metalness: 1 }),
  box: new THREE.MeshStandardMaterial({ map: kraft, roughness: .9 }),
  bag: new THREE.MeshStandardMaterial({ color: '#16181a', roughness: .28, metalness: .05 }),
  carpet: new THREE.MeshStandardMaterial({ color: '#a59a83', roughness: 1 }),
  shade: new THREE.MeshStandardMaterial({ color: '#efe6d2', roughness: .8, side: THREE.DoubleSide }),
};

function mesh(geo, mat, x = 0, y = 0, z = 0, parent = rig) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true; parent.add(m); return m;
}
const rbox = (w, h, d, r = .03, s = 3) => new RoundedBoxGeometry(w, h, d, s, r);

/* ---------- trailer ---------- */
const FLOOR = 0.86, L = 4.1, WD = 2.0, SH = 0.62;
mesh(rbox(L + .1, .14, WD + .08, .02), M.steel, 0, FLOOR - .07, 0);             // bed
mesh(rbox(L, .16, .12, .02), M.steel, 0, FLOOR - .2, -.8);                         // frame rails
mesh(rbox(L, .16, .12, .02), M.steel, 0, FLOOR - .2, .8);
for (const x of [-1.6, -.5, .6, 1.6]) mesh(rbox(.1, .12, 1.7, .02), M.steel, x, FLOOR - .2, 0);

// sideboards (plywood) with black stake posts
const side = (len) => rbox(len, SH, .06, .015, 2);
mesh(side(L), M.ply, 0, FLOOR + SH / 2, -WD / 2 + .03);
mesh(side(L), M.ply, 0, FLOOR + SH / 2, WD / 2 - .03);
const end = mesh(side(WD - .02), M.ply, -L / 2 + .03, FLOOR + SH / 2, 0); end.rotation.y = Math.PI / 2;
const gate = mesh(side(WD - .02), M.ply, L / 2 - .03, FLOOR + SH / 2, 0); gate.rotation.y = Math.PI / 2;
for (const x of [-1.98, -1, 0, 1, 1.98]) for (const z of [-1, 1]) mesh(rbox(.08, SH + .22, .09, .015), M.steelWorn, x, FLOOR + (SH - .22) / 2, z * (WD / 2 + .04));
for (const z of [-1, 1]) mesh(rbox(L + .12, .07, .1, .015), M.steelWorn, 0, FLOOR + .02, z * (WD / 2 + .04));   // bottom rub rail

// tandem wheels + fenders
const tireG = new THREE.CylinderGeometry(.37, .37, .24, 40); tireG.rotateX(Math.PI / 2);
const rimG = new THREE.CylinderGeometry(.21, .21, .25, 24); rimG.rotateX(Math.PI / 2);
const hubG = new THREE.CylinderGeometry(.07, .07, .27, 12); hubG.rotateX(Math.PI / 2);
for (const x of [-.42, .42]) for (const z of [-1.17, 1.17]) {
  mesh(tireG, M.tire, x, .37, z); mesh(rimG, M.rim, x, .37, z); mesh(hubG, M.steel, x, .37, z);
}
for (const z of [-1.17, 1.17]) {
  const f = mesh(new THREE.CylinderGeometry(.5, .5, .32, 32, 1, true, Math.PI / 2, Math.PI), M.steel, -.42, .4, z);
  f.rotation.x = Math.PI / 2; f.scale.set(1.0, 1, .9);
  const f2 = f.clone(); f2.position.x = .42; rig.add(f2);
  mesh(rbox(.9, .05, .34, .02), M.steel, 0, .9, z);
}
// tongue, coupler, jack
for (const z of [-.75, .75]) {
  const t = mesh(rbox(1.75, .13, .12, .02), M.steel, -2.85, FLOOR - .22, z * .5);
  t.rotation.y = -z * 0.38;
}
mesh(rbox(.42, .16, .2, .04), M.steel, -3.72, FLOOR - .2, 0);
mesh(new THREE.SphereGeometry(.09, 20, 12), M.chrome, -3.9, FLOOR - .2, 0);
mesh(new THREE.CylinderGeometry(.06, .06, .9, 16), M.steelWorn, -3.3, .5, .12);
mesh(new THREE.CylinderGeometry(.12, .12, .04, 16), M.steel, -3.3, .03, .12);
// tail lights
for (const z of [-.82, .82]) mesh(rbox(.05, .1, .22, .02), M.red, L / 2 + .06, FLOOR - .16, z);

/* ---------- junk ---------- */
const junk = [];
function item(group, x, y, z, rx = 0, ry = 0, rz = 0) {
  group.position.set(x, y, z); group.rotation.set(rx, ry, rz);
  group.userData.to = { p: group.position.clone(), r: group.rotation.clone() };
  rig.add(group); junk.push(group); return group;
}
function grp(build) { const g = new THREE.Group(); build((geo, mat, x, y, z) => mesh(geo, mat, x, y, z, g)); return g; }

// fridge lying on its back along the passenger side
item(grp(add => {
  add(rbox(1.62, .74, .72, .06, 4), M.fridge, 0, 0, 0);
  add(rbox(.02, .02, .7, .01), new THREE.MeshStandardMaterial({ color: '#c9ccc8' }), -.25, .375, 0);
  add(rbox(.5, .04, .04, .02), M.chrome, -.55, .4, .26);
  add(rbox(.5, .04, .04, .02), M.chrome, .3, .4, .26);
}), .85, FLOOR + .37, .5, 0, .04, 0);

// boxes
const boxes = [[.5, .48, .5, -1.35, FLOOR + .24, -.48, 0, .2, 0], [.56, .5, .56, -1.4, FLOOR + .25, .25, 0, -.15, 0], [.42, .4, .44, -.75, FLOOR + .2, .62, 0, .5, 0],
  [.46, .42, .46, -1.3, FLOOR + .72, -.18, .08, .65, -.1], [.38, .34, .38, 1.5, FLOOR + .93, .6, 0, .3, .05], [.36, .32, .36, 1.05, FLOOR + .92, .72, 0, -.4, 0], [.4, .36, .4, -1.45, FLOOR + .66, .5, .1, .2, .12], [.44, .38, .4, -.6, FLOOR + .19, -.55, 0, -.3, 0]];
for (const [w, h, d, x, y, z, rx, ry, rz] of boxes) item(grp(add => add(rbox(w, h, d, .02, 2), M.box, 0, 0, 0)), x, y, z, rx, ry, rz);

// trash bags (lumpy)
function bag(seed) {
  const g = new THREE.SphereGeometry(.34, 28, 20), p = g.attributes.position, r = rand(seed), v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = 1 + (Math.sin(v.x * 9 + seed) * Math.cos(v.z * 7) * .06) + (r() - .5) * .025; v.multiplyScalar(n); if (v.y < -.15) v.y = -.15 - (v.y + .15) * .2; p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals();
  return grp(add => { add(g, M.bag, 0, 0, 0); add(new THREE.SphereGeometry(.07, 14, 10), M.bag, 0, .33, 0).scale.set(1, 1.5, 1); });
}
item(bag(1), .05, FLOOR + .18, -.55, 0, .3, 0).scale.set(1, .85, 1);
item(bag(2), 1.5, FLOOR + .18, -.5, 0, 1, .1).scale.set(.9, .8, .95);
item(bag(3), -1.7, FLOOR + 1.05, -.45, .2, 0, .15).scale.set(.8, .75, .8);

// mattress draped over the pile
item(grp(add => add(rbox(1.95, .24, 1.3, .1, 4), M.mattress, 0, 0, 0)), -.55, FLOOR + .95, -.1, .12, .1, .24);

// couch riding on top
item(grp(add => {
  add(rbox(1.9, .42, .86, .08, 3), M.couch, 0, 0, 0);
  add(rbox(1.9, .56, .24, .1, 3), M.couch, 0, .42, -.33);
  add(rbox(.22, .58, .86, .09, 3), M.couch, -.95, .2, 0);
  add(rbox(.22, .58, .86, .09, 3), M.couch, .95, .2, 0);
  add(rbox(.82, .18, .64, .08, 3), M.couch, -.42, .29, .08);
  add(rbox(.82, .18, .64, .08, 3), M.couch, .42, .29, .08);
}), .45, FLOOR + 1.42, -.1, .06, .3, -.12);

// rolled carpet and a floor lamp sticking up
const roll = new THREE.CylinderGeometry(.15, .15, 2.1, 24); roll.rotateZ(Math.PI / 2);
item(grp(add => add(roll, M.carpet, 0, 0, 0)), -.35, FLOOR + 1.28, .66, 0, .22, .16);

// flat TV leaning on the fridge
item(grp(add => { add(rbox(1.05, .62, .06, .02), M.bag, 0, 0, 0); add(rbox(.98, .55, .01, .005), new THREE.MeshStandardMaterial({ color: '#0b0d10', roughness: .08, metalness: .3 }), 0, 0, .032); }), 1.45, FLOOR + 1.1, -.35, -.25, -.6, .08);

// wooden kitchen chair upside down on top
item(grp(add => {
  const wood = new THREE.MeshStandardMaterial({ color: '#8a5a33', roughness: .6 });
  add(rbox(.46, .05, .44, .015), wood, 0, 0, 0);
  for (const [x, z] of [[-.19, -.18], [.19, -.18], [-.19, .18], [.19, .18]]) add(new THREE.CylinderGeometry(.022, .018, .45, 10), wood, x, .25, z);
  add(rbox(.46, .4, .04, .015), wood, 0, -.22, -.2);
}), -1.25, FLOOR + 1.2, .05, .1, .7, .2);
item(grp(add => {
  add(new THREE.CylinderGeometry(.018, .018, 1.4, 10), M.chrome, 0, .7, 0);
  add(new THREE.CylinderGeometry(.16, .26, .3, 24, 1, true), M.shade, 0, 1.45, 0);
  add(new THREE.CylinderGeometry(.14, .14, .03, 20), M.steel, 0, 0, 0);
}), -1.72, FLOOR + .55, -.62, .05, 0, -.42);

/* ---------- motion ---------- */
const easeOutBack = t => { const c = 1.5; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
junk.forEach((g, i) => { g.userData.delay = 0.25 + i * 0.09; if (!reduce) g.position.y += 3.2; });
let px = 0, py = 0, tx = 0, ty = 0;
host.addEventListener('pointermove', e => { const b = host.getBoundingClientRect(); tx = (e.clientX - b.left) / b.width - .5; ty = (e.clientY - b.top) / b.height - .5; });
host.addEventListener('pointerleave', () => { tx = ty = 0; });

let visible = true, t0 = performance.now();
new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) loop(); }).observe(host);

function frame(now) {
  const t = (now - t0) / 1000;
  if (!reduce) {
    for (const g of junk) {
      const k = Math.min(1, Math.max(0, (t - g.userData.delay) / .75)), to = g.userData.to;
      g.position.y = to.p.y + (1 - easeOutBack(k)) * 3.2;
      g.rotation.x = to.r.x + (1 - k) * .6; g.rotation.z = to.r.z - (1 - k) * .4;
    }
    px += (tx - px) * .05; py += (ty - py) * .05;
    rig.rotation.y = Math.sin(t * .18) * .1 + px * .35;
    camera.position.y = 3.1 - py * .7;
    camera.lookAt(look);
  }
  renderer.render(scene, camera);
}
let raf = 0;
function loop() { cancelAnimationFrame(raf); const tick = now => { frame(now); if (visible && !reduce) raf = requestAnimationFrame(tick); }; raf = requestAnimationFrame(tick); }

function resize() { renderer.setSize(W(), H()); camera.aspect = W() / H(); camera.updateProjectionMatrix(); if (reduce) frame(performance.now()); }
new ResizeObserver(resize).observe(host);

host.appendChild(renderer.domElement);
frame(performance.now());
requestAnimationFrame(() => { host.classList.add('live'); window.__ready = true; });
loop();
