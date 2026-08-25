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
  <p class="foot">© ${new Date().getFullYear()} ${esc(SITE.brand)} · <a href="/">Home</a> · <a href="/services/">Services</a> · <a href="/pricing/">Pricing</a> · <a href="/work/">Work</a> · <a href="/about/">About</a> · <a href="/contact/">Contact</a><br>AI marketing, web design &amp; local SEO for Chester County, PA · <a href="tel:${SITE.phone}">${SITE.phoneDisplay}</a></p>
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
      <a class="btn ghost" href="/free-marketing-plan/">What happens on the call</a>
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
  <p>TB Solutions is a Chester County studio run by Nick Byrd out of West Chester. You talk to the person building the thing — no account manager, no ticket queue, no two-week turnaround on a one-line change. That is why the pricing looks nothing like an agency retainer and why changes happen the same day. <a href="/about/">More about the studio →</a> · <a href="/work/">See the work →</a> · <a href="/ai-marketing/ai-marketing-vs-agency/">How this compares to hiring an agency →</a></p>

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


// ---- core site pages ----
// The homepage is one long page with anchors. These give the real sections their
// own URL, so they can rank, and so the Google profile and directory listings
// have something specific to point at instead of the homepage every time.

function aboutPage() {
  const url = '/about/';
  const title = 'About TB Solutions — West Chester, PA';
  const desc = 'TB Solutions is a one-person digital marketing and web design studio in West Chester, PA, founded by Nick Byrd. Published prices, no account managers, no long-term contracts.';
  const body = `  <div class="crumb"><a href="/">Home</a> › About</div>
  <div class="eyebrow">West Chester, Pennsylvania</div>
  <h1>You talk to the person who builds it</h1>
  <p class="lead">TB Solutions is a digital marketing and web design studio in West Chester, run by Nick Byrd. One person, published prices, and no layer of account management between you and the work.</p>

  <h2>Why it is built this way</h2>
  <p>A typical agency assigns a small local business an account manager, a strategist and a media buyer, then charges a retainer that has to cover all three whether or not your account needs them. A one-line change to your homepage becomes a ticket, a queue, and two weeks. Meanwhile the junior on your account knows less about your trade than you do.</p>
  <p>Removing that layer is most of why the prices on this site look nothing like a retainer, and all of why a change happens the same day. The trade-off is real and worth stating plainly: this is not the right shop for a national brand campaign across six markets. It is the right shop for an owner-run business in Chester County that is losing customers it already earned.</p>

  <h2>What gets built</h2>
  <p>Websites that load fast and state the offer. AI growth agents that answer your customers in seconds at any hour. Local SEO and Google Business Profile work aimed at the map pack. Google and Meta Ads set up tightly and reported on honestly. And lead follow-up — missed-call text-back, instant replies, review requests, win-back — which is usually the piece that pays for the rest. <a href="/services/">Everything, with the prices on it →</a></p>

  <div class="box">
    <h3>Loop</h3>
    <p>Alongside the studio work, TB Solutions builds <b>Loop</b> — a booking, rewards and website platform for barbershops. It exists because the same four problems kept coming up in every shop: empty chairs, clients who quietly stopped coming, no easy way to rebook, and no website worth the name. <a href="/marketing-for/barbershop-marketing-chester-county/">How that thinking applies to any shop →</a></p>
  </div>

  <h2>How working together actually goes</h2>
  <ul>
    <li><b>The free call.</b> Bring your website, your Google listing and the number you wish were higher. You leave with the single highest-impact fix written down, whether or not you hire anyone.</li>
    <li><b>The quote.</b> A price, in writing, from the published list. Half up front, half on delivery for starter packages.</li>
    <li><b>The build.</b> Most one-page sites get a first draft within a few days of the deposit and your details. Revisions are fast because you are talking to the builder.</li>
    <li><b>After.</b> Monthly work is billed monthly and cancellable. You own your site, your domain, your ad account and your customer data — if you leave, you take all of it.</li>
  </ul>

  <h2>Where</h2>
  <p>West Chester, and across Chester County and the Main Line: ${TOWNS.slice(0, 12).map((t) => esc(t.name)).join(', ')} and the surrounding townships. Local work gets local knowledge — which searches actually happen in your town, and which of your competitors have left their listings half-built. <a href="/ai-marketing/">Town by town →</a></p>

${faqBlock([
    ['Who is TB Solutions?',
     'A digital marketing and web design studio in West Chester, Pennsylvania, founded and run by Nick Byrd. It builds websites, AI growth agents, local SEO and lead follow-up systems for small businesses across Chester County and the Main Line, and develops Loop, a booking and rewards platform for barbershops.'],
    ['Is this a one-person business?',
     'Yes, and that is the point rather than a limitation to work around. It is why prices are published, why changes happen the same day, and why the honest answer to a job that needs a full agency team is to say so.'],
    ['Do you work with businesses outside Chester County?',
     'Yes. Chester County and the Main Line are home and get local knowledge, but the websites, agents, follow-up systems and ads are not geographically limited.'],
    ['What if I need something you do not do?',
     'You will be told on the call. Sending someone to a better-suited shop costs a project and keeps a reputation, which is a trade worth making every time.'],
  ])}

${ctaBlock('Bring your website, your Google listing and your worst month.')}`;

  const schema = [
    crumbs([['Home', '/'], ['About', url]]),
    faqSchema([
      ['Who is TB Solutions?',
       'A digital marketing and web design studio in West Chester, Pennsylvania, founded and run by Nick Byrd, serving small businesses across Chester County and the Main Line.'],
      ['Is this a one-person business?',
       'Yes. It is why prices are published, why changes happen the same day, and why the honest answer to a job needing a full agency team is to say so.'],
      ['Do you work with businesses outside Chester County?',
       'Yes. Chester County and the Main Line are home, but the work is not geographically limited.'],
      ['What if I need something you do not do?',
       'You will be told on the call and pointed to a better-suited shop.'],
    ]),
    {
      '@context': 'https://schema.org',
      '@type': 'AboutPage',
      '@id': SITE.origin + url + '#page',
      url: SITE.origin + url,
      name: title,
      description: desc,
      mainEntity: {
        '@type': 'ProfessionalService',
        '@id': SITE.origin + '/#business',
        name: SITE.brand,
        url: SITE.origin + '/',
        telephone: SITE.phone,
        email: SITE.email,
        founder: { '@type': 'Person', name: 'Nick Byrd', jobTitle: 'Founder', worksFor: { '@id': SITE.origin + '/#business' } },
        address: { '@type': 'PostalAddress', addressLocality: 'West Chester', addressRegion: 'PA', addressCountry: 'US' },
        areaServed: [{ '@type': 'AdministrativeArea', name: 'Chester County, PA' }, ...TOWNS.map((t) => ({ '@type': 'City', name: t.full }))],
      },
    },
  ];
  return { url, html: page({ url, title, desc, schema, body }) };
}

