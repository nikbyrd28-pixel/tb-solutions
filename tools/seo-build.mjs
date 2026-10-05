// Generates the SEO pages from tools/seo-data.mjs, then rewrites sitemap.xml and llms.txt.
//   node tools/seo-build.mjs
//
// Everything under the GENERATED folders is disposable — edit seo-data.mjs, never the HTML.
// Existing hand-built pages already in sitemap.xml are preserved.
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

// The live brand: yellow paper, ink type, copper accents. Same tokens as index.html.
const CSS = `:root{--yellow:#FFD23F;--ink:#14110F;--paper:#FFF8E1;--copper:#B5542B;--green:#1F9D55;--line:#e6dfc8;--muted:#6b645a;--max:760px;--gutter:clamp(16px,4vw,32px)}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:"Bricolage Grotesque",system-ui,sans-serif;background:var(--paper);color:var(--ink);font-size:17px;line-height:1.6;-webkit-text-size-adjust:100%}
.wrap{max-width:var(--max);margin:0 auto;padding:0 var(--gutter)}
a{color:var(--copper)}
header{background:var(--ink);color:var(--yellow);padding:14px 0}
header .wrap{display:flex;align-items:center;gap:14px}
header a{color:var(--yellow);text-decoration:none;font-weight:800}
header b{background:var(--yellow);color:var(--ink);padding:2px 8px;border-radius:6px}
header .sp{flex:1}
header .tel{border:2px solid var(--yellow);border-radius:999px;padding:4px 12px;font-size:14px}
.crumb{font-size:13px;color:var(--muted);font-weight:600;padding:16px 0 0}
.crumb a{color:var(--muted);text-decoration:none}
.eyebrow{font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--copper);margin-top:18px}
h1{font-size:clamp(30px,6.4vw,44px);line-height:1.04;letter-spacing:-.02em;font-weight:800;margin:8px 0 14px}
h2{font-size:clamp(21px,3.6vw,28px);line-height:1.15;letter-spacing:-.015em;font-weight:800;margin:36px 0 10px}
h3{font-size:18px;font-weight:800;margin:22px 0 6px}
p{margin:0 0 15px;max-width:38em}
.lead{font-size:20px;font-weight:600;margin-bottom:24px}
.price{background:#fff;border:2px solid var(--ink);border-radius:16px;padding:16px 18px;margin:22px 0;box-shadow:4px 4px 0 var(--ink)}
.price b{font-size:24px;display:block;line-height:1.1}
.price small{color:var(--muted);font-weight:600;display:block;margin-top:4px}
.btn{display:inline-block;background:var(--ink);color:var(--yellow);text-decoration:none;font-weight:800;padding:12px 20px;border-radius:999px;border:2px solid var(--ink)}
.btn.ghost{background:transparent;color:var(--ink)}
.row{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0}
.grid{display:grid;gap:10px;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));margin:16px 0}
.grid a{display:block;background:#fff;border:2px solid var(--ink);border-radius:14px;padding:12px 14px;text-decoration:none;color:var(--ink);font-weight:700}
.grid a small{display:block;color:var(--muted);font-weight:600;font-size:13px;margin-top:2px}
.towns{font-size:15px;color:var(--muted);font-weight:600}
.faq{border-top:2px solid var(--line);padding-top:16px;margin-top:10px}
.cta{background:var(--yellow);border:2px solid var(--ink);border-radius:18px;padding:24px;margin:38px 0;box-shadow:5px 5px 0 var(--ink)}
.cta h2{margin:0 0 6px;font-size:24px}
.foot{border-top:2px solid var(--line);margin-top:40px;padding:20px 0 48px;color:var(--muted);font-size:14px}
.foot a{color:var(--muted)}`;

