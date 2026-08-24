// Builds the static logo system for the Loop SaaS and for TB Solutions.
// Everything is generated from the definitions here, so the mark has exactly one
// source of truth and every size is redrawn rather than resized.
// Run: node tools/brand-build.mjs   (PNGs need playwright + the bundled chromium)
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_LOOP = join(ROOT, 'brand', 'loop');
const OUT_TB = join(ROOT, 'brand', 'tb');
[OUT_LOOP, join(OUT_LOOP, 'modules'), OUT_TB].forEach((d) => mkdirSync(d, { recursive: true }));

// ---------- Loop palette ----------
const POLE_RED = '#e8394a', POLE_WHITE = '#f7f9ff', POLE_BLUE = '#3b6dff';
const INK = '#0a0d18', PAPER = '#f4f6fd';
const FG_DARK = '#f2f4ff', FG_LIGHT = '#0a0d18';
const SUB_DARK = '#8f97b8', SUB_LIGHT = '#5a627d';

// The barber-pole stripe pattern. Angle and pitch are fixed so the mark reads the
// same at 16px and at 1024px.
const stripes = (id, s = 1) =>
  `<pattern id="${id}" width="${27 * s}" height="${27 * s}" patternUnits="userSpaceOnUse" patternTransform="rotate(-38)">` +
  `<rect width="${27 * s}" height="${27 * s}" fill="${POLE_WHITE}"/>` +
  `<rect x="0" width="${9 * s}" height="${27 * s}" fill="${POLE_RED}"/>` +
  `<rect x="${18 * s}" width="${9 * s}" height="${27 * s}" fill="${POLE_BLUE}"/>` +
  `</pattern>`;

// The mark: a barber pole bent into an open ring, with an arrowhead closing it.
// The pole says barbershop; the loop says they come back.
const ARC = 'M95.1 32.9 A44 44 0 1 1 45.4 24.1';
const ARROW = 'M62.4 15.6 L49.6 36.2 L38.6 12.6 Z';
const markBody = (pid) =>
  `<path d="${ARC}" fill="none" stroke="url(#${pid})" stroke-width="20" stroke-linecap="butt"/>` +
  `<path d="${ARC}" fill="none" stroke="#000" opacity=".18" stroke-width="20" stroke-linecap="butt"/>` +
  `<path d="${ARROW}" fill="${POLE_RED}"/>`;
// Single-colour version for embroidery, stamps, one-colour print.
const markMono = (color) =>
  `<path d="${ARC}" fill="none" stroke="${color}" stroke-width="20" stroke-linecap="butt"/>` +
  `<path d="${ARROW}" fill="${color}"/>`;

const svg = (w, h, inner, label) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${label}">${inner}</svg>\n`;

const wordmark = (x, fg, sub, tagline = 'FOR BARBERSHOPS') =>
  `<text x="${x}" y="86" font-family="Poppins,Inter,system-ui,Arial,sans-serif" font-size="62" font-weight="900" fill="${fg}" letter-spacing="-1.5">Loop</text>` +
  (tagline ? `<text x="${x + 3}" y="118" font-family="Inter,system-ui,Arial,sans-serif" font-size="18" font-weight="800" fill="${sub}" letter-spacing="5.2">${tagline}</text>` : '');

const files = {};

// --- core marks (transparent — no baked background, so they drop onto anything) ---
files['brand/loop/mark.svg'] = svg(128, 128, `<defs>${stripes('p')}</defs>${markBody('p')}`, 'Loop');
files['brand/loop/mark-mono-black.svg'] = svg(128, 128, markMono(INK), 'Loop');
files['brand/loop/mark-mono-white.svg'] = svg(128, 128, markMono('#ffffff'), 'Loop');

// --- app icon: the mark in its container, with breathing room at small sizes ---
const iconInner = (bg, pid) =>
  `<defs>${stripes(pid)}</defs><rect width="128" height="128" rx="29" fill="${bg}"/>` +
  `<g transform="translate(64 64) scale(.78) translate(-64 -64)">${markBody(pid)}</g>`;
