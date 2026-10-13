// rank-audit: the pure grading logic. No network in here, so it can be unit-tested with fixture HTML.
//
// Input: what the fetcher saw (the site's HTML + headers, the Google Places record, the top
// competitors, any duplicate listings). Output: one Result per playbook key. The SQL side
// (rank_audit_apply) decides what each Result does to the hq_project_items row.
//
// Wording rule for every `finding`: one plain line a plumber would say out loud. The client
// reads it on /audit/. No dashes as punctuation, no SEO words. `next_step` is private (HQ only).

export type Check = "pass" | "fail" | "manual" | "error";
export type Result = { key: string; check: Check; finding?: string; next_step?: string; evidence?: Record<string, unknown> };

export type Place = {
  id: string; displayName?: { text: string }; formattedAddress?: string; shortFormattedAddress?: string;
  nationalPhoneNumber?: string; internationalPhoneNumber?: string; rating?: number; userRatingCount?: number;
  websiteUri?: string; types?: string[]; primaryType?: string; primaryTypeDisplayName?: { text: string };
  regularOpeningHours?: { weekdayDescriptions?: string[] }; photos?: unknown[]; pureServiceAreaBusiness?: boolean;
  businessStatus?: string; googleMapsUri?: string;
};

export type SiteFetch = {
  url: string;                 // what we were given
  reachable: boolean; status: number; finalUrl: string; html: string; bytes: number;
  http_redirects_to_https: boolean | null;  // null = could not test
  redirect_hops: number;
  sitemap: boolean | null; robots: boolean | null; llms: boolean | null;
};

export type HtmlFacts = {
  viewport: boolean; title: string; meta_desc: string; h1: string[];
  schema_types: string[]; local_business: boolean; schema_name: string | null; schema_phone: string | null; schema_address: string | null;
  map_embed: boolean; tel_links: string[]; phones: string[]; has_form: boolean; booking_words: boolean;
  scripts_total: number; scripts_blocking: number; stylesheets: number;
  trust_links: string[]; hours_text: boolean; og_site_name: string | null;
};

