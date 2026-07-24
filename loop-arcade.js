/*! Loop Arcade — shared game engine (Loop Flyer + Chair Hopper)
 *  One engine, loaded by /arcade/ (local scores) and the loyalty card (coin rewards).
 *  Design goals: fixed-timestep sim (framerate-independent feel), interpolated
 *  rendering, pooled particles (no GC hitches), screen shake + hit-stop, parallax,
 *  squash/stretch, coin pickups, near-miss bonuses, pause + tab-visibility handling,
 *  full keyboard/touch/mouse input, reduced-motion + mute accessibility, and clean
 *  teardown so opening/closing repeatedly never leaks listeners, RAF loops, or audio.
 *
 *  Public API:
 *    LoopArcade.play({
 *      mode:   'flyer' | 'hopper',
 *      best:   Number,                       // best score to show on the start card
 *      accent, accent2:  '#rrggbb' (optional theme; defaults to Loop blue/cyan)
 *      onOver: function(mode, score) -> (result | Promise<result>)
 *              // result: { best, newBest, line1, line2 }  (all optional)
 *    })
 */
(function () {
  'use strict';
  if (window.LoopArcade) return;

  var RM = false;
  try { RM = window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches; } catch (e) {}
  var SND = true;
  try { SND = localStorage.getItem('loop_snd') !== '0'; } catch (e) {}

  var STEP = 1000 / 60;      // fixed simulation step (ms)
  var MAX_FRAME = 250;       // clamp huge dt (tab was backgrounded) to avoid tunnelling

  // ---- tiny math helpers -------------------------------------------------
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function ri(a, b) { return (a + Math.random() * (b - a + 1)) | 0; }
  function roundRect(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  // ---- audio (procedural SFX, no assets) ---------------------------------
  var Audio = (function () {
    var ctx = null, master = null;
    function ensure() {
      if (!SND) return null;
      try {
        if (!ctx) {
          ctx = new (window.AudioContext || window.webkitAudioContext)();
          master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
        }
        if (ctx.state === 'suspended') ctx.resume();
      } catch (e) { ctx = null; }
      return ctx;
    }
    function tone(freq, dur, type, vol, slideTo) {
      if (!SND) return; var c = ensure(); if (!c) return;
      try {
        var o = c.createOscillator(), g = c.createGain();
        o.type = type || 'square'; o.frequency.setValueAtTime(freq, c.currentTime);
        if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), c.currentTime + dur);
        g.gain.setValueAtTime(0.0001, c.currentTime);
        g.gain.exponentialRampToValueAtTime(vol || 0.28, c.currentTime + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
        o.connect(g); g.connect(master); o.start(); o.stop(c.currentTime + dur + 0.02);
      } catch (e) {}
    }
    function noise(dur, vol) {
      if (!SND) return; var c = ensure(); if (!c) return;
      try {
        var n = c.sampleRate * dur, buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
        for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
        var s = c.createBufferSource(); s.buffer = buf;
        var g = c.createGain(); g.gain.value = vol || 0.25;
        var f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1200;
        s.connect(f); f.connect(g); g.connect(master); s.start();
      } catch (e) {}
    }
    // ---- background music: a light looping chiptune (bass + arp) ----------
    var musOn = false, musT = null, musStep = 0, musRate = 236;
    var BASS = [0, 0, 7, 0, 5, 0, 7, 3, 0, 0, 10, 7, 5, 3, 7, 0];
    var ARP = [12, 16, 19, 16, 17, 19, 24, 19, 15, 19, 22, 19, 17, 15, 12, 7];
    function fr(n) { return 130.81 * Math.pow(2, n / 12); }
    function mnote(f, d, ty, v) {
      var c = ensure(); if (!c) return;
      try {
        var o = c.createOscillator(), g = c.createGain();
        o.type = ty; o.frequency.value = f; g.gain.setValueAtTime(v, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + d);
        o.connect(g); g.connect(master); o.start(); o.stop(c.currentTime + d + 0.02);
      } catch (e) {}
    }
    function mtick() {
      if (!musOn) return;
      if (SND && ensure()) {
        var b = BASS[musStep % BASS.length], l = ARP[musStep % ARP.length];
        mnote(fr(b - 12), 0.24, 'triangle', 0.05);
        mnote(fr(l), 0.14, 'square', 0.022);
        if (musStep % 4 === 2) mnote(fr(l + 7), 0.10, 'square', 0.016);
      }
      musStep++; musT = setTimeout(mtick, musRate);
    }
    return {
      flap: function () { tone(660, 0.09, 'square', 0.22, 380); },
      score: function () { tone(880, 0.08, 'triangle', 0.26, 1180); },
      coin: function () { tone(1180, 0.06, 'square', 0.22); setTimeout(function () { tone(1560, 0.08, 'square', 0.2); }, 45); },
      near: function () { tone(1500, 0.05, 'sine', 0.14); },
      hop: function () { tone(720, 0.06, 'triangle', 0.2, 900); },
      land: function () { tone(300, 0.05, 'sine', 0.14); },
      crash: function () { noise(0.4, 0.34); tone(150, 0.4, 'sawtooth', 0.28, 60); },
      ui: function () { tone(560, 0.05, 'sine', 0.16); },
      levelup: function () { [0, 4, 7, 12].forEach(function (n, i) { setTimeout(function () { tone(fr(12 + n), 0.16, 'triangle', 0.24); }, i * 70); }); },
      music: {
        start: function (rate) { if (musOn) { if (rate) musRate = rate; return; } musOn = true; musStep = 0; musRate = rate || 236; mtick(); },
        setRate: function (r) { musRate = r; },
        stop: function () { musOn = false; clearTimeout(musT); }
      },
      resume: ensure
    };
  })();

  function haptic(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }

  // ---- one-time DOM + CSS injection --------------------------------------
  var dom = null;
  function injectCSS() {
    if (document.getElementById('la-style')) return;
    var css =
      '.la{position:fixed;inset:0;z-index:2147483000;display:none;flex-direction:column;align-items:center;' +
      'background:linear-gradient(180deg,#070a16,#04050a);font-family:Inter,system-ui,"Segoe UI",Arial,sans-serif;color:#f2f4ff;-webkit-tap-highlight-color:transparent}' +
      '.la.on{display:flex}' +
      '.la-top{width:100%;max-width:520px;display:flex;justify-content:space-between;align-items:center;padding:12px 16px;position:relative;z-index:5}' +
      '.la-title{font-weight:900;font-size:15px;letter-spacing:.02em}' +
      '.la-btns{display:flex;gap:8px}' +
      '.la-ic{background:rgba(255,255,255,.09);border:1px solid rgba(122,162,255,.3);color:#f2f4ff;border-radius:999px;width:38px;height:38px;font-size:16px;cursor:pointer;display:grid;place-items:center;transition:transform .1s,background .12s}' +
      '.la-ic:active{transform:scale(.9)}' +
      '.la-hud{width:100%;max-width:520px;display:flex;justify-content:space-between;align-items:center;padding:0 20px 8px}' +
      '.la-score{font-weight:900;font-size:30px;letter-spacing:.01em;text-shadow:0 2px 12px rgba(122,162,255,.4)}' +
      '.la-right{font-size:15px;font-weight:800;color:#ffcf5a;display:flex;gap:12px;align-items:center}' +
      '.la-combo{font-size:13px;font-weight:900;color:#5ad0f0;opacity:0;transition:opacity .2s}' +
      '.la-combo.show{opacity:1}' +
      '#la-level{font-size:13px;font-weight:900;color:#b98bff}' +
      '.la-skins{display:flex;gap:7px;flex-wrap:wrap;justify-content:center;margin:12px 0 6px}' +
      '.la-skin{position:relative;width:44px;height:44px;border-radius:12px;border:1px solid rgba(122,162,255,.3);background:rgba(122,162,255,.08);display:grid;place-items:center;font-size:20px;cursor:pointer;transition:transform .1s}' +
      '.la-skin.sel{border-color:#5ad0f0;box-shadow:0 0 14px rgba(90,208,240,.5)}' +
      '.la-skin.lock{opacity:.5;cursor:default}' +
      '.la-skin .lk{position:absolute;bottom:-8px;left:50%;transform:translateX(-50%);font-size:8px;font-weight:800;white-space:nowrap;color:#9aa3c2;background:#05060d;padding:1px 5px;border-radius:6px;border:1px solid rgba(122,162,255,.25)}' +
      '.la-stage{position:relative;border-radius:18px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.6),0 0 44px rgba(122,162,255,.18)}' +
      '.la-cv{display:block;touch-action:none;background:#05060d}' +
      '.la-ctrls{display:flex;gap:12px;justify-content:center;margin-top:14px}' +
      '.la-ctrls.hide{display:none}' +
      '.la-ctrls button{width:70px;height:56px;border-radius:16px;border:1px solid rgba(122,162,255,.3);background:rgba(122,162,255,.12);color:#f2f4ff;font-size:24px;font-weight:900;cursor:pointer;transition:transform .08s,background .1s}' +
      '.la-ctrls button:active{background:rgba(122,162,255,.34);transform:scale(.92)}' +
      '.la-ctrls button.pulse{animation:la-pulse 1s ease-in-out infinite}' +
      '@keyframes la-pulse{0%,100%{box-shadow:0 0 0 0 rgba(90,208,240,.0)}50%{box-shadow:0 0 0 6px rgba(90,208,240,.35)}}' +
      '.la-ov{position:absolute;inset:0;display:grid;place-items:center;background:rgba(4,6,12,.72);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);z-index:6;padding:16px}' +
      '.la-ov.hide{display:none}' +
      '.la-card{background:linear-gradient(150deg,rgba(255,255,255,.08),rgba(255,255,255,.02));border:1px solid rgba(122,162,255,.3);border-radius:22px;padding:26px;text-align:center;max-width:340px;width:100%;animation:la-pop .25s cubic-bezier(.2,1.1,.3,1)}' +
      '@keyframes la-pop{from{transform:scale(.92);opacity:0}to{transform:scale(1);opacity:1}}' +
      '.la-card h2{margin:6px 0;font-size:26px}.la-card p{margin:6px 0;color:#9aa3c2;font-size:14px}' +
      '.la-em{font-size:46px;line-height:1}' +
      '.la-big{font-weight:900;color:#43f0b0;font-size:16px;margin:8px 0}' +
      '.la-go{width:100%;margin-top:12px;border:0;border-radius:999px;padding:15px;font:inherit;font-weight:900;font-size:15px;cursor:pointer;' +
      'background:linear-gradient(135deg,#5ad0f0,#7aa2ff);color:#04050a;box-shadow:0 10px 26px rgba(122,162,255,.4)}' +
      '.la-go.ghost{background:rgba(122,162,255,.08);border:1px solid rgba(122,162,255,.3);color:#f2f4ff;box-shadow:none;margin-top:8px}' +
      '.la-go:active{transform:scale(.98)}';
    var s = document.createElement('style'); s.id = 'la-style'; s.textContent = css; document.head.appendChild(s);
  }

  function buildDOM() {
    if (dom) return dom;
    injectCSS();
    var root = document.createElement('div'); root.className = 'la'; root.setAttribute('aria-hidden', 'true');
    root.innerHTML =
      '<div class="la-top"><div class="la-title" id="la-title">Loop Arcade</div>' +
      '<div class="la-btns"><button class="la-ic" id="la-sound" aria-label="Sound">🔊</button>' +
      '<button class="la-ic" id="la-pause" aria-label="Pause">❚❚</button>' +
      '<button class="la-ic" id="la-close" aria-label="Close">✕</button></div></div>' +
      '<div class="la-hud"><span class="la-score" id="la-score">0</span>' +
      '<span class="la-right"><span class="la-combo" id="la-combo"></span><span id="la-level">Lv 1</span><span id="la-best2">★ 0</span></span></div>' +
      '<div class="la-stage"><canvas class="la-cv" id="la-cv"></canvas>' +
      '<div class="la-ov" id="la-start"><div class="la-card">' +
      '<div class="la-em" id="la-icon">🐦</div><h2 id="la-name">Loop Flyer</h2>' +
      '<p id="la-how"></p><p>Best: <b id="la-best">0</b></p>' +
      '<div class="la-skins" id="la-skins"></div>' +
      '<button class="la-go" id="la-play">▶ Play</button></div></div>' +
      '<div class="la-ov hide" id="la-pausescr"><div class="la-card"><div class="la-em">❚❚</div><h2>Paused</h2>' +
      '<button class="la-go" id="la-resume">▶ Resume</button><button class="la-go ghost" id="la-quit">Quit</button></div></div>' +
      '<div class="la-ov hide" id="la-over"><div class="la-card"><div class="la-em">🏁</div>' +
      '<h2>Score <span id="la-final">0</span></h2><p class="la-big" id="la-l1"></p><p id="la-l2"></p>' +
      '<button class="la-go" id="la-again">▶ Play again</button>' +
      '<button class="la-go ghost" id="la-back">Back</button></div></div>' +
      '<div class="la-ctrls hide" id="la-ctrls"><button data-dir="left" aria-label="Left">◀</button>' +
      '<button data-dir="up" aria-label="Forward">▲</button><button data-dir="right" aria-label="Right">▶</button></div></div>';
    // NB: controls live outside the stage visually but we keep a ref via id
    document.body.appendChild(root);

    dom = {
      root: root, title: g('la-title'), sound: g('la-sound'), pause: g('la-pause'), close: g('la-close'),
      score: g('la-score'), best2: g('la-best2'), combo: g('la-combo'), level: g('la-level'),
      stage: root.querySelector('.la-stage'), cv: g('la-cv'),
      start: g('la-start'), icon: g('la-icon'), name: g('la-name'), how: g('la-how'), best: g('la-best'), play: g('la-play'), skins: g('la-skins'),
      pausescr: g('la-pausescr'), resume: g('la-resume'), quit: g('la-quit'),
      over: g('la-over'), final: g('la-final'), l1: g('la-l1'), l2: g('la-l2'), again: g('la-again'), back: g('la-back'),
      ctrls: g('la-ctrls')
    };
    function g(id) { return root.querySelector('#' + id); }

    // move controls out of stage so they sit below the canvas
    root.appendChild(dom.ctrls);

    // ---- bind listeners ONCE ----
    dom.sound.onclick = function () {
      SND = !SND; try { localStorage.setItem('loop_snd', SND ? '1' : '0'); } catch (e) {}
      dom.sound.textContent = SND ? '🔊' : '🔇'; if (SND) { Audio.resume(); Audio.ui(); if (E.running && !E.paused) Audio.music.start(); } else { Audio.music.stop(); }
    };
    dom.close.onclick = close;
    dom.quit.onclick = close;
    dom.back.onclick = close;
    dom.pause.onclick = function () { E.paused ? resume() : pause(); };
    dom.resume.onclick = resume;
    dom.play.onclick = start;
    dom.again.onclick = start;

    // canvas taps
    dom.cv.addEventListener('pointerdown', function (e) {
      e.preventDefault(); Audio.resume();
      if (!E.running || E.paused) return;
      if (E.mode === 'flyer') { E.game.tap(); return; }
      var r = dom.cv.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      if (y < 0.55) E.game.dir('up'); else if (x < 0.5) E.game.dir('left'); else E.game.dir('right');
    }, { passive: false });

    // on-screen controls
    Array.prototype.forEach.call(dom.ctrls.querySelectorAll('button'), function (b) {
      b.addEventListener('pointerdown', function (e) {
        e.preventDefault(); Audio.resume();
        if (E.running && !E.paused && E.game) E.game.dir(b.getAttribute('data-dir'));
      }, { passive: false });
    });

    // keyboard
    document.addEventListener('keydown', function (e) {
      if (!dom.root.classList.contains('on')) return;
      if (e.code === 'Escape') { E.paused ? resume() : pause(); return; }
      if (!E.running) { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); start(); } return; }
      if (E.paused) return;
      if (E.mode === 'flyer') { if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); E.game.tap(); } }
      else {
        if (e.code === 'ArrowUp') { e.preventDefault(); E.game.dir('up'); }
        else if (e.code === 'ArrowLeft') E.game.dir('left');
        else if (e.code === 'ArrowRight') E.game.dir('right');
      }
    });

    // auto-pause when tab hidden (prevents dt spike + saves battery)
    document.addEventListener('visibilitychange', function () { if (document.hidden && E.running && !E.paused) pause(); });
    window.addEventListener('resize', function () { if (dom.root.classList.contains('on')) resize(); });

    return dom;
  }

  // ---- engine state ------------------------------------------------------
  var E = {
    mode: null, cfg: null, running: false, paused: false, over: false,
    raf: 0, last: 0, acc: 0, W: 0, H: 0, dpr: 1, ctx: null,
    score: 0, shownScore: 0, best: 0, game: null,
    shake: 0, hitstop: 0, flash: 0, alpha: 0,
    parts: [], floats: [], accent: '#7aa2ff', accent2: '#5ad0f0',
    clock: 0, combo: 0, comboAt: 0, lastSc: 0, skyGrad: null, skyH: 0, moonGrad: null, level: 1, skin: null
  };

  // ---- particle pool -----------------------------------------------------
  var POOL = []; for (var i = 0; i < 220; i++) POOL.push({ live: false });
  function spawn(x, y, vx, vy, life, size, color, kind, grav) {
    if (RM) return;
    for (var i = 0; i < POOL.length; i++) {
      var p = POOL[i];
      if (!p.live) {
        p.live = true; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.max = life;
        p.size = size; p.color = color; p.kind = kind || 'spark'; p.grav = grav == null ? 0.35 : grav; p.rot = rnd(0, 6.28); p.vr = rnd(-0.3, 0.3);
        return p;
      }
    }
  }
  function burst(x, y, n, color, opt) {
    opt = opt || {};
    for (var i = 0; i < n; i++) {
      var a = rnd(0, 6.283), sp = rnd(opt.min || 1.5, opt.max || 5);
      spawn(x, y, Math.cos(a) * sp, Math.sin(a) * sp - (opt.up || 0), ri(24, 46), rnd(opt.sz0 || 2, opt.sz1 || 5), color, opt.kind, opt.grav);
    }
  }
  function floatText(x, y, txt, color) {
    if (RM) { return; }
    for (var i = 0; i < E.floats.length; i++) if (!E.floats[i].live) { var f = E.floats[i]; f.live = true; f.x = x; f.y = y; f.t = txt; f.c = color || '#fff'; f.life = 46; f.max = 46; return; }
    E.floats.push({ live: true, x: x, y: y, t: txt, c: color || '#fff', life: 46, max: 46 });
  }
  function updateParts() {
    for (var i = 0; i < POOL.length; i++) {
      var p = POOL[i]; if (!p.live) continue;
      p.x += p.vx; p.y += p.vy; p.vy += p.grav; p.vx *= 0.99; p.rot += p.vr; p.life--;
      if (p.life <= 0) p.live = false;
    }
    for (var j = 0; j < E.floats.length; j++) { var f = E.floats[j]; if (!f.live) continue; f.y -= 0.9; f.life--; if (f.life <= 0) f.live = false; }
  }
  function drawParts(c) {
    for (var i = 0; i < POOL.length; i++) {
      var p = POOL[i]; if (!p.live) continue;
      var a = clamp(p.life / p.max, 0, 1);
      c.globalAlpha = a;
      if (p.kind === 'coin') {
        c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillStyle = '#ffcf5a';
        c.beginPath(); c.ellipse(0, 0, p.size * Math.abs(Math.cos(p.rot)) + 0.6, p.size, 0, 0, 6.283); c.fill(); c.restore();
      } else if (p.kind === 'ring') {
        c.strokeStyle = p.color; c.lineWidth = 2; c.beginPath(); c.arc(p.x, p.y, (1 - a) * p.size * 6 + p.size, 0, 6.283); c.stroke();
      } else {
        c.fillStyle = p.color; c.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    }
    c.globalAlpha = 1;
    for (var j = 0; j < E.floats.length; j++) {
      var f = E.floats[j]; if (!f.live) continue;
      var fa = clamp(f.life / f.max, 0, 1);
      c.globalAlpha = fa; c.fillStyle = f.c; c.font = '900 ' + Math.round(E.H * 0.05) + 'px Inter,system-ui,Arial';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(f.t, f.x, f.y - (1 - fa) * 20);
    }
    c.globalAlpha = 1;
  }
  function clearFX() { for (var i = 0; i < POOL.length; i++) POOL[i].live = false; E.floats.length = 0; E.shake = 0; E.hitstop = 0; E.flash = 0; }

  function addShake(v) { if (!RM) E.shake = Math.min(1, E.shake + v); }

  // ---- canvas sizing (DPR-crisp, letterboxed to a comfy portrait) --------
  function resize() {
    var d = dom, dpr = Math.min(2.5, window.devicePixelRatio || 1);
    var topH = d.root.querySelector('.la-top').offsetHeight + d.root.querySelector('.la-hud').offsetHeight;
    var ctrlH = (E.mode === 'hopper') ? d.ctrls.offsetHeight + 14 : 0;
    var availW = Math.min(480, window.innerWidth - 24);
    var availH = window.innerHeight - topH - ctrlH - 30;
    var cssW = availW, cssH = clamp(availH, 320, availW * 1.9);
    var c = d.cv;
    c.style.width = cssW + 'px'; c.style.height = cssH + 'px';
    c.width = Math.round(cssW * dpr); c.height = Math.round(cssH * dpr);
    E.ctx = c.getContext('2d'); E.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    E.W = cssW; E.H = cssH; E.dpr = dpr; E.skyGrad = null; E.moonGrad = null;
    if (E.game && E.game.resized) E.game.resized();
    if (!E.running) drawIdle();
  }

  function drawIdle() {
    var c = E.ctx; if (!c) return;
    var g = c.createLinearGradient(0, 0, 0, E.H); g.addColorStop(0, '#0a1024'); g.addColorStop(1, '#05060d');
    c.fillStyle = g; c.fillRect(0, 0, E.W, E.H);
  }

  // =======================================================================
  //  GAME: Loop Flyer  (flappy, juiced)
  // =======================================================================
  function Flyer() {
    var by, pby, bvy, rot, squash, pipes, groundX, stars, dead, pn, clouds, wing;
    var GRV = 0.42, FLAP = -7.4, TERM = 11;
    function reset() {
      by = pby = E.H * 0.44; bvy = 0; rot = 0; squash = 0; pipes = []; groundX = 0; dead = false; pn = 0; wing = 0; E._fly = {};
      stars = []; for (var i = 0; i < 26; i++) stars.push({ x: rnd(0, E.W), y: rnd(0, E.H * 0.7), r: rnd(0.5, 1.6), s: rnd(0.1, 0.4) });
      clouds = []; for (var j = 0; j < 4; j++) clouds.push({ x: rnd(0, E.W), y: rnd(E.H * 0.08, E.H * 0.42), s: rnd(0.15, 0.4), sc: rnd(0.7, 1.5) });
      spawnPipe(E.W + 90); spawnPipe(E.W + 90 + gapX());
    }
    function gapX() { return clamp(E.W * 0.62, 190, 300); }
    function speed() { return 2.0 + Math.min(2.8, E.score * 0.028); }
    function gapH() { var base = pn < 3 ? E.H * 0.40 : E.H * 0.34; return clamp(base - Math.max(0, E.score - 2) * 1.1, E.H * 0.24, E.H * 0.42); }
    function spawnPipe(x) {
      var g = gapH(), center;
      if (pn < 2) center = E.H * 0.45 + rnd(-E.H * 0.05, E.H * 0.05);        // ease the first pipes toward the bird's height
      else center = rnd(g / 2 + 50, E.H - g / 2 - 60);
      var top = clamp(center - g / 2, 40, E.H - g - 70);
      pipes.push({ x: x, top: top, gap: g, passed: false, coin: pn >= 1 && Math.random() < 0.5, coinGot: false });
      pn++;
    }
    function tap() {
      if (dead) return; bvy = FLAP; squash = 1; rot = -0.5; wing = 1; Audio.flap(); haptic(8);
      spawn(E.W * 0.30 - 12, by + 6, rnd(-1.5, -0.4), rnd(0.3, 1.2), 16, rnd(2, 3.5), E.accent2, 'spark', 0.05);
    }
    function dir() { tap(); }
    function update() {
      var f = E._fly; if (f) { f.by = by; f.hasP0 = pipes.length > 0; if (pipes.length) { f.p0top = pipes[0].top; f.p0gap = pipes[0].gap; } }  // cheap scalar QA hook (no per-frame allocation)
      bvy = clamp(bvy + GRV, -20, TERM); pby = by; by += bvy;
      rot = lerp(rot, clamp(bvy * 0.05, -0.5, 1.1), 0.2);
      squash = lerp(squash, 0, 0.15);
      groundX = (groundX - speed()) % 28;
      wing = Math.max(0, wing - 0.12);
      for (var i = 0; i < stars.length; i++) { stars[i].x -= stars[i].s; if (stars[i].x < -2) { stars[i].x = E.W + 2; stars[i].y = rnd(0, E.H * 0.7); } }
      for (var ci = 0; ci < clouds.length; ci++) { clouds[ci].x -= clouds[ci].s * 0.6; if (clouds[ci].x < -70) { clouds[ci].x = E.W + 60; clouds[ci].y = rnd(E.H * 0.08, E.H * 0.42); } }
      var sp = speed();
      for (var k = 0; k < pipes.length; k++) pipes[k].x -= sp;
      if (pipes.length && pipes[pipes.length - 1].x < E.W - gapX()) spawnPipe(E.W + 40);
      while (pipes.length && pipes[0].x < -80) pipes.shift();

      var bx = E.W * 0.30, r = clamp(E.H * 0.026, 9, 15), hb = r * 0.82; // forgiving hitbox
      for (var j = 0; j < pipes.length; j++) {
        var p = pipes[j];
        // coin pickup
        if (p.coin && !p.coinGot) {
          var cxp = p.x + 21, cyp = p.top + p.gap / 2;
          if (Math.abs(bx - cxp) < r + 12 && Math.abs(by - cyp) < r + 12) {
            p.coinGot = true; E.score++; Audio.coin(); haptic(10);
            burst(cxp, cyp, 10, '#ffcf5a', { kind: 'coin', min: 1, max: 4, up: 1 });
            floatText(cxp, cyp, '+1', '#ffcf5a'); bumpScore();
          }
        }
        if (!p.passed && p.x + 42 < bx) {
          p.passed = true; E.score++; Audio.score(); bumpScore();
          // near-miss bonus
          var margin = Math.min(by - p.top, (p.top + p.gap) - by);
          if (margin < r * 2.4) { floatText(bx, by - r * 3, 'NICE!', E.accent2); Audio.near(); addShake(0.12); }
        }
        // collision (inset hitbox)
        if (bx + hb > p.x && bx - hb < p.x + 42 && (by - hb < p.top || by + hb > p.top + p.gap)) return die(bx, by);
      }
      if (by + r > E.H - 10 || by - r < 0) return die(bx, clamp(by, 12, E.H - 12));
    }
    function bumpScore() { squash = Math.min(1, squash + 0.4); }
    function die(x, y) {
      if (dead) return; dead = true; Audio.crash(); haptic([25, 40, 60]);
      addShake(0.9); E.hitstop = 90; E.flash = 1;
      burst(x, y, 26, E.accent2, { min: 2, max: 8, sz0: 2, sz1: 6, grav: 0.5 });
      burst(x, y, 10, '#ffcf5a', { kind: 'coin', min: 1, max: 5, up: 1 });
      setTimeout(gameOver, 260);
    }
    function render(c, a) {
      var W = E.W, H = E.H, iy = lerp(pby, by, a), t = E.clock;
      // sky (cached gradient — recomputed only on resize)
      if (!E.skyGrad || E.skyH !== H) { E.skyGrad = c.createLinearGradient(0, 0, 0, H); E.skyGrad.addColorStop(0, '#0b1330'); E.skyGrad.addColorStop(0.55, '#0a1024'); E.skyGrad.addColorStop(1, '#05060d'); E.skyH = H; }
      c.fillStyle = E.skyGrad; c.fillRect(0, 0, W, H);
      // moon with soft glow (cached radial gradient)
      var mx = W * 0.80, my = H * 0.16;
      if (!E.moonGrad || E.skyH !== H) { E.moonGrad = c.createRadialGradient(mx, my, 2, mx, my, 46); E.moonGrad.addColorStop(0, 'rgba(220,230,255,.5)'); E.moonGrad.addColorStop(1, 'rgba(220,230,255,0)'); }
      c.fillStyle = E.moonGrad; c.beginPath(); c.arc(mx, my, 46, 0, 6.283); c.fill();
      c.fillStyle = '#e8ecff'; c.beginPath(); c.arc(mx, my, 16, 0, 6.283); c.fill();
      c.fillStyle = '#0b1330'; c.beginPath(); c.arc(mx + 7, my - 4, 14, 0, 6.283); c.fill();
      // stars (twinkle via clock)
      for (var i = 0; i < stars.length; i++) { c.globalAlpha = 0.25 + 0.4 * (0.5 + 0.5 * Math.sin(t / 400 + i)); c.fillStyle = 'rgba(200,220,255,.9)'; c.fillRect(stars[i].x, stars[i].y, stars[i].r, stars[i].r); }
      c.globalAlpha = 1;
      // clouds (parallax)
      for (var ci = 0; ci < clouds.length; ci++) drawCloud(c, clouds[ci]);
      // parallax skyline
      drawSkyline(c, W, H);
      // pipes (glowing clipper combs)
      var pw = 44;
      for (var k = 0; k < pipes.length; k++) {
        var p = pipes[k];
        c.save(); c.translate(p.x, 0);
        var pg = c.createLinearGradient(0, 0, pw, 0); pg.addColorStop(0, E.accent2); pg.addColorStop(0.5, E.accent); pg.addColorStop(1, E.accent2);
        c.fillStyle = pg;
        roundRect(c, 0, -4, pw, p.top + 4, 8); c.fill();
        roundRect(c, 0, p.top + p.gap, pw, H - (p.top + p.gap), 8); c.fill();
        c.fillStyle = 'rgba(255,255,255,.10)'; c.fillRect(4, 0, 5, p.top); c.fillRect(4, p.top + p.gap, 5, H);
        c.fillStyle = 'rgba(255,255,255,.18)';
        roundRect(c, -3, p.top - 16, pw + 6, 16, 5); c.fill();
        roundRect(c, -3, p.top + p.gap, pw + 6, 16, 5); c.fill();
        c.restore();
        if (p.coin && !p.coinGot) {
          var cx = p.x + pw / 2, cy = p.top + p.gap / 2;
          c.save(); c.translate(cx, cy); c.scale(Math.cos(t / 200) * 0.4 + 0.7, 1);
          c.fillStyle = '#ffcf5a'; c.shadowColor = '#ffcf5a'; c.shadowBlur = 14; c.beginPath(); c.arc(0, 0, 9, 0, 6.283); c.fill();
          c.shadowBlur = 0; c.fillStyle = '#7a5b10'; c.font = '900 11px Inter,Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('★', 0, 1); c.restore();
        }
      }
      // ground strip
      c.fillStyle = '#0e1330'; c.fillRect(0, H - 10, W, 10);
      c.fillStyle = 'rgba(122,162,255,.28)';
      for (var gx = groundX; gx < W; gx += 28) c.fillRect(gx, H - 10, 14, 10);
      // bird with flapping wing
      var bx = W * 0.30, r = clamp(H * 0.026, 9, 15), sx = 1 + squash * 0.35, sy = 1 - squash * 0.3;
      c.save(); c.translate(bx, iy); c.rotate(rot); c.scale(sx, sy);
      // wing (behind body), angle driven by recent flap
      var wa = -0.5 + wing * 1.6;
      c.save(); c.rotate(wa); c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(-r * 0.15, r * 0.1, r * 0.7, r * 0.4, 0, 0, 6.283); c.fill(); c.restore();
      var _skc = skinColor(); c.shadowColor = _skc; c.shadowBlur = 16; c.fillStyle = _skc;
      c.beginPath(); c.arc(0, 0, r, 0, 6.283); c.fill(); c.shadowBlur = 0;
      c.fillStyle = '#ffcf5a'; c.beginPath(); c.moveTo(r * 0.85, 0); c.lineTo(r * 1.5, -r * 0.22); c.lineTo(r * 1.5, r * 0.22); c.closePath(); c.fill();
      c.fillStyle = '#05060d'; c.beginPath(); c.arc(r * 0.35, -r * 0.25, r * 0.22, 0, 6.283); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(r * 0.42, -r * 0.32, r * 0.08, 0, 6.283); c.fill();
      c.restore();
    }
    function drawCloud(c, cl) {
      c.save(); c.globalAlpha = 0.10; c.fillStyle = '#cdd8ff'; c.translate(cl.x, cl.y); c.scale(cl.sc, cl.sc);
      c.beginPath(); c.arc(0, 0, 14, 0, 6.283); c.arc(16, 2, 18, 0, 6.283); c.arc(36, 0, 13, 0, 6.283); c.arc(18, 10, 20, 0, 6.283); c.fill();
      c.restore(); c.globalAlpha = 1;
    }
    function drawSkyline(c, W, H) {
      c.fillStyle = 'rgba(122,162,255,.08)';
      var base = H - 10, off = (groundX * 0.4) % 90;
      for (var x = off - 90; x < W; x += 90) {
        var bh = 40 + ((x * 37) % 60), bw = 54;
        c.fillRect(x, base - bh, bw, bh);
      }
    }
    return { reset: reset, update: update, render: render, tap: tap, dir: dir, hopper: false };
  }

  // =======================================================================
  //  GAME: Chair Hopper  (crossy-lite, smooth hops + camera)
  // =======================================================================
  function Hopper() {
    var COLS = 9, rows, pcol, prow, camY, camTarget, hopT, hopFrom, hopTo, sett, idle, rh;
    function reset() {
      rows = {}; pcol = (COLS / 2) | 0; prow = 0; camY = 0; camTarget = 0;
      hopT = 1; hopFrom = { c: pcol, r: 0 }; hopTo = { c: pcol, r: 0 }; sett = true; idle = 0;
      rh = clamp(Math.floor(E.H / 9), 40, 60);
      for (var i = -2; i < 14; i++) rowAt(i);
    }
    function resized() { rh = clamp(Math.floor(E.H / 9), 40, 60); }
    var CARCOL = [['#ff8a8a', '#e0524b'], ['#7ec8ff', '#3d8fe0'], ['#ffd86a', '#e0a83e'], ['#c9a3ff', '#8e5cff'], ['#6ff0c0', '#22c58a'], ['#ffb27a', '#e67e22']];
    function makeRow(idx) {
      if (idx < 2) return { type: 'safe', cars: [], coin: false, deco: [] };
      var roll = Math.random();
      if (roll < 0.36) {
        var coinCol = ri(0, COLS - 1), deco = [], nd = ri(0, 3);
        for (var q = 0; q < nd; q++) { var dc = ri(0, COLS - 1); if (dc !== coinCol) deco.push({ c: dc, t: Math.random() < 0.6 ? 'tree' : 'bush' }); }
        return { type: 'safe', cars: [], coin: Math.random() < 0.45, coinCol: coinCol, coinGot: false, deco: deco };
      }
      var dir = Math.random() < 0.5 ? 1 : -1;
      var speed = (0.0045 + Math.random() * 0.006 + idx * 0.00012) * dir;
      var cars = [], n = 1 + (Math.random() < 0.5 ? 1 : 0), col = CARCOL[ri(0, CARCOL.length - 1)];
      for (var k = 0; k < n; k++) cars.push({ x: Math.random() * 1.3 - 0.15, w: 0.12 + Math.random() * 0.07 });
      return { type: 'road', cars: cars, speed: speed, col: col };
    }
    function drawProp(c, x, y, cw, type) {
      if (type === 'tree') {
        c.fillStyle = '#5b3a1e'; c.fillRect(x - 2, y - 2, 4, cw * 0.26);
        c.fillStyle = '#1f6b3a'; c.beginPath(); c.arc(x, y - cw * 0.16, cw * 0.24, 0, 6.283); c.fill();
        c.fillStyle = '#2a8a4d'; c.beginPath(); c.arc(x - cw * 0.09, y - cw * 0.22, cw * 0.15, 0, 6.283); c.fill();
      } else {
        c.fillStyle = '#1f6b3a'; c.beginPath(); c.arc(x, y, cw * 0.17, 0, 6.283); c.arc(x - cw * 0.11, y + 3, cw * 0.12, 0, 6.283); c.arc(x + cw * 0.11, y + 3, cw * 0.12, 0, 6.283); c.fill();
      }
    }
    function rowAt(i) { if (!rows[i]) rows[i] = makeRow(i); return rows[i]; }
    function dir(d) {
      if (!sett) return; // ignore input mid-hop for crisp control
      if (d === 'up') { doHop(pcol, prow + 1); }
      else if (d === 'left' && pcol > 0) doHop(pcol - 1, prow);
      else if (d === 'right' && pcol < COLS - 1) doHop(pcol + 1, prow);
    }
    function tap() { dir('up'); }
    function doHop(c, r) {
      hopFrom = { c: pcol, r: prow }; hopTo = { c: c, r: r }; hopT = 0; sett = false; idle = 0;
      Audio.hop(); haptic(6);
      if (r > prow) { prow = r; if (prow > E.score) { E.score = prow; } pcol = c; }
      else { pcol = c; }
    }
    function update() {
      // advance cars in a window
      for (var idx = prow - 3; idx <= prow + 12; idx++) {
        var rw = rowAt(idx);
        if (rw.type === 'road') for (var i = 0; i < rw.cars.length; i++) {
          var cc = rw.cars[i]; cc.x += rw.speed; if (cc.x > 1.28) cc.x -= 1.56; if (cc.x < -0.34) cc.x += 1.56;
        }
      }
      // hop tween
      if (!sett) {
        hopT = Math.min(1, hopT + 0.16);
        if (hopT >= 1) { sett = true; Audio.land(); spawnDust(); checkRow(); }
      } else { idle++; }
      // coin pickup on settle handled in checkRow; camera follow
      camTarget = prow * rh;
      camY = lerp(camY, camTarget, 0.18);
    }
    function spawnDust() {
      var W = E.W, cw = W / COLS, px = (pcol + 0.5) * cw, py = playerScreenY();
      burst(px, py + rh * 0.3, 8, 'rgba(180,200,160,.9)', { min: 0.5, max: 2.2, up: 0.5, grav: 0.15, sz0: 2, sz1: 4 });
    }
    function playerScreenY() { return E.H * 0.66 + (camY - prow * rh); }
    function checkRow() {
      var rw = rowAt(prow);
      if (rw.type === 'safe' && rw.coin && !rw.coinGot && rw.coinCol === pcol) {
        rw.coinGot = true; E.score++; Audio.coin(); haptic(10);
        var W = E.W, cw = W / COLS; burst((pcol + 0.5) * cw, playerScreenY(), 10, '#ffcf5a', { kind: 'coin', min: 1, max: 4, up: 1 });
        floatText((pcol + 0.5) * cw, playerScreenY(), '+1', '#ffcf5a');
      }
      if (rw.type === 'road' && hitCar()) return die();
      // score float on forward progress
      if (E.score > E.shownScore) Audio.score();
    }
    function hitCar() {
      var rw = rowAt(prow); if (rw.type !== 'road') return false;
      var px = (pcol + 0.5) / COLS, ph = 0.42 / COLS;
      for (var i = 0; i < rw.cars.length; i++) { var cc = rw.cars[i]; if (px + ph > cc.x && px - ph < cc.x + cc.w) return true; }
      return false;
    }
    function die() {
      sett = false; Audio.crash(); haptic([25, 40, 60]); addShake(1); E.hitstop = 90; E.flash = 1;
      var W = E.W, cw = W / COLS; burst((pcol + 0.5) * cw, playerScreenY(), 24, '#ffcf5a', { min: 2, max: 7, grav: 0.5 });
      setTimeout(gameOver, 260);
    }
    // continuous collision while standing on a road row (car can arrive)
    function standingCheck() { if (sett && hitCar()) die(); }
    function render(c, a) {
      var W = E.W, H = E.H, cw = W / COLS;
      var camNow = lerp(camY - (camTarget - camY) * 0, camY, 1); // camY already smoothed
      c.fillStyle = '#05060d'; c.fillRect(0, 0, W, H);
      var pScreenY = H * 0.66;
      function rowY(idx) { return pScreenY - (idx - prow) * rh + (camNow - prow * rh) * 0 ; }
      // simpler: rows positioned relative to smoothed camera
      function rowScreenY(idx) { return pScreenY + (prow * rh - camY) - (idx - prow) * rh; }
      var top = prow + Math.ceil(pScreenY / rh) + 2, bot = prow - Math.ceil((H - pScreenY) / rh) - 2;
      for (var idx = top; idx >= bot; idx--) {
        var y = rowScreenY(idx); if (y + rh < -rh || y - rh > H + rh) continue;
        var rw = rowAt(idx);
        if (rw.type === 'safe') {
          c.fillStyle = (idx % 2 === 0) ? '#14361f' : '#0f2c1a'; c.fillRect(0, y - rh / 2, W, rh);
          // grass texture
          c.fillStyle = 'rgba(255,255,255,.03)'; for (var gx = (idx * 13) % 40; gx < W; gx += 40) c.fillRect(gx, y - 2, 3, 4);
          if (rw.deco) for (var di = 0; di < rw.deco.length; di++) drawProp(c, (rw.deco[di].c + 0.5) * cw, y, cw, rw.deco[di].t);
          if (rw.coin && !rw.coinGot) {
            var ccx = (rw.coinCol + 0.5) * cw;
            c.save(); c.translate(ccx, y); c.scale(Math.cos(E.clock / 200) * 0.4 + 0.7, 1);
            c.fillStyle = '#ffcf5a'; c.shadowColor = '#ffcf5a'; c.shadowBlur = 12; c.beginPath(); c.arc(0, 0, 10, 0, 6.283); c.fill(); c.shadowBlur = 0;
            c.fillStyle = '#7a5b10'; c.font = '900 12px Inter,Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('★', 0, 1); c.restore();
          }
        } else {
          c.fillStyle = '#14161f'; c.fillRect(0, y - rh / 2, W, rh);
          c.strokeStyle = 'rgba(255,255,255,.22)'; c.setLineDash([12, 12]); c.lineWidth = 2;
          c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); c.setLineDash([]);
          var col = rw.col || [E.accent, E.accent2];
          for (var i = 0; i < rw.cars.length; i++) {
            var cc = rw.cars[i], cx = cc.x * W, cwid = cc.w * W;
            var cg = c.createLinearGradient(0, y - rh * 0.32, 0, y + rh * 0.3); cg.addColorStop(0, col[0]); cg.addColorStop(1, col[1]);
            c.fillStyle = cg; roundRect(c, cx, y - rh * 0.32, cwid, rh * 0.62, 9); c.fill();
            // cabin/windshield
            c.fillStyle = 'rgba(255,255,255,.45)'; roundRect(c, cx + (rw.speed > 0 ? cwid * 0.58 : cwid * 0.16), y - rh * 0.17, cwid * 0.26, rh * 0.32, 4); c.fill();
            // wheels
            c.fillStyle = '#0a0a0f'; c.fillRect(cx + cwid * 0.14, y + rh * 0.26, cwid * 0.18, 4); c.fillRect(cx + cwid * 0.68, y + rh * 0.26, cwid * 0.18, 4);
            // headlight glow (leading edge)
            c.fillStyle = 'rgba(255,240,180,.6)'; var hlx = rw.speed > 0 ? cx + cwid : cx; c.beginPath(); c.arc(hlx, y, 3.5, 0, 6.283); c.fill();
          }
        }
      }
      // player (with hop arc)
      var fromX = (hopFrom.c + 0.5) * cw, toX = (pcol + 0.5) * cw;
      var t = sett ? 1 : hopT, ease = t * (2 - t);
      var px = lerp(fromX, toX, ease);
      var lift = Math.sin(Math.PI * t) * rh * 0.5;
      var py = rowScreenY(prow) - (sett ? 0 : 0) - lift;
      var sq = sett ? 1 : (1 + Math.sin(Math.PI * t) * 0.12);
      c.save(); c.translate(px, py); c.scale(1 / sq, sq);
      var _skc = skinColor(); c.shadowColor = _skc; c.shadowBlur = 16; c.fillStyle = _skc;
      roundRect(c, -cw * 0.34, -cw * 0.34, cw * 0.68, cw * 0.68, 11); c.fill(); c.shadowBlur = 0;
      c.font = '900 ' + Math.floor(cw * 0.5) + 'px system-ui,Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText((E.skin && E.skin.emoji) || '💈', 0, 1); c.restore();
      // shadow on ground
      c.globalAlpha = 0.25; c.fillStyle = '#000'; c.beginPath(); c.ellipse(px, rowScreenY(prow) + rh * 0.28, cw * 0.28, cw * 0.12, 0, 0, 6.283); c.fill(); c.globalAlpha = 1;
      standingCheck();
    }
    return { reset: reset, update: update, render: render, tap: tap, dir: dir, resized: resized, hopper: true };
  }

  // ---- main loop (fixed timestep + interpolation) ------------------------
  function frame(ts) {
    if (!E.running) return;
    E.raf = requestAnimationFrame(frame);
    var dt = Math.min(MAX_FRAME, ts - E.last); E.last = ts;
    E.clock += dt;                                              // pause-aware animation clock
    if (E.paused) { render(1); return; }
    if (E.hitstop > 0) { E.hitstop -= dt; updateParts(); render(1); return; }
    E.acc += dt;
    var steps = 0;
    while (E.acc >= STEP && steps < 5) { E.game.update(); updateParts(); E.acc -= STEP; steps++; if (!E.running) break; }
    // combo streak (cosmetic flair) + milestone flash
    if (E.score > E.lastSc) {
      E.combo++; E.comboAt = E.clock; E.lastSc = E.score;
      if (E.combo >= 3) { dom.combo.textContent = '🔥 x' + E.combo; dom.combo.classList.add('show'); }
      if (E.score > 0 && E.score % 10 === 0) { addShake(0.2); floatText(E.W / 2, E.H * 0.28, E.score + '!', E.accent2); Audio.near(); }
    } else if (E.combo && E.clock - E.comboAt > 2600) { E.combo = 0; dom.combo.classList.remove('show'); }
    var _lv = 1 + Math.floor(E.score / 6);
    if (_lv > E.level) { E.level = _lv; if (dom.level) dom.level.textContent = 'Lv ' + _lv; Audio.levelup(); floatText(E.W / 2, E.H * 0.34, 'LEVEL ' + _lv + '!', '#c9a3ff'); E.flash = Math.max(E.flash, 0.6); addShake(0.28); Audio.music.setRate(Math.max(150, 236 - _lv * 7)); }
    // smooth score readout
    if (E.shownScore !== E.score) { E.shownScore += Math.sign(E.score - E.shownScore); dom.score.textContent = E.shownScore; if (E.score > E.best) { dom.best2.textContent = '★ ' + E.score; } }
    render(clamp(E.acc / STEP, 0, 1));
  }

  function render(a) {
    var c = E.ctx; if (!c) return;
    c.save();
    if (E.shake > 0.001 && !RM) {
      var s = E.shake * E.shake * 12; c.translate(rnd(-s, s), rnd(-s, s)); E.shake *= 0.9;
    }
    E.game.render(c, a);
    drawParts(c);
    c.restore();
    if (E.flash > 0.01 && !RM) { c.globalAlpha = E.flash * 0.5; c.fillStyle = '#fff'; c.fillRect(0, 0, E.W, E.H); c.globalAlpha = 1; E.flash *= 0.85; }
  }

  // ---- unlockable skins --------------------------------------------------
  var SKINS = [
    { id: 'classic', name: 'Classic', emoji: '💈', color: '#5ad0f0', req: null },
    { id: 'gold', name: 'Gold', emoji: '⭐', color: '#ffcf5a', req: { lvl: 3 } },
    { id: 'violet', name: 'Amethyst', emoji: '🔮', color: '#c9a3ff', req: { lvl: 5 } },
    { id: 'mint', name: 'Mint', emoji: '🌿', color: '#43f0b0', req: { lvl: 8 } },
    { id: 'ember', name: 'Ember', emoji: '🔥', color: '#ff6a7a', req: { best: 25 } },
    { id: 'rainbow', name: 'Rainbow', emoji: '🌈', color: 'rainbow', req: { best: 45 } }
  ];
  function prog() { try { return JSON.parse(localStorage.getItem('loop_prog') || '{}'); } catch (e) { return {}; } }
  function saveProg(p) { try { localStorage.setItem('loop_prog', JSON.stringify(p)); } catch (e) {} }
  function skinUnlocked(sk) { if (!sk.req) return true; var p = prog(); if (sk.req.lvl) return (p.maxLevel || 1) >= sk.req.lvl; if (sk.req.best) return (p.bestEver || 0) >= sk.req.best; return true; }
  function skinReqLabel(sk) { if (!sk.req) return ''; if (sk.req.lvl) return 'Lv ' + sk.req.lvl; if (sk.req.best) return '★' + sk.req.best; return ''; }
  function currentSkin() { var id = null; try { id = localStorage.getItem('loop_skin'); } catch (e) {} var s = null; for (var i = 0; i < SKINS.length; i++) if (SKINS[i].id === id) s = SKINS[i]; return (s && skinUnlocked(s)) ? s : SKINS[0]; }
  function selectSkin(id) { try { localStorage.setItem('loop_skin', id); } catch (e) {} E.skin = currentSkin(); renderSkins(); }
  function skinColor() { var s = E.skin || SKINS[0]; if (s.color === 'rainbow') return 'hsl(' + ((E.clock / 12) % 360) + ',85%,66%)'; return s.color; }
  function renderSkins() {
    if (!dom.skins) return;
    dom.skins.innerHTML = SKINS.map(function (s) {
      var un = skinUnlocked(s), sel = (E.skin && E.skin.id === s.id);
      return '<div class="la-skin' + (sel ? ' sel' : '') + (un ? '' : ' lock') + '" data-id="' + s.id + '" title="' + s.name + '">' +
        (un ? s.emoji : '🔒') + (un ? '' : '<span class="lk">' + skinReqLabel(s) + '</span>') + '</div>';
    }).join('');
    Array.prototype.forEach.call(dom.skins.querySelectorAll('.la-skin'), function (el) {
      el.onclick = function () { var id = el.getAttribute('data-id'), s = null; for (var i = 0; i < SKINS.length; i++) if (SKINS[i].id === id) s = SKINS[i]; if (s && skinUnlocked(s)) { Audio.ui(); selectSkin(id); } };
    });
  }
  function recordProgress(sc) {
    var p = prog(), before = { maxLevel: p.maxLevel || 1, bestEver: p.bestEver || 0 };
    p.maxLevel = Math.max(before.maxLevel, E.level); p.bestEver = Math.max(before.bestEver, sc); saveProg(p);
    for (var i = 0; i < SKINS.length; i++) {
      var sk = SKINS[i]; if (!sk.req) continue;
      var wasLocked = sk.req.lvl ? before.maxLevel < sk.req.lvl : before.bestEver < sk.req.best;
      if (wasLocked && skinUnlocked(sk)) return sk;
    }
    return null;
  }

  // ---- lifecycle ---------------------------------------------------------
  function play(cfg) {
    buildDOM();
    E.cfg = cfg || {}; E.mode = cfg.mode === 'hopper' ? 'hopper' : 'flyer';
    E.accent = cfg.accent || '#7aa2ff'; E.accent2 = cfg.accent2 || '#5ad0f0';
    E.best = cfg.best || 0;
    dom.sound.textContent = SND ? '🔊' : '🔇';
    dom.title.textContent = E.mode === 'flyer' ? 'Loop Flyer' : 'Chair Hopper';
    dom.name.textContent = dom.title.textContent;
    dom.icon.textContent = E.mode === 'flyer' ? '🐦' : '🚦';
    dom.how.textContent = E.mode === 'flyer'
      ? 'Tap / Space to fly. Dodge the clippers, grab ★ coins. Level up every 6 — how far can you go?'
      : 'Tap ▲ to hop, ◀ ▶ to dodge traffic. Grab ★ coins. Level up every 6 hops — don\'t get hit!';
    dom.best.textContent = E.best; dom.best2.textContent = '★ ' + E.best;
    dom.score.textContent = '0'; dom.combo.classList.remove('show');
    dom.ctrls.classList.toggle('hide', E.mode !== 'hopper');
    dom.start.classList.remove('hide'); dom.over.classList.add('hide'); dom.pausescr.classList.add('hide');
    dom.root.classList.add('on'); dom.root.setAttribute('aria-hidden', 'false');
    E.running = false; E.paused = false; E.over = false;
    E.skin = currentSkin(); renderSkins();
    resize();
  }
  function start() {
    Audio.resume(); Audio.ui();
    clearFX();
    E.game = E.mode === 'flyer' ? Flyer() : Hopper();
    resize();
    E.score = 0; E.shownScore = 0; E.combo = 0; E.lastSc = 0; E.clock = 0; dom.score.textContent = '0';
    E.level = 1; if (dom.level) dom.level.textContent = 'Lv 1'; Audio.music.start(236);
    dom.combo.classList.remove('show');
    dom.start.classList.add('hide'); dom.over.classList.add('hide'); dom.pausescr.classList.add('hide');
    E.game.reset();
    E.running = true; E.paused = false; E.over = false; E.acc = 0; E.last = performance.now();
    cancelAnimationFrame(E.raf); E.raf = requestAnimationFrame(frame);
  }
  function pause() {
    if (!E.running || E.paused) return; E.paused = true; Audio.music.stop(); dom.pausescr.classList.remove('hide'); dom.pause.textContent = '▶'; Audio.ui();
  }
  function resume() {
    if (!E.paused) return; E.paused = false; dom.pausescr.classList.add('hide'); dom.pause.textContent = '❚❚';
    E.last = performance.now(); Audio.resume(); Audio.ui(); Audio.music.start();
  }
  function gameOver() {
    if (E.over) return; E.over = true; E.running = false; cancelAnimationFrame(E.raf); Audio.music.stop();
    var sc = E.score, mode = E.mode;
    dom.final.textContent = sc; dom.l1.textContent = ''; dom.l2.textContent = '';
    var localBest = Math.max(E.best, sc), newBest = sc > E.best; var newSkin = recordProgress(sc);
    var medal = sc >= 40 ? '🥇' : sc >= 20 ? '🥈' : sc >= 8 ? '🥉' : '🏁';
    var em = dom.over.querySelector('.la-em'); if (em) em.textContent = medal;
    dom.combo.classList.remove('show');
    dom.over.classList.remove('hide');
    var res = E.cfg.onOver ? E.cfg.onOver(mode, sc) : null;
    Promise.resolve(res).then(function (r) {
      r = r || {};
      if (typeof r.best === 'number') { localBest = r.best; }
      E.best = localBest; dom.best2.textContent = '★ ' + localBest;
      dom.l1.textContent = r.line1 || (newBest ? '🏆 New best!' : ('Best: ' + localBest));
      dom.l2.textContent = r.line2 || (newBest ? '' : (r.line1 ? ('Best: ' + localBest) : ''));
      if (newSkin) { dom.l2.textContent = '🎉 New skin: ' + newSkin.name + '!'; }
      if (((r.newBest || newBest) && sc > 0) || newSkin) celebrate();
    }).catch(function () { dom.l1.textContent = newBest ? '🏆 New best!' : ('Best: ' + localBest); });
  }
  function celebrate() {
    if (RM) return;
    for (var i = 0; i < 26; i++) {
      var s = document.createElement('span');
      s.textContent = ['🎉', '✨', '⭐', '🪙', '🎊'][i % 5];
      s.style.cssText = 'position:fixed;top:-16px;left:' + rnd(0, 100) + 'vw;font-size:20px;z-index:2147483001;pointer-events:none;transition:none;animation:la-cf ' + rnd(1.6, 3.2) + 's linear forwards';
      document.body.appendChild(s); (function (el) { setTimeout(function () { el.remove(); }, 3400); })(s);
    }
    if (!document.getElementById('la-cf-style')) {
      var st = document.createElement('style'); st.id = 'la-cf-style';
      st.textContent = '@keyframes la-cf{to{transform:translateY(105vh) rotate(720deg);opacity:0}}';
      document.head.appendChild(st);
    }
  }
  function close() {
    E.running = false; E.paused = false; cancelAnimationFrame(E.raf); Audio.music.stop(); clearFX();
    dom.root.classList.remove('on'); dom.root.setAttribute('aria-hidden', 'true');
    if (E.cfg && E.cfg.onClose) try { E.cfg.onClose(); } catch (e) {}
  }

  window.LoopArcade = {
    play: play,
    isSoundOn: function () { return SND; },
    _dbg: function () { return { running: E.running, over: E.over, score: E.score, mode: E.mode, fly: E._fly }; },
    version: '2.0'
  };
})();
