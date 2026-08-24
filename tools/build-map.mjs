/* ============================================================================
   THE MAP
   ----------------------------------------------------------------------------
   106 pages accumulated across four different businesses sharing one domain,
   and no single place that lists them. So every time something needed finding
   it got hunted for, and twice it got rebuilt instead — /studio/ and
   /content-studio/, /center/ and /hq/, four separate sales pages for Loop.
   A map is the cheapest fix for that.

   Generated, never hand-written: a hand-written index of a hundred pages is
   out of date the week after it is made. This reads the real filesystem, pulls
   each page's own <title> and robots tag, and sorts them into the audience that
   is actually meant to see them. Run `node tools/build-map.mjs` after adding a
   page and the map is correct again.
   ============================================================================ */
import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const SKIP = new Set(['.git', 'node_modules', '_hosts', 'api', 'supabase', '.github', '.claude', 'tools']);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (name === 'index.html') out.push(full);
  }
  return out;
}

function meta(file) {
  const html = readFileSync(file, 'utf8').slice(0, 6000);
  const grab = (re) => { const m = html.match(re); return m ? m[1].trim() : ''; };
  return {
    title: grab(/<title>([^<]*)<\/title>/),
    desc:  grab(/name="description" content="([^"]*)"/),
    robots: grab(/name="robots" content="([^"]*)"/) || 'index'
  };
}

const pages = walk(ROOT).map(f => {
  const url = ('/' + f.replace(ROOT, '').replace(/^[\\/]/, '').replace(/index\.html$/, '')).replace(/\/+/g, '/');
  return { url, ...meta(f) };
}).sort((a, b) => a.url.localeCompare(b.url));

/* Grouped by WHO IT IS FOR, not by folder. A folder tree is how the files
   happen to sit; an audience is how anybody actually looks for something. */
const GROUPS = [
  { id: 'agency', name: 'TB Solutions — the agency', icon: '🏢',
    blurb: 'The front door for a local business that wants marketing done for them.',
    match: u => ['/', '/suite/', '/start/', '/support/', '/learn/', '/command/', '/play/', '/share/', '/capture/'].includes(u)
             || u.startsWith('/learn/') },
  { id: 'loop', name: 'Loop — the product shops buy', icon: '🔁',
    blurb: 'One product, several doors. /build/ is the front door thebarberloop.com points at.',
    match: u => ['/build/', '/loyalty/', '/barbers/', '/demo/', '/booking/', '/ambassadors/', '/guides/'].includes(u)
             || u.startsWith('/rewards/') || u.startsWith('/booking/') || u.startsWith('/ambassadors/')
             || u.startsWith('/guides/') || u.startsWith('/review/') || u.startsWith('/arcade/')
             || u.startsWith('/shop/') || u.startsWith('/loyalty/') || u.startsWith('/barbershops/') },
  { id: 'earn', name: 'Ways to earn with Loop', icon: '💰',
    blurb: 'Three different arrangements that are easy to confuse. /earn/ explains which is which.',
    match: u => ['/earn/', '/reps/', '/affiliate/', '/affiliate/admin/', '/kit/loop-resell/'].includes(u) },
  { id: 'school', name: 'TB University', icon: '🎓',
    blurb: 'The school and the campus students log into.',
    match: u => u.startsWith('/university/') },
  { id: 'kits', name: 'Builders & kits', icon: '🧰',
    blurb: 'Generators that produce something a student or client walks away with.',
    match: u => u.startsWith('/kit/') || ['/content-studio/', '/studio/', '/creatives/', '/brand/'].includes(u) },
  { id: 'ops', name: 'Your back office', icon: '🔒',
    blurb: 'Internal. Nothing here should ever be in search results.',
    match: u => u.startsWith('/hq/') || u.startsWith('/admin/') || u.startsWith('/marketing-engine/')
             || u.startsWith('/crm/') || u.startsWith('/command/agents') || u.startsWith('/command/the-last-game')
             || ['/center/', '/setup/', '/portal/', '/crm/', '/map/'].includes(u) },
  { id: 'clients', name: 'Client work', icon: '👤',
    blurb: 'Sites and pages built for paying clients.',
    match: u => u.startsWith('/clients/') || u === '/voomlux/' },
  { id: 'legal', name: 'Legal & policy', icon: '📜',
    blurb: 'Linked from forms and required by the carriers.',
    match: u => ['/privacy/', '/terms/', '/sms-terms/'].includes(u) }
];