function contactPage() {
  const url = '/contact/';
  const title = 'Contact TB Solutions — West Chester, PA';
  const desc = 'Contact TB Solutions in West Chester, PA: call (484) 841-8501, email, or book a free marketing plan call. Serving Chester County and the Main Line.';
  const body = `  <div class="crumb"><a href="/">Home</a> › Contact</div>
  <div class="eyebrow">West Chester, PA · Chester County</div>
  <h1>Get in touch</h1>
  <p class="lead">Three ways, all of them reaching the same person. The fastest answer is the phone; the most useful one is the free call, because you leave it with something written down.</p>

  <div class="box">
    <h3>Call or text</h3>
    <p><a href="tel:${SITE.phone}" style="font-size:22px;font-weight:700">${SITE.phoneDisplay}</a><br>
    If it goes to voicemail, you will get a text back — the same system we install for clients.</p>
  </div>
  <div class="box">
    <h3>Email</h3>
    <p><a href="mailto:${SITE.email}">${SITE.email}</a><br>
    Send your website and your Google listing and you will get a specific answer, not a brochure.</p>
  </div>
  <div class="box">
    <h3>Book the free marketing plan call</h3>
    <p>Thirty minutes. Bring your website, your Google listing and the number you wish were higher. You leave with the single highest-impact fix, written down, whether or not you hire us. <a href="/free-marketing-plan/">What happens on the call →</a></p>
    <p><a class="btn" href="${SITE.book}" target="_blank" rel="noopener">Book a time</a></p>
  </div>

  <h2>Where we work</h2>
  <p>Based in West Chester, serving Chester County and the Main Line: ${TOWNS.map((t) => `<a href="/ai-marketing/${t.slug}/">${esc(t.name)}</a>`).join(', ')} and the surrounding townships.</p>

  <h2>Existing clients</h2>
  <p>Client login is at <a href="/portal/">the portal</a>, and support requests go through <a href="/support/">the support page</a> so nothing gets lost in a text thread.</p>

${faqBlock([
    ['What is the fastest way to reach TB Solutions?',
     'Call or text (484) 841-8501. If the call is missed you get an automatic text back within seconds — the same missed-call system installed for clients.'],
    ['What should I have ready before the call?',
     'Your website address, your Google Business Profile, and a rough sense of where enquiries come from now. That is enough to give you a specific answer.'],
    ['Do you charge for the first call?',
     'No. It is free, there is no obligation, and you leave with the highest-impact fix written down regardless of what you decide.'],
  ])}`;

  const schema = [
    crumbs([['Home', '/'], ['Contact', url]]),
    faqSchema([
      ['What is the fastest way to reach TB Solutions?',
       'Call or text (484) 841-8501. A missed call triggers an automatic text back within seconds.'],
      ['What should I have ready before the call?',
       'Your website address, your Google Business Profile, and where enquiries come from now.'],
      ['Do you charge for the first call?', 'No. It is free and there is no obligation.'],
    ]),
    {
      '@context': 'https://schema.org',
      '@type': 'ContactPage',
      '@id': SITE.origin + url + '#page',
      url: SITE.origin + url,
      name: title,
      description: desc,
      mainEntity: {
        '@type': 'ProfessionalService',
        '@id': SITE.origin + '/#business',
        name: SITE.brand,
        telephone: SITE.phone,
        email: SITE.email,
        url: SITE.origin + '/',
        address: { '@type': 'PostalAddress', addressLocality: 'West Chester', addressRegion: 'PA', addressCountry: 'US' },
        contactPoint: {
          '@type': 'ContactPoint', telephone: SITE.phone, email: SITE.email,
          contactType: 'sales', areaServed: 'US-PA', availableLanguage: 'English',
        },
      },
    },
  ];
  return { url, html: page({ url, title, desc, schema, body }) };
}

