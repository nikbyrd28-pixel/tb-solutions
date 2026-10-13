// Fixture tests for the graders. Run from this folder or the repo root:
//   deno test hq/supabase/functions/rank-audit/test/
// No network: checks.ts is pure, the fixtures are two HTML pages (one good plumber site, one bad one).

import { assert, assertEquals, assertMatch, assertStringIncludes } from "jsr:@std/assert@1";
import { analyzeHtml, buildResults, normName, normPhone, pickPlace, placeIdFrom, type Input, type Place, type Result, type SiteFetch } from "../checks.ts";

const read = (f: string) => Deno.readTextFileSync(new URL(`./fixtures/${f}`, import.meta.url));
const GOOD = read("good.html"), BAD = read("bad.html");
const byKey = (rs: Result[]) => Object.fromEntries(rs.map(r => [r.key, r]));
const PLAYBOOK = ["logo", "site", "site_form", "site_map", "site_index", "reviews_count", "reviews_camp", "reviews_reply", "nap", "nap_name", "address", "hours", "apple", "trust", "gbp_about", "gbp_cat", "gbp_heat"];

const site = (html: string, over: Partial<SiteFetch> = {}): SiteFetch => ({
  url: "https://keystoneplumbing.example", reachable: true, status: 200, finalUrl: "https://keystoneplumbing.example/", html, bytes: html.length,
  http_redirects_to_https: true, redirect_hops: 1, sitemap: true, robots: true, llms: true, ...over,
});
const goodPlace: Place = {
  id: "ChIJgood", displayName: { text: "Keystone Plumbing" }, formattedAddress: "120 Bridge St, Phoenixville, PA 19460, USA",
  nationalPhoneNumber: "(610) 555-0142", rating: 4.9, userRatingCount: 48, websiteUri: "https://keystoneplumbing.example",
  primaryType: "plumber", primaryTypeDisplayName: { text: "Plumber" }, businessStatus: "OPERATIONAL",
  regularOpeningHours: { weekdayDescriptions: ["Monday: 7:00 AM – 6:00 PM", "Tuesday: 7:00 AM – 6:00 PM", "Wednesday: 7:00 AM – 6:00 PM", "Thursday: 7:00 AM – 6:00 PM", "Friday: 7:00 AM – 6:00 PM", "Saturday: Closed", "Sunday: Closed"] },
  photos: new Array(12).fill({}),
};
const badPlace: Place = {
  id: "ChIJbad", displayName: { text: "Mike's Plumbing & Heating LLC" }, formattedAddress: "44 Elm St Apt 4, Pottstown, PA 19464, USA",
  nationalPhoneNumber: "(610) 555-0123", rating: 3.8, userRatingCount: 4, primaryType: "hvac_contractor", primaryTypeDisplayName: { text: "HVAC contractor" },
  businessStatus: "OPERATIONAL", photos: [],
};
const competitors = [{ name: "A", reviews: 40, rating: 4.8 }, { name: "B", reviews: 30, rating: 4.7 }, { name: "C", reviews: 20, rating: 4.6 }];

// ---------- analyzeHtml ----------
Deno.test("good page: every on-page fact is read", () => {
  const h = analyzeHtml(GOOD);
  assert(h.viewport);
  assertEquals(h.title, "Keystone Plumbing | Plumber in Phoenixville, PA");
  assertStringIncludes(h.meta_desc, "Licensed plumber");
  assertEquals(h.h1, ["Plumber in Phoenixville, PA"]);
  assert(h.local_business); assert(h.schema_types.includes("Plumber"));
  assertEquals(h.schema_name, "Keystone Plumbing"); assertEquals(normPhone(h.schema_phone), "6105550142");
  assertStringIncludes(h.schema_address!, "120 Bridge St");
  assert(h.map_embed); assertEquals(h.tel_links, ["6105550142"]); assert(h.phones.includes("6105550142"));
  assert(h.has_form); assert(h.booking_words); assert(h.hours_text);
  assertEquals(h.scripts_blocking, 0); assertEquals(h.scripts_total, 1); assertEquals(h.stylesheets, 1);
  assertEquals(h.trust_links, ["BBB"]); assertEquals(h.og_site_name, "Keystone Plumbing");
});

Deno.test("bad page: missing tags, broken JSON-LD, blocking scripts, three phone numbers", () => {
  const h = analyzeHtml(BAD);
  assert(!h.viewport); assertEquals(h.title, "Home"); assertEquals(h.meta_desc, "");
  assertEquals(h.h1.length, 2);
  assert(!h.local_business); assertEquals(h.schema_types, []); assertEquals(h.schema_name, null);
  assert(!h.map_embed); assertEquals(h.tel_links, []);
  assertEquals(h.phones.length, 3);
  assert(!h.has_form); assert(h.booking_words);
  assertEquals(h.scripts_blocking, 7);
  assertEquals(h.trust_links, []); assert(!h.hours_text);
});

