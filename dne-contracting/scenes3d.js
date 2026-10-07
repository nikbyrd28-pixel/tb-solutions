/* D N E Contracting — live 3D room scenes for service / project cards.
   One shared WebGL renderer draws into every visible card canvas (three.js multi-view pattern).
   Usage: <div class="photo s3d" data-scene="kitchen"><img ...fallback></div>  then  window.DNE3D.mount(root)
   Scenes: kitchen · bathroom · basement · heater · plans */
let THREE, OrbitControls, RoomEnvironment, renderer, pm, env, running = false;
const cards = new Map();
let io;

async function lib() {
  if (THREE) return true;
  try {
    THREE = await import('three');
    ({ OrbitControls } = await import('three/addons/controls/OrbitControls.js'));
    ({ RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js'));
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    pm = new THREE.PMREMGenerator(renderer); env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    return true;
  } catch (e) { return false; }
}

/* ---------- materials & primitives ---------- */
const M = {};
function mats() {
  if (M.wall) return M;
  const m = (n, o) => (M[n] = new THREE.MeshStandardMaterial(o));
  m('wall', { color: '#F2F0EB', roughness: .92 }); m('wall2', { color: '#DCE6EE', roughness: .9 }); m('floor', { color: '#C9A87C', roughness: .6 });
  m('tilef', { color: '#D9D9D4', roughness: .45 }); m('conc', { color: '#B9B9B4', roughness: .95 }); m('lvp', { color: '#8E6F4E', roughness: .55 });
  m('cab', { color: '#EDEBE5', roughness: .55 }); m('island', { color: '#5B6B5A', roughness: .6 }); m('wood', { color: '#B9946A', roughness: .55 });
  m('quartz', { color: '#F5F3EE', roughness: .28 }); m('steel', { color: '#C9CCD0', metalness: .85, roughness: .35 }); m('porc', { color: '#FBFAF7', roughness: .12 });
  m('brass', { color: '#C9A227', metalness: .9, roughness: .3 }); m('black', { color: '#1E1E1E', metalness: .4, roughness: .45 });
  m('glass', { color: '#CFE3F0', transparent: true, opacity: .25, roughness: .05 }); m('dark', { color: '#202020', roughness: .5 });
  m('fabric', { color: '#6E7F95', roughness: .95 }); m('rug', { color: '#B7A58E', roughness: 1 }); m('mirror', { color: '#ffffff', metalness: 1, roughness: .03 });
  m('grey', { color: '#D8D8D4', roughness: .6 }); m('copper', { color: '#B87333', metalness: .8, roughness: .35 }); m('pvc', { color: '#F4F4F2', roughness: .5 });
  m('pexr', { color: '#C8302A', roughness: .5 }); m('pexb', { color: '#2E5FA3', roughness: .5 }); m('lamp', { color: '#fff8e6', emissive: '#fff2cc', emissiveIntensity: 1.3, roughness: .4 });
  m('white', { color: '#F7F7F5', roughness: .4 }); m('paper', { color: '#FBFAF4', roughness: .9 }); m('ink', { color: '#0F2A44', roughness: .8 }); m('red', { color: '#B8322B', roughness: .6 });
  m('plant', { color: '#4F7A4A', roughness: .9 }); m('pot', { color: '#A9654B', roughness: .8 }); m('towel', { color: '#9DB7C6', roughness: 1 }); m('tile', { color: '#CFCAC0', roughness: .35 });
  m('gravel', { color: '#8E8A83', roughness: 1 }); m('dirt', { color: '#6B5A48', roughness: 1 }); m('water', { color: '#4C7FB5', transparent: true, opacity: .55, roughness: .1 });
  return M;
}
const bx = (g, w, h, d, m, x, y, z, ry = 0) => { const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); me.position.set(x, y + h / 2, z); me.rotation.y = ry; me.castShadow = me.receiveShadow = true; g.add(me); return me; };
const cyl = (g, r, h, m, x, y, z, rx = 0, rz = 0, rt = r) => { const me = new THREE.Mesh(new THREE.CylinderGeometry(rt, r, h, 28), m); me.position.set(x, y + h / 2, z); me.rotation.set(rx, 0, rz); me.castShadow = me.receiveShadow = true; g.add(me); return me; };
const tor = (g, r, t, m, x, y, z, rx = Math.PI / 2) => { const me = new THREE.Mesh(new THREE.TorusGeometry(r, t,10, 32), m); me.position.set(x, y, z); me.rotation.x = rx; me.castShadow = true; g.add(me); return me; };
const sph = (g, r, m, x, y, z) => { const me = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), m); me.position.set(x, y, z); me.castShadow = true; g.add(me); return me; };
function doors(g, W, H, D, n, y0) { for (let i = 1; i < n; i++) bx(g, .02, H - .1, .02, M.dark, -W / 2 + W * i / n, y0 + .05, D / 2 + .01); for (let i = 0; i < n; i++) cyl(g, .025, .4, M.black, -W / 2 + W * (i + .5) / n + (i < n / 2 ? .5 : -.5) * (W / n) * .7, y0 + H * .55, D / 2 + .05); }
function faucet(g, x, y, z) { cyl(g, .05, .8, M.brass, x, y, z); cyl(g, .04, .5, M.brass, x, y + .78, z + .22, Math.PI / 2); cyl(g, .05, .12, M.brass, x, y + .68, z + .45); }
function room(g, W, D, H, fm, wm, opts = {}) {
  const f = bx(g, W, .1, D, fm, 0, -.1, 0); f.receiveShadow = true;
  bx(g, W, H, .15, wm, 0, 0, -D / 2 - .075);                // back wall
  bx(g, .15, H, D, opts.leftMat || wm, -W / 2 - .075, 0, 0); // left wall
  bx(g, W + .3, .25, .15, M.white, 0, 0, -D / 2 - .07); bx(g, .15, .25, D + .3, M.white, -W / 2 - .07, 0, 0); // base trim
  if (opts.win) { const [wx, ww, wh, wy] = opts.win; bx(g, ww + .3, wh + .3, .12, M.white, wx, wy - .15, -D / 2 - .02); bx(g, ww, wh, .06, M.glass, wx, wy, -D / 2 + .02); bx(g, .06, wh, .06, M.white, wx, wy, -D / 2 + .02); bx(g, ww, .06, .06, M.white, wx, wy + wh / 2, -D / 2 + .02); }
}
function plant(g, x, z, s = 1) { cyl(g, .32 * s, .5 * s, M.pot, x, 0, z, 0, 0, .26 * s); sph(g, .42 * s, M.plant, x, .95 * s, z); sph(g, .3 * s, M.plant, x + .25 * s, 1.15 * s, z - .1 * s); sph(g, .28 * s, M.plant, x - .22 * s, 1.1 * s, z + .15 * s); }
function pendant(g, x, y, z) { cyl(g, .01, 1.6, M.black, x, y, z); cyl(g, .32, .4, M.black, x, y - .4, z, 0, 0, .12); cyl(g, .2, .05, M.lamp, x, y - .4, z); }

