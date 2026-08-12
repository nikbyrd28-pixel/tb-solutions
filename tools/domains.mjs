#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Point products at their own domains — one codebase, many hostnames.
//
//   node tools/domains.mjs            apply products.json to the repo
//   node tools/domains.mjs --check    fail if anything is out of date (CI//pre-commit)
//
// Everything this writes is a pure function of products.json, so it is safe to
// run repeatedly and safe to reverse: clear a `domain` field, re-run, and that
// product goes straight back to serving off the apex. That property is the
// whole point — the alternative is hand-editing canonical tags across ~30
// files every time a domain changes, which is how sites end up with two
// versions of every page competing in Google.
//
// WHAT IT TOUCHES
//   vercel.json          a generated "rewrites" block (other keys untouched)
//   <product>/index.html the canonical + og:url tags on owned pages
//   _hosts/<id>/*        a robots.txt and sitemap.xml per domain
//
// WHAT IT DELIBERATELY DOES NOT TOUCH
//   Client pages under /clients/ and /voomlux/. Those brands are not Nick's;
//   pointing their canonicals at tbsol.net would fold their SEO into his.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');
const cfg = JSON.parse(readFileSync(join(ROOT, 'products.json'), 'utf8'));
const APEX = cfg.apex;

let changed = [];
function put(rel, next) {
  const abs = join(ROOT, rel);
  const prev = existsSync(abs) ? readFileSync(abs, 'utf8') : null;
  if (prev === next) return;
  changed.push(rel);
  if (!CHECK) { mkdirSync(dirname(abs), { recursive: true }); writeFileSync(abs, next); }
}

// ── where every public page should say it really lives ──────────────────────
// A page reachable on two hostnames needs to name one of them as the real one.
// Build that map first, then apply it; a page not claimed by a domained
// product stays on the apex.
const home = new Map();      // "/barbers/" -> "https://getloop.app/"
for (const p of cfg.products) {
  // A domain entered WITH a leading www. means www is the primary host in
  // Vercel (the apex 308s to it). Canonicals must name the host that answers
  // 200, so the www form is kept for URLs; the bare form still gets redirect
  // rules below because visitors type it.
  const d = (p.domain || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
  for (const path of p.owns) {
    home.set(path, 'https://' + (d || APEX) + path);
  }
}

// ── canonical + og:url ──────────────────────────────────────────────────────
// Rewritten from the map every run rather than patched in place, so the file
// converges on the right answer no matter what it currently says.
function everyIndexHtml(dir, out = []) {
  for (const name of readdirSync(join(ROOT, dir))) {
    if (name.startsWith('.') || name === 'node_modules' || name === 'tools') continue;
    const rel = dir ? dir + '/' + name : name;
    const s = statSync(join(ROOT, rel));
    if (s.isDirectory()) everyIndexHtml(rel, out);
    else if (name === 'index.html') out.push(rel);
  }
  return out;
}

const SKIP = [/^clients\//, /^voomlux\//];
let retagged = 0;

// A product owns a SECTION, not just one URL. /guides/ in `owns` has to claim
// /guides/slow-week-playbook/ too, or every article canonical falls back to
// the apex and the two hosts compete — the exact failure this file exists to
// stop. Longest prefix wins so a more specific entry can override a broader one.
function ownerOf(path) {
  if (home.has(path)) return home.get(path);
  let best = null, bestLen = -1;
  for (const [owned, url] of home) {
    if (owned.endsWith('/') && path.startsWith(owned) && owned.length > bestLen) {
      best = url.slice(0, url.length - owned.length) + path;   // swap host, keep path
      bestLen = owned.length;
    }
  }
  return best;
}

for (const rel of everyIndexHtml('')) {
  if (SKIP.some(re => re.test(rel))) continue;
  const path = '/' + rel.replace(/index\.html$/, '');
  const want = ownerOf(path) || 'https://' + APEX + path;
  let src = readFileSync(join(ROOT, rel), 'utf8');
  const before = src;

  // Only rewrite tags that already point at a host we manage — never invent
  // one, and never touch a canonical that names somebody else's domain.
  // NO `g` FLAG: a global regex keeps `lastIndex` between .test() calls, so
  // the second call starts mid-string and returns false. That silently
  // updated canonical while leaving og:url on the old host.
  const mine = new RegExp(
    '^https://(?:' + [APEX, ...cfg.products.flatMap(p => {
      const d = (p.domain || '').trim().toLowerCase();
      if (!d) return [];
      const bare = d.replace(/^www\./, '');
      return [bare, 'www.' + bare];
    })].map(h => h.replace(/\./g, '\\.')).join('|') + ')(?:/|$)');

  src = src.replace(/(<link\s+rel="canonical"\s+href=")([^"]*)(")/i,
    (m, a, url, c) => mine.test(url) ? a + want + c : m);
  src = src.replace(/(<meta\s+property="og:url"\s+content=")([^"]*)(")/i,
    (m, a, url, c) => mine.test(url) ? a + want + c : m);

  if (src !== before) { retagged++; put(rel, src); }
}

// ── per-host robots.txt and sitemap.xml ─────────────────────────────────────
// One repo serves one /robots.txt to every hostname, and its Sitemap: line can
// only name one URL. So each live domain gets its own pair and the host
// rewrites below map /robots.txt and /sitemap.xml to the right one.
//
// The APEX pair is hand-curated (lastmod, priority) and is left alone except
// for one surgical edit: when a product moves to its own domain, its URLs are
// dropped from the apex sitemap so the two hosts stop competing. Clearing the
// domain puts them back. Nothing else in the file is reformatted — a
// generator that rewrites a curated artifact wholesale is a downgrade
// dressed up as automation.
const live = cfg.products.filter(p => (p.domain || '').trim());
const noIndex = (cfg._never_public || []).concat(['/clients/']);

function sitemapDoc(urls) {
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + urls.map(u => '  <url><loc>' + u + '</loc><changefreq>weekly</changefreq></url>').join('\n')
    + '\n</urlset>\n';
}

for (const p of live) {
  const d = p.domain.trim().toLowerCase();
  put('_hosts/' + p.id + '/robots.txt',
    'User-agent: *\nAllow: /\n' + noIndex.map(x => 'Disallow: ' + x).join('\n')
    + '\nSitemap: https://' + d + '/sitemap.xml\n');
  // every real page under an owned section, not just the section root — an
  // article nobody links to from the sitemap is an article Google finds late
  const urls = [];
  for (const rel of everyIndexHtml('')) {
    if (SKIP.some(re => re.test(rel))) continue;
    const path = '/' + rel.replace(/index\.html$/, '');
    if ((cfg._sitemap_exclude || []).includes(path)) continue;
    if (/name="robots"\s+content="[^"]*noindex/i.test(readFileSync(join(ROOT, rel), 'utf8'))) continue;
    const owner = ownerOf(path);
    if (owner && owner.startsWith('https://' + d + '/')) urls.push(owner);
  }
  put('_hosts/' + p.id + '/sitemap.xml', sitemapDoc(urls));
}

{
  // moved paths leave the apex sitemap; everything else is preserved verbatim
  const moved = new Set(live.flatMap(p => p.owns));
  const src = readFileSync(join(ROOT, 'sitemap.xml'), 'utf8');
  let out = src.replace(/[ \t]*<url>[\s\S]*?<\/url>\n?/g, block => {
    const loc = /<loc>\s*([^<]+?)\s*<\/loc>/.exec(block);
    if (!loc) return block;
    const path = loc[1].replace(/^https?:\/\/[^/]+/, '') || '/';
    return moved.has(path) ? '' : block;
  });
  // and come back when the domain is cleared
  for (const path of cfg.products.flatMap(p => (p.domain || '').trim() ? [] : p.owns)) {
    const url = 'https://' + APEX + path;
    if (out.includes('<loc>' + url + '</loc>')) continue;
    if ((cfg._sitemap_exclude || []).includes(path)) continue;
    const src2 = join(ROOT, path.slice(1) + 'index.html');
    if (!existsSync(src2)) continue;
    if (/name="robots"\s+content="[^"]*noindex/i.test(readFileSync(src2, 'utf8'))) continue;
    out = out.replace('</urlset>',
      '  <url><loc>' + url + '</loc><changefreq>weekly</changefreq></url>\n</urlset>');
  }
  put('sitemap.xml', out);
}

