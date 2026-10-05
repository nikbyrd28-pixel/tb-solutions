/* TB HQ — what to say, per prospect, per stage of the chase.
   Prices here must match /offers/. Nothing invented: if a shop's owner name or email
   isn't known, the script says "the owner" instead of guessing.
   Edit this file to change what you say — the Call list reads it live. */
(function () {
  const DEMO = '(610) 998-6138';   // the receptionist demo line
  const CELL = '(484) 841-8501';   // Nick's text line

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
  // "listed closed weekends — every Saturday call hits voicemail; 82 reviews…" → the first clause only
  const hook = (p) => (p.why || '').split(/[;—]/)[0].trim().replace(/^listed /, 'your Google says ');
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
          `I called because ${hook(p)}. So the calls you get after hours are going to voicemail instead of getting booked.`,
          `I'm not going to pitch you on a machine. Call ${DEMO} and you'll hear exactly what I'd put on your line.`,
          `I'll try you again in a few days. ${CELL}. That's ${CELL}.`,
        ],
      };

      case 'retry': return {
        title: `Try ${(p.attempts || 1) + 1} — different time, different open`,
        note: `${p.attempts || 1} tries so far. If mornings failed, go late afternoon. Six strikes and it retires itself.`,
        lines: [
          `${greet(p)} Nick — I left you a message last week about your phones.`,
          `Thirty seconds and I'm gone: ${hook(p)}. Every one of those calls is a job someone else booked.`,
          `What do you do with the ones that come in while you're under a sink?`,
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
        note: 'Earn the next 30 seconds before you pitch anything. One question, then listen.',
        lines: [
          `${greet(p)}`,
          `Nick Byrd — I'm local, out of Pottstown. Give me 30 seconds and if it's not for you I'll get off the phone.`,
          `I was looking at ${n} on Google and ${hook(p)}. Is that about right?`,
          `— let him answer. Whatever he says, go to the next line.`,
          `That's why I called. I put ${o.what} on shops like yours. ${o.does}`,
          `What happens right now when somebody calls you on a Saturday?`,
          `— that answer is the sale. Shut up and let it sit.`,
          `${price} ${o.proof}`,
          `Easiest thing: call ${DEMO} and hear it yourself. Want me to set yours up this week?`,
        ],
      };
    }
  }

  // Which script a prospect needs right now.
  function stageFor(p) {
    if (p.status === 'meeting') return 'meeting';
    if (p.status === 'talking') return 'talking';
    if (p.status === 'callback') return 'callback';
    if (p.status === 'voicemail') return 'voicemail';
    if (p.status === 'no_answer') return 'retry';
    return 'first';
  }

  function emailDraft(p) {
    const o = offer(p);
    return {
      subject: `${p.city || 'Local'} ${p.trade || 'shop'} — the calls you miss on Saturday`,
      body: [
        `${first(p) ? first(p) + ',' : 'Hey,'}`, '',
        `Nick Byrd — I'm local, out of Pottstown. I called earlier, figured I'd write instead of keep bothering you.`, '',
        `I noticed ${hook(p)}. Every one of those is a homeowner who called the next guy.`, '',
        `I set up ${o.what}. ${o.does}`, '',
        `${o.first5} to set up, ${o.monthly} a month, no contract. ${o.proof}`, '',
        `Don't take my word for it — call ${DEMO} and you'll hear exactly what goes on your line.`, '',
        `— Nick, ${CELL}`, `tbsol.net`,
      ].join('\n'),
    };
  }

  window.CALL_SCRIPTS = { script, stageFor, emailDraft, OBJECTIONS, OFFERS, BUNDLE, DEMO, CELL };
})();
