// Builds the /ai-marketing/ cluster + sitemap.xml + llms.txt from tools/seo-data.mjs.
// Run: node tools/seo-build.mjs
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE, TOWNS as CORE_TOWNS, EXTRA_TOWNS, GUIDES, SERVICES, INDUSTRIES } from './seo-data.mjs';

const TOWNS = [...CORE_TOWNS, ...EXTRA_TOWNS];

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TODAY = new Date().toISOString().slice(0, 10);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const J = (o) => JSON.stringify(o).replace(/</g, '\\u003c');

const ICONS = [
  '<link rel="icon" href="/favicon.ico" sizes="any" />',
  '<link rel="icon" type="image/svg+xml" href="/favicon.svg" />',
  '<link rel="apple-touch-icon" href="/apple-touch-icon.png" />',
  '<link rel="manifest" href="/site.webmanifest" />',
].join('\n');

const CSS = `
  :root{--cyan:#5df2e0;--blue:#6f9dff;--violet:#b98bff;--text:#eef1ff;--muted:#96a0c4;--line:rgba(150,190,255,.16);--line2:rgba(150,195,255,.36);--grad:linear-gradient(120deg,var(--cyan),var(--blue) 55%,var(--violet))}
  *{box-sizing:border-box}
  body{margin:0;font-family:"Space Grotesk",system-ui,-apple-system,"Segoe UI",Arial,sans-serif;color:var(--text);line-height:1.65;
    background:radial-gradient(circle at 12% -8%,rgba(94,242,224,.10),transparent 36%),radial-gradient(circle at 88% 4%,rgba(185,139,255,.10),transparent 38%),linear-gradient(180deg,#05070f,#03040a);min-height:100vh}
  .wrap{width:min(760px,92vw);margin:auto;padding:26px 0 70px}
  .top{display:flex;justify-content:space-between;align-items:center;gap:14px;margin-bottom:26px}
  .brand{font-weight:700;font-size:19px;text-decoration:none;color:var(--text)}
  .brand span{background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}
  .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:0;background:var(--grad);color:#03040a;border-radius:999px;padding:12px 18px;font:inherit;font-weight:700;font-size:14px;cursor:pointer;text-decoration:none}
  .btn.ghost{background:transparent;color:var(--text);border:1px solid var(--line2)}
  .crumb{font-size:13px;color:var(--muted);margin-bottom:8px}
  .crumb a{color:var(--muted);text-decoration:none}
  .crumb a:hover{color:var(--cyan)}
  .eyebrow{color:var(--cyan);text-transform:uppercase;letter-spacing:.2em;font-size:12px;font-weight:700}
  h1{font-size:clamp(30px,6vw,44px);line-height:1.08;letter-spacing:-.02em;margin:10px 0 14px}
  h2{font-size:clamp(21px,3.4vw,27px);line-height:1.2;letter-spacing:-.015em;margin:38px 0 12px}
  h3{font-size:18px;margin:26px 0 8px}
  p{margin:0 0 16px}
  .lead{color:#c6cde8;font-size:18px;margin:0 0 26px}
  .muted{color:var(--muted)}
  .box{background:linear-gradient(160deg,rgba(150,190,255,.07),rgba(150,190,255,.02));border:1px solid var(--line2);border-radius:20px;padding:22px 24px;margin:22px 0}
  .box h3{margin-top:0}
  .box p:last-child{margin-bottom:0}
  ul{margin:0 0 16px;padding-left:20px;color:#c6cde8}
  li{margin-bottom:8px}
  a{color:var(--cyan)}
  .grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));margin:18px 0 6px}
  .grid a{display:block;background:rgba(150,190,255,.05);border:1px solid var(--line);border-radius:14px;padding:14px 16px;text-decoration:none;color:var(--text);font-weight:600;font-size:15px;transition:border-color .2s,transform .2s}
  .grid a:hover{border-color:var(--cyan);transform:translateY(-2px)}
  .grid a small{display:block;color:var(--muted);font-weight:400;font-size:13px;margin-top:3px}
  .faq{border-top:1px solid var(--line);padding:18px 0 2px}
  .faq h3{margin:0 0 8px;font-size:17px}
  .faq p{color:#c6cde8;font-size:15.5px}
  .cta{background:linear-gradient(145deg,rgba(94,242,224,.12),rgba(185,139,255,.08));border:1px solid var(--line2);border-radius:20px;padding:28px;text-align:center;margin-top:38px}
  .cta h2{margin:0 0 8px;font-size:23px}
  .cta p{color:var(--muted);margin:0 0 18px;font-size:15px}
  .cta .row{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
  .foot{color:var(--muted);font-size:13px;margin-top:44px;text-align:center;border-top:1px solid var(--line);padding-top:20px}
  .foot a{color:var(--muted)}
`;

