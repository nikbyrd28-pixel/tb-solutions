// The content behind every generated SEO page. Edit this file, run `node tools/seo-build.mjs`,
// and the pages, sitemap and llms.txt regenerate. Never hand-edit anything under the
// generated folders — the build overwrites them.
//
// Rule that outranks everything else here: never add an entry you have nothing real and
// specific to say about. A thin page drags the whole site down. Leaving a slot empty is free.

export const SITE = {
  name: 'TB Solutions',
  domain: 'https://tbsol.net',
  tagline: 'The front office for the trades',
  owner: 'Nick Byrd',
  base: 'Pottstown, PA',
  phoneDemo: '(610) 998-6138',
  phoneDemoE164: '+16109986138',
  cell: '(484) 841-8501',
  cellE164: '+14848418501',
  area: 'Chester County, Montgomery County and the 422 corridor',
};

// Prices live in ONE place. They must match /offers/ exactly — if they drift, the site lies.
export const SERVICES = [
  {
    slug: 'ai-receptionist-for-contractors',
    name: 'Never Miss a Call',
    h1: 'AI receptionist for plumbers, HVAC and electricians',
    title: 'AI Receptionist for Contractors | Chester County, PA',
    desc: 'An AI receptionist that answers in your company name when your line rings out, books the job into your arrival windows, and texts you. $297 setup, $197/mo.',
    eyebrow: 'Never Miss a Call',
    setup: '$297', setupList: '$497', monthly: '$197',
    promise: 'If it does not book you a job in 30 days, the month is refunded.',
    lead: 'Your phone rings while you are under a sink. It goes to voicemail, and that homeowner calls the next shop on the list. This answers instead.',
    body: [
      ['What it actually does on a call',
       'It picks up only after your own line rings out, so it never gets between you and a customer you would have answered. It asks what is wrong, gives the safety step for that problem — shut the cold-water valve on top of the tank, turn the gas knob off — checks the caller is inside your service area, states your dispatch fee plainly, and books into the arrival windows you actually run. Then it texts the customer a confirmation and texts you the job: name, address, zip, callback number and the problem in their words.'],
      ['What it will never do',
       'It will not quote a repair. Ever. It states the dispatch fee and says the tech prices the work on site, because a number guessed over the phone is a number you have to argue about in someone\'s basement. It will not claim to be a person — asked straight out, it says it is the automated line. And it will not book outside your hours or past your capacity.'],
      ['Emergencies',
       'Gas smell or a burning outlet, it tells them to leave the house and call 911 or the gas company before it does anything else. A burst pipe at 9pm either rings your cell, or books same-night at your after-hours fee, or takes a message for the morning — you choose which, per line.'],
      ['Setup is one call and one forwarding code',
       'A 20-minute call with me to get your services, fees, hours and service area into it. Then you dial one carrier forwarding code on your business phone so unanswered calls roll to it. That is the whole onboarding. Your number stays yours, your Google stays yours, and you cancel by texting me.'],
    ],
    faq: [
      ['Do I have to change my phone number?', 'No. You keep your number. You set it to forward to the receptionist only when you do not pick up, so nothing changes for callers who reach you directly.'],
      ['What does it cost to run?', 'The service is $197 a month with a $297 setup for the first five shops ($497 after). There is no contract and no per-call fee from me.'],
      ['Will customers know it is not a person?', 'If they ask, it tells them honestly that it is the automated line and then keeps booking. Most callers do not ask — they want the appointment.'],
      ['What if it books a job I cannot take?', 'It only offers windows you told it you run, and it stops offering a window once it hits the number of jobs you can do in it.'],
    ],
  },
  {
    slug: 'google-local-services-ads-management',
    name: 'Lead Engine',
    h1: 'Google Local Services Ads, run properly',
    title: 'Google Local Services Ads Management for Contractors | PA',
    desc: 'Google Guaranteed setup or migration, campaign rebuilt, budget capped, and junk leads disputed weekly so you get the credits back. $297 setup, $147/mo.',
    eyebrow: 'Lead Engine',
    setup: '$297', setupList: '$497', monthly: '$147',
    promise: 'Your lead spend is paid to Google directly. I never touch it.',
    lead: 'The Google Guaranteed badge at the top of the search results, with someone actually minding the budget and disputing the garbage.',
    body: [
      ['The disputes are the job',
       'Local Services Ads charges you per lead, and a real share of those leads are wrong-number, out-of-area, or somebody shopping a job you do not do. Google will credit them back, but only if someone files the dispute inside the window. That is the weekly work: review every lead, dispute the junk, chase the credits.'],
      ['Budget watch',
       'LSA spend creeps. A category change or a quiet week in your area can push your cost per lead up without anything in your account looking different. The budget is capped and flagged same-day if spend moves.'],
      ['Setup or migration',
       'If you are not on LSA yet, that is the application, the license and insurance verification, and the category setup. If you are already running it, it is an audit and a rebuild of what is there — plus exporting your lead history before Google deletes it.'],
    ],
    faq: [
      ['Is the ad spend included?', 'No, and it should not be. You pay Google directly for leads so you control the budget and can see every charge. My fee is $147 a month to run it.'],
      ['How fast does the badge show up?', 'Google Guaranteed verification takes a couple of weeks and depends on your license and insurance paperwork clearing, not on me.'],
      ['What if the leads are bad?', 'That is exactly what the weekly dispute work is for. Bad leads get filed and credited back instead of quietly costing you money.'],
    ],
  },
  {
    slug: 'google-review-automation',
    name: 'Review Engine',
    h1: 'Google reviews on autopilot',
    title: 'Google Review Automation for Contractors | Chester County',
    desc: 'Every finished job gets a text asking for a Google review, timed and worded right, one tap. Unhappy customers route to you first. $97/mo, no setup fee.',
    eyebrow: 'Review Engine',
    setup: 'no setup fee', setupList: 'no setup fee', monthly: '$97',
    promise: 'No setup fee, month to month.',
    lead: 'Reviews are the whole ballgame in the map pack, and nobody with a truck and a schedule is going to remember to ask. This asks for you.',
    body: [
      ['Timed, not blasted',
       'The request goes out after the job is finished, not the second the invoice sends. One text, a one-tap link straight to your Google review form, and one polite follow-up if nothing happens. That is it — nobody gets nagged.'],
      ['The unhappy ones come to you first',
       'Before anyone is pointed at Google, they are asked how it went. A bad answer routes to you as a private message instead of a public one-star. You get the chance to fix it while it is still fixable.'],
      ['Why it matters more than your website',
       'For "plumber near me" the map pack sits above every organic result, and review count and recency are most of what decides who shows up in it. A shop with 40 recent reviews beats a shop with 200 from four years ago.'],
    ],
    faq: [
      ['Is this against Google\'s rules?', 'No. Asking every customer for a review is fine. Offering money for reviews, or only asking the happy ones, is not — so this asks everyone and simply routes complaints to you first.'],
      ['How many reviews will I get?', 'Depends entirely on your job volume and how good your work is. The honest answer is that a shop doing 40 jobs a month typically lands a handful, every month, instead of none.'],
    ],
  },
  {
    slug: 'websites-for-contractors',
    name: 'Job-Ready Website',
    h1: 'A one-page website that books jobs',
    title: 'Websites for Plumbers, HVAC & Electricians | Chester County',
    desc: 'One fast mobile page built to convert a homeowner holding a phone over a leak: click-to-call, service area, reviews, a form that texts you. $497 build, $47/mo.',
    eyebrow: 'Job-Ready Website',
    setup: '$497', setupList: '$497', monthly: '$47',
    promise: 'Live in a week. Edits and hosting included in the monthly.',
    lead: 'Nobody reads a contractor website. They are standing in water holding a phone, and they need the call button.',
    body: [
      ['Built for the thumb, not the desktop',
       'One page, loads fast on a bad signal, with the phone number fixed where a thumb lands. Service area, what you do, your reviews, and a form that texts you instead of sending an email nobody opens. No slider, no stock photo of a smiling man in a hard hat, no five-page menu.'],
      ['It matches your Google profile',
       'Name, address, phone and service area are written to match your Google Business Profile exactly, because mismatches between the two are a quiet drag on local ranking.'],
    ],
    faq: [
      ['How long does it take?', 'Live in a week, assuming you can get me your service area, your hours and a few photos of real work.'],
      ['Do I own it?', 'Yes. Your domain, your content, your Google account. Always yours.'],
    ],
  },
];

