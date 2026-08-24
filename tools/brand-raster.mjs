// Rasterises the brand SVGs to PNG/ICO with the bundled chromium.
// Every size is rendered from the vector, not resampled from a bigger PNG.
// Run: node tools/brand-raster.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
// playwright is installed globally in this environment; fall back to the global path.
const pw = await import('playwright').catch(() => import('/opt/node22/lib/node_modules/playwright/index.js'));
const { chromium } = pw.chromium ? pw : pw.default;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const p = (...a) => join(ROOT, ...a);
['brand/loop/png', 'brand/loop/png/modules', 'brand/tb/png'].forEach((d) => mkdirSync(p(d), { recursive: true }));

const browser = await chromium.launch({ args: ['--force-color-profile=srgb'] });
const page = await browser.newPage();

async function shot(html, w, h, out, transparent = true) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(
    `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:${transparent ? 'transparent' : '#0a0d18'};}
     body>svg{display:block;width:${w}px;height:${h}px}
     .logo>svg{display:block;width:100%;height:auto}</style>${html}`,
    { waitUntil: 'load' });
  await page.screenshot({ path: p(out), omitBackground: transparent });
  console.log('  ' + out);
}

const svgOf = (rel) => readFileSync(p(rel), 'utf8')
  .replace(/width="\d+"/, '').replace(/height="\d+"/, '');

async function render(src, sizes, outDir, base) {
  const s = svgOf(src);
  for (const [w, h, name] of sizes) await shot(s, w, h, `${outDir}/${name}`, true);
  return base;
}

console.log('Loop:');
await render('brand/loop/icon.svg', [
  [1024, 1024, 'icon-1024.png'], [512, 512, 'icon-512.png'], [192, 192, 'icon-192.png'],
  [180, 180, 'apple-touch-icon.png'],
], 'brand/loop/png');
// tab-sized icons come from the coarse variant so they stay legible
await render('brand/loop/favicon-small.svg', [[48, 48, 'favicon-48.png'], [32, 32, 'favicon-32.png'], [16, 16, 'favicon-16.png']], 'brand/loop/png');
await render('brand/loop/mark.svg', [[1024, 1024, 'mark-1024.png'], [512, 512, 'mark-512.png']], 'brand/loop/png');
await render('brand/loop/lockup-dark-bg.svg', [[1600, 400, 'lockup-dark-1600.png']], 'brand/loop/png');
await render('brand/loop/lockup-light-bg.svg', [[1600, 400, 'lockup-light-1600.png']], 'brand/loop/png');
await render('brand/loop/stacked-dark-bg.svg', [[1080, 900, 'stacked-dark-1080.png']], 'brand/loop/png');
for (const m of ['rewards', 'booking', 'crm', 'arcade', 'studio', 'university', 'ambassadors', 'shop'])
  await render(`brand/loop/modules/${m}.svg`, [[512, 512, `${m}-512.png`], [192, 192, `${m}-192.png`]], 'brand/loop/png/modules');

console.log('TB Solutions:');
await render('brand/tb/icon.svg', [
  [1024, 1024, 'icon-1024.png'], [512, 512, 'icon-512.png'], [192, 192, 'icon-192.png'],
  [180, 180, 'apple-touch-icon.png'], [48, 48, 'favicon-48.png'], [32, 32, 'favicon-32.png'], [16, 16, 'favicon-16.png'],
], 'brand/tb/png');

// ---- social cards, composed rather than scaled ----
const card = (bg, inner) =>
  `<div style="width:1200px;height:630px;display:flex;align-items:center;justify-content:center;background:${bg};font-family:Inter,Arial,sans-serif">${inner}</div>`;
await shot(card(
  'radial-gradient(circle at 15% 0%,rgba(122,162,255,.30),transparent 55%),linear-gradient(180deg,#070811,#04050a)',
  `<div style="text-align:center"><div class="logo" style="width:220px;margin:0 auto 26px">${svgOf('brand/loop/mark.svg')}</div>
   <div style="font-family:Poppins,Inter,Arial;font-weight:900;font-size:92px;color:#f2f4ff;letter-spacing:-2px;line-height:1">Loop</div>
   <div style="font-weight:800;font-size:22px;color:#8f97b8;letter-spacing:7px;margin-top:14px">FOR BARBERSHOPS</div>
   <div style="font-size:26px;color:#c3cbe6;margin-top:26px">Booking · rewards · websites · the texts that bring them back</div></div>`
), 1200, 630, 'brand/loop/png/og.png', false);

await shot(card(
  'radial-gradient(circle at 12% -8%,rgba(94,242,224,.20),transparent 45%),radial-gradient(circle at 88% 4%,rgba(185,139,255,.20),transparent 45%),linear-gradient(180deg,#05070f,#03040a)',
  `<div style="text-align:center"><div class="logo" style="width:150px;margin:0 auto 24px">${svgOf('brand/tb/icon.svg')}</div>
   <div style="font-family:Orbitron,Arial;font-weight:900;font-size:74px;color:#eef1ff;letter-spacing:-1px;line-height:1">TB Solutions</div>
   <div style="font-weight:800;font-size:20px;color:#96a0c4;letter-spacing:6px;margin-top:16px">CHESTER COUNTY, PA</div>
   <div style="font-size:26px;color:#c3cbe6;margin-top:26px">AI marketing · websites · local SEO · lead follow-up</div></div>`
), 1200, 630, 'brand/tb/png/og.png', false);

await browser.close();

// ---- .ico (16/32/48 PNG-in-ICO; every browser in use reads this) ----
function ico(pngPaths) {
  const imgs = pngPaths.map(([size, f]) => ({ size, buf: readFileSync(p(f)) }));
  const head = Buffer.alloc(6);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(imgs.length, 4);
  const dir = Buffer.alloc(16 * imgs.length);
  let offset = 6 + dir.length;
  imgs.forEach((im, i) => {
    const o = i * 16;
    dir[o] = im.size >= 256 ? 0 : im.size;
    dir[o + 1] = im.size >= 256 ? 0 : im.size;
    dir[o + 2] = 0; dir[o + 3] = 0;
    dir.writeUInt16LE(1, o + 4); dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(im.buf.length, o + 8); dir.writeUInt32LE(offset, o + 12);
    offset += im.buf.length;
  });
  return Buffer.concat([head, dir, ...imgs.map((i) => i.buf)]);
}
writeFileSync(p('brand/loop/png/favicon.ico'), ico([[16, 'brand/loop/png/favicon-16.png'], [32, 'brand/loop/png/favicon-32.png'], [48, 'brand/loop/png/favicon-48.png']]));
writeFileSync(p('brand/tb/png/favicon.ico'), ico([[16, 'brand/tb/png/favicon-16.png'], [32, 'brand/tb/png/favicon-32.png'], [48, 'brand/tb/png/favicon-48.png']]));
console.log('  brand/loop/png/favicon.ico\n  brand/tb/png/favicon.ico');