files['brand/loop/icon.svg'] = svg(128, 128, iconInner(INK, 'pi'), 'Loop app icon');
files['brand/loop/icon-light.svg'] = svg(128, 128, iconInner(PAPER, 'pil'), 'Loop app icon');
// Favicon: same mark, no container, drawn heavier so it survives 16px.
files['brand/loop/favicon.svg'] = svg(128, 128,
  `<defs>${stripes('pf')}</defs><rect width="128" height="128" rx="24" fill="${INK}"/>` +
  `<g transform="translate(64 64) scale(.86) translate(-64 -64)">${markBody('pf')}</g>`, 'Loop');

// Small-size favicon: at 16px the stripe pitch turns to mud, so the tiny variant
// gets a coarser pitch, a heavier ring and no dark container to eat the contrast.
const markCoarse = (pid) =>
  `<path d="${ARC}" fill="none" stroke="url(#${pid})" stroke-width="28" stroke-linecap="butt"/>` +
  `<path d="M64.8 10.6 L48.4 37.0 L34.4 6.8 Z" fill="${POLE_RED}"/>`;
files['brand/loop/favicon-small.svg'] = svg(128, 128,
  `<defs>${stripes('pfs', 2.1)}</defs>` +
  `<g transform="translate(64 64) scale(.98) translate(-64 -64)">${markCoarse('pfs')}</g>`, 'Loop');

// --- lockups: transparent background, mark + word, horizontal and stacked ---
const lockup = (dark, tagline) => {
  const fg = dark ? FG_DARK : FG_LIGHT, sub = dark ? SUB_DARK : SUB_LIGHT;
  const pid = 'pl' + (dark ? 'd' : 'l') + (tagline ? 't' : '');
  return svg(560, 140,
    `<defs>${stripes(pid)}</defs><g transform="translate(4 6)">${markBody(pid)}</g>` +
    `<g transform="translate(0 ${tagline ? 0 : 6})">${wordmark(160, fg, sub, tagline)}</g>`,
    'Loop for barbershops');
};
files['brand/loop/lockup-dark-bg.svg'] = lockup(true, 'FOR BARBERSHOPS');
files['brand/loop/lockup-light-bg.svg'] = lockup(false, 'FOR BARBERSHOPS');
files['brand/loop/lockup-dark-bg-plain.svg'] = lockup(true, '');
files['brand/loop/lockup-light-bg-plain.svg'] = lockup(false, '');

const stacked = (dark) => {
  const fg = dark ? FG_DARK : FG_LIGHT, sub = dark ? SUB_DARK : SUB_LIGHT;
  const pid = 'ps' + (dark ? 'd' : 'l');
  return svg(360, 300,
    `<defs>${stripes(pid)}</defs><g transform="translate(116 8)">${markBody(pid)}</g>` +
    `<text x="180" y="228" text-anchor="middle" font-family="Poppins,Inter,system-ui,Arial,sans-serif" font-size="66" font-weight="900" fill="${fg}" letter-spacing="-1.6">Loop</text>` +
    `<text x="180" y="262" text-anchor="middle" font-family="Inter,system-ui,Arial,sans-serif" font-size="17" font-weight="800" fill="${sub}" letter-spacing="5.4">FOR BARBERSHOPS</text>`,
    'Loop for barbershops');
};
files['brand/loop/stacked-dark-bg.svg'] = stacked(true);
files['brand/loop/stacked-light-bg.svg'] = stacked(false);

// --- wordmark only ---
files['brand/loop/wordmark-dark-bg.svg'] = svg(300, 140, wordmark(6, FG_DARK, SUB_DARK), 'Loop');
files['brand/loop/wordmark-light-bg.svg'] = svg(300, 140, wordmark(6, FG_LIGHT, SUB_LIGHT), 'Loop');