const PRICE_LIST = [
  ['Local Presence Audit', 100, 'The full written read on your Google Business Profile, your site and your competitors, with every fix in priority order. The cheapest way to find out whether you have a marketing problem or a follow-up problem.'],
  ['Creative Proof Pack', 150, 'Real photo and video assets for your business, so you have something worth running before you spend a dollar on distribution.'],
  ['Meta Ads Starter', 250, 'Facebook and Instagram campaign setup: offer design, local targeting, creative direction. Ad spend paid directly by you to Meta.'],
  ['Premium One-Page Website', 300, 'Fast, mobile-first, states the offer and the price, takes a booking. First draft in days.'],
  ['Google Ads Starter', 350, 'Local search campaign setup: tight structure, a real negative keyword list, a landing page per service. Ad spend paid directly by you to Google.'],
  ['AI Growth Agent Setup', 400, 'A chat concierge trained on your services, prices and hours. Answers in seconds at any hour, qualifies the visitor, books or captures, and texts you the lead.'],
  ['Lead Follow-Up System', 500, 'Missed-call text-back, instant reply to every form, automatic review requests after each job, and win-back sequences for quiet customers.'],
];

function pricingPage() {
  const url = '/pricing/';
  const title = 'Pricing — TB Solutions, Chester County PA';
  const desc = 'Published prices for websites, AI agents, local SEO, ads and lead follow-up in Chester County, PA. Audits $100, websites $300, AI agent $400, follow-up system $500. No long-term contracts.';
  const rows = PRICE_LIST.map(([n, p, d]) =>
    `  <div class="box"><h3>${esc(n)} — $${p}</h3><p>${esc(d)}</p></div>`).join('\n');
  const body = `  <div class="crumb"><a href="/">Home</a> › Pricing</div>
  <div class="eyebrow">Chester County, PA</div>
  <h1>The prices, printed</h1>
  <p class="lead">Nobody in this industry publishes pricing, which is how a $300 job becomes a $3,000 retainer. Here is the whole list. Half up front, half on delivery for anything below. No long-term contract on any of it.</p>

  <h2>À la carte</h2>
${rows}

  <h2>Or bundled, if you would rather not choose</h2>
  <div class="box">
    <h3>Starter Site — $300</h3>
    <p>Get online this week. A sharp one-page site that captures leads instead of sitting there. Custom design, lead capture, set up to show on Google.</p>
  </div>
  <div class="box">
    <h3>Growth System — quoted on the call</h3>
    <p>The website plus the machine behind it: your own CRM, instant AI replies, automatic follow-up, review collection, and monthly upkeep and reporting. Priced to your business on the free call — no lock-in, cancel monthly work any time.</p>
  </div>
  <div class="box">
    <h3>The Whole Machine — custom</h3>
    <p>Growth System plus paid ads and your own rewards club. Customers found, captured and kept. Scaled to what you are comfortable spending, quoted on the call.</p>
  </div>

  <h2>What to buy first, honestly</h2>
  <p>If your budget is under $500, do not buy a website and do not buy ads. Fix your Google Business Profile and turn on automatic review requests and missed-call text-back. That recovers revenue from traffic you already have, which means the first purchase pays for the second. Ads are the last thing to buy, not the first — paying to send more traffic into a leaky system just increases the leak. <a href="/services/affordable-marketing-agency-chester-county/">The full order of operations →</a></p>

  <h2>What is not in the price</h2>
  <p>Ad spend. You pay Google and Meta directly so you can see exactly what was spent and so nobody has an incentive to talk you into a bigger budget. Setup and management are separate, quoted line items — never a percentage of your spend.</p>

${faqBlock([
    ['How much does a website cost in Chester County?',
     'A premium one-page site is $300 here. Local agency quotes for a small-business site in this area commonly land between $2,500 and $8,000. The gap is mostly account management and sales overhead, not build quality.'],
    ['Is there a monthly fee?',
     'Only if you want ongoing work — content, campaign management, reporting, agent tuning. It is quoted after a free call, billed monthly, and cancellable. Nothing on this page requires it.'],
    ['Why are these prices lower than an agency retainer?',
     'No account manager, no media buyer, no office and no sales team between you and the work. That is most of an agency cost structure, and none of it reaches your customers.'],
    ['What do I own if I leave?',
     'Your site, your domain, your ad account and your customer data. All of it, exported, no argument. Ask any agency this question before you sign — the answer tells you what kind of company you are dealing with.'],
    ['Do you offer payment plans?',
     'Starter packages split half up front and half on delivery, which keeps the initial outlay small. Larger builds are staged across milestones.'],
  ])}

${ctaBlock('Bring your website and your Google listing and we will tell you which line on this page you actually need.')}`;

  const schema = [
    crumbs([['Home', '/'], ['Pricing', url]]),
    faqSchema([
      ['How much does a website cost in Chester County?',
       'A premium one-page site is $300. Local agency quotes for a small-business site commonly land between $2,500 and $8,000.'],
      ['Is there a monthly fee?',
       'Only for ongoing work, quoted after a free call, billed monthly and cancellable.'],
      ['Why are these prices lower than an agency retainer?',
       'No account manager, media buyer, office or sales team between you and the work.'],
      ['What do I own if I leave?', 'Your site, domain, ad account and customer data — all of it, exported.'],
      ['Do you offer payment plans?', 'Starter packages split half up front and half on delivery.'],
    ]),
    {
      '@context': 'https://schema.org',
      '@type': 'OfferCatalog',
      '@id': SITE.origin + url + '#catalog',
      name: 'TB Solutions pricing',
      url: SITE.origin + url,
      itemListElement: PRICE_LIST.map(([n, p, d]) => ({
        '@type': 'Offer',
        name: n,
        description: d,
        price: String(p),
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
        seller: { '@id': SITE.origin + '/#business' },
      })),
    },
  ];
  return { url, html: page({ url, title, desc, schema, body }) };
}

