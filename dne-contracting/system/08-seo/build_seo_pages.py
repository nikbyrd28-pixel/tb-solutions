#!/usr/bin/env python3
"""Builds crawlable SEO landing pages for dnecontracting.com.
Run from dne-contracting/:  python3 system/08-seo/build_seo_pages.py
Writes:  <slug>.html for each service and town page, sitemap.xml, seo.css.
Rules honoured: never mention Pottstown or the street address; never quote prices; mom's homepage copy is not touched."""
import json, os, datetime, html
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SITE = "https://www.dnecontracting.com"
PHONE = "(484) 939-8535"; TEL = "+14849398535"; EMAIL = "hello@dnecontracting.com"
TODAY = datetime.date.today().isoformat()

SERVICES = {
 "kitchen-remodeling": dict(name="Kitchen Remodeling", short="kitchen", type="kitchen", scene="kitchen", photo="img/kitchen-after.jpg",
   kw=["kitchen remodeling contractor", "kitchen renovation", "kitchen remodel cost estimate", "cabinet and countertop installation", "kitchen plumbing relocation"],
   h1="Kitchen remodeling contractor serving {area}",
   intro="From a tired layout to a room you actually want to cook in. Cabinets, counters, plumbing, lighting coordination and the schedule that holds it together. The owner runs the free in-home consultation herself, and the estimate comes in writing afterward.",
   bullets=["Layout changes, islands and peninsulas", "Cabinets, countertops, backsplash and flooring", "Sinks, dishwashers, disposals and gas lines moved where they belong", "Permits, inspections and one point of contact"],
   time="Most kitchens take 3–6 weeks",
   faq=[("How much does a kitchen remodel cost in {area}?", "It depends on layout changes, cabinet grade and how much plumbing or electrical moves. We never guess from a photo. After a free in-home visit you get a written estimate specific to your kitchen, with every line item explained. You can sketch your kitchen in the online planner before we visit."),
        ("Can you move my sink or add an island sink?", "Yes. Relocating drains and supply lines is core plumbing work for us, so you are not paying a general contractor to subcontract the part that matters most."),
        ("Do I need a permit for a kitchen remodel in {county}?", "Usually yes once plumbing, electrical or structural work is involved. We pull the permits and schedule the inspections; you do not have to deal with the township.")]),
 "bathroom-remodeling": dict(name="Bathroom Remodeling", short="bathroom", type="bathroom", scene="bathroom", photo="img/bath-after.jpg",
   kw=["bathroom remodeling contractor", "tub to shower conversion", "walk-in shower installation", "bathroom renovation", "master bath remodel"],
   h1="Bathroom remodeling and tub-to-shower conversions in {area}",
   intro="Tub-to-shower conversions, full gut renovations, or a fresh update on a bathroom that has seen better days. The plumbing is done by the owner, and the estimate comes in writing after a free in-home visit.",
   bullets=["Tiled and curbless showers, tubs, vanities and toilets", "Waterproofing done properly the first time", "Accessibility and aging-in-place options", "Ventilation, lighting and heated floors"],
   time="Most bathrooms take 2–4 weeks",
   faq=[("How long does a bathroom remodel take?", "A hall bath or tub-to-shower conversion usually takes 2–3 weeks; a full primary bathroom 3–4 weeks. The schedule goes in writing before we start and is tracked on your private project page."),
        ("Can you convert my tub to a walk-in shower?", "Yes, it is one of the most common projects we do in {area}. We handle the demolition, new drain, waterproofing, tile, glass and fixtures."),
        ("Is the consultation really free?", "Yes. The owner comes to your home, walks the space with you, and you never have to decide that day.")]),
 "basement-remodeling": dict(name="Basement Remodeling", short="basement", type="basement", scene="basement", photo="img/basement.jpg",
   kw=["basement finishing contractor", "basement remodeling", "basement bathroom addition", "finished basement", "sump pump installation"],
   h1="Basement finishing and basement bathroom additions in {area}",
   intro="Turning the space you avoid into a room you use: bathrooms, laundry, family rooms, wet bars, and fixing the water problem first. Most basement projects start because a bathroom or laundry is going in, and that plumbing is done by the owner.",
   bullets=["Framing, insulation, drywall and flooring", "Bathroom or laundry additions with ejector pumps where needed", "Sump pumps, drainage and moisture control before anything else", "Egress, permits and inspections"],
   time="Most basements take 3–6 weeks",
   faq=[("Can I add a bathroom to a basement with no plumbing?", "Yes. Depending on the slab and the sewer line, we either cut a single pit for a sealed ejector or tie into existing drainage. Two quotes telling you to break up half the slab is often a sign to get a third."),
        ("Do you finish basements that have had water problems?", "That is exactly where we start: we diagnose the water first and put the fix in writing before any framing or drywall."),
        ("Do you need a permit to finish a basement in {county}?", "In nearly every township, yes, and egress rules apply to bedrooms. We handle the paperwork and the inspections.")]),
 "plumbing-water-heaters": dict(name="Plumbing & Water Heaters", short="plumbing", type="repair", scene="roughin", photo="img/heater.jpg",
   kw=["plumber", "water heater replacement", "tankless water heater installation", "PEX repipe", "plumbing repair"],
   h1="Plumbing repairs and water heater replacement in {area}",
   intro="Remodeling is most of what we do, but plumbing is where we started. Water heaters, leaks, repipes and fixture swaps, scheduled and done by the owner.",
   bullets=["Tank and tankless water heater replacement", "Leaks, burst pipes, frozen lines, main shut-offs", "Faucets, toilets, fixtures, drains", "Galvanized-to-PEX repipes"],
   time="Most repairs same or next day",
   faq=[("Should I switch to a tankless water heater?", "If you run out of hot water or want to free up floor space, often yes. We size the unit, upsize the gas line if needed and add isolation valves so it can be flushed each year. If a standard tank is the smarter buy for your house, we will say so."),
        ("How soon can you do a repair or water heater in {area}?", "Repairs and water heaters are usually same or next day. Call or text and we will give you a real time."),
        ("Are you licensed and insured?", "Yes. D N E Contracting is a registered Pennsylvania Home Improvement Contractor and fully insured, and the owner is on every job.")]),
}