// ---------- buildResults ----------
Deno.test("good site + healthy listing: machine checks pass, human steps stay manual with a next_step", () => {
  const i: Input = { project: { name: "Keystone Plumbing", phone: "+16105550142", town: "Phoenixville, PA", trade: "plumber" }, site: site(GOOD), html: analyzeHtml(GOOD), place: goodPlace, competitors, duplicates: [] };
  const rs = buildResults(i), r = byKey(rs);
  assertEquals(rs.map(x => x.key).sort(), [...PLAYBOOK].sort(), "one result per playbook step");
  for (const k of ["site", "site_form", "site_map", "site_index", "reviews_count", "nap", "nap_name", "gbp_cat"]) assertEquals(r[k].check, "pass", k);
  assertStringIncludes(r.site.finding!, "Website looks solid");
  assertStringIncludes(r.reviews_count.finding!, "48 Google reviews at 4.9 stars");
  assertStringIncludes(r.reviews_count.finding!, "average 30");
  assertStringIncludes(r.nap.finding!, "(610) 555-0142");
  assertStringIncludes(r.nap_name.finding!, "Keystone Plumbing");
  assertEquals(r.address.check, "manual"); assertStringIncludes(r.address.next_step!, "shop or a house");
  assertEquals(r.hours.check, "manual"); assertStringIncludes(r.hours.finding!, "closed Saturday");
  assertEquals(r.gbp_about.check, "manual"); assertStringIncludes(r.gbp_about.finding!, "10 photo");
  for (const k of ["logo", "reviews_camp", "reviews_reply", "apple", "trust", "gbp_heat"]) { assertEquals(r[k].check, "manual", k); assert(r[k].next_step, k + " needs a next_step"); }
  assertStringIncludes(r.trust.finding!, "BBB");
  assertStringIncludes(r.apple.next_step!, "Keystone Plumbing Phoenixville, PA");
});

Deno.test("bad site + thin listing: every machine check fails with a plain one-line finding", () => {
  const i: Input = {
    project: { name: "Mike's Plumbing", phone: null, town: "Pottstown, PA", trade: "hvac" }, site: site(BAD, { finalUrl: "http://mikesplumbing.example/", http_redirects_to_https: null, sitemap: false, robots: false, llms: false }),
    html: analyzeHtml(BAD), place: badPlace, competitors, duplicates: [{ id: "ChIJdup", name: "Mikes Heating", address: "Pottstown" }],
  };
  const r = byKey(buildResults(i));
  for (const k of ["site", "site_form", "site_map", "site_index", "reviews_count", "nap", "nap_name", "address", "hours", "gbp_about", "gbp_cat"]) assertEquals(r[k].check, "fail", k);
  for (const k of ["no padlock", "phone screen", 'page title is just "Home"', "no description tag", "2 main headlines", "not tappable", "7 scripts blocking"]) assertStringIncludes(r.site.finding!, k);
  assertStringIncludes(r.site_form.finding!, "nothing to fill in");
  assertStringIncludes(r.site_map.finding!, "no business markup"); assertStringIncludes(r.site_map.finding!, "no Google map");
  assertStringIncludes(r.site_index.finding!, "no sitemap.xml"); assertStringIncludes(r.site_index.finding!, "no llms.txt");
  assertStringIncludes(r.reviews_count.finding!, "4 Google reviews"); assertStringIncludes(r.reviews_count.finding!, "Under 10");
  assertStringIncludes(r.nap.finding!, "Google shows (610) 555-0123 but the website shows");
  assertStringIncludes(r.nap.finding!, "3 different numbers"); assertStringIncludes(r.nap.finding!, "1 other Google listing");
  assertStringIncludes(r.nap_name.finding!, "Mike's Plumbing & Heating LLC");
  assertStringIncludes(r.address.finding!, "looks like a home");
  assertStringIncludes(r.hours.finding!, "No hours on the Google listing");
  assertStringIncludes(r.gbp_about.finding!, "no photos"); assertStringIncludes(r.gbp_about.finding!, "no website link");
  assertStringIncludes(r.gbp_cat.finding!, '"HVAC contractor"');
});