const WORK = [
  {
    name: 'Hubs & Babydoll',
    what: 'Handcrafted body care brand',
    href: '/clients/hubsandbabydoll/',
    external: 'https://hubsandbabydoll.com',
    body: 'A polished storefront for a small, home-based brand of body oils, butters, washes and gift boxes. Product sections built to present handmade goods properly, brand storytelling that makes the shop feel personal rather than drop-shipped, and the shipping, refund and FAQ pages that let a first-time buyer actually complete a purchase.',
  },
  {
    name: 'VoomLux Luxury Transport',
    what: 'Black car and luxury transport',
    href: '/clients/voomlux/',
    body: 'A booking-first site for a luxury transport service, plus a separate corporate and partner accounts page for the business travel side. Two audiences with genuinely different questions — someone booking a ride tonight, and an office manager setting up an account — served without either one having to wade through the other.',
  },
  {
    name: 'Loop',
    what: 'Booking, rewards and websites for barbershops',
    href: '/marketing-for/barbershop-marketing-chester-county/',
    external: 'https://www.thebarberloop.com',
    body: 'TB Solutions’ own SaaS product: online booking, a rewards card clients actually open, win-back texts and a shop website in one. Built because the same four problems came up in every barbershop — empty chairs, clients who quietly stopped coming, rebooking friction, and no website worth the name.',
  },
  {
    name: 'This site',
    what: 'tbsol.net',
    href: '/ai-marketing/',
    body: 'Worth judging too. Fast, mobile-first, prices published, structured data on every page, and a town-by-town content cluster built the same way a client’s would be. If a marketing studio’s own site is slow or vague, that tells you what you would be buying.',
  },
];