# Towns: Chester County is the sales target; 422 corridor towns are the existing footprint. (No Pottstown — by rule.)
TOWNS = [
 dict(slug="west-chester", name="West Chester", county="Chester County", zip="19380", note="borough rowhomes and twins with original cast-iron stacks, plus the newer developments off Route 202", near=["exton","malvern","downingtown","kennett-square"]),
 dict(slug="exton", name="Exton", county="Chester County", zip="19341", note="1990s and 2000s colonials where the builder-grade kitchens and baths are due for a second life", near=["west-chester","downingtown","malvern","phoenixville"]),
 dict(slug="downingtown", name="Downingtown", county="Chester County", zip="19335", note="everything from borough Victorians to Lionville-area colonials with finished-basement potential", near=["exton","west-chester","coatesville","phoenixville"]),
 dict(slug="malvern", name="Malvern", county="Chester County", zip="19355", note="Main Line-adjacent homes where a primary bath or kitchen upgrade carries real resale value", near=["west-chester","exton","phoenixville","king-of-prussia"]),
 dict(slug="kennett-square", name="Kennett Square", county="Chester County", zip="19348", note="older farmhouses and borough homes with galvanized plumbing that is ready for PEX", near=["west-chester","downingtown","coatesville","exton"]),
 dict(slug="coatesville", name="Coatesville", county="Chester County", zip="19320", note="solid older housing stock where a sump, a basement bath and a kitchen refresh go a long way", near=["downingtown","west-chester","kennett-square","exton"]),
 dict(slug="phoenixville", name="Phoenixville", county="Chester County", zip="19460", note="borough twins and rowhomes, plus the newer townhomes near Bridge Street", near=["royersford","collegeville","limerick","malvern"]),
 dict(slug="royersford", name="Royersford", county="Montgomery County", zip="19468", note="1970s and 80s split-levels and ranches with galley kitchens asking to be opened up", near=["limerick","collegeville","phoenixville","boyertown"]),
 dict(slug="collegeville", name="Collegeville", county="Montgomery County", zip="19426", note="colonials around Trappe and Providence with big unfinished basements", near=["royersford","limerick","phoenixville","king-of-prussia"]),
 dict(slug="limerick", name="Limerick", county="Montgomery County", zip="19468", note="newer developments where a basement bathroom and laundry turn a storage floor into living space", near=["royersford","collegeville","boyertown","phoenixville"]),
 dict(slug="king-of-prussia", name="King of Prussia", county="Montgomery County", zip="19406", note="mid-century ranches and splits alongside new construction, both with bathrooms worth upgrading", near=["collegeville","malvern","phoenixville","exton"]),
 dict(slug="boyertown", name="Boyertown", county="Berks County", zip="19512", note="farmhouses and borough homes with plumbing that has been patched more than once", near=["royersford","limerick","collegeville","phoenixville"]),
]
TOWN_BY = {t["slug"]: t for t in TOWNS}

