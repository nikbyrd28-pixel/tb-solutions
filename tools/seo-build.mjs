// Generates the SEO pages from tools/seo-data.mjs, then rewrites sitemap.xml and llms.txt.
//   node tools/seo-build.mjs
//
// Everything under the GENERATED folders is disposable — edit seo-data.mjs, never the HTML.
// Existing hand-built pages already in sitemap.xml are preserved.
//
// Layout: the same site.css the hand-built pages use (navy header, hero + price tag, prose band,
// lead form from lead.js, shared footer). 2026-10-10: the template was re-based on the site.css
// port of these pages so a rebuild never drops the form or the SMS consent again.
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE, SERVICES, TRADES, TOWNS, GUIDES } from './seo-data.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TODAY = new Date().toISOString().slice(0, 10);
const GENERATED = ['services', 'for', 'guides'];   // folders this script owns
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const J = o => JSON.stringify(o).replace(/</g, '\\u003c');
const urls = [];

const ICON = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%2310263F'/%3E%3Ctext x='50%25' y='56%25' text-anchor='middle' dominant-baseline='middle' font-family='Arial Black,Arial' font-weight='900' font-size='28' fill='%23F5B800'%3ETB%3C/text%3E%3C/svg%3E`;

// The few rules site.css does not carry: breadcrumb, long-form prose, the card list.
const CSS = `/* breadcrumb, long-form prose and card list, unique to the generated pages */
.crumb{font-size:.9rem;color:var(--mute);font-weight:500}
.crumb a{color:var(--mute);text-decoration:none}
.crumb a:hover{color:var(--ink)}
.nav .back{white-space:nowrap}
.prose{max-width:42em}
.prose h2{margin-top:1.6em;font-size:clamp(26px,3vw,36px);margin-bottom:.35em}
.prose h2:first-child{margin-top:0}
.prose p{margin-bottom:1em;max-width:40em}
.prose ul,.prose ol{padding-left:1.2em;margin-bottom:1em}
.prose li{margin:.35em 0}
.towns{color:var(--ink-2);font-weight:500}
.more{list-style:none;display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));margin:1.2em 0}
.more a{display:block;background:var(--white);border:1px solid var(--line-2);border-radius:var(--r-lg);padding:16px 18px;text-decoration:none;color:var(--ink);font-family:var(--display);font-weight:700;font-size:1.25rem;line-height:1.1;box-shadow:var(--shadow);transition:transform .15s}
.more a:hover{transform:translateY(-2px)}
.more a small{display:block;font-family:var(--text);color:var(--mute);font-weight:500;font-size:.9rem;line-height:1.4;margin-top:5px}`;

const label = s => s.label || s.name;
const an = w => (/^[aeiou]/i.test(w) || /^HVAC/.test(w) ? 'an' : 'a') + ' ' + w;
const cap = s => s[0].toUpperCase() + s.slice(1);
// Wrap `mark` (a phrase inside the h1) in <mark>; falls back to the plain h1.
const markup = (h1, mark) => {
  const h = esc(h1);
  const m = mark ? esc(mark) : '';
  return m && h.includes(m) ? h.replace(m, `<mark>${m}</mark>`) : h;
};
const townList = `<span class="towns">${TOWNS.join(', ')}, and anywhere inside about 30 minutes of Pottstown.</span>`;
const WHERE = `<h2>Where and how I work</h2><p>I am in ${esc(SITE.base)} and I only take shops in ${esc(SITE.area)}: ${townList} No contracts, month to month, and you cancel by texting me. Your phone number, your Google account and your data stay yours the whole way through, and if something breaks you are talking to the person who built it.</p>`;
const cards = items => `<ul class="more">${items.map(([href, text, small]) => `<li><a href="${href}">${esc(text)}${small ? `<small>${esc(small)}</small>` : ''}</a></li>`).join('')}</ul>`;
const serviceCards = (except = null) => cards(SERVICES.filter(s => s.slug !== except).map(s => [`/services/${s.slug}/`, label(s), `${s.monthly}/mo`]));

// Body blocks: [heading, paragraph]; a null heading is a bare paragraph under the previous one.
const blocks = arr => arr.map(([h, p]) => (h ? `<h2>${esc(h)}</h2>` : '') + `<p>${esc(p)}</p>`).join('\n    ');