/* ---------- scenes ---------- */
const SCENES = {
  kitchen(g) {
    room(g, 12, 10, 8.5, M.floor, M.wall, { win: [0, 3.4, 2.6, 4.9] });
    // back run: sink under window, dishwasher, cabinets
    bx(g, 12, 2.9, 2.0, M.cab, 0, 0, -4); bx(g, 12.1, .12, 2.1, M.quartz, 0, 2.9, -4); doors(g, 12, 2.6, 2, 7, .2);
    bx(g, 2.6, .75, 1.5, M.steel, 0, 2.2, -4.1); bx(g, 2.6, .05, 1.5, M.cab, 0, 2.2, -4.1); faucet(g, 0, 3.0, -4.75);
    bx(g, 2.0, 2.9, 2.02, M.steel, 3.2, 0, -4); bx(g, 1.7, .1, .05, M.black, 3.2, 2.5, -2.98);
    bx(g, 12, .07, 2.1, M.tile, 0, 3.0, -4.03); bx(g, 12, 2.2, .06, M.tile, 0, 3.02, -4.95); // backsplash
    bx(g, 12, 2.6, 1.2, M.cab, 0, 5.3, -4.4); doors(g, 12, 2.5, 1.2, 8, 5.3); bx(g, 12, .08, 1.3, M.white, 0, 7.9, -4.4);
    // left run: range + fridge
    const L = new THREE.Group(); L.rotation.y = Math.PI / 2; L.position.set(-5, 0, 0); g.add(L);
    bx(L, 7, 2.9, 2, M.cab, -1.5, 0, 0); bx(L, 7.1, .12, 2.1, M.quartz, -1.5, 2.9, 0); doors(L, 7, 2.6, 2, 4, .2);
    bx(L, 2.5, 3, 2.1, M.steel, 1.2, 0, 0); bx(L, 2.4, .05, 2, M.dark, 1.2, 3, 0); [[-.5, -.5], [.5, -.5], [-.5, .5], [.5, .5]].forEach(([a, b]) => tor(L, .22, .03, M.dark, 1.2 + a, 3.07, b * .6));
    bx(L, 2.5, .5, .1, M.steel, 1.2, 3, -1); bx(L, 1.8, .9, .03, M.dark, 1.2, 1.1, 1.05);
    bx(L, 3, 5.9, 2.2, M.steel, 3.8, 0, 0); cyl(L, .04, 1.6, M.steel, 3.5, 2.6, 1.2); cyl(L, .04, 1.6, M.steel, 4.1, 2.6, 1.2);
    bx(L, 4, 1.6, .9, M.black, 1.2, 6, -.5); // hood
    // island with seating
    bx(g, 6, 2.9, 2.6, M.island, 1.2, 0, 1.2); bx(g, 6.5, .14, 3.1, M.quartz, 1.2, 2.9, 1.2);
    for (let i = 0; i < 3; i++) { const sx = -.6 + i * 1.8; cyl(g, .55, .12, M.wood, sx, 2.3, 3.1); cyl(g, .05, 2.3, M.black, sx, 0, 3.1); bx(g, .9, .6, .08, M.wood, sx, 2.6, 3.5); }
    pendant(g, -.4, 8.4, 1.2); pendant(g, 1.2, 8.4, 1.2); pendant(g, 2.8, 8.4, 1.2);
    sph(g, .25, M.red, 0.2, 3.3, 1.1); sph(g, .25, M.red, .55, 3.3, 1.3); sph(g, .25, M.red, .3, 3.3, 1.6); // bowl of apples
    cyl(g, .5, .08, M.wood, .4, 3.0, 1.3);
    plant(g, 4.6, 3.6, 1.1);
    return { cam: [13, 9.5, 14], look: [0, 2.6, -.5] };
  },
  bathroom(g) {
    room(g, 10, 9, 8.5, M.tilef, M.wall, { win: [-2.6, 1.8, 1.4, 6.2] });
    // tiled shower, curbless, glass panel
    const sx = 2.9; bx(g, 4.2, 7.4, .08, M.tile, sx, 0, -4.4); bx(g, .08, 7.4, 4.2, M.tile, sx + 2.1 - .04, 0, -2.4);
    bx(g, 4.2, .02, 4.2, M.tile, sx, .0, -2.4); cyl(g, .2, .02, M.black, sx, .02, -2.4);
    bx(g, .04, 7, 4.2, M.glass, sx - 2.1, 0, -2.4); bx(g, .06, .06, 4.2, M.black, sx - 2.1, 7, -2.4);
    cyl(g, .05, 2.4, M.black, sx, 4.2, -4.2); cyl(g, .04, .8, M.black, sx, 6.75, -3.85, Math.PI / 2); cyl(g, .45, .05, M.black, sx, 6.65, -3.45);
    cyl(g, .08, .35, M.black, sx, 3.6, -4.25, Math.PI / 2); bx(g, 1.2, .25, .3, M.tile, sx + .9, 4.6, -4.3);
    // floating double vanity
    bx(g, 5.4, 1.9, 2, M.wood, -2.2, 1.6, -3.5); doors(g, 5.4, 1.8, 2, 2, 1.6); bx(g, 5.5, .1, 2.1, M.quartz, -2.2, 3.5, -3.5);
    bx(g, 1.4, .5, 1.1, M.porc, -3.5, 3.6, -3.5); bx(g, 1.4, .5, 1.1, M.porc, -.9, 3.6, -3.5); faucet(g, -3.5, 4.1, -4.1); faucet(g, -.9, 4.1, -4.1);
    cyl(g, 1.0, .04, M.mirror, -3.5, 6, -4.42, Math.PI / 2); cyl(g, 1.0, .04, M.mirror, -.9, 6, -4.42, Math.PI / 2);
    bx(g, 5.4, .1, .18, M.lamp, -2.2, 8, -4.3); bx(g, 5.4, .06, 2, M.lamp, -2.2, 1.55, -3.5);
    // toilet
    bx(g, 1.4, .6, .6, M.porc, -4.0, 1.4, -.3); bx(g, 1.4, 1.4, .55, M.porc, -4.0, 0, -.35); const bw = cyl(g, .5, 1.25, M.porc, -4.0, 0, .45); bw.scale.z = 1.4; const st = tor(g, .5, .07, M.porc, -4.0, 1.28, .45); st.scale.set(1, 1.4, 1);
    // towels, plant, bath mat
    bx(g, .06, .06, 2, M.black, -4.9, 5.2, 2.5, 0); bx(g, .1, 1.6, 1, M.towel, -4.8, 3.7, 2.5); bx(g, .1, 1.6, .8, M.towel, -4.8, 3.7, 3.4);
    bx(g, 2.2, .06, 1.4, M.rug, .6, 0, -1.1); plant(g, 4.0, 3.4, .9);
    return { cam: [12, 8.5, 13], look: [-.4, 2.8, -.6] };
  },
  basement(g) {
    room(g, 14, 11, 7.6, M.lvp, M.wall2, { win: [4, 2.6, 1.1, 6.2] });
    // half bath enclosure, open door
    bx(g, 4.6, 7.6, .3, M.wall, -4.7, 0, -1.2); bx(g, .3, 7.6, 4.3, M.wall, -2.55, 0, -3.35);
    bx(g, 1.4, 6.8, .1, M.wood, -3.1, 0, -1.1, -.9); // door swung open
    bx(g, 4.4, .02, 4.3, M.tilef, -4.8, 0, -3.3);
    bx(g, 1.1, .5, .5, M.porc, -5.9, 1.3, -5.0); bx(g, 1.1, 1.3, .5, M.porc, -5.9, 0, -5.0); const b = cyl(g, .42, 1.2, M.porc, -5.9, 0, -4.3); b.scale.z = 1.4;
    bx(g, 1.6, 2.7, 1.5, M.wood, -3.6, 0, -4.7); bx(g, 1.7, .1, 1.6, M.quartz, -3.6, 2.7, -4.7); bx(g, 1.0, .4, .9, M.porc, -3.6, 2.8, -4.7); faucet(g, -3.6, 3.2, -5.2); bx(g, 1.3, 1.6, .04, M.mirror, -3.6, 4.2, -5.45);
    // laundry closet: stacked washer/dryer
    bx(g, 3.2, 7.6, .3, M.wall, 5.4, 0, -2.9); bx(g, .3, 7.6, 2.6, M.wall, 3.95, 0, -4.2);
    bx(g, 2.6, 3, 2.4, M.white, 5.5, 0, -4.2); tor(g, .65, .08, M.steel, 5.5, 1.5, -2.98, 0); cyl(g, .6, .05, M.dark, 5.5, 1.5, -2.96, Math.PI / 2);
    bx(g, 2.6, 3, 2.4, M.white, 5.5, 3.05, -4.2); tor(g, .65, .08, M.steel, 5.5, 4.55, -2.98, 0); cyl(g, .6, .05, M.dark, 5.5, 4.55, -2.96, Math.PI / 2); bx(g, 2.4, .3, .1, M.steel, 5.5, 5.7, -3.0);
    bx(g, 3.2, .35, .9, M.pvc, 5.5, 6.4, -4.6);
    // family room
    bx(g, 6, 1.1, 2.8, M.fabric, 1.2, 0, 2.2); bx(g, 6, 1.6, .7, M.fabric, 1.2, 1.1, .85); bx(g, .7, .9, 2.8, M.fabric, -1.65, 1.1, 2.2); bx(g, .7, .9, 2.8, M.fabric, 4.05, 1.1, 2.2);
    for (let i = 0; i < 3; i++) bx(g, 1.65, .45, 2.1, M.fabric, -.5 + i * 1.7, 1.1, 2.5);
    bx(g, 2.6, 1.3, 1.4, M.wood, 1.2, 0, 4.6); bx(g, 7, .04, 5, M.rug, 1.2, 0, 3.4);
    bx(g, 5.5, 3.1, .12, M.dark, 1.2, 2.2, -5.3); bx(g, 5.2, 2.8, .02, M.ink, 1.2, 2.35, -5.22); bx(g, 6.5, 1.5, 1.4, M.wood, 1.2, 0, -4.7);
    for (let i = 0; i < 4; i++) { const r = cyl(g, .3, .06, M.lamp, -3 + i * 3, 7.56, -1 + (i % 2) * 3); r.receiveShadow = false; }
    plant(g, 6.0, 4.6, 1.2); bx(g, .35, 2.6, .35, M.lamp, -1.9, 1.1, -4.4); cyl(g, .05, 2.6, M.black, -1.9, 0, -4.4);
    return { cam: [15, 9, 15], look: [.5, 2.4, -.4] };
  },
  heater(g) {
    room(g, 9, 8, 8, M.conc, M.wall2);
    // tankless unit on wall
    bx(g, 1.9, 2.6, 1.0, M.white, 0, 3.6, -3.5); bx(g, 1.3, .35, .03, M.dark, 0, 5.4, -2.98); bx(g, 1.6, .02, 1.0, M.steel, 0, 3.6, -3.5);
    cyl(g, .22, 2.4, M.pvc, 0, 6.2, -3.5); cyl(g, .22, 1.2, M.pvc, 0, 7.75, -3.0, Math.PI / 2);
    // supply/return + gas, isolation valves
    cyl(g, .08, 3.6, M.copper, -.6, 0, -3.3); cyl(g, .08, 3.6, M.copper, .6, 0, -3.3); cyl(g, .07, 3.6, M.pexb, -.95, 0, -3.3); cyl(g, .07, 3.6, M.pexr, .95, 0, -3.3);
    [-.6, .6].forEach(x => { bx(g, .3, .3, .3, M.brass, x, 2.2, -3.3); bx(g, .5, .08, .08, M.red, x, 2.5, -3.1); });
    cyl(g, .07, 3.6, M.black, .0, 0, -3.8); bx(g, .35, .35, .35, M.brass, 0, 2.0, -3.8);
    cyl(g, .05, 3.5, M.pvc, 1.3, 0, -3.4); cyl(g, .3, .5, M.white, 1.3, 0, -3.4); // condensate line + neutralizer
    // manifold with labeled valves (the repipe story)
    bx(g, 4.6, 1.3, .2, M.white, -2.4, 3.6, -3.85);
    cyl(g, .07, 4.4, M.pexr, -2.4, 4.3, -3.6, 0, Math.PI / 2); cyl(g, .07, 4.4, M.pexb, -2.4, 3.95, -3.6, 0, Math.PI / 2);
    for (let i = 0; i < 6; i++) { const x = -4.3 + i * .76; cyl(g, .05, 2.5, M.pexr, x, 1.8, -3.55); cyl(g, .05, 1.6, M.pexb, x + .25, 2.3, -3.6); bx(g, .12, .22, .22, M.pexb, x, 4.2, -3.55); bx(g, .12, .22, .22, M.pexr, x + .25, 3.85, -3.6); }
    // old tank being hauled out (dolly, cart) tells the story
    const t = cyl(g, .8, 3.9, M.grey, 3.3, .5, 1.6); t.rotation.z = .16; bx(g, 1.4, .12, 1.4, M.dark, 3.5, 0, 1.7); cyl(g, .28, .14, M.black, 2.9, 0, 2.3, Math.PI / 2); cyl(g, .28, .14, M.black, 4.1, 0, 2.3, Math.PI / 2);
    // slab drain, bucket, toolbox
    cyl(g, .25, .04, M.dark, -1.5, 0, 1.6); bx(g, 1.4, .7, .7, M.red, -3, 0, 1.4); bx(g, .25, .35, .7, M.black, -3, .7, 1.4);
    cyl(g, .32, .32, M.grey, -1.8, 0, 2.6, 0, 0, .3); for (let i = 0; i < 3; i++) cyl(g, .6, .18, M.white, 1.0, i * .2, 3.2);
    return { cam: [10, 7, 12], look: [-.3, 3.2, -.8] };
  },
  plans(g) {
    // kitchen table with a floor plan, sample tiles, 3D model, tape and mug
    bx(g, 16, .3, 8, M.wood, 0, 2.6, 0); [[-7, -3], [7, -3], [-7, 3], [7, 3]].forEach(([a, b]) => bx(g, .35, 2.6, .35, M.wood, a, 0, b));
    bx(g, 8.5, .03, 6, M.paper, -1.5, 2.9, 0);
    const line = (x, z, w, d) => bx(g, w, .01, d, M.ink, x, 2.93, z);
    line(-1.5, -2.8, 8, .08); line(-1.5, 2.8, 8, .08); line(-5.5, 0, .08, 5.6); line(2.5, 0, .08, 5.6); line(0, -1.2, 3, .08); line(-3.2, .6, .08, 3); line(1.2, 1.4, 2.2, 1.2); line(-4.2, -1.9, 2.2, .06); bx(g, 1.4, .02, .9, M.red, -4.2, 2.93, 1.9);
    // mini white model of the kitchen
    const Mg = new THREE.Group(); Mg.position.set(4.6, 2.9, -.6); Mg.scale.set(.32, .32, .32); Mg.rotation.y = -.5; g.add(Mg);
    bx(Mg, 10, .1, 8, M.white, 0, 0, 0); bx(Mg, 10, .4, 1.6, M.white, 0, .1, -3.2); bx(Mg, 1.6, .4, 5, M.white, -4.2, .1, 0); bx(Mg, 4, .4, 2, M.white, 1, .1, .8); bx(Mg, 10, 4, .1, M.white, 0, .1, -4); bx(Mg, .1, 4, 8, M.white, -5, .1, 0);
    // sample tiles + quartz
    bx(g, 1.2, .08, 1.2, M.tile, 5.2, 2.9, 2.4); bx(g, 1.2, .08, 1.2, M.tilef, 6.5, 2.9, 2.4); bx(g, 1.2, .1, 1.2, M.quartz, 5.8, 2.9, 1.1); bx(g, .8, .5, .5, M.wood, 6.8, 2.9, 1.0); bx(g, .8, .5, .5, M.island, 7.4, 2.9, .4);
    // tape measure, pencil, mug, laptop-ish tablet
    cyl(g, .5, .5, M.red, -3.6, 2.9, -2.1, 0, 0); bx(g, 1.4, .08, .25, M.steel, -2.7, 2.95, -2.1); cyl(g, .07, 2, M.brass, -5.2, 2.95, 2.0, 0, Math.PI / 2);
    cyl(g, .55, .9, M.ink, -6.3, 2.9, -2.2); tor(g, .35, .07, M.ink, -5.6, 3.35, -2.2, 0);
    bx(g, 2.6, .12, 1.8, M.black, 2.2, 2.9, 2.4); bx(g, 2.4, .02, 1.6, M.lamp, 2.2, 3.03, 2.4);
    plant(g, -7.2, -2.6, .7);
    return { cam: [4.5, 7.5, 9], look: [0, 2.7, 0] };
  }
};