function page({ url, title, desc, schema = [], body }) {
  const canonical = SITE.origin + url;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}" />
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
<meta name="geo.region" content="US-PA" />
<meta name="author" content="${esc(SITE.brand)}" />
<link rel="canonical" href="${canonical}" />
<meta property="og:type" content="article" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:url" content="${canonical}" />
<meta property="og:site_name" content="${esc(SITE.brand)}" />
<meta property="og:image" content="${SITE.og}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(desc)}" />
<meta name="twitter:image" content="${SITE.og}" />
<meta name="theme-color" content="#03040a" />
${ICONS}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" media="print" onload="this.media='all'"><noscript><link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet"></noscript>
<script defer src="/track.js"></script>
${schema.map((s) => `<script type="application/ld+json">${J(s)}</script>`).join('\n')}
<style>${CSS}</style>
</head>
<body>
<div class="wrap">
  <div class="top"><a class="brand" href="/">TB <span>Solutions</span></a><a class="btn" href="${SITE.book}" target="_blank" rel="noopener">Book a Free Call</a></div>
${body}
  <p class="foot">© ${new Date().getFullYear()} ${esc(SITE.brand)} · <a href="/">tbsol.net</a> · AI marketing, web design &amp; local SEO for Chester County, PA · <a href="tel:${SITE.phone}">${SITE.phoneDisplay}</a></p>
</div>
</body>
</html>
`;
}

const crumbs = (items) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, url], i) => ({
    '@type': 'ListItem', position: i + 1, name, item: SITE.origin + url,
  })),
});

const faqSchema = (faqs) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map(([q, a]) => ({
    '@type': 'Question', name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
});

const faqBlock = (faqs) =>
  `  <h2>Questions we get asked</h2>\n` +
  faqs.map(([q, a]) => `  <div class="faq"><h3>${esc(q)}</h3><p>${esc(a)}</p></div>`).join('\n');

const ctaBlock = (line) => `  <div class="cta">
    <h2>Get the plan before you spend a dollar</h2>
    <p>${esc(line)} Free call, no pressure — you leave with the single highest-impact fix whether you hire us or not.</p>
    <div class="row">
      <a class="btn" href="${SITE.book}" target="_blank" rel="noopener">Book my free marketing plan</a>
      <a class="btn ghost" href="tel:${SITE.phone}">${SITE.phoneDisplay}</a>
    </div>
  </div>`;

const SYSTEM_BLOCK = `  <h2>What the system is made of</h2>
  <p>Four parts. They are sold separately, but they are designed to feed each other — the ads fill the site, the site feeds the agent, the agent feeds the follow-up, and the follow-up feeds the reviews that make the next customer cheaper to win.</p>
  <div class="box">
    <h3>1. An AI growth agent on your site</h3>
    <p>A chat concierge trained on your services, prices, hours and policies. It answers instantly at any hour, qualifies the visitor, books the appointment or captures the contact, and texts you the conversation. <a href="/ai-marketing/ai-chatbot-for-local-business/">How the agent works →</a></p>
  </div>
  <div class="box">
    <h3>2. Local SEO and a Google Business Profile that is actually finished</h3>
    <p>Correct primary and secondary categories, real photos, accurate hours, service areas, products and services filled in, questions answered, reviews answered, and location-specific pages that give Google a reason to rank you for the town you are actually in.</p>
  </div>
  <div class="box">
    <h3>3. A site that loads fast and converts</h3>
    <p>Price and proof above the fold, one clear action, mobile-first, and fast enough that nobody bounces before it paints. Design is treated as a conversion feature here, not decoration.</p>
  </div>
  <div class="box">
    <h3>4. Follow-up that never forgets</h3>
    <p>Missed-call text-back within seconds, instant reply to every form and message, a review request after every completed job, and a win-back sequence for customers who have gone quiet. This is usually the piece that pays for the rest.</p>
  </div>`;

function townPage(t, all) {
  const url = `/ai-marketing/${t.slug}/`;
  const title = `AI Marketing in ${t.full} | TB Solutions`;
  const desc = `AI marketing for ${t.full} businesses: an AI growth agent that answers customers instantly, local SEO and Google Business Profile work, fast websites, and lead follow-up that never forgets. Free marketing plan call.`;
  const nearby = all.filter((x) => x.slug !== t.slug).slice(0, 6);
  const body = `  <div class="crumb"><a href="/">Home</a> › <a href="/ai-marketing/">AI Marketing</a> › ${esc(t.name)}</div>
  <div class="eyebrow">${esc(t.full)} · ${t.zips.join(' · ')}</div>
  <h1>AI marketing in ${esc(t.name)}, PA</h1>
  <p class="lead">${esc(t.intro)}</p>

  <h2>What ${esc(t.name)} businesses are actually up against</h2>
  <p>${esc(t.local)}</p>
  <p>${esc(t.name)} is ${esc(t.blurb)} — and that shapes the whole approach. The point of putting AI into your marketing is not novelty. It is that a small business here competes against companies with staff, and software is the only way to be as responsive as a company with staff without hiring one.</p>