function page({ path, title, desc, h1, mark, eyebrow, lead, back, hero = '', tag = '', prose = '', bands = '', after = '', faq, crumbs, schema = [], lead_form = {} }) {
  const url = SITE.domain + path;
  urls.push(path);
  const bc = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c[0], item: SITE.domain + c[1] })) };
  const fq = faq.length ? [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }] : [];
  const form = { key: 'general', cta: 'Text me what it costs', ask: '', ...lead_form };
  const crumb = `<p class="crumb" style="padding:0;margin-bottom:1.2em">${crumbs.map((c, i) => i === crumbs.length - 1 ? esc(c[0]) : `<a href="${c[1]}">${esc(c[0])}</a>`).join(' › ')}</p>`;
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta name="theme-color" content="#10263F">
<meta property="og:type" content="website">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${SITE.domain}/og-image.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800&family=Barlow:wght@450;500;600;700&display=swap">
<link rel="stylesheet" href="/site.css">
<link rel="icon" href="${ICON}">
<script defer src="/track.js"></script>
<script defer src="/lead.js"></script>
<style>
${CSS}
</style>
${[bc, ...fq, ...schema].map(s => `<script type="application/ld+json">${J(s)}</script>`).join('\n')}
</head>
<body>

<header class="wrap">
  <nav class="nav">
    <span style="display:flex;align-items:center;gap:1.4em">
      <a class="brand" href="/"><b>TB</b> Solutions</a>
      <a class="back" href="${back[1]}">← ${esc(back[0])}</a>
    </span>
    <a class="phone" href="tel:${SITE.cellE164}"><small>Call Nick</small>${SITE.cell}</a>
  </nav>
</header>

<section class="hero">
  <div class="wrap${tag ? ' hero-grid' : ''}">
    <div>
      ${crumb}
      <div class="eyebrow">${esc(eyebrow)}</div>
      <h1>${markup(h1, mark)}</h1>
      <p class="lead">${esc(lead)}</p>
      ${hero}
    </div>
    ${tag}
  </div>
</section>

${bands || `<section class="band">
  <div class="wrap prose">
    ${prose}
  </div>
</section>`}
${after}
<section class="band">
  <div class="wrap">
    <div class="eyebrow">Questions</div>
    <h2>Questions people actually ask</h2>
    <div class="faq">
      ${faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('\n      ')}
    </div>
  </div>
</section>

<section class="on-dark" id="start">
  <div class="wrap two">
    <div>
      <div class="eyebrow">Get started</div>
      <h2>Hear it before you buy it</h2>
      <p>Call the demo line and you will hear exactly what goes on your phone. Or leave your number and I will text you what I would do and what it costs. No salesman.</p>
      <div class="ctas" style="margin-top:1.2em"><a class="btn ghost" href="tel:${SITE.phoneDemoE164}">Call ${SITE.phoneDemo}</a></div>
      <p style="margin-top:1.2em;font-weight:600">Or call Nick: <a href="tel:${SITE.cellE164}">${SITE.cell}</a></p>
    </div>
    <div class="panel">
      <div data-lead="${form.key}" data-cta="${esc(form.cta)}"${form.ask ? ` data-ask="${esc(form.ask)}"` : ''}></div>
    </div>
  </div>
</section>

<footer>
  <div class="wrap">
    <span><span class="brand">${SITE.name}</span> · ${SITE.owner} · ${SITE.base} · Serving Chester &amp; Montgomery County · <a href="tel:${SITE.cellE164}">${SITE.cell}</a></span>
    <span><a href="/websites/">Websites</a> · <a href="/receptionist/">Phones</a> · <a href="/reviews/">Reviews</a> · <a href="/rank/">Google rank</a> · <a href="/offers/">All offers</a> · <a href="/sms-terms/">SMS terms</a> · <a href="/privacy/">Privacy</a> · <a href="/terms/">Terms</a></span>
  </div>
  <div class="wrap" style="margin-top:10px"><span>Serving ${SITE.area} · <a href="/offers/">All offers and prices</a> · <a href="/">Home</a> · Not affiliated with Google or Housecall Pro.</span></div>