// ---------- helpers ----------
export const digits = (s: string) => s.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
export function normPhone(s?: string | null): string | null { if (!s) return null; const d = digits(s); return d.length === 10 ? d : null; }
export const fmtPhone = (d: string) => `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
export function normName(s?: string | null) {
  return (s || "").toLowerCase().replace(/&/g, "and").replace(/\b(llc|inc|co|corp|ltd|company|the)\b\.?/g, " ").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}
const strip = (h: string) => h.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
const attr = (tag: string, name: string) => (tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i")) || [])[1] ?? null;
const unesc = (s: string) => s.replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");

const LOCAL_TYPES = /^(LocalBusiness|Plumber|HVACBusiness|Electrician|RoofingContractor|HomeAndConstructionBusiness|GeneralContractor|HousePainter|Locksmith|MovingCompany|ProfessionalService)$/;
const TRUST_HOSTS: [RegExp, string][] = [[/bbb\.org/i, "BBB"], [/chamber/i, "Chamber of Commerce"], [/angi\.com|angieslist/i, "Angi"], [/homeadvisor/i, "HomeAdvisor"], [/yelp\.com/i, "Yelp"], [/nextdoor/i, "Nextdoor"], [/houzz/i, "Houzz"], [/phccweb|phcc\./i, "PHCC"]];

// ---------- parse one HTML page ----------
export function analyzeHtml(html: string): HtmlFacts {
  const head = (html.match(/<head[\s\S]*?<\/head>/i) || [html])[0];
  const text = strip(html);
  const title = unesc((html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1]?.trim() || "");
  const metaTag = [...html.matchAll(/<meta\b[^>]*>/gi)].map(m => m[0]);
  const meta_desc = unesc(metaTag.filter(t => /name\s*=\s*["']description["']/i.test(t)).map(t => attr(t, "content") || "")[0] || "");
  const og_site_name = metaTag.filter(t => /property\s*=\s*["']og:site_name["']/i.test(t)).map(t => attr(t, "content"))[0] || null;
  const viewport = metaTag.some(t => /name\s*=\s*["']viewport["']/i.test(t) && /width\s*=\s*device-width/i.test(attr(t, "content") || ""));
  const h1 = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map(m => unesc(strip(m[1]).trim())).filter(Boolean);

  // schema.org
  const schema_types: string[] = []; let schema_name: string | null = null, schema_phone: string | null = null, schema_address: string | null = null;
  const walk = (n: unknown) => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) { n.forEach(walk); return; }
    const o = n as Record<string, unknown>;
    const t = o["@type"]; const ts = Array.isArray(t) ? t : t ? [t] : [];
    for (const x of ts) if (typeof x === "string") schema_types.push(x);
    if (ts.some(x => typeof x === "string" && LOCAL_TYPES.test(x))) {
      if (!schema_name && typeof o.name === "string") schema_name = o.name;
      if (!schema_phone && typeof o.telephone === "string") schema_phone = o.telephone;
      const a = o.address as Record<string, unknown> | string | undefined;
      if (!schema_address && a) schema_address = typeof a === "string" ? a : [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode].filter(Boolean).join(", ");
    }
    for (const k in o) if (k !== "@type") walk(o[k]);
  };
  for (const m of html.matchAll(/<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { walk(JSON.parse(m[1].trim())); } catch { /* broken JSON-LD counts as missing */ }
  }
  const local_business = schema_types.some(t => LOCAL_TYPES.test(t)) || /itemtype\s*=\s*["'][^"']*schema\.org\/(LocalBusiness|Plumber|HVACBusiness|Electrician)/i.test(html);

  const map_embed = /<iframe[^>]+src\s*=\s*["'][^"']*(google\.com\/maps|maps\.google|goo\.gl\/maps|maps\.app\.goo\.gl)/i.test(html);
  const tel_links = [...new Set([...html.matchAll(/href\s*=\s*["']tel:([^"']+)["']/gi)].map(m => normPhone(m[1])).filter((x): x is string => !!x))];
  const phones = [...new Set([...text.matchAll(/(?:\+?1[\s.-]?)?\(?\b([2-9]\d{2})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})\b/g)].map(m => m[1] + m[2] + m[3]).concat(tel_links))];
  const has_form = /<form\b/i.test(html) || /(typeform|jotform|calendly|housecall|jobber|servicetitan|acuity)/i.test(html);
  const booking_words = /(book (now|online|an? appointment)|schedule (now|online|service)|request (service|an? appointment|a quote|an estimate)|get a quote|free estimate)/i.test(text);

  const scripts = [...html.matchAll(/<script\b[^>]*>/gi)].map(m => m[0]);
  const scripts_total = scripts.filter(s => /\bsrc\s*=/i.test(s)).length;
  const scripts_blocking = [...head.matchAll(/<script\b[^>]*>/gi)].map(m => m[0]).filter(s => /\bsrc\s*=/i.test(s) && !/\b(async|defer)\b/i.test(s) && !/type\s*=\s*["']module["']/i.test(s)).length;
  const stylesheets = [...html.matchAll(/<link\b[^>]*rel\s*=\s*["']stylesheet["'][^>]*>/gi)].length;

  const trust_links = [...new Set([...html.matchAll(/href\s*=\s*["'](https?:\/\/[^"']+)["']/gi)].map(m => m[1]).flatMap(u => TRUST_HOSTS.filter(([re]) => re.test(u)).map(([, n]) => n)))];
  const hours_text = /(mon(day)?|tue|wed|thu|fri|sat(urday)?|sun(day)?)[^.]{0,40}\d{1,2}(:\d{2})?\s?(am|pm)/i.test(text) || /(24\/7|24 hours|open 24)/i.test(text);
  return { viewport, title, meta_desc, h1, schema_types: [...new Set(schema_types)], local_business, schema_name, schema_phone, schema_address, map_embed, tel_links, phones, has_form, booking_words, scripts_total, scripts_blocking, stylesheets, trust_links, hours_text, og_site_name };
}

// ---------- build the 17 results ----------
export type Input = {
  project: { name: string; website?: string | null; phone?: string | null; town?: string | null; trade?: string | null };
  site: SiteFetch | null;            // null = no website on the project and none on Google
  html: HtmlFacts | null;
  place: Place | null;               // null = not found on Google
  competitors: { name: string; reviews: number; rating: number | null }[];   // top 3 by review count, self excluded
  duplicates: { id: string; name: string; address?: string }[];           // other listings with this phone
};

const list = (xs: string[]) => xs.length <= 1 ? xs.join("") : xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1];
const n = (x: number, one: string, many = one + "s") => `${x} ${x === 1 ? one : many}`;
const tradeWords = (cat: string) => cat.toLowerCase().replace(/(contractor|service|company|repair|shop)/g, "").split(/[^a-z]+/).filter(w => w.length > 3).map(w => w.replace(/(ing|er|s)$/, ""));

export function buildResults(i: Input): Result[] {
  const R: Result[] = [];
  const p = i.place, s = i.site, h = i.html;
  const gName = p?.displayName?.text || i.project.name;
  const gPhone = normPhone(p?.nationalPhoneNumber || p?.internationalPhoneNumber);
  const siteUrl = s?.finalUrl || s?.url || i.project.website || p?.websiteUri || null;
  const siteHost = (() => { try { return siteUrl ? new URL(siteUrl).host.replace(/^www\./, "") : null; } catch { return null; } })();

  // --- Website ---
  if (!s) {
    const why = p ? "No website on the Google listing and none on file" : "No website on file";
    R.push({ key: "site", check: "fail", finding: `${why}. Every caller has to phone and hope somebody picks up.`, evidence: { website: null } });
    R.push({ key: "site_form", check: "fail", finding: "No website, so no way to send a quote request.", evidence: { website: null } });
    R.push({ key: "site_map", check: "fail", finding: "No website, so no map or business markup for Google to read.", evidence: { website: null } });
    R.push({ key: "site_index", check: "fail", finding: "No website, so nothing for Google to index.", evidence: { website: null } });
  } else if (!s.reachable || !h) {
    const f = s.status === 0 ? `${siteHost || "The website"} did not load at all` : `${siteHost || "The website"} came back with an error (${s.status})`;
    R.push({ key: "site", check: "fail", finding: `${f}. Google still sends people there.`, evidence: { url: s.url, status: s.status, final_url: s.finalUrl } });
    for (const k of ["site_form", "site_map", "site_index"]) R.push({ key: k, check: "fail", finding: "Could not check, the website did not load.", evidence: { status: s.status } });
  } else {
    const probs: string[] = [], ok: string[] = [];
    const https = /^https:/i.test(s.finalUrl);
    https ? ok.push("loads on https") : probs.push("no padlock (not https)");
    if (https && s.http_redirects_to_https === false) probs.push("the http:// address does not send people to https");
    if (s.redirect_hops >= 3) probs.push(`${s.redirect_hops} redirects before the page shows`);
    h.viewport ? ok.push("fits a phone screen") : probs.push("does not fit a phone screen (no viewport tag)");
    if (!h.title) probs.push("no page title"); else if (h.title.length < 15) probs.push(`page title is just "${h.title}"`); else ok.push("has a page title");
    if (!h.meta_desc) probs.push("no description tag for Google");
    if (h.h1.length === 0) probs.push("no main headline (H1)"); else if (h.h1.length > 1) probs.push(`${h.h1.length} main headlines, should be one`); else ok.push("one clear headline");
    h.tel_links.length ? ok.push("tap-to-call number") : probs.push("phone number is not tappable");
    const kb = Math.round(s.bytes / 1024);
    if (kb > 300 || h.scripts_blocking > 6) probs.push(`heavy page (${kb} KB, ${n(h.scripts_blocking, "script")} blocking it from showing)`); else ok.push("loads light");
    R.push({
      key: "site", check: probs.length ? "fail" : "pass",
      finding: probs.length ? `Website: ${list(probs)}.` : `Website looks solid: ${list(ok)}.`,
      next_step: probs.length ? "Fix on their site if we keep it, or build the Job-Ready Website." : undefined,
      evidence: { url: s.url, final_url: s.finalUrl, status: s.status, https, http_redirects_to_https: s.http_redirects_to_https, redirect_hops: s.redirect_hops, viewport: h.viewport, title: h.title, meta_desc: h.meta_desc.slice(0, 200), h1: h.h1, tel_links: h.tel_links, kb, scripts_total: h.scripts_total, scripts_blocking: h.scripts_blocking, stylesheets: h.stylesheets },
    });
    R.push({
      key: "site_form", check: h.has_form ? "pass" : "fail",
      finding: h.has_form ? "There is a form on the site a homeowner can send." : `No quote form on the site${h.booking_words ? ', it says "request a quote" but there is nothing to fill in' : ", it is call or nothing"}.`,
      evidence: { has_form: h.has_form, booking_words: h.booking_words },
    });
    const mp: string[] = [];
    if (!h.local_business) mp.push("no business markup (schema) for Google and AI search to read");
    if (!h.map_embed) mp.push("no Google map on the page");
    R.push({
      key: "site_map", check: mp.length ? "fail" : "pass",
      finding: mp.length ? `Site: ${list(mp)}.` : "Google map on the page and business markup in place.",
      evidence: { schema_types: h.schema_types, local_business: h.local_business, map_embed: h.map_embed, schema_name: h.schema_name, schema_phone: h.schema_phone },
    });
    const ix: string[] = [];
    if (s.sitemap === false) ix.push("no sitemap.xml"); if (s.robots === false) ix.push("no robots.txt");
    R.push({
      key: "site_index", check: ix.length ? "fail" : s.sitemap === null ? "manual" : "pass",
      finding: ix.length ? `Site: ${list(ix)}${s.llms === false ? ", no llms.txt either" : ""}.` : s.sitemap === null ? "Could not reach sitemap.xml or robots.txt to check." : `sitemap.xml and robots.txt are there${s.llms ? ", llms.txt too" : ""}.`,
      next_step: s.llms === false && !ix.length ? "Add llms.txt when we touch the site." : undefined,
      evidence: { sitemap: s.sitemap, robots: s.robots, llms: s.llms },
    });
  }

  // --- Brand (manual) ---
  R.push({ key: "logo", check: "manual", next_step: "Open the site and the Google photos. Is the logo clean and the same everywhere? Draw one if not.", evidence: { manual: true } });

  // --- Reviews ---
  if (!p) {
    R.push({ key: "reviews_count", check: "fail", finding: "Could not find the business on Google Maps at all.", next_step: "Search Google Maps by hand. If there is no listing, creating and verifying one is step one.", evidence: { place: null } });
  } else {
    const cnt = p.userRatingCount ?? 0, rating = p.rating ?? null;
    const top = i.competitors.slice(0, 3), avg = top.length ? Math.round(top.reduce((a, c) => a + c.reviews, 0) / top.length) : null;
    const low = cnt < 10 || (avg != null && cnt < avg * 0.5);
    const star = rating != null ? ` at ${Number(rating).toFixed(1).replace(/\.0$/, "")} stars` : "";
    R.push({
      key: "reviews_count", check: low ? "fail" : "pass",
      finding: `${n(cnt, "Google review")}${star}.${avg != null ? ` The top 3 shops nearby average ${avg}.` : ""}${cnt < 10 ? " Under 10 and the map pack skips you." : ""}`,
      evidence: { count: cnt, rating, competitors: top, competitor_avg: avg },
    });
  }
  R.push({ key: "reviews_camp", check: "manual", next_step: "Needs the owner's past-customer list (10+ names and cells). Then the banner-photo text goes out.", evidence: { manual: true } });
  R.push({ key: "reviews_reply", check: "manual", next_step: "Open the Google profile and count unanswered reviews. Google does not expose owner replies to us.", evidence: { manual: true, count: p?.userRatingCount ?? null } });

  // --- Listings ---
  {
    const probs: string[] = [];
    const sitePhones = h ? [...new Set([...h.tel_links, ...h.phones, ...(normPhone(h.schema_phone) ? [normPhone(h.schema_phone)!] : [])])] : [];
    const filePhone = normPhone(i.project.phone);
    if (p && !gPhone) probs.push("no phone number on the Google listing");
    if (h && sitePhones.length === 0) probs.push("no phone number anywhere on the website");
    if (gPhone && sitePhones.length && !sitePhones.includes(gPhone)) probs.push(`Google shows ${fmtPhone(gPhone)} but the website shows ${list(sitePhones.slice(0, 3).map(fmtPhone))}`);
    if (sitePhones.length >= 3) probs.push(`${sitePhones.length} different numbers on the website`);
    if (i.duplicates.length) probs.push(`${n(i.duplicates.length, "other Google listing")} with the same phone (${list(i.duplicates.slice(0, 2).map(d => d.name))})`);
    const addrNo = (p?.formattedAddress || "").match(/^\s*(\d+[A-Za-z]?)\s/)?.[1];
    if (addrNo && h && h.schema_address && !h.schema_address.includes(addrNo)) probs.push("the address in the site markup does not match Google");
    R.push({
      key: "nap", check: !p && !h ? "manual" : probs.length ? "fail" : "pass",
      finding: !p && !h ? undefined : probs.length ? `Phone and address: ${list(probs)}.` : `One phone number${gPhone ? ` (${fmtPhone(gPhone)})` : ""} on Google and the website, no other listings using it.`,
      next_step: "Still check Yelp, Apple Maps, Facebook and BBB by hand. Google and the site are the only two we can read.",
      evidence: { google_phone: gPhone, site_phones: sitePhones, file_phone: filePhone, duplicates: i.duplicates, google_address: p?.formattedAddress ?? null, schema_address: h?.schema_address ?? null },
    });
  }
  {
    const g = normName(gName);
    const siteNames = h ? [h.schema_name, h.og_site_name, h.title].filter((x): x is string => !!x) : [];
    const hit = siteNames.some(x => normName(x).includes(g) || (g.length > 6 && g.includes(normName(x)) && normName(x).length > 4));
    R.push({
      key: "nap_name", check: !p ? "manual" : !h ? "manual" : hit ? "pass" : "fail",
      finding: !p || !h ? undefined : hit ? `Google and the website both say "${gName}".` : `Google says "${gName}" but the website calls itself "${(h.schema_name || h.og_site_name || h.title).slice(0, 60)}".`,
      next_step: "Match the spelling on Yelp, Apple, Facebook and BBB to the Google one.",
      evidence: { google_name: gName, site_names: siteNames },
    });
  }
  {
    const addr = p?.formattedAddress || "";
    const homey = /\b(apt|apartment|unit|#)\s*[\w-]+/i.test(addr);
    R.push({
      key: "address", check: !p ? "manual" : p.pureServiceAreaBusiness ? "pass" : homey ? "fail" : "manual",
      finding: !p ? undefined : p.pureServiceAreaBusiness ? "Set up as a service-area business, address hidden. Good." : homey ? `Google shows a street address that looks like a home (${addr}).` : `Google shows the address ${addr}.`,
      next_step: p && !p.pureServiceAreaBusiness && !homey ? "Ask: is that a shop or a house? If a house, hide it (service-area business)." : undefined,
      evidence: { address: addr || null, service_area_business: p?.pureServiceAreaBusiness ?? null },
    });
  }
  {
    const hrs = p?.regularOpeningHours?.weekdayDescriptions || [];
    const open24 = hrs.length > 0 && hrs.every(x => /open 24 hours/i.test(x));
    R.push({
      key: "hours", check: !p ? "manual" : hrs.length ? "manual" : "fail",
      finding: !p ? undefined : hrs.length ? `Google lists hours${open24 ? " (open 24 hours)" : ` (${hrs[0].replace(/\s*[–—-]\s*/g, " to ")}${/closed/i.test(hrs.find(x => /^sat/i.test(x)) || "") ? ", closed Saturday" : ""})`}.${h && !h.hours_text ? " The website shows no hours." : ""}` : "No hours on the Google listing, so people cannot tell if you are open.",
      next_step: hrs.length ? "Match Yelp, Facebook and Apple to the Google hours. Confirm 24 hours is real if it says so." : "Get the real hours from the owner and set them on Google first.",
      evidence: { google_hours: hrs, open_24h: open24, site_mentions_hours: h?.hours_text ?? null },
    });
  }
  R.push({ key: "apple", check: "manual", next_step: `Search Apple Maps for "${gName}${i.project.town ? " " + i.project.town : ""}". Claim or fix at businessconnect.apple.com. Apple has no free lookup we can run.`, evidence: { manual: true } });
  R.push({
    key: "trust", check: "manual",
    finding: h && h.trust_links.length ? `Site already links to ${list(h.trust_links)}.` : undefined,
    next_step: `Check BBB, the local Chamber and supplier directories for a listing.${h && h.trust_links.length ? ` Site links to ${list(h.trust_links)} already.` : h ? " The site links to none of them." : ""}`,
    evidence: { site_trust_links: h?.trust_links ?? [] },
  });

  // --- Google profile ---
  if (!p) {
    R.push({ key: "gbp_about", check: "fail", finding: "No Google Business Profile found.", evidence: { place: null } });
    R.push({ key: "gbp_cat", check: "fail", finding: "No Google Business Profile found.", evidence: { place: null } });
  } else {
    const photos = p.photos?.length ?? 0;
    const miss: string[] = [];
    if (photos < 3) miss.push(photos === 0 ? "no photos" : `only ${n(photos, "photo")}`);
    if (!p.websiteUri) miss.push("no website link");
    if (!gPhone) miss.push("no phone");
    if (!p.regularOpeningHours?.weekdayDescriptions?.length) miss.push("no hours");
    if (p.businessStatus && p.businessStatus !== "OPERATIONAL") miss.push(`marked ${p.businessStatus.toLowerCase().replace(/_/g, " ")}`);
    R.push({
      key: "gbp_about", check: miss.length ? "fail" : "manual",
      finding: miss.length ? `Google profile: ${list(miss)}.` : `Google profile has ${n(photos >= 10 ? 10 : photos, "photo")}${photos >= 10 ? "+" : ""}, phone, website and hours.`,
      next_step: "About text, services list and attributes need the owner's Google login to check and fill.",
      evidence: { photos, website: p.websiteUri ?? null, phone: gPhone, hours: !!p.regularOpeningHours?.weekdayDescriptions?.length, business_status: p.businessStatus ?? null, types: p.types ?? [] },
    });
    const cat = p.primaryTypeDisplayName?.text || p.primaryType || "";
    const words = tradeWords(cat);
    const hay = h ? (h.title + " " + h.h1.join(" ")).toLowerCase() : "";
    const match = !!h && words.length > 0 && words.some(w => hay.includes(w));
    R.push({
      key: "gbp_cat", check: !cat ? "manual" : !h ? "manual" : match ? "pass" : "fail",
      finding: !cat ? "Google shows no category on the listing." : !h ? `Google category is "${cat}". No website to match it to.` : match ? `Google category "${cat}" matches the site headline.` : `Google category is "${cat}" but the site headline says "${(h.h1[0] || h.title).slice(0, 60)}".`,
      next_step: "Services on the profile should mirror the site's service pages.",
      evidence: { category: cat, types: p.types ?? [], site_title: h?.title ?? null, site_h1: h?.h1 ?? [] },
    });
  }
  R.push({ key: "gbp_heat", check: "manual", next_step: "Run the map-pack heatmap (Local Falcon or similar) before any fix goes in, save the screenshot, re-run after.", evidence: { manual: true } });

  return R;
}

// Pick the Google listing that is really this business from a text search.
export function pickPlace(cands: Place[], proj: { name: string; phone?: string | null; website?: string | null }): Place | null {
  if (!cands.length) return null;
  const ph = normPhone(proj.phone), nm = normName(proj.name);
  let host: string | null = null; try { host = proj.website ? new URL(/^https?:/i.test(proj.website) ? proj.website : "https://" + proj.website).host.replace(/^www\./, "") : null; } catch { /* ignore */ }
  const scored = cands.map(c => {
    let sc = 0;
    if (ph && normPhone(c.nationalPhoneNumber || c.internationalPhoneNumber) === ph) sc += 5;
    if (host && c.websiteUri && c.websiteUri.replace(/^https?:\/\/(www\.)?/, "").split("/")[0] === host) sc += 4;
    const cn = normName(c.displayName?.text); if (cn && (cn === nm || cn.includes(nm) || nm.includes(cn))) sc += 3;
    return { c, sc };
  }).sort((a, b) => b.sc - a.sc);
  return scored[0].sc >= 3 ? scored[0].c : null;
}

// A place id pasted into gbp_url (…?place_id=ChIJ… or a Places URL) or stored on the project.
export function placeIdFrom(s?: string | null) {
  if (!s) return null;
  const m = s.match(/\b(ChIJ[A-Za-z0-9_-]{10,}|GhIJ[A-Za-z0-9_-]{10,})/);
  return m ? m[1] : null;
}
