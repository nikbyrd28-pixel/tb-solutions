// Content source for the /ai-marketing/ cluster on tbsol.net.
// Every town gets real, distinct copy — these are landing pages people read,
// not doorway pages. Add a town here and `node tools/seo-build.mjs` ships it.

export const SITE = {
  origin: 'https://tbsol.net',
  brand: 'TB Solutions',
  phone: '+1-484-841-8501',
  phoneDisplay: '(484) 841-8501',
  email: 'nikbyrd28@gmail.com',
  book: 'https://calendar.app.google/SbFwfmkwTJoRPDBc9',
  og: 'https://tbsol.net/og-image.png',
};

export const TOWNS = [
  {
    slug: 'west-chester-pa',
    name: 'West Chester',
    full: 'West Chester, PA',
    zips: ['19380', '19382', '19383'],
    geo: { lat: 39.9607, lng: -75.6055 },
    blurb:
      'the county seat, a walkable borough where a university, a courthouse and three hundred small businesses share the same few blocks',
    intro:
      'West Chester is the hardest place in Chester County to be invisible and the easiest place to be forgotten. Gay Street and High Street put you shoulder to shoulder with restaurants, salons, shops and trades who all want the same Saturday customer, and most of them are competing on the same three things: a Google listing, a phone that gets answered, and whether the person who searched at 9pm got a reply before they scrolled to the next result.',
    local:
      'A West Chester search almost always has intent attached to it. Someone types "near me" from a bench on Gay Street, from a car on Paoli Pike, or from a couch in the Hersheys Mill or Westtown neighborhoods — and the map pack decides who gets the call. Between WCU students, courthouse traffic and the borough residents who never leave a five-minute radius, the businesses that win here are the ones whose profile is complete, whose hours are right, and whose reply lands in seconds instead of the next business day.',
    faqs: [
      ['How does AI marketing help a West Chester business compete with the chains?',
       'Chains win on ad budget. Local shops win on speed and specificity. An AI growth agent answers a West Chester customer instantly, in your voice, with your real prices and hours — which is the exact thing a corporate phone tree cannot do. Pair that with a fully built Google Business Profile and you show up in the map pack for the borough searches the chains treat as an afterthought.'],
      ['Do you work with businesses in the borough itself or the whole West Chester area?',
       'Both. The 19380, 19382 and 19383 ZIP codes cover the borough plus East and West Goshen, Westtown and Thornbury, and the same system works across all of it — the difference is which neighborhoods and landmarks we target in the local SEO and ad setup.'],
      ['I already rank for my business name. Isn’t that enough?',
       'Ranking for your own name means people who already know you can find you. It earns you nothing new. The money is in the unbranded searches — "barber West Chester PA", "emergency plumber near me" — where nobody typed your name because they do not know it yet. That is what this system is built to win.'],
    ],
  },
  {
    slug: 'exton-pa',
    name: 'Exton',
    full: 'Exton, PA',
    zips: ['19341'],
    geo: { lat: 40.0290, lng: -75.6207 },
    blurb: 'the Route 30 corridor, where retail traffic and commuter traffic cross all day',
    intro:
      'Exton is a corridor, not a downtown. Customers here are moving — down Route 30, in and out of the Exton Square area, off the 100 interchange on their way home from work. Nobody is strolling past your window and deciding to walk in. They are searching from the car, comparing two or three options on a phone screen, and calling whichever one looks open and answers.',
    local:
      'That changes what marketing has to do in Exton. Your storefront is your Google listing: the photos, the hours, the reviews, the question someone asked six months ago that still has no answer under it. And because the corridor pulls from Lionville, Whiteland, Uwchlan and Downingtown, the radius you should be targeting is wider than the ZIP code — which is exactly the mistake most local ad accounts make.',
    faqs: [
      ['What does AI marketing look like for a business on the Route 30 corridor?',
       'Mobile-first and speed-first. Most Exton searches happen on a phone, in motion, with low patience. That means a page that loads instantly and answers price and availability above the fold, a Google Business Profile with current hours and real photos, and an AI agent that replies to a form or chat in seconds — before the person has pulled into the next parking lot.'],
      ['Is Exton too competitive for a small business to rank?',
       'Competitive for broad retail terms, wide open for specific ones. Very few Exton businesses have actually done the boring work: complete profile, categories set correctly, service pages that name the service and the town, and a steady drip of reviews. Doing that well beats a bigger budget spent carelessly.'],
      ['Can you target Lionville and Whiteland too?',
       'Yes, and you should. Exton’s customer base does not respect ZIP boundaries. The local SEO and ad targeting we build covers the surrounding townships that actually feed your door, not just the one your address sits in.'],
    ],
  },
  {
    slug: 'malvern-pa',
    name: 'Malvern',
    full: 'Malvern, PA',
    zips: ['19355'],
    geo: { lat: 40.0362, lng: -75.5138 },
    blurb: 'a small borough wrapped around a large corporate campus belt',
    intro:
      'Malvern is two markets in one ZIP code. There is the borough — King Street, a few blocks of local business, people who have lived here for decades. And there is Great Valley: office parks, corporate tenants, and thousands of people who spend their weekdays here and their money on whatever is convenient during a lunch hour or on the drive out.',
    local:
      'Marketing to both at once is where most Malvern businesses lose. The borough customer wants to know you are a real neighbor with real reviews. The corporate customer wants to know you are fast, open now, and easy to book without a phone call. The same website can serve both, but only if the booking is frictionless and the AI agent can answer "can you fit me in at 12:15" without waiting for you to check your phone.',
    faqs: [
      ['Should I market to the Great Valley office parks or to the borough?',
       'Both, with different messages. Office-park traffic responds to convenience, speed and online booking. Borough residents respond to reputation, reviews and being local. One site can carry both if the offer is clear and the response is instant — that is what the AI agent is for.'],
      ['Does AI marketing work for a B2B or professional service in Malvern?',
       'Yes, and often better than for retail. A professional service lives or dies on lead response time. An agent that qualifies an inquiry, answers the obvious questions and books the call while the prospect is still on the page is worth more than another thousand impressions.'],
      ['How long before I see results in a market this size?',
       'Google Business Profile fixes and ad traffic can move within days. Organic rankings for "Malvern PA" service terms typically take a couple of months of consistent work. The follow-up system is the part that pays first, because it recovers leads you are already getting and losing.'],
    ],
  },
  {
    slug: 'downingtown-pa',
    name: 'Downingtown',
    full: 'Downingtown, PA',
    zips: ['19335'],
    geo: { lat: 40.0068, lng: -75.7033 },
    blurb: 'a Brandywine river town with a long main street and a growing western edge',
    intro:
      'Downingtown runs long and narrow along Lancaster Avenue, and the businesses on it serve a customer base that has changed fast — older families who have been here for generations, and newer households pushing west past Thorndale and Caln. The two groups search differently, and a lot of local businesses are still marketing to only one of them.',
    local:
      'What Downingtown businesses consistently get wrong is follow-up. Leads come in through Facebook, through the website form, through a missed call at 4:50pm — and then sit. In a town where word of mouth is still genuinely powerful, a reputation for "they never got back to me" spreads as fast as a good review. Automated follow-up is not a luxury here; it is reputation management.',
    faqs: [
      ['What is the fastest win for a Downingtown business?',
       'Missed-call text-back and instant lead reply. Most local businesses lose more revenue to unanswered inquiries than to bad marketing. Turning every missed call into an automatic text within seconds usually recovers more jobs in month one than any ad campaign.'],
      ['Do I need a new website or can you work with the one I have?',
       'If your current site loads fast, states what you do and where, and can take a booking, we can keep it and bolt the AI agent and follow-up onto it. If it is slow, unclear or unbookable, rebuilding is cheaper than trying to fix it.'],
      ['Will this work for a trades business that runs out of a truck?',
       'That is the best case for it. Trades lose leads while their hands are busy. The agent answers, qualifies and books; you look at the calendar at the end of the day and the work is already scheduled.'],
    ],
  },
  {
    slug: 'kennett-square-pa',
    name: 'Kennett Square',
    full: 'Kennett Square, PA',
    zips: ['19348'],
    geo: { lat: 39.8468, lng: -75.7116 },
    blurb: 'the mushroom capital, a dense little downtown with a serious visitor economy',
    intro:
      'Kennett Square punches far above its size. State Street draws visitors from Delaware, from Longwood Gardens traffic, and from the wineries and farms in between — and a real share of the local customer base is bilingual. That combination means your marketing is being read by people who have never heard of you and by neighbors who have known you for twenty years, often in two languages, on the same page.',
    local:
      'Visitor-driven searches are unforgiving. Someone leaving Longwood with two hours to spare types "best" or "near me", scans the map pack, and picks in under a minute. If your hours are wrong, your photos are five years old, or nobody has replied to the last three reviews, you lose that decision before you know it happened. The upside is that these are high-intent, high-spend customers, and almost nobody in the borough is competing for them properly.',
    faqs: [
      ['How do I capture Longwood Gardens and visitor traffic?',
       'By being the obvious answer in the map pack when a visitor searches with an hour to kill. That means correct hours including holidays, current photos, primary category set precisely, reviews answered, and a page that says what you are and how close you are without making anyone hunt for it.'],
      ['Can the AI agent handle Spanish-speaking customers?',
       'Yes. The agent can answer in Spanish and English, which matters in Kennett Square more than almost anywhere else in the county — and it means a customer gets a real answer instead of waiting for someone bilingual to be free.'],
      ['Is seasonal traffic worth building around?',
       'Yes, if the system is built to catch it and keep it. Visitors convert once; the follow-up system turns a share of them into people who come back and tell others. That second visit is where the seasonal spike actually pays.'],
    ],
  },
  {
    slug: 'phoenixville-pa',
    name: 'Phoenixville',
    full: 'Phoenixville, PA',
    zips: ['19460'],
    geo: { lat: 40.1304, lng: -75.5149 },
    blurb: 'a former steel town turned one of the most active small downtowns in the region',
    intro:
      'Bridge Street did something most old industrial towns never manage: it came back, and it came back young. Phoenixville now has the restaurant density, the brewery scene and the events calendar of a much larger place, which means the competition for attention on any given weekend is genuinely fierce and the audience is heavily online.',
    local:
      'This is a market where social presence and search presence have to agree with each other. A customer sees you on Instagram, searches your name, and lands on a Google listing with no hours and a website from 2016 — that gap kills the sale. Phoenixville businesses win by looking as current in search as they do on social, and by answering fast, because this audience expects a reply the same way they expect a text back.',
    faqs: [
      ['My Instagram does well but it does not turn into sales. Why?',
       'Because social creates interest and search closes it. If someone discovers you on Instagram and then finds a stale Google listing or a slow site, the interest evaporates. Fixing the search side is usually what turns existing social traction into booked revenue.'],
      ['Is there room for a new business to rank in Phoenixville?',
       'Yes. Bridge Street is crowded with businesses, not with well-optimized ones. Most have never claimed categories properly, never built service pages, and never asked for reviews on a schedule. That is a wide-open door for anyone willing to do it consistently.'],
      ['How does AI help with events and busy weekends?',
       'It absorbs the volume. On a First Friday or a festival weekend the questions are repetitive — hours, parking, wait time, whether you take walk-ins. The agent answers all of it instantly while your staff works, and hands you only the messages that need a human.'],
    ],
  },
  {
    slug: 'coatesville-pa',
    name: 'Coatesville',
    full: 'Coatesville, PA',
    zips: ['19320'],
    geo: { lat: 39.9829, lng: -75.8238 },
    blurb: 'a working city in the west of the county with a wide surrounding service area',
    intro:
      'Coatesville is under-served by marketing in a way that is genuinely an advantage for the businesses here. The city and the townships around it — Caln, Valley, Sadsbury, out toward Parkesburg — cover a large area with real demand and very few competitors doing anything sophisticated online.',
    local:
      'For a service business, that means the cost of getting found is lower here than almost anywhere else in the county. A properly built Google Business Profile plus a handful of service pages that name the actual towns you cover can move you into the map pack for searches that nobody is fighting over. The customers are searching. The listings they find are mostly incomplete.',
    faqs: [
      ['Is it cheaper to rank in Coatesville than in West Chester?',
       'Substantially. Fewer businesses are competing seriously, so the same work goes further. The tradeoff is a wider geography — you need service pages and targeting that cover the surrounding townships, not just the city line.'],
      ['I serve a large area from a Coatesville base. How should that be handled?',
       'With a real service-area setup: the Google profile configured as a service-area business where appropriate, and individual pages for the towns you actually travel to. Listing thirty towns on one page does not work; a genuine page per real service town does.'],
      ['What if I have very few reviews?',
       'Then that is the first project. A simple, automated ask after every completed job — sent by text, at the right moment — will out-perform any clever campaign you could run. Reviews are the single strongest local ranking and conversion factor for a business in this position.'],
    ],
  },
  {
    slug: 'paoli-pa',
    name: 'Paoli',
    full: 'Paoli, PA',
    zips: ['19301'],
    geo: { lat: 40.0426, lng: -75.4877 },
    blurb: 'the Main Line’s western anchor, built around the train and the commuter',
    intro:
      'Paoli runs on the schedule of the Paoli/Thorndale line. A meaningful part of the customer base is commuting, which means the window in which they will look for you, decide on you and book you is short and happens on a phone platform, usually twice a day.',
    local:
      'Main Line customers also carry Main Line expectations. A site that looks cheap gets read as a business that is cheap, and not in a good way. Presentation matters here more than in any other part of the county — but presentation without instant response is just a nice-looking dead end. The combination that works in Paoli is a site that looks expensive and a system that replies immediately.',
    faqs: [
      ['Does design really affect whether Main Line customers convert?',
       'Yes, measurably. In this market, the site is a proxy for the quality of the work. A dated or slow site raises doubt before a word gets read. That is why the build quality and load speed are treated as conversion features, not decoration.'],
      ['How do I reach commuters specifically?',
       'By being findable and bookable in the two short windows they actually search: morning and early evening. That means online booking with no phone call required, and an agent that can confirm an appointment at 6:40am without you being awake.'],
      ['Can you cover Berwyn, Devon and Wayne as well?',
       'Yes. Those communities blend into the same customer base, and the targeting and content are built to cover the corridor rather than a single ZIP code.'],
    ],
  },
  {
    slug: 'chadds-ford-pa',
    name: 'Chadds Ford',
    full: 'Chadds Ford, PA',
    zips: ['19317'],
    geo: { lat: 39.8687, lng: -75.5910 },
    blurb: 'Brandywine Valley country — spread out, affluent, and shared with Delaware',
    intro:
      'Chadds Ford is not a downtown; it is a stretch of Route 1 and a landscape. The customer base is affluent, spread across large properties, and sits right on the Delaware line — which means a real share of the people searching near you are searching from another state, and your competition includes businesses in Wilmington and Greenville.',
    local:
      'That geography changes the strategy. A business here needs to be visible on both sides of the state line, needs to be clear about the area it serves, and needs to convert on trust rather than price. Museum and winery traffic through the Brandywine Valley adds a visitor layer on top of that — high intent, short decision window, and almost entirely mobile.',
    faqs: [
      ['Should I be targeting Delaware customers too?',
       'If you serve them, yes. Chadds Ford sits close enough to the line that ignoring northern Delaware leaves obvious money on the table. The targeting and the service-area pages should reflect the area you actually cover, state line included.'],
      ['How do you market a business in an area with no real downtown?',
       'Search does the work that foot traffic does elsewhere. With no walk-by, the Google profile, the map pack and the site are effectively your storefront — so they get the investment a storefront would get.'],
      ['Is a premium market worth a premium marketing budget?',
       'Only if the money buys the right things. In this market the highest-return items are usually presentation, reputation and response speed, in that order — not raw ad spend.'],
    ],
  },
  {
    slug: 'oxford-pa',
    name: 'Oxford',
    full: 'Oxford, PA',
    zips: ['19363'],
    geo: { lat: 39.7851, lng: -75.9788 },
    blurb: 'the southern corner of the county, agricultural, and largely untouched by real marketing',
    intro:
      'Oxford and the southern end of Chester County — Nottingham, West Grove, Avondale, out toward the Maryland line — run on relationships. Everyone knows everyone, work comes by referral, and that has been enough for a long time. It is becoming less enough every year as newer households move in who search before they ask a neighbor.',
    local:
      'The businesses here that add a simple, correct online presence tend to see a disproportionate jump, because they are competing against listings that barely exist. You do not need to out-spend anyone in Oxford. You need to be the one business in your category with accurate information, real photos, current reviews and a phone number that gets answered — by a person or by an agent.',
    faqs: [
      ['Does online marketing matter in a town this size?',
       'It matters more, not less, because so few competitors are doing it. In a referral market, being the business that also shows up correctly in search is how you capture every new household that moved in without a neighbor to ask.'],
      ['I get all my work by word of mouth. Why change?',
       'You do not change it — you back it up. When someone hears your name, the first thing they do is search it. If that search returns a complete profile with reviews, the referral closes. If it returns nothing, the referral cools.'],
      ['Can you handle the whole southern county?',
       'Yes. Oxford, West Grove, Avondale, Nottingham and the surrounding townships are treated as one service area, with individual pages for the towns that genuinely drive your work.'],
    ],
  },
];