</footer>

</body>
</html>
`;
  const dir = join(ROOT, path.replace(/^\/|\/$/g, ''));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html);
}

// The price tag in the hero. Leads with the list price; the founding rate sits in the fine print,
// exactly the way /offers/ shows it.
const priceTag = (s) => {
  const founding = s.setup !== s.setupList && s.setup !== 'no setup fee';
  const big = s.setupList === 'no setup fee' ? `${s.monthly}<small>/mo</small>` : `${s.setupList}<small>setup</small>`;
  const mo = s.setupList === 'no setup fee' ? 'no setup fee' : `then ${s.monthly} / month`;
  const fine = s.setupList === 'no setup fee'
    ? `${s.monthly}/mo, no setup fee. No contract, month to month.`
    : `${s.setupList} setup, then ${s.monthly}/mo.${founding ? ` Founding rate for the first 5 shops: ${s.setup} setup.` : ''} No contract. ${s.promise}`;
  return `<div class="tag">
      <div class="name">${esc(label(s))}</div>
      <div class="big">${big}</div>
      <div class="mo">${mo}</div>
      ${s.bullets ? `<ul>${s.bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
      <p class="fine" style="margin-top:14px">${esc(fine)}</p>
    </div>`;
};
const receptionist = SERVICES[0];
const moreSection = (title, list) => `
<section>
  <div class="wrap">
    <div class="eyebrow">More</div>
    <h2>${esc(title)}</h2>
    ${list}
  </div>
</section>
`;

// ---- /services/<slug>/ ----
for (const s of SERVICES) {
  const path = `/services/${s.slug}/`;
  page({
    path, title: s.title, desc: s.desc, h1: s.h1, mark: s.mark, eyebrow: s.eyebrow, lead: s.lead,
    back: ['All services', '/services/'],
    crumbs: [['Home', '/'], ['Services', '/services/'], [label(s), path]],
    hero: `<div class="ctas">
        <a class="btn primary" href="#start">${esc(s.cta)}</a>
        <a class="btn ghost" href="tel:${SITE.phoneDemoE164}">Call the demo line</a>
      </div>`,
    tag: priceTag(s),
    prose: blocks(s.body) + '\n    ' + WHERE,
    after: moreSection('Other things I run for shops around here', serviceCards(s.slug)),
    faq: s.faq,
    lead_form: { key: s.leadKey, cta: s.cta },
    schema: [{ '@context': 'https://schema.org', '@type': 'Service', name: label(s), serviceType: s.h1, provider: { '@type': 'LocalBusiness', name: SITE.name, telephone: SITE.cell, areaServed: SITE.area }, areaServed: TOWNS.map(t => ({ '@type': 'City', name: `${t}, PA` })) }],
  });
}

// ---- /services/ hub ----
const sheetPrice = s => s.setupList === 'no setup fee'
  ? `<span class="n">${s.monthly}<small style="font-size:.5em;font-weight:600;color:var(--mute)">/mo</small></span><span class="m">no setup fee</span>`
  : `<span class="n">${s.setupList}<small style="font-size:.5em;font-weight:600;color:var(--mute)">setup</small></span><span class="m">${s.monthly}/mo${s.setup !== s.setupList ? ` · Founding rate for the first 5 shops: ${s.setup} setup.` : ''}</span>`;
