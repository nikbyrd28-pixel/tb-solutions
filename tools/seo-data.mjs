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
// Per service: `setup` is the founding rate (first five shops), `setupList` the list price the page
// leads with; `cta`/`leadKey` feed the lead form (lead.js); `bullets` are the three lines in the
// price tag; `mark` is the phrase in the h1 that gets highlighted; `label` overrides the public name.
export const SERVICES = [
  {
    slug: 'ai-receptionist-for-contractors',
    name: 'Never Miss a Call',
    h1: 'AI receptionist for plumbers, HVAC and electricians',
    mark: 'electricians',
    title: 'AI Receptionist for Contractors | Chester County, PA',
    desc: 'An AI receptionist that answers in your company name when your line rings out, books the job into your arrival windows, and texts you. $497 setup, $197/mo.',
    eyebrow: 'Never Miss a Call',
    setup: '$297', setupList: '$497', monthly: '$197',
    cta: 'Get my phones answered', leadKey: 'receptionist',
    bullets: ['Answers in your company name when your line rings out', 'Books into your real arrival windows', 'Texts you the job, texts the customer a confirmation'],
    promise: 'If it does not book you a job in 30 days, the month is refunded.',
    lead: 'Your phone rings while you are under a sink. It goes to voicemail, and that homeowner calls the next shop on the list. This answers instead.',
    body: [
      ['What it actually does on a call',
       'It picks up only after your own line rings out, so it never gets between you and a customer you would have answered. It asks what is wrong, gives the safety step for that problem (shut the cold-water valve on top of the tank, turn the gas knob off), checks the caller is inside your service area, states your dispatch fee plainly, and books into the arrival windows you actually run. Then it texts the customer a confirmation and texts you the job: name, address, zip, callback number and the problem in their words.'],
      ['What it will never do',
       'It will not quote a repair. Ever. It states the dispatch fee and says the tech prices the work on site, because a number guessed over the phone is a number you have to argue about in someone\'s basement. It will not claim to be a person. Asked straight out, it says it is the automated line. And it will not book outside your hours or past your capacity.'],
      ['Emergencies',
       'Gas smell or a burning outlet, it tells them to leave the house and call 911 or the gas company before it does anything else. A burst pipe at 9pm either rings your cell, or books same-night at your after-hours fee, or takes a message for the morning. You choose which, per line.'],
      ['Setup is one call and one forwarding code',
       'A 20-minute call with me to get your services, fees, hours and service area into it. Then you dial one carrier forwarding code on your business phone so unanswered calls roll to it. That is the whole onboarding. Your number stays yours, your Google stays yours, and you cancel by texting me.'],
    ],
    faq: [
      ['Do I have to change my phone number?', 'No. You keep your number. You set it to forward to the receptionist only when you do not pick up, so nothing changes for callers who reach you directly.'],
      ['What does it cost to run?', 'The service is $197 a month with a $497 setup. Founding rate for the first 5 shops: $297 setup. There is no contract and no per-call fee from me.'],
      ['Will customers know it is not a person?', 'If they ask, it tells them honestly that it is the automated line and then keeps booking. Most callers do not ask. They want the appointment.'],
      ['What if it books a job I cannot take?', 'It only offers windows you told it you run, and it stops offering a window once it hits the number of jobs you can do in it.'],
    ],
  },
  {
    slug: 'google-local-services-ads-management',
    name: 'Lead Engine',
    h1: 'Google Local Services Ads, run properly',
    mark: 'run properly',
    title: 'Google Local Services Ads Management for Contractors | PA',
    desc: 'Google Guaranteed setup or migration, the account rebuilt, budget capped, and junk calls disputed weekly so you get the credits back. $497 setup, $147/mo.',
    eyebrow: 'Google Guaranteed Setup',
    label: 'Google Guaranteed Setup',   // what /offers/ and the nav call it
    setup: '$297', setupList: '$497', monthly: '$147',
    cta: 'Get me Google Guaranteed', leadKey: 'leads',
    bullets: ['Setup or migration into Google Ads', 'Budget capped and watched', 'Junk calls disputed every week'],
    promise: 'Your lead spend is paid to Google directly. I never touch it.',
    lead: 'The Google Guaranteed badge at the top of the search results, with someone actually minding the budget and disputing the garbage.',
    body: [
      ['The disputes are the job',
       'Local Services Ads charges you per call (Google calls them "leads"), and a real share of those calls are wrong-number, out-of-area, or somebody shopping a job you do not do. Google will credit them back, but only if someone files the dispute inside the window. That is the weekly work: go through every call, dispute the junk, chase the credits.'],
      ['Budget watch',
       'LSA spend creeps. A category change or a quiet week in your area can push what you pay per call up without anything in your account looking different. The budget is capped and flagged same-day if spend moves.'],
      ['Setup or migration',
       'If you are not on LSA yet, that is the application, the license and insurance verification, and the category setup. If you are already running it, it is a checkup and a rebuild of what is there, plus saving your call history before Google deletes it.'],
    ],
    faq: [
      ['Is the ad spend included?', 'No, and it should not be. You pay Google directly for the calls so you control the budget and can see every charge. My fee is $147 a month to run it.'],
      ['How fast does the badge show up?', 'Google Guaranteed verification takes a couple of weeks and depends on your license and insurance paperwork clearing, not on me.'],
      ['What if the calls are junk?', 'That is exactly what the weekly dispute work is for. Junk calls get filed and credited back instead of quietly costing you money.'],
    ],
  },
  {
    slug: 'google-review-automation',
    name: 'Review Engine',
    h1: 'Google reviews on autopilot',
    mark: 'autopilot',
    title: 'Google Review Automation for Contractors | Chester County',
    desc: 'Every finished job gets a text asking for a Google review, timed and worded right, one tap. Unhappy customers route to you first. $97/mo, no setup fee.',
    eyebrow: 'Review Engine',
    setup: 'no setup fee', setupList: 'no setup fee', monthly: '$97',
    cta: 'Start getting reviews', leadKey: 'reviews',
    bullets: ['One text after every finished job, one-tap link', 'Unhappy customers routed to you first', 'One polite follow-up, nobody gets nagged'],
    promise: 'No setup fee, month to month.',
    lead: 'Reviews are the whole ballgame in the map pack, and nobody with a truck and a schedule is going to remember to ask. This asks for you.',
    body: [
      ['Timed, not blasted',
       'The request goes out after the job is finished, not the second the invoice sends. One text, a one-tap link straight to your Google review form, and one polite follow-up if nothing happens. That is it. Nobody gets nagged.'],
      ['The unhappy ones come to you first',
       'Before anyone is pointed at Google, they are asked how it went. A bad answer routes to you as a private message instead of a public one-star. You get the chance to fix it while it is still fixable.'],
      ['Why it matters more than your website',
       'For "plumber near me" the map pack sits above every organic result, and review count and recency are most of what decides who shows up in it. A shop with 40 recent reviews beats a shop with 200 from four years ago.'],
    ],
    faq: [
      ['Is this against Google\'s rules?', 'No. Asking every customer for a review is fine. Offering money for reviews, or only asking the happy ones, is not. So this asks everyone and simply routes complaints to you first.'],
      ['How many reviews will I get?', 'Depends entirely on your job volume and how good your work is. The honest answer is that a shop doing 40 jobs a month typically lands a handful, every month, instead of none.'],
    ],
  },
  {
    slug: 'websites-for-contractors',
    name: 'Job-Ready Website',
    h1: 'A one-page website that books jobs',
    mark: 'books jobs',
    title: 'Websites for Plumbers, HVAC & Electricians | Chester County',
    desc: 'One fast mobile page built to turn a homeowner holding a phone over a leak into a booked call: click-to-call, service area, reviews, a form that texts you. $497 build, $47/mo.',
    eyebrow: 'Job-Ready Website',
    setup: '$497', setupList: '$497', monthly: '$47',
    cta: 'Get my site started', leadKey: 'websites',
    bullets: ['Live in a week', 'Click-to-call, reviews, a form that texts you', 'Matched to your Google Business Profile'],
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
//
// Optional per-trade fields, used when present (otherwise the build falls back to the template):
//   title, h1, desc  — the search phrase the page is written for
//   mark             — the words in h1 to highlight (defaults to the whole trade name)
//   body             — extra [heading, paragraph] blocks, only things true for THAT trade
//   faq              — extra questions, appended to the template's
// A trade only gets these once there is a real keyword behind it (seo_keywords) and 400 honest
// words to put under it. Until then the template is enough.
export const TRADES = [
  { slug: 'plumbers', name: 'plumbers', trade: 'plumbing', nameSingular: 'plumber',
    calls: 'water heater leaks, burst pipes, sewer backups, no hot water and clogged mains',
    emergency: 'A tank letting go at 8pm is not a call that waits until morning. They are calling down the list until someone picks up.',
    safety: 'the cold-water shut-off on top of the tank, or the main where the line comes into the basement',
    // Written for "plumbing answering service" and "ai answering service for plumbers" (seo_keywords, 2026-10-07).
    title: 'Plumbing Answering Service That Books the Job | Pottstown PA',
    h1: 'A plumbing answering service that books the job',
    mark: 'books the job',
    desc: 'An AI answering service for plumbers near Pottstown: picks up when you cannot, gives the shut-off step, books your arrival windows, texts you. $497 setup, $197/mo.',
    body: [
      ['It knows the difference between a drip and a flood',
       'Most answering services take the same message for a leaking tank as for a slow bathroom drain. This one sorts them the way you would. Water on the floor from the heater: it tells them to shut the cold-water valve on top of the tank and, on a gas unit, turn the knob to off, then it treats the call as urgent. Burst pipe: find the main where the line comes into the basement and shut it (clockwise on a round handle, a quarter turn on a lever), then urgent. Sewer backing up: stop running water, nobody flushes, no laundry, and it books the first window you have. No hot water but the basement is dry: that is a morning job, not a 9pm one, and it books it that way instead of ringing your cell at dinner.'],
      ['What not to book is as important as what to book',
       'Around here a lot of houses are on a well and a septic tank. If you do not touch well pumps, or you will not do a septic line, it goes on the do-not-book list during setup and the receptionist says so politely and gets off the phone. Same for towns outside your area, jobs for the trade you do not run, and the customer who wants a quote over the phone. You decide the list on the setup call, and you change it by texting me.'],
      ['After hours is your rule, not mine',
       'Pick one per line. A plumbing emergency rings your cell while they are still on the phone. Or it books same-night at your after-hours fee and you decide in the morning whether that fee was worth getting out of bed for. Or it takes the details and promises a callback inside fifteen minutes. A sensible split is the first rule for anything spraying and the third for everything else, and that is the point: it should sound like your dispatcher, not a call center in another state. If a number rings out and hangs up, it gets a text inside thirty seconds in your company name asking what is going on and offering to book. For a homeowner with one hand on the phone and the other on a towel, a text is easier to answer than a second call.'],
    ],
    faq: [
      ['Is this a plumbing answering service or an AI?', 'It is an AI answering service for plumbers. It is not a room of operators and it does not pretend to be one. If a caller asks, it says it is the shop\'s automated line and keeps booking. Call the demo line and decide for yourself whether a customer would hang up on it.'],
      ['What does a plumbing answering service cost?', 'This one is $197 a month flat, with a $497 setup. Founding rate for the first 5 shops: $297 setup. No per-minute meter and no per-call fee. The services that take messages usually land somewhere in the same range once the minutes are added up, and they book nothing.'],
      ['Does it dispatch my techs?', 'No. It books the job into the windows you run and texts you. Who goes is still your call. For an emergency it can ring your cell live so you can make that call while the customer is on the line.'],
    ],
  },
  { slug: 'hvac-companies', name: 'HVAC companies', trade: 'HVAC', nameSingular: 'HVAC company',
    calls: 'no heat, no cooling, frozen lines, thermostat failures and furnace lockouts',
    emergency: 'No heat in February is an emergency with a clock on it, and every hour on voicemail is a job gone.',
    safety: 'the furnace switch and the thermostat batteries before anyone is dispatched',
    // Written for "hvac after hours answering service" (seo_keywords, 2026-10-10).
    title: 'HVAC After Hours Answering Service That Books | Pottstown PA',
    h1: 'An HVAC after hours answering service that books the job',
    mark: 'books the job',
    desc: 'After hours answering for HVAC companies near Pottstown: picks up a no-heat call at 11pm, runs the checks you would, books it or rings you. $497 setup, $197/mo.',
    body: [
      ['After hours is where HVAC loses the most',
       'A plumber\'s emergencies spread across the week. Yours stack up on the coldest night of January and the first ninety-degree Saturday in June, and they all land at once. The furnace locks out at 11pm, the homeowner tries it twice, then they are on Google. If your line goes to voicemail they are calling the next company in the results while your greeting is still playing. An after hours answering service is not a luxury line item for an HVAC shop. It is the difference between booking the season\'s best calls and reading about them in the morning.'],
      ['It runs the checks you would run on the phone',
       'Before anyone drives out, it walks the caller through the things you already ask. Is the thermostat screen blank: put fresh batteries in it. Is the switch on the side of the furnace, the one that looks like a light switch, actually on. Is the breaker for the air handler or the outdoor unit tripped. Oil heat: is there oil in the tank, because around here a good share of no-heat calls in a cold snap are an empty tank, and that is a delivery, not a service call. No cooling with ice on the lines or the indoor coil: shut the system off at the thermostat, run the fan only, and book the first window you have, because nobody can diagnose a frozen coil until it thaws. Each of those closes a call you would otherwise send a truck to at midnight, and each of them is something you tell it on the setup call. If you do not want it touching the breaker question, it does not.'],
      ['Gas smell and CO are not service calls',
       'A gas smell, or a carbon monoxide alarm going off, gets one answer: leave the house, then call 911 or the gas company from outside. It says that before it asks for a name, and it does not book anything until the caller is out. If your rule is that those calls ring your cell live, it rings you while they are still on the line. Everything else (no heat, no cool, water from the air handler, a heat pump that will not come out of defrost) gets sorted into urgent or morning by the rules you set.'],
      ['No heat at 2am is your rule, not mine',
       'Pick one per line. No heat in the winter rings your cell while they are on the phone. Or it books same-night at your after-hours fee and tells them the fee out loud so nobody is surprised at the door. Or it takes the details and promises a callback inside fifteen minutes. A sensible split for an HVAC shop is the first or second rule for no heat between November and March, and the third for no AC at 2am, because a hot house at 2am is a 7am job and it should be booked like one. If you run a maintenance plan, it can ask whether they are on it and move plan members to the front. You decide what that means. If somebody hangs up before the fourth ring, they get a text in your company name inside thirty seconds asking what is going on and offering to book.'],
      ['What it will not book',
       'A system replacement is not an after hours call, and it is not a phone quote either. Somebody asking what a new furnace or a heat pump costs gets booked as an estimate visit at a time you would actually go look, and it says what you told it to say about whether that visit costs anything. If you do not do oil, boilers, geothermal, window units or commercial rooftops, it goes on the do-not-book list on the setup call and the receptionist says so politely and gets off the phone. Towns outside your area, same thing. You change the list by texting me. And it does not take a message and email it to you in the morning the way a human service does. It books the window, holds the slot, texts the customer a confirmation, and texts you the name, address, callback number and the problem in their words.'],
    ],
    faq: [
      ['Is this an HVAC answering service or an AI?', 'It is an AI answering service for HVAC companies. It is not a room of operators in another state and it does not pretend to be one. If a caller asks, it says it is the shop\'s automated line and keeps booking. Call the demo line at night and decide for yourself whether a customer with no heat would hang up on it.'],
      ['What does an HVAC after hours answering service cost?', 'This one is $197 a month flat, with a $497 setup. Founding rate for the first 5 shops: $297 setup. No per-minute meter, no per-call fee, no extra for nights and weekends. After hours is the whole point. A message-taking service usually lands in the same range once the winter minutes are added up, and it books nothing.'],
      ['Does it only answer after hours?', 'It answers whenever your own line rings out. Most shops forward to it after hours and on weekends, and a lot of them leave it on during the day too, because the calls you miss at 2pm while you are on a roof are the same calls you miss at 2am.'],
    ],
  },
  { slug: 'electricians', name: 'electricians', trade: 'electrical', nameSingular: 'electrician',
    calls: 'dead outlets, tripping breakers, panel work, burning smells and partial power loss',
    emergency: 'A burning smell or a sparking panel is a 911-first call, and it still has to be logged and dispatched.',
    safety: 'kill the breaker, and leave the house for anything burning or sparking',
    // Written for "electrician answering service" (seo_keywords, 2026-10-08).
    title: 'Electrician Answering Service That Books Jobs | Pottstown PA',
    h1: 'An electrician answering service that books the job',
    mark: 'books the job',
    desc: 'AI answering service for electricians near Pottstown: picks up when you cannot, sorts a dead outlet from a burning panel, books the job. $497 setup, $197/mo.',
    body: [
      ['Half your calls are not emergencies, and it knows which half',
       'An electrician\'s phone is different from a plumber\'s. A lot of what rings in is somebody who wants a price: a panel upgrade, an EV charger in the garage, a generator hookup, a service upgrade for the addition. None of that is a 9pm call and none of it should be quoted over the phone. The receptionist takes those as estimate visits: it gets the address, what they want done, whether the panel is inside or out, and books a window for you to go look. The other half is a dead circuit or a breaker that will not hold, and those it treats as service calls: fee stated, first window you have, your rules on after hours. Which jobs are an estimate and which are a service call is something you tell it on the setup call, not something it guesses.'],
      ['The safety step for the call that matters',
       'Burning smell, buzzing or sparking at the panel, a warm outlet cover, lights flickering through the whole house at once: it tells them to leave the house and call 911 before it does anything else, and then it rings your cell while they are still on the line, if that is the rule you set. A tripping breaker: leave it off, unplug what is on that circuit, and do not keep resetting it. A dead outlet in the kitchen, bath or garage: press the reset button on the nearest GFCI before anyone drives out. That last one closes a good share of "no power to my outlet" calls on the phone, which means you are not sending a truck for a thirty-second fix. And when it does not close it, you have a real job booked instead of a voicemail.'],
      ['What it will not book',
       'If you do not do lost-power calls where the problem is on the utility side of the meter, you can tell it to send those to the power company first. If you do not do commercial, low-voltage, or pool and hot tub wiring, it goes on the do-not-book list and the receptionist says so politely and gets off the phone. Same for towns outside your area and the caller who wants a number for a panel swap before anyone has seen the panel. You set the list once on the setup call and change it by texting me.'],
      [null,
       'After hours is your rule, not mine. A real emergency (anything burning, sparking or hot) rings your cell while they are still on the phone. A dead outlet at 10pm is a morning job and it gets booked like one, not rung through at dinner. If someone hangs up before the fourth ring, they get a text in your company name inside thirty seconds asking what is going on and offering to book.'],
    ],
    faq: [
      ['Is this an electrician answering service or an AI?', 'It is an AI answering service for electricians. It is not a room of operators and it does not pretend to be one. If a caller asks, it says it is the shop\'s automated line and keeps booking. Call the demo line and decide for yourself whether a customer would hang up on it.'],
      ['What does an electrician answering service cost?', 'This one is $197 a month flat, with a $497 setup. Founding rate for the first 5 shops: $297 setup. No per-minute meter and no per-call fee. A message-taking service usually lands in the same range once the minutes are added up, and it books nothing.'],
      ['Will it quote a panel upgrade?', 'No. It books an estimate visit for anything that needs a look (a panel, a service upgrade, an EV charger, a generator) and says what you told it to say about whether that visit costs anything. For a service call it states your fee and says the tech prices the work on site.'],
    ],
  },
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
    published: '2026-10-08',
    title: 'What a Missed Call Actually Costs a Contractor',
    desc: 'The arithmetic on missed calls for a small plumbing, HVAC or electrical shop: how many you miss, how many book elsewhere, what it is worth over a year.',
    h1: 'What a missed call actually costs you',
    mark: 'actually costs',
    blurb: 'Count last month\'s missed calls, multiply by your job value, and see what a ringing-out phone is costing you.',
    lead: 'Not a scare number. Just the arithmetic, using your own job values.',
    body: [
      ['Start with how many you actually miss',
       'Pull your call log for last month and count the inbound calls under 20 seconds with no callback. That is your miss count, and for an owner-operated shop it is usually between 15 and 40 percent of inbound, higher if your Google listing says you are closed weekends, because those calls still come.'],
      ['Most of them do not call back',
       'A homeowner with water on the floor does not leave a voicemail and wait. They go back to the search results and call the next one. The ones who do leave a message are usually the ones who already know you.'],
      ['Put your own number on it',
       'Take your average job value (for most shops around here a service call plus the work lands somewhere between $300 and $600) and multiply by the calls you missed that would have booked. Even at a conservative one-in-three, a shop missing 20 calls a month is leaving several thousand dollars a month on the table.'],
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
    published: '2026-10-08',
    title: 'Why Contractors Lose Weekend Calls',
    desc: 'If your Google profile says closed Saturday you still get Saturday calls. They go to voicemail. What the hours field does, and how to cover weekends.',
    h1: 'Why your weekend calls disappear',
    mark: 'weekend calls',
    blurb: 'Marking yourself closed on Saturday does not stop the calls, it just hands the emergencies to the next shop.',
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
  {
    // Written for "how much does an answering service cost for a plumber" (seo_keywords, 2026-10-11).
    // Figures: 2026 published rate cards and pricing guides for live answering services; BLS OEWS May 2025
    // for the receptionist wage. Re-check both before quoting them anywhere else.
    slug: 'answering-service-cost-vs-receptionist',
    published: '2026-10-11',
    title: 'How Much Does an Answering Service Cost a Plumber?',
    desc: 'What a plumber really pays for an answering service in 2026: per-minute, per-call and flat plans, the fees off the plan page, and what a receptionist costs.',
    h1: 'What an answering service actually costs a plumber',
    mark: 'actually costs',
    blurb: 'Per-minute, per-call, flat rate, or a person at a desk. The real numbers, and the one that matters: what you pay per booked job.',
    lead: 'The plan page says one number. Your bill says another. Here is how the math works for a shop with two trucks.',
    body: [
      ['The three ways they bill you',
       'Every answering service you will find for a plumbing shop charges one of three ways. Per minute: you buy a block of minutes a month and pay for every one an operator spends on your line. The big national names are billing $1.85 to $2.60 a minute in 2026, and the cheaper home-services rate cards run about $0.80 to $1.25. Per call: a flat $5 to $12 for every call an operator picks up, no matter how long it runs. Flat monthly: one price for everything, which is how most of the AI services bill and how a few of the human ones do once you are past their basic tier. The entry plans from the big per-minute services land somewhere between $235 and $350 a month and come with roughly 200 minutes. That is the number on the plan page. It is not the number on the bill.'],
      ['Do the minutes for your own shop',
       'A plumbing call is not a thirty-second call. A homeowner with water on the floor needs a minute to say what is wrong, a minute to give the address and callback, and a minute while the operator reads the script back. Call it three and a half minutes. A shop taking 100 calls a month through the service is burning 350 minutes, which blows through a 200-minute plan in the third week. At $1.85 to $2.60 a minute the whole month runs $650 to $900, and the overage minutes past your block are billed 20 to 50 percent higher than the plan rate. One pricing guide works the example out at 130 calls a month and lands between $940 and $1,170. Those are the calls you are already missing, so you do not get to pick a smaller number.'],
      ['The fees that are not on the plan page',
       'Setup fees are common and sometimes only waived if you sign a year. Warm transfers, where the operator rings you and hands the caller over, run about $3 each on some plans. Extra tracking numbers, a second transfer destination, a CRM connection: $5 to $15 a month per item. Spanish costs more. And if you ever leave, some of them charge $250 to $300 to port your number out, which is why you should never let an answering service own your phone number in the first place. Read the whole rate card, not the big number at the top of it.'],
      ['What a receptionist costs instead',
       'The Bureau of Labor Statistics puts the median receptionist at $18.27 an hour as of May 2025, which is $38,010 a year before you add the employer side of payroll tax, workers comp, a chair, and a computer. Call it $42,000 all in for one person, forty hours a week. A part-timer at twenty hours is still around $20,000 a year. And here is the problem a plumber runs into with either one: she works eight to five, Monday to Friday. Those are the hours you miss the fewest calls. The calls you lose are the 6pm water heater, the Saturday sewer backup, and the three that come in while you are under a sink with both hands wet. A receptionist is a good hire when you have the volume to keep her busy and an office for her to sit in. She is not a fix for the phone at night.'],
      ['What you are actually buying',
       'This is the part the plan pages skip. A per-minute service takes a message. The operator reads a script, writes down the name and number, and emails or texts you a note that says "customer has leak, please call back." You still have to call back, and by the time you do, the one with water on the floor has called the next shop. So the real question is not what the service costs a month. It is what it costs per booked job. A $700 month that produces a list of 100 callbacks is not the same thing as a $200 month that produces 40 appointments on your calendar, and the second one is cheaper even though it looks more expensive to a service that charges by the minute.'],
      ['The AI option, with the honest caveats',
       'An AI receptionist is the flat-rate end of this. The one I run for plumbers around Pottstown is $197 a month, with a $497 setup, or $297 setup at the founding rate for the first five shops. No per-minute meter, no per-call fee, no extra for nights and weekends, and it books the job into the arrival windows you run instead of taking a message. What it does not do: it will not sound like a person who has worked your desk for twelve years, it will not quote a repair over the phone, and if a caller asks, it says it is the automated line. Some owners are not comfortable with that, and that is a fair reason to pick a human service. Just price the human service on the minutes you will actually use, and count what you get at the end of the month: a callback list or a booked calendar.'],
      ['The short version',
       'Per-minute human service, used by a plumbing shop that is honest about its call volume: $600 to $1,200 a month, for messages. Per-call: $5 to $12 a call, same result. A receptionist: around $42,000 a year, for the hours you already cover yourself. An AI receptionist: a couple hundred a month flat, for bookings. Run your own missed-call count against each one before you sign anything, and never sign a year.'],
    ],
    faq: [
      ['What is the cheapest answering service for a plumber?', 'On paper, a 200-minute per-minute plan at around $235 to $350 a month. In practice that plan is gone by the third week for a shop taking 100 calls through it, and the overage is what you pay. The cheapest option is the one with the lowest cost per booked job, which is almost never the one with the lowest number on the plan page.'],
      ['Per-minute or per-call, which is better for plumbing?', 'Per-call if your calls run long, which plumbing calls do. Per-minute if most of your calls are quick confirmations. Either way, ask for a sample bill from a shop your size, not the rate card.'],
      ['Does an answering service book appointments?', 'Most human services take a message and send it to you. Some will book into a shared calendar for an extra per-call or per-transfer fee. The AI receptionist books directly into your arrival windows as part of the flat $197 a month, and texts both you and the customer.'],
      ['Is an answering service cheaper than a receptionist?', 'For an owner-operated shop, yes, by a wide margin: a few hundred a month against roughly $42,000 a year all in. But the receptionist is there eight to five and the calls you miss are mostly outside those hours, so the comparison that matters is between the services that answer when you cannot.'],
    ],
  },
  {
    // Written for "google local services ads for plumbers" (seo_keywords, 2026-10-12).
    // Facts: Google's Aug 24 2026 "Upcoming changes to lead charge policy" notice (missed calls charged from
    // Oct 1 2026, 20-second rule, follow-ups within 15 days count once — via ppc.land / Search Engine Roundtable);
    // the July 2024 removal of manual lead disputes (Blue Corona); per-lead averages from SearchLight's
    // Feb 2026 dataset (230 plumbing accounts); PA licensing from pa.gov (no statewide trade license, HICPA
    // registration over $5,000/yr, $50k/$50k insurance). Re-check all of it before quoting elsewhere.
    slug: 'local-services-ads-for-plumbers',
    published: '2026-10-12',
    title: 'Google Local Services Ads for Plumbers: How It Really Works',
    desc: 'What a plumber pays per lead on Google Local Services Ads, the Oct 2026 missed-call charge, why the dispute button is gone, and what the badge takes in PA.',
    h1: 'Local Services Ads for plumbers: what you actually pay for',
    mark: 'actually pay for',
    blurb: 'The green badge at the top of search, priced per call. What a lead costs, the new missed-call charge, and what the badge takes in PA.',
    lead: 'Google charges you per call, not per click. Since October 1 it charges you for the calls you miss, too. Here is the whole thing, without the agency gloss.',
    body: [
      ['Where it sits and how it bills',
       'Search "plumber near me" on a phone around here and the first thing on the screen is a short row of shops with a green "Google Guaranteed" check mark. That is Local Services Ads. It sits above the regular paid ads and above the map pack, which is why everybody wants in. You do not bid on keywords and you do not pay for clicks. Google sets a price per lead for your trade and your area, you set a budget cap, and you are billed when a homeowner calls or messages you through the ad. A lead is a call, not a job. Google decides what counts as a valid lead, and that definition just changed, which is the part of this page worth reading twice.'],
      ['What a plumbing lead costs',
       'Google does not publish a rate card, so the honest numbers come from agencies that run a lot of accounts. One of them published its February 2026 figures across 230 plumbing accounts: about $57 a lead on average, with roughly 44 percent of those leads turning into a booked job. Quieter markets run closer to $30 a lead and crowded metros past $90. Pottstown and the 422 corridor sit somewhere between the farm-country number and the Philly-suburb number, and I am not going to guess where, because your first month tells you exactly. The figure that matters is not the lead price anyway. It is cost per booked job: $57 a lead at 44 percent booked is about $130 to put a truck in a driveway. Put that against your average ticket and you know in one line whether this is worth running.'],
      ['The October 1 rule: missed calls now cost money',
       'Until this fall, a call you did not pick up was not a lead. You were charged when you actually spoke to the customer, when they left a voicemail, or when you called a missed number back and connected. On August 24, 2026 Google sent every LSA advertiser a notice titled "Upcoming changes to lead charge policy," and from October 1, 2026 it reads: "Missed calls during business hours will now be charged as valid leads." The rule is that the caller stays on the line more than 20 seconds. Whether you picked up does not matter. If the same person calls back inside 15 days it counts as one lead, not two. There is a loophole where a press-1 menu starts the clock only after the key press, and I would not use it, because a homeowner with water on the floor hangs up on menus and calls the next shop. So the practical rule for a plumber on LSA now is simple: the number on that ad has to get answered during the hours you list, by you, by somebody in the office, or by something. Otherwise you are paying Google for calls that went to voicemail and then went to a competitor.'],
      ['The dispute button is gone',
       'Every LSA guide you will find still tells you to "dispute junk leads." You cannot, not the way they mean. In July 2024 Google took away the manual dispute and replaced it with its own review: it looks at each charged lead on its own and credits the ones it decides are spam, wrong numbers or duplicates. One write-up puts that automated look inside 72 hours of the charge, with the credit showing up within about 30 days. What you have left is a "Rate this lead" button in the lead inbox. You have 30 days from the lead, you pick "very dissatisfied" and the most specific reason there is, and Google says it will "occasionally" credit what you report. Two things no longer get credited at all: a call for a job type you do not do, and a call from outside your area. Your only protection against those is the account itself, which means only the job types you actually run are switched on, and the service area is the zip codes you actually drive to, not a 40-mile circle. That is what the weekly review on my Lead Engine is: every charged lead read, the junk rated, and the job types and area trimmed so the junk stops showing up. The site calls it disputing because that is the word every plumber uses. Google calls it feedback.'],
      ['What the badge takes in Pennsylvania',
       'Three things. Google\'s background-check vendor runs the owner and every tech who goes into a customer\'s home; Google pays for it. A certificate of general liability insurance. And whatever license your state requires for your trade. That last one trips people up here, because Pennsylvania does not license plumbers or HVAC statewide. The Commonwealth says so on its own contractor-licensing page: it has "no licensure or certification requirements for most construction contractors," and leaves it to boroughs and townships, which is why Philadelphia requires its own plumbing license and a number of townships across the state issue their own master plumber card. Check yours before you apply and have the card handy. What the state does require is the Home Improvement Contractor registration with the Attorney General if you do more than $5,000 a year of home improvement work, with $50,000 in liability and $50,000 in property-damage coverage, and that PA number is supposed to be on every ad you run anyway. Have the HIC number, the insurance certificate and your local license if your township issues one ready before you start the application, because verification takes a couple of weeks and every missing document adds a week. The guarantee itself is Google\'s: a customer unhappy with the work can claim up to $2,000, lifetime, and Google pays it, not you.'],
      ['What decides whether you are first or fourth',
       'Google is fairly open about this one. The LSA unit ranks on your review score and review count, how fast you respond to calls and messages, your business hours, whether there have been serious or repeated complaints, how close you are to the person searching, and your budget. Reviews come from your Google Business Profile, which has to be linked to the LSA account and match it on name, phone and service area, or the ads do not run. Responsiveness is measured honestly: Google routes the calls through its own tracking numbers, so it knows whether you picked up, and a string of missed calls pushes you down the list on top of now costing you money. Proximity you cannot change. Budget you can, a little. The two that move inside a month for a two-truck shop are answering the phone and asking every finished job for a review.'],
      ['Should a two-truck shop run it?',
       'Yes, if you have the insurance and you can get the phone answered between the hours you list. No, or not yet, if the phone goes to voicemail every time you are under a sink, because since October that is a bill with nothing booked against it. If you run it: cap the budget at a number you can stomach for a month, switch on only the jobs you do, set the service area to the zips you will actually drive to on a Tuesday, and read every charged lead once a week. If you do not want to do that reading yourself, that is the Lead Engine, $147 a month with a $497 setup, or $297 setup at the founding rate for the first five shops. The lead spend goes to Google directly. I never touch it. And if the missed-call rule is the thing that worries you, the receptionist answers the LSA line when you cannot and books the job, so the call you are now paying for at least turns into an appointment.'],
    ],
    faq: [
      ['How much does a Local Services Ads lead cost a plumber?', 'Google sets the price by trade and area and does not publish it. Agencies that run a lot of plumbing accounts were reporting an average around $57 a lead in early 2026, from about $30 in quiet markets to $90 and up in big metros. Your own first month is the only number that matters for your shop.'],
      ['Do I get charged if I miss the call?', 'Since October 1, 2026, yes: a missed call during your listed business hours where the caller stays on the line more than 20 seconds is billed as a valid lead. Before that date a missed call only counted if they left a voicemail or you called back and connected. A follow-up call from the same person within 15 days is not charged again.'],
      ['Can I still dispute a bad LSA lead?', 'Not the old way. Google removed the manual dispute in July 2024 and now credits spam, wrong-number and duplicate leads on its own. You can rate a lead "very dissatisfied" in the lead inbox within 30 days and give a specific reason, and Google sometimes credits it. Out-of-area and wrong-job-type calls are no longer credited, so keep your job types and service area tight.'],
      ['Do I need a license to get Google Guaranteed in Pennsylvania?', 'Google asks for whatever your state requires, and Pennsylvania has no statewide plumbing or HVAC license; some municipalities issue their own. You will need to pass the background check, show general liability insurance, and you should have your PA Home Improvement Contractor number from the Attorney General if you do over $5,000 a year of home improvement work. Have the insurance certificate and any local license ready before you apply.'],
      ['Is LSA better than regular Google Ads for a plumber?', 'For a small shop, usually. You pay for calls instead of clicks, the ad sits above everything else, and there is no keyword work to get wrong. The catch is the phone: a regular ad costs you when someone clicks, an LSA ad now costs you when someone calls and you do not pick up.'],
    ],
  },
];
