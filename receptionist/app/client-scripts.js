/* What a SHOP says — not what Nick says.
   Two jobs: scripts for the repeat-work people a trades shop should be calling
   (property managers, realtors, builders, restaurants), and scripts for the office
   phone when a human picks it up. Edit this file; the app reads it live. */
(function () {
  const first = (p) => (p.owner_name || '').trim().split(/\s+/)[0] || '';
  const greet = (p) => first(p) ? `Hi, is this ${first(p)}?` : 'Hi — who handles your maintenance calls?';
  const bare  = (p) => (p.why || '').split(/[;—]/)[0].trim();

  // The pitch a shop makes is never "we're cheap". It's "you'll never chase me."
  function script(p, stage, shop) {
    const name = shop?.name || 'our shop';
    const trade = shop?.trade || 'plumbing';
    const area = shop?.service_area_note || 'the area';

    switch (stage) {
      case 'voicemail': return {
        title: 'Voicemail — 20 seconds',
        note: 'Leave the trade, the town and a number. Nothing else sticks.',
        lines: [
          `Hi, this is ${name} — we're a ${trade} shop out of ${area}.`,
          `I'm calling because we keep a couple of slots open for property people who need someone same-day.`,
          `If your usual guy is ever booked, try us. I'll leave my number twice.`,
        ],
      };
      case 'retry': return {
        title: `Try ${(p.attempts || 1) + 1}`,
        note: 'Different time of day. Property people answer early or late, rarely midday.',
        lines: [
          `${greet(p)} It's ${name} again — ${trade}, ${area}. I'll be quick.`,
          `Do you have one shop you call for ${trade}, or are you still calling around?`,
          `— that answer tells you whether this is a 2-minute call or a 20-minute one.`,
        ],
      };
      case 'talking': return {
        title: 'Get on their list',
        note: 'You are not closing a job. You are becoming the number they call next time.',
        lines: [
          `Here's all I want: be the second number in your phone. When your first guy can't come, call us.`,
          `We answer 24/7 — a real booking, not a voicemail. That's the whole pitch.`,
          `What's the usual problem you're calling someone for — water heaters, drains, no heat?`,
          `Can I send you a card and put you in our system so you skip the intake next time?`,
        ],
      };
      case 'meeting': return {
        title: 'Walkthrough confirm',
        note: 'Text this the day before. Bring a card and a shoe cover.',
        lines: [
          `Confirming tomorrow — ${name}. I'll be there and out of your way in 15 minutes.`,
          `If a call pulls me, I'll text you early rather than leave you waiting.`,
        ],
      };
      default: return {
        title: 'First call',
        note: 'They get pitched constantly. Lead with availability, not price.',
        lines: [
          `${greet(p)}`,
          `This is ${name} — ${trade} shop, ${area}. Thirty seconds and I'll let you go.`,
          p.why ? `I saw ${bare(p)}.` : `I'm calling the property folks around here, not homeowners.`,
          `Who do you call right now when a tenant has no hot water on a Saturday?`,
          `— let it sit. Whatever they say is the opening.`,
          `That's us. We answer 24/7 and we book it on the call, so nobody's chasing you for an update.`,
          `Can I get you on our list so if your guy's booked you've got a backup?`,
        ],
      };
    }
  }

  const OBJECTIONS = [
    ['"We already have a plumber."',
     '"Good — I\'m not asking you to drop him. I want to be the backup for when he\'s three days out. Costs you nothing to have the number."'],
    ['"What are your rates?"',
     'Give the dispatch fee and nothing else. "Our service call is $X, and the tech prices the work before he starts." Never quote a repair over the phone.'],
    ['"Send me something."',
     '"I\'ll text you my card right now so you\'ve got the number in your phone — that\'s more use than an email." Then actually send it before you hang up.'],
    ['"Call me back in a few months."',
     'Take the date and put it in. "I\'ll make a note for March." People who say that and get a call in March are the easiest yes you\'ll get.'],
    ['"How fast can you get here?"',
     'This is a buying question. Answer with a real window and book it.'],
  ];

  // For whoever picks up the office phone when it isn't the AI.
  const DESK = [
    ['Someone calls for a price',
     'Never quote the repair. "The service call is $X and that comes off the work. The tech gives you an exact price before he touches anything." Then go straight to booking — a price question is a buying question.'],
    ['Caller is angry about a bill',
     'Let them finish without interrupting once. Then: "Let me pull it up and I\'ll have the owner call you back today." Do not argue the amount and do not promise a refund — that is the owner\'s call. Write down what they said, word for word.'],
    ['Tech is running late',
     'Call the customer BEFORE the window ends, not after. "He\'s running behind on the job ahead of you — he\'ll be there by X." A call before is an inconvenience; a call after is a bad review.'],
    ['Booking a job',
     'Name, address, zip, best callback number, and one line on what\'s wrong in their words. Confirm the number once, briefly. Tell them they\'ll get a text and that the tech texts when he\'s on the way.'],
    ['Emergency',
     'Safety step first, before anything else. Gas smell or sparking: leave the house, call 911 or the gas company, then come back to you. Water: find the shut-off. Then get the address and dispatch.'],
    ['Out of the service area',
     'Be quick and kind. "We don\'t get out that far, but you want someone local for this — it\'ll cost you less." Nobody resents a straight no.'],
    ['Asking for a review',
     'Only after the job is done and they sound happy. "If the tech did right by you, a Google review helps us more than anything." Then send the link while you\'re still on the phone.'],
  ];

  function stageFor(p) {
    if (p.status === 'meeting') return 'meeting';
    if (p.status === 'talking' || p.status === 'callback') return 'talking';
    if (p.status === 'voicemail') return 'voicemail';
    if (p.status === 'no_answer') return 'retry';
    return 'first';
  }

  window.CLIENT_SCRIPTS = { script, stageFor, OBJECTIONS, DESK };
})();
