/* TB HQ — what to say, per prospect, per stage of the chase.
   Prices here must match /offers/. Nothing invented: if a shop's owner name or email
   isn't known, the script says "the owner" instead of guessing.
   Edit this file to change what you say — the Call list reads it live. */
(function () {
  const DEMO = '(610) 998-6138';   // the receptionist demo line
  const CELL = '(484) 841-8501';   // Nick's text line
  const PAY  = 'https://buy.stripe.com/28E28talAfU0gUodya6Ri01';   // Stripe payment link — fixed amount, set in the Stripe dashboard

  // Straight off the offer sheet. first5 is the launch price you're allowed to quote.
  const OFFERS = {
    'Never Miss a Call': {
      what: 'an AI receptionist that picks up when you can\'t',
      setup: '$497', first5: '$297', monthly: '$197',
      does: 'It answers in your company name, only after your line rings out. Triages the problem, gives the safety step, checks they\'re in your area, books into your real arrival windows, texts them a confirmation and texts you the job.',
      proof: 'If it doesn\'t book you a job in 30 days, I refund the month.',
    },
    'Lead Engine': {
      what: 'your Google Guaranteed listing run properly',
      setup: '$497', first5: '$297', monthly: '$147',
      does: 'The badge at the top of search. I rebuild the campaign, cap the budget, and file disputes every week on the junk leads so you get credits back. Your lead spend goes straight to Google — I never touch it.',
      proof: 'The LSA rules changed in October; most shops are overpaying and don\'t know it.',
    },
    'Review Engine': {
      what: 'Google reviews on autopilot',
      setup: 'no setup fee', first5: 'no setup fee', monthly: '$97',
      does: 'Every finished job gets a text asking for a review, timed right, one tap. Anyone unhappy gets routed to you first instead of to Google.',
      proof: 'No setup fee, month to month.',
    },
  };
  const BUNDLE = { setup: '$797', monthly: '$297', vs: '$1,091 setup and $441 a month separately' };

  const first = (p) => (p.owner_name || '').trim().split(/\s+/)[0] || '';
  const who = (p) => first(p) ? first(p) : 'the owner';
  const greet = (p) => first(p) ? `Hey, is this ${first(p)}?` : 'Hey, is the owner around?';
  // THE OPENER. Built from the prospect's actual signals, written to be said out loud — never from
  // the Prospector's shorthand `why` ("614 reviews, closed weekends" is a note, not a sentence).
  // One observation about THEIR listing, then one question. The question is the whole call.
  const sig = (p) => p.signals || {};
  const rv = (p) => p.reviews != null ? Number(p.reviews) : null;
  const stars = (p) => p.rating ? `${Number(p.rating).toFixed(1).replace(/\.0$/, '')} stars` : '';
  function angle(p) {
    const g = sig(p), n = rv(p), r = Number(p.rating || 0), hn = (p.hours_note || '').toLowerCase();
    const closedWk = g.closed_weekends || /closed week/.test(hn);
    const noHours = g.no_hours_listed || /no hours/.test(hn);
    const open24 = g.open_24h || /24/.test(hn);
    const big = n != null && n >= 500, tiny = n != null && n < 10, low = r > 0 && r < 4.5 && n != null && n >= 10;
    if (tiny) return {
      key: 'reviews',
      see: `you've got ${n} review${n === 1 ? '' : 's'} on Google`,
      so: `the shops ranking above you have sixty, eighty — and that's the whole reason they get the call instead of you`,
      ask: `When a job goes well, does anybody ask the customer for a review, or does it just not happen?`,
    };
    if (low) return {
      key: 'reviews',
      see: `you're sitting at ${stars(p)} with ${n} reviews`,
      so: `the next ten happy customers would move that number fast, and right now nobody's asking them`,
      ask: `When a job goes well, who asks for the review — you, or nobody?`,
    };
    if (closedWk) return {
      key: 'weekend',
      see: `your listing says you're closed Saturday and Sunday`,
      so: `so when a water heater lets go on a Saturday, that call rings out, and the homeowner calls the next guy`,
      ask: `What actually happens to a Saturday call right now — voicemail?`,
    };
    if (noHours) return {
      key: 'hours',
      see: `your Google listing has no hours on it`,
      so: `so a guy calling at six at night can't tell if you're open, and most of them don't leave a message, they call the next name`,
      ask: `When you're on a job and the office line rings, who picks it up?`,
    };
    if (open24 && big) return {
      key: 'busy',
      see: `you've got ${n} reviews, so you're busy — every truck's out most days`,
      so: `the question is the call that comes in while every truck is out`,
      ask: `Who's answering that one — the office, a service, or does it go to voicemail?`,
    };
    if (open24) return {
      key: '24h',
      see: `your listing says you're open 24 hours`,
      so: `so somebody's picking up at two in the morning`,
      ask: `Is that you, or does it go to a service?`,
    };
    if (big) return {
      key: 'busy',
      see: `you've got ${n} reviews, so you're not short on work`,
      so: `which usually means the phone's the thing that slips`,
      ask: `When every truck is out, who's picking up?`,
    };
    return {
      key: 'general',
      see: `you're at ${stars(p) || 'a good rating'} with ${n ?? 'a lot of'} reviews — a real shop, owner-run`,
      so: `and owner-run shops are the ones where the phone goes to voicemail the second you're under a sink`,
      ask: `What happens to a call that comes in while you're on a job?`,
    };
  }
  // one spoken sentence: "your listing says you're closed Saturday and Sunday, so when a water heater…"
  const hook = (p) => { const a = angle(p); return `${a.see}, ${a.so}`; };
  const hookBare = hook;
  const ask = (p) => angle(p).ask;
  const offer = (p) => OFFERS[(p.pitch || '').split('+')[0].trim()] || OFFERS['Never Miss a Call'];
  const second = (p) => (p.pitch || '').includes('+') ? OFFERS[(p.pitch.split('+')[1] || '').trim()] : null;

  const OBJECTIONS = [
    ['"I already have an answering service."',
     'Good — then you know the problem. Ask them: does yours book the job into your calendar, or just take a message you call back on? Mine books it. And it costs about a third of a service.'],
    ['"How much?"',
     'Say the number flat, no apology. Then stop talking.'],
    ['"My wife answers the phone."',
     'Then she\'ll like this more than you do. It picks up the ones she misses — nights, weekends, when she\'s on the other line. She stops being the backstop.'],
    ['"Not interested."',
     '"Fair enough. Can I ask one thing before I go — what happens right now when someone calls you at 7 on a Saturday?" Then shut up. Half of them answer it honestly and you\'re back in.'],
    ['"Send me some info."',
     '"I\'ll do you one better — call this number and you\'ll hear the thing itself. ' + DEMO + '. Then text me what you think, ' + CELL + '." Info emails get buried; the demo sells it.'],
    ['"I\'m on a job right now."',
     '"Say no more. Mornings or after 4 — which is less bad?" Get the time, log the callback, hang up fast. He\'ll remember you didn\'t hold him up.'],
    ['"Who is this / how\'d you get my number?"',
     '"Your Google listing — I\'m local, out of Pottstown. I only call shops around here." True, and it ends the suspicion.'],
  ];

  function script(p, stage) {
    const o = offer(p), o2 = second(p), n = p.name || 'the shop';
    const price = `${o.first5} to set up — that's my first-five price — and ${o.monthly} a month. No contract, cancel by texting me.`;

    switch (stage) {
      case 'voicemail': return {
        title: 'Voicemail — 20 seconds, then hang up',
        note: 'Leave the demo number, not a pitch. Say your number twice, slowly.',
        lines: [
          `Hey, it's Nick Byrd, I'm local — out of Pottstown.`,
          `I called because ${hook(p)}.`,
          `I'm not going to pitch you on a machine. Call ${DEMO} and you'll hear exactly what I'd put on your line.`,
          `I'll try you again in a few days. ${CELL}. That's ${CELL}.`,
        ],
      };

      case 'retry': return {
        title: `Try ${(p.attempts || 1) + 1} — different time, different open`,
        note: `${p.attempts || 1} tries so far. If mornings failed, go late afternoon. Six strikes and it retires itself.`,
        lines: [
          `${greet(p)} Nick — I left you a message last week about your phones.`,
          `Thirty seconds and I'm gone: ${hook(p)}.`,
          `${ask(p)}`,
          `— then let him talk. Don't pitch over the answer.`,
        ],
      };

      case 'callback': return {
        title: 'Callback — he asked you to',
        note: 'Open by naming the fact he asked. It changes the whole call.',
        lines: [
          `${greet(p)} Nick — you told me to try you ${p.callback_at ? 'around now' : 'back'}. Good time?`,
          `Where we left off: ${hook(p)}.`,
          `${o.does}`,
          `${price} ${o.proof}`,
          `Want me to set it up this week, or do you want to hear the demo line first — ${DEMO}?`,
        ],
      };

      case 'talking': return {
        title: 'He\'s engaged — get a decision, not a "think about it"',
        note: 'The goal of this call is a date, not a yes. Never leave without one.',
        lines: [
          `So here's what setup actually is: one 20-minute call with me, and you dial one forwarding code on your phone. That's it.`,
          `Your number stays yours. Your Google stays yours. If you hate it you text me and we're done.`,
          `${price}`,
          o2 ? `And since you're at ${p.reviews || 'under 30'} reviews — ${o2.what}, ${o2.monthly} a month, no setup. Most guys bolt it on after a month.` : `If you ever want the reviews side too it's ${OFFERS['Review Engine'].monthly} a month on top, no setup.`,
          `What's better for the 20 minutes — tomorrow morning or Thursday?`,
          `— if he says yes on the call, don't wait. Send the payment link while you're still on the phone: ${PAY}`,
        ],
      };

      case 'won': return {
        title: 'He said yes — get paid and get him live',
        note: 'Send the link before you hang up. A yes that waits until tomorrow is a maybe.',
        lines: [
          `Perfect. I'm sending you a link right now — that's the setup, and it's the only thing you pay today.`,
          `Once that's through I'll text you to book the 20 minutes. I'll need your hours, your dispatch fee, your arrival windows and the towns you cover.`,
          `Then you dial one forwarding code on your business phone and you're live. Usually same week.`,
          `Your number stays yours, your Google stays yours. Cancel any time by texting me.`,
          `— send the link now: ${PAY}`,
        ],
      };

      case 'meeting': return {
        title: 'Confirm the meeting',
        note: 'Text this the day before. Confirmed meetings show up; unconfirmed ones don\'t.',
        lines: [
          `Hey ${who(p)} — Nick, confirming for tomorrow. 20 minutes, I'll call you.`,
          `Nothing to prepare. Have your phone handy and know who picks up now when you can't.`,
          `If something comes up on a job just text me and we'll move it. ${CELL}`,
        ],
      };

      default: return {
        title: 'First call',
        note: 'One observation about his listing, one question, then shut up. He sells himself on the answer. Do not say "AI" until he asks what it is.',
        lines: [
          `${greet(p)}`,
          `Nick Byrd — I'm local, out of Pottstown. I'm not selling you a website. Thirty seconds, and if it's nothing, I'm gone.`,
          `I was looking at ${n} on Google — ${hook(p)}.`,
          `${ask(p)}`,
          `— STOP. Let the silence sit. Whatever he says next is the sale. If he says "voicemail" or "my wife" or "I just call back", say "yeah, that's everybody", and keep going.`,
          `Here's what I do: ${o.what}. ${o.does}`,
          `${o.proof}`,
          `${price}`,
          `Easiest way to see it is to call it yourself — ${DEMO}. Call it right now while I hold if you want, hang up on it halfway, I don't care. Then tell me if you'd put it on your line.`,
          `— if he's warm: "I can have it answering your line by Thursday — morning or afternoon better for a 20-minute setup call?" Get the time. If he's cold: "Fair. Can I text you the demo number so you have it?" Then log it and move on.`,
        ],
      };
    }
  }

  // Which script a prospect needs right now.
  function stageFor(p) {
    if (p.status === 'won') return 'won';
    if (p.status === 'meeting') return 'meeting';
    if (p.status === 'talking') return 'talking';
    if (p.status === 'callback') return 'callback';
    if (p.status === 'voicemail') return 'voicemail';
    if (p.status === 'no_answer' || p.status === 'called') return 'retry';
    return 'first';
  }

  // ---- texts ----
  // The Chester County kid angle: he's local, he's young, he says so first and it disarms them.
  // Nobody local is cold-texting a plumber about AI. That's exactly why it gets read.
  // Keep every one under ~320 characters and always give them an easy out — it converts better
  // than pretending you won't text again.
  function sms(p, stage) {
    const o = offer(p), n = first(p), hi = n ? `${n},` : 'Hey —';
    const town = p.city || 'the county';

    switch (stage) {
      case 'after_no_answer': return {
        label: 'After a no-answer — send it the same hour',
        body: `${hi} Nick — tried your office line just now, didn't want to keep ringing you on a job. I'm the kid out of Pottstown that sets up the phone-answering for trades around here. ${hook(p)} — that's all I called about. Want me to try you later or just text?`,
      };
      case 'after_voicemail': return {
        label: 'After a voicemail — same day, so the name sticks',
        body: `${hi} left you a voicemail — Nick, local kid from Pottstown. Short version: call ${DEMO} and you'll hear exactly what I'd put on your line when you can't pick up. 40 seconds. If it's not for you, say the word and I'll quit texting.`,
      };
      case 'after_talk': return {
        label: 'Right after a good call — recap and lock the next step',
        body: `${hi} good talking. Recap: it answers in your name after your line rings out, books into your windows, texts you the job. ${o.first5} setup, ${o.monthly}/mo, no contract. ${o.proof} I'll call you ${'{{when}}'} — Nick, ${CELL}`,
      };
      case 'yes': return {
        label: 'He said yes — send this before you hang up',
        body: `${hi} here's the link to get started: ${PAY} — takes a minute, then I'll text you to book the 20-minute setup call. Nick, ${CELL}`,
      };
      case 'confirm': return {
        label: 'Day before the meeting',
        body: `${hi} Nick — we're on for ${'{{when}}'}, 20 minutes, I'll call you. Nothing to prep. If a job runs over just text me and we'll move it. ${CELL}`,
      };
      case 'breakup': return {
        label: 'Last touch — the one that gets the most replies',
        body: `${hi} Nick from Pottstown — I'll stop bugging you. If the Saturday calls ever start bothering you, the demo's at ${DEMO} and I'm at this number. Good luck out there this winter.`,
      };
      default: return {
        label: 'First text — if he never picks up the phone',
        body: `${hi} I'm Nick — local kid, Pottstown. I build the phone-answering setup for ${town} trades so the calls you can't grab still get booked. Saw ${hook(p)}. Not pitching over text: call ${DEMO} and hear it. Tell me to buzz off and I won't text again.`,
      };
    }
  }

  // ---- emails ----
  function emailDraft(p, stage) {
    const o = offer(p), n = first(p), town = p.city || 'your area';
    const sign = `— Nick Byrd\nTB Solutions · Pottstown, PA\n${CELL} · tbsol.net`;

    if (stage === 'followup') return {
      subject: `following up — ${p.name || 'your shop'}`,
      body: [
        n ? `${n},` : 'Hey,', '',
        `Nick again, the kid from Pottstown. Not going to keep filling up your inbox.`, '',
        `One number and I'll leave it: a service call around here runs a few hundred dollars. If the thing catches one call a month you'd otherwise lose, it has paid for itself four times over. ${o.first5} to set up, ${o.monthly} a month, no contract.`, '',
        `Still the easiest way to judge it: call ${DEMO} and listen.`, '',
        sign,
      ].join('\n'),
    };

    if (stage === 'breakup') return {
      subject: `closing the loop`,
      body: [
        n ? `${n},` : 'Hey,', '',
        `I'll get out of your hair — figure you're busy, which is kind of the whole point of what I do.`, '',
        `If the weekend calls ever start costing you real money, the demo line is ${DEMO} and I'm at ${CELL}. No hard feelings either way.`, '',
        `Good luck this season.`, '',
        sign,
      ].join('\n'),
    };

    return {
      subject: `${town} ${p.trade || 'shop'} — the calls going to voicemail`,
      body: [
        n ? `${n},` : 'Hey,', '',
        `I'm Nick — I'm a young guy out of Pottstown and I only work with trades in Chester County and up the 422. Figured I'd write instead of calling you again mid-job.`, '',
        `I was on your Google listing. Here's what I noticed: ${hookBare(p)}. Those calls don't wait around — they ring the next shop on the list. That's the only reason I reached out.`, '',
        `What I set up: ${o.does}`, '',
        `${o.first5} to set up, ${o.monthly} a month, no contract, cancel by texting me. ${o.proof}`, '',
        `Don't take my word for it — call ${DEMO}. That's the actual thing, and it's what would go on your line.`, '',
        `If it's not for you just reply "no" and I'll leave you alone.`, '',
        sign,
      ].join('\n'),
    };
  }

  window.CALL_SCRIPTS = { script, stageFor, sms, emailDraft, OBJECTIONS, OFFERS, BUNDLE, DEMO, CELL, PAY };
})();
