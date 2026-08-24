/* ============================================================================
   TB UNIVERSITY — THE CAMPUS APP
   ----------------------------------------------------------------------------
   The public /university/ page sells the school. This is the school: enrolment,
   twenty-eight lessons across five campuses, the daily checklist, XP and rank,
   the wins feed, the leaderboard, and the toolstack the membership actually
   pays for.

   TWO THINGS DECIDE THE SHAPE OF THIS FILE.

   1. IT HAS TO RUN WITHOUT NICK IN THE ROOM.
      A membership priced at four figures a month cannot depend on the founder
      manually onboarding, unlocking, nudging and reporting. So enrolment is a
      code the student redeems themselves, progress is stored the moment they
      earn it, and the accountability loop (daily checklist → streak → rank →
      leaderboard) is machinery, not a person. One student and four hundred
      cost the same to run.

   2. IT HAS TO WORK BEFORE THE DATABASE DOES.
      hq/university.sql has to be run in Supabase before any of the RPCs exist.
      Rather than ship a page that shows an error until then, the store falls
      back to this device: same app, same rules, progress in localStorage, with
      a banner that says so plainly. The day the SQL is applied, cloud mode
      takes over and this device's progress is pushed up once (see syncUp).
      Nothing about a student's day changes; the storage underneath does.

   The auth is the estate's existing shape — an identifier plus a 4-digit PIN,
   validated server-side by a SECURITY DEFINER function sitting behind
   pin_gate(), the same brute-force throttle every shop RPC uses. It is not
   Supabase Auth because nothing here needs email round-trips, and a barber's
   apprentice on a bus should be two taps from the lesson he stopped at.
   ============================================================================ */
