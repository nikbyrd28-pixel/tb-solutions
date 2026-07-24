/*! Loop FX — tiny, game-agnostic "juice" library for the Loop Arcade.
 *  Drop-in for any page: adds screen shake, particle bursts, floating score,
 *  procedural sound, flash and confetti with one-line calls at game events —
 *  no need to touch a game's render loop.
 *
 *  API:
 *    LoopFX.sfx(name)                  'score'|'coin'|'hit'|'lose'|'win'|'click'|'power'|'flap'|'hop'
 *    LoopFX.shake(el, amount=1)        brief shake on an element (default: first <canvas>)
 *    LoopFX.burst(x, y, opts)          particle burst at viewport coords
 *    LoopFX.float(x, y, text, color)   rising score/label text
 *    LoopFX.flash(color='#fff')        quick full-screen flash
 *    LoopFX.confetti(n=26)             celebration confetti
 *    LoopFX.atEl(el)-> {x,y}           center of an element in viewport coords (helper)
 *    LoopFX.setMuted(bool) / isMuted()
 *
 *  The particle overlay auto-starts on demand and auto-stops when idle (zero cost
 *  when nothing is animating). Respects prefers-reduced-motion (skips motion FX,
 *  keeps sound). Mute state is shared with the arcade engine via localStorage 'loop_snd'.
 */
