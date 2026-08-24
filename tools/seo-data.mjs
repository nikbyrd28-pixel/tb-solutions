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
    title: 'What Is AI Marketing? A Plain-English Answer',
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
    title: 'What AI Marketing Costs in Chester County, PA',
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
    title: 'AI Chat Agent for a Local Business Website',
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
    title: 'How to Get Recommended by ChatGPT & AI Search',
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

// The head-on commercial cluster. The /ai-marketing/ pages win an uncontested
// niche; these compete for the queries the established agencies already own,
// where the differentiator is published pricing and who actually does the work.
export const SERVICES = [
  {
    slug: 'marketing-agency-chester-county',
    title: 'Marketing Agency in Chester County, PA | TB Solutions',
    h1: 'A marketing agency in Chester County, built the other way around',
    desc:
      'TB Solutions is a marketing and web design studio in West Chester, PA serving all of Chester County — websites, local SEO, Google and Meta Ads, AI growth agents and lead follow-up, with published prices and no retainer lock-in.',
    lead:
      'Most agencies sell you a retainer and assign you a junior. This one sells you a system, publishes what it costs, and puts you on the phone with the person who builds it.',
    sections: [
      ['What we actually do',
       'Websites that load fast and convert. Local SEO and Google Business Profile work that gets you into the map pack. Google and Meta Ads set up properly and managed honestly, with spend paid directly by you to the platform. AI growth agents that answer your customers in seconds at any hour. And lead follow-up — missed-call text-back, instant reply, review requests, win-back — which is usually the piece that pays for everything else.'],
      ['Who it is for',
       'Owner-run businesses in Chester County: trades, salons and barbershops, restaurants, professional services, retail, home services. Businesses with between one and thirty employees, where the owner still knows every customer and every lost lead hurts. If you need a national brand campaign across six markets, hire a bigger shop — we will tell you that on the call.'],
      ['The pricing is on the website',
       'A local presence audit is $100. A premium one-page site is $300. An AI growth agent setup is $400. A lead follow-up system is $500. Meta Ads setup starts at $250, Google Ads at $350. Monthly management is quoted after a call because it depends on scope. Half up front, half on delivery for starter packages, and no long-term contract on any of it.'],
      ['Where we work',
       'West Chester, Exton, Malvern, Downingtown, Kennett Square, Phoenixville, Coatesville, Paoli, Chadds Ford, Oxford, and the surrounding townships — plus the Main Line and the western Philadelphia suburbs. Local work gets local knowledge: which searches actually happen in your town, which neighborhoods feed your door, and which of your competitors have left their listings half-built.'],
      ['What happens on the free call',
       'You bring your website, your Google listing and the number you wish were higher. You leave with the single highest-impact fix, written down, whether or not you hire us. There is no deck, no discovery phase and no proposal that arrives a week later.'],
    ],
    faqs: [
      ['How much does a marketing agency cost in Chester County?',
       'Traditional agency retainers in this area commonly run $1,500 to $5,000 a month plus ad spend. TB Solutions publishes fixed prices instead: $100 for an audit, $300 for a one-page site, $400 for an AI agent setup, $500 for a lead follow-up system, and ad setup from $250. Monthly management is quoted after a call, with no long-term contract.'],
      ['Do you work with businesses outside Chester County?',
       'Yes. Chester County and the Main Line are home and get local knowledge, but the system works anywhere — the website, the agent, the follow-up and the ads are not geographically limited.'],
      ['Who actually does the work?',
       'Nick Byrd, the founder, builds it. There is no account manager layer and no junior assigned to your account, which is why changes happen the same day instead of the next sprint.'],
      ['Can you take over from my current agency?',
       'Yes, and the sane first step is an audit rather than a switch — $100 tells you whether what you are paying for is actually being delivered. Plenty of businesses find the answer is "partly", and keep the parts that work.'],
    ],
  },
  {
    slug: 'affordable-marketing-agency-chester-county',
    title: 'Affordable Marketing Agency — Chester County, PA',
    h1: 'Affordable marketing in Chester County — with the prices printed',
    desc:
      'What affordable marketing actually costs in Chester County, PA: published prices for websites, local SEO, ads and lead follow-up, what to buy first on a small budget, and how to tell cheap from a waste of money.',
    lead:
      '"Affordable" is the most abused word in this industry. It usually means a low first invoice attached to a twelve-month contract. Here is what the work genuinely costs, and what to skip until you can afford it.',
    sections: [
      ['The honest budget tiers',
       'Under $500: fix your Google Business Profile and turn on automated review requests and missed-call text-back. This is the highest-return money in local marketing and it is almost embarrassing how few businesses have done it. $500 to $1,000: add a fast one-page site that states your price and your offer clearly, plus an AI agent so nothing goes unanswered. $1,000 to $2,500: now ads make sense, because you have somewhere to send the traffic and a system that catches it. Above that: ongoing content, expansion into more towns, and real reporting.'],
      ['What cheap marketing actually costs you',
       'The $99-a-month "SEO package" is not cheap; it is a slow leak. Same with the $500 website that takes six seconds to load and cannot be edited without calling someone. The test is not the invoice — it is whether the thing produces a customer. A $300 site that books two extra jobs a month is free. A $99 retainer that produces nothing is the most expensive line on your books.'],
      ['Where the money should go first, in order',
       'One: response. Nothing outranks answering people. Two: reputation. Reviews are the cheapest ranking and conversion factor you will ever buy, and asking automatically costs nothing. Three: the listing. A complete Google Business Profile is free and most competitors have not finished theirs. Four: the site. Five, and only five: ads. If you are running ads before the first four are done, you are paying to fill a bucket with a hole in it.'],
      ['How to tell a good deal from a bad one',
       'Ask what happens if you leave. If the answer involves losing your website, your domain, your ad account or your customer data, the price is not what you think it is. Ask what is being done each month, specifically, and ask to see it. And ask who is doing it — a fixed price with a real person attached beats a retainer with a rotating cast every time.'],
    ],
    faqs: [
      ['What is the cheapest useful marketing for a small business?',
       'A finished Google Business Profile plus automatic review requests after every job. Both cost close to nothing and together they change how often you appear in the map pack and how often people pick you when you do.'],
      ['Is a $300 website any good?',
       'It can be excellent if it is one page that loads fast, states your offer and price clearly, and can take a booking. Local customers are not reading a ten-page site — they are checking whether you are open, what it costs, and how to reach you.'],
      ['Do you offer payment plans?',
       'Starter packages are split half up front and half on delivery, which keeps the initial outlay small. Monthly work is billed monthly with no long-term contract.'],
      ['Why are your prices lower than other Chester County agencies?',
       'No account manager, no media buyer, no office, and no sales team between you and the work. That is most of an agency’s cost structure, and it is not cost that reaches your customers.'],
    ],
  },
  {
    slug: 'how-to-choose-a-marketing-agency',
    title: 'How to Choose a Marketing Agency in Chester County, PA',
    h1: 'How to choose a marketing agency without getting burned',
    desc:
      'A buyer’s guide for Chester County business owners: the questions to ask any marketing agency, the contract terms that trap you, the metrics that mean nothing, and how to run a fair trial before committing.',
    lead:
      'You will be sold impressions, reach and engagement. None of those are customers. Here is how to evaluate anyone pitching you, including us.',
    sections: [
      ['The five questions that separate the real from the rest',
       'Who specifically will do the work, and can I talk to them today? What exactly happens in month one, day by day? What do I own if I leave — site, domain, ad account, customer data? What is the single metric you will be judged on? And: show me a business like mine that you helped, and let me call them. Vague answers to any of these are the answer.'],
      ['The contract terms to refuse',
       'Twelve-month lock-ins with no performance clause. Websites hosted on a platform you cannot export. Ad accounts owned by the agency rather than by you. Automatic renewals with a ninety-day cancellation window. None of these exist to serve you, and all of them are negotiable if you notice them before signing.'],
      ['Metrics that mean nothing, and what to watch instead',
       'Impressions, reach, followers and "engagement" are activity, not outcomes. Watch four numbers: how many people contacted you, how fast they were answered, how many became customers, and what each one cost. If your agency cannot report those four, they are reporting on their own effort rather than on your business.'],
      ['How to run a fair trial',
       'Buy the smallest real thing first — an audit, a single landing page, one campaign — and judge it on delivery: was it on time, was it what was described, did it produce a measurable result. Ninety days of one honest project tells you more than any pitch. And a firm that will not sell you a small first project is telling you something about how it makes its money.'],
      ['A fair word about the good agencies',
       'Chester County has genuinely good marketing firms, several with long track records and a wall of real reviews. If you need a full-service team across brand, media and creative at scale, hire one of them — that is what they are built for. The mismatch to avoid is a five-person local business buying an enterprise engagement it will never use, which is by far the most common way money gets wasted in this market.'],
    ],
    faqs: [
      ['How do I know if my current agency is doing anything?',
       'Ask for the four numbers: contacts, response time, conversions, cost per customer. Then ask to see the work itself — the ad account, the pages published, the changes made. A month of real work is easy to show and impossible to fake.'],
      ['Should I hire local or does it matter?',
       'For local search it matters more than people think. Someone who knows that Exton pulls from Lionville, or that Kennett Square runs bilingual, will target better than a national firm reading a ZIP code off a form.'],
      ['How long should I give a new agency before judging?',
       'Ninety days for organic work, two weeks for ads and follow-up. If nothing measurable has moved in ninety days and they cannot explain why in plain language, leave.'],
    ],
  },
  {
    slug: 'local-seo-chester-county',
    title: 'Local SEO in Chester County, PA | Map Pack',
    h1: 'Local SEO for Chester County businesses',
    desc:
      'Local SEO for Chester County, PA: how the Google map pack actually decides who ranks, what to fix on your Google Business Profile, how reviews and location pages work, and what it costs.',
    lead:
      'For a local business, the three results in the map box are worth more than everything below them combined. Here is what puts a business in that box.',
    sections: [
      ['What the map pack is ranking on',
       'Three things, roughly: relevance (do your categories, services and content match what was searched), distance (where the searcher is standing relative to you), and prominence (reviews, consistency of your information across the web, and how well known you are). You cannot move distance. You can move the other two substantially, and most local competitors have not tried.'],
      ['The Google Business Profile work, in order',
       'Set the primary category precisely — this single field moves rankings more than almost anything else, and most businesses have it wrong or generic. Add every secondary category that genuinely applies. Fill in services and products with real descriptions. Upload current photos and keep uploading. Set hours including holiday hours. Answer the Q&A, including asking and answering the obvious questions yourself. Reply to every review, good and bad. Post regularly. None of this is clever; all of it is skipped.'],
      ['Reviews are the lever',
       'Volume, recency and rate all count, and reviews also decide whether someone picks you once you appear. The businesses that win are not the ones asking harder — they are the ones asking automatically, by text, at the right moment after the job. Doing that consistently for six months will out-perform any other single thing on this page.'],
      ['Location pages that are not doorway pages',
       'A page per town you actually serve, with genuine content about that market, earns rankings. Thirty near-identical pages with the town name swapped get filtered out and can drag the whole site down. The test is simple: if the page would be useless to a human in that town, it will eventually be useless to you.'],
      ['Consistency, everywhere',
       'Your name, address and phone number need to match exactly across your site, your Google profile, Apple Maps, Bing, Yelp, Facebook and the directories for your trade. Contradictions dilute prominence — and increasingly they also make AI assistants skip you, because a model has to commit to one answer and will pick the business it can verify.'],
    ],
    faqs: [
      ['How long does local SEO take to work?',
       'Google Business Profile fixes often show movement in days to a couple of weeks. Competitive map-pack positions for a town-plus-service term usually take two to four months of consistent work, with reviews being the slowest and most durable part.'],
      ['Can I rank without a physical storefront?',
       'Yes — as a service-area business. You hide the address, define the areas you serve, and lean harder on service pages and reviews. Plenty of trades rank this way.'],
      ['Is local SEO worth it if I already run ads?',
       'Yes, because they compound. Ads stop the day you stop paying; the profile, the reviews and the pages keep working. Most businesses should have both, with the organic side built first so the ads land somewhere that converts.'],
    ],
  },
  {
    slug: 'web-design-chester-county',
    title: 'Web Design in Chester County, PA | From $300',
    h1: 'Web design for Chester County businesses',
    desc:
      'Website design and build for Chester County, PA businesses: fast, mobile-first sites that state the offer, take a booking, and are built to convert rather than to win design awards. From $300.',
    lead:
      'A local business website has one job: turn a stranger who is already interested into a call, a booking or a walk-in. Almost everything else on a typical small-business site is decoration.',
    sections: [
      ['What actually converts',
       'What you do and where, in the first line. The price or the price range, or at least an honest signal of it. One obvious action, repeated. Proof — reviews, real photos of real work, not stock. And speed: if it takes more than about two seconds on a phone on a weak signal, a meaningful share of people are gone before they read a word.'],
      ['One page is usually enough',
       'For most local businesses a single well-built page beats a ten-page site, because nobody is browsing — they are checking. A one-page site is faster to load, faster to change, cheaper to build and impossible to get lost in. Multi-page makes sense when you genuinely have distinct services that deserve their own search rankings.'],
      ['Design as a conversion feature',
       'How the site looks is not vanity; it is a proxy for the quality of your work. On the Main Line and in the wealthier parts of the county this is measurable — a dated site raises doubt before a word is read. That is why the build gets treated as part of the sales process rather than as a brochure.'],
      ['Built to be owned, not rented',
       'You own the site, the domain and the content. It is not locked to a platform you cannot leave, and it does not stop working if you stop paying someone. Hosting is cheap and transparent, not marked up ten times as a retention device.'],
    ],
    faqs: [
      ['How much does a website cost in Chester County?',
       'A premium one-page site is $300 here. Local agency quotes for a small-business site in this area commonly land between $2,500 and $8,000. The gap is mostly account management and sales overhead, not build quality.'],
      ['How fast can it be ready?',
       'Most one-page sites get a first draft within a few days of the deposit and your details. Revisions are quick because you talk to the person building it.'],
      ['Can you redesign my existing site instead?',
       'Yes, if the bones are sound. If it is slow, unclear or cannot take a booking, rebuilding is usually cheaper than repairing.'],
      ['Will it work on phones?',
       'It is designed for phones first, because that is where the overwhelming majority of local searches happen. Desktop is the adaptation, not the other way round.'],
    ],
  },
  {
    slug: 'google-business-profile-chester-county',
    title: 'Google Business Profile Help — Chester County, PA',
    h1: 'Google Business Profile, finished properly',
    desc:
      'Google Business Profile setup, cleanup and optimization for Chester County, PA businesses — categories, services, photos, hours, Q&A, reviews and posts, done the way the map pack actually rewards.',
    lead:
      'It is free, it is the single strongest local ranking asset you own, and roughly every business has left half of it blank.',
    sections: [
      ['The audit: what is usually wrong',
       'Wrong or generic primary category. No secondary categories. Services and products empty. Three photos from 2019. Hours that were right before you changed them. Questions in the Q&A section answered by strangers, or not at all. Reviews unanswered. No posts. Any one of these costs you position; together they are why a better business loses to a worse one with a finished listing.'],
      ['Categories are the highest-leverage field',
       'The primary category is close to a ranking switch — it tells Google which searches you are even eligible for. Getting it exactly right, and adding every secondary category that genuinely applies, frequently moves a listing more than months of other work. It is also the field most often left on whatever was picked in a hurry years ago.'],
      ['Photos, posts and the signals of being alive',
       'A listing that gets fresh photos and regular posts reads as an active business, and active businesses get shown. This does not need to be a production: real photos of real work, uploaded steadily, do the job better than a polished shoot once a year.'],
      ['Reviews, and replying to them',
       'Ask automatically after every completed job, by text, while the work is fresh. Reply to all of them — a calm, specific reply to a bad review converts better than a wall of perfect fives, because it shows a real person stands behind the work.'],
      ['Keeping it consistent everywhere else',
       'The profile is the anchor, but it only holds if your name, address and phone match across your site, Apple Maps, Bing, Yelp, Facebook and your trade directories. Cleaning up contradictions is unglamorous and reliably moves rankings.'],
    ],
    faqs: [
      ['How much does Google Business Profile optimization cost?',
       'It is included in the $100 local presence audit as a full written list of what to fix, and the fixes themselves are part of any ongoing work. The profile itself is free — the cost is the hour spent doing it correctly.'],
      ['My listing is suspended or duplicated. Can that be fixed?',
       'Usually. Duplicates get merged, suspensions get appealed with the right documentation. It takes patience rather than tricks.'],
      ['How often should I post?',
       'Weekly is plenty and beats a burst followed by silence. Consistency is the signal, not volume.'],
    ],
  },
  {
    slug: 'google-ads-chester-county',
    title: 'Google Ads Management — Chester County, PA',
    h1: 'Google Ads that stop wasting money',
    desc:
      'Google Ads setup and management for Chester County, PA: local campaign structure, the negative keywords nobody adds, honest reporting, and why the landing page decides more than the bid. Setup from $350.',
    lead:
      'Google will happily spend your budget on searches that were never going to become customers. Most of the work is deciding what not to pay for.',
    sections: [
      ['Structure for a local business',
       'Tight campaigns by service, tight geography around the towns that actually feed your door, and ad copy that names the town and the price. Broad match with automated bidding and no supervision is how a local budget disappears into searches from three counties away.'],
      ['Negative keywords are most of the job',
       '"Free", "jobs", "salary", "DIY", "how to", "cheap", competitor names you do not want to pay for, and the long list specific to your trade. An account without a maintained negative list is not being managed. This is unglamorous and it is where the savings live.'],
      ['The landing page decides the cost',
       'Google charges less for relevance and converts better on clarity. Sending paid traffic to a homepage is the most common and most expensive mistake in local advertising. Each campaign should land on a page about that exact service, with the price, the proof and one action.'],
      ['What honest reporting looks like',
       'Spend, calls, form fills, booked jobs, and cost per booked job. Not impressions. If a report leads with impressions or "clicks are up", it is measuring the agency’s activity rather than your business.'],
    ],
    faqs: [
      ['How much should a small business spend on Google Ads?',
       'Enough to buy meaningful data in your market — often $500 to $1,500 a month locally — but only after your follow-up and landing pages are ready. Spending before that just increases the leak.'],
      ['Do you take a percentage of ad spend?',
       'No. Setup is a fixed fee from $350 and management is quoted flat, so there is no incentive to talk you into a bigger budget. You pay Google directly and can see every dollar.'],
      ['Google Ads or Meta Ads?',
       'Google catches people already looking for what you sell, which suits trades, professional services and anything urgent. Meta creates demand and suits visual, impulse and local-community businesses. If you can only do one, start with the one that matches how people decide to buy what you sell.'],
    ],
  },
  {
    slug: 'meta-ads-chester-county',
    title: 'Facebook & Instagram Ads — Chester County, PA',
    h1: 'Meta Ads for local businesses',
    desc:
      'Facebook and Instagram ads for Chester County, PA: local targeting, creative that works for small businesses, offer design, and how to measure what actually turns into customers. Setup from $250.',
    lead:
      'Meta is where a local business creates demand rather than catching it — which means the offer and the creative carry the campaign, not the targeting.',
    sections: [
      ['The offer is the campaign',
       'Boosting a post about how great you are does nothing. A specific offer with a reason and an end date does. New-customer pricing, a seasonal service, a limited slot count — something a person can act on today. Ninety percent of failed local Meta campaigns are an offer problem wearing a targeting costume.'],
      ['Creative that works locally',
       'Real footage of real work beats polished stock every time in a local feed, because it looks like a neighbor rather than an ad. Vertical video, the point in the first two seconds, captions on, and enough variants to let the platform find the one that works.'],
      ['Targeting for a small radius',
       'Local campaigns are usually over-targeted. A tight radius around the towns you actually serve, broad demographics within it, and let the algorithm do the rest — it is better at finding buyers than a hand-built interest stack, provided the offer and the creative give it something to work with.'],
      ['Measuring honestly',
       'Cost per lead and cost per booked job, tracked to the campaign. Reach and engagement are diagnostics at best. And the follow-up matters more here than anywhere: Meta leads are colder and go stale fast, so the ones answered in seconds convert at a completely different rate to the ones answered tomorrow.'],
    ],
    faqs: [
      ['How much do Facebook ads cost for a small business?',
       'Setup is from $250 here. Ad spend is paid directly by you, and locally $300 to $1,000 a month is a common starting range depending on how big your service area is.'],
      ['Do Facebook ads still work in 2026?',
       'Yes, for demand creation and for local awareness — but the bar on creative is much higher than it was, and the follow-up speed matters more than the targeting. Set-and-forget boosting stopped working years ago.'],
      ['Can you make the creative too?',
       'Yes. Creative direction is part of the setup, and a Creative Proof Pack ($150) exists for businesses that need assets before running anything.'],
    ],
  },
];

