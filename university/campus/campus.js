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
  /* coursework XP lives in its own file so the two data files stay independent */
  if (w.TBU_XP_WORK) { for (var k in w.TBU_XP_WORK) XP[k] = w.TBU_XP_WORK[k]; }

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

    /* ---- coursework ----------------------------------------------------- */
    work: function (email, pin) {
      if (Store.mode === 'local') {
        var s = Store._local() || Store._blank('', email, '');
        return Promise.resolve({ ok: true, local: true,
          checks: s.checks || {}, exams: s.exams || [], builds: s.builds || {} });
      }
      return Store.rpc('uni_work', { p_email: email, p_pin: pin });
    },

    checkSave: function (email, pin, lesson, correct, total) {
      if (Store.mode === 'local') {
        var s = Store._local() || Store._blank('', email, '');
        s.checks = s.checks || {};
        var prev = s.checks[lesson] ? s.checks[lesson].best : -1;
        s.checks[lesson] = { best: Math.max(prev, correct), total: total,
                             attempts: ((s.checks[lesson] || {}).attempts || 0) + 1 };
        if (correct >= total && prev < total) s.student.xp += XP.check;
        Store._saveLocal(s);
        return Promise.resolve({ ok: true, local: true, state: Store._state(s) });
      }
      return Store.rpc('uni_check_save', { p_email: email, p_pin: pin, p_lesson: lesson, p_correct: correct, p_total: total });
    },

    examSubmit: function (email, pin, campus, score, total, pass) {
      if (Store.mode === 'local') {
        var s = Store._local() || Store._blank('', email, '');
        s.exams = s.exams || [];
        var had = s.exams.some(function (e) { return e.campus === campus && e.passed; });
        var passed = score >= pass;
        s.exams.unshift({ campus: campus, score: score, total: total, passed: passed, at: new Date().toISOString() });
        if (passed && !had) s.student.xp += XP.exam;
        Store._saveLocal(s);
        return Promise.resolve({ ok: true, local: true, passed: passed, score: score, total: total,
                                 first_pass: (passed && !had), state: Store._state(s) });
      }
      return Store.rpc('uni_exam_submit', { p_email: email, p_pin: pin, p_campus: campus,
                                            p_score: score, p_total: total, p_pass: pass });
    },

    buildSave: function (email, pin, build, step, content, stepsTotal) {
      if (Store.mode === 'local') {
        var s = Store._local() || Store._blank('', email, '');
        s.builds = s.builds || {}; s.builds[build] = s.builds[build] || {};
        var isNew = !s.builds[build][step];
        if (!content) { delete s.builds[build][step]; Store._saveLocal(s); return Promise.resolve({ ok: true, cleared: true }); }
        s.builds[build][step] = content;
        if (isNew) s.student.xp += XP.buildStep;
        var done = Object.keys(s.builds[build]).length;
        s.paidBuilds = s.paidBuilds || {};
        if (stepsTotal && done >= stepsTotal && !s.paidBuilds[build]) {
          s.paidBuilds[build] = true; s.student.xp += XP.buildDone;
        }
        Store._saveLocal(s);
        return Promise.resolve({ ok: true, saved: true, state: Store._state(s) });
      }
      return Store.rpc('uni_build_save', { p_email: email, p_pin: pin, p_build: build,
                                           p_step: step, p_content: content, p_steps_total: stepsTotal || null });
    },

    /* Announcements + lesson overrides, same for every student, no auth. */
    content: function () {
      if (Store.mode === 'local') return Promise.resolve({ ok: true, announcements: [], overrides: {} });
      return Store.rpc('uni_content', {});
    },

    /* ---- money ---------------------------------------------------------- */
    money: function (email, pin) {
      if (Store.mode === 'local') {
        var s = Store._local() || Store._blank('', email, '');
        var cs = s.clients || [];
        var earned = cs.reduce(function (a, c) { return a + localEarned(c); }, 0);
        var mrr = cs.filter(function (c) { return !c.ended_on; }).reduce(function (a, c) { return a + (+c.monthly || 0); }, 0);
        return Promise.resolve({ ok: true, local: true, clients: cs.map(function (c) {
          return { id: c.id, name: c.name, monthly: c.monthly, setup: c.setup, started_on: c.started_on,
                   ended_on: c.ended_on, earned: localEarned(c), active: !c.ended_on };
        }), mrr: mrr, earned: earned, active: cs.filter(function (c) { return !c.ended_on; }).length, total: cs.length });
      }
      return Store.rpc('uni_money', { p_email: email, p_pin: pin });
    },

    clientAdd: function (email, pin, name, monthly, setup, started, note) {
      if (Store.mode === 'local') {
        var s = Store._local() || Store._blank('', email, '');
        s.clients = s.clients || [];
        s.clients.push({ id: 'l' + Date.now(), name: name, monthly: monthly || 0, setup: setup || 0,
                         started_on: started || today(), ended_on: null, note: note || '' });
        Store._saveLocal(s);
        return Store.money(email, pin);
      }
      return Store.rpc('uni_client_add', { p_email: email, p_pin: pin, p_name: name,
        p_monthly: monthly, p_setup: setup, p_started: started, p_note: note });
    },

    clientEnd: function (email, pin, id) {
      if (Store.mode === 'local') {
        var s = Store._local() || Store._blank('', email, '');
        (s.clients || []).forEach(function (c) { if (c.id === id) c.ended_on = today(); });
        Store._saveLocal(s);
        return Store.money(email, pin);
      }
      return Store.rpc('uni_client_end', { p_email: email, p_pin: pin, p_id: id });
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
    loadWork().then(loadMoney).then(loadContent).then(function () { if (S) route(); });
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

    var html = localBanner();
    (CONTENT.announcements || []).slice(0, 2).forEach(function (an) {
      html += '<div class="card" style="border-color:var(--line2);background:radial-gradient(circle at 8% 0%,rgba(255,212,90,.1),transparent 45%),linear-gradient(160deg,rgba(255,255,255,.05),rgba(255,255,255,.015))">'
        + '<div class="eyebrow">&#128227; From Nick &middot; ' + esc(ago(an.at)) + '</div>'
        + '<h2 style="font-size:17px;margin:4px 0 4px">' + esc(an.title) + '</h2>'
        + '<p class="muted" style="font-size:14px;margin:0;white-space:pre-wrap">' + esc(an.body) + '</p></div>';
    });
    html += '<div class="rankcard"><div class="top2">'
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

    if (MONEY) {
      html += '<button class="crow" data-go="#/money" style="margin-top:16px;border-color:rgba(67,240,176,.35)">'
        + '<div class="ic">&#128176;</div>'
        + '<div class="bd"><b>' + money(MONEY.earned) + ' earned</b><span>'
        + (MONEY.active ? money(MONEY.mrr) + '/mo from ' + MONEY.active + ' client' + (MONEY.active === 1 ? '' : 's')
                        : 'No clients logged yet — log the first one the day it happens')
        + '</span></div><div class="go">&rarr;</div></button>';
    }

    var wt = workTotals();
    html += '<button class="crow" data-go="#/workbook" style="margin-top:16px">'
      + '<div class="ic">&#128214;</div>'
      + '<div class="bd"><b>Your workbook</b><span>' + wt.buildSteps + '/' + wt.buildStepsTotal + ' sections &middot; '
      + wt.examsPassed + '/' + wt.examsTotal + ' exams &middot; ' + wt.checksPassed + '/' + wt.checksTotal + ' checks</span></div>'
      + '<div class="go">&rarr;</div></button>';

    var brief = w.TBU_briefForWeek();
    html += '<div class="sechead"><h2>This week&rsquo;s build</h2></div>'
      + '<div class="card" style="border-color:rgba(185,139,255,.35)">'
      + '<div class="eyebrow" style="color:var(--vio)">Nobody asked you for this</div>'
      + '<h2>' + esc(brief.t) + '</h2>'
      + '<p class="muted" style="font-size:14.5px;margin:6px 0 0">' + esc(brief.d) + '</p>'
      + '<p class="fine" style="margin:10px 0 0">Every mission here is somebody else&rsquo;s idea. This one is not &mdash; '
      + 'post it in <a href="#/wins">Wins</a> when it exists.</p></div>';

    var cs = w.TBU_caseForWeek && w.TBU_caseForWeek();
    if (cs) {
      html += '<div class="sechead"><h2>This week&rsquo;s case file</h2><button class="more" data-go="#/library">All ' + w.TBU_CASES.length + '</button></div>'
        + '<button class="crow" data-go="#/case/' + cs.id + '">'
        + '<div class="ic">&#128213;</div>'
        + '<div class="bd"><b>' + esc(cs.title) + '</b><span>' + esc(cs.lesson) + '</span></div>'
        + '<div class="go">&rarr;</div></button>';
    }

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

  /* ------------------------------------------------------------- coursework
     WORK holds checks, exam results and saved build steps. It is fetched once
     on the way in and patched locally after every save, so opening a lesson
     never waits on a round trip to find out whether the check was already
     passed. */
  var WORK = { checks: {}, exams: [], builds: {} };

  function loadWork() {
    if (!SESSION) return Promise.resolve();
    return Store.work(SESSION.email, SESSION.pin).then(function (r) {
      if (r && r.ok) WORK = { checks: r.checks || {}, exams: r.exams || [], builds: r.builds || {} };
    });
  }
  function checkState(lessonId) {
    var qs = w.TBU_checksFor(lessonId);
    if (!qs) return null;
    var got = WORK.checks[lessonId];
    return { qs: qs, passed: !!(got && got.best >= qs.length), best: got ? got.best : null, total: qs.length };
  }
  function examState(campusId) {
    var ex = w.TBU_examFor(campusId);
    if (!ex) return null;
    var mine = (WORK.exams || []).filter(function (e) { return e.campus === campusId; });
    var best = mine.reduce(function (a, e) { return Math.max(a, e.score || 0); }, 0);
    return { ex: ex, passed: mine.some(function (e) { return e.passed; }), attempts: mine.length, best: best };
  }
  function buildState(campusId) {
    var b = w.TBU_buildFor(campusId);
    if (!b) return null;
    var saved = WORK.builds[campusId] || {};
    var done = b.steps.filter(function (st) { return saved[st.id]; }).length;
    return { b: b, saved: saved, done: done, total: b.steps.length, complete: done >= b.steps.length };
  }
  function workTotals() {
    var checksPassed = 0, examsPassed = 0, buildSteps = 0, buildStepsTotal = 0;
    w.TBU_LESSONS.forEach(function (l) { var c = checkState(l.lesson.id); if (c && c.passed) checksPassed++; });
    CAMPUSES.forEach(function (c) {
      var e = examState(c.id); if (e && e.passed) examsPassed++;
      var b = buildState(c.id); if (b) { buildSteps += b.done; buildStepsTotal += b.total; }
    });
    return { checksPassed: checksPassed, checksTotal: w.TBU_LESSONS.length,
             examsPassed: examsPassed, examsTotal: CAMPUSES.length,
             buildSteps: buildSteps, buildStepsTotal: buildStepsTotal };
  }

  /* ---- the check, rendered under a lesson ---- */
  function mountCheck(lessonId, box) {
    var st = checkState(lessonId);
    if (!st || !box) return;
    var answers = {}, revealed = {};

    function draw() {
      var done = Object.keys(revealed).length === st.qs.length;
      var correct = st.qs.filter(function (q, i) { return revealed[i] && answers[i] === q.c; }).length;
      var html = '<div class="check"><div class="eyebrow" style="color:var(--acc2)">Check yourself</div>'
        + '<p class="muted" style="font-size:13.5px;margin:4px 0 14px">Two questions. Nobody is grading you — but reading feels like understanding '
        + 'right up until you have to choose.' + (st.passed ? ' <b style="color:var(--good)">You have passed this one.</b>' : '') + '</p>';
      st.qs.forEach(function (q, i) {
        html += '<div class="q"><b>' + (i + 1) + '. ' + esc(q.q) + '</b>';
        q.a.forEach(function (opt, j) {
          var cls = '';
          if (revealed[i]) {
            if (j === q.c) cls = ' right';
            else if (answers[i] === j) cls = ' wrong';
          } else if (answers[i] === j) cls = ' picked';
          html += '<button class="opt' + cls + '" data-q="' + i + '" data-o="' + j + '"' + (revealed[i] ? ' disabled' : '') + '>'
            + esc(opt) + '</button>';
        });
        if (revealed[i]) {
          html += '<div class="why' + (answers[i] === q.c ? ' ok' : '') + '">'
            + (answers[i] === q.c ? '<b>Right.</b> ' : '<b>Not quite.</b> ') + esc(q.why) + '</div>';
        }
        html += '</div>';
      });
      if (done) {
        html += '<div class="done-note" style="margin-top:4px">' + correct + ' of ' + st.qs.length
          + (correct === st.qs.length ? ' — clean.' + (st.passed ? '' : ' <b>+' + XP.check + ' XP</b>') : ' — read the explanations and go again.')
          + (correct < st.qs.length ? ' <button class="btn plain sm" id="retryCheck" style="margin-left:8px">Try again</button>' : '')
          + '</div>';
      }
      html += '</div>';
      box.innerHTML = html;

      [].forEach.call(box.querySelectorAll('.opt'), function (b) {
        b.addEventListener('click', function () {
          var i = +b.getAttribute('data-q');
          if (revealed[i]) return;
          answers[i] = +b.getAttribute('data-o');
          revealed[i] = true;
          if (Object.keys(revealed).length === st.qs.length) {
            var got = st.qs.filter(function (q, k) { return answers[k] === q.c; }).length;
            Store.checkSave(SESSION.email, SESSION.pin, lessonId, got, st.qs.length).then(function (r) {
              var s2 = stateOf(r); if (s2) absorb(s2);
              WORK.checks[lessonId] = { best: Math.max((WORK.checks[lessonId] || {}).best || 0, got), total: st.qs.length };
              if (got === st.qs.length && !st.passed) { toast('+' + XP.check + ' XP', 'good'); st.passed = true; }
            });
          }
          draw();
        });
      });
      var retry = el('retryCheck');
      if (retry) retry.addEventListener('click', function () { answers = {}; revealed = {}; draw(); });
    }
    draw();
  }

  /* ---- the exam ---- */
  function viewExam(campusId) {
    var st = examState(campusId), c = campusById(campusId);
    if (!st || !c) { location.hash = '#/learn'; return; }
    var picks = {}, submitted = false, result = null;

    function draw() {
      var html = '<button class="btn plain sm" data-go="#/campus/' + c.id + '">&larr; ' + esc(c.name) + '</button>'
        + '<div class="card" style="margin-top:14px;border-color:var(--line2)">'
        + '<div class="eyebrow">Campus exam</div><h2>' + esc(st.ex.title) + '</h2>'
        + '<p class="muted" style="font-size:14px;margin:6px 0 0">' + st.ex.questions.length + ' questions, '
        + st.ex.pass + ' to pass. Retake as many times as you like — this is a diagnostic, not a record. '
        + 'Pass it and you carry the title <b>' + esc(st.ex.title_earned) + '</b>.</p>'
        + (st.passed ? '<p style="margin:10px 0 0"><span class="chip gold">&#10003; Passed</span></p>'
                     : (st.attempts ? '<p class="fine" style="margin:10px 0 0">' + st.attempts + ' attempt'
                          + (st.attempts === 1 ? '' : 's') + ' · best ' + st.best + '/' + st.ex.questions.length + '</p>' : ''))
        + '</div>';

      st.ex.questions.forEach(function (q, i) {
        html += '<div class="card q"><b>' + (i + 1) + '. ' + esc(q.q) + '</b>';
        q.a.forEach(function (opt, j) {
          var cls = '';
          if (submitted) {
            if (j === q.c) cls = ' right';
            else if (picks[i] === j) cls = ' wrong';
          } else if (picks[i] === j) cls = ' picked';
          html += '<button class="opt' + cls + '" data-q="' + i + '" data-o="' + j + '"' + (submitted ? ' disabled' : '') + '>'
            + esc(opt) + '</button>';
        });
        if (submitted) html += '<div class="why' + (picks[i] === q.c ? ' ok' : '') + '">' + esc(q.why) + '</div>';
        html += '</div>';
      });

      if (!submitted) {
        var answered = Object.keys(picks).length;
        html += '<button class="btn wide" id="examGo"' + (answered < st.ex.questions.length ? ' disabled' : '') + '>'
          + (answered < st.ex.questions.length ? (st.ex.questions.length - answered) + ' left' : 'Submit the exam') + '</button>';
      } else {
        html += '<div class="' + (result.passed ? 'done-note' : 'banner') + '" style="margin-top:6px">'
          + '<b>' + result.score + ' of ' + result.total + '.</b> '
          + (result.passed ? ('Passed' + (result.first_pass ? ' — +' + XP.exam + ' XP and the title is yours.' : ' again.'))
                           : ('You needed ' + st.ex.pass + '. Read the explanations above, then go again — it costs nothing.'))
          + '</div>'
          + '<div class="navrow"><button class="btn ghost" id="examAgain">Take it again</button>'
          + '<button class="btn ghost" data-go="#/campus/' + c.id + '">Back to ' + esc(c.name) + '</button></div>';
      }

      el('view').innerHTML = html;
      w.scrollTo(0, 0);
      wire();
      [].forEach.call(d.querySelectorAll('.opt'), function (b) {
        b.addEventListener('click', function () {
          if (submitted) return;
          picks[+b.getAttribute('data-q')] = +b.getAttribute('data-o');
          draw();
        });
      });
      var go = el('examGo');
      if (go) go.addEventListener('click', function () {
        var score = st.ex.questions.filter(function (q, i) { return picks[i] === q.c; }).length;
        go.disabled = true; go.textContent = 'Marking…';
        Store.examSubmit(SESSION.email, SESSION.pin, c.id, score, st.ex.questions.length, st.ex.pass)
          .then(function (r) {
            if (!r || !r.ok) { go.disabled = false; go.textContent = 'Submit the exam'; toast((r && r.error) || 'Could not submit.', 'bad'); return; }
            result = r; submitted = true;
            var s2 = stateOf(r); if (s2) absorb(s2);
            WORK.exams.unshift({ campus: c.id, score: r.score, total: r.total, passed: r.passed, at: new Date().toISOString() });
            if (r.first_pass) toast('Passed — +' + XP.exam + ' XP', 'good');
            draw();
          });
      });
      var again = el('examAgain');
      if (again) again.addEventListener('click', function () {
        picks = {}; submitted = false; result = null; st = examState(c.id); draw();
      });
    }
    draw();
  }

  /* ---- the build ---- */
  function viewBuild(campusId) {
    var st = buildState(campusId), c = campusById(campusId);
    if (!st || !c) { location.hash = '#/learn'; return; }
    var b = st.b;

    var html = '<button class="btn plain sm" data-go="#/campus/' + c.id + '">&larr; ' + esc(c.name) + '</button>'
      + '<div class="card" style="margin-top:14px;border-color:rgba(185,139,255,.4)">'
      + '<div class="eyebrow" style="color:var(--vio)">The build &middot; ' + b.mins + ' min</div>'
      + '<h2>' + esc(b.title) + '</h2>'
      + '<p class="muted" style="font-size:14.5px;margin:6px 0 10px">' + esc(b.why) + '</p>'
      + '<div class="bar"><i style="width:' + Math.max(2, (st.done / st.total) * 100) + '%"></i></div>'
      + '<div class="barlab"><span>' + st.done + ' of ' + st.total + ' written</span><span>You end up with: '
      + esc(b.deliverable) + '</span></div></div>';

    b.steps.forEach(function (step, i) {
      var saved = st.saved[step.id] || '';
      html += '<div class="card build-step' + (saved ? ' filled' : '') + '">'
        + '<div class="sh"><span class="n">' + (i + 1) + '</span><b>' + esc(step.t) + '</b>'
        + (saved ? '<span class="chip gold">saved</span>' : '') + '</div>'
        + '<p class="muted" style="font-size:14px;margin:8px 0 10px">' + esc(step.p) + '</p>'
        + '<textarea data-step="' + esc(step.id) + '" placeholder="' + esc(step.ph) + '">' + esc(saved) + '</textarea>'
        + '<div class="saverow"><button class="btn sm" data-save="' + esc(step.id) + '">Save</button>'
        + '<span class="fine" data-flag="' + esc(step.id) + '"></span></div></div>';
    });

    html += st.complete
      ? '<div class="done-note">&#10003; <b>Build finished.</b> It lives in <a href="#/workbook">your workbook</a> and you can edit it forever.</div>'
      : '<p class="fine" style="text-align:center">+' + XP.buildStep + ' XP a step, +' + XP.buildDone + ' when the last one is written.</p>';
    html += '<div class="navrow"><button class="btn ghost" data-go="#/workbook">Open the workbook</button></div>';

    el('view').innerHTML = html;
    w.scrollTo(0, 0);
    wire();

    [].forEach.call(d.querySelectorAll('[data-save]'), function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-save');
        var ta = d.querySelector('textarea[data-step="' + id + '"]');
        var flag = d.querySelector('[data-flag="' + id + '"]');
        var val = (ta.value || '').trim();
        btn.disabled = true; btn.textContent = 'Saving…';
        Store.buildSave(SESSION.email, SESSION.pin, campusId, id, val, b.steps.length).then(function (r) {
          btn.disabled = false; btn.textContent = 'Save';
          if (!r || !r.ok) { toast((r && r.error) || 'Could not save.', 'bad'); return; }
          WORK.builds[campusId] = WORK.builds[campusId] || {};
          if (val) WORK.builds[campusId][id] = val; else delete WORK.builds[campusId][id];
          var s2 = stateOf(r); if (s2) absorb(s2);
          if (flag) { flag.textContent = val ? 'Saved' : 'Cleared'; setTimeout(function () { flag.textContent = ''; }, 2200); }
          var now = buildState(campusId);
          if (now.complete && !st.complete) { toast('Build finished — +' + XP.buildDone + ' XP', 'good'); viewBuild(campusId); }
        });
      });
    });
  }

  /* ---- the workbook: every build, in one place ---- */
  function viewWorkbook() {
    var t = workTotals();
    var html = localBanner()
      + '<div class="card tight"><div class="eyebrow">Your workbook</div>'
      + '<h2>Your business, written down</h2>'
      + '<p class="muted" style="font-size:14px;margin:4px 0 10px">Everything you have written in the builds, collected. '
      + 'This is the actual deliverable of this school — not a certificate, a set of documents only you could have written.</p>'
      + '<div class="bar blue"><i style="width:' + Math.max(2, (t.buildSteps / Math.max(1, t.buildStepsTotal)) * 100) + '%"></i></div>'
      + '<div class="barlab"><span>' + t.buildSteps + ' of ' + t.buildStepsTotal + ' sections</span>'
      + '<span>' + t.examsPassed + '/' + t.examsTotal + ' exams · ' + t.checksPassed + '/' + t.checksTotal + ' checks</span></div></div>';

    var any = false;
    CAMPUSES.forEach(function (c) {
      var bs = buildState(c.id);
      if (!bs) return;
      html += '<div class="sechead"><h2>' + c.icon + ' ' + esc(bs.b.title) + '</h2>'
        + '<button class="more" data-go="#/build/' + c.id + '">' + (bs.done ? 'Edit' : 'Start') + '</button></div>';
      if (!bs.done) {
        html += '<div class="card"><div class="empty">Not started. ' + esc(bs.b.deliverable) + '.</div></div>';
        return;
      }
      any = true;
      html += '<div class="card wb">';
      bs.b.steps.forEach(function (step) {
        var v = bs.saved[step.id];
        if (!v) return;
        html += '<div class="wbstep"><b>' + esc(step.t) + '</b><p>' + esc(v) + '</p></div>';
      });
      html += '</div>';
    });

    if (any) html += '<button class="btn plain wide" id="copyWb" style="margin-top:6px">Copy the whole workbook</button>';
    el('view').innerHTML = html;
    wire();
    var cp = el('copyWb');
    if (cp) cp.addEventListener('click', function () {
      var out = [];
      CAMPUSES.forEach(function (c) {
        var bs = buildState(c.id);
        if (!bs || !bs.done) return;
        out.push('## ' + bs.b.title);
        bs.b.steps.forEach(function (step) {
          if (bs.saved[step.id]) out.push(step.t + '\n' + bs.saved[step.id] + '\n');
        });
      });
      var text = (S.student.name || '') + ' — TB University workbook\n\n' + out.join('\n');
      if (w.navigator.clipboard && w.navigator.clipboard.writeText) {
        w.navigator.clipboard.writeText(text).then(function () { toast('Copied', 'good'); });
      } else { w.prompt('Copy your workbook:', text); }
    });
  }

  /* ------------------------------------------------------------------ money
     Every school claims its students make money and almost none of them can
     show it, because they never asked and never counted. This counts: a client
     is logged once and the earned figure grows on its own every month.

     It is deliberately an ESTIMATE from fee times elapsed months, not a
     receipt ledger, and it says so on the screen. A student who has to
     reconcile invoices to see their number will stop looking at it, and a
     number nobody looks at changes nothing. */
  var MONEY = null;
  var CONTENT = { announcements: [], overrides: {} };

  /* Overrides are patched straight into the lesson objects once, so every
     screen that renders a lesson gets the edited version with no further
     bookkeeping. Only the four content fields can be touched — ids, order and
     campus membership stay in code, which is what keeps progress safe. */
  function applyOverrides() {
    var ov = CONTENT.overrides || {};
    w.TBU_LESSONS.forEach(function (entry) {
      var patch = ov[entry.lesson.id];
      if (!patch) return;
      if (patch.title) entry.lesson.title = patch.title;
      if (patch.body) entry.lesson.body = patch.body;
      if (patch.mission) entry.lesson.mission = patch.mission;
      if (patch.ask) entry.lesson.ask = patch.ask;
    });
  }
  function loadContent() {
    return Store.content().then(function (r) {
      if (r && r.ok) { CONTENT = { announcements: r.announcements || [], overrides: r.overrides || {} }; applyOverrides(); }
    });
  }

  var GOAL = 5000;

  function localEarned(c) {
    var start = Date.parse((c.started_on || today()) + 'T00:00:00');
    var end = c.ended_on ? Date.parse(c.ended_on + 'T00:00:00') : Date.now();
    var months = Math.max(0, Math.floor((end - start) / (30.44 * 86400000)));
    return (+c.setup || 0) + (+c.monthly || 0) * months;
  }
  function money(n) {
    return '$' + Math.round(+n || 0).toLocaleString();
  }
  function loadMoney() {
    if (!SESSION) return Promise.resolve();
    return Store.money(SESSION.email, SESSION.pin).then(function (r) {
      if (r && r.ok) MONEY = r;
    });
  }

  function viewMoney() {
    var m = MONEY || { clients: [], mrr: 0, earned: 0, active: 0, total: 0 };
    var pct = Math.min(100, (m.earned / GOAL) * 100);

    var html = localBanner()
      + '<div class="rankcard"><div class="top2">'
      + '<div class="badge">&#128176;</div>'
      + '<div class="who"><b>' + money(m.earned) + ' earned</b>'
      + '<span>' + money(m.mrr) + ' a month recurring &middot; ' + m.active + ' active client'
      + (m.active === 1 ? '' : 's') + '</span></div></div>'
      + '<div class="bar"><i style="width:' + Math.max(2, pct) + '%"></i></div>'
      + '<div class="barlab"><span>' + Math.round(pct) + '% of the first ' + money(GOAL) + '</span>'
      + '<span>' + (m.earned >= GOAL ? 'Target passed' : money(GOAL - m.earned) + ' to go') + '</span></div>'
      + '<p class="fine" style="margin:12px 0 0">Estimated from what you told us: setup fees plus the monthly fee for each whole '
      + 'month since the client started. Nothing here is sent to anyone.</p></div>';

    html += '<div class="card"><div class="eyebrow">Log a client</div>'
      + '<h2>Who is paying you?</h2>'
      + '<p class="muted" style="font-size:14px;margin:4px 0 12px">Log it once. The number grows by itself every month, '
      + 'so you never have to come back and update it.</p>'
      + '<div class="field"><label for="clName">Business</label><input id="clName" placeholder="Ray\'s Barbershop" maxlength="80"></div>'
      + '<div class="two2"><div class="field"><label for="clMonthly">Monthly ($)</label>'
      + '<input id="clMonthly" type="number" inputmode="numeric" min="0" step="10" placeholder="300"></div>'
      + '<div class="field"><label for="clSetup">Setup fee ($)</label>'
      + '<input id="clSetup" type="number" inputmode="numeric" min="0" step="10" placeholder="300"></div></div>'
      + '<div class="field"><label for="clStart">Started</label><input id="clStart" type="date" value="' + today() + '"></div>'
      + '<button class="btn wide" id="clAdd">Add to my book</button>'
      + '<div class="err hide" id="clErr" style="margin-top:10px"></div></div>';

    if (m.clients && m.clients.length) {
      html += '<div class="sechead"><h2>Your clients</h2></div>';
      m.clients.forEach(function (c) {
        html += '<div class="shoprow' + (c.active ? '' : ' done') + '">'
          + '<div class="bd"><b>' + esc(c.name) + '</b><span>'
          + money(c.monthly) + '/mo' + (+c.setup ? ' &middot; ' + money(c.setup) + ' setup' : '')
          + ' &middot; since ' + esc(String(c.started_on || '').slice(0, 10))
          + (c.active ? '' : ' &middot; ended') + '</span></div>'
          + '<div class="amt">' + money(c.earned) + '</div>'
          + (c.active ? '<button class="btn plain sm" data-end="' + esc(c.id) + '">End</button>' : '')
          + '</div>';
      });
    } else {
      html += '<div class="card"><div class="empty">Nothing logged yet. The first one is usually smaller than you expected '
        + 'and matters more than you expected.</div></div>';
    }

    html += '<div class="sechead"><h2>What the path is built to produce</h2></div>'
      + '<div class="card"><p class="muted" style="font-size:14.5px;margin:0 0 10px">Four clients at $300 a month, '
      + 'signed across three months, with a $300 setup each:</p>'
      + '<div class="lb"><div class="nm">Setup fees<em>4 &times; $300</em></div><div class="xp">$1,200</div></div>'
      + '<div class="lb"><div class="nm">Months 1&ndash;6 of retainers<em>as each one starts</em></div><div class="xp">$4,200</div></div>'
      + '<div class="lb me"><div class="nm">Six months in<em>and $1,200 a month still arriving</em></div><div class="xp">$5,400</div></div>'
      + '<p class="fine" style="margin:12px 0 0">That is arithmetic, not a promise. It happens if you do the outreach; '
      + 'it does not if you do not. Nobody here will pretend otherwise.</p></div>';

    el('view').innerHTML = html;
    wire();

    el('clAdd').addEventListener('click', function () {
      var name = (el('clName').value || '').trim();
      var monthly = parseFloat(el('clMonthly').value) || 0;
      var setup = parseFloat(el('clSetup').value) || 0;
      var started = el('clStart').value || today();
      var e = el('clErr');
      if (name.length < 2) { e.textContent = 'Name the client.'; e.classList.remove('hide'); return; }
      if (!monthly && !setup) { e.textContent = 'A monthly fee or a setup fee — otherwise there is nothing to count.'; e.classList.remove('hide'); return; }
      e.classList.add('hide');
      var b = el('clAdd'); b.disabled = true; b.textContent = 'Saving…';
      Store.clientAdd(SESSION.email, SESSION.pin, name, monthly, setup, started, null).then(function (r) {
        b.disabled = false; b.textContent = 'Add to my book';
        if (!r || !r.ok) { e.textContent = (r && r.error) || 'Could not save that.'; e.classList.remove('hide'); return; }
        MONEY = r;
        toast('Logged — ' + money(r.earned) + ' earned so far', 'good');
        viewMoney();
      });
    });

    [].forEach.call(d.querySelectorAll('[data-end]'), function (b) {
      b.addEventListener('click', function () {
        if (!w.confirm('End this client? What they already paid stays counted.')) return;
        Store.clientEnd(SESSION.email, SESSION.pin, b.getAttribute('data-end')).then(function (r) {
          if (!r || !r.ok) { toast((r && r.error) || 'Could not do that.', 'bad'); return; }
          MONEY = r; viewMoney();
        });
      });
    });
  }

  /* ---------------------------------------------------------------- library
     Five-minute true stories, each ending in a move. Kept apart from the
     lessons because they do different work: lessons teach the system, stories
     teach the instinct. */
  function viewLibrary() {
    var html = '<div class="card tight"><div class="eyebrow">The library</div>'
      + '<h2>Case files</h2>'
      + '<p class="muted" style="font-size:14px;margin:4px 0 0">True, documented episodes from business and tech — '
      + 'five minutes each, and each one ends in a move you can make this week. No legends, no misattributed quotes.</p></div>';
    (w.TBU_CASES || []).forEach(function (c) {
      html += '<button class="crow" data-go="#/case/' + c.id + '">'
        + '<div class="ic">&#128213;</div>'
        + '<div class="bd"><b>' + esc(c.title) + '</b><span>' + esc(c.tag) + ' &middot; ' + esc(c.lesson) + '</span></div>'
        + '<div class="go">&rarr;</div></button>';
    });
    el('view').innerHTML = html;
    wire();
  }

  function viewCase(id) {
    var c = (w.TBU_CASES || []).filter(function (x) { return x.id === id; })[0];
    if (!c) { location.hash = '#/library'; return; }
    el('view').innerHTML = '<button class="btn plain sm" data-go="#/library">&larr; Case files</button>'
      + '<div class="reader" style="margin-top:14px">'
      + '<div class="meta"><span class="chip">&#128213; ' + esc(c.tag) + '</span><span class="chip">5 min</span></div>'
      + '<h1>' + esc(c.title) + '</h1>'
      + '<div class="body"><p>' + esc(c.story) + '</p>'
      + '<div class="ex"><b>The lesson:</b> ' + esc(c.lesson) + '</div></div>'
      + '<div class="mission"><div class="eyebrow">The move</div>'
      + '<p>' + esc(c.move) + '</p>'
      + '<p class="fine" style="margin:0">No box to fill here — do it, and post what happened in <a href="#/wins">Wins</a> if it worked.</p></div>'
      + '</div>';
    w.scrollTo(0, 0);
    wire();
  }

  /* ------------------------------------------------------------------ vocab
     Study mode shows the whole deck — the precise definition, the
     nine-year-old version, and a sentence to steal. The drill samples ten,
     quizzes both directions, and saves through the same machinery as lesson
     checks (lesson id "vocab:<deck>"), so XP pays once on the first perfect
     run and retakes are free forever. */
  function vocabState(deckId) {
    var got = WORK.checks['vocab:' + deckId];
    return { passed: !!(got && got.total && got.best >= got.total), best: got ? got.best : null };
  }

  function viewVocab() {
    var html = '<div class="card tight"><div class="eyebrow">Vocabulary</div>'
      + '<h2>Talk the trade</h2>'
      + '<p class="muted" style="font-size:14px;margin:4px 0 0">Every term three ways: the precise version, the nine-year-old '
      + 'version, and a sentence to steal. Sound fluent with developers so you are not overcharged; sound simple with owners '
      + 'so you are not tuned out. Ten questions per drill — a perfect run pays XP once.</p></div>';
    (w.TBU_VOCAB || []).forEach(function (deck) {
      var vs = vocabState(deck.id);
      html += '<button class="crow" data-go="#/vocab/' + deck.id + '"' + (vs.passed ? ' style="border-color:rgba(67,240,176,.4)"' : '') + '>'
        + '<div class="ic">' + deck.icon + '</div>'
        + '<div class="bd"><b>' + esc(deck.name) + '</b><span>' + deck.terms.length + ' terms &middot; ' + esc(deck.blurb) + '</span></div>'
        + '<div class="go">' + (vs.passed ? '&#10003;' : '&rarr;') + '</div></button>';
    });
    el('view').innerHTML = html;
    wire();
  }

  function viewVocabDeck(deckId, mode) {
    var deck = (w.TBU_VOCAB || []).filter(function (x) { return x.id === deckId; })[0];
    if (!deck) { location.hash = '#/vocab'; return; }
    if (mode === 'drill') return vocabDrill(deck);

    var vs = vocabState(deck.id);
    var html = '<button class="btn plain sm" data-go="#/vocab">&larr; All decks</button>'
      + '<div class="card" style="margin-top:14px"><div class="eyebrow">' + deck.icon + ' Deck</div>'
      + '<h2>' + esc(deck.name) + '</h2>'
      + '<p class="muted" style="font-size:14px;margin:6px 0 12px">' + esc(deck.blurb)
      + (vs.passed ? ' <b style="color:var(--good)">Deck passed.</b>' : '') + '</p>'
      + '<button class="btn wide" id="startDrill">' + (vs.passed ? 'Drill it again' : 'Start the drill &middot; 10 questions') + '</button></div>';
    deck.terms.forEach(function (t) {
      html += '<div class="card vterm"><b class="vt">' + esc(t.t) + '</b>'
        + '<p class="vd">' + esc(t.d) + '</p>'
        + '<p class="vk"><b>To a nine-year-old:</b> ' + esc(t.kid) + '</p>'
        + '<p class="vu"><b>Steal this:</b> ' + esc(t.use) + '</p></div>';
    });
    el('view').innerHTML = html;
    w.scrollTo(0, 0);
    wire();
    el('startDrill').addEventListener('click', function () { vocabDrill(deck); });
  }

  function vocabDrill(deck) {
    /* Ten random terms, direction alternating; distractors drawn from the
       same deck so the wrong answers are plausible rather than silly. */
    var pool = deck.terms.slice();
    for (var i = pool.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp; }
    var qs = pool.slice(0, 10).map(function (term, i) {
      var others = deck.terms.filter(function (x) { return x.t !== term.t; });
      for (var k = others.length - 1; k > 0; k--) { var m = Math.floor(Math.random() * (k + 1)); var t2 = others[k]; others[k] = others[m]; others[m] = t2; }
      var dir = i % 2 === 0 ? 'def' : 'term';   // def: show term, pick meaning; term: show meaning, pick term
      var opts, correct;
      if (dir === 'def') { opts = [term].concat(others.slice(0, 3)).map(function (x) { return x.d; }); correct = term.d; }
      else { opts = [term].concat(others.slice(0, 3)).map(function (x) { return x.t; }); correct = term.t; }
      for (var n = opts.length - 1; n > 0; n--) { var r = Math.floor(Math.random() * (n + 1)); var o = opts[n]; opts[n] = opts[r]; opts[r] = o; }
      return { term: term, dir: dir, opts: opts, c: opts.indexOf(correct) };
    });
    var idx = 0, correct = 0, picked = null, revealed = false;

    function draw() {
      if (idx >= qs.length) {
        var perfect = correct === qs.length;
        Store.checkSave(SESSION.email, SESSION.pin, 'vocab:' + deck.id, correct, qs.length).then(function (r) {
          var s2 = stateOf(r); if (s2) absorb(s2);
          WORK.checks['vocab:' + deck.id] = { best: Math.max((WORK.checks['vocab:' + deck.id] || {}).best || 0, correct), total: qs.length };
          if (perfect) toast('Deck passed', 'good');
        });
        el('view').innerHTML = '<div class="card" style="text-align:center;padding:34px 20px">'
          + '<div style="font-size:44px">' + (perfect ? '&#127942;' : '&#128218;') + '</div>'
          + '<h2 style="margin:10px 0 6px">' + correct + ' of ' + qs.length + '</h2>'
          + '<p class="muted" style="font-size:14.5px;margin:0 0 18px">'
          + (perfect ? 'Fluent. Now use three of these in a real conversation this week.'
                     : 'Read the ones you missed in study mode, then run it again — the drill is free forever.')
          + '</p>'
          + '<div class="navrow"><button class="btn ghost" data-go="#/vocab/' + deck.id + '">Study the deck</button>'
          + '<button class="btn" id="againBtn">Drill again</button></div></div>';
        wire();
        el('againBtn').addEventListener('click', function () { vocabDrill(deck); });
        return;
      }
      var q = qs[idx];
      var html = '<button class="btn plain sm" data-go="#/vocab/' + deck.id + '">&larr; ' + esc(deck.name) + '</button>'
        + '<div class="card" style="margin-top:14px"><div class="barlab" style="margin:0 0 10px"><span>Question ' + (idx + 1)
        + ' of ' + qs.length + '</span><span>' + correct + ' right</span></div>'
        + '<div class="q"><b>' + (q.dir === 'def'
            ? 'What is <span class="shimmer">' + esc(q.term.t) + '</span>?'
            : 'Which term means: &ldquo;' + esc(q.term.d) + '&rdquo;') + '</b>';
      q.opts.forEach(function (opt, j) {
        var cls = '';
        if (revealed) { if (j === q.c) cls = ' right'; else if (picked === j) cls = ' wrong'; }
        html += '<button class="opt' + cls + '" data-o="' + j + '"' + (revealed ? ' disabled' : '') + '>' + esc(opt) + '</button>';
      });
      if (revealed) {
        html += '<div class="why' + (picked === q.c ? ' ok' : '') + '"><b>' + esc(q.term.t) + ':</b> ' + esc(q.term.kid) + '</div>'
          + '<button class="btn wide" id="nextQ" style="margin-top:12px">' + (idx + 1 >= qs.length ? 'See the result' : 'Next') + '</button>';
      }
      html += '</div></div>';
      el('view').innerHTML = html;
      wire();
      [].forEach.call(d.querySelectorAll('.opt'), function (b) {
        b.addEventListener('click', function () {
          if (revealed) return;
          picked = +b.getAttribute('data-o');
          revealed = true;
          if (picked === qs[idx].c) correct++;
          draw();
        });
      });
      var nx = el('nextQ');
      if (nx) nx.addEventListener('click', function () { idx++; picked = null; revealed = false; draw(); });
    }
    draw();
  }

  function viewLearn() {
    var totalDone = Object.keys(doneSet).length;
    var html = localBanner()
      + '<div class="card tight"><div class="eyebrow">Your degree</div>'
      + '<h2>' + totalDone + ' of ' + w.TBU_TOTAL + ' lessons</h2>'
      + '<div class="bar blue"><i style="width:' + Math.max(2, (totalDone / w.TBU_TOTAL) * 100) + '%"></i></div>'
      + '<div class="barlab"><span>' + CAMPUSES.length + ' campuses</span><span>'
      + Math.round((totalDone / w.TBU_TOTAL) * 100) + '% complete</span></div>'
      + '<p class="fine" style="margin:12px 0 0">Every lesson ends in a mission and a check. Every campus ends in a build and an exam. '
      + '<a href="#/workbook">Your workbook</a> is where the builds collect.</p></div>';

    var vocabPassed = (w.TBU_VOCAB || []).filter(function (dk) { return vocabState(dk.id).passed; }).length;
    html += '<button class="crow" data-go="#/vocab">'
      + '<div class="ic">&#128483;&#65039;</div>'
      + '<div class="bd"><b>Vocabulary decks</b><span>' + (w.TBU_VOCAB || []).reduce(function (a, dk) { return a + dk.terms.length; }, 0)
      + ' terms &middot; sound like you have done this for years &middot; ' + vocabPassed + '/' + (w.TBU_VOCAB || []).length + ' passed</span></div>'
      + '<div class="go">&rarr;</div></button>';

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
        + '<div class="bd"><b>' + esc(l.title) + '</b><span>' + l.min + ' min · mission'
        + (checkState(l.id) ? (checkState(l.id).passed ? ' · check passed' : ' · check') : '') + '</span></div>'
        + '<div class="go">→</div></button>';
    });
    html += '</div>';

    var bs = buildState(c.id), es = examState(c.id);
    if (bs) {
      html += '<div class="sechead"><h2>The build</h2></div>'
        + '<button class="crow" data-go="#/build/' + c.id + '" style="border-color:rgba(185,139,255,.4)">'
        + '<div class="ic">&#128296;</div>'
        + '<div class="bd"><b>' + esc(bs.b.title) + '</b><span>' + bs.done + '/' + bs.total
        + ' written &middot; ' + esc(bs.b.deliverable) + '</span></div>'
        + '<div class="go">' + (bs.complete ? '&#10003;' : '&rarr;') + '</div></button>';
    }
    if (es) {
      html += '<div class="sechead"><h2>The exam</h2></div>'
        + '<button class="crow" data-go="#/exam/' + c.id + '"' + (es.passed ? ' style="border-color:rgba(67,240,176,.4)"' : '') + '>'
        + '<div class="ic">' + (es.passed ? '&#127894;' : '&#128221;') + '</div>'
        + '<div class="bd"><b>' + (es.passed ? 'Passed &mdash; ' + esc(es.ex.title_earned) : esc(es.ex.title) + ' exam') + '</b>'
        + '<span>' + es.ex.questions.length + ' questions, ' + es.ex.pass + ' to pass'
        + (es.attempts ? ' &middot; best ' + es.best + '/' + es.ex.questions.length : '') + '</span></div>'
        + '<div class="go">&rarr;</div></button>';
    }

    el('view').innerHTML = html;
    wire();
  }

  /* A pasted share link becomes the right player. YouTube, Loom and Vimeo get
     their embed forms; a direct .mp4/.webm gets a native <video>. Anything
     unrecognised gets a plain link rather than a broken frame. */
  function videoEmbed(url) {
    if (!url) return '';
    var u = String(url).trim(), src = null;
    var m = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{6,20})/);
    if (m) src = 'https://www.youtube-nocookie.com/embed/' + m[1];
    if (!src) { m = u.match(/loom\.com\/(?:share|embed)\/([a-f0-9]{16,40})/); if (m) src = 'https://www.loom.com/embed/' + m[1]; }
    if (!src) { m = u.match(/vimeo\.com\/(?:video\/)?(\d{6,12})/); if (m) src = 'https://player.vimeo.com/video/' + m[1]; }
    if (src) {
      return '<div class="lvid"><iframe src="' + esc(src) + '" allow="fullscreen; picture-in-picture" allowfullscreen '
        + 'title="Video lesson" loading="lazy"></iframe></div>';
    }
    if (/\.(mp4|webm|mov)(\?|$)/i.test(u)) {
      return '<div class="lvid"><video src="' + esc(u) + '" controls playsinline preload="metadata"></video></div>';
    }
    return '<p><a href="' + esc(u) + '" target="_blank" rel="noopener">&#127909; Watch the video for this lesson &rarr;</a></p>';
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
      + ((CONTENT.overrides[l.id] && CONTENT.overrides[l.id].video) ? videoEmbed(CONTENT.overrides[l.id].video) : '')
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

    html += '<div id="checkBox"></div>';

    html += '<div class="navrow">'
      + (prev ? '<button class="btn ghost" data-go="#/lesson/' + prev.id + '">← Previous</button>' : '')
      + (next ? '<button class="btn ghost" data-go="#/lesson/' + next.id + '">Next lesson →</button>'
              : '<button class="btn ghost" data-go="#/learn">Back to campuses</button>')
      + '</div></div>';

    el('view').innerHTML = html;
    w.scrollTo(0, 0);
    wire();
    mountCheck(l.id, el('checkBox'));

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
    { ic: '💼', name: 'Resell Loop', desc: 'Your book of business: claim the shops you run, set prices, see what you bill.', href: '/kit/loop-resell/' },
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
      a.classList.toggle('on', v === view || (v === 'learn' && ['campus','lesson','exam','build','workbook'].indexOf(view) >= 0));
    });
    if (view === 'home') return viewHome();
    if (view === 'learn') return viewLearn();
    if (view === 'campus') return viewCampus(parts[1]);
    if (view === 'lesson') return viewLesson(parts[1]);
    if (view === 'daily') return viewDaily();
    if (view === 'path') return viewPath(true);
    if (view === 'exam') return viewExam(parts[1]);
    if (view === 'build') return viewBuild(parts[1]);
    if (view === 'workbook') return viewWorkbook();
    if (view === 'money') return viewMoney();
    if (view === 'library') return viewLibrary();
    if (view === 'vocab') return parts[1] ? viewVocabDeck(parts[1]) : viewVocab();
    if (view === 'case') return viewCase(parts[1]);
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