const seen = new Set();
const grouped = GROUPS.map(g => {
  const items = pages.filter(p => !seen.has(p.url) && g.match(p.url));
  items.forEach(p => seen.add(p.url));
  return { ...g, items };
});
const orphans = pages.filter(p => !seen.has(p.url));
if (orphans.length) grouped.push({ id: 'other', name: 'Not yet filed', icon: '❓',
  blurb: 'Pages the map does not have a home for. Either give them one in tools/build-map.mjs, or ask what they are still doing here.',
  items: orphans });

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isPublic = r => !/noindex/i.test(r);
const publicCount = pages.filter(p => isPublic(p.robots)).length;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>The map — every page on this estate</title>
<meta name="robots" content="noindex,nofollow">
<meta name="theme-color" content="#05060c">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&family=Poppins:wght@700;800;900&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
<noscript><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&family=Poppins:wght@700;800;900&display=swap" rel="stylesheet"></noscript>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='15' fill='%2306070e'/%3E%3Ctext x='50%25' y='56%25' text-anchor='middle' dominant-baseline='middle' font-size='34'%3E%F0%9F%97%BA%EF%B8%8F%3C/text%3E%3C/svg%3E">
<style>
:root{--bg:#05060c;--line:rgba(255,255,255,.09);--line2:rgba(255,212,90,.28);--text:#f3f5ff;--muted:#a2abc7;
  --gold:#ffd45a;--amber:#ff9a3d;--good:#43f0b0;--acc:#7aa2ff;--vio:#b98bff}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font-family:Inter,system-ui,sans-serif;line-height:1.6}
h1,h2,h3{font-family:Poppins,Inter,sans-serif;margin:0;letter-spacing:-.02em}
a{color:var(--gold);text-decoration:none}
.wrap{max-width:940px;margin:0 auto;padding:26px 16px 70px}
header{text-align:center;margin-bottom:22px}
header h1{font-size:clamp(26px,5vw,38px);font-weight:900}
header p{color:var(--muted);font-size:15px;max-width:56ch;margin:10px auto 0}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:20px 0 8px}
@media(max-width:600px){.kpis{grid-template-columns:repeat(2,1fr)}}
.kpis div{border:1px solid var(--line);border-radius:14px;padding:12px;text-align:center;background:rgba(255,255,255,.025)}
.kpis b{display:block;font-family:Poppins;font-size:20px;font-weight:900}
.kpis span{font-size:11px;color:var(--muted)}
#q{width:100%;border:1px solid var(--line);border-radius:999px;background:rgba(255,255,255,.05);color:var(--text);
  padding:13px 18px;font:inherit;font-size:15px;margin:14px 0 20px}
#q:focus{outline:0;border-color:var(--line2)}
section{margin-bottom:26px}
.sh{display:flex;align-items:baseline;gap:10px;margin-bottom:4px}
.sh h2{font-size:19px;font-weight:900}
.sh span{color:var(--muted);font-size:12.5px}
.sb{color:var(--muted);font-size:13.5px;margin:0 0 12px}
.row{display:flex;gap:12px;align-items:center;border:1px solid var(--line);border-radius:13px;padding:11px 13px;margin-bottom:8px;
  background:rgba(255,255,255,.025);transition:border-color .15s,transform .15s}
.row:hover{border-color:var(--line2);transform:translateY(-1px)}
.row .bd{flex:1;min-width:0}
.row .bd b{display:block;font-size:14.5px;font-weight:700}
.row .bd code{color:var(--acc);font-size:12px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.row .bd span{display:block;color:var(--muted);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tag{flex:0 0 auto;font-size:10.5px;font-weight:800;border-radius:999px;padding:3px 9px;border:1px solid var(--line);color:var(--muted)}
.tag.pub{color:var(--good);border-color:rgba(67,240,176,.35);background:rgba(67,240,176,.07)}
.tag.int{color:var(--muted)}
.none{color:var(--muted);font-size:13px;text-align:center;padding:26px}
footer{border-top:1px solid var(--line);padding-top:18px;color:var(--muted);font-size:12px;text-align:center}
</style>
</head>
<body>
<div class="wrap">
<header>
  <h1>🗺️ The map</h1>
  <p>Every page on this estate, sorted by who it is for. Generated from the filesystem — run <code>node tools/build-map.mjs</code> after adding a page.</p>
  <div class="kpis">
    <div><b>${pages.length}</b><span>pages</span></div>
    <div><b>${publicCount}</b><span>public</span></div>
    <div><b>${pages.length - publicCount}</b><span>internal</span></div>
    <div><b>${grouped.filter(g => g.items.length).length}</b><span>areas</span></div>
  </div>
</header>

<input id="q" type="search" placeholder="Filter — type 'loop', 'kit', 'admin'…" autocomplete="off">

${grouped.filter(g => g.items.length).map(g => `<section data-group>
  <div class="sh"><h2>${g.icon} ${esc(g.name)}</h2><span>${g.items.length}</span></div>
  <p class="sb">${esc(g.blurb)}</p>
  ${g.items.map(p => `<a class="row" href="${esc(p.url)}" data-s="${esc((p.url + ' ' + p.title + ' ' + p.desc).toLowerCase())}">
    <div class="bd"><b>${esc(p.title || p.url)}</b><code>${esc(p.url)}</code>${p.desc ? `<span>${esc(p.desc)}</span>` : ''}</div>
    <span class="tag ${isPublic(p.robots) ? 'pub' : 'int'}">${isPublic(p.robots) ? 'public' : 'internal'}</span>
  </a>`).join('\n  ')}
</section>`).join('\n')}

<div class="none" id="none" style="display:none">Nothing matches that.</div>
<footer>Generated ${new Date().toISOString().slice(0, 10)} · <a href="/earn/">the offer ladder</a> · <a href="/hq/">HQ</a></footer>
</div>
<script>
var q=document.getElementById('q');
q.addEventListener('input',function(){
  var t=q.value.trim().toLowerCase(), hits=0;
  [].forEach.call(document.querySelectorAll('.row'),function(r){
    var on=!t||r.getAttribute('data-s').indexOf(t)>=0;
    r.style.display=on?'':'none'; if(on)hits++;
  });
  [].forEach.call(document.querySelectorAll('[data-group]'),function(s){
    s.style.display=s.querySelector('.row:not([style*="none"])')?'':'none';
  });
  document.getElementById('none').style.display=hits?'none':'block';
});
</script>
</body>
</html>`;

writeFileSync(join(ROOT, 'map', 'index.html'), html);
console.log(`map: ${pages.length} pages, ${publicCount} public, ${grouped.filter(g=>g.items.length).length} groups`);
if (orphans.length) console.log('unfiled:', orphans.map(o => o.url).join(', '));