const HUB_FIX = {
  'ai-receptionist-for-contractors': 'AI receptionist that answers when your line rings out and books the job.',
  'google-local-services-ads-management': 'Google Local Services Ads run properly: budget capped, junk calls disputed.',
  'google-review-automation': 'Every finished job asks for a Google review. Unhappy customers come to you first.',
  'websites-for-contractors': 'One fast page built to turn a homeowner on a phone into a booked call.',
};
const TRADE_LINE = {
  'plumbers': 'a burst pipe or leaking water heater that rings out is a job the next shop in the results gets, and it does not leave a voicemail first.',
  'hvac-companies': 'no-heat and no-cooling calls come in while you are already on a roof, and the homeowner is calling down the list until somebody picks up.',
  'electricians': 'half your calls are a panel, EV charger or service upgrade that wants an estimate visit, and those get booked instead of quoted over the phone.',
};
page({
  path: '/services/', title: 'Services for Plumbers, HVAC & Electricians | TB Solutions',
  desc: 'The works for a trades shop: an AI receptionist that books jobs, Google Local Services Ads run properly, a review ask after every job, and a website that books jobs. Prices published.',
  h1: 'The works for your shop', mark: 'works', eyebrow: 'Services',
  lead: 'Four things, all priced on the page, none of them on a contract.',
  back: ['Home', '/'],
  crumbs: [['Home', '/'], ['Services', '/services/']],
  hero: `<div class="ctas"><a class="btn primary" href="#start">Text me what it costs</a><a class="btn ghost" href="tel:${SITE.phoneDemoE164}">Call the demo line</a></div>`,
  bands: `<section class="band">
  <div class="wrap">
    <div class="eyebrow">The four</div>
    <h2>Pick one, or take the set.</h2>
    <div class="sheet">
      ${SERVICES.map(s => `<a class="row" href="/services/${s.slug}/"><span class="pain">${esc(label(s))}</span><span class="fix">${esc(HUB_FIX[s.slug] || s.lead)}</span><span class="price">${sheetPrice(s)}<span class="go">Details →</span></span></a>`).join('\n      ')}
    </div>
  </div>
</section>

<section>
  <div class="wrap prose">
    <h2>Why they are priced on the page</h2><p>Every agency around here makes you book a call to find out what it costs. I think that is a tell. The numbers are the numbers, they are the same for every shop, and you can cancel by texting me.</p>
    <h2>Who I work with</h2>
    ${TRADES.map(t => `<p><a href="/for/${t.slug}/">${esc(cap(t.name))}</a>: ${esc(TRADE_LINE[t.slug] || `${t.calls}, and the homeowner is calling the next shop in the results.`)}</p>`).join('\n    ')}
    <h2>Start with the phone</h2><p>If you only do one thing, do the receptionist. A shop missing fifteen or twenty calls a month is losing more in a week than the whole thing costs in a month, and it is the only one of these that pays for itself off a single booked job. The ads, the reviews and the website all work better once the phone is actually being answered. There is no point paying Google for calls that ring out.</p>
    <h2>What setup actually involves</h2><p>One twenty-minute call where I get your services, your fees, your hours, your arrival windows and your service area. Then you dial one forwarding code on your business phone so calls you do not pick up roll over. That is the onboarding. Your number stays yours, your Google account stays yours, your data stays yours.</p>
    <h2>Where I work</h2><p class="towns">${TOWNS.join(' · ')}, and anywhere inside about 30 minutes of ${esc(SITE.base)}.</p>
  </div>
</section>`,
  faq: [['Do I have to buy all of it?', 'No. Most shops start with the receptionist because it pays for itself fastest, and add the others when they want to.'],
        ['Is there a contract?', 'No. Month to month on everything. You cancel by texting me.']],
});