// --- product module icons: one family, one geometry, a colour and a glyph each ---
// Same ring, same container, so a row of them reads as one product suite.
const MODULES = [
  ['rewards', '#ffcf5a', 'Rewards', 'M64 44 L71 60 L88 62 L75 74 L79 91 L64 82 L49 91 L53 74 L40 62 L57 60 Z'],
  ['booking', '#5ad0f0', 'Booking', 'M42 46 h44 a6 6 0 0 1 6 6 v34 a6 6 0 0 1 -6 6 h-44 a6 6 0 0 1 -6 -6 v-34 a6 6 0 0 1 6 -6 Z M36 60 h56 M50 38 v14 M78 38 v14'],
  ['crm', '#7aa2ff', 'CRM', 'M64 46 a13 13 0 1 1 0 26 a13 13 0 0 1 0 -26 Z M38 96 a26 26 0 0 1 52 0 Z'],
  ['arcade', '#b98bff', 'Arcade', 'M44 54 h40 a20 20 0 0 1 0 40 h-40 a20 20 0 0 1 0 -40 Z M54 66 v16 M46 74 h16 M78 70 h.1 M86 80 h.1'],
  ['studio', '#ff8fd6', 'Content Studio', 'M40 44 h48 a6 6 0 0 1 6 6 v36 a6 6 0 0 1 -6 6 h-48 a6 6 0 0 1 -6 -6 v-36 a6 6 0 0 1 6 -6 Z M56 58 l22 12 l-22 12 Z'],
  ['university', '#7CFCC6', 'University', 'M64 40 L100 58 L64 76 L28 58 Z M42 66 v20 a24 12 0 0 0 44 0 v-20'],
  ['ambassadors', '#e8394a', 'Ambassadors', 'M50 52 a14 14 0 1 1 0 28 a14 14 0 0 1 0 -28 Z M82 58 a10 10 0 1 1 0 20 a10 10 0 0 1 0 -20 Z M28 98 a22 22 0 0 1 44 0 Z M76 98 a16 16 0 0 1 28 0 Z'],
  ['shop', '#5df2e0', 'Shop', 'M40 56 h48 l6 40 h-60 Z M54 56 v-8 a10 10 0 0 1 20 0 v8'],
];
const moduleIcon = (accent, path) =>
  svg(128, 128,
    `<rect width="128" height="128" rx="29" fill="${INK}"/>` +
    // the parent loop, quiet, behind the glyph — the family resemblance
    `<path d="${ARC}" fill="none" stroke="${accent}" stroke-width="9" opacity=".22" transform="translate(64 64) scale(.94) translate(-64 -64)"/>` +
    `<path d="${path}" fill="none" stroke="${accent}" stroke-width="7" stroke-linejoin="round" stroke-linecap="round" transform="translate(64 64) scale(.82) translate(-64 -64)"/>`,
    'Loop ' + accent);
for (const [slug, accent, label, path] of MODULES) {
  files[`brand/loop/modules/${slug}.svg`] = moduleIcon(accent, path).replace('aria-label="Loop ' + accent + '"', `aria-label="Loop ${label}"`);
}

// --- TB Solutions: the parent studio mark, as real files instead of a data: URI ---
const TB_GRAD = `<linearGradient id="tbg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5df2e0"/><stop offset=".55" stop-color="#6f9dff"/><stop offset="1" stop-color="#b98bff"/></linearGradient>`;
const tbIcon = (bg) => svg(128, 128,
  `<defs>${TB_GRAD}</defs><rect width="128" height="128" rx="29" fill="${bg}"/>` +
  `<text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-family="Orbitron,Arial,sans-serif" font-weight="900" font-size="58" fill="url(#tbg)">TB</text>`,
  'TB Solutions');
files['brand/tb/icon.svg'] = tbIcon('#070a12');
files['brand/tb/favicon.svg'] = tbIcon('#070a12');
files['brand/tb/lockup.svg'] = svg(620, 160,
  `<defs>${TB_GRAD}</defs>` +
  `<rect x="8" y="16" width="128" height="128" rx="29" fill="#070a12"/>` +
  `<text x="72" y="86" text-anchor="middle" dominant-baseline="middle" font-family="Orbitron,Arial,sans-serif" font-weight="900" font-size="58" fill="url(#tbg)">TB</text>` +
  `<text x="164" y="76" font-family="Orbitron,Arial,sans-serif" font-size="46" font-weight="900" fill="#eef1ff" letter-spacing="-1">TB Solutions</text>` +
  `<text x="167" y="108" font-family="Inter,Arial,sans-serif" font-size="16" font-weight="800" fill="#96a0c4" letter-spacing="4.4">CHESTER COUNTY, PA</text>`,
  'TB Solutions');

for (const [rel, content] of Object.entries(files)) {
  mkdirSync(dirname(join(ROOT, rel)), { recursive: true });
  writeFileSync(join(ROOT, rel), content);
}
console.log(`✓ ${Object.keys(files).length} SVG files`);
Object.keys(files).forEach((f) => console.log('  ' + f));
export { files };