function workPage() {
  const url = '/work/';
  const title = 'Our Work — Websites Built in Chester County, PA';
  const desc = 'Websites and products built by TB Solutions: Hubs & Babydoll, VoomLux Luxury Transport, and Loop for barbershops. Real builds you can open and judge.';
  const cards = WORK.map((w) => `  <div class="box">
    <h3>${esc(w.name)}</h3>
    <p class="muted" style="margin-bottom:10px">${esc(w.what)}</p>
    <p>${esc(w.body)}</p>
    <p><a href="${w.href}">See the build →</a>${w.external ? ` &nbsp;·&nbsp; <a href="${w.external}" target="_blank" rel="noopener">${esc(w.external.replace('https://', ''))} ↗</a>` : ''}</p>
  </div>`).join('\n');
  const body = `  <div class="crumb"><a href="/">Home</a> › Work</div>
  <div class="eyebrow">Chester County, PA</div>
  <h1>Real work, openable in a new tab</h1>
  <p class="lead">No case studies with invented percentages. These are live builds — open them, load them on a phone, and judge them the way your customers would.</p>

${cards}

  <h2>What you will not find here</h2>
  <p>Client logos we have no relationship with, results we cannot substantiate, or a "347% increase in leads" attached to a business that is never named. Every number in this industry that appears without a business attached to it should be treated as decoration. TB Solutions opened in January 2026; the honest version of a portfolio at this stage is a short list of real builds you can inspect, which is what this is.</p>

  <h2>How the builds are judged</h2>
  <ul>
    <li><b>Speed.</b> If it does not paint in about two seconds on a phone on a weak signal, nothing else matters.</li>
    <li><b>Clarity.</b> What it is, where, and what it costs — visible without scrolling or hunting.</li>
    <li><b>One action.</b> A single obvious next step, repeated, rather than six competing buttons.</li>
    <li><b>Proof.</b> Real photos of real work. Never stock.</li>
  </ul>

${faqBlock([
    ['Can I talk to one of your clients?',
     'Yes. Ask on the call and you will be put in touch with someone whose build is closest to what you need.'],
    ['Why is the portfolio short?',
     'Because TB Solutions opened in January 2026 and the list is honest. A short real portfolio is worth more than a long one padded with logos and unverifiable numbers.'],
    ['Will my site look like these?',
     'It will be built to the same standard, not to the same template. A body care brand, a transport service and a barbershop need three genuinely different pages.'],
  ])}

${ctaBlock('Bring the site you have now and we will tell you what is costing you customers.')}`;

  const schema = [
    crumbs([['Home', '/'], ['Work', url]]),
    faqSchema([
      ['Can I talk to one of your clients?', 'Yes — ask on the call and you will be put in touch with the closest build to what you need.'],
      ['Why is the portfolio short?', 'TB Solutions opened in January 2026 and the list is honest rather than padded.'],
      ['Will my site look like these?', 'Built to the same standard, not the same template.'],
    ]),
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      '@id': SITE.origin + url + '#page',
      url: SITE.origin + url,
      name: title,
      description: desc,
      about: { '@id': SITE.origin + '/#business' },
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: WORK.map((w, i) => ({
          '@type': 'ListItem', position: i + 1, name: w.name, description: w.what,
          url: w.external || SITE.origin + w.href,
        })),
      },
    },
  ];
  return { url, html: page({ url, title, desc, schema, body }) };
}