/* ---------- per-card setup ---------- */
function makeCard(el, kind) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(kind === 'heater' ? '#E6E8EA' : '#EEF0F2'); scene.environment = env;
  const G = new THREE.Group(); scene.add(G);
  const spec = (SCENES[kind] || SCENES.kitchen)(G);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb9b1a4, .65));
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.3); sun.position.set(8, 14, 6); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -.0005; sun.shadow.normalBias = .03;
  sun.shadow.camera.left = sun.shadow.camera.bottom = -14; sun.shadow.camera.right = sun.shadow.camera.top = 14; scene.add(sun);
  const fill = new THREE.PointLight(0xffffff, .45, 60, 1.4); fill.position.set(-6, 6, 8); scene.add(fill);
  const camera = new THREE.PerspectiveCamera(40, 4 / 3, .1, 200); const v = (+el.dataset.var || 0); const cp = new THREE.Vector3(...spec.cam).multiplyScalar(1.14); const lk = new THREE.Vector3(...spec.look); cp.sub(lk).applyAxisAngle(new THREE.Vector3(0, 1, 0), [0, -.32, .32][v % 3] || 0).add(lk); camera.position.copy(cp);
  const canvas = document.createElement('canvas'); canvas.className = 's3d-c'; canvas.setAttribute('aria-hidden', 'true');
  el.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const controls = new OrbitControls(camera, canvas); controls.target.set(...spec.look); controls.enableDamping = true; controls.dampingFactor = .07; controls.enablePan = false; controls.enableZoom = false;
  controls.autoRotate = true; controls.autoRotateSpeed = .55; controls.maxPolarAngle = Math.PI / 2 - .05; controls.minPolarAngle = .5; controls.update();
  let hold; canvas.addEventListener('pointerdown', () => { controls.autoRotate = false; clearTimeout(hold); }); canvas.addEventListener('pointerup', () => { hold = setTimeout(() => controls.autoRotate = true, 2500); });
  const c = { el, kind, scene, camera, controls, canvas, ctx, visible: false, w: 0, h: 0 };
  cards.set(el, c); el.classList.add('s3d-on');
  return c;
}
function draw(c) {
  const r = c.el.getBoundingClientRect(); const w = Math.max(2, Math.round(r.width)), h = Math.max(2, Math.round(r.height)); if (!w || !h) return;
  const dpr = renderer.getPixelRatio();
  if (w !== c.w || h !== c.h) { c.w = w; c.h = h; c.canvas.width = w * dpr; c.canvas.height = h * dpr; c.camera.aspect = w / h; c.camera.updateProjectionMatrix(); }
  renderer.setSize(w, h, false); c.controls.update(); renderer.render(c.scene, c.camera);
  c.ctx.drawImage(renderer.domElement, 0, 0, w * dpr, h * dpr, 0, 0, c.canvas.width, c.canvas.height); if (!c.live) { c.live = true; c.el.classList.add('s3d-live'); }
}
function loop() { if (!running) return; let any = false; cards.forEach(c => { if (c.visible && document.body.contains(c.el)) { draw(c); any = true; } }); requestAnimationFrame(loop); }

export async function mount(root = document) {
  const els = [...root.querySelectorAll('.s3d:not(.s3d-on)')]; if (!els.length) return;
  if (!(await lib())) return;                           // no WebGL → photo fallback stays
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  mats();
  io = io || new IntersectionObserver(es => es.forEach(e => { const c = cards.get(e.target); if (c) c.visible = e.isIntersecting; }), { rootMargin: '80px' });
  els.forEach(el => { const kind = el.dataset.scene; if (!SCENES[kind]) return; const c = makeCard(el, kind); io.observe(el); draw(c); });
  if (!running) { running = true; requestAnimationFrame(loop); }
  // garbage-collect cards whose element left the DOM (hash-router re-renders)
  cards.forEach((c, el) => { if (!document.body.contains(el)) { io.unobserve(el); c.controls.dispose(); cards.delete(el); } });
}
export function snapshot(el) { const c = cards.get(el); if (!c) return null; draw(c); return c.canvas.toDataURL('image/png'); }
window.DNE3D = { mount, snapshot, scenes: Object.keys(SCENES) };
