/*! Loop Tour — the 60-second walk-through every Loop screen can borrow.
 *
 *  A barber signs up, lands on a screen with fourteen cards on it, and closes
 *  the tab. That is the whole reason this exists: the shop that never punches
 *  a card usually never understood which button was the one that mattered.
 *
 *  API:
 *    LoopTour.auto(id, steps, opts)   run once ever for this browser, then never
 *                                     again — unless the URL says ?tour=1
 *    LoopTour.start(steps, opts)      run it now (wire this to a "How it works"
 *                                     button so it can always be replayed)
 *    LoopTour.seen(id) / .reset(id)   has this browser been shown it
 *
 *  A step is {sel, t, b, before, pad}:
 *    sel     CSS selector for the thing to ring. A step whose target is missing
 *            or hidden is skipped, not shown as an empty box — Loop screens hide
 *            half their cards until the shop has data, and a tour that rings
 *            nothing is worse than no tour.
 *    t, b    heading and body. Plain text, no markup.
 *    before  optional function run before the step — switch tabs, open a panel.
 *    pad     optional ring padding in px (default 8).
 *
 *  opts: {id, delay, onDone}. Respects prefers-reduced-motion (no smooth scroll,
 *  no transitions). Escape closes it, arrow keys move, and the dimmed area is
 *  clickable to leave — a walk-through you cannot get out of is a trap.
 */
