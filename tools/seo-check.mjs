// Quality gate for the generated pages. Run after every build:
//   node tools/seo-build.mjs && node tools/seo-check.mjs
// Fails loudly rather than letting a thin or broken page reach Google.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const sm = readFileSync(join(ROOT, 'sitemap.xml'), 'utf8');
const paths = [...sm.matchAll(/<loc>https:\/\/tbsol\.net([^<]*)<\/loc>/g)].map(m => m[1]);
const GENERATED = ['/services/', '/for/', '/guides/'];   // folders seo-build.mjs owns
const isGen = p => GENERATED.some(g => p.startsWith(g));
const dec = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const fails = [], warns = [], legacy = [];
const titles = new Map(), descs = new Map();
let checked = 0;

for (const p of paths) {
  const f = join(ROOT, p.replace(/^\/|\/$/g, ''), 'index.html');
  if (!existsSync(f)) { warns.push(`${p} — in sitemap but no file on disk`); continue; }
  const h = readFileSync(f, 'utf8');
  checked++;

  const title = (h.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
  const desc = (h.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
  const canon = (h.match(/<link rel="canonical" href="([^"]*)"/) || [])[1] || '';
  const h1s = [...h.matchAll(/<h1[^>]*>/g)].length;

  const bucket = isGen(p) ? fails : legacy;   // the hand-built site is advisory, not a build gate
  if (!title) bucket.push(`${p} — no <title>`);
  else if (dec(title).length > 62) bucket.push(`${p} — title ${dec(title).length} chars (max 62): "${dec(title)}"`);
  if (!desc) bucket.push(`${p} — no meta description`);
  else if (desc.length > 165) warns.push(`${p} — description ${desc.length} chars, Google will truncate`);
  if (!canon) bucket.push(`${p} — no canonical`);
  else if (canon !== 'https://tbsol.net' + p) bucket.push(`${p} — canonical points at ${canon}`);
  if (h1s !== 1) bucket.push(`${p} — ${h1s} <h1> tags (need exactly 1)`);

  if (titles.has(title)) bucket.push(`${p} — duplicate title, same as ${titles.get(title)}`); else titles.set(title, p);
  if (descs.has(desc)) bucket.push(`${p} — duplicate description, same as ${descs.get(desc)}`); else descs.set(desc, p);

  for (const m of h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(m[1]); } catch (e) { bucket.push(`${p} — JSON-LD does not parse: ${e.message}`); }
  }

  // Thin-content guard: strip tags, count real words.
  const words = h.replace(/<(script|style)[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/g, ' ').split(/\s+/).filter(w => w.length > 1).length;
  if (words < 300) bucket.push(`${p} — only ${words} words. Thin pages drag the whole site down.`);
  else if (words < 450) warns.push(`${p} — ${words} words, on the light side`);

  // Every page should link somewhere else on the site.
  const internal = [...h.matchAll(/href="(\/[^"#]*)"/g)].map(m => m[1]).filter(u => u !== p);
  if (new Set(internal).size < 3) warns.push(`${p} — only ${new Set(internal).size} internal links`);
}

console.log(`checked ${checked} pages, ${paths.length} sitemap urls`);
for (const w of warns) console.log('  warn  ' + w);
for (const f of fails) console.log('  FAIL  ' + f);
if (legacy.length) {
  console.log(`\n--- hand-built pages (not generated here, fix when you touch them) ---`);
  for (const l of legacy) console.log('  note  ' + l);
}
console.log(fails.length ? `\n${fails.length} failure(s) in generated pages` : `\ngenerated pages all clean${warns.length ? ` (${warns.length} warning(s))` : ''}`);
process.exit(fails.length ? 1 : 0);