CSS = """:root{--paper:#fff;--paper-2:#F3F5F7;--ink:#17202A;--ink-2:#3B4653;--mute:#66717E;--line:#D9DEE3;--red:#B8322B;--red-2:#9A2721;--navy:#0F2A44;--navy-2:#163A5C;--serif:"Segoe UI",Roboto,"Helvetica Neue",Helvetica,Arial,system-ui,sans-serif;--sans:"Segoe UI",Roboto,"Helvetica Neue",Helvetica,Arial,system-ui,sans-serif;--max:1120px;--radius:6px}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;font-family:var(--sans);font-size:16.5px;line-height:1.6;color:var(--ink);background:var(--paper)}
a{color:inherit}h1,h2,h3{font-family:var(--sans);font-weight:700;letter-spacing:-.01em;line-height:1.12;margin:0 0 .5em;color:var(--ink)}h1{font-size:clamp(2rem,4.2vw,3rem);color:var(--navy)}h2{font-size:clamp(1.5rem,2.6vw,2rem)}h3{font-size:1.15rem}
.wrap{max-width:var(--max);margin:0 auto;padding:0 20px}header{border-bottom:2px solid var(--navy);background:#fff;position:sticky;top:0;z-index:5}
header .wrap{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:64px}.brand{display:flex;align-items:center;gap:8px;text-decoration:none;font-weight:700;font-size:1.2rem;white-space:nowrap;color:var(--navy)}
nav{display:flex;align-items:center;gap:14px;min-width:0}nav a{text-decoration:none;font-size:.95rem;white-space:nowrap}nav .tel{font-weight:700}nav .ico{display:none;width:44px;height:44px;background:var(--red);color:#fff;align-items:center;justify-content:center;border-radius:4px}.btn{display:inline-block;background:var(--red);color:#fff;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:var(--radius);border:2px solid var(--red)}.btn:hover{background:var(--red-2);border-color:var(--red-2)}.btn.o{background:transparent;color:var(--navy);border-color:var(--navy)}.btn.o:hover{background:var(--navy);color:#fff}
@media(max-width:800px){header .wrap{min-height:58px}nav a:not(.ico){display:none}nav .ico{display:flex}.brand{font-size:1.05rem}body{padding-bottom:64px}.sticky-call{position:fixed;left:0;right:0;bottom:0;display:grid;grid-template-columns:1fr 1.6fr;gap:8px;padding:8px 12px;background:#fff;border-top:1px solid var(--line);z-index:6}.sticky-call .btn{text-align:center}}@media(min-width:801px){.sticky-call{display:none}}
.hero{padding:40px 0 40px}.hero .wrap{display:grid;grid-template-columns:1.05fr 1fr;gap:48px;align-items:center}@media(max-width:860px){.hero{padding:18px 0 28px}.hero .wrap{grid-template-columns:1fr;gap:22px}.hero .wrap>div:first-child{order:2}}
.trust{background:var(--navy);color:#fff}.trust .wrap{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;padding-top:18px;padding-bottom:18px}.trust div{display:grid;grid-template-columns:28px 1fr;grid-template-rows:auto auto;column-gap:12px;align-items:center}.trust svg{grid-row:1/3;width:26px;height:26px;fill:none;stroke:#fff;stroke-width:1.8;stroke-linejoin:round;stroke-linecap:round;opacity:.9}.trust b{font-size:.98rem}.trust span{font-size:.82rem;color:#C9D4E0;line-height:1.3}@media(max-width:900px){.trust .wrap{grid-template-columns:1fr 1fr;gap:14px}}@media(max-width:520px){.trust .wrap{grid-template-columns:1fr}.trust span{display:none}.trust div{grid-template-rows:auto}}
.crumbs{font-size:.85rem;color:var(--mute);margin-bottom:12px}.crumbs a{text-decoration:none}.lead{font-size:1.15rem;max-width:56ch;color:var(--ink-2)}.facts{color:var(--mute);font-size:.92rem}
.photo{aspect-ratio:4/3;background:var(--paper-2);position:relative;overflow:hidden;border:0;border-radius:10px}.photo img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.photo.s3d canvas.s3d-c{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:pan-y;cursor:grab}.photo.s3d.s3d-live img{opacity:0}.photo.s3d.s3d-live::after{content:"3D · drag to look around";position:absolute;left:10px;bottom:10px;font:600 .7rem/1 var(--sans);letter-spacing:.04em;text-transform:uppercase;color:#fff;background:rgba(15,42,68,.78);padding:6px 8px;pointer-events:none}
.sec{padding:40px 0}.sec.alt{background:var(--paper-2)}.cols{display:grid;grid-template-columns:1fr 1fr;gap:40px}@media(max-width:800px){.cols{grid-template-columns:1fr}}
ul.checks{padding-left:0;list-style:none}ul.checks li{padding:8px 0 8px 28px;position:relative;border-bottom:1px solid var(--line)}ul.checks li::before{content:"✓";position:absolute;left:0;color:#2E6B3F;font-weight:700}
.chips a{display:inline-block;border:1px solid var(--line);padding:6px 12px;margin:0 8px 8px 0;text-decoration:none;font-size:.92rem;background:#fff;border-radius:999px}.chips a:hover{border-color:var(--ink)}
.svclist{list-style:none;padding:0;margin:0}.svclist li{display:flex;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid var(--line)}.svclist a{text-decoration:none}.svclist span{color:var(--mute);font-size:.9rem;white-space:nowrap}
.faq details{border-top:1px solid var(--line);padding:12px 0}.faq summary{cursor:pointer;font-family:var(--serif);font-size:1.15rem}.faq p{color:var(--ink-2);margin:8px 0 0}
.cta{background:var(--navy);color:#fff;padding:40px 0}.cta .wrap{display:flex;justify-content:space-between;align-items:center;gap:20px;flex-wrap:wrap}.cta h2{margin:0;color:#fff}.cta p{margin:4px 0 0;color:#C9D4E0}.cta .btn{background:#fff;border-color:#fff;color:var(--navy)}.cta .btn:hover{background:#E9EEF3;border-color:#E9EEF3}
footer{background:var(--navy);color:#C9D4E0;padding:40px 0 24px;font-size:.95rem}footer .brand{color:#fff}footer .grid{display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr;gap:28px}@media(max-width:800px){footer .grid{grid-template-columns:1fr;text-align:center;gap:26px}footer .brand{justify-content:center}footer p{margin-left:auto;margin-right:auto}}
footer h4{margin:0 0 10px;font-size:.95rem;color:#fff}footer a{display:block;text-decoration:none;color:#fff;margin-bottom:6px}footer p{color:#C9D4E0}footer .fine{display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;border-top:1px solid rgba(255,255,255,.15);margin-top:28px;padding-top:16px;color:#9FB0C2;font-size:.85rem}footer .fine a{display:inline}
.proj{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}@media(max-width:900px){.proj{grid-template-columns:1fr 1fr}}@media(max-width:520px){.proj{grid-template-columns:1fr}}.proj .photo{aspect-ratio:3/2}.proj b{display:block;margin-top:8px;font-family:var(--serif);font-weight:normal;font-size:1.1rem}.proj span{color:var(--mute);font-size:.9rem}
"""