${SYSTEM_BLOCK}

  <h2>Where the money usually is first</h2>
  <p>For most ${esc(t.name)} businesses the fastest return is not more traffic. It is the leads you are already getting and losing — the missed call at 4:50pm, the form filled out on Sunday, the message that got read and then buried. Close that gap first, then spend on getting found. <a href="/ai-marketing/cost/">What each piece costs →</a></p>

  <div class="box">
    <h3>Also worth knowing: your customers are asking AI now</h3>
    <p>A growing share of "who should I call in ${esc(t.name)}" questions get asked to ChatGPT or answered by Google's AI overview instead of a results page. Being the business those systems name is a separate, learnable job — and almost nobody local is doing it yet. <a href="/ai-marketing/get-found-by-chatgpt-and-ai-search/">How to get recommended by AI search →</a></p>
  </div>

${faqBlock(t.faqs)}

  <h2>Other towns we cover</h2>
  <div class="grid">
${nearby.map((n) => `    <a href="/ai-marketing/${n.slug}/">AI marketing in ${esc(n.name)}<small>${esc(n.full)}</small></a>`).join('\n')}
    <a href="/ai-marketing/">All of Chester County<small>The full guide</small></a>
  </div>

${ctaBlock(`Tell us what you do in ${t.name} and we will tell you exactly where you are losing customers.`)}`;

  const schema = [
    crumbs([['Home', '/'], ['AI Marketing', '/ai-marketing/'], [t.name, url]]),
    faqSchema(t.faqs),
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      '@id': SITE.origin + url + '#service',
      serviceType: 'AI marketing, local SEO and web design',
      name: `AI Marketing in ${t.full}`,
      description: desc,
      provider: { '@type': 'ProfessionalService', '@id': SITE.origin + '/#business', name: SITE.brand, telephone: SITE.phone, url: SITE.origin + '/' },
      areaServed: { '@type': 'City', name: t.full, geo: { '@type': 'GeoCoordinates', latitude: t.geo.lat, longitude: t.geo.lng } },
      url: SITE.origin + url,
    },
  ];
  return { url, html: page({ url, title, desc, schema, body }) };
}

function contentPage(g, opts) {
  const { base, siblings, hubName, hubUrl } = opts;
  const url = `${base}${g.slug}/`;
  const body = `  <div class="crumb"><a href="/">Home</a> › <a href="${hubUrl}">${esc(hubName)}</a> › ${esc(g.h1)}</div>
  <div class="eyebrow">Chester County, PA · ${esc(hubName)}</div>
  <h1>${esc(g.h1)}</h1>
  <p class="lead">${esc(g.lead)}</p>

${g.sections.map(([h, p]) => `  <h2>${esc(h)}</h2>\n  <p>${esc(p)}</p>`).join('\n\n')}

${faqBlock(g.faqs)}

  <h2>Keep reading</h2>
  <div class="grid">
    <a href="${hubUrl}">${esc(hubName)}<small>The hub</small></a>
${siblings.filter((x) => x.slug !== g.slug).map((x) => `    <a href="${base}${x.slug}/">${esc(x.h1)}<small>${esc(x.title.split('|')[0].trim())}</small></a>`).join('\n')}
${base === '/services/' ? `    <a href="/ai-marketing/">AI marketing in Chester County<small>The AI guide</small></a>` : `    <a href="/services/">Marketing services in Chester County<small>Websites, SEO, ads</small></a>`}
  </div>