function planPage() {
  const url = '/free-marketing-plan/';
  const title = 'Free Marketing Plan Call — Chester County, PA';
  const desc = 'Book a free 30-minute marketing plan call for your Chester County business. Bring your website and Google listing; leave with the single highest-impact fix written down. No cost, no pressure.';
  const body = `  <div class="crumb"><a href="/">Home</a> › Free marketing plan</div>
  <div class="eyebrow">Free · 30 minutes · no obligation</div>
  <h1>Leave with the one fix that matters most</h1>
  <p class="lead">Not a discovery call. Not a deck that arrives next week. Thirty minutes, your actual website and your actual Google listing on screen, and the single highest-impact thing to change — written down and sent to you, whether or not you hire anyone.</p>

  <p><a class="btn" href="${SITE.book}" target="_blank" rel="noopener">Book my free marketing plan</a> &nbsp; <a class="btn ghost" href="tel:${SITE.phone}">${SITE.phoneDisplay}</a></p>

  <h2>What happens on the call</h2>
  <ul>
    <li><b>Your listing, opened live.</b> Categories, services, photos, hours, reviews. Most local businesses have half of it blank, and it is the cheapest thing on the list to fix.</li>
    <li><b>Your site, loaded on a phone.</b> How fast it paints, whether the offer is clear, whether anyone can book without calling.</li>
    <li><b>Where your enquiries go.</b> Usually this is where the money is. The missed call at 4:50pm, the form filled in on Sunday, the message that got read and buried.</li>
    <li><b>Two or three competitors, side by side.</b> Who is above you in the map pack, and specifically what they are doing that you are not.</li>
    <li><b>The one fix.</b> Written down and sent after the call.</li>
  </ul>

  <h2>What it costs</h2>
  <p>Nothing, and the catch is the ordinary one: some people take the fix, do it themselves and never pay for anything. That is fine, and it is the point. Being the person who gave a straight answer for free is a cheap way to be the person they call when the next thing comes up.</p>

  <h2>What to bring</h2>
  <p>Your website address, your Google Business Profile, and a rough sense of where enquiries come from now. If you do not have a website, bring your Instagram. If you do not have either, bring what you sell and where.</p>

  <h2>Who it is for</h2>
  <p>Owner-run businesses in ${TOWNS.slice(0, 8).map((t) => esc(t.name)).join(', ')} and across Chester County — trades, salons and barbershops, restaurants, professional services, retail, home services. Somewhere between one and thirty employees, where the owner still knows every customer and every lost lead stings.</p>

${faqBlock([
    ['Is the marketing plan call really free?',
     'Yes. Thirty minutes, no cost, no obligation, and you leave with the highest-impact fix written down whether or not you hire us.'],
    ['Will I be sold to on the call?',
     'You will be told what to fix and what it would cost if you wanted it done for you. If the fix is something you can do yourself in an afternoon, you will be told that too.'],
    ['What if I already have an agency?',
     'Bring them along in spirit. The call will tell you fairly quickly whether what you are paying for is being delivered, and there is no obligation to change anything.'],
    ['How soon can we talk?',
     'Usually within a few days. If it is urgent, call or text (484) 841-8501 directly.'],
  ])}

  <div class="cta">
    <h2>Book the call</h2>
    <p>Thirty minutes. One fix, written down. No cost either way.</p>
    <div class="row">
      <a class="btn" href="${SITE.book}" target="_blank" rel="noopener">Book my free marketing plan</a>
      <a class="btn ghost" href="tel:${SITE.phone}">${SITE.phoneDisplay}</a>
    </div>
  </div>`;

  const schema = [
    crumbs([['Home', '/'], ['Free marketing plan', url]]),
    faqSchema([
      ['Is the marketing plan call really free?',
       'Yes. Thirty minutes, no cost, no obligation, and you leave with the highest-impact fix written down.'],
      ['Will I be sold to on the call?',
       'You will be told what to fix and what it costs if you want it done for you — including when you can do it yourself.'],
      ['What if I already have an agency?',
       'The call tells you whether what you are paying for is being delivered. No obligation to change anything.'],
      ['How soon can we talk?', 'Usually within a few days; call or text (484) 841-8501 if it is urgent.'],
    ]),
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      '@id': SITE.origin + url + '#service',
      name: 'Free Marketing Plan Call',
      serviceType: 'Marketing consultation',
      description: desc,
      provider: { '@id': SITE.origin + '/#business' },
      areaServed: [{ '@type': 'AdministrativeArea', name: 'Chester County, PA' }],
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', url: SITE.book, availability: 'https://schema.org/InStock' },
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
  aboutPage(), contactPage(), pricingPage(), workPage(), planPage(),
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
  '/', '/suite/', '/privacy/', '/terms/', '/learn/', '/learn/why-marketing-matters/', '/learn/marketing-terms/', '/learn/ai-tools/',
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