def e(s): return html.escape(s, quote=True)

def shell(title, desc, canonical, body, ld, scene_needed=True):
    importmap = ''
    loader = ''
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
<link rel="canonical" href="{canonical}">
<meta name="theme-color" content="#0F2A44"><meta name="geo.region" content="US-PA">
<meta property="og:type" content="website"><meta property="og:site_name" content="D N E Contracting"><meta property="og:title" content="{e(title)}"><meta property="og:description" content="{e(desc)}"><meta property="og:url" content="{canonical}"><meta property="og:image" content="{SITE}/og.jpg">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="./seo.css">
{importmap}
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
</head>
<body>
<header><div class="wrap">
 <a class="brand" href="./"><svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" fill="#B8322B"/></svg><span>D N E Contracting</span></a>
 <nav aria-label="Main"><a href="./kitchen-remodeling">Kitchens</a><a href="./bathroom-remodeling">Bathrooms</a><a href="./basement-remodeling">Basements</a><a href="./plumbing-water-heaters">Plumbing</a><a href="./#projects">Projects</a><a class="tel" href="tel:{TEL}">{PHONE}</a><a class="btn" href="./#planner">Book a free consultation</a><a class="ico" href="tel:{TEL}" aria-label="Call"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.6a2 2 0 0 1-.5 2.1L8 9.7a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.8.3 1.7.6 2.6.7a2 2 0 0 1 1.7 2z"/></svg></a></nav>