// Round two: the southern and western county, plus the Main Line edge. Added
// 2026-08-24. These append to TOWNS at build time — see EXTRA_TOWNS usage below.
export const EXTRA_TOWNS = [
  {
    slug: 'west-grove-pa',
    name: 'West Grove',
    full: 'West Grove, PA',
    zips: ['19390'],
    geo: { lat: 39.8226, lng: -75.8280 },
    blurb: 'the Avon Grove hub, a small borough absorbing a lot of new households',
    intro:
      'West Grove has been quietly growing for a decade. New developments along the Route 1 corridor keep adding families who have no history here, no neighbor to ask, and no idea which plumber or which salon the people down the road have used for twenty years. They search instead.',
    local:
      'That is the whole opportunity. The established businesses in West Grove have deep referral networks and almost no online presence, and the new arrivals cannot access the referral network. Whoever shows up correctly in search gets the entire new-household market by default — and right now, in most categories, nobody is showing up correctly.',
    faqs: [
      ['Why would a business that is busy on referrals bother with this?',
       'Because referrals only reach people who know someone. Every new household in West Grove is a customer your referral network cannot touch, and there are a lot of them arriving. Search is how you reach the half of the town that has not met anyone yet.'],
      ['Is West Grove big enough to justify local SEO?',
       'The borough is small; the market is not. Avon Grove, Penn Township, London Grove and the surrounding area all search the same way, and one properly built profile covers all of it.'],
      ['What is the single first thing to do?',
       'Finish the Google Business Profile and start asking for reviews automatically. In a market this size that alone can put you at the top of the map pack for your category.'],
    ],
  },
  {
    slug: 'avondale-pa',
    name: 'Avondale',
    full: 'Avondale, PA',
    zips: ['19311'],
    geo: { lat: 39.8237, lng: -75.7827 },
    blurb: 'mushroom country, small, and genuinely bilingual',
    intro:
      'Avondale sits in the middle of the mushroom industry, and its customer base reflects that: a large, established Spanish-speaking community alongside longtime local families, in a town small enough that everyone recognizes everyone. Marketing here that only speaks English is marketing to half the town.',
    local:
      'Very few businesses in the area run bilingual marketing properly — not translated-once-and-forgotten, but a listing, a site and a reply system that work in both languages. That is a real, cheap advantage sitting unclaimed. An AI agent handles it natively, answering in whichever language the customer wrote in, at any hour, without needing a bilingual staff member to be free.',
    faqs: [
      ['Do I really need Spanish-language marketing in Avondale?',
       'If you want the whole market, yes. A large share of the local customer base speaks Spanish at home, and the businesses that answer in Spanish get chosen by those customers with very little competition.'],
      ['How does the AI agent handle two languages?',
       'It replies in the language the customer used, with your real prices and hours, and hands off to you with the conversation translated if a human is needed. No bilingual staff required to be sitting there.'],
      ['Is a town this small worth building for?',
       'The town is small and the surrounding service area is not. Avondale, Chatham, London Grove and the Kennett fringe search together, and a single properly built presence covers all of them.'],
    ],
  },
  {
    slug: 'honey-brook-pa',
    name: 'Honey Brook',
    full: 'Honey Brook, PA',
    zips: ['19344'],
    geo: { lat: 40.0937, lng: -75.9124 },
    blurb: 'the far western edge, farm country, and a long drive from anywhere',
    intro:
      'Honey Brook is the western edge of the county, where Chester runs into Lancaster. It is agricultural, spread out, and the distances are real — which changes what "local" means. A customer here will drive twenty minutes without thinking about it, and will not drive forty.',
    local:
      'For a service business that means your true competitive radius is bigger than your township and smaller than the county, and almost nobody targets it correctly. The other thing that matters here is trust: this is a market where a business is chosen because it looks like it will show up and do what it said. Reviews and clear, plain information do more than any clever campaign.',
    faqs: [
      ['How far out should I be targeting from Honey Brook?',
       'Usually twenty to twenty-five minutes, which pulls in Elverson, Morgantown, parts of Lancaster County and out toward Coatesville. Targeting the whole county wastes money; targeting the township leaves work on the table.'],
      ['Does anyone out here actually search online?',
       'Yes, and increasingly for the things that are hard to get a referral for — an emergency repair, a specialty service, a new business in the area. Those are the high-value searches, and they are wide open.'],
      ['I serve customers in Lancaster County too. Does that complicate things?',
       'No. The service area is defined by where you actually work, county lines included, and the pages and targeting follow that rather than an administrative boundary.'],
    ],
  },
  {
    slug: 'parkesburg-pa',
    name: 'Parkesburg',
    full: 'Parkesburg, PA',
    zips: ['19365'],
    geo: { lat: 39.9587, lng: -75.9188 },
    blurb: 'a small working borough on the western Route 30 stretch, with a train station',
    intro:
      'Parkesburg is a compact borough on the western end of the county with a rail stop, an older housing stock and a steady population that mostly works elsewhere. Businesses here serve people at the beginning and end of the day, and the surrounding townships more than the borough itself.',
    local:
      'The competitive picture is thin, which is good news. Most categories have two or three businesses and none of them have done the basic work — a finished listing, real photos, current hours, a phone that gets answered when someone calls at 5:15pm on the way home. Any one of those, done properly, is enough to take the top position here.',
    faqs: [
      ['What does "the basic work" actually mean?',
       'A complete Google Business Profile with correct categories, current photos and accurate hours; reviews being asked for automatically; and a way for a customer to get an answer instantly instead of leaving a voicemail. That is most of the game in a market this size.'],
      ['My customers call, they do not fill out forms. Does this still apply?',
       'More so. Missed-call text-back is the highest-return thing a phone-driven business can install — every missed call turns into an automatic text within seconds, which is how you stop losing the caller to whoever they dial next.'],
      ['Should I target Coatesville and Atglen too?',
       'If you serve them, yes. The western stretch of Route 30 works as one market, and the targeting should follow the drive time rather than the borough line.'],
    ],
  },
  {
    slug: 'spring-city-pa',
    name: 'Spring City',
    full: 'Spring City, PA',
    zips: ['19475'],
    geo: { lat: 40.1762, lng: -75.5471 },
    blurb: 'the northern tip of the county, on the Schuylkill, sharing a market with Royersford',
    intro:
      'Spring City sits at the top corner of Chester County, across the river from Royersford and close enough to Phoenixville and Pottstown that the customer base overlaps all of them. People here do not think in county lines; they think in bridges and a ten-minute drive.',
    local:
      'That means targeting by county is exactly wrong for a Spring City business. The market is a river corridor spanning three counties, and the businesses that treat it that way pick up customers that their competitors, who set their radius by administrative boundary, never see. The area has also been steadily gentrifying along with Phoenixville, which is bringing in customers who search before they ask.',
    faqs: [
      ['Should I target Montgomery County customers too?',
       'If Royersford and Limerick are a ten-minute drive, yes. The customer does not care which county they are in, and neither should your ad radius or your service pages.'],
      ['How does Spring City compare to Phoenixville for competition?',
       'Much thinner. Phoenixville is crowded; Spring City is not. A business that ranks well in Spring City and targets the corridor gets Phoenixville-adjacent customers without fighting Bridge Street head-on.'],
      ['Is the growth here worth building for now?',
       'Yes, and early is the point. Presence built before an area fills in is far cheaper than presence built after, because reviews and rankings compound over time.'],
    ],
  },
  {
    slug: 'berwyn-pa',
    name: 'Berwyn',
    full: 'Berwyn, PA',
    zips: ['19312'],
    geo: { lat: 40.0442, lng: -75.4432 },
    blurb: 'Main Line, Tredyffrin–Easttown, affluent and quietly demanding',
    intro:
      'Berwyn and Devon sit in the middle of the Main Line, where the customer base is affluent, well-served, and unusually quick to judge a business by how it presents itself. Price is rarely the objection here. Doubt is.',
    local:
      'What that means practically: your website is doing reputation work before it does sales work. A dated site, a listing with no photos, or a form that goes unanswered for a day reads as a business that is not quite serious — and there is always another option a mile down Lancaster Avenue. The winning combination in Berwyn is presentation that looks expensive paired with a response that arrives in seconds.',
    faqs: [
      ['Do I need to compete on price in Berwyn?',
       'Rarely. This market buys on confidence — clear information, real proof, fast response and a presentation that matches the price. Discounting here often does the opposite of what you intend.'],
      ['Is the Main Line too competitive for a small business?',
       'Competitive on quality, not on effort. Most local competitors still have half-finished listings and slow response. Doing the unglamorous parts well is enough to stand out even here.'],
      ['Can you cover Devon, Paoli and Wayne together?',
       'Yes. They function as one customer base along the same corridor, and the targeting and content are built for the corridor rather than a single ZIP code.'],
    ],
  },
];