Deno.test("findings follow the wording rule: one line, no dashes as punctuation, no SEO jargon", () => {
  const cases: Input[] = [
    { project: { name: "Keystone Plumbing" }, site: site(GOOD), html: analyzeHtml(GOOD), place: goodPlace, competitors, duplicates: [] },
    { project: { name: "Mike's Plumbing" }, site: site(BAD, { sitemap: false, robots: false }), html: analyzeHtml(BAD), place: badPlace, competitors: [], duplicates: [] },
    { project: { name: "Nobody" }, site: null, html: null, place: null, competitors: [], duplicates: [] },
    { project: { name: "Down Co", website: "down.example" }, site: site("", { reachable: false, status: 0 }), html: null, place: goodPlace, competitors: [], duplicates: [] },
  ];
  for (const c of cases) for (const r of buildResults(c)) {
    if (r.finding) { assert(!/\n/.test(r.finding), r.key); assert(!/\s[—–-]\s|—/.test(r.finding), `${r.key}: ${r.finding}`); assert(!/\b(SEO|SERP|backlink|citation|NAP)\b/.test(r.finding), `${r.key}: ${r.finding}`); assert(r.finding.length <= 240, `${r.key} too long`); }
    assert(["pass", "fail", "manual", "error"].includes(r.check));
    assertEquals(typeof r.evidence, "object", r.key + " evidence");
  }
});

Deno.test("no website on file and none on Google: the four website steps fail, nothing throws", () => {
  const r = byKey(buildResults({ project: { name: "Nobody" }, site: null, html: null, place: { ...badPlace, websiteUri: undefined }, competitors: [], duplicates: [] }));
  for (const k of ["site", "site_form", "site_map", "site_index"]) assertEquals(r[k].check, "fail", k);
  assertStringIncludes(r.site.finding!, "No website on the Google listing");
});

Deno.test("site down: website steps fail with the status, listing steps still graded", () => {
  const r = byKey(buildResults({ project: { name: "Keystone Plumbing", website: "https://keystoneplumbing.example" }, site: site("", { reachable: false, status: 503, html: "" }), html: null, place: goodPlace, competitors, duplicates: [] }));
  assertEquals(r.site.check, "fail"); assertStringIncludes(r.site.finding!, "(503)");
  assertEquals(r.site_form.finding, "Could not check, the website did not load.");
  assertEquals(r.reviews_count.check, "pass");
  assertEquals(r.nap_name.check, "manual");
});

Deno.test("not on Google at all: reviews and profile steps fail, listing steps go manual", () => {
  const r = byKey(buildResults({ project: { name: "Ghost Plumbing" }, site: site(GOOD), html: analyzeHtml(GOOD), place: null, competitors: [], duplicates: [] }));
  assertEquals(r.reviews_count.check, "fail"); assertStringIncludes(r.reviews_count.finding!, "Could not find the business on Google Maps");
  assertEquals(r.gbp_about.check, "fail"); assertEquals(r.gbp_cat.check, "fail");
  for (const k of ["nap_name", "address", "hours"]) assertEquals(r[k].check, "manual", k);
  assertEquals(r.nap.check, "pass");
});

Deno.test("regression-style: a site that loses its viewport tag flips from pass to fail", () => {
  const before = byKey(buildResults({ project: { name: "Keystone Plumbing" }, site: site(GOOD), html: analyzeHtml(GOOD), place: goodPlace, competitors, duplicates: [] }));
  const broken = GOOD.replace(/<meta name="viewport"[^>]*>/, "");
  const after = byKey(buildResults({ project: { name: "Keystone Plumbing" }, site: site(broken), html: analyzeHtml(broken), place: goodPlace, competitors, duplicates: [] }));
  assertEquals(before.site.check, "pass"); assertEquals(after.site.check, "fail");
  assertStringIncludes(after.site.finding!, "phone screen");
});

// ---------- helpers ----------
Deno.test("pickPlace matches on phone, then website, then name; refuses weak matches", () => {
  const cands: Place[] = [{ id: "a", displayName: { text: "Other Guy Plumbing" }, nationalPhoneNumber: "(610) 555-0001" }, goodPlace, { id: "c", displayName: { text: "Keystone Roofing" } }];
  assertEquals(pickPlace(cands, { name: "Keystone", phone: "6105550142" })?.id, "ChIJgood");
  assertEquals(pickPlace(cands, { name: "Zzz", website: "www.keystoneplumbing.example/about" })?.id, "ChIJgood");
  assertEquals(pickPlace(cands, { name: "Keystone Plumbing LLC" })?.id, "ChIJgood");
  assertEquals(pickPlace(cands, { name: "Totally Different" }), null);
  assertEquals(pickPlace([], { name: "x" }), null);
});

Deno.test("placeIdFrom, normPhone, normName", () => {
  assertEquals(placeIdFrom("https://www.google.com/maps/place/?q=place_id:ChIJN1t_tDeuEmsRUsoyG83frY4"), "ChIJN1t_tDeuEmsRUsoyG83frY4");
  assertEquals(placeIdFrom("https://maps.app.goo.gl/abc"), null);
  assertEquals(normPhone("+1 (610) 555-0142"), "6105550142"); assertEquals(normPhone("555-0142"), null); assertEquals(normPhone(null), null);
  assertEquals(normName("Mike's Plumbing & Heating, LLC."), "mike s plumbing and heating");
  assertMatch(normName("The Keystone Co"), /^keystone$/);
});