</div></header>
<main>
{body}
</main>
<div class="sticky-call"><a class="btn o" href="tel:{TEL}">Call</a><a class="btn" href="./#planner">Book a free consultation</a></div>
<footer><div class="wrap">
 <div class="grid">
  <div><a class="brand" href="./" style="margin-bottom:10px"><span>D N E Contracting</span></a><p style="max-width:40ch">Women-owned kitchen, bathroom and basement remodeling, plus plumbing and water heaters. Chester and Montgomery counties, the 422 corridor and greater Philadelphia.</p><p>PA HIC #PA096110 · Fully insured</p></div>
  <div><h4>Services</h4>{''.join(f'<a href="./{s}">{v["name"]}</a>' for s,v in SERVICES.items())}<a href="./#planner">Online remodel planner</a></div>
  <div><h4>Areas we serve</h4>{''.join(f'<a href="./remodeling-{t["slug"]}">{t["name"]}, PA</a>' for t in TOWNS)}</div>
  <div><h4>Company</h4><a href="./#about">About</a><a href="./#projects">Projects</a><a href="./#reviews">Reviews</a><a href="./#faq">FAQ</a><a href="./#refer">Refer a friend</a><a href="./#portal">Client portal</a><a href="tel:{TEL}">{PHONE}</a><a href="mailto:{EMAIL}">{EMAIL}</a></div>
 </div>
 <div class="fine"><span>© {datetime.date.today().year} D N E Contracting</span><span>Website by <a href="https://tbsol.net">TB Solutions</a></span></div>