// ---- /for/<trade>/ ----
for (const t of TRADES) {
  const path = `/for/${t.slug}/`;
  const Name = cap(t.name);
  // A trade with its own title/h1/desc/body/faq in seo-data.mjs is written for a specific
  // search phrase; the rest fall back to the shared template.
  page({
    path, title: t.title || `Call Answering for ${Name} | Chester County PA`,
    desc: t.desc || `For ${t.trade} shops near Pottstown: an AI receptionist that answers when you cannot, books the job into your arrival windows, and texts you. $497 setup, $197/mo.`,
    h1: t.h1 || `Built for ${t.name}`, mark: t.mark || t.name, eyebrow: `For ${t.trade} shops`,
    lead: `You are on a job. The phone rings. ${t.emergency}`,
    back: ['Home', '/'],
    crumbs: [['Home', '/'], ['Services', '/services/'], [Name, path]],
    hero: `<div class="ctas">
        <a class="btn primary" href="#start">Set up the works</a>
        <a class="btn ghost" href="tel:${SITE.phoneDemoE164}">Call the demo line</a>
      </div>`,
    tag: `<div class="tag">
      <div class="name">${esc(receptionist.name)}</div>
      <div class="big">${receptionist.setupList}<small>setup</small></div>
      <div class="mo">then ${receptionist.monthly}/mo</div>
      <p class="fine" style="margin-top:14px">Founding rate for the first 5 shops: ${receptionist.setup} setup. No contract. ${esc(receptionist.promise)}</p>
    </div>`,
    prose: `<h2>The calls you are missing</h2><p>For ${an(t.nameSingular)}, the ones that get away are ${esc(t.calls)}. They come in while you are already working, and the homeowner does not leave a voicemail. They call the next shop in the results.</p>
    <p>It answers in your company name, only after your own line rings out. It gets the problem, gives the safety step (${esc(t.safety)}), checks the zip is in your area, states your dispatch fee, and books into the arrival windows you actually run. You get a text with the name, address and the problem in their words. If you run Housecall Pro, the job is already on your schedule with the dispatch fee filled in. Jobber is next.</p>
    ${t.body ? blocks(t.body) : ''}
    <p>It states your dispatch fee and nothing else. Pricing ${an(t.trade)} repair over the phone is how you end up arguing in somebody's basement, so it says the tech prices it on site. Every time.</p>
    ${WHERE}`,
    after: moreSection('The rest of the works', serviceCards()),
    faq: [[`Do you only work with ${t.name}?`, `No. ${cap(TRADES.map(x => x.name).slice(0, -1).join(', '))} and ${TRADES[TRADES.length - 1].name} are just where most of my shops are. The setup is the same for any trade that runs service calls.`],
          ['Do I keep my number?', 'Yes. You forward to it only when you do not pick up, so nothing changes for anyone who reaches you directly.'],
          ['How long is setup?', 'One 20-minute call and one forwarding code on your phone. Usually live the same week.'],
          ...(t.faq || [])],
    lead_form: { key: 'general', cta: 'Text me what it costs', ask: "What's costing you jobs right now?" },
    schema: [{ '@context': 'https://schema.org', '@type': 'Service', name: `Call answering for ${t.name}`, serviceType: `${t.trade} answering service`, provider: { '@type': 'LocalBusiness', name: SITE.name, telephone: SITE.cell }, areaServed: TOWNS.map(x => ({ '@type': 'City', name: `${x}, PA` })) }],
  });
}

// ---- /guides/<slug>/ ----
for (const g of GUIDES) {
  const path = `/guides/${g.slug}/`;
  page({
    path, title: g.title.length > 46 ? g.title : `${g.title} | TB Solutions`, desc: g.desc, h1: g.h1, mark: g.mark, eyebrow: 'Guide', lead: g.lead,
    back: ['All guides', '/guides/'],
    crumbs: [['Home', '/'], ['Guides', '/guides/'], [g.title, path]],
    prose: blocks(g.body) + `\n    <h2>Keep reading</h2>` + cards([...GUIDES.filter(x => x.slug !== g.slug).map(x => [`/guides/${x.slug}/`, x.title]), ['/receptionist/', receptionist.name, `${receptionist.monthly}/mo`]]),
    faq: g.faq,
    schema: [{ '@context': 'https://schema.org', '@type': 'Article', headline: g.title, description: g.desc, author: { '@type': 'Person', name: SITE.owner }, publisher: { '@type': 'Organization', name: SITE.name }, datePublished: g.published || TODAY, mainEntityOfPage: SITE.domain + path }],
  });
}