function page({ path, title, desc, h1, eyebrow, lead, blocks, faq, crumbs, schema = [] }) {
  const url = SITE.domain + path;
  urls.push(path);
  const bc = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c[0], item: SITE.domain + c[1] })) };
  const fq = faq.length ? [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }] : [];
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta name="theme-color" content="#FFD23F">
<meta property="og:type" content="website">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${SITE.domain}/og-image.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,400..800&display=swap" rel="stylesheet">
<script defer src="/track.js"></script>
<style>${CSS}</style>
${[bc, ...fq, ...schema].map(s => `<script type="application/ld+json">${J(s)}</script>`).join('\n')}
</head>
<body>
<header><div class="wrap"><a href="/"><b>TB</b> Solutions</a><span class="sp"></span><a class="tel" href="tel:${SITE.cellE164}">${SITE.cell}</a></div></header>
<main class="wrap">
  <p class="crumb">${crumbs.map((c, i) => i === crumbs.length - 1 ? esc(c[0]) : `<a href="${c[1]}">${esc(c[0])}</a>`).join(' › ')}</p>
  ${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ''}
  <h1>${esc(h1)}</h1>
  <p class="lead">${esc(lead)}</p>
  ${blocks}
  ${faq.length ? `<h2>Questions people actually ask</h2>${faq.map(([q, a]) => `<div class="faq"><h3>${esc(q)}</h3><p>${esc(a)}</p></div>`).join('')}` : ''}
  <div class="cta">
    <h2>Hear it before you buy it</h2>
    <p>Call the demo line and you will hear exactly what goes on your phone. No form, no salesman.</p>
    <div class="row"><a class="btn" href="tel:${SITE.phoneDemoE164}">Call ${SITE.phoneDemo}</a><a class="btn ghost" href="sms:${SITE.cellE164}">Text Nick</a></div>
  </div>
  <p class="foot">${SITE.name} · ${SITE.owner} · ${SITE.base} · serving ${SITE.area}<br>
    <a href="/offers/">All offers and prices</a> · <a href="/">Home</a> · Not affiliated with Google or Housecall Pro.</p>