(function () {
  'use strict';
  if (window.LoopTour) return;

  var RM = false;
  try { RM = window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches; } catch (e) {}

  var STEPS = [], i = 0, wrap = null, opts = {}, live = false;

  function el(id) { return document.getElementById(id); }

  // A target that is display:none, or has collapsed to nothing, cannot be
  // pointed at. offsetParent misses position:fixed elements, so the rect is
  // checked too.
  function visible(n) {
    if (!n) return false;
    var r = n.getBoundingClientRect();
    if (!r.width && !r.height) return false;
    var s;
    try { s = getComputedStyle(n); } catch (e) { return true; }
    return s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0';
  }

  function target(step) {
    if (!step) return null;
    try { return document.querySelector(step.sel); } catch (e) { return null; }
  }

  function build() {
    if (wrap) return;
    var st = document.createElement('style');
    st.textContent =
      '#ltWrap{position:fixed;inset:0;z-index:99999;display:none}#ltWrap.on{display:block}' +
      '#ltCatch{position:absolute;inset:0}' +
      '#ltRing{position:absolute;border:2px solid var(--acc,#5df2e0);border-radius:14px;pointer-events:none;' +
        'box-shadow:0 0 0 9999px rgba(5,6,13,.74),0 8px 30px rgba(0,0,0,.5)}' +
      '#ltCard{position:absolute;max-width:320px;background:#0f1120;color:#f0f2f8;border:1px solid var(--line,rgba(150,190,255,.28));' +
        'border-radius:15px;padding:15px 16px;box-shadow:0 14px 44px rgba(0,0,0,.6);' +
        'font:inherit;line-height:1.5;opacity:0' + (RM ? '' : ';transition:opacity .18s ease') + '}' +
      '#ltCard.set{opacity:1}' +
      '#ltCard h4{margin:0 0 6px;font-size:15.5px;font-weight:800}' +
      '#ltCard p{margin:0 0 13px;font-size:13.5px;color:#c9cee6}' +
      '#ltBar{display:flex;align-items:center;gap:8px;justify-content:space-between}' +
      '#ltDots{display:flex;gap:5px}#ltDots i{width:6px;height:6px;border-radius:50%;background:#3d4368;display:block}' +
      '#ltDots i.on{background:var(--acc,#5df2e0)}' +
      '#ltCard button{border:0;border-radius:10px;padding:9px 15px;font:inherit;font-size:13.5px;font-weight:800;cursor:pointer}' +
      '#ltNext{background:var(--acc,#5df2e0);color:#06121a}' +
      '#ltSkip,#ltBack{background:transparent;color:#98a0bd;padding:9px 7px;font-weight:700}' +
      '@media(max-width:420px){#ltCard{max-width:none;left:12px!important;right:12px!important;width:auto!important}}';
    document.head.appendChild(st);

    wrap = document.createElement('div');
    wrap.id = 'ltWrap';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.innerHTML =
      '<div id="ltCatch"></div><div id="ltRing"></div>' +
      '<div id="ltCard"><h4 id="ltT"></h4><p id="ltB"></p>' +
      '<div id="ltBar"><div id="ltDots"></div>' +
      '<div><button id="ltBack" type="button">← Back</button>' +
      '<button id="ltSkip" type="button">Skip</button>' +
      '<button id="ltNext" type="button">Next →</button></div></div></div>';
    document.body.appendChild(wrap);

    el('ltCatch').addEventListener('click', function () { stop(false); });
    el('ltSkip').addEventListener('click', function () { stop(false); });
    el('ltBack').addEventListener('click', function () { go(-1); });
    el('ltNext').addEventListener('click', function () { go(1); });
    document.addEventListener('keydown', function (e) {
      if (!live) return;
      if (e.key === 'Escape') { stop(false); }
      else if (e.key === 'ArrowRight' || e.key === 'Enter') { go(1); }
      else if (e.key === 'ArrowLeft') { go(-1); }
    });
  }

  // scrollIntoView is asynchronous, takes as long as the distance demands, and
  // has no callback. Measuring once on a timer is how a spotlight ends up
  // ringing empty space halfway down a long dashboard, so instead the ring
  // simply follows its target every frame for as long as the tour is up. The
  // card waits until the target has stopped moving, then appears beside it —
  // otherwise it flips above and below the ring all the way down the scroll.
  var last = '', still = 0, frames = 0;
  function pump() {
    if (!live) return;
    requestAnimationFrame(pump);
    var node = target(STEPS[i]);
    if (!node) return;
    var r = node.getBoundingClientRect(), key = (r.top | 0) + ',' + (r.left | 0) + ',' + (r.height | 0);
    if (key === last) { still++; } else { still = 0; last = key; }
    frames++;
    ring(r);
    if (still >= 3 || frames > 90) card(r);
  }

  function ring(r) {
    var step = STEPS[i], node = target(step);
    if (!node) return;
    var step = STEPS[i], n = el('ltRing'),
        pad = step && step.pad != null ? step.pad : 8,
        vw = window.innerWidth, vh = window.innerHeight;
    // A card taller than the screen would push the ring off both ends; ring the
    // top of it instead, which is where its heading is.
    n.style.left = Math.max(6, r.left - pad) + 'px';
    n.style.top = Math.max(6, r.top - pad) + 'px';
    n.style.width = Math.min(r.width + pad * 2, vw - 12) + 'px';
    n.style.height = Math.min(r.height + pad * 2, vh - 12, vh * 0.62) + 'px';
  }

  function card(r) {
    var c = el('ltCard'), n = el('ltRing'),
        vw = window.innerWidth, vh = window.innerHeight,
        cw = Math.min(320, vw - 24), ch = c.offsetHeight || 170,
        top = parseFloat(n.style.top) || 0, height = parseFloat(n.style.height) || 0,
        below = top + height + 14;
    c.style.width = cw + 'px';
    c.style.left = Math.max(12, Math.min(r.left, vw - cw - 12)) + 'px';
    c.style.top = (below + ch < vh - 8 ? below : Math.max(12, Math.min(top - 14 - ch, vh - ch - 12))) + 'px';
    c.classList.add('set');
  }

  function paint() {
    var step = STEPS[i];
    el('ltT').textContent = step.t || '';
    el('ltB').textContent = step.b || '';
    el('ltDots').innerHTML = STEPS.map(function (_, n) {
      return '<i class="' + (n === i ? 'on' : '') + '"></i>';
    }).join('');
    el('ltNext').textContent = (i >= STEPS.length - 1) ? 'Got it ✓' : 'Next →';
    el('ltBack').style.display = i > 0 ? '' : 'none';
  }

  function show(dir) {
    // Back off the first visible step should not slam the door — walk forward
    // again instead of treating it as a skip.
    if (i < 0) { i = 0; dir = 1; }
    // walk past anything this shop has not got on screen
    while (STEPS[i] && !visible(prep(STEPS[i]))) { i += dir; if (i < 0) { i = 0; dir = 1; } }
    if (i >= STEPS.length) { stop(true); return; }
    paint();
    var node = target(STEPS[i]);
    el('ltCard').classList.remove('set');
    last = ''; still = 0; frames = 0;
    try { node.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'center' }); }
    catch (e) { try { node.scrollIntoView(); } catch (_) {} }
  }

  // `before` may reveal the target (switching tabs, opening a panel), so it has
  // to run before the visibility check, not after it.
  function prep(step) {
    if (step.before) { try { step.before(); } catch (e) {} }
    return target(step);
  }

  function go(d) { i += d; show(d); }

  function start(steps, o) {
    o = o || {};
    // A step for a card this page does not have at all is dropped here rather
    // than skipped later, so the dots count the walk-through he actually gets.
    STEPS = (steps || []).filter(function (s) {
      if (!s || !s.sel) return false;
      if (s.before) return true;
      try { return !!document.querySelector(s.sel); } catch (e) { return false; }
    });
    if (!STEPS.length) return false;
    opts = o; build();
    i = 0; live = true;
    wrap.classList.add('on');
    show(1);
    pump();
    return live;
  }

  function stop(done) {
    live = false;
    if (wrap) wrap.classList.remove('on');
    if (opts.id) { try { localStorage.setItem('loop_tour_' + opts.id, '1'); } catch (e) {} }
    if (done && opts.onDone) { try { opts.onDone(); } catch (e) {} }
  }

  function seen(id) {
    try { return localStorage.getItem('loop_tour_' + id) === '1'; } catch (e) { return false; }
  }

  window.LoopTour = {
    start: start,
    stop: stop,
    seen: seen,
    reset: function (id) { try { localStorage.removeItem('loop_tour_' + id); } catch (e) {} },
    // Once per browser, a beat after the page settles — and never inside an
    // iframe, where a full-screen overlay belongs to somebody else's page.
    auto: function (id, steps, o) {
      o = o || {}; o.id = id;
      var forced = /[?&]tour=1/.test(location.search);
      if (!forced && (seen(id) || window.top !== window.self)) return false;
      setTimeout(function () { start(steps, o); }, o.delay == null ? 900 : o.delay);
      return true;
    }
  };
})();