// ---- /guides/ hub ----
page({
  path: '/guides/', title: 'Guides for Contractors | TB Solutions',
  desc: 'Plain-English guides for plumbing, HVAC and electrical shops: what missed calls cost, why weekend calls disappear, and what to do about both.',
  h1: 'Guides', mark: 'Guides', eyebrow: 'Guides', lead: 'Short, specific, and written for somebody who runs a truck.',
  back: ['Home', '/'],
  crumbs: [['Home', '/'], ['Guides', '/guides/']],
  hero: `<ul class="more guides">${GUIDES.map(g => `<li><a href="/guides/${g.slug}/">${esc(g.title)}<small>${esc(g.blurb || g.desc)}</small></a></li>`).join('')}</ul>`,
  prose: `<h2>Why these exist</h2><p>Most contractor marketing writing is filler produced by people who have never been in a basement at 9pm. These are short, they use real numbers you can check against your own call log, and none of them end with "contact us to learn more".</p>
    <p>If you only read one, read ${esc(GUIDES[0].title.toLowerCase())}. It is the arithmetic behind everything else on this site: count the calls you missed last month, multiply by what a job is worth to you, and decide whether that number bothers you.</p>
    <h2>What I actually do</h2><p>I run the works for plumbing, HVAC and electrical shops around ${esc(SITE.base)}: the phone gets answered when you cannot answer it, the job gets booked into the windows you really run, the finished job asks for a review, and the calls you pay Google for stop costing more than they should.</p>
    ${serviceCards()}
    <h2>Who writes these</h2><p>${esc(SITE.owner)}. I am based in ${esc(SITE.base)} and I only work with shops in ${esc(SITE.area)}, which is why the examples are all towns you have actually driven to.</p>`,
  faq: [['Do you publish on a schedule?', 'No. A guide goes up when there is something worth saying. Filler on a schedule is how sites get buried.'],
        ['Can I use this with my own guys?', 'Yes. Send the missed-call one to anyone who thinks the phone is handled.']],
});

// ---- sitemap.xml: keep every hand-built URL, replace the generated ones ----
const smPath = join(ROOT, 'sitemap.xml');
let kept = [];
if (existsSync(smPath)) {
  kept = [...readFileSync(smPath, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map(m => m[1].replace(SITE.domain, ''))
    .filter(u => !GENERATED.some(f => u.startsWith(`/${f}/`) || u === `/${f}/`));
}
const all = [...new Set([...kept, ...urls])].sort();
writeFileSync(smPath, `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${all.map(u => `  <url><loc>${SITE.domain}${u}</loc><lastmod>${TODAY}</lastmod></url>`).join('\n')}
</urlset>
`);

// ---- llms.txt: what an AI answering "who does this near me" should read ----
writeFileSync(join(ROOT, 'llms.txt'), `# ${SITE.name}
> ${SITE.tagline}. ${SITE.owner}, ${SITE.base}. Serving ${SITE.area}.

${SITE.name} runs the front office for plumbing, HVAC and electrical shops: an AI receptionist
that answers when the owner cannot and books the job, Google Local Services Ads management,
Google review automation, and job-booking websites. Prices are published; nothing is on a contract.

## Services
${SERVICES.map(s => `- [${label(s)}](${SITE.domain}/services/${s.slug}/): ${s.desc} ${s.setupList} setup (${s.setup} for the first five shops), ${s.monthly}/month.`).join('\n')}

## Trades served
${TRADES.map(t => `- [${t.name}](${SITE.domain}/for/${t.slug}/): ${t.calls}.`).join('\n')}

## Guides
${GUIDES.map(g => `- [${g.title}](${SITE.domain}/guides/${g.slug}/): ${g.desc}`).join('\n')}

## Contact
Demo line (hear the receptionist): ${SITE.phoneDemo}
Nick: ${SITE.cell} · ${SITE.domain}
`);

// ---- hq/agents/seo.json: what HQ shows on the SEO agent card ----
// Written on every build, committed by the daily routine, read by the Agents tab.
// No database, no secrets — the file IS the status.
mkdirSync(join(ROOT, 'hq', 'agents'), { recursive: true });
writeFileSync(join(ROOT, 'hq', 'agents', 'seo.json'), JSON.stringify({
  agent: 'seo',
  name: 'SEO build',
  lastBuild: new Date().toISOString(),
  pages: urls.length,
  sitemapUrls: all.length,
  clusters: {
    services: urls.filter(u => u.startsWith('/services/')).length,
    trades: urls.filter(u => u.startsWith('/for/')).length,
    guides: urls.filter(u => u.startsWith('/guides/')).length,
  },
  counts: { services: SERVICES.length, trades: TRADES.length, towns: TOWNS.length, guides: GUIDES.length },
  urls,
}, null, 2) + '\n');

console.log(`${urls.length} pages:`);
for (const u of urls) console.log('  ' + u);
console.log(`sitemap.xml: ${all.length} urls (${kept.length} kept, ${urls.length} generated)`);
