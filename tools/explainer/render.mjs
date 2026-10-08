// Renders an explainer (a JSON list of frames) into 1080x1920 PNGs + a silent slideshow MP4.
//   node tools/explainer/render.mjs tools/explainer/examples/quote-went-quiet.json out/quote-went-quiet
// Each frame: { stage: "<html for the drawing>", caption: "<on-screen line, <mark> for highlight>", side: "l"|"r", mood: "ok"|"sad", secs: 4 }
// The PNGs post as an Instagram carousel as-is; the MP4 is the reel with Nick's voice recorded over it
// (or Visuals adds TTS later). House style lives in template.html — do not restyle per post.
import { chromium } from "playwright-core";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const [specPath, outDir] = process.argv.slice(2);
if (!specPath || !outDir) { console.error("usage: render.mjs <spec.json> <outDir>"); process.exit(1); }
const spec = JSON.parse(readFileSync(specPath, "utf8"));
mkdirSync(outDir, { recursive: true });
const tpl = readFileSync(resolve(here, "template.html"), "utf8");

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const frames = spec.frames;
const list = [];
for (let i = 0; i < frames.length; i++) {
  const f = { ...frames[i], n: i + 1, total: frames.length, tag: spec.tag || "" };
  const html = tpl.replace("<script>\n", () => `<script>window.FRAME=${JSON.stringify(f)};\n`);
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  const file = resolve(outDir, `${String(i + 1).padStart(2, "0")}.png`);
  await page.screenshot({ path: file });
  await page.close();
  list.push({ file, secs: f.secs || 4 });
}
await browser.close();

// slideshow: concat demuxer, each frame held for its seconds, 30fps, h264 — IG-safe
const concat = list.map(x => `file '${x.file}'\nduration ${x.secs}`).join("\n") + `\nfile '${list[list.length - 1].file}'\n`;
writeFileSync(resolve(outDir, "list.txt"), concat);
execSync(`ffmpeg -y -loglevel error -f concat -safe 0 -i "${resolve(outDir, "list.txt")}" -vf "fps=30,format=yuv420p" -c:v libx264 -preset fast -crf 20 "${resolve(outDir, "reel.mp4")}"`);
console.log(`${list.length} frames → ${outDir}/01..${String(list.length).padStart(2, "0")}.png + reel.mp4 (${list.reduce((a, x) => a + x.secs, 0)}s)`);