// Trades. Each needs its own real detail — the safety steps and the emergency calls differ.
export const TRADES = [
  { slug: 'plumbers', name: 'plumbers', trade: 'plumbing', nameSingular: 'plumber',
    calls: 'water heater leaks, burst pipes, sewer backups, no hot water and clogged mains',
    emergency: 'A tank letting go at 8pm is not a call that waits until morning — they are calling down the list until someone picks up.',
    safety: 'the cold-water shut-off on top of the tank, or the main where the line comes into the basement' },
  { slug: 'hvac-companies', name: 'HVAC companies', trade: 'HVAC', nameSingular: 'HVAC company',
    calls: 'no heat, no cooling, frozen lines, thermostat failures and furnace lockouts',
    emergency: 'No heat in February is an emergency with a clock on it, and every hour on voicemail is a job gone.',
    safety: 'the furnace switch and the thermostat batteries before anyone is dispatched' },
  { slug: 'electricians', name: 'electricians', trade: 'electrical', nameSingular: 'electrician',
    calls: 'dead outlets, tripping breakers, panel work, burning smells and partial power loss',
    emergency: 'A burning smell or a sparking panel is a 911-first call, and it still has to be logged and dispatched.',
    safety: 'kill the breaker, and leave the house for anything burning or sparking' },
];