</div></footer>
{loader}
</body></html>"""

def biz_ld(): return {"@id": f"{SITE}/#business"}

def crumbs_ld(items):
    return {"@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":i+1,"name":n,"item":u} for i,(n,u) in enumerate(items)]}

def faq_ld(faq): return {"@type":"FAQPage","mainEntity":[{"@type":"Question","name":q,"acceptedAnswer":{"@type":"Answer","text":a}} for q,a in faq]}

def faq_html(faq):
    return '<div class="faq">' + ''.join(f'<details{" open" if i==0 else ""}><summary>{e(q)}</summary><p>{e(a)}</p></details>' for i,(q,a) in enumerate(faq)) + '</div>'

def scene(sc, photo, alt, var=0):
    return f'<div class="photo"><img src="./{photo}" alt="{e(alt)}" width="1600" height="1200"></div>'

def service_page(slug, S):
    area = "Chester and Montgomery counties"; county = "Chester County"
    url = f"{SITE}/{slug}"
    title = f"{S['name']} Chester County PA | D N E Contracting"
    desc = f"Women-owned {S['name'].lower()} contractor serving Chester and Montgomery counties, the 422 corridor and greater Philadelphia. Free in-home consultation, written estimates, owner on every job. Call {PHONE}."
    faq = [(q.format(area=area, county=county), a.format(area=area, county=county)) for q,a in S["faq"]]
    towns = ''.join(f'<a href="./remodeling-{t["slug"]}">{S["name"]} in {t["name"]}</a>' for t in TOWNS)
    others = ''.join(f'<a href="./{k}">{v["name"]}</a>' for k,v in SERVICES.items() if k!=slug)
    body = f"""
<section class="hero"><div class="wrap">
 <div><div class="crumbs"><a href="./">Home</a> › {e(S['name'])}</div>
  <h1>{e(S['h1'].format(area=area))}</h1>
  <p class="lead">{e(S['intro'])}</p>
  <p><a class="btn" href="./#planner?type={S['type']}">Book a free consultation</a> &nbsp; <a class="btn o" href="tel:{TEL}">Call or text {PHONE}</a></p>
  <p class="facts">Licensed &amp; insured · Women-owned · {e(S['time'])} · Serving Chester County, the 422 corridor and greater Philadelphia</p></div>
 {scene(S['scene'], S['photo'], f"{S['name']} by D N E Contracting: {S['short']} work in a Pennsylvania home")}
</div></section>
<div class="trust"><div class="wrap"><div><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l7 3v6c0 5-3.5 9.4-7 11-3.5-1.6-7-6-7-11V5l7-3z"/></svg><b>PA HIC #PA096110</b><span>Registered PA Home Improvement Contractor</span></div><div><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11h18v10H3zM7 11V7a5 5 0 0 1 10 0v4"/></svg><b>Fully insured</b><span>Liability coverage on every job</span></div><div><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 21a8 8 0 0 0-16 0M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/></svg><b>Women-owned</b><span>Nicole runs every consultation herself</span></div><div><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg><b>Free in-home visit</b><span>Estimate in writing, nothing to decide on the spot</span></div></div></div>
<section class="sec"><div class="wrap cols">
 <div><h2>What a D N E {S['short']} project includes</h2><ul class="checks">{''.join(f'<li>{e(b)}</li>' for b in S['bullets'])}</ul></div>
 <div><h2>How the free consultation works</h2>
  <p>The owner comes to your home, walks the space with you and asks what is bugging you about it. A few days later you get a written estimate specific to your house, and you decide on your own time.</p>
  <p>Before the visit you can sketch your room in the <a href="./#planner?type={S['type']}">online planner</a>. The estimate comes in writing after the visit.</p>
  <p>Every client gets a <a href="./#portal">private project page</a> with photos, the schedule and payments, so you always know where things stand.</p>
  <h3 style="margin-top:22px">Other services</h3><div class="chips">{others}</div></div>
