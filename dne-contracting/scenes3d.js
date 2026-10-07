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
    // kitchen remodel, plumbing phase: sink wall opened to the studs, new PEX + drain relocated under the window, island drain trenched in the floor
    room(g, 12, 10, 8.5, M.floor, M.wall, { win: [0, 3.4, 2.6, 4.9] });
    const stud = new THREE.MeshStandardMaterial({ color: '#E3C99B', roughness: .85 });
    // open stud bay section on the back wall (drywall removed between x=-3.5..3.5)
    bx(g, 7, 7.6, .2, new THREE.MeshStandardMaterial({ color: '#CFC7BA', roughness: 1 }), 0, 0, -4.85); // exposed sheathing
    for (let i = 0; i <= 4; i++) bx(g, .3, 7.6, .35, stud, -3.5 + i * 1.75, 0, -4.75);
    bx(g, 7, .3, .35, stud, 0, 7.6, -4.75);
    // finished cabinets either side, sink base in but open (no doors yet), counters not on yet
    bx(g, 3.8, 2.9, 2, M.cab, -5.1 + 1, 0, -4); doors(g, 3.8, 2.6, 2, 2, .2); bx(g, 3.8, 2.9, 2, M.cab, 4.1, 0, -4);
    const sb = new THREE.Group(); sb.position.set(0, 0, -4); g.add(sb); bx(sb, 3.0, .3, 1.8, M.dark, 0, 0, 0); bx(sb, .1, 2.6, 1.8, M.cab, -1.45, .3, 0); bx(sb, .1, 2.6, 1.8, M.cab, 1.45, .3, 0); bx(sb, 3.0, .1, 1.8, M.cab, 0, 2.85, 0);
    bx(g, 2.4, .7, 1.4, M.steel, 0, 2.95, -4.1); faucet(g, 0, 3.65, -4.75); // sink sitting in place, not yet plumbed to counter
    // drain: new PVC up through floor, P-trap, into wall with vent up
    cyl(g, .16, 1.6, M.pvc, -.3, .3, -3.6); tor(g, .3, .15, M.pvc, -.3, 1.9, -3.6, 0); cyl(g, .16, .9, M.pvc, .3, 1.75, -4.1, Math.PI / 2); cyl(g, .16, 5.8, M.pvc, .3, 1.8, -4.6);
    cyl(g, .3, .5, M.pvc, .3, 2.0, -4.6); // sanitary tee
    // hot/cold PEX from the manifold side, stub-outs with shut-off valves
    cyl(g, .07, 7, M.pexb, -1.2, 1.3, -4.55, 0, Math.PI / 2); cyl(g, .07, 7, M.pexr, -1.2, 1.7, -4.55, 0, Math.PI / 2);
    [-.7, .9].forEach((x, i) => { cyl(g, .07, 1.2, i ? M.pexr : M.pexb, x, i ? 1.7 : 1.3, -4.55); bx(g, .25, .25, .25, M.brass, x, i ? 2.9 : 2.5, -4.55); cyl(g, .05, .5, M.steel, x, i ? 2.9 : 2.5, -4.3, Math.PI / 2); });
    // dishwasher drain + supply tee off the sink base
    bx(g, 2.0, 2.9, 1.9, M.steel, 3.2, 0, -4); cyl(g, .07, 1.6, M.pexr, 1.9, 1.7, -4.55, 0, Math.PI / 2); cyl(g, .12, 1.6, M.pvc, 1.9, 2.4, -4.5, 0, Math.PI / 2);
    // island going in: base set, floor trenched for its drain line (open channel with PVC)
    bx(g, 6, 2.9, 2.6, M.island, 1.2, 0, 1.2); bx(g, 6.4, .1, 3.0, new THREE.MeshStandardMaterial({ color: '#D8B98A', roughness: .9 }), 1.2, 2.9, 1.2); // plywood sub-top
    bx(g, .9, .12, 4.6, M.dirt, 1.6, -.11, -1.1); cyl(g, .18, 4.6, M.pvc, 1.6, -.1, -1.1, Math.PI / 2); cyl(g, .18, .8, M.pvc, 1.6, .25, 1.0); // trench + line to island sink
    cyl(g, .07, 4.6, M.pexb, 1.2, -.08, -1.1, Math.PI / 2); cyl(g, .07, 4.6, M.pexr, 2.0, -.08, -1.1, Math.PI / 2);
    // tools: level on island, PEX crimper, coil of PEX, drill, bucket, drop cloth
    bx(g, 2.6, .12, .25, M.red, 0.4, 3.0, 1.3); bx(g, .9, .12, .25, M.black, 2.2, 3.0, 1.0);
    cyl(g, .55, .9, M.pexr, 4.8, 0, 3.4, 0, 0, .55); cyl(g, .3, .9, M.white, 4.8, .9, 3.4, 0, 0, .3);
    bx(g, 1.0, .5, .3, M.black, -2.4, 3.0, 1.2); cyl(g, .32, .32, M.grey, -3.8, 0, 3.0, 0, 0, .3);
    bx(g, 5, .02, 4, new THREE.MeshStandardMaterial({ color: '#E8E3D6', roughness: 1 }), -2.5, 0, 2.5);
    pendant(g, -.4, 8.4, 1.2); pendant(g, 1.2, 8.4, 1.2); pendant(g, 2.8, 8.4, 1.2);
    return { cam: [11, 8.5, 13], look: [.2, 2.6, -1.2] };
  },
  bathroom(g) {
    // bathroom remodel, plumbing phase: shower at rough-in (valve set, drain in, one wall backer-boarded, one wall open), vanity stub-outs, toilet flange
    room(g, 10, 9, 8.5, M.tilef, M.wall, { win: [-2.6, 1.8, 1.4, 6.2] });
    const stud = new THREE.MeshStandardMaterial({ color: '#E3C99B', roughness: .85 }); const cbu = new THREE.MeshStandardMaterial({ color: '#B9BDB5', roughness: .95 });
    const sx = 2.9;
    // back wall of shower: open studs with valve and riser
    for (let i = 0; i <= 3; i++) bx(g, .3, 7.4, .35, stud, sx - 2.1 + i * 1.4, 0, -4.4); bx(g, 4.2, .3, .35, stud, sx, 7.4, -4.4);
    bx(g, 1.2, 1.1, .6, M.brass, sx, 3.9, -4.3); cyl(g, .12, .6, M.brass, sx, 4.4, -4.0, Math.PI / 2); // mixing valve w/ plaster guard
    cyl(g, .08, 2.5, M.copper, sx, 5.0, -4.3); cyl(g, .08, .6, M.copper, sx, 7.4, -4.05, Math.PI / 2); cyl(g, .07, 3.9, M.pexb, sx - .5, 0, -4.3); cyl(g, .07, 3.9, M.pexr, sx + .5, 0, -4.3);
    // side wall: cement board up, ready for tile
    bx(g, .1, 7.4, 4.2, cbu, sx + 2.1, 0, -2.4);
    // shower pan: mortar bed with drain + trap below (floor cut away to show)
    bx(g, 4.2, .25, 4.2, new THREE.MeshStandardMaterial({ color: '#9A9A92', roughness: 1 }), sx, -.1, -2.4); cyl(g, .25, .05, M.pvc, sx, .15, -2.4); tor(g, .3, .05, M.pvc, sx, .18, -2.4);
    // open floor section: subfloor cut, trap and drain line running to stack
    bx(g, 2.2, .12, 5, M.dirt, -.2, -.12, -1.9); cyl(g, .16, 3.4, M.pvc, -.2, -.08, -2.4, Math.PI / 2); tor(g, .32, .16, M.pvc, 1.4, .0, -2.4, 0); cyl(g, .3, 3.2, M.pvc, -.2, -.05, -2.6);
    cyl(g, .32, .35, M.pvc, -4.0, 0, .45); tor(g, .5, .07, M.pvc, -4.0, .36, .45); cyl(g, .2, 2.6, M.pvc, -2.2, -.08, .45, 0, Math.PI / 2); // toilet flange + line
    // vanity wall: drywall on, hot/cold stub-outs + drain stub, vanity waiting in its box
    bx(g, .25, .25, .25, M.brass, -3.5, 2.3, -4.35); bx(g, .25, .25, .25, M.brass, -2.9, 2.3, -4.35); cyl(g, .05, .5, M.steel, -3.5, 2.3, -4.1, Math.PI / 2); cyl(g, .05, .5, M.steel, -2.9, 2.3, -4.1, Math.PI / 2);
    cyl(g, .14, .5, M.pvc, -3.2, 1.6, -4.1, Math.PI / 2); cyl(g, .25, .04, M.pvc, -3.2, 1.6, -3.85, Math.PI / 2);
    bx(g, 1.2, .25, .25, M.brass, -.8, 2.3, -4.35); // second sink stubs
    bx(g, 3.2, 2.9, 1.6, new THREE.MeshStandardMaterial({ color: '#C9B58F', roughness: 1 }), -2.4, 0, -1.2); // vanity in cardboard
    // tools & materials: tile stacks, grout bucket, level, torch kit
    for (let i = 0; i < 5; i++) bx(g, 1.4, .06, 2.4, M.tile, 1.0, i * .07, 2.8); cyl(g, .4, .9, M.white, -1.0, 0, 3.0); bx(g, 2.4, .12, .25, M.red, -3.5, 0, 3.2);
    bx(g, .9, .5, .5, M.red, 3.8, 0, 1.8); cyl(g, .12, .9, M.steel, 3.8, .5, 1.8);
    return { cam: [12, 8, 13], look: [-.2, 2.6, -1.0] };
  },
  basement(g) {
    // basement remodel, plumbing phase: slab cut for a sealed ejector pit because a bathroom is going in; drain lines trenched, bathroom walls framed with PEX, laundry hookup box, sump
    room(g, 14, 11, 7.6, M.conc, M.wall2, { win: [4, 2.6, 1.1, 6.2] });
    const stud = new THREE.MeshStandardMaterial({ color: '#E3C99B', roughness: .85 });
    // framed bathroom walls (no drywall yet)
    const frame = (x, z, len, ry) => { const F = new THREE.Group(); F.position.set(x, 0, z); F.rotation.y = ry; g.add(F); bx(F, len, .3, .35, stud, 0, 0, 0); bx(F, len, .3, .35, stud, 0, 7.3, 0); for (let i = 0; i <= Math.round(len / 1.5); i++) bx(F, .3, 7.0, .35, stud, -len / 2 + i * 1.5, .3, 0); };
    frame(-4.7, -1.2, 4.6, 0); frame(-2.55, -3.35, 4.3, Math.PI / 2);
    // ejector pit: cut slab, pit basin, sealed lid, discharge + vent
    bx(g, 3.2, .14, 3.2, M.dirt, -4.6, -.13, -3.4); cyl(g, .95, 1.6, M.dark, -4.6, -1.7, -3.4); cyl(g, 1.0, .1, M.grey, -4.6, -.1, -3.4);
    cyl(g, .12, 7.5, M.pvc, -4.2, 0, -3.4); cyl(g, .18, 7.5, M.pvc, -5.0, 0, -3.4); bx(g, .4, .4, .4, M.brass, -4.2, 2.6, -3.4); // discharge w/ check valve, vent
    // drain trench from bathroom (toilet + shower) into the pit
    bx(g, .8, .14, 4.0, M.dirt, -3.6, -.13, -1.2); cyl(g, .18, 4.2, M.pvc, -3.6, -.1, -1.4, Math.PI / 2); cyl(g, .32, .35, M.pvc, -3.6, 0, .6); tor(g, .5, .07, M.pvc, -3.6, .36, .6);
    bx(g, 3.0, .14, .8, M.dirt, -5.8, -.13, -5.0); cyl(g, .18, 2.6, M.pvc, -5.8, -.1, -5.0, 0, Math.PI / 2); cyl(g, .25, .05, M.pvc, -6.6, .1, -5.0);
    // PEX runs along the joists overhead and down the framed wall to vanity + shower
    cyl(g, .07, 9, M.pexb, -2.0, 7.2, -2.6, 0, Math.PI / 2); cyl(g, .07, 9, M.pexr, -2.0, 7.0, -2.6, 0, Math.PI / 2);
    cyl(g, .07, 4.8, M.pexb, -3.9, 2.4, -1.35); cyl(g, .07, 4.8, M.pexr, -3.3, 2.4, -1.35); bx(g, .25, .25, .25, M.brass, -3.9, 2.3, -1.3); bx(g, .25, .25, .25, M.brass, -3.3, 2.3, -1.3);
    // laundry side: recessed washer box with valves, standpipe, dryer vent
    bx(g, 1.4, 1.2, .3, M.white, 5.5, 3.4, -5.3); cyl(g, .12, .4, M.pexb, 5.2, 3.9, -5.1, Math.PI / 2); cyl(g, .12, .4, M.pexr, 5.8, 3.9, -5.1, Math.PI / 2); cyl(g, .14, 3.2, M.pvc, 5.5, 0, -5.15);
    cyl(g, .22, 4.0, M.steel, 7.0, 0, -5.2); bx(g, .5, .5, .3, M.grey, 7.0, 4.0, -5.2);
    bx(g, 2.6, 3, 2.4, M.white, 4.4, 0, -2.4); tor(g, .65, .08, M.steel, 4.4, 1.5, -1.18, 0); cyl(g, .6, .05, M.dark, 4.4, 1.5, -1.16, Math.PI / 2); // washer waiting on the floor
    // sump in the corner, water heater, main stack
    cyl(g, .7, .12, M.dark, 5.8, 0, 3.6); cyl(g, .72, .05, M.grey, 5.8, .12, 3.6); cyl(g, .1, 7.5, M.pvc, 6.1, 0, 3.6);
    cyl(g, 1.0, 5, M.grey, -5.8, 0, 3.4); cyl(g, .08, 2.5, M.copper, -6.2, 5, 3.4); cyl(g, .08, 2.5, M.copper, -5.4, 5, 3.4);
    cyl(g, .3, 7.6, M.pvc, 1.5, 0, -5.2);
    // tools: concrete saw, wheelbarrow of slab pieces, shop vac, toolbox
    bx(g, 1.8, .9, .8, M.red, 0, 0, 1.6); cyl(g, .55, .08, M.black, .9, .4, 1.6, 0, Math.PI / 2); bx(g, 2.2, .9, 1.4, M.dark, 2.6, .5, 3.2); for (let i = 0; i < 5; i++) bx(g, .6, .3, .5, M.grey, 2.2 + (i % 3) * .5, 1.4, 2.9 + (i % 2) * .5);
    cyl(g, .5, 1.3, M.grey, -1.6, 0, 3.4); bx(g, 1.4, .7, .7, M.black, 0.4, 0, -1.2);
    for (let i = 0; i < 4; i++) { const r = cyl(g, .3, .06, M.lamp, -3 + i * 3, 7.56, -1 + (i % 2) * 3); r.receiveShadow = false; }
    return { cam: [13, 9, 15], look: [-.5, 2.4, -1.0] };
  },
  roughin(g) {
    // bathroom remodel at rough-in: open studs, new PEX + drain runs, shower valve set, flange in, and the plan being drawn up
    bx(g, 12, .1, 10, M.white, 0, -.1, 0).material = M.grey;             // subfloor (plywood tone)
    const ply = new THREE.MeshStandardMaterial({ color: '#D8B98A', roughness: .9 }); g.children[g.children.length - 1].material = ply;
    const stud = new THREE.MeshStandardMaterial({ color: '#E3C99B', roughness: .85 });
    // back wall studs + plates
    bx(g, 12, .3, .35, stud, 0, 0, -4.8); bx(g, 12, .3, .35, stud, 0, 8, -4.8);
    for (let i = 0; i <= 8; i++) bx(g, .3, 7.7, .35, stud, -6 + i * 1.5, .3, -4.8);
    // left wall studs
    bx(g, .35, .3, 10, stud, -5.8, 0, 0); bx(g, .35, .3, 10, stud, -5.8, 8, 0);
    for (let i = 1; i <= 6; i++) bx(g, .35, 7.7, .3, stud, -5.8, .3, -5 + i * 1.5);
    // drain & vent stack (white PVC) through back wall, with sanitary tee and shower trap arm
    cyl(g, .3, 8.3, M.pvc, -4.5, 0, -4.8); cyl(g, .32, .5, M.pvc, -4.5, 2.6, -4.8); cyl(g, .18, 3.2, M.pvc, -2.9, 2.75, -4.8, 0, Math.PI / 2);
    cyl(g, .18, 2.2, M.pvc, -1.3, .25, -3.7, Math.PI / 2); cyl(g, .3, .12, M.pvc, -1.3, 0, -2.6); tor(g, .32, .05, M.pvc, -1.3, .13, -2.6); // shower drain
    cyl(g, .32, .35, M.pvc, 2.4, 0, -1.4); tor(g, .5, .07, M.pvc, 2.4, .36, -1.4); // toilet flange
    cyl(g, .2, 3.2, M.pvc, 2.4, -.05, -3.0, Math.PI / 2);
    // PEX hot/cold runs drilled through the studs to the shower valve and vanity
    cyl(g, .07, 10.5, M.pexb, -.5, 3.6, -4.6, 0, Math.PI / 2); cyl(g, .07, 10.5, M.pexr, -.5, 4.0, -4.6, 0, Math.PI / 2);
    cyl(g, .07, 2.6, M.pexb, -1.6, 3.6, -4.6); cyl(g, .07, 2.2, M.pexr, -1.0, 4.0, -4.6);
    bx(g, 1.2, 1.1, .6, M.brass, -1.3, 5.4, -4.6); cyl(g, .12, .6, M.brass, -1.3, 5.9, -4.3, Math.PI / 2); // shower mixing valve
    cyl(g, .08, 2.2, M.copper, -1.3, 6.5, -4.6); cyl(g, .08, .5, M.copper, -1.3, 8.6, -4.35, Math.PI / 2); // riser to shower head
    [1.9, 2.5].forEach((x, i) => { cyl(g, .07, 2.4, i ? M.pexr : M.pexb, x, 1.4, -4.6); bx(g, .25, .25, .25, M.brass, x, 1.3, -4.6); }); // vanity stub-outs
    // sawhorse table with the blueprint being drawn up
    const saw = (x) => { bx(g, .25, 2.6, 2.6, stud, x, 0, 2.6); bx(g, .25, .25, 3, stud, x, 2.6, 2.6); };
    saw(-3.2); saw(1.0); bx(g, 7, .12, 3.2, ply, -1.1, 2.85, 2.6); bx(g, 5.2, .03, 2.4, M.paper, -1.1, 2.97, 2.6);
    const line = (x, z, w, d) => bx(g, w, .01, d, M.ink, x, 3.0, z);
    line(-1.1, 1.6, 4.6, .06); line(-1.1, 3.6, 4.6, .06); line(-3.4, 2.6, .06, 2.0); line(1.2, 2.6, .06, 2.0); line(-2.4, 2.1, 1.3, .9); line(0.3, 3.1, .7, .06); line(.9, 2.2, .06, .9);
    bx(g, 1.0, .02, .7, M.pexb, .3, 3.0, 2.0); bx(g, .5, .02, .5, M.pexr, -2.4, 3.0, 3.2); // plumbing marked in color on the plan
    cyl(g, .06, 1.6, M.brass, -2.0, 3.02, 1.9, 0, Math.PI / 2 - .4); bx(g, 1.6, .03, .25, M.steel, .2, 3.02, 3.35); // pencil + scale ruler
    cyl(g, .5, .5, M.red, 2.0, 2.97, 1.8); cyl(g, .5, .6, M.ink, -3.8, 2.97, 3.3); // tape measure, mug
    bx(g, 1.6, .9, 1.0, M.red, 3.6, 0, 3.4); bx(g, .3, .4, 1.0, M.black, 3.6, .9, 3.4); // toolbox
    cyl(g, .55, .9, M.pexb, 3.9, 0, -1.6, 0, 0, .55); cyl(g, .3, .9, M.white, 3.9, .9, -1.6, 0, 0, .3); // coil of PEX
    for (let i = 0; i < 4; i++) bx(g, 1.4, .06, 3, M.tile, 4.6, i * .07, 1.0); // stacked tile
    return { cam: [12, 8.5, 13], look: [-.6, 3.0, -.4] };
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
  const camera = new THREE.PerspectiveCamera(40, 4 / 3, .1, 200); const v = (+el.dataset.var || 0); const cp = new THREE.Vector3(...spec.cam).multiplyScalar(1.04); const lk = new THREE.Vector3(...spec.look); cp.sub(lk).applyAxisAngle(new THREE.Vector3(0, 1, 0), [0, -.32, .32][v % 3] || 0).add(lk); camera.position.copy(cp);
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