${ctaBlock('Bring your website, your Google listing and your worst month.')}`;

  const schema = [
    crumbs([['Home', '/'], [hubName, hubUrl], [g.h1, url]]),
    faqSchema(g.faqs),
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: g.title,
      description: g.desc,
      author: { '@type': 'Organization', name: SITE.brand, url: SITE.origin + '/' },
      publisher: { '@type': 'Organization', name: SITE.brand, logo: { '@type': 'ImageObject', url: SITE.og } },
      mainEntityOfPage: SITE.origin + url,
      datePublished: TODAY,
      dateModified: TODAY,
    },
  ];
  return { url, html: page({ url, title: g.title, desc: g.desc, schema, body }) };
}

function pillarPage() {
  const url = '/ai-marketing/';
  const title = 'AI Marketing in Chester County, PA | TB Solutions';
  const desc =
    'AI marketing for Chester County businesses: an AI growth agent that answers customers in seconds, local SEO and Google Business Profile work, fast converting websites, and follow-up that never forgets a lead. Serving West Chester, Exton, Malvern, Downingtown, Kennett Square, Phoenixville and the Main Line.';
  const body = `  <div class="crumb"><a href="/">Home</a> › AI Marketing</div>
  <div class="eyebrow">Chester County · Pennsylvania</div>
  <h1>AI marketing for Chester County businesses</h1>
  <p class="lead">Software that answers your customers in seconds, gets you found in the map pack, and follows up with every lead forever — built and run by one person you can actually call, for local businesses from West Chester to Oxford.</p>

  <div class="box">
    <h3>The short version</h3>
    <p><b>AI marketing</b> means using software that can read, write and decide to do the marketing work that used to need a person at a desk: replying to a customer at 9pm, qualifying which of forty leads is real, following up with the rest, and producing the content you never get around to. For a local business in Chester County, the return comes from four things — instant response, a finished Google Business Profile, a fast site, and follow-up that never forgets. <a href="/ai-marketing/what-is-ai-marketing/">The full plain-English explanation →</a></p>
  </div>

  <h2>Why this matters more here than it sounds like it should</h2>
  <p>Chester County is a county of small businesses competing against companies with staff. A four-person shop in Downingtown is bidding for the same customer as a regional chain with a call center and a marketing department. The chain will always answer the phone. It will always follow up. It will never forget to ask for a review.</p>
  <p>That used to be an unwinnable gap. It is not anymore, because the specific advantages a bigger company buys with payroll — availability, consistency, memory — are now the exact things software does best. That is the entire argument for putting AI in the middle of a local marketing system, and it is the only argument that matters.</p>

${SYSTEM_BLOCK}

  <h2>Pick your town</h2>
  <p>Every town in the county competes differently. West Chester is a dogfight for the same walkable customer; Exton is a corridor of people in motion; Oxford is a referral market where barely anyone has a complete listing. The pages below get specific about each one.</p>
  <div class="grid">
${TOWNS.map((t) => `    <a href="/ai-marketing/${t.slug}/">AI marketing in ${esc(t.name)}<small>${esc(t.full)}</small></a>`).join('\n')}
  </div>

  <h2>The guides</h2>
  <div class="grid">
${GUIDES.map((g) => `    <a href="/ai-marketing/${g.slug}/">${esc(g.h1)}<small>${esc(g.title.split('|')[0].trim())}</small></a>`).join('\n')}
  </div>

  <h2>What it costs</h2>
  <p>Published, not quoted-on-a-call: a local presence audit is about $100, a premium one-page site about $300, an AI growth agent setup about $400, a lead follow-up system about $500, and ad setup from $250 (Meta) or $350 (Google) with spend paid directly by you. Monthly management is quoted after a call. No long-term contracts. <a href="/ai-marketing/cost/">The full pricing breakdown →</a></p>

  <h2>Every service, with the price on it</h2>
  <p>Websites from $300, local SEO and Google Business Profile work, Google and Meta Ads, and the follow-up system — each one has its own page with what it does and what it costs. <a href="/services/">All marketing services in Chester County →</a></p>

  <h2>Who does the work</h2>
  <p>TB Solutions is a Chester County studio run by Nick Byrd out of West Chester. You talk to the person building the thing — no account manager, no ticket queue, no two-week turnaround on a one-line change. That is why the pricing looks nothing like an agency retainer and why changes happen the same day. <a href="/ai-marketing/ai-marketing-vs-agency/">How this compares to hiring an agency →</a></p>