// Question / intent pages that sit alongside the town pages.
export const GUIDES = [
  {
    slug: 'what-is-ai-marketing',
    title: 'What Is AI Marketing? A Plain-English Answer for Local Businesses',
    h1: 'What AI marketing actually is (and what it is not)',
    desc:
      'AI marketing explained without the buzzwords: what the tools actually do for a small local business, what they cost, what they cannot do, and how to tell a real system from a rebranded chatbot.',
    lead:
      'Every agency in the country added the word "AI" to its homepage in the last two years. Most of them changed nothing else. Here is what the term is supposed to mean, and how to check whether anyone selling it to you is telling the truth.',
    sections: [
      ['The one-sentence version',
       'AI marketing is using software that can read, write and decide to do the marketing jobs that used to require a person sitting at a desk — answering a customer at 9pm, writing the fifth version of an ad, sorting which of forty leads is worth calling first, and following up with the other thirty-nine without forgetting any of them.'],
      ['The four jobs it actually does well',
       'Response: replying to a customer instantly, in your voice, with your real prices and hours. Qualification: asking the two or three questions that separate a real job from a tire-kicker. Follow-up: contacting every lead on a schedule, forever, without getting bored or busy. Production: turning one idea into the twelve pieces of copy, captions and ad variants you would otherwise never get around to writing.'],
      ['The jobs it does badly',
       'It does not replace judgment about what your business should charge or who it should serve. It does not create a reputation you have not earned. And it does not fix a broken offer — an AI agent replying instantly to a message about a service nobody wants just gets you rejected faster.'],
      ['How to tell a real system from a sticker',
       'Ask three questions. Where do the answers come from — a trained knowledge base of your real services, or a generic model guessing? What happens when it cannot answer — does it hand off to you with the full conversation, or does it stall? And what does it write into your CRM — a record you can act on next month, or nothing at all? A system that fails those three is a chat widget with a new label.'],
    ],
    faqs: [
      ['Is AI marketing just chatbots?',
       'No. A chatbot is one visible piece. The system underneath it — instant lead response, qualification, automated follow-up, review requests, content production and reporting — is where most of the return comes from. The chat window is the part customers see.'],
      ['Will AI marketing replace my marketing person?',
       'It replaces the parts of the job that are repetitive and time-sensitive: replying, following up, drafting, sorting. It does not replace strategy, taste or relationships. In practice it makes one person able to run what used to take three.'],
      ['Does using AI hurt my Google rankings?',
       'Not by itself. Google ranks content by whether it is useful and trustworthy, not by how it was typed. What gets penalized is mass-produced, thin, unedited output published at scale — which is a discipline problem, not an AI problem.'],
    ],
  },
  {
    slug: 'cost',
    title: 'What AI Marketing Costs for a Small Business in Chester County',
    h1: 'What this actually costs',
    desc:
      'Real pricing for AI marketing, websites, local SEO and lead follow-up for small businesses in Chester County, PA — what each piece costs, what it is worth, and what to buy first on a small budget.',
    lead:
      'Nobody publishes prices, which is how a $300 job becomes a $3,000 retainer. Here is the actual range, what each piece does, and the order to buy them in if your budget is small.',
    sections: [
      ['The pieces and what they run',
       'A local presence audit — the full read on your Google profile, site and competitors — runs about $100. A premium one-page website is around $300. An AI growth agent set up on your services and trained on your pricing is about $400. A lead follow-up system — missed-call text-back, instant reply, review requests — runs about $500. Meta Ads setup starts around $250 and Google Ads around $350, with ad spend paid directly by you to the platform. Ongoing management is quoted after a call, because it depends entirely on how much of it you want handled.'],
      ['What to buy first if you have $500',
       'Follow-up, every time. Most local businesses are already getting more inquiries than they convert. Missed-call text-back and instant lead reply recover revenue from traffic you have already paid for, which means the first purchase pays for the second one. Ads are the last thing to buy, not the first — paying to send more traffic into a leaky system just increases the leak.'],
      ['Why the numbers are lower than an agency’s',
       'Because there is no account manager, no media buyer and no office between you and the person doing the work. You talk to the builder. That removes most of the cost structure a traditional agency has to charge for, and it removes the two-week turnaround on a one-hour change.'],
      ['What "monthly" should and should not include',
       'It should include the work that genuinely recurs: content, campaign management, reporting, agent tuning, review handling. It should not include a rebuild you already paid for, hosting marked up ten times, or a retainer that exists to hold your website hostage. Ask what happens to your site and data if you leave. The answer tells you what kind of company you are dealing with.'],
    ],
    faqs: [
      ['Do you require a long-term contract?',
       'No. Starter packages are half up front and half on delivery. Monthly work is quoted after a call and is cancellable — the system is built to keep working for you, not to lock you in.'],
      ['Is ad spend included in the price?',
       'No, and be suspicious of anyone who bundles it invisibly. You pay Google and Meta directly so you can see exactly what was spent. Setup and management are separate, quoted line items.'],
      ['What is the cheapest thing that actually moves the needle?',
       'Fixing your Google Business Profile and turning on automated review requests. It costs almost nothing relative to everything else and it changes both how often you appear and how often people choose you when you do.'],
    ],
  },
  {
    slug: 'ai-chatbot-for-local-business',
    title: 'AI Chat Agent for a Local Business Website — How It Works',
    h1: 'The AI growth agent, explained',
    desc:
      'How an AI chat agent works on a local business website: what it knows, how it qualifies leads, how it hands off to you, and why response speed is the highest-return marketing fix most small businesses have left.',
    lead:
      'The single most expensive habit in local business is the unanswered message. Here is what an agent trained on your business actually does about it.',
    sections: [
      ['What it knows',
       'It is trained on your services, your prices, your hours, your service area, your policies and the twenty questions you answer every week. It is not a generic model improvising — when it does not know something, it says so and gets you, rather than inventing an answer that costs you a customer.'],
      ['What it does with a visitor',
       'It answers the question that brought them in, then moves toward one of two outcomes: a booking, or a captured contact with enough detail for you to close. It asks what you would ask — what the job is, where, when, how urgent — and it does it in seconds, at any hour, as many times in parallel as your traffic requires.'],
      ['What you get',
       'A text with the conversation and the contact, a record in your CRM, and a lead that has already been qualified before you spend a minute on it. The leads that were not ready go into follow-up automatically instead of into the gap between your inbox and your memory.'],
      ['Why speed is the whole game',
       'The difference between replying in five minutes and replying in an hour is not small — it is most of the outcome. People searching for a local service contact two or three businesses and hire whoever responds first with a real answer. An agent makes you first every single time, including nights, weekends and while you are on a job.'],
    ],
    faqs: [
      ['Will customers know they are talking to AI?',
       'It never pretends to be a person with a name and a life. It answers as your business, helpfully and in your tone, and hands off to you the moment a human is needed. Most customers care about getting an answer, not about who typed it.'],
      ['What if it gets something wrong?',
       'It is scoped to what it has been trained on and instructed to hand off rather than guess. You review the transcripts, and anything it fumbled becomes a correction to its knowledge base — it gets more accurate the longer it runs.'],
      ['Can it book appointments directly?',
       'Yes. It can connect to your booking calendar and confirm the slot in the conversation, which removes the phone call that loses a large share of would-be customers.'],
    ],
  },
  {
    slug: 'get-found-by-chatgpt-and-ai-search',
    title: 'How to Get Your Business Recommended by ChatGPT and AI Search',
    h1: 'Getting found when the customer asks an AI instead of Google',
    desc:
      'A practical guide to AI search visibility for local businesses: how ChatGPT, Google AI Overviews, Perplexity and Copilot decide which local business to name, and what to change on your site so it is yours.',
    lead:
      'A growing share of "who should I call" questions never reach a results page. Someone asks an assistant, gets three names, and calls one. Here is how those three names get chosen, and how to be one of them.',
    sections: [
      ['How an assistant picks a local business',
       'It reads. It pulls from pages it can parse, structured data it can trust, and third-party sources — directories, review platforms, local press — that corroborate what your site claims. What it rewards is unambiguous, consistent, machine-readable facts: what you do, exactly where you do it, what it costs, and how to reach you. What it ignores is atmosphere copy that never states a fact.'],
      ['Write answers, not brochures',
       'Assistants extract answers. A page that says "we deliver bespoke solutions tailored to your needs" contains nothing extractable. A page that says "we replace residential water heaters in Downingtown and Exton, typically same-week, starting around $1,800" can be quoted directly — and that is the difference between being cited and being skipped.'],
      ['Make the facts machine-readable',
       'Structured data does most of the heavy lifting: LocalBusiness markup with your real address, phone, hours and service area; Service markup for what you sell; FAQPage markup on the questions you actually get asked. Then keep your name, address and phone identical everywhere they appear. Assistants penalize contradiction more harshly than search engines do, because they have to commit to one answer.'],
      ['Let the crawlers in',
       'Check your robots.txt. Plenty of sites block GPTBot, ClaudeBot, PerplexityBot and Google-Extended without realizing it — often because a plugin added the rules by default. If you want to be recommended by an assistant, it has to be allowed to read you. An llms.txt file at your root, summarizing what your business is and where the canonical pages live, gives it a clean starting point.'],
      ['The part nobody can shortcut',
       'Corroboration. Assistants trust things that are confirmed in more than one place. A complete Google Business Profile, consistent listings on the directories that matter for your trade, a steady stream of genuine reviews and any real local coverage all feed the same conclusion: this business exists, does this, here. There is no version of this that works without that groundwork.'],
    ],
    faqs: [
      ['Is AI search visibility different from SEO?',
       'It overlaps heavily but not completely. Traditional SEO optimizes for a ranked list of links; AI visibility optimizes for being the source a model quotes. The extra work is structural — clear factual statements, strong structured data, consistent information across the web, and crawler access.'],
      ['Can I pay to be recommended by ChatGPT?',
       'No. There is no ad slot in the recommendation itself. It is earned through being the clearest, most corroborated answer available — which is why doing it early is worth so much.'],
      ['How do I know if it is working?',
       'Ask the assistants the questions your customers would ask, from a logged-out session, and record who gets named. Repeat monthly. It is crude, but it is the only honest measurement available right now, and the trend line tells you plenty.'],
    ],
  },
  {
    slug: 'ai-marketing-vs-agency',
    title: 'AI Marketing vs. a Traditional Marketing Agency',
    h1: 'AI marketing vs. hiring an agency',
    desc:
      'An honest comparison of an AI-run marketing system versus a traditional agency retainer for a small local business — cost, speed, control, and the cases where an agency is genuinely the better call.',
    lead:
      'Both can work. They fail differently, and they fit different businesses. Here is the comparison without the sales pitch attached.',
    sections: [
      ['Where an agency wins',
       'Scale and specialization. If you are spending real money on media every month, running campaigns across several markets, or you need a brand built from nothing by people who do that full time, a good agency earns its retainer. They also absorb work you should not be touching at that size.'],
      ['Where an agency loses for a small local business',
       'Cost structure and speed. You are paying for an account manager, a strategist and a media buyer whether or not your account needs three people. A one-line change to your homepage becomes a ticket, a queue and a two-week turnaround. And the junior on your account often knows less about your trade than you do.'],
      ['What the AI-run version replaces',
       'The repetitive labor: replying, following up, drafting, scheduling, reporting. That is most of the hours a small-business retainer actually consumes. What remains is judgment and building — which is one person’s job, not four, and is why the pricing looks nothing like a retainer.'],
      ['The honest test',
       'If your marketing problem is "I am not getting enough leads and the ones I get slip through the cracks", the system wins on every axis. If your problem is "I need a national brand campaign across six markets by spring", hire the agency. Most Chester County businesses have the first problem and get sold the second solution.'],
    ],
    faqs: [
      ['Do I still get a human to talk to?',
       'Yes — the person building it. There is no account layer between you and the work, which is the point. Changes happen in hours instead of sprints.'],
      ['What if I already have an agency?',
       'Then the useful move is an audit rather than a switch. You will find out quickly whether what you are paying for is being delivered, and the follow-up system can be added alongside whatever they are running.'],
      ['Is this a good fit for a one-person business?',
       'It is the best fit. A one-person business loses the most revenue to unanswered messages, because there is nobody else to catch them. That is exactly the leak this closes.'],
    ],
  },
];