(function () {
  'use strict';
  if (window.LoopFX) return;

  var RM = false;
  try { RM = window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches; } catch (e) {}
  var MUTED = false;
  try { MUTED = localStorage.getItem('loop_snd') === '0'; } catch (e) {}

  // ---- audio -------------------------------------------------------------
  var actx = null, master = null;
  function ac() {
    if (MUTED) return null;
    try {
      if (!actx) { actx = new (window.AudioContext || window.webkitAudioContext)(); master = actx.createGain(); master.gain.value = 0.5; master.connect(actx.destination); }
      if (actx.state === 'suspended') actx.resume();
    } catch (e) { actx = null; }
    return actx;
  }
  function tone(f, d, ty, v, slide) {
    var c = ac(); if (!c) return;
    try {
      var o = c.createOscillator(), g = c.createGain();
      o.type = ty || 'square'; o.frequency.setValueAtTime(f, c.currentTime);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(1, slide), c.currentTime + d);
      g.gain.setValueAtTime(0.0001, c.currentTime);
      g.gain.exponentialRampToValueAtTime(v || 0.26, c.currentTime + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + d);
      o.connect(g); g.connect(master); o.start(); o.stop(c.currentTime + d + 0.02);
    } catch (e) {}
  }
  function noise(d, v) {
    var c = ac(); if (!c) return;
    try {
      var n = c.sampleRate * d, b = c.createBuffer(1, n, c.sampleRate), ch = b.getChannelData(0);
      for (var i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / n);
      var s = c.createBufferSource(); s.buffer = b; var g = c.createGain(); g.gain.value = v || 0.25;
      var f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400;
      s.connect(f); f.connect(g); g.connect(master); s.start();
    } catch (e) {}
  }
  var SFX = {
    score: function () { tone(880, 0.08, 'triangle', 0.26, 1180); },
    coin: function () { tone(1180, 0.06, 'square', 0.22); setTimeout(function () { tone(1560, 0.08, 'square', 0.2); }, 45); },
    hit: function () { tone(200, 0.09, 'square', 0.2, 120); },
    lose: function () { noise(0.4, 0.32); tone(150, 0.4, 'sawtooth', 0.26, 60); },
    win: function () { [523, 659, 784, 1046].forEach(function (f, i) { setTimeout(function () { tone(f, 0.16, 'triangle', 0.24); }, i * 90); }); },
    click: function () { tone(560, 0.05, 'sine', 0.16); },
    power: function () { tone(400, 0.14, 'sawtooth', 0.2, 900); },
    flap: function () { tone(660, 0.09, 'square', 0.22, 380); },
    hop: function () { tone(720, 0.06, 'triangle', 0.2, 900); }
  };
  function sfx(name) { var f = SFX[name]; if (f) { try { f(); } catch (e) {} } }
  function haptic(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }

  // ---- particle overlay (on-demand rAF) ----------------------------------
  var cv = null, ctx = null, W = 0, H = 0, dpr = 1, raf = 0, running = false;
  var POOL = [], FLOATS = [];
  for (var i = 0; i < 200; i++) POOL.push({ live: false });
  function ensureCanvas() {
    if (cv) return;
    cv = document.createElement('canvas');
    cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:2147483002';
    document.body.appendChild(cv);
    resize(); window.addEventListener('resize', resize);
  }
  function resize() {
    if (!cv) return; dpr = Math.min(2.5, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function kick() { if (!running) { running = true; raf = requestAnimationFrame(loop); } }
  function loop() {
    var any = false;
    ctx.clearRect(0, 0, W, H);
    for (var i = 0; i < POOL.length; i++) {
      var p = POOL[i]; if (!p.live) continue; any = true;
      p.x += p.vx; p.y += p.vy; p.vy += p.grav; p.vx *= 0.99; p.rot += p.vr; p.life--;
      if (p.life <= 0) { p.live = false; continue; }
      var a = p.life / p.max; ctx.globalAlpha = a < 0 ? 0 : a;
      if (p.kind === 'coin') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = '#ffcf5a'; ctx.beginPath(); ctx.ellipse(0, 0, p.size * Math.abs(Math.cos(p.rot)) + 0.6, p.size, 0, 0, 6.283); ctx.fill(); ctx.restore(); }
      else { ctx.fillStyle = p.color; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); }
    }
    for (var j = 0; j < FLOATS.length; j++) {
      var f = FLOATS[j]; if (!f.live) continue; any = true;
      f.y -= 0.9; f.life--; if (f.life <= 0) { f.live = false; continue; }
      var fa = f.life / f.max; ctx.globalAlpha = fa; ctx.fillStyle = f.c;
      ctx.font = '900 ' + f.sz + 'px Inter,system-ui,Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(f.t, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    if (any) raf = requestAnimationFrame(loop); else running = false;
  }
  function pspawn(x, y, vx, vy, life, size, color, kind, grav) {
    for (var i = 0; i < POOL.length; i++) { var p = POOL[i]; if (!p.live) { p.live = true; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.max = life; p.size = size; p.color = color; p.kind = kind || 'spark'; p.grav = grav == null ? 0.35 : grav; p.rot = Math.random() * 6.28; p.vr = (Math.random() - 0.5) * 0.6; return; } }
  }
  function burst(x, y, opts) {
    if (RM) return; ensureCanvas(); opts = opts || {};
    var n = opts.n || 14, color = opts.color || '#7aa2ff';
    for (var i = 0; i < n; i++) {
      var ang = opts.up ? (-Math.PI / 2 + (Math.random() - 0.5) * 2) : Math.random() * 6.283;
      var sp = (opts.min || 2) + Math.random() * ((opts.max || 6) - (opts.min || 2));
      pspawn(x, y, Math.cos(ang) * sp, Math.sin(ang) * sp - (opts.up || 0), 24 + (Math.random() * 22 | 0), (opts.sz0 || 2) + Math.random() * ((opts.sz1 || 5) - (opts.sz0 || 2)), color, opts.kind, opts.grav);
    }
    kick();
  }
  function floatText(x, y, text, color, size) {
    if (RM) return; ensureCanvas();
    for (var i = 0; i < FLOATS.length; i++) if (!FLOATS[i].live) { var f = FLOATS[i]; f.live = true; f.x = x; f.y = y; f.t = text; f.c = color || '#fff'; f.life = 46; f.max = 46; f.sz = size || 22; kick(); return; }
    FLOATS.push({ live: true, x: x, y: y, t: text, c: color || '#fff', life: 46, max: 46, sz: size || 22 }); kick();
  }
  function flash(color) {
    if (RM) return;
    var d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483002;background:' + (color || '#fff') + ';opacity:.45;transition:opacity .35s ease';
    document.body.appendChild(d); requestAnimationFrame(function () { d.style.opacity = '0'; });
    setTimeout(function () { d.remove(); }, 400);
  }

  // ---- screen shake (CSS, element-scoped, no loop needed) -----------------
  function ensureShakeCSS() {
    if (document.getElementById('loopfx-shake')) return;
    var s = document.createElement('style'); s.id = 'loopfx-shake';
    s.textContent = '@keyframes loopfx-shake{10%{transform:translate(-2px,1px)}20%{transform:translate(3px,-2px)}30%{transform:translate(-4px,2px)}40%{transform:translate(3px,2px)}50%{transform:translate(-2px,-1px)}60%{transform:translate(2px,2px)}70%{transform:translate(-3px,-2px)}80%{transform:translate(2px,-1px)}90%{transform:translate(-1px,1px)}100%{transform:none}}' +
      '.loopfx-shaking{animation:loopfx-shake .38s cubic-bezier(.36,.07,.19,.97) both}';
    document.head.appendChild(s);
  }
  function shake(el, amount) {
    if (RM) return; ensureShakeCSS();
    el = el || document.querySelector('canvas'); if (!el) return;
    el.classList.remove('loopfx-shaking'); void el.offsetWidth; // restart animation
    el.style.setProperty('--fx', amount || 1);
    el.classList.add('loopfx-shaking');
    setTimeout(function () { el.classList.remove('loopfx-shaking'); }, 400);
  }

  function confetti(n) {
    if (RM) return;
    if (!document.getElementById('loopfx-cf')) { var st = document.createElement('style'); st.id = 'loopfx-cf'; st.textContent = '@keyframes loopfx-cf{to{transform:translateY(105vh) rotate(720deg);opacity:0}}'; document.head.appendChild(st); }
    var bits = ['🎉', '✨', '⭐', '🪙', '🎊'];
    for (var i = 0; i < (n || 26); i++) {
      var s = document.createElement('span');
      s.textContent = bits[i % bits.length];
      s.style.cssText = 'position:fixed;top:-16px;left:' + (Math.random() * 100) + 'vw;font-size:20px;z-index:2147483003;pointer-events:none;animation:loopfx-cf ' + (1.6 + Math.random() * 1.6) + 's linear forwards';
      document.body.appendChild(s); (function (e) { setTimeout(function () { e.remove(); }, 3400); })(s);
    }
  }

  function atEl(el) { if (!el) return { x: innerWidth / 2, y: innerHeight / 2 }; var r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }

  // one-call celebration for hitting a new level (banner + confetti + flash + chime)
  function levelUp(n) {
    sfx('power'); haptic([15, 40, 15]);
    floatText(innerWidth / 2, innerHeight * 0.34, 'LEVEL ' + n + '!', '#c9a3ff', 30);
    burst(innerWidth / 2, innerHeight * 0.34, { n: 16, color: '#c9a3ff', min: 2, max: 6, up: 1 });
    confetti(14); flash('rgba(185,139,255,.32)');
  }

  window.LoopFX = {
    sfx: sfx, haptic: haptic, shake: shake, burst: burst, float: floatText, flash: flash, confetti: confetti, atEl: atEl, levelUp: levelUp,
    setMuted: function (b) { MUTED = !!b; try { localStorage.setItem('loop_snd', b ? '0' : '1'); } catch (e) {} },
    isMuted: function () { return MUTED; },
    version: '1.0'
  };
})();