</div></section>
<section class="sec alt"><div class="wrap"><h2>{e(S['name'])} questions we hear most</h2>{faq_html(faq)}</div></section>
<section class="sec"><div class="wrap"><h2>Where we do {S['short']} work</h2><p class="facts">Chester and Montgomery counties and the 422 corridor, plus Bucks, Delaware and Philadelphia counties and nearby South Jersey.</p><div class="chips">{towns}</div></div></section>
<section class="cta"><div class="wrap"><div><h2>Book a free consultation</h2><p>In your home. Nothing to decide on the spot.</p></div><a class="btn" href="./#planner?type={S['type']}">Book a visit</a></div></section>
"""
    ld = {"@context":"https://schema.org","@graph":[
        {"@type":"Service","@id":url+"#service","name":S["name"],"serviceType":S["name"],"provider":biz_ld(),"areaServed":[{"@type":"AdministrativeArea","name":"Chester County, PA"},{"@type":"AdministrativeArea","name":"Montgomery County, PA"},{"@type":"Place","name":"422 corridor, PA"},{"@type":"City","name":"Philadelphia"}],"url":url,"description":S["intro"],
         "offers":{"@type":"Offer","price":"0","priceCurrency":"USD","name":"Free in-home consultation"}},
        {"@type":"WebPage","@id":url,"url":url,"name":title,"isPartOf":{"@id":f"{SITE}/#website"},"about":{"@id":url+"#service"}},
        crumbs_ld([("Home", SITE+"/"),(S["name"], url)]), faq_ld(faq)]}
    return shell(title, desc, url, body, ld)

def town_page(t):
    slug = f"remodeling-{t['slug']}"; url = f"{SITE}/{slug}"; area = f"{t['name']}, PA"; county = t["county"]
    title = f"Remodeling Contractor {t['name']} PA | Kitchen, Bath, Basement"
    desc = f"Women-owned remodeling contractor and plumber serving {t['name']} ({t['zip']}) and {county}. Kitchen, bathroom and basement remodels start to finish, water heaters and repairs. Free in-home consultation. {PHONE}."
    faq = [(f"Do you serve all of {t['name']}?", f"Yes. {t['name']} and the surrounding parts of {county} are inside our regular service area."),
           (f"What permits do remodels need in {t['name']}?", f"Kitchens, bathrooms and finished basements almost always need township permits once plumbing, electrical or structural work is involved. We pull them and schedule the inspections for you."),
           (f"Can I get a price before you visit my {t['name']} home?", "Not a real one. A number before anyone has stood in the room is a guess. You can sketch the room in the online planner before the visit, and the estimate comes in writing after it.")]
    svcs = ''.join(f"""<li><a href="./{k}"><b>{v['name']}</b></a><span>{e(v['time'])}</span></li>""" for k,v in SERVICES.items())
    near = ''.join(f'<a href="./remodeling-{n}">{TOWN_BY[n]["name"]}</a>' for n in t["near"] if n in TOWN_BY)
    body = f"""
<section class="hero"><div class="wrap">
 <div><div class="crumbs"><a href="./">Home</a> › Areas we serve › {e(t['name'])}</div>
  <h1>Kitchen, bathroom and basement remodeling in {e(t['name'])}, PA</h1>
  <p class="lead">D N E Contracting is a women-owned remodeling contractor and licensed plumber serving {e(t['name'])} and {e(county)}. Kitchen, bathroom and basement remodels, plus plumbing repairs and water heaters. The consultation is free, in your home, and you never have to decide on the spot.</p>
  <p><a class="btn" href="./#planner">Book a free consultation</a> &nbsp; <a class="btn o" href="tel:{TEL}">Call or text {PHONE}</a></p>
  <p class="facts">Licensed &amp; insured · Owner on every job · Serving {e(t['name'])} {t['zip']} and all of {e(county)}</p></div>
 {scene('plans', 'img/plans.jpg', f"Planning a kitchen or bathroom remodel at the kitchen table")}