${faqBlock([
    ['What is AI marketing for a small business?',
     'Using software that can read, write and make decisions to run the repetitive, time-sensitive parts of marketing: replying to every inquiry instantly, qualifying leads, following up on a schedule, requesting reviews, and producing content. For a local business the biggest single return is response speed — being the first business to give a real answer, at any hour.'],
    ['Does TB Solutions only serve Chester County?',
     'Chester County and the Main Line are home, and local work gets local knowledge. But the system itself — agent, site, SEO, follow-up — is not geographically limited, and we build for businesses outside the county too.'],
    ['How fast does this start working?',
     'Follow-up and missed-call text-back start recovering leads the day they are switched on. Google Business Profile fixes typically show movement in days to a couple of weeks. Organic rankings for competitive town-plus-service terms take a couple of months of consistent work.'],
    ['Do I need to be technical to run any of this?',
     'No. It is set up for you, connected to your phone and your calendar, and it reports in plain language. If you can read a text message, you can operate it.'],
    ['What if I already have a website I like?',
     'Then we keep it. The agent and the follow-up system bolt onto an existing site as long as it loads reasonably fast and can take a booking. Rebuilding is only worth it when the current site is actively costing you customers.'],
  ])}

${ctaBlock('Bring your website, your Google listing and the number you wish were higher.')}`;

  const schema = [
    crumbs([['Home', '/'], ['AI Marketing', url]]),
    faqSchema([
      ['What is AI marketing for a small business?',
       'Using software that can read, write and make decisions to run the repetitive, time-sensitive parts of marketing: replying to every inquiry instantly, qualifying leads, following up on a schedule, requesting reviews, and producing content. For a local business the biggest single return is response speed.'],
      ['Does TB Solutions only serve Chester County?',
       'Chester County and the Main Line are home, and local work gets local knowledge. The system itself is not geographically limited.'],
      ['How fast does this start working?',
       'Follow-up and missed-call text-back start recovering leads the day they are switched on. Google Business Profile fixes typically show movement in days to a couple of weeks. Organic rankings for competitive terms take a couple of months.'],
      ['Do I need to be technical to run any of this?',
       'No. It is set up for you, connected to your phone and calendar, and reports in plain language.'],
      ['What if I already have a website I like?',
       'The agent and follow-up system bolt onto an existing site as long as it loads reasonably fast and can take a booking.'],
    ]),
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      '@id': SITE.origin + url + '#service',
      name: 'AI Marketing for Chester County Businesses',
      serviceType: 'AI marketing, local SEO, web design and lead automation',
      description: desc,
      provider: { '@type': 'ProfessionalService', '@id': SITE.origin + '/#business', name: SITE.brand, telephone: SITE.phone, email: SITE.email, url: SITE.origin + '/' },
      areaServed: [
        { '@type': 'AdministrativeArea', name: 'Chester County, PA' },
        ...TOWNS.map((t) => ({ '@type': 'City', name: t.full })),
      ],
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: 'AI marketing services',
        itemListElement: [
          ['AI Growth Agent Setup', 400], ['Local Presence Audit', 100], ['Premium One-Page Website', 300],
          ['Lead Follow-Up System', 500], ['Meta Ads Starter', 250], ['Google Ads Starter', 350],
        ].map(([name, price]) => ({ '@type': 'Offer', name, price: String(price), priceCurrency: 'USD' })),
      },
      url: SITE.origin + url,
    },
  ];
  return { url, html: page({ url, title, desc, schema, body }) };
}


function servicesHub() {
  const url = '/services/';
  const title = 'Marketing Services in Chester County, PA | TB Solutions';
  const desc = 'Marketing services for Chester County, PA businesses: websites from $300, local SEO and Google Business Profile work, Google and Meta Ads, AI growth agents and lead follow-up. Published prices, no long-term contracts.';
  const body = `  <div class="crumb"><a href="/">Home</a> › Marketing services</div>
  <div class="eyebrow">Chester County · Pennsylvania</div>
  <h1>Marketing services in Chester County, PA</h1>
  <p class="lead">Websites, local SEO, Google and Meta Ads, AI growth agents and lead follow-up — for owner-run businesses from West Chester to Oxford. The prices are on the pages, and the person you call is the person who builds it.</p>

  <div class="box">
    <h3>Start here if you are shopping around</h3>
    <p>Two pages do most of the work: what an agency in this county actually costs and what you get for it, and how to evaluate anyone pitching you — including us. <a href="/services/marketing-agency-chester-county/">The agency page →</a> · <a href="/services/how-to-choose-a-marketing-agency/">The buyer's guide →</a></p>
  </div>

  <h2>The services</h2>
  <div class="grid">