// Vertical pages. Only for the industries actually being sold to, and only where
// there is something specific to say — a mad-libbed industry page is a doorway
// page with a different variable swapped.
export const INDUSTRIES = [
  {
    slug: 'barbershop-marketing-chester-county',
    title: 'Barbershop & Salon Marketing — Chester County, PA',
    h1: 'Marketing for barbershops and salons',
    desc:
      'Marketing for barbershops and salons in Chester County, PA: filling the chair on slow days, getting found for "barber near me", turning walk-ins into regulars, and the rebooking texts that actually work.',
    lead:
      'A chair that sits empty at 2pm on a Tuesday is revenue that does not come back. Almost everything worth doing in this business is about the gap between appointments, not about getting more attention.',
    sections: [
      ['The math nobody runs',
       'Most shops focus on new clients when the expensive problem is the ones who stopped coming. A client who came every three weeks and has not been in for nine is not gone — they are busy, and nobody reminded them. A win-back text to that list is the highest-return thirty minutes in the whole business, and it costs nothing.'],
      ['Getting found for "barber near me"',
       'This is a map-pack fight, and it is decided by your Google Business Profile and your reviews. Primary category set correctly, current photos of actual cuts, hours that are right including the day you close early, and a steady stream of reviews asked for by text right after the cut. Shops that do this beat shops with better haircuts. That is unfair and it is how it works.'],
      ['Turning a walk-in into a regular',
       'The first visit is the only cheap one. Everything after depends on whether they rebook before they leave and whether anything reminds them. Booking that takes ten seconds on a phone, a rewards card they actually open, and a text at the right interval — that is the entire retention system, and most shops have none of it.'],
      ['Slow days are a scheduling problem, not a marketing problem',
       'A promotion blasted to everyone devalues your price for the people who would have paid it. A message sent only to clients who are overdue, offering a specific slot on a specific slow day, fills the chair without training anyone to wait for a discount.'],
    ],
    faqs: [
      ['How do I get more clients into my barbershop?',
       'In order of return: text your lapsed clients, finish your Google Business Profile, ask every client for a review by text after the cut, then make rebooking take ten seconds. Paid ads come after all four — a shop that runs ads before fixing retention is renting customers it cannot keep.'],
      ['Do barbershops need a website?',
       'A fast one-page site with prices, hours, photos and a booking link, yes. A ten-page site, no. Most clients are checking three things: are you open, what does it cost, and can I book right now.'],
      ['What about the Loop app?',
       'Loop is the shop-side product — booking, a rewards card clients actually open, win-back texts and a shop website in one. It exists because these four things are what fills chairs, and running them separately is why most shops do none of them.'],
    ],
  },
  {
    slug: 'restaurant-marketing-chester-county',
    title: 'Restaurant Marketing — Chester County, PA',
    h1: 'Marketing for restaurants and food businesses',
    desc:
      'Restaurant marketing for Chester County, PA: winning the "restaurants near me" decision, getting your hours and menu right where it counts, review recovery, and filling the tables that are actually empty.',
    lead:
      'Restaurant decisions get made in about ninety seconds, on a phone, by someone who is already hungry and already nearby. Nearly all of your marketing either helps in that ninety seconds or does nothing.',
    sections: [
      ['The ninety-second decision',
       'They search, they scan the map pack, they look at photos, they check whether you are open, they glance at the last two reviews, they pick. If your hours are wrong you lose. If your photos are dark and four years old you lose. If your last review is a two-star with no reply, you lose. None of this requires a campaign — it requires an hour with your listing.'],
      ['Photos do the selling',
       'Food photos on your Google profile get looked at more than anything else you publish anywhere. They should be recent, well lit, and of what people actually order. Uploading a few every week reads as an active restaurant and gets you shown more, which is a rare case of the effort and the reward being directly connected.'],
      ['Reviews, and the reply that matters more than the review',
       'You cannot avoid bad reviews. You can make them cost less. A calm, specific, non-defensive reply converts readers better than an unbroken row of fives, because it shows a real person runs the place. Ask for reviews systematically at the end of the meal and the average takes care of itself.'],
      ['Fill the empty night, not every night',
       'Blanket discounting trains your regulars to wait for a deal. Targeted offers — to a list, for a specific slow night, with a real reason — fill seats without teaching anyone that your prices are negotiable.'],
    ],
    faqs: [
      ['How do restaurants show up higher on Google Maps?',
       'Complete profile with the right primary category, accurate hours including holidays, fresh photos weekly, menu linked and current, questions answered, and a steady flow of recent reviews. Recency counts — a restaurant with twenty reviews from this month often outranks one with two hundred from three years ago.'],
      ['Is social media worth it for a restaurant?',
       'For regulars and for staying top of mind, yes. For new customers, search does the heavy lifting — people rarely discover a restaurant on Instagram and drive there that night, but they do search "near me" and pick from what they see.'],
      ['What about the delivery platforms?',
       'They are a channel, not a strategy, and an expensive one. They work best as a supplement to direct orders, which is why the site should make ordering directly easy enough that regulars stop paying the platform tax on your behalf.'],
    ],
  },
  {
    slug: 'contractor-marketing-chester-county',
    title: 'Contractor Marketing — Chester County, PA',
    h1: 'Marketing for contractors and home services',
    desc:
      'Marketing for contractors, trades and home services in Chester County, PA: winning emergency searches, missed-call text-back, quoting faster than the competition, and getting off the lead-selling platforms.',
    lead:
      'You lose more jobs to a full voicemail box than to a competitor’s marketing. Everything below is downstream of that one fact.',
    sections: [
      ['The missed call is the whole problem',
       'Your hands are busy. The phone rings, goes to voicemail, and the homeowner calls the next number. Missed-call text-back fixes this in one step: every missed call fires an automatic text within seconds saying you are on a job and asking what they need. That single automation typically recovers more work in a month than any campaign, and it costs less than one lost job.'],
      ['Emergency searches are a speed contest',
       '"Burst pipe", "no heat", "tree down" — these searches convert to a call within minutes and go to whoever answers first with a real answer. Being in the map pack matters, but being answerable matters more. An AI agent that can qualify the job, confirm you cover their town and book a slot while you are up a ladder wins these outright.'],
      ['Quote speed beats quote price more often than you think',
       'Homeowners collect two or three quotes and a surprising share hire the first one that arrives, because waiting is unpleasant and the first quote sets the anchor. Anything that shortens the gap between the call and the number is worth more than shaving your margin.'],
      ['Getting off the lead platforms',
       'Buying shared leads means paying to compete with three other contractors on price, for a customer who is not yours. Your own map-pack position and your own review base produce leads that cost less each year instead of more. The platforms are a bridge, not a business.'],
    ],
    faqs: [
      ['How do contractors get more leads without buying them?',
       'Rank in the map pack for your service plus your towns, answer instantly including missed calls, and build reviews systematically after every job. That combination produces leads you own, at a cost that falls over time rather than rising.'],
      ['Do I need a website if I get work from Facebook groups?',
       'Yes — because the first thing someone does after seeing your name in a group is search it. If that search turns up nothing, the recommendation cools. The site is what converts the referral you already earned.'],
      ['I work out of a truck with no storefront. Can I still rank?',
       'Yes, as a service-area business: address hidden, service area defined, and a real page for each town you genuinely work in. Plenty of trades hold top map positions this way.'],
    ],
  },
  {
    slug: 'professional-services-marketing-chester-county',
    title: 'Professional Services Marketing in Chester County, PA',
    h1: 'Marketing for professional services',
    desc:
      'Marketing for law firms, accountants, consultants, medical and other professional services in Chester County, PA: lead response time, trust signals, intake automation and content that earns the call.',
    lead:
      'A professional service is bought on trust and lost on response time. The firms that win locally are rarely the best-credentialed ones; they are the ones that got back to the person while the person was still worried.',
    sections: [
      ['Response time is the conversion rate',
       'Someone with a legal problem, a tax notice or a symptom is anxious, and anxious people contact two or three firms and go with whoever responds first with a human answer. An intake agent that replies in seconds, gathers the relevant details and books the consultation converts at a completely different rate to a form that lands in an inbox until Monday.'],
      ['Trust is built before the call, in public',
       'Credentials, real photos, plain-language answers to the questions people are embarrassed to ask, and reviews that read like real clients. Stock imagery and jargon do the opposite of what they are meant to. In this category, sounding like a person is a competitive advantage.'],
      ['Content that earns the call',
       'Answer the actual questions your clients ask in the first meeting — what this costs, how long it takes, what happens first, whether they even need you. Firms are strangely reluctant to publish this, which is exactly why publishing it works. It is also what AI assistants quote when someone asks them the same question.'],
      ['Intake without the friction',
       'Every extra field on a form, every "we will get back to you within two business days", every phone tree costs you clients who were ready. Booking that takes thirty seconds and a confirmation that arrives immediately are worth more than another five thousand impressions.'],
    ],
    faqs: [
      ['Does SEO work for law firms and accountants locally?',
       'Yes, and local intent is where it pays. Broad terms are dominated by national directories; "estate attorney West Chester PA" or "CPA near Exton" are winnable with a complete profile, real reviews and pages that answer the practical questions.'],
      ['Is an AI agent appropriate for a professional practice?',
       'For intake and scheduling, yes — it gathers the facts, answers process and fee questions, and books the consult. It should never give advice, and it is scoped so it does not. It makes the first contact instant, which is the part that decides whether they call you or someone else.'],
      ['How do I compete with the big regional firms?',
       'On responsiveness and specificity. They have budget; they also have intake queues and generic content. A local firm that answers immediately and writes plainly about the exact situation a local client is in beats scale more often than you would expect.'],
    ],
  },
  {
    slug: 'gym-and-fitness-marketing-chester-county',
    title: 'Gym & Fitness Marketing — Chester County, PA',
    h1: 'Marketing for gyms, studios and trainers',
    desc:
      'Marketing for gyms, fitness studios and personal trainers in Chester County, PA: trial-to-member conversion, the follow-up that stops leads going cold, retention, and January without the churn.',
    lead:
      'Getting someone to enquire is the easy part of this business. Everything expensive happens in the two weeks after.',
    sections: [
      ['The lead goes cold in hours, not days',
       'Fitness enquiries are emotional and perishable. Someone decides at 9pm that this is the week they start; if nobody replies until tomorrow afternoon, the feeling has passed. Instant reply, a booked trial in the same conversation, and a reminder before it — that sequence is most of the difference between a full floor and an empty one.'],
      ['Trial to member is a follow-up problem',
       'Most studios get people through the door and then leave the conversion to chance. A structured follow-up — after the first session, after the third, before the trial ends, and once more after — converts substantially better than hoping someone asks at the desk. It is entirely automatable and almost nobody does it.'],
      ['Retention beats acquisition, and it is cheaper',
       'A member who stops showing up cancels about six weeks later. The attendance drop is visible long before the cancellation, and a message at the right moment saves a meaningful share of them. Winning back a lapsed member costs a fraction of finding a new one.'],
      ['January, honestly',
       'The January rush is real and mostly wasted, because the people who sign up in January are the people most likely to churn by March. The businesses that profit from it are the ones with an onboarding sequence that gets someone to their fourth session, which is roughly where a habit starts holding.'],
    ],
    faqs: [
      ['How do gyms get more members locally?',
       'Rank for "gym near me" and your town, reply to every enquiry within minutes, book a trial in that first conversation, then follow up on a schedule through the trial. Ads work here, but only once the follow-up exists — otherwise you are paying for leads that go cold.'],
      ['What is the best offer for a fitness studio?',
       'A low-friction first step with a real end date — a free week, a three-session intro — paired with a follow-up sequence that converts it. The offer is not the hard part; the two weeks after it are.'],
      ['Does social media bring in members?',
       'It builds trust and shows the room, which matters in this category more than most. But the enquiry usually comes through search or a direct message, and it lives or dies on how fast someone replies.'],
    ],
  },
];