</div></section>
<div class="trust"><div class="wrap"><div><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l7 3v6c0 5-3.5 9.4-7 11-3.5-1.6-7-6-7-11V5l7-3z"/></svg><b>PA HIC #PA096110</b><span>Registered PA Home Improvement Contractor</span></div><div><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11h18v10H3zM7 11V7a5 5 0 0 1 10 0v4"/></svg><b>Fully insured</b><span>Liability coverage on every job</span></div><div><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 21a8 8 0 0 0-16 0M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/></svg><b>Women-owned</b><span>Nicole runs every consultation herself</span></div><div><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg><b>Free in-home visit</b><span>Estimate in writing, nothing to decide on the spot</span></div></div></div>
<section class="sec"><div class="wrap cols"><div><h2>What we do in {e(t['name'])}</h2><ul class="svclist">{svcs}</ul></div>{scene('kitchen', 'img/kitchen-after.jpg', "A finished kitchen after a plumbing-driven remodel", 1)}</div></section>
<section class="sec alt"><div class="wrap cols">
 <div><h2>How we work in {e(t['name'])}</h2><ul class="checks"><li>Free in-home consultation with the owner</li><li>The plumbing is done by the owner, not subcontracted</li><li>Written estimates and schedules</li><li>Permits and inspections handled for you</li><li>Shoes off at the door, one point of contact</li></ul></div>
 <div><h2>{e(t['name'])} remodeling questions</h2>{faq_html(faq)}</div>
</div></section>
<section class="sec"><div class="wrap"><h2>Nearby areas we also serve</h2><div class="chips">{near}<a href="./#contact">Somewhere else nearby? Ask</a></div></div></section>
<section class="cta"><div class="wrap"><div><h2>Book a free consultation in {e(t['name'])}</h2><p>In your home. Nothing to decide on the spot.</p></div><a class="btn" href="./#planner">Book a visit</a></div></section>
"""
    ld = {"@context":"https://schema.org","@graph":[
        {"@type":"WebPage","@id":url,"url":url,"name":title,"isPartOf":{"@id":f"{SITE}/#website"},"about":biz_ld(),"description":desc},
        {"@type":"Service","name":f"Home remodeling in {t['name']}, PA","provider":biz_ld(),"areaServed":{"@type":"City","name":t['name'],"containedInPlace":{"@type":"AdministrativeArea","name":county+", PA"}},"url":url,
         "hasOfferCatalog":{"@type":"OfferCatalog","name":f"Services in {t['name']}","itemListElement":[{"@type":"Offer","itemOffered":{"@type":"Service","name":v["name"],"url":f"{SITE}/{k}"}} for k,v in SERVICES.items()]}},
        crumbs_ld([("Home", SITE+"/"),("Areas we serve", SITE+"/#contact"),(t['name'], url)]), faq_ld(faq)]}
    return shell(title, desc, url, body, ld)

def main():
    os.chdir(ROOT)
    open("seo.css","w").write(CSS)
    urls = [(SITE+"/", "1.0", "weekly")]
    for slug,S in SERVICES.items():
        open(f"{slug}.html","w").write(service_page(slug,S)); urls.append((f"{SITE}/{slug}","0.9","monthly"))
    for t in TOWNS:
        open(f"remodeling-{t['slug']}.html","w").write(town_page(t)); urls.append((f"{SITE}/remodeling-{t['slug']}","0.8","monthly"))
    sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + ''.join(f'<url><loc>{u}</loc><lastmod>{TODAY}</lastmod><changefreq>{c}</changefreq><priority>{p}</priority></url>\n' for u,p,c in urls) + '</urlset>\n'
    open("sitemap.xml","w").write(sm)
    print(f"wrote {len(urls)-1} pages + sitemap ({len(urls)} urls)")

if __name__ == "__main__": main()