// ── vercel.json host rewrites ───────────────────────────────────────────────
// Only `/` differs per host. Every deeper path already works on every domain,
// so getloop.app/rewards/?c=demo resolves without a rule.
const vercelRaw = readFileSync(join(ROOT, 'vercel.json'), 'utf8');
const vercel = JSON.parse(vercelRaw);
const rules = [];
for (const p of live) {
  const bare = p.domain.trim().toLowerCase().replace(/^www\./, '');
  const has = v => [{ type: 'host', value: v }];
  // BOTH host forms — the owner may pick www or apex as primary in Vercel.
  // permanent:false everywhere: a 308 here would be cached by browsers forever
  // and survive any later change of heart about the domain map.
  for (const h of [bare, 'www.' + bare]) {
    rules.push({ source: '/',            has: has(h), destination: p.home, permanent: false });
    rules.push({ source: '/robots.txt',  has: has(h), destination: '/_hosts/' + p.id + '/robots.txt', permanent: false });
    rules.push({ source: '/sitemap.xml', has: has(h), destination: '/_hosts/' + p.id + '/sitemap.xml', permanent: false });
    // wall_off: paths that exist in the repo but do not belong on this
    // product's domain bounce to the product home instead of serving.
    // Redirects run before the filesystem, so this beats the real files.
    // Three explicit sources per path: `/x/:rest*` alone does NOT match the
    // bare `/x/` form (the trailing slash goes unconsumed), and that is
    // exactly the form every internal link uses.
    for (const w of (p.wall_off || [])) {
      const base = w.replace(/\/$/, '');
      for (const src of [base, base + '/', base + '/:rest+']) {
        rules.push({ source: src, has: has(h), destination: p.home, permanent: false });
      }
    }
  }
}
// Only touch the file when the rewrites actually differ. Re-serialising it
// otherwise reformats hand-written JSON for no reason and buries the real
// change in whitespace churn on every future diff.
delete vercel.rewrites;   // the failed mechanism; never emit it again
if (JSON.stringify(vercel.redirects || []) !== JSON.stringify(rules)) {
  if (rules.length) vercel.redirects = rules; else delete vercel.redirects;
  put('vercel.json', JSON.stringify(vercel, null, 2) + '\n');
}

// ── report ──────────────────────────────────────────────────────────────────
console.log(live.length
  ? 'domains live: ' + live.map(p => p.id + ' → ' + p.domain).join(', ')
  : 'no domains set — everything serves from ' + APEX);
console.log('canonical tags rewritten: ' + retagged);

if (!changed.length) { console.log('up to date, nothing written'); process.exit(0); }
if (CHECK) {
  console.error('OUT OF DATE — run `node tools/domains.mjs`:\n  ' + changed.join('\n  '));
  process.exit(1);
}
console.log('wrote:\n  ' + changed.join('\n  '));