${SERVICES.map((x) => `    <a href="/services/${x.slug}/">${esc(x.h1)}<small>${esc(x.title.split('|')[0].split('—')[0].trim())}</small></a>`).join('\n')}
  </div>

  <h2>What each piece costs</h2>
  <ul>
    <li><b>Local presence audit — $100.</b> The full written read on your Google profile, your site and your competitors, with the fixes in priority order.</li>
    <li><b>Premium one-page website — $300.</b> Fast, mobile-first, states the offer and takes a booking.</li>
    <li><b>AI growth agent setup — $400.</b> Trained on your services and prices, answers in seconds, texts you the lead.</li>
    <li><b>Lead follow-up system — $500.</b> Missed-call text-back, instant reply, review requests, win-back.</li>
    <li><b>Meta Ads setup — from $250. Google Ads setup — from $350.</b> Ad spend paid directly by you to the platform.</li>
    <li><b>Creative proof pack — $150.</b> Real assets to run before you spend on distribution.</li>
    <li><b>Monthly management — quoted after a call.</b> No long-term contract.</li>
  </ul>

  <h2>Where AI fits</h2>
  <p>Every service here is run with AI doing the repetitive, time-sensitive parts — replying, qualifying, following up, drafting — because that is what closes the gap between a small business and a competitor with staff. The full explanation, town by town, lives in the <a href="/ai-marketing/">AI marketing guide</a>.</p>

${faqBlock([
    ['What marketing services does TB Solutions offer in Chester County?',
     'Website design and build, local SEO and Google Business Profile optimization, Google Ads and Meta Ads setup and management, AI growth agents for websites, lead follow-up automation including missed-call text-back and review requests, CRM setup, and monthly management. Serving West Chester, Exton, Malvern, Downingtown, Kennett Square, Phoenixville, Coatesville, Paoli, Chadds Ford, Oxford and the Main Line.'],
    ['How much do marketing services cost in Chester County?',
     'TB Solutions publishes fixed prices: $100 audit, $300 one-page website, $400 AI agent setup, $500 lead follow-up system, Meta Ads setup from $250, Google Ads setup from $350, $150 creative proof pack. Monthly management is quoted after a free call, with no long-term contract. Traditional agency retainers in this area commonly run $1,500 to $5,000 a month plus ad spend.'],
    ['Do I have to buy everything at once?',
     'No, and you should not. Start with follow-up and your Google profile, because they recover revenue from traffic you already have. Ads come last, once there is somewhere worth sending them.'],
    ['Is there a contract?',
     'No long-term contract. Starter packages are half up front and half on delivery; monthly work is billed monthly and cancellable.'],
  ])}

${ctaBlock('Bring your website, your Google listing and the number you wish were higher.')}`;

  const schema = [
    crumbs([['Home', '/'], ['Marketing services', url]]),
    faqSchema([
      ['What marketing services does TB Solutions offer in Chester County?',
       'Website design and build, local SEO and Google Business Profile optimization, Google Ads and Meta Ads setup and management, AI growth agents, lead follow-up automation, CRM setup and monthly management, across Chester County and the Main Line, PA.'],
      ['How much do marketing services cost in Chester County?',
       'Published fixed prices: $100 audit, $300 one-page website, $400 AI agent setup, $500 lead follow-up system, Meta Ads setup from $250, Google Ads setup from $350. Monthly management quoted after a free call, no long-term contract.'],
      ['Do I have to buy everything at once?',
       'No. Start with follow-up and the Google Business Profile, which recover revenue from traffic you already have. Ads come last.'],
      ['Is there a contract?',
       'No long-term contract. Starter packages are half up front and half on delivery.'],
    ]),
    {
      '@context': 'https://schema.org',
      '@type': 'ProfessionalService',
      '@id': SITE.origin + '/#business',
      name: SITE.brand,
      url: SITE.origin + '/',
      telephone: SITE.phone,
      email: SITE.email,
      priceRange: '$100-$500',
      address: { '@type': 'PostalAddress', addressLocality: 'West Chester', addressRegion: 'PA', addressCountry: 'US' },
      areaServed: [{ '@type': 'AdministrativeArea', name: 'Chester County, PA' }, ...TOWNS.map((t) => ({ '@type': 'City', name: t.full }))],
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: 'Marketing services in Chester County, PA',
        itemListElement: SERVICES.map((x) => ({
          '@type': 'Offer',
          itemOffered: { '@type': 'Service', name: x.h1, description: x.desc, url: SITE.origin + '/services/' + x.slug + '/' },
        })),
      },
    },
  ];
  return { url, html: page({ url, title, desc, schema, body }) };
}


function industriesHub() {
  const url = '/marketing-for/';
  const title = 'Marketing by Industry — Chester County, PA | TB Solutions';
  const desc = 'Marketing built for what you actually sell: barbershops and salons, restaurants, contractors and home services, professional services, gyms and studios — across Chester County, PA.';
  const body = `  <div class="crumb"><a href="/">Home</a> › Marketing by industry</div>
  <div class="eyebrow">Chester County · Pennsylvania</div>
  <h1>Marketing built for what you actually sell</h1>
  <p class="lead">A barbershop loses money to empty chairs; a contractor loses it to a full voicemail box; a studio loses it in the two weeks after the trial. Same tools, completely different order of operations.</p>

  <h2>Pick your industry</h2>
  <div class="grid">