</main>
</body>
</html>`;
  const dir = join(ROOT, path.replace(/^\/|\/$/g, ''));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html);
}

const blocks = arr => arr.map(([h, p]) => `<h2>${esc(h)}</h2><p>${esc(p)}</p>`).join('\n  ');

// ---- /services/<slug>/ ----
for (const s of SERVICES) {
  const path = `/services/${s.slug}/`;
  page({
    path, title: s.title, desc: s.desc, h1: s.h1, eyebrow: s.eyebrow, lead: s.lead,
    crumbs: [['Home', '/'], ['Services', '/services/'], [s.name, path]],
    blocks: `<div class="price"><b>${esc(s.setup)} setup, then ${esc(s.monthly)}/mo</b>
        <small>${esc(s.setup !== s.setupList ? `First five shops — ${s.setupList} after. ` : '')}No contract. ${esc(s.promise)}</small></div>
      ${blocks(s.body)}
      <h2>How it works with me</h2><p>No contracts, month to month, cancel by texting me. Your phone number, your Google account and your data stay yours the whole way through. Setup is one twenty-minute call and, where the phone is involved, one forwarding code you dial yourself. I am in ${esc(SITE.base)} and I only take shops in ${esc(SITE.area)}, so if something breaks you are talking to the person who built it.</p>
      <h2>Where I work</h2><p class="towns">${TOWNS.join(' · ')} — and anywhere inside about 30 minutes of ${esc(SITE.base)}.</p>
      <h2>Other things I run for shops around here</h2>
      <div class="grid">${SERVICES.filter(x => x.slug !== s.slug).map(x => `<a href="/services/${x.slug}/">${esc(x.name)}<small>${esc(x.monthly)}/mo</small></a>`).join('')}</div>`,
    faq: s.faq,
    schema: [{ '@context': 'https://schema.org', '@type': 'Service', name: s.name, serviceType: s.h1, provider: { '@type': 'LocalBusiness', name: SITE.name, telephone: SITE.cell, areaServed: SITE.area }, areaServed: TOWNS.map(t => ({ '@type': 'City', name: `${t}, PA` })) }],
  });
}

// ---- /services/ hub ----
page({
  path: '/services/', title: 'Services for Plumbers, HVAC & Electricians | TB Solutions',
  desc: 'The front office for a trades shop: an AI receptionist that books jobs, Google Local Services Ads run properly, review automation, and a website that converts. Prices published.',
  h1: 'The front office for your shop', eyebrow: 'Services',
  lead: 'Four things, all priced on the page, none of them on a contract.',
  crumbs: [['Home', '/'], ['Services', '/services/']],
  blocks: `<div class="grid">${SERVICES.map(s => `<a href="/services/${s.slug}/">${esc(s.name)}<small>${esc(s.setup)} setup · ${esc(s.monthly)}/mo</small></a>`).join('')}</div>
    <h2>Why they are priced on the page</h2><p>Every agency around here makes you book a call to find out what it costs. I think that is a tell. The numbers are the numbers, they are the same for every shop, and you can cancel by texting me.</p>
    <h2>Who I work with</h2><div class="grid">${TRADES.map(t => `<a href="/for/${t.slug}/">${esc(t.name[0].toUpperCase() + t.name.slice(1))}<small>${esc(t.trade)}</small></a>`).join('')}</div>
    <h2>Start with the phone</h2><p>If you only do one thing, do the receptionist. A shop missing fifteen or twenty calls a month is losing more in a week than the whole thing costs in a month, and it is the only one of these that pays for itself off a single booked job. The ads, the reviews and the website all work better once the phone is actually being answered — there is no point buying leads that ring out.</p>
    <h2>What setup actually involves</h2><p>One twenty-minute call where I get your services, your fees, your hours, your arrival windows and your service area. Then you dial one forwarding code on your business phone so calls you do not pick up roll over. That is the onboarding. Your number stays yours, your Google account stays yours, your data stays yours.</p>
    <h2>Where I work</h2><p class="towns">${TOWNS.join(' · ')} — and anywhere inside about 30 minutes of ${esc(SITE.base)}.</p>`,
  faq: [['Do I have to buy all of it?', 'No. Most shops start with the receptionist because it pays for itself fastest, and add the others when they want to.'],
        ['Is there a contract?', 'No. Month to month on everything. You cancel by texting me.']],
});

// ---- /for/<trade>/ ----
for (const t of TRADES) {
  const path = `/for/${t.slug}/`;
  const Name = t.name[0].toUpperCase() + t.name.slice(1);
  page({
    path, title: `Call Answering for ${Name} | Chester County PA`,
    desc: `For ${t.trade} shops near Pottstown: an AI receptionist that answers when you cannot, books the job into your arrival windows, and texts you. $297 setup, $197/mo.`,
    h1: `Built for ${t.name}`, eyebrow: `For ${t.trade} shops`,
    lead: `You are on a job. The phone rings. ${t.emergency}`,
    crumbs: [['Home', '/'], ['Services', '/services/'], [Name, path]],
    blocks: `<h2>The calls you are missing</h2><p>For a ${t.nameSingular}, the ones that get away are ${t.calls}. They come in while you are already working, and the homeowner does not leave a voicemail — they call the next shop in the results.</p>
      <h2>What picks up instead</h2><p>It answers in your company name, only after your own line rings out. It gets the problem, gives the safety step — ${t.safety} — checks the zip is in your area, states your dispatch fee, and books into the arrival windows you actually run. You get a text with the name, address and the problem in their words.</p>
      <h2>It will not quote your work</h2><p>It states your dispatch fee and nothing else. Pricing a ${t.trade} repair over the phone is how you end up arguing in somebody's basement, so it says the tech prices it on site. Every time.</p>
      <div class="price"><b>$297 setup, then $197/mo</b><small>First five shops — $497 after. No contract. If it does not book you a job in 30 days, the month is refunded.</small></div>
      <h2>Where I work</h2><p class="towns">${TOWNS.join(' · ')} — and anywhere inside about 30 minutes of Pottstown.</p>
      <h2>The rest of the front office</h2><div class="grid">${SERVICES.map(s => `<a href="/services/${s.slug}/">${esc(s.name)}<small>${esc(s.monthly)}/mo</small></a>`).join('')}</div>`,
    faq: [[`Do you only work with ${t.name}?`, `No — ${TRADES.map(x => x.name).join(', ')} are just where most of my shops are. The setup is the same for any trade that runs service calls.`],
          ['Do I keep my number?', 'Yes. You forward to it only when you do not pick up, so nothing changes for anyone who reaches you directly.'],
          ['How long is setup?', 'One 20-minute call and one forwarding code on your phone. Usually live the same week.']],
    schema: [{ '@context': 'https://schema.org', '@type': 'Service', name: `Call answering for ${t.name}`, serviceType: `${t.trade} answering service`, provider: { '@type': 'LocalBusiness', name: SITE.name, telephone: SITE.cell }, areaServed: TOWNS.map(x => ({ '@type': 'City', name: `${x}, PA` })) }],
  });
}

// ---- /guides/<slug>/ ----
for (const g of GUIDES) {
  const path = `/guides/${g.slug}/`;
  page({
    path, title: g.title.length > 46 ? g.title : `${g.title} | TB Solutions`, desc: g.desc, h1: g.h1, eyebrow: 'Guide', lead: g.lead,
    crumbs: [['Home', '/'], ['Guides', '/guides/'], [g.title, path]],
    blocks: blocks(g.body) + `<h2>Keep reading</h2><div class="grid">${GUIDES.filter(x => x.slug !== g.slug).map(x => `<a href="/guides/${x.slug}/">${esc(x.title)}</a>`).join('')}<a href="/services/ai-receptionist-for-contractors/">Never Miss a Call<small>$197/mo</small></a></div>`,
    faq: g.faq,
    schema: [{ '@context': 'https://schema.org', '@type': 'Article', headline: g.title, description: g.desc, author: { '@type': 'Person', name: SITE.owner }, publisher: { '@type': 'Organization', name: SITE.name }, datePublished: TODAY, mainEntityOfPage: SITE.domain + path }],
  });
}

// ---- /guides/ hub ----
page({
  path: '/guides/', title: 'Guides for Contractors | TB Solutions',
  desc: 'Plain-English guides for plumbing, HVAC and electrical shops: what missed calls cost, why weekend calls disappear, and what to do about both.',
  h1: 'Guides', eyebrow: 'Guides', lead: 'Short, specific, and written for somebody who runs a truck.',
  crumbs: [['Home', '/'], ['Guides', '/guides/']],
  blocks: `<div class="grid">${GUIDES.map(g => `<a href="/guides/${g.slug}/">${esc(g.title)}<small>${esc(g.desc.slice(0, 70))}…</small></a>`).join('')}</div>
    <h2>Why these exist</h2><p>Most contractor marketing writing is filler produced by people who have never been in a basement at 9pm. These are short, they use real numbers you can check against your own call log, and none of them end with "contact us to learn more".</p>
    <p>If you only read one, read ${esc(GUIDES[0].title.toLowerCase())}. It is the arithmetic behind everything else on this site: count the calls you missed last month, multiply by what a job is worth to you, and decide whether that number bothers you.</p>
    <h2>What I actually do</h2><p>I run the front office for plumbing, HVAC and electrical shops around ${esc(SITE.base)} — the phone gets answered when you cannot answer it, the job gets booked into the windows you really run, the finished job asks for a review, and your Google leads stop costing more than they should.</p>
    <div class="grid">${SERVICES.map(s => `<a href="/services/${s.slug}/">${esc(s.name)}<small>${esc(s.monthly)}/mo</small></a>`).join('')}</div>
    <h2>Who writes these</h2><p>${esc(SITE.owner)}. I am based in ${esc(SITE.base)} and I only work with shops in ${esc(SITE.area)}, which is why the examples are all towns you have actually driven to.</p>`,
  faq: [['Do you publish on a schedule?', 'No. A guide goes up when there is something worth saying. Filler on a schedule is how sites get buried.'],
        ['Can I use this with my own guys?', 'Yes — send the missed-call one to anyone who thinks the phone is handled.']],
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
<urlset xmlns="http://www.w3.org/1999/sitemap-image/1.1" xmlns:x="http://www.sitemaps.org/schemas/sitemap/0.9">
</urlset>`.replace(/[\s\S]*/, `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${all.map(u => `  <url><loc>${SITE.domain}${u}</loc><lastmod>${TODAY}</lastmod></url>`).join('\n')}
</urlset>
`));