(function (w, d) {
  'use strict';

  var SUPA_URL = 'https://qgbjiqdwzgkjkmqyjsmc.supabase.co';
  var SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnYmppcWR3emdramttcXlqc21jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzNzc1NTEsImV4cCI6MjA5OTk1MzU1MX0.Naocw-B0B6Z7CLg197yxLezd58a6f5XoMLEiea5b0Ro';

  var SESSION_KEY = 'tbu_session';     // {email, pin, name}
  var LOCAL_KEY   = 'tbu_local';       // the offline mirror of a student's state
  var XP = w.TBU_XP, DAILY = w.TBU_DAILY, RANKS = w.TBU_RANKS, CAMPUSES = w.TBU_CAMPUSES;

  /* ---------------------------------------------------------------- helpers */
  function el(id) { return d.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function toast(msg, kind) {
    var t = d.createElement('div');
    t.className = 'toast ' + (kind || '');
    t.textContent = msg;
    el('toasts').appendChild(t);
    setTimeout(function () {
      t.style.transition = 'opacity .35s,transform .35s';
      t.style.opacity = '0'; t.style.transform = 'translateY(8px)';
      setTimeout(function () { t.remove(); }, 360);
    }, 2600);
  }
  function today() {
    var n = new Date();
    return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0');
  }
  function daysBetween(a, b) {
    if (!a || !b) return null;
    return Math.round((Date.parse(b + 'T00:00:00') - Date.parse(a + 'T00:00:00')) / 86400000);
  }
  function ago(iso) {
    if (!iso) return '';
    var s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
    if (s < 90) return 'just now';
    if (s < 3600) return Math.round(s / 60) + 'm ago';
    if (s < 86400) return Math.round(s / 3600) + 'h ago';
    if (s < 604800) return Math.round(s / 86400) + 'd ago';
    return new Date(iso).toLocaleDateString();
  }
  function initials(name) {
    var p = String(name || '').trim().split(/\s+/);
    return ((p[0] || '?')[0] + (p[1] ? p[1][0] : '')).toUpperCase();
  }
  function rankFor(xp) {
    var r = RANKS[0];
    for (var i = 0; i < RANKS.length; i++) if (xp >= RANKS[i].at) r = RANKS[i];
    return r;
  }
  function nextRank(xp) {
    for (var i = 0; i < RANKS.length; i++) if (xp < RANKS[i].at) return RANKS[i];
    return null;
  }
  function lessonById(id) {
    for (var i = 0; i < w.TBU_LESSONS.length; i++) if (w.TBU_LESSONS[i].lesson.id === id) return w.TBU_LESSONS[i];
    return null;
  }
  function campusById(id) {
    for (var i = 0; i < CAMPUSES.length; i++) if (CAMPUSES[i].id === id) return CAMPUSES[i];
    return null;
  }

  /* ------------------------------------------------------------------ store */
  /* Cloud first, this device if the cloud has no schema yet. `mode` is read by
     the shell to decide whether to show the local-mode banner. */
  var Store = {
    mode: 'cloud',

    rpc: function (fn, body) {
      return fetch(SUPA_URL + '/rest/v1/rpc/' + fn, {
        method: 'POST',
        headers: { apikey: SUPA_KEY, Authorization: 'Bearer ' + SUPA_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {})
      }).then(function (r) {
        if (r.ok) return r.json();
        /* 404 / PGRST202 means the migration has not been applied yet — that is
           a deployment state, not a student-facing error, so it degrades. */
        if (r.status === 404) { Store.mode = 'local'; return { ok: false, offline: true }; }
        return r.json().catch(function () { return {}; }).then(function (j) {
          var msg = (j && (j.message || j.error)) || '';
          if (/could not find the function|PGRST202/i.test(msg)) { Store.mode = 'local'; return { ok: false, offline: true }; }
          return { ok: false, error: msg || ('Something went wrong (' + r.status + ')') };
        });
      }).catch(function () { Store.mode = 'local'; return { ok: false, offline: true }; });
    },

    /* ---- local mirror --------------------------------------------------- */
    _local: function () {
      try { return JSON.parse(w.localStorage.getItem(LOCAL_KEY) || 'null'); } catch (e) { return null; }
    },
    _saveLocal: function (s) {
      try { w.localStorage.setItem(LOCAL_KEY, JSON.stringify(s)); } catch (e) {}
      return s;
    },
    _blank: function (name, email, goal) {
      return {
        student: { name: name, email: email, goal: goal || '', xp: 0, streak: 0, best_streak: 0,
                   last_full_day: null, joined: new Date().toISOString(), status: 'active', plan: 'local' },
        done: {},          // lesson id -> {at, proof}
        days: {},          // 'YYYY-MM-DD' -> [item ids]
        wins: []
      };
    },

    /* ---- calls ---------------------------------------------------------- */
    join: function (name, email, pin, goal, code) {
      return Store.rpc('uni_join', { p_name: name, p_email: email, p_pin: pin, p_goal: goal, p_code: code })
        .then(function (r) {
          if (r && r.offline) {
            var s = Store._local();
            if (!s) s = Store._saveLocal(Store._blank(name, email, goal));
            return { ok: true, local: true, state: Store._state(s) };
          }
          return r;
        });
    },
    signin: function (email, pin) {
      return Store.rpc('uni_state', { p_email: email, p_pin: pin }).then(function (r) {
        if (r && r.offline) {
          var s = Store._local();
          if (!s) return { ok: false, error: 'No account on this device yet — enrol to start.' };
          return { ok: true, local: true, state: Store._state(s) };
        }
        return r;
      });
    },
    state: function (email, pin) { return Store.signin(email, pin); },

    completeLesson: function (email, pin, lessonId, proof) {
      if (Store.mode === 'local') {
        var s = Store._local() || Store._blank('', email, '');
        if (!s.done[lessonId]) {
          s.done[lessonId] = { at: new Date().toISOString(), proof: proof || '' };
          s.student.xp += XP.lesson + (proof ? XP.mission : 0);
        }
        Store._saveLocal(s);
        return Promise.resolve({ ok: true, local: true, state: Store._state(s) });
      }
      return Store.rpc('uni_lesson_done', { p_email: email, p_pin: pin, p_lesson: lessonId, p_proof: proof });
    },

    toggleDaily: function (email, pin, itemId, on) {
      if (Store.mode === 'local') {
        var s = Store._local() || Store._blank('', email, '');
        var day = today();
        var list = s.days[day] || [];
        var had = list.indexOf(itemId) >= 0;
        if (on && !had) { list.push(itemId); s.student.xp += XP.daily; }
        if (!on && had) { list.splice(list.indexOf(itemId), 1); s.student.xp = Math.max(0, s.student.xp - XP.daily); }
        s.days[day] = list;
        if (list.length === DAILY.length && s.student.last_full_day !== day) {
          var gap = daysBetween(s.student.last_full_day, day);
          s.student.streak = (gap === 1) ? (s.student.streak + 1) : 1;
          s.student.best_streak = Math.max(s.student.best_streak || 0, s.student.streak);
          s.student.last_full_day = day;
          s.student.xp += XP.dailyAll + (s.student.streak % 7 === 0 ? XP.streak7 : 0);
        }
        Store._saveLocal(s);
        return Promise.resolve({ ok: true, local: true, state: Store._state(s) });
      }
      return Store.rpc('uni_check', { p_email: email, p_pin: pin, p_item: itemId, p_on: !!on });
    },

    postWin: function (email, pin, body, amount) {
      if (Store.mode === 'local') {
        var s = Store._local() || Store._blank('', email, '');
        s.wins.unshift({ name: s.student.name, body: body, amount: amount || null, at: new Date().toISOString(), mine: true });
        s.student.xp += XP.win;
        Store._saveLocal(s);
        return Promise.resolve({ ok: true, local: true, state: Store._state(s) });
      }
      return Store.rpc('uni_win_post', { p_email: email, p_pin: pin, p_body: body, p_amount: amount });
    },

    setPath: function (email, pin, path) {
      if (Store.mode === 'local') {
        var st = Store._local() || Store._blank('', email, '');
        st.student.path = path;
        st.student.goal = path.goalText || st.student.goal;
        Store._saveLocal(st);
        return Promise.resolve({ ok: true, local: true, state: Store._state(st) });
      }
      return Store.rpc('uni_path_set', { p_email: email, p_pin: pin, p_path: path });
    },

    events: function (email, pin) {
      if (Store.mode === 'local') return Promise.resolve({ ok: true, upcoming: [], past: [], local: true });
      return Store.rpc('uni_events_list', { p_email: email, p_pin: pin });
    },

    attend: function (email, pin, eventId) {
      return Store.rpc('uni_event_attend', { p_email: email, p_pin: pin, p_event: eventId });
    },

    feed: function () {
      if (Store.mode === 'local') {
        var s = Store._local();
        return Promise.resolve({ ok: true, wins: (s && s.wins) || [] });
      }
      return Store.rpc('uni_feed', { p_limit: 40 });
    },

    leaderboard: function (scope) {
      if (Store.mode === 'local') {
        var s = Store._local();
        if (!s) return Promise.resolve({ ok: true, rows: [] });
        return Promise.resolve({ ok: true, rows: [{ name: s.student.name, xp: s.student.xp, rank: rankFor(s.student.xp).name, me: true }] });
      }
      return Store.rpc('uni_leaderboard', { p_scope: scope || 'all' });
    },

    /* The day hq/university.sql is applied, a student who has been working in
       local mode has real progress sitting on their device and an empty account
       in the cloud. This replays one into the other, once, and then stops
       caring: lessons are idempotent server-side (XP pays once per lesson), so
       a replay that runs twice costs nothing. Wins are deliberately not
       replayed — a feed post dated to whenever the sync happened would be a
       small lie in a public timeline. */
    syncUp: function (email, pin) {
      var s = Store._local();
      if (Store.mode !== 'cloud' || !s || s.synced) return Promise.resolve(0);
      var lessons = Object.keys(s.done || {});
      var chain = Promise.resolve(), moved = 0;
      lessons.forEach(function (id) {
        chain = chain.then(function () {
          return Store.rpc('uni_lesson_done', { p_email: email, p_pin: pin, p_lesson: id, p_proof: (s.done[id] || {}).proof })
            .then(function (r) { if (r && r.ok) moved++; });
        });
      });
      ((s.days || {})[today()] || []).forEach(function (item) {
        chain = chain.then(function () {
          return Store.rpc('uni_check', { p_email: email, p_pin: pin, p_item: item, p_on: true });
        });
      });
      return chain.then(function () {
        s.synced = true; Store._saveLocal(s);
        return moved;
      }).catch(function () { return 0; });
    },

    /* Shape a local mirror into the same object the RPCs return, so every
       renderer below is written once against one shape. */
    _state: function (s) {
      var doneList = Object.keys(s.done).map(function (k) { return { lesson: k, at: s.done[k].at, proof: s.done[k].proof }; });
      return {
        student: s.student,
        done: doneList,
        today: s.days[today()] || [],
        wins: s.wins.slice(0, 20),
        leaderboard: [{ name: s.student.name, xp: s.student.xp, me: true }]
      };
    }
  };

  /* ------------------------------------------------------------------ state */
  var S = null;              // current state from the server (or mirror)
  var SESSION = null;        // {email, pin, name}
  var doneSet = {};          // lesson id -> {at, proof}

  /* The cloud RPCs return the state object itself ({ok, student, done, …});
     the local mirror wraps it as {ok, local, state}. Everything downstream
     wants one shape, so every response goes through here first. Getting this
     wrong is silent — the app signs in and then renders nothing. */
  function stateOf(r) {
    if (!r) return null;
    if (r.state && r.state.student) return r.state;
    if (r.student) return r;
    return null;
  }

  function absorb(state) {
    if (!state || !state.student) return;
    S = state;
    doneSet = {};
    (state.done || []).forEach(function (r) { doneSet[r.lesson] = { at: r.at, proof: r.proof }; });
    paintTop();
  }
  function saveSession(email, pin, name) {
    SESSION = { email: email, pin: pin, name: name };
    try { w.localStorage.setItem(SESSION_KEY, JSON.stringify(SESSION)); } catch (e) {}
  }
  function readSession() {
    try { return JSON.parse(w.localStorage.getItem(SESSION_KEY) || 'null'); } catch (e) { return null; }
  }
  function signOut() {
    try { w.localStorage.removeItem(SESSION_KEY); } catch (e) {}
    location.hash = '';
    location.reload();
  }

  /* ------------------------------------------------------------------- gate */
  function gateErr(msg) {
    var e = el('gateErr');
    if (!msg) { e.classList.add('hide'); return; }
    e.textContent = msg; e.classList.remove('hide');
    e.scrollIntoView({ block: 'nearest' });
  }
  function showJoin(on) {
    el('joinForm').classList.toggle('hide', !on);
    el('signinForm').classList.toggle('hide', on);
    el('gateTitle').innerHTML = on ? 'Enrol at <span class="shimmer">TB University</span>' : 'The <span class="shimmer">Campus</span>';
    el('gateSub').textContent = on
      ? 'Your enrolment code came with your welcome email. Two minutes and you are in.'
      : 'Members only. Sign in to pick up where you left off.';
    gateErr('');
  }

  function bootGate() {
    el('toJoin').addEventListener('click', function () { showJoin(true); });
    el('toSignin').addEventListener('click', function () { showJoin(false); });

    /* A code in the link (?code=…) is how the welcome email hands enrolment
       over without the student copying anything. */
    var q = new URLSearchParams(location.search);
    var code = (q.get('code') || q.get('c') || '').trim();
    if (code) {
      showJoin(true);
      var f = el('joinForm');
      if (!el('jCode')) {
        var wrapEl = d.createElement('div');
        wrapEl.className = 'field';
        wrapEl.innerHTML = '<label for="jCode">Enrolment code</label><input id="jCode" type="text" autocapitalize="characters" placeholder="TBU-XXXX">';
        f.insertBefore(wrapEl, f.firstChild);
      }
      el('jCode').value = code.toUpperCase();
    }

    el('signinForm').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var email = el('siEmail').value.trim(), pin = el('siPin').value.trim();
      if (!email || pin.length < 4) { gateErr('Email and your 4-digit PIN, please.'); return; }
      el('siBtn').disabled = true; el('siBtn').textContent = 'Checking…';
      Store.signin(email, pin).then(function (r) {
        el('siBtn').disabled = false; el('siBtn').textContent = 'Enter the campus →';
        if (!r || !r.ok) { gateErr((r && r.error) || 'That did not work. Check the email and PIN.'); return; }
        var st = stateOf(r);
        if (!st) { gateErr('Signed in, but the campus sent nothing back. Try again.'); return; }
        saveSession(email, pin, st.student.name || '');
        enter(st);
      });
    });

    el('joinForm').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var name = el('jName').value.trim(), email = el('jEmail').value.trim(),
          pin = el('jPin').value.trim(), goal = el('jGoal').value.trim(),
          code = el('jCode') ? el('jCode').value.trim() : '';
      if (name.length < 2) { gateErr('Your name, so the leaderboard knows who you are.'); return; }
      if (!/^\d{4}$/.test(pin)) { gateErr('Pick a 4-digit PIN — numbers only.'); return; }
      el('jBtn').disabled = true; el('jBtn').textContent = 'Enrolling…';
      Store.join(name, email, pin, goal, code).then(function (r) {
        el('jBtn').disabled = false; el('jBtn').textContent = 'Start day one →';
        if (!r || !r.ok) {
          gateErr((r && r.error) || 'Could not enrol you.');
          if (r && r.need_code && !el('jCode')) {
            var wrapEl = d.createElement('div');
            wrapEl.className = 'field';
            wrapEl.innerHTML = '<label for="jCode">Enrolment code</label><input id="jCode" type="text" autocapitalize="characters" placeholder="TBU-XXXX">'
              + '<div class="fine">Don\'t have one? <a href="/university/#apply">Join the next intake →</a></div>';
            el('joinForm').insertBefore(wrapEl, el('joinForm').firstChild);
            el('jCode').focus();
          }
          return;
        }
        var st = stateOf(r);
        if (!st) { gateErr('Enrolled, but the campus sent nothing back. Sign in to continue.'); return; }
        saveSession(email, pin, name);
        try { if (w.fbq) fbq('trackCustom', 'UniversityEnrolled', {}); } catch (e) {}
        enter(st);
        toast('Welcome in. Start with Foundations.', 'good');
      });
    });
  }

  function enter(state) {
    absorb(state);
    if (Store.mode === 'cloud' && SESSION) {
      Store.syncUp(SESSION.email, SESSION.pin).then(function (moved) {
        if (!moved) return;
        toast('Moved ' + moved + ' lesson' + (moved === 1 ? '' : 's') + ' from this device to your account.', 'good');
        refresh().then(function () { route(); });
      });
    }
    el('gate').classList.add('hide');
    el('shell').classList.remove('hide');
    /* Somebody who has not said what they are here for gets asked before they
       get handed a curriculum. One screen, and it is the difference between a
       course and a plan. */
    var hasPath = S.student && S.student.path && S.student.path.lessons && S.student.path.lessons.length;
    if (!hasPath) location.hash = '#/path';
    else if (!location.hash || location.hash === '#') location.hash = '#/home';
    route();
  }

  /* ---------------------------------------------------------------- chrome */
  function paintTop() {
    if (!S || !S.student) return;
    var st = S.student;
    el('topXp').textContent = (st.xp || 0).toLocaleString() + ' XP';
    el('topStreak').textContent = '🔥 ' + (st.streak || 0);
    el('topAvatar').textContent = initials(st.name);
  }

  function refresh() {
    if (!SESSION) return Promise.resolve();
    return Store.state(SESSION.email, SESSION.pin).then(function (r) {
      var st = stateOf(r);
      if (st) absorb(st);
    });
  }

  /* --------------------------------------------------------------- fragments */
  function progressRing(pct) {
    var r = 16, c = 2 * Math.PI * r, off = c * (1 - pct / 100);
    return '<div class="ring"><svg width="40" height="40" viewBox="0 0 40 40">'
      + '<circle cx="20" cy="20" r="' + r + '" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="3"></circle>'
      + '<circle cx="20" cy="20" r="' + r + '" fill="none" stroke="' + (pct >= 100 ? '#43f0b0' : '#ffd45a') + '" stroke-width="3" stroke-linecap="round"'
      + ' stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '"></circle></svg>'
      + '<span>' + Math.round(pct) + '%</span></div>';
  }
  function campusProgress(c) {
    var done = c.lessons.filter(function (l) { return doneSet[l.id]; }).length;
    return { done: done, total: c.lessons.length, pct: c.lessons.length ? (done / c.lessons.length) * 100 : 0 };
  }
  function nextLesson() {
    for (var i = 0; i < w.TBU_LESSONS.length; i++) if (!doneSet[w.TBU_LESSONS[i].lesson.id]) return w.TBU_LESSONS[i];
    return null;
  }
  /* Ticking a box re-renders the footer only. Re-running the whole view on
     every tap threw away the student's scroll position mid-list — and on a
     phone, where this is actually used, that is the difference between a
     checklist and an argument. */
  function dailyFootHtml() {
    var list = S.today || [], st = S.student, left = DAILY.length - list.length;
    if (left <= 0) {
      return '<div class="done-note">🔥 <b>All six done.</b> Streak: ' + (st.streak || 0)
        + ' days · best: ' + (st.best_streak || 0) + '. Now go and live your life.</div>';
    }
    return '<p class="fine" style="text-align:center;margin-top:12px">' + left + ' left today · +'
      + XP.daily + ' XP each, +' + XP.dailyAll + ' for the full set</p>';
  }
  function paintDailyFoot() {
    var box = el('dailyFoot');
    if (box) box.innerHTML = dailyFootHtml();
    var stat = d.querySelector('.stats div:nth-child(3) b');
    if (stat) stat.textContent = (S.today || []).length + '/' + DAILY.length;
  }

  function localBanner() {
    if (Store.mode !== 'local') return '';
    return '<div class="banner">📶 <b>This device only.</b> The campus database is not switched on yet, so your progress is saving locally. '
      + 'It moves to your account the moment it is live — nothing is lost.</div>';
  }

  /* ------------------------------------------------------------------ views */
  function viewHome() {
    var st = S.student, xp = st.xp || 0, r = rankFor(xp), nx = nextRank(xp);
    var pct = nx ? ((xp - r.at) / (nx.at - r.at)) * 100 : 100;
    var doneCount = Object.keys(doneSet).length;
    var todayList = S.today || [];
    var nl = nextLesson();
    var hour = new Date().getHours();
    var hi = hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening';

    var html = localBanner()
      + '<div class="rankcard"><div class="top2">'
      +   '<div class="badge">' + r.icon + '</div>'
      +   '<div class="who"><b>' + hi + ', ' + esc((st.name || '').split(' ')[0]) + '</b>'
      +     '<span>' + esc(r.name) + ' · ' + esc(r.blurb) + '</span></div>'
      + '</div>'
      + '<div class="bar"><i style="width:' + Math.max(3, Math.min(100, pct)) + '%"></i></div>'
      + '<div class="barlab"><span>' + xp.toLocaleString() + ' XP</span><span>'
      +   (nx ? (nx.at - xp).toLocaleString() + ' XP to ' + esc(nx.name) : 'Top rank — you built the thing') + '</span></div>'
      + '<div class="stats">'
      +   '<div><b>' + doneCount + '</b><span>of ' + w.TBU_TOTAL + ' lessons</span></div>'
      +   '<div><b>' + (st.streak || 0) + '</b><span>day streak</span></div>'
      +   '<div><b>' + todayList.length + '/' + DAILY.length + '</b><span>today</span></div>'
      +   '<div><b>' + (st.best_streak || 0) + '</b><span>best streak</span></div>'
      + '</div></div>';

    /* the one thing to do next */
    var mine = pathNext(3);
    if (mine && mine.length) {
      var path = S.student.path;
      html += '<div class="sechead"><h2>Your next moves</h2><button class="more" data-go="#/path">Change path</button></div>';
      mine.forEach(function (m, i) {
        html += '<button class="crow" data-go="#/lesson/' + m.lesson.id + '"'
          + (i === 0 ? ' style="border-color:var(--line2)"' : '') + '>'
          + '<div class="ic">' + m.icon + '</div>'
          + '<div class="bd"><b>' + esc(m.lesson.title) + '</b><span>' + esc(m.campusName) + ' &middot; ' + m.lesson.min + ' min</span></div>'
          + '<div class="go">' + (i === 0 ? '&rarr;' : '&middot;') + '</div></button>';
      });
      var leftOnPath = path.lessons.filter(function (id) { return !doneSet[id]; }).length;
      html += '<p class="fine" style="text-align:center">' + esc(path.goalText || 'your path') + ' &middot; '
        + leftOnPath + ' left &middot; about ' + Math.max(1, Math.ceil(leftOnPath / (path.perWeek || 4)))
        + ' weeks at your pace &middot; <a href="#/learn">or go anywhere</a></p>';
    } else if (nl) {
      html += '<div class="sechead"><h2>Pick up here</h2><button class="more" data-go="#/learn">All campuses</button></div>'
        + '<button class="crow" data-go="#/lesson/' + nl.lesson.id + '">'
        + '<div class="ic">' + nl.icon + '</div>'
        + '<div class="bd"><b>' + esc(nl.lesson.title) + '</b><span>' + esc(nl.campusName) + ' · lesson ' + (nl.index + 1) + ' · ' + nl.lesson.min + ' min</span></div>'
        + '<div class="go">→</div></button>';
    } else {
      html += '<div class="card"><h2>🎓 Every lesson done</h2><p class="muted" style="margin:6px 0 0;font-size:14.5px">'
        + 'All ' + w.TBU_TOTAL + ' missions completed. The checklist is the job now — keep the streak and post the wins.</p></div>';
    }

    /* today's checklist, compact */
    html += '<div class="sechead"><h2>Today</h2><button class="more" data-go="#/daily">Open checklist</button></div>';
    DAILY.slice(0, 3).forEach(function (it) {
      var on = todayList.indexOf(it.id) >= 0;
      html += '<button class="dayitem' + (on ? ' on' : '') + '" data-day="' + it.id + '">'
        + '<div class="box">' + (on ? '✓' : '') + '</div>'
        + '<div class="bd"><b>' + it.icon + ' ' + esc(it.label) + '</b><span>' + esc(it.hint) + '</span></div></button>';
    });
    html += '<div id="dailyFoot">' + dailyFootHtml() + '</div>';

    var brief = w.TBU_briefForWeek();
    html += '<div class="sechead"><h2>This week&rsquo;s build</h2></div>'
      + '<div class="card" style="border-color:rgba(185,139,255,.35)">'
      + '<div class="eyebrow" style="color:var(--vio)">Nobody asked you for this</div>'
      + '<h2>' + esc(brief.t) + '</h2>'
      + '<p class="muted" style="font-size:14.5px;margin:6px 0 0">' + esc(brief.d) + '</p>'
      + '<p class="fine" style="margin:10px 0 0">Every mission here is somebody else&rsquo;s idea. This one is not &mdash; '
      + 'post it in <a href="#/wins">Wins</a> when it exists.</p></div>';

    html += '<button class="crow" data-go="#/tools" style="margin-top:16px">'
      + '<div class="ic">🧰</div><div class="bd"><b>The toolstack</b>'
      + '<span>Loop, Content Studio, CRM, booking, reviews — licensed for your clients</span></div>'
      + '<div class="go">→</div></button>';

    html += '<div class="sechead"><h2>Wins from the campus</h2><button class="more" data-go="#/wins">All wins</button></div>'
      + '<div id="homeWins"><div class="empty">Loading…</div></div>';

    el('view').innerHTML = html;
    wire();
    Store.feed().then(function (r) {
      var wins = (r && r.wins) || [];
      var box = el('homeWins'); if (!box) return;
      box.innerHTML = wins.length
        ? wins.slice(0, 3).map(winHtml).join('')
        : '<div class="empty">No wins posted yet. Be the first — a booked call counts.</div>';
    });
  }

  /* --------------------------------------------------------------------- path
     The first thing a new student meets, and deliberately not lesson one. Three
     questions, answered in about twenty seconds, and the campus rearranges
     itself around the answers. It is a suggestion with a spine — nothing is
     locked, everything stays reachable from Campuses — but it means nobody
     opens this app and finds a syllabus starting at somebody else's beginning. */
  function viewPath(force) {
    var cur = (S.student && S.student.path) || null;
    var pick = { goal: (cur && cur.goal) || null, have: (cur && cur.have) || null, hours: (cur && cur.hours) || null };

    function row(kind, id, icon, title, sub, on) {
      return '<button class="crow" data-pick="' + kind + '" data-val="' + id + '"'
        + (on ? ' style="border-color:var(--line2);background:rgba(255,212,90,.06)"' : '') + '>'
        + (icon ? '<div class="ic">' + icon + '</div>' : '')
        + '<div class="bd"><b>' + esc(title) + '</b><span>' + esc(sub) + '</span></div>'
        + '<div class="go">' + (on ? '&#10003;' : '&rsaquo;') + '</div></button>';
    }

    function draw() {
      var html = '<div class="card tight"><div class="eyebrow">Your path</div>'
        + '<h2>' + ((cur && !force) ? 'Change what you are aiming at' : 'What are you actually here to do?') + '</h2>'
        + '<p class="muted" style="font-size:14px;margin:4px 0 0">Three questions. The campus builds your order out of your answers — '
        + 'and you can rewrite it whenever the plan changes, which it will.</p></div>';

      html += '<div class="sechead"><h2>1 &middot; In the next 90 days</h2></div>';
      w.TBU_GOALS.forEach(function (g) {
        html += row('goal', g.id, g.icon, g.label, g.lessons.length + ' lessons on this line', pick.goal === g.id);
      });

      html += '<div class="sechead"><h2>2 &middot; Where you are now</h2></div>';
      w.TBU_HAVE.forEach(function (h) {
        var sub = h.skip.length ? 'skips ' + h.skip.length + ' lesson' + (h.skip.length === 1 ? '' : 's') + ' you do not need'
                                : 'nothing skipped';
        html += row('have', h.id, '', h.label, sub, pick.have === h.id);
      });

      html += '<div class="sechead"><h2>3 &middot; Hours a week, honestly</h2></div>';
      w.TBU_HOURS.forEach(function (h) {
        html += row('hours', h.id, '', h.label, h.note, pick.hours === h.id);
      });

      var ready = pick.goal && pick.have && pick.hours;
      html += '<button class="btn wide" id="pathGo" style="margin-top:18px"' + (ready ? '' : ' disabled') + '>'
        + (ready ? 'Build my path' : 'Answer all three') + '</button>';
      if (cur) html += '<button class="btn plain wide" style="margin-top:10px" data-go="#/home">Keep the path I have</button>';
      html += '<p class="fine" style="text-align:center;margin-top:14px">Nothing is ever locked — '
        + '<a href="#/learn">all eight campuses stay open</a> whatever you pick.</p>';

      el('view').innerHTML = html;
      w.scrollTo(0, 0);
      wire();
      [].forEach.call(d.querySelectorAll('[data-pick]'), function (b) {
        b.addEventListener('click', function () {
          pick[b.getAttribute('data-pick')] = b.getAttribute('data-val');
          draw();
        });
      });
      var go = el('pathGo');
      if (go) go.addEventListener('click', function () {
        go.disabled = true; go.textContent = 'Saving...';
        var path = w.TBU_buildPath(pick.goal, pick.have, pick.hours);
        Store.setPath(SESSION.email, SESSION.pin, path).then(function (r) {
          var st = stateOf(r);
          if (st) absorb(st);
          else if (S.student) S.student.path = path;      /* local mode keeps it in memory */
          toast('Path set - ' + path.lessons.length + ' lessons, yours', 'good');
          location.hash = '#/home';
          route();
        });
      });
    }
    draw();
  }

  /* The next moves on the student's own path, not the next row in a list. */
  function pathNext(n) {
    var path = S.student && S.student.path;
    if (!path || !path.lessons) return null;
    return path.lessons.filter(function (id) { return !doneSet[id]; })
      .slice(0, n || 3)
      .map(function (id) { return lessonById(id); })
      .filter(Boolean);
  }

  function viewLearn() {
    var totalDone = Object.keys(doneSet).length;
    var html = localBanner()
      + '<div class="card tight"><div class="eyebrow">Your degree</div>'
      + '<h2>' + totalDone + ' of ' + w.TBU_TOTAL + ' lessons</h2>'
      + '<div class="bar blue"><i style="width:' + Math.max(2, (totalDone / w.TBU_TOTAL) * 100) + '%"></i></div>'
      + '<div class="barlab"><span>5 campuses</span><span>' + Math.round((totalDone / w.TBU_TOTAL) * 100) + '% complete</span></div></div>';

    CAMPUSES.forEach(function (c) {
      var p = campusProgress(c);
      html += '<button class="crow" data-go="#/campus/' + c.id + '">'
        + '<div class="ic">' + c.icon + '</div>'
        + '<div class="bd"><b>' + esc(c.name) + '</b><span>' + esc(c.blurb) + '</span></div>'
        + progressRing(p.pct) + '</button>';
    });
    el('view').innerHTML = html;
    wire();
  }

  function viewCampus(id) {
    var c = campusById(id);
    if (!c) { location.hash = '#/learn'; return; }
    var p = campusProgress(c);
    var html = '<button class="btn plain sm" data-go="#/learn">← Campuses</button>'
      + '<div class="card" style="margin-top:14px"><div class="eyebrow">' + esc(c.tag) + '</div>'
      + '<h2>' + c.icon + ' ' + esc(c.name) + '</h2>'
      + '<p class="muted" style="font-size:14.5px;margin:6px 0 12px">' + esc(c.blurb) + '</p>'
      + '<div class="bar"><i style="width:' + Math.max(2, p.pct) + '%"></i></div>'
      + '<div class="barlab"><span>' + p.done + ' of ' + p.total + ' done</span><span>' + (p.total * (XP.lesson + XP.mission)) + ' XP available</span></div></div>'
      + '<div class="card">';
    c.lessons.forEach(function (l, i) {
      var done = !!doneSet[l.id];
      html += '<button class="lrow' + (done ? ' done' : '') + '" data-go="#/lesson/' + l.id + '">'
        + '<div class="tick">' + (done ? '✓' : (i + 1)) + '</div>'
        + '<div class="bd"><b>' + esc(l.title) + '</b><span>' + l.min + ' min · mission included</span></div>'
        + '<div class="go">→</div></button>';
    });
    html += '</div>';
    el('view').innerHTML = html;
    wire();
  }

  function viewLesson(id) {
    var entry = lessonById(id);
    if (!entry) { location.hash = '#/learn'; return; }
    var l = entry.lesson, c = campusById(entry.campus);
    var done = doneSet[l.id];
    var idx = c.lessons.findIndex(function (x) { return x.id === l.id; });
    var prev = idx > 0 ? c.lessons[idx - 1] : null;
    var next = idx < c.lessons.length - 1 ? c.lessons[idx + 1] : null;

    var html = '<button class="btn plain sm" data-go="#/campus/' + c.id + '">← ' + esc(c.name) + '</button>'
      + '<div class="reader">'
      + '<div class="meta" style="margin-top:14px"><span class="chip">' + c.icon + ' ' + esc(c.name) + '</span>'
      +   '<span class="chip">Lesson ' + (idx + 1) + ' of ' + c.lessons.length + '</span>'
      +   '<span class="chip">' + l.min + ' min</span>'
      +   (done ? '<span class="chip gold">✓ Done</span>' : '') + '</div>'
      + '<h1>' + esc(l.title) + '</h1>'
      + '<div class="body">' + l.body + '</div>';

    if (done) {
      html += '<div class="done-note"><b>Mission complete.</b>'
        + (done.proof ? '<br><span class="muted" style="font-size:13.5px">You wrote: “' + esc(done.proof) + '”</span>' : '')
        + '</div>';
    } else {
      html += '<div class="mission"><div class="eyebrow">Your mission</div>'
        + '<p>' + esc(l.mission) + '</p>'
        + '<div class="field"><label for="proof">What happened?</label>'
        + '<textarea id="proof" placeholder="' + esc(l.ask) + '" maxlength="600"></textarea>'
        + '<div class="fine">Nobody marks this. It is here because writing down what you did is how you notice whether you did it.</div></div>'
        + '<button class="btn wide" id="doneBtn">Mark complete · +' + (XP.lesson + XP.mission) + ' XP</button></div>';
    }

    html += '<div class="navrow">'
      + (prev ? '<button class="btn ghost" data-go="#/lesson/' + prev.id + '">← Previous</button>' : '')
      + (next ? '<button class="btn ghost" data-go="#/lesson/' + next.id + '">Next lesson →</button>'
              : '<button class="btn ghost" data-go="#/learn">Back to campuses</button>')
      + '</div></div>';

    el('view').innerHTML = html;
    w.scrollTo(0, 0);
    wire();

    var db = el('doneBtn');
    if (db) db.addEventListener('click', function () {
      var proof = (el('proof').value || '').trim();
      if (proof.length < 8) {
        toast('Write a line about what actually happened first.', 'bad');
        el('proof').focus();
        return;
      }
      db.disabled = true; db.textContent = 'Saving…';
      Store.completeLesson(SESSION.email, SESSION.pin, l.id, proof).then(function (r) {
        if (!r || !r.ok) { db.disabled = false; db.textContent = 'Mark complete'; toast((r && r.error) || 'Could not save that.', 'bad'); return; }
        var st = stateOf(r);
        if (st) absorb(st); else { doneSet[l.id] = { at: new Date().toISOString(), proof: proof }; refresh(); }
        var gained = XP.lesson + XP.mission;
        toast('+' + gained + ' XP — mission logged', 'good');
        if (next) location.hash = '#/lesson/' + next.id; else viewLesson(l.id);
      });
    });
  }

  function viewDaily() {
    var todayList = S.today || [], st = S.student;
    var html = localBanner()
      + '<div class="card tight"><div class="eyebrow">The daily checklist</div>'
      + '<h2>🔥 ' + (st.streak || 0) + '-day streak</h2>'
      + '<p class="muted" style="font-size:14px;margin:4px 0 0">Six things a working agency owner does on a normal day. '
      + 'Finish all six and the streak grows. Miss a day and it goes back to zero — that is the point of it.</p></div>';

    DAILY.forEach(function (it) {
      var on = todayList.indexOf(it.id) >= 0;
      html += '<button class="dayitem' + (on ? ' on' : '') + '" data-day="' + it.id + '">'
        + '<div class="box">' + (on ? '✓' : '') + '</div>'
        + '<div class="bd"><b>' + it.icon + ' ' + esc(it.label) + '</b><span>' + esc(it.hint) + '</span></div></button>';
    });

    html += '<div id="dailyFoot">' + dailyFootHtml() + '</div>';

    html += '<div class="sechead"><h2>Leaderboard</h2></div>'
      + '<div class="seg"><button class="on" data-lb="week">This week</button><button data-lb="all">All time</button></div>'
      + '<div class="card" id="lbBox"><div class="empty">Loading…</div></div>';

    el('view').innerHTML = html;
    wire();
    loadLeaderboard('week');
    [].forEach.call(d.querySelectorAll('[data-lb]'), function (b) {
      b.addEventListener('click', function () {
        [].forEach.call(d.querySelectorAll('[data-lb]'), function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        loadLeaderboard(b.getAttribute('data-lb'));
      });
    });
  }

  function loadLeaderboard(scope) {
    Store.leaderboard(scope).then(function (r) {
      var box = el('lbBox'); if (!box) return;
      var rows = (r && r.rows) || [];
      if (!rows.length) { box.innerHTML = '<div class="empty">Nobody on the board yet. First lesson puts you on it.</div>'; return; }
      box.innerHTML = rows.map(function (row, i) {
        var medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
        return '<div class="lb' + (i < 3 ? ' top' : '') + (row.me ? ' me' : '') + '">'
          + '<div class="pos">' + medal + '</div>'
          + '<div class="nm">' + esc(row.name || 'Student') + '<em>' + esc(row.rank || rankFor(row.xp || 0).name) + '</em></div>'
          + '<div class="xp">' + (row.xp || 0).toLocaleString() + '</div></div>';
      }).join('');
    });
  }

  function winHtml(wn) {
    return '<div class="win"><div class="wh">'
      + '<div class="wa">' + esc(initials(wn.name)) + '</div>'
      + '<div><b>' + esc(wn.name || 'Student') + '</b><br><span>' + esc(ago(wn.at)) + (wn.rank ? ' · ' + esc(wn.rank) : '') + '</span></div>'
      + '</div><p>' + esc(wn.body) + '</p>'
      + (wn.amount ? '<span class="amt">💰 $' + Number(wn.amount).toLocaleString() + '</span>' : '') + '</div>';
  }

  function viewWins() {
    var html = localBanner()
      + '<div class="card"><div class="eyebrow">Post a win</div>'
      + '<h2>What went right?</h2>'
      + '<p class="muted" style="font-size:14px;margin:4px 0 12px">A reply, a booked call, a signed client, a shop that said yes. '
      + 'Small ones count — they are what the next person needs to see.</p>'
      + '<div class="field"><textarea id="winBody" placeholder="Closed my second shop at $500/mo — the free Google audit did it." maxlength="500"></textarea></div>'
      + '<div class="field"><label for="winAmt">Money involved (optional)</label>'
      + '<input id="winAmt" type="number" inputmode="numeric" min="0" step="1" placeholder="500"></div>'
      + '<button class="btn wide" id="winBtn">Post it · +' + XP.win + ' XP</button></div>'
      + '<div class="sechead"><h2>The feed</h2></div>'
      + '<div id="feed"><div class="empty">Loading…</div></div>';
    el('view').innerHTML = html;
    wire();

    el('winBtn').addEventListener('click', function () {
      var body = (el('winBody').value || '').trim();
      var amt = parseFloat(el('winAmt').value || '') || null;
      if (body.length < 10) { toast('Say what happened — a sentence is enough.', 'bad'); return; }
      var b = el('winBtn'); b.disabled = true; b.textContent = 'Posting…';
      Store.postWin(SESSION.email, SESSION.pin, body, amt).then(function (r) {
        b.disabled = false; b.textContent = 'Post it · +' + XP.win + ' XP';
        if (!r || !r.ok) { toast((r && r.error) || 'Could not post that.', 'bad'); return; }
        var st = stateOf(r);
        if (st) absorb(st);
        el('winBody').value = ''; el('winAmt').value = '';
        toast('Posted. +' + XP.win + ' XP', 'good');
        loadFeed();
        refresh();
      });
    });
    loadFeed();
  }

  function loadFeed() {
    Store.feed().then(function (r) {
      var box = el('feed'); if (!box) return;
      var wins = (r && r.wins) || [];
      box.innerHTML = wins.length ? wins.map(winHtml).join('')
        : '<div class="empty">Quiet in here. Post the first one.</div>';
    });
  }

  /* ---------------------------------------------------------------- live ---
     The call runs inside the campus rather than on a link somewhere else. Two
     reasons: a student who has to leave to attend often does not come back in
     the same session, and attendance recorded here is the only honest signal of
     who is actually turning up — which is worth more to the school than any
     lesson-completion number.

     The room is a public Jitsi room, so the room NAME is the entire access
     control. The server only includes it in the payload while the call is
     open, and the iframe is the only place it appears. Do not "helpfully"
     render it as text somewhere; a screenshot of a room name is a way in. */
  function whenText(iso, minutes) {
    var t = Date.parse(iso), now = Date.now(), diff = t - now;
    var when = new Date(t).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
    if (diff > 0 && diff < 86400000) {
      var h = Math.floor(diff / 3600000), m = Math.round((diff % 3600000) / 60000);
      return when + ' · in ' + (h ? h + 'h ' : '') + m + 'm';
    }
    if (diff <= 0 && now < t + (minutes || 60) * 60000) return when + ' · live now';
    return when;
  }
  function calendarLink(ev) {
    var start = new Date(Date.parse(ev.starts_at)), end = new Date(Date.parse(ev.starts_at) + (ev.minutes || 60) * 60000);
    function z(dt) { return dt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE'
      + '&text=' + encodeURIComponent('TB University — ' + ev.title)
      + '&dates=' + z(start) + '/' + z(end)
      + '&details=' + encodeURIComponent((ev.description || '') + '\n\nJoin at https://tbsol.net/university/campus/#/live');
  }

  function viewLive() {
    if (Store.mode === 'local') {
      el('view').innerHTML = localBanner()
        + '<div class="card"><h2>📡 Live calls</h2><p class="muted" style="font-size:14.5px;margin:6px 0 0">'
        + 'The call schedule lives in the campus database, which is not switched on yet. '
        + 'Once it is, calls open right here — no download, no separate link.</p></div>';
      return;
    }
    el('view').innerHTML = '<div class="card"><div class="empty">Loading the schedule…</div></div>';
    Store.events(SESSION.email, SESSION.pin).then(function (r) {
      if (!r || !r.ok) {
        el('view').innerHTML = '<div class="card"><div class="empty">' + esc((r && r.error) || 'Could not load the calls.') + '</div></div>';
        return;
      }
      var up = r.upcoming || [], past = r.past || [];
      var html = '<div class="card tight"><div class="eyebrow">Live</div><h2>Calls in the campus</h2>'
        + '<p class="muted" style="font-size:14px;margin:4px 0 0">Camera on if you can. Bring one real thing you are stuck on — '
        + 'the calls where people bring specifics are the ones worth turning up to.</p></div>';

      if (!up.length) {
        html += '<div class="card"><div class="empty">Nothing scheduled right now. Replays are below.</div></div>';
      }
      up.forEach(function (ev, i) {
        html += '<div class="card"' + (i === 0 ? ' style="border-color:var(--line2)"' : '') + '>'
          + '<div class="eyebrow">' + (ev.joinable ? '🔴 Open now' : (i === 0 ? 'Next up' : 'Later')) + '</div>'
          + '<h2>' + esc(ev.title) + '</h2>'
          + '<p class="muted" style="font-size:13.5px;margin:2px 0 8px">' + esc(whenText(ev.starts_at, ev.minutes))
          + ' · ' + (ev.minutes || 60) + ' min · with ' + esc(ev.host || 'Nick') + '</p>'
          + (ev.description ? '<p style="font-size:14.5px;margin:0 0 12px">' + esc(ev.description) + '</p>' : '')
          + (ev.attended ? '<span class="chip gold" style="margin-bottom:10px;display:inline-flex">✓ You were here</span><br>' : '')
          + (ev.joinable
              ? '<button class="btn wide" data-join="' + esc(ev.id) + '">Join the call →</button>'
              : '<a class="btn ghost wide" href="' + esc(calendarLink(ev)) + '" target="_blank" rel="noopener">Add to calendar</a>')
          + '</div>';
      });

      if (past.length) {
        html += '<div class="sechead"><h2>Replays</h2></div><div class="card">';
        past.forEach(function (ev) {
          var when = new Date(Date.parse(ev.starts_at)).toLocaleDateString();
          html += ev.replay_url
            ? '<a class="lrow" href="' + esc(ev.replay_url) + '" target="_blank" rel="noopener">'
              + '<div class="tick">▶</div><div class="bd"><b>' + esc(ev.title) + '</b><span>' + esc(when)
              + (ev.attended ? ' · you were there' : '') + '</span></div><div class="go">→</div></a>'
            : '<div class="lrow" style="cursor:default"><div class="tick">·</div><div class="bd"><b>' + esc(ev.title)
              + '</b><span>' + esc(when) + ' · replay not posted</span></div></div>';
        });
        html += '</div>';
      }

      html += '<div id="room"></div>';
      el('view').innerHTML = html;
      wire();

      [].forEach.call(d.querySelectorAll('[data-join]'), function (b) {
        b.addEventListener('click', function () {
          b.disabled = true; b.textContent = 'Opening…';
          Store.attend(SESSION.email, SESSION.pin, b.getAttribute('data-join')).then(function (rr) {
            b.disabled = false; b.textContent = 'Join the call →';
            if (!rr || !rr.ok || !rr.room) { toast((rr && rr.error) || 'Could not open that room.', 'bad'); return; }
            var st = stateOf(rr);
            if (st) absorb(st);
            openRoom(rr.room);
          });
        });
      });
    });
  }

  function openRoom(room) {
    var name = encodeURIComponent('"' + String((S.student && S.student.name) || 'Student').replace(/"/g, '') + '"');
    var src = 'https://meet.jit.si/' + encodeURIComponent(room) + '#userInfo.displayName=' + name;
    var box = el('room');
    if (!box) return;
    box.innerHTML = '<div class="sechead"><h2>You are in</h2>'
      + '<button class="more" id="leaveRoom">Leave</button></div>'
      + '<div class="roomwrap"><iframe src="' + esc(src) + '" allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write"'
      + ' allowfullscreen title="TB University live call"></iframe></div>'
      + '<p class="fine" style="text-align:center;margin-top:8px">Trouble with the embed? '
      + '<a href="' + esc(src) + '" target="_blank" rel="noopener">Open it in a new tab →</a></p>';
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el('leaveRoom').addEventListener('click', function () { box.innerHTML = ''; });
  }

  /* The toolstack is the reason the membership is worth what it costs: a
     student is not buying lessons, they are buying software they can resell
     to a shop on Monday. Every link here is a live tool on this estate. */
  var TOOLS = [
    { ic: '🔁', name: 'Loop Rewards', desc: 'Loyalty you run for a shop in 20 minutes — white-label, at your own price.', href: '/rewards/' },
    { ic: '🛍️', name: 'Storefront builder', desc: 'A full store for a client in ten minutes. One file, any host.', href: '/kit/storefront/' },
    { ic: '📩', name: 'Compliant lead forms', desc: 'Lead capture whose SMS opt-in passes A2P review first time.', href: '/kit/leadform/' },
    { ic: '🎬', name: 'Content Studio', desc: 'Batch a client month of posts and captions.', href: '/content-studio/' },
    { ic: '📇', name: 'The CRM', desc: 'Your walk list, joined to what the platform knows.', href: '/crm/' },
    { ic: '📅', name: 'Booking', desc: 'Give a shop a booking page and chair calendar.', href: '/booking/' },
    { ic: '⭐', name: 'Reviews', desc: 'One-tap review capture — QR, link, poster.', href: '/review/' },
    { ic: '🤝', name: 'Ambassadors', desc: 'Referral programme you can run for any client.', href: '/ambassadors/' },
    { ic: '📣', name: 'Marketing Engine', desc: 'Campaigns, blasts and win-backs.', href: '/marketing-engine/' },
    { ic: '🧰', name: 'First-client toolkit', desc: 'Scripts, the niche sheet, the call framework.', href: '/university/toolkit/' },
    { ic: '📕', name: 'Playbooks', desc: 'Slow-week playbook, GBP guide, win-back guide.', href: '/guides/' }
  ];

  function viewTools() {
    var html = '<div class="card tight"><div class="eyebrow">Included with your membership</div>'
      + '<h2>The toolstack</h2>'
      + '<p class="muted" style="font-size:14px;margin:4px 0 0">This is the part a course cannot give you. Every tool below is live software '
      + 'you can put in front of a paying client this week. Loop, the storefront and the lead forms are all '
      + 'white-label — the shop never sees this school, they see your business.</p></div>';
    TOOLS.forEach(function (t) {
      html += '<a class="tool" href="' + t.href + '"><div class="ic">' + t.ic + '</div>'
        + '<div class="bd"><b>' + esc(t.name) + '</b><span>' + esc(t.desc) + '</span></div><div class="go">→</div></a>';
    });
    html += '<div class="sechead"><h2>Your membership</h2></div>'
      + '<div class="card"><div class="lb"><div class="nm">Name<em>' + esc(S.student.name || '') + '</em></div></div>'
      + '<div class="lb"><div class="nm">Email<em>' + esc(S.student.email || SESSION.email) + '</em></div></div>'
      + (S.student.goal ? '<div class="lb"><div class="nm">Your goal<em>' + esc(S.student.goal) + '</em></div></div>' : '')
      + '<div class="lb"><div class="nm">Rank<em>' + esc(rankFor(S.student.xp || 0).name) + ' · ' + (S.student.xp || 0).toLocaleString() + ' XP</em></div></div>'
      + (S.student.plan ? '<div class="lb"><div class="nm">Plan<em>' + esc(S.student.plan) + (S.student.paid_until ? ' · paid to ' + esc(S.student.paid_until) : '') + '</em></div></div>' : '')
      + '</div>'
      + '<button class="btn plain wide" id="soBtn">Sign out</button>'
      + '<p class="fine" style="text-align:center;margin-top:14px">Need help? <a href="/support/">Support</a> · <a href="/university/">TB University</a></p>';
    el('view').innerHTML = html;
    wire();
    el('soBtn').addEventListener('click', signOut);
  }

  /* ----------------------------------------------------------------- wiring */
  function wire() {
    [].forEach.call(d.querySelectorAll('[data-go]'), function (b) {
      b.addEventListener('click', function () { location.hash = b.getAttribute('data-go'); });
    });
    [].forEach.call(d.querySelectorAll('[data-day]'), function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-day');
        var on = !b.classList.contains('on');
        b.classList.toggle('on', on);                       // optimistic: a tap should never wait on a network
        b.querySelector('.box').textContent = on ? '✓' : '';
        Store.toggleDaily(SESSION.email, SESSION.pin, id, on).then(function (r) {
          if (!r || !r.ok) {
            b.classList.toggle('on', !on);
            b.querySelector('.box').textContent = !on ? '✓' : '';
            toast((r && r.error) || 'Could not save that.', 'bad');
            return;
          }
          var before = (S.student && S.student.streak) || 0;
          var st = stateOf(r);
          if (st) absorb(st);
          var after = (S.student && S.student.streak) || 0;
          if (after > before) toast('🔥 Day complete — streak ' + after, 'good');
          paintDailyFoot();
        });
      });
    });
  }

  /* ------------------------------------------------------------------ router */
  function route() {
    var h = (location.hash || '#/home').replace(/^#\//, '');
    var parts = h.split('/');
    var view = parts[0] || 'home';
    [].forEach.call(d.querySelectorAll('#tabs a'), function (a) {
      var v = a.getAttribute('data-view');
      a.classList.toggle('on', v === view || (view === 'campus' && v === 'learn') || (view === 'lesson' && v === 'learn'));
    });
    if (view === 'home') return viewHome();
    if (view === 'learn') return viewLearn();
    if (view === 'campus') return viewCampus(parts[1]);
    if (view === 'lesson') return viewLesson(parts[1]);
    if (view === 'daily') return viewDaily();
    if (view === 'path') return viewPath(true);
    if (view === 'live') return viewLive();
    if (view === 'wins') return viewWins();
    if (view === 'tools') return viewTools();
    location.hash = '#/home';
  }

  /* -------------------------------------------------------------------- boot */
  function boot() {
    bootGate();
    el('topAvatar').addEventListener('click', function () { location.hash = '#/tools'; });
    w.addEventListener('hashchange', function () { if (S) route(); });

    var s = readSession();
    if (!s || !s.email || !s.pin) return;                    // straight to the gate
    el('siEmail').value = s.email;
    Store.state(s.email, s.pin).then(function (r) {
      var st = stateOf(r);
      if (st) { SESSION = s; enter(st); }
      else if (r && r.error) { gateErr(r.error); }
    });
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot); else boot();
})(window, document);