${INDUSTRIES.map((x) => `    <a href="/marketing-for/${x.slug}/">${esc(x.h1)}<small>${esc(x.title.split('|')[0].split('—')[0].trim())}</small></a>`).join('\n')}
  </div>

  <h2>What stays the same</h2>
  <p>Underneath every one of these sits the same four-part system — instant response, a finished Google Business Profile, a fast site, and follow-up that never forgets. What changes is which part you build first, and that is decided entirely by where your particular business leaks money. <a href="/ai-marketing/">How the system works →</a> · <a href="/services/">What each piece costs →</a></p>

${faqBlock([
    ['Do you specialise in one industry?',
     'Barbershops and salons are where the deepest product work is — Loop, the booking and rewards platform, was built for them. But the underlying system is the same for any local business that gets enquiries and loses some of them, which is all of them.'],
    ['My industry is not listed. Does that matter?',
     'No. The pages above exist where there is something specific worth writing. If your trade is not there, the free call covers it properly rather than a generic page pretending to.'],
    ['What is the first thing you would look at in my business?',
     'Where enquiries come in and how long they wait. In nearly every local business, that gap is the largest and cheapest thing to fix.'],
  ])}

${ctaBlock('Tell us what you sell and where you sell it.')}`;

  const schema = [
    crumbs([['Home', '/'], ['Marketing by industry', url]]),
    faqSchema([
      ['Do you specialise in one industry?',
       'Barbershops and salons are where the deepest product work is, but the underlying system suits any local business that gets enquiries and loses some of them.'],
      ['My industry is not listed. Does that matter?',
       'No. The pages exist where there is something specific worth writing; the free call covers anything else properly.'],
      ['What is the first thing you would look at in my business?',
       'Where enquiries come in and how long they wait. That gap is usually the largest and cheapest thing to fix.'],
    ]),
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Marketing by industry — Chester County, PA',
      itemListElement: INDUSTRIES.map((x, i) => ({
        '@type': 'ListItem', position: i + 1, name: x.h1, url: SITE.origin + '/marketing-for/' + x.slug + '/',
      })),
    },
  ];
  return { url, html: page({ url, title, desc, schema, body }) };
}

// ---- write pages ----
const pages = [
  pillarPage(),
  ...TOWNS.map((t) => townPage(t, TOWNS)),
  ...GUIDES.map((g) => contentPage(g, { base: '/ai-marketing/', siblings: GUIDES, hubName: 'AI Marketing', hubUrl: '/ai-marketing/' })),
  servicesHub(),
  ...SERVICES.map((g) => contentPage(g, { base: '/services/', siblings: SERVICES, hubName: 'Marketing services', hubUrl: '/services/' })),
  industriesHub(),
  ...INDUSTRIES.map((g) => contentPage(g, { base: '/marketing-for/', siblings: INDUSTRIES, hubName: 'Marketing by industry', hubUrl: '/marketing-for/' })),
];
for (const p of pages) {
  const dir = join(ROOT, p.url);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), p.html);
}

// ---- sitemap: explicit public list + the generated cluster ----
// Only pages meant for search. App screens, owner/admin consoles, client work and
// the arcade stay out — a sitemap full of logged-in tools dilutes what Google crawls.
const PUBLIC = [
  '/', '/suite/', '/learn/', '/learn/why-marketing-matters/', '/learn/marketing-terms/', '/learn/ai-tools/',
  '/guides/', '/guides/google-business-profile-for-barbers/', '/guides/slow-week-playbook/', '/guides/win-back-lapsed-clients/',
  '/content-studio/', '/booking/', '/booking/demo/', '/ambassadors/', '/ambassadors/demo/',
  '/university/', '/university/start/', '/university/toolkit/', '/university/lessons/',
  '/university/lessons/niche/', '/university/lessons/content/', '/university/lessons/pricing/',
  '/university/lessons/outreach/', '/university/lessons/loop-pitch/', '/university/lessons/scale/',
  '/crm/demo/', '/rewards/signup/', '/command/',
];
const priority = (u) => (u === '/' ? '1.0' : u === '/ai-marketing/' || u === '/services/' || u === '/marketing-for/' ? '0.95' : u.startsWith('/services/') || u.startsWith('/marketing-for/') ? '0.85' : u.startsWith('/ai-marketing/') ? '0.85' : u.startsWith('/learn/') || u.startsWith('/guides/') ? '0.7' : '0.6');
const freq = (u) => (u === '/' || u.startsWith('/ai-marketing/') || u.startsWith('/services/') || u.startsWith('/marketing-for/') ? 'weekly' : 'monthly');
const urls = [...new Set([...PUBLIC, ...pages.map((p) => p.url)])]
  .filter((u) => existsSync(join(ROOT, u, 'index.html')))
  .sort((a, b) => (a === '/' ? -1 : b === '/' ? 1 : a.localeCompare(b)));

writeFileSync(join(ROOT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map((u) => `  <url>\n    <loc>${SITE.origin}${u}</loc>\n    <lastmod>${TODAY}</lastmod>\n    <changefreq>${freq(u)}</changefreq>\n    <priority>${priority(u)}</priority>\n  </url>`).join('\n') +
  `\n</urlset>\n`);

// ---- llms.txt: a clean, factual brief for AI assistants ----
writeFileSync(join(ROOT, 'llms.txt'), `# TB Solutions