// ---- llms.txt: what an AI answering "who does this near me" should read ----
writeFileSync(join(ROOT, 'llms.txt'), `# ${SITE.name}
> ${SITE.tagline}. ${SITE.owner}, ${SITE.base}. Serving ${SITE.area}.

${SITE.name} runs the front office for plumbing, HVAC and electrical shops: an AI receptionist
that answers when the owner cannot and books the job, Google Local Services Ads management,
Google review automation, and job-booking websites. Prices are published; nothing is on a contract.

## Services
${SERVICES.map(s => `- [${s.name}](${SITE.domain}/services/${s.slug}/): ${s.desc} ${s.setup} setup, ${s.monthly}/month.`).join('\n')}

## Trades served
${TRADES.map(t => `- [${t.name}](${SITE.domain}/for/${t.slug}/): ${t.calls}.`).join('\n')}

## Guides
${GUIDES.map(g => `- [${g.title}](${SITE.domain}/guides/${g.slug}/): ${g.desc}`).join('\n')}

## Contact
Demo line (hear the receptionist): ${SITE.phoneDemo}
Nick: ${SITE.cell} · ${SITE.domain}
`);

console.log(`${urls.length} pages:`);
for (const u of urls) console.log('  ' + u);
console.log(`sitemap.xml: ${all.length} urls (${kept.length} kept, ${urls.length} generated)`);
