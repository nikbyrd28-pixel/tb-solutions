/* ============================================================================
   THE STOREFRONT TEMPLATE
   ----------------------------------------------------------------------------
   Hubs & Babydoll was built once, by hand, for one client. It works — a
   catalogue with variants, an order request that lands in the CRM, and no
   checkout to configure or payment processor to onboard, which is exactly what
   a small maker actually needs on day one. Rebuilding that from scratch for
   the next client would be a week of work for the same result.

   So this is that store with the client pulled out of it. Feed it a config and
   it returns ONE self-contained HTML file — inline CSS, inline JS, no build
   step, no dependencies, no server. A student fills in a form, downloads the
   file, drags it onto any host, and a shop has a storefront.

   WHY ORDER REQUESTS AND NOT A CHECKOUT.
   A maker with 30 products and no stock system cannot honour instant payment
   on everything, and the day they cannot, a refund costs them the customer.
   The request form asks for the same commitment in the customer's head while
   leaving the shop room to confirm price, stock and delivery. Every order
   lands in client_leads under the shop's slug, so it arrives in the CRM the
   student already runs — which is what turns a one-off site build into a
   monthly retainer.

   The generated file talks to Supabase with the publishable anon key, exactly
   as every other client-facing page on this estate does. Nothing secret is in
   it, because nothing secret can be in a file the customer's browser holds.
   ============================================================================ */