// Towns. Keep this list to places the work is genuinely done.
export const TOWNS = [
  'Pottstown', 'Phoenixville', 'West Chester', 'Exton', 'Downingtown', 'Royersford',
  'Collegeville', 'Spring City', 'Limerick', 'Boyertown', 'Malvern', 'Paoli',
  'Kennett Square', 'Coatesville', 'Norristown', 'Conshohocken',
];

// Long-form pages. These are the backlink earners — they only work if they teach something.
export const GUIDES = [
  {
    slug: 'what-a-missed-call-costs-a-contractor',
    title: 'What a Missed Call Actually Costs a Contractor',
    desc: 'The arithmetic on missed calls for a small plumbing, HVAC or electrical shop: how many you miss, how many book elsewhere, what it is worth over a year.',
    h1: 'What a missed call actually costs you',
    lead: 'Not a scare number. Just the arithmetic, using your own job values.',
    body: [
      ['Start with how many you actually miss',
       'Pull your call log for last month and count the inbound calls under 20 seconds with no callback. That is your miss count, and for an owner-operated shop it is usually between 15 and 40 percent of inbound — higher if your Google listing says you are closed weekends, because those calls still come.'],
      ['Most of them do not call back',
       'A homeowner with water on the floor does not leave a voicemail and wait. They go back to the search results and call the next one. The ones who do leave a message are usually the ones who already know you.'],
      ['Put your own number on it',
       'Take your average job value — for most shops around here a service call plus the work lands somewhere between $300 and $600 — and multiply by the calls you missed that would have booked. Even at a conservative one-in-three, a shop missing 20 calls a month is leaving several thousand dollars a month on the table.'],
      ['What to do about it without hiring anyone',
       'The options are a human answering service that takes messages, a family member who is already busy, or something that actually books the job into your calendar. The first two produce a callback list. Only the third produces an appointment.'],
    ],
    faq: [
      ['How do I count my missed calls?', 'Your carrier\'s call log, or your cell\'s recents. Count inbound calls under 20 seconds with no outbound call back to that number the same day.'],
      ['Is an answering service cheaper?', 'Usually not, once you compare per-minute pricing against a flat monthly, and a service takes a message rather than booking the job.'],
    ],
  },
  {
    slug: 'why-contractors-lose-weekend-calls',
    title: 'Why Contractors Lose Weekend Calls',
    desc: 'If your Google profile says closed Saturday you still get Saturday calls — they go to voicemail. What the hours field does, and how to cover weekends.',
    h1: 'Why your weekend calls disappear',
    lead: 'Your hours field does not stop the phone ringing. It just stops you answering it.',
    body: [
      ['"Closed Saturday" does not mean nobody calls',
       'Google still shows your listing on Saturday. It shows it with "Closed" next to it, which does two things: it tells the homeowner to try someone else, and it tells the ones who call anyway that they are reaching a voicemail. Emergencies do not read the hours field.'],
      ['Weekends are when the expensive jobs happen',
       'People are home. They run laundry, they use the basement, they notice the puddle. Weekend calls skew toward emergencies, which skew toward the higher-ticket work and the after-hours fee.'],
      ['The fix is not working weekends',
       'It is having the call answered and triaged so the genuine emergency reaches you and everything else books itself into Monday morning. You get the one call worth driving for and the rest arrive as appointments.'],
      ['While you are in there, fix the hours',
       'If you take emergency calls on weekends, your profile should not say closed. Set the hours you actually answer, because "Closed" on a Saturday search is a competitor\'s best friend.'],
    ],
    faq: [
      ['Should I just list 24 hours?', 'Only if someone genuinely picks up at 2am. Listing hours you do not keep produces one-star reviews that say nobody answered.'],
      ['Does the hours field affect ranking?', 'It affects whether people click, and whether they call. Open businesses get the call; that behaviour feeds back into how often you get shown.'],
    ],
  },
];
