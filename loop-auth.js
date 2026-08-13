/* ============================================================================
   ONE SIGN-IN FOR THE WHOLE SHOP
   ----------------------------------------------------------------------------
   Every owner-side tool used to keep its own copy of the same two values under
   its own key, in its own shape:

     loop_owner    {c, p}        /rewards/owner/
     cc_auth       {c, p}        /center/
     rw_staff      {slug, pin}   /rewards/staff/
     tb_shop_code  "<code>"      /shop/edit/  — code only, PIN never stored
     (nothing)                   /rewards/blast/, /rewards/winback/

   Five conventions for one credential. A barber opening the Command Center,
   tapping through to his website editor and then to the win-back list signed
   in three times to do one job — and signing out of any of them left the other
   four wide open, which is the worst of both worlds: annoying AND leaky.

   This is now the only place those credentials live.

   ON STORING THE PIN
   /shop/edit/ deliberately stored the code and never the PIN. That was the
   right instinct — a shop tablet left on the counter is a shop tablet anyone
   can pick up, and the PIN unlocks every customer's name and phone number.
   But three of the five already stored it, so the protection was mostly
   theatre while the friction was real and constant.

   The trade is taken deliberately, with the mitigations that make it
   defensible: a hard 30-day expiry, and one sign-out that clears everything
   everywhere rather than one tool at a time. A shop that wants the old
   behaviour on a shared tablet should sign out when they put it down — which
   is now a single tap instead of five.
   ============================================================================ */
(function (w) {
  'use strict';

  var KEY = 'loop_auth';
  var MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

  // the keys this replaces, and how to read each one's shape
  var LEGACY = [
    ['loop_owner', function (v) { return { c: v && v.c, p: v && v.p }; }],
    ['cc_auth',    function (v) { return { c: v && v.c, p: v && v.p }; }],
    ['rw_staff',   function (v) { return { c: v && v.slug, p: v && v.pin }; }]
  ];

  function clean(c) {
    return String(c == null ? '' : c).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function read() {
    try { return JSON.parse(w.localStorage.getItem(KEY) || 'null'); }
    catch (e) { return null; }
  }

  /* Pull a signed-in barber across from whichever tool signed them in last,
     so shipping this does not log the whole userbase out. Runs once: after the
     first get() the unified key exists and the legacy ones are dropped. */
  function migrate() {
    for (var i = 0; i < LEGACY.length; i++) {
      var k = LEGACY[i][0], shape = LEGACY[i][1], v = null;
      try { v = JSON.parse(w.localStorage.getItem(k) || 'null'); } catch (e) { v = null; }
      if (!v) continue;
      var got = shape(v);
      if (got && got.c && got.p) { set(got.c, got.p); break; }
    }
    // whatever happened above, the old copies should not linger
    for (var j = 0; j < LEGACY.length; j++) {
      try { w.localStorage.removeItem(LEGACY[j][0]); } catch (e) {}
    }
  }

  function get() {
    var a = read();
    if (!a) { migrate(); a = read(); }
    if (!a || !a.c || !a.p) return null;
    // an expired credential is treated as absent, not as an error to explain
    if (a.t && (Date.now() - a.t) > MAX_AGE_MS) { clear(); return null; }
    return { c: a.c, p: String(a.p) };
  }

  function set(code, pin) {
    var c = clean(code), p = String(pin == null ? '' : pin).trim();
    if (!c || !p) return null;
    try { w.localStorage.setItem(KEY, JSON.stringify({ c: c, p: p, t: Date.now() })); } catch (e) {}
    return { c: c, p: p };
  }

  function clear() {
    try { w.localStorage.removeItem(KEY); } catch (e) {}
    for (var i = 0; i < LEGACY.length; i++) {
      try { w.localStorage.removeItem(LEGACY[i][0]); } catch (e) {}
    }
    // /shop/edit/ kept the code on its own; it is harmless but it should go too
    try { w.localStorage.removeItem('tb_shop_code'); } catch (e) {}
  }

  /* Drop a "Sign out" control into a page without every page hand-rolling one.
     Goes wherever the page asks; sends them back to the hub afterwards. */
  function mountSignOut(el, opts) {
    if (!el) return;
    opts = opts || {};
    var b = w.document.createElement('button');
    b.type = 'button';
    b.className = opts.className || 'loopSignOut';
    b.textContent = opts.label || 'Sign out';
    b.addEventListener('click', function () {
      clear();
      w.location.href = opts.href || '/center/';
    });
    el.appendChild(b);
    return b;
  }

  w.LoopAuth = { get: get, set: set, clear: clear, clean: clean, mountSignOut: mountSignOut, KEY: KEY };
})(window);