> TB Solutions is a digital marketing, web design and AI automation studio based in West Chester, Pennsylvania, serving small businesses across Chester County and the Main Line. Founded and run by Nick Byrd.

## Facts
- Location: West Chester, Chester County, Pennsylvania, USA
- Service area: Chester County PA (${TOWNS.map((t) => t.name).join(', ')}), the Main Line, and the western Philadelphia suburbs
- Phone: ${SITE.phoneDisplay}
- Email: ${SITE.email}
- Website: ${SITE.origin}/
- Services: AI growth agents (AI chat concierge for local business websites), local SEO, Google Business Profile optimization, website design and build, Meta Ads, Google Ads, lead follow-up and missed-call text-back automation, CRM setup, review generation
- Typical pricing: Local presence audit $100; premium one-page website $300; AI growth agent setup $400; lead follow-up system $500; Meta Ads setup from $250; Google Ads setup from $350; monthly management quoted after a call. Ad spend paid directly to the platform by the client. No long-term contracts.
- Consultation: free marketing plan call, booked at ${SITE.book}

## Key pages
- [AI marketing in Chester County](${SITE.origin}/ai-marketing/): the main guide to AI marketing for local businesses in Chester County, PA
${GUIDES.map((g) => `- [${g.h1}](${SITE.origin}/ai-marketing/${g.slug}/): ${g.desc}`).join('\n')}

## Services
${SERVICES.map((x) => `- [${x.h1}](${SITE.origin}/services/${x.slug}/): ${x.desc}`).join('\n')}

## By industry
${INDUSTRIES.map((x) => `- [${x.h1}](${SITE.origin}/marketing-for/${x.slug}/): ${x.desc}`).join('\n')}

## Town pages
${TOWNS.map((t) => `- [AI marketing in ${t.full}](${SITE.origin}/ai-marketing/${t.slug}/): AI marketing, local SEO and web design for businesses in ${t.full} (${t.zips.join(', ')})`).join('\n')}

## Learn
- [Marketing guides](${SITE.origin}/learn/): plain-English marketing guides for Chester County business owners
`);

console.log(`✓ ${pages.length} pages`);
pages.forEach((p) => console.log('  ' + p.url));
console.log(`✓ sitemap.xml — ${urls.length} urls`);
console.log('✓ llms.txt');