(function (w) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  /* Config is embedded in a <script> tag in the generated file. An unescaped
     "</script>" anywhere in a product blurb would end that tag early and break
     the whole store, so every "<" in the JSON is escaped at the source. */
  function embed(obj) {
    return JSON.stringify(obj).replace(/</g, '\\u003c').replace(/\u2028|\u2029/g, '');
  }
  function slugify(s) {
    return String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '').slice(0, 40);
  }

  var SUPA_URL = 'https://qgbjiqdwzgkjkmqyjsmc.supabase.co';
  var SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnYmppcWR3emdramttcXlqc21jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzNzc1NTEsImV4cCI6MjA5OTk1MzU1MX0.Naocw-B0B6Z7CLg197yxLezd58a6f5XoMLEiea5b0Ro';

  /* The worked example. A student opening the builder should see a real shop,
     not an empty form — it is far easier to change something than to invent it,
     and the fastest way to teach the shape of a good product page is to hand
     someone one that already works. */
  var DEMO = {
    slug: 'hubsandbabydoll',
    brand: { name: 'Hubs & Babydoll', initials: 'H&B', tagline: 'Small-batch body care, made by hand' },
    theme: { mode: 'dark', accent: '#e8b4a0', accent2: '#c98d76', font: 'Poppins' },
    hero: {
      eyebrow: 'Handmade · small batch',
      headline: 'Body care made the slow way',
      sub: 'Oils, butters and washes blended by hand in small batches. Pick what you want, tell us the scent, and we will confirm price and delivery.',
      cta: 'Browse the shelf'
    },
    story: {
      title: 'Why we make it this way',
      body: 'Everything is mixed in small batches, so nothing sits on a shelf for a year losing whatever made it good. If you want something we do not list, ask — most of what we sell started as somebody asking.'
    },
    contact: { phone: '', email: 'hubsbabydoll@gmail.com', instagram: '', area: 'Local pickup, delivery and events' },
    categories: [
      { name: 'Body Oils', blurb: 'Light, fast-absorbing, scented properly.' },
      { name: 'Body Butter', blurb: 'Shea, mango and coco butters whipped soft.' },
      { name: 'Wash & Beard', blurb: 'For the shower and the face.' }
    ],
    products: [
      { cat: 'Body Oils',    name: 'Body Oil',        variant: 'Lavender Rose',      blurb: 'Jojoba, sweet almond and flaxseed oils with Vitamin E.', sizes: [{ l: '4 oz', p: 12 }, { l: '8 oz', p: 22 }], img: '' },
      { cat: 'Body Oils',    name: 'Body Oil',        variant: 'Jasmine & Gardenia', blurb: 'The same base, warmer finish. Our best seller.',        sizes: [{ l: '4 oz', p: 12 }, { l: '8 oz', p: 22 }], img: '' },
      { cat: 'Body Butter',  name: 'Body Butter',     variant: 'Chocolate',          blurb: 'Shea, mango and coco butters with a warm chocolate note.', sizes: [{ l: '4 oz', p: 10 }, { l: '8 oz', p: 20 }], img: '' },
      { cat: 'Body Butter',  name: 'Body Butter',     variant: 'Peppermint',         blurb: 'Cool, clean, awake. Good for tired feet.',                sizes: [{ l: '4 oz', p: 10 }, { l: '8 oz', p: 20 }], img: '' },
      { cat: 'Wash & Beard', name: 'Body Wash',       variant: 'Lavender Rose',      blurb: 'Gentle enough for every day.',                            sizes: [{ l: '8 oz', p: null }], img: '' },
      { cat: 'Wash & Beard', name: 'Beard Conditioner', variant: 'Bay Rum',          blurb: 'Argan, jojoba and pumpkin seed oils.',                    sizes: [{ l: '4 oz', p: null }], img: '' }
    ]
  };

  var FONTS = {
    Poppins:   { css: 'Poppins:wght@600;700;800;900', stack: "Poppins, Inter, system-ui, sans-serif" },
    Playfair:  { css: 'Playfair+Display:wght@600;700;800;900', stack: "'Playfair Display', Georgia, serif" },
    Fraunces:  { css: 'Fraunces:opsz,wght@9..144,600;9..144,800', stack: "Fraunces, Georgia, serif" },
    Bebas:     { css: 'Bebas+Neue', stack: "'Bebas Neue', Impact, sans-serif" },
    Inter:     { css: 'Inter:wght@700;800;900', stack: "Inter, system-ui, sans-serif" }
  };

  function palette(cfg) {
    var dark = (cfg.theme && cfg.theme.mode) !== 'light';
    return dark
      ? { bg: '#0b0a0d', panel: 'rgba(255,255,255,.045)', line: 'rgba(255,255,255,.10)',
          text: '#f6f3f1', muted: '#a9a3ad', card: 'linear-gradient(165deg,rgba(255,255,255,.055),rgba(255,255,255,.015))', ink: '#1a1418' }
      : { bg: '#fbf8f5', panel: 'rgba(0,0,0,.025)', line: 'rgba(0,0,0,.10)',
          text: '#1b1618', muted: '#6d6469', card: 'linear-gradient(165deg,#ffffff,#f6f1ec)', ink: '#ffffff' };
  }

  /* ------------------------------------------------------------------ render */
  function render(cfg) {
    cfg = cfg || DEMO;
    var slug = slugify(cfg.slug || cfg.brand && cfg.brand.name) || 'shop';
    var b = cfg.brand || {}, th = cfg.theme || {}, hero = cfg.hero || {}, story = cfg.story || {}, ct = cfg.contact || {};
    var pal = palette(cfg);
    var font = FONTS[th.font] || FONTS.Poppins;
    var accent = th.accent || '#e8b4a0', accent2 = th.accent2 || accent;
    var cats = (cfg.categories || []).filter(function (c) { return c && c.name; });
    var products = (cfg.products || []).filter(function (p) { return p && p.name; });

    /* Categories with nothing in them render as an empty shelf, which reads as
       a broken site rather than a small one. */
    var liveCats = cats.filter(function (c) {
      return products.some(function (p) { return p.cat === c.name; });
    });

    var title = (b.name || 'Shop') + (b.tagline ? ' — ' + b.tagline : '');

    var head =
      '<!doctype html>\n<html lang="en">\n<head>\n' +
      '<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
      '<title>' + esc(title) + '</title>\n' +
      '<meta name="description" content="' + esc(hero.sub || b.tagline || '') + '">\n' +
      '<meta name="theme-color" content="' + esc(pal.bg) + '">\n' +
      '<meta property="og:title" content="' + esc(title) + '">\n' +
      '<meta property="og:description" content="' + esc(hero.sub || '') + '">\n' +
      '<meta property="og:type" content="website">\n' +
      '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
      /* Non-blocking, and not out of fussiness: a stylesheet still in flight
         blocks execution of the inline script below it, so a slow or blocked
         fonts request means a customer sees empty shelves and an order form
         with no products in it. Some networks block Google Fonts outright.
         The store must render without it. */
      '<link href="https://fonts.googleapis.com/css2?family=' + font.css + '&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" media="print" onload="this.media=\'all\'">\n' +
      '<noscript><link href="https://fonts.googleapis.com/css2?family=' + font.css + '&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"></noscript>\n' +
      '<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 64 64\'%3E%3Crect width=\'64\' height=\'64\' rx=\'14\' fill=\'' +
        encodeURIComponent(accent) + '\'/%3E%3C/svg%3E">\n';

    var css =
      '<style>\n' +
      ':root{--bg:' + pal.bg + ';--line:' + pal.line + ';--text:' + pal.text + ';--muted:' + pal.muted + ';' +
      '--acc:' + accent + ';--acc2:' + accent2 + ';--card:' + pal.card + ';--ink:' + pal.ink + '}\n' +
      '*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:Inter,system-ui,sans-serif;line-height:1.65}\n' +
      'h1,h2,h3{font-family:' + font.stack + ';margin:0;letter-spacing:-.02em;text-wrap:balance}\n' +
      'a{color:var(--acc);text-decoration:none}img{max-width:100%;display:block}\n' +
      '.wrap{max-width:1080px;margin:0 auto;padding:0 20px}\n' +
      'nav{position:sticky;top:0;z-index:30;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(12px);border-bottom:1px solid var(--line)}\n' +
      'nav .wrap{display:flex;align-items:center;justify-content:space-between;height:62px;gap:14px}\n' +
      '.logo{font-family:' + font.stack + ';font-weight:900;font-size:18px;display:flex;align-items:center;gap:9px}\n' +
      '.seal{width:30px;height:30px;border-radius:9px;background:linear-gradient(135deg,var(--acc),var(--acc2));color:var(--ink);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900}\n' +
      '.navlinks{display:flex;gap:16px;font-size:14px}.navlinks a{color:var(--muted)}\n' +
      '@media(max-width:640px){.navlinks{display:none}}\n' +
      '.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:0;cursor:pointer;font:inherit;font-weight:800;font-size:15px;\n' +
      '  border-radius:999px;padding:13px 24px;background:linear-gradient(135deg,var(--acc),var(--acc2));color:var(--ink);transition:transform .15s}\n' +
      '.btn:hover{transform:translateY(-2px)}.btn.wide{width:100%}.btn.sm{padding:9px 16px;font-size:13.5px}\n' +
      '.btn.ghost{background:transparent;border:1px solid var(--line);color:var(--text)}\n' +
      'header.hero{padding:74px 0 54px;text-align:center}\n' +
      '.eyebrow{font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:var(--acc)}\n' +
      'h1{font-size:clamp(34px,7vw,62px);font-weight:900;line-height:1.03;margin:16px auto 0;max-width:16ch}\n' +
      '.lede{color:var(--muted);font-size:clamp(16px,2.2vw,19px);max-width:56ch;margin:18px auto 26px}\n' +
      'section{padding:52px 0}\n' +
      '.sechead{margin-bottom:26px}.sechead h2{font-size:clamp(24px,4vw,34px);font-weight:900}\n' +
      '.sechead p{color:var(--muted);margin:6px 0 0;font-size:15.5px}\n' +
      '.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}\n' +
      '@media(max-width:900px){.grid{grid-template-columns:repeat(2,1fr)}}\n' +
      '@media(max-width:560px){.grid{grid-template-columns:1fr}}\n' +
      '.card{border:1px solid var(--line);border-radius:18px;overflow:hidden;background:var(--card);display:flex;flex-direction:column;transition:transform .18s,border-color .18s}\n' +
      '.card:hover{transform:translateY(-3px);border-color:var(--acc)}\n' +
      '.ph{aspect-ratio:4/3;background:linear-gradient(150deg,color-mix(in srgb,var(--acc) 26%,transparent),transparent);display:flex;align-items:center;justify-content:center}\n' +
      '.ph img{width:100%;height:100%;object-fit:cover}\n' +
      '.ph .big{font-family:' + font.stack + ';font-weight:900;font-size:30px;opacity:.75}\n' +
      '.card .body{padding:16px 17px 18px;flex:1;display:flex;flex-direction:column}\n' +
      '.card h3{font-size:17.5px}.card .variant{color:var(--acc);font-size:13.5px;font-weight:700;margin-top:2px}\n' +
      '.card p{color:var(--muted);font-size:14px;margin:8px 0 0;flex:1}\n' +
      '.foot{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:14px}\n' +
      '.price{font-weight:900;font-size:17px}.price small{display:block;color:var(--muted);font-weight:600;font-size:11.5px}\n' +
      '.ask{color:var(--muted);font-size:13.5px;font-weight:700}\n' +
      '.story{border:1px solid var(--line);border-radius:22px;padding:34px;background:var(--card)}\n' +
      '.story h2{font-size:clamp(22px,3.6vw,30px);font-weight:900;margin-bottom:10px}\n' +
      '.story p{color:var(--muted);font-size:16px;margin:0;max-width:62ch}\n' +
      '.order{max-width:560px;margin:0 auto;border:1px solid var(--line);border-radius:22px;padding:26px;background:var(--card)}\n' +
      'label{display:block;font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:14px 0 6px}\n' +
      'input,select,textarea{width:100%;border:1px solid var(--line);border-radius:12px;background:color-mix(in srgb,var(--bg) 60%,transparent);color:var(--text);padding:13px 14px;font:inherit;font-size:16px}\n' +
      'input:focus,select:focus,textarea:focus{outline:0;border-color:var(--acc)}\n' +
      'textarea{min-height:82px;resize:vertical}\n' +
      '.two{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:520px){.two{grid-template-columns:1fr}}\n' +
      '.quote{border:1px dashed var(--line);border-radius:12px;padding:12px 14px;margin-top:16px;color:var(--muted);font-size:14.5px}\n' +
      '.quote b{color:var(--text)}\n' +
      '.err{color:#ff8080;font-size:14px;margin-top:10px;min-height:18px}\n' +
      '.done{text-align:center;padding:22px 0}.done .tick{font-size:40px}\n' +
      '.hide{display:none}\n' +
      'footer{border-top:1px solid var(--line);padding:30px 0;color:var(--muted);font-size:13.5px;text-align:center}\n' +
      '.contactrow{display:flex;gap:16px;flex-wrap:wrap;justify-content:center;margin-bottom:10px}\n' +
      '</style>\n</head>\n';

    var nav =
      '<body>\n<nav><div class="wrap">\n' +
      '<div class="logo"><span class="seal">' + esc(b.initials || (b.name || 'S').slice(0, 2).toUpperCase()) + '</span>' + esc(b.name || 'Shop') + '</div>\n' +
      '<div class="navlinks">' + liveCats.map(function (c) {
        return '<a href="#cat-' + slugify(c.name) + '">' + esc(c.name) + '</a>';
      }).join('') + '<a href="#order">Order</a></div>\n' +
      '<a class="btn sm" href="#order">Order</a>\n' +
      '</div></nav>\n';

    var heroHtml =
      '<header class="hero"><div class="wrap">\n' +
      (hero.eyebrow ? '<div class="eyebrow">' + esc(hero.eyebrow) + '</div>\n' : '') +
      '<h1>' + esc(hero.headline || b.name || 'Shop') + '</h1>\n' +
      (hero.sub ? '<p class="lede">' + esc(hero.sub) + '</p>\n' : '') +
      '<a class="btn" href="#' + (liveCats[0] ? 'cat-' + slugify(liveCats[0].name) : 'order') + '">' + esc(hero.cta || 'See what we make') + '</a>\n' +
      '</div></header>\n';

    var shelves = liveCats.map(function (c) {
      return '<section id="cat-' + slugify(c.name) + '"><div class="wrap">\n' +
        '<div class="sechead"><h2>' + esc(c.name) + '</h2>' +
        (c.blurb ? '<p>' + esc(c.blurb) + '</p>' : '') + '</div>\n' +
        '<div class="grid" data-cat="' + esc(c.name) + '"></div>\n</div></section>\n';
    }).join('');

    var storyHtml = (story.title || story.body)
      ? '<section><div class="wrap"><div class="story">\n' +
        (story.title ? '<h2>' + esc(story.title) + '</h2>\n' : '') +
        (story.body ? '<p>' + esc(story.body) + '</p>\n' : '') +
        '</div></div></section>\n'
      : '';

    var orderHtml =
      '<section id="order"><div class="wrap">\n' +
      '<div class="sechead" style="text-align:center"><h2>Place an order</h2>' +
      '<p>Pick what you want and we will confirm price, availability and delivery. It is a request, not a checkout.</p></div>\n' +
      '<div class="order">\n<div id="formInner">\n' +
      '<label for="inProduct">Product</label><select id="inProduct"></select>\n' +
      '<label for="inSize">Size</label><select id="inSize"></select>\n' +
      '<div class="two"><div><label for="inQty">Quantity</label><input id="inQty" type="number" min="1" max="99" value="1" inputmode="numeric"></div>' +
      '<div><label for="inName">Your name</label><input id="inName" autocomplete="name" placeholder="First and last"></div></div>\n' +
      '<div class="two"><div><label for="inPhone">Mobile</label><input id="inPhone" type="tel" inputmode="tel" autocomplete="tel" placeholder="(555) 123-4567"></div>' +
      '<div><label for="inEmail">Email <span style="text-transform:none;font-weight:600">(optional)</span></label><input id="inEmail" type="email" inputmode="email" autocomplete="email" placeholder="you@email.com"></div></div>\n' +
      '<label for="inNotes">Anything we should know?</label><textarea id="inNotes" placeholder="Scent preference, delivery, event date…"></textarea>\n' +
      '<input type="text" id="inHoney" style="display:none" tabindex="-1" autocomplete="off" aria-hidden="true">\n' +
      '<div class="quote" id="quote">Your selection will appear here.</div>\n' +
      '<button class="btn wide" id="orderBtn" style="margin-top:16px">Send my order request</button>\n' +
      '<div class="err" id="err"></div>\n</div>\n' +
      '<div id="done" class="hide done"><div class="tick">✅</div><h3 style="margin:8px 0 6px">Order request sent</h3>' +
      '<p style="color:var(--muted);margin:0" id="doneMsg"></p></div>\n' +
      '</div></div></section>\n';

    var contactBits = [];
    if (ct.phone) contactBits.push('<a href="tel:' + esc(String(ct.phone).replace(/[^0-9+]/g, '')) + '">' + esc(ct.phone) + '</a>');
    if (ct.email) contactBits.push('<a href="mailto:' + esc(ct.email) + '">' + esc(ct.email) + '</a>');
    if (ct.instagram) contactBits.push('<a href="https://instagram.com/' + esc(String(ct.instagram).replace(/^@/, '')) + '" target="_blank" rel="noopener">@' + esc(String(ct.instagram).replace(/^@/, '')) + '</a>');

    var footer =
      '<footer><div class="wrap">\n' +
      (contactBits.length ? '<div class="contactrow">' + contactBits.join('') + '</div>\n' : '') +
      (ct.area ? '<div>' + esc(ct.area) + '</div>\n' : '') +
      '<div style="margin-top:8px">© <span id="yr"></span> ' + esc(b.name || 'Shop') + '</div>\n' +
      '</div></footer>\n';

    /* The runtime. Kept deliberately small and dependency-free: this file has
       to still work in three years on a host nobody is maintaining. */
    var script =
      '<script>\n' +
      '(function(){\n' +
      'var CFG=' + embed({ slug: slug, products: products, brand: { name: b.name || 'Shop' }, contact: { email: ct.email || '' } }) + ';\n' +
      'var SUPA=' + JSON.stringify(SUPA_URL) + ',KEY=' + JSON.stringify(SUPA_KEY) + ';\n' +
      'function el(i){return document.getElementById(i)}\n' +
      'function esc(s){return String(s==null?"":s).replace(/[&<>"\']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","\'":"&#39;"}[c]})}\n' +
      'document.getElementById("yr").textContent=new Date().getFullYear();\n' +
      'CFG.products.forEach(function(p,i){p._i=i;});\n' +
      'function priced(p){return (p.sizes||[]).filter(function(s){return s.p!=null&&s.p!==""});}\n' +
      'function priceLine(p){var h=priced(p);\n' +
      '  if(!h.length) return \'<div class="ask">Price on request</div>\';\n' +
      '  if(h.length===1) return \'<div class="price">$\'+h[0].p+\'<small>\'+esc(h[0].l||"")+\'</small></div>\';\n' +
      '  return \'<div class="price">$\'+h[0].p+\'–$\'+h[h.length-1].p+\'<small>\'+esc(h.map(function(s){return s.l}).join(" · "))+\'</small></div>\';}\n' +
      'function card(p){\n' +
      '  var ph=p.img?\'<div class="ph"><img src="\'+esc(p.img)+\'" alt="\'+esc(p.name)+\'" loading="lazy"></div>\'\n' +
      '    :\'<div class="ph"><span class="big">\'+esc((p.name||"?").slice(0,1).toUpperCase())+\'</span></div>\';\n' +
      '  return ph+\'<div class="body"><h3>\'+esc(p.name)+\'</h3>\'+(p.variant?\'<div class="variant">\'+esc(p.variant)+\'</div>\':"")+\n' +
      '    (p.blurb?\'<p>\'+esc(p.blurb)+\'</p>\':"")+\'<div class="foot">\'+priceLine(p)+\n' +
      '    \'<button class="btn sm" data-pick="\'+p._i+\'">Order</button></div></div>\';}\n' +
      'CFG.products.forEach(function(p){\n' +
      '  var g=document.querySelector(\'[data-cat="\'+String(p.cat||"").replace(/"/g,"")+\'"]\'); if(!g) return;\n' +
      '  var a=document.createElement("article"); a.className="card"; a.innerHTML=card(p); g.appendChild(a);});\n' +
      'var sel=el("inProduct"), sizeSel=el("inSize");\n' +
      'CFG.products.forEach(function(p){var o=document.createElement("option");o.value=String(p._i);\n' +
      '  o.textContent=p.name+(p.variant?" — "+p.variant:"");sel.appendChild(o);});\n' +
      'var other=document.createElement("option");other.value="";other.textContent="Something else / custom";sel.appendChild(other);\n' +
      'function sizes(){var p=CFG.products[sel.value];sizeSel.innerHTML="";\n' +
      '  var list=(p&&p.sizes&&p.sizes.length)?p.sizes:[{l:"Tell us in notes",p:null}];\n' +
      '  list.forEach(function(s,i){var o=document.createElement("option");o.value=String(i);o.textContent=s.l+(s.p!=null&&s.p!==""?" — $"+s.p:"");sizeSel.appendChild(o);});\n' +
      '  quote();}\n' +
      'function quote(){var p=CFG.products[sel.value],q=Math.max(1,parseInt(el("inQty").value,10)||1);\n' +
      '  if(!p){el("quote").innerHTML="<b>Custom request</b> — tell us what you want in the notes.";return;}\n' +
      '  var s=(p.sizes||[])[parseInt(sizeSel.value,10)]||{l:"",p:null};\n' +
      '  var line=esc(p.name)+(p.variant?" — "+esc(p.variant):"")+" · "+esc(s.l||"");\n' +
      '  el("quote").innerHTML="<b>"+line+"</b><br>"+(s.p!=null&&s.p!==""?("$"+s.p+" each · estimated $"+(s.p*q)):"Price confirmed by the shop");}\n' +
      'sel.addEventListener("change",sizes);sizeSel.addEventListener("change",quote);el("inQty").addEventListener("input",quote);\n' +
      'sizes();\n' +
      'document.addEventListener("click",function(ev){var b=ev.target.closest?ev.target.closest("[data-pick]"):null;if(!b)return;\n' +
      '  sel.value=b.getAttribute("data-pick");sizes();document.getElementById("order").scrollIntoView({behavior:"smooth"});});\n' +
      'el("orderBtn").addEventListener("click",function(){\n' +
      '  var e=el("err");e.textContent="";\n' +
      '  if(el("inHoney").value) return;\n' +
      '  var name=(el("inName").value||"").trim(),phone=(el("inPhone").value||"").trim(),email=(el("inEmail").value||"").trim();\n' +
      '  var notes=(el("inNotes").value||"").trim(),q=Math.max(1,parseInt(el("inQty").value,10)||1);\n' +
      '  if(name.length<2){e.textContent="Please enter your name.";el("inName").focus();return;}\n' +
      '  if(phone.replace(/\\D/g,"").length<10){e.textContent="Enter a mobile we can reach you on.";el("inPhone").focus();return;}\n' +
      '  var p=CFG.products[sel.value],s=p?((p.sizes||[])[parseInt(sizeSel.value,10)]||{l:"",p:null}):{l:"",p:null};\n' +
      '  var item=p?(p.name+(p.variant?" — "+p.variant:"")):"Custom request";\n' +
      '  var svc=item+(s.l?" · "+s.l:"");\n' +
      '  var msg="Order request\\nItem: "+item+"\\nSize: "+(s.l||"—")+"\\nQty: "+q+"\\nPrice: "+((s.p!=null&&s.p!=="")?("$"+s.p+" ea · est. $"+(s.p*q)):"by request")+(notes?("\\nNotes: "+notes):"");\n' +
      '  var btn=el("orderBtn");btn.disabled=true;btn.textContent="Sending…";\n' +
      '  fetch(SUPA+"/rest/v1/client_leads",{method:"POST",headers:{apikey:KEY,Authorization:"Bearer "+KEY,"Content-Type":"application/json",Prefer:"return=minimal"},\n' +
      '    body:JSON.stringify({client:CFG.slug,kind:"order",name:name,phone:phone,email:email,service:svc,message:msg})})\n' +
      '  .then(function(r){if(!r.ok)throw 0;\n' +
      '    el("formInner").classList.add("hide");el("done").classList.remove("hide");\n' +
      '    el("doneMsg").textContent=name.split(/\\s+/)[0]+", we have your "+item+" request — we will be in touch to confirm.";\n' +
      '    document.getElementById("order").scrollIntoView({behavior:"smooth"});})\n' +
      '  .catch(function(){btn.disabled=false;btn.textContent="Send my order request";\n' +
      '    e.textContent="Could not send just now — please try again"+(CFG.contact.email?(" or email "+CFG.contact.email):"")+".";});\n' +
      '});\n' +
      '})();\n' +
      '<\/script>\n</body>\n</html>';

    return head + css + nav + heroHtml + shelves + storyHtml + orderHtml + footer + script;
  }

  w.STOREFRONT = { render: render, DEMO: DEMO, FONTS: FONTS, slugify: slugify };
})(window);
