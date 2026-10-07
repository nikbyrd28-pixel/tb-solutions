# D N E Contracting — SEO & backlink playbook

What is already on the site (built Oct 2026)
- 16 crawlable landing pages: 4 service pages (`/kitchen-remodeling`, `/bathroom-remodeling`, `/basement-remodeling`, `/plumbing-water-heaters`) and 12 town pages (`/remodeling-west-chester` … `/remodeling-boyertown`), all interlinked and linked from the homepage footer. Each has its own title, meta description, FAQ schema, Service/Breadcrumb schema and a live 3D scene.
- `sitemap.xml` lists all 17 URLs. `robots.txt` points to it.
- Rules kept: no Pottstown anywhere, no street address, no prices on the pages, mom's homepage copy untouched.
- Rebuild pages after any edit: `python3 system/08-seo/build_seo_pages.py` (edit the SERVICES / TOWNS tables at the top).

Target keywords (by page)
- kitchen remodeling contractor chester county · kitchen renovation west chester pa · kitchen remodel exton
- bathroom remodeling chester county · tub to shower conversion west chester · walk-in shower installation pa
- basement finishing contractor chester county · basement bathroom addition · finished basement phoenixville
- water heater replacement 422 corridor · tankless water heater installation west chester · plumber royersford
- women owned contractor chester county · remodeling contractor near me (Google Business Profile drives this one)

Backlinks — do these in order (each is a real link to dnecontracting.com)
1. Google Business Profile: set Website = https://dnecontracting.com and add the four service pages as "Services" with links. Post weekly (photo + 2 sentences + link to the matching service page). Ask every finished client for a review — reviews are the #1 local ranking factor.
2. Facebook business page: Website field + a pinned post linking to the planner. Every FB group post that is allowed to include a link points to the town page for that group's town (e.g. a West Chester moms group → /remodeling-west-chester).
3. Free citations (same name, phone, website on every one): Bing Places, Apple Business Connect, Yelp, Nextdoor Business, Angi, HomeAdvisor, Houzz, Thumbtack, Porch, BBB, Alignable, Chamber of Commerce (West Chester / Phoenixville / TriCounty), PA Home Improvement Contractor lookup (already registered — link it from About).
4. Supplier & partner links: ask Concept Kitchen & Bath and any showroom/GC you sub for to list D N E as a "trusted plumbing/remodel partner" with a link. Cabinet, tile and plumbing-supply vendors often have "find an installer" pages — get listed.
5. Local press / community: a short "women-owned contractor in Chester County" story pitched to The Daily Local News, Phoenixville Patch, Chester County Press, and Main Line Today. A quote in one article is worth more than 50 directory links.
6. Associations: NARI, NKBA, Women in Construction / NAWIC chapter pages link to members.
7. TB Solutions: tbsol.net already links to the site; add a short case-study page there linking to a service page (not just the homepage).

Measure
- Google Search Console: submit `https://dnecontracting.com/sitemap.xml`, then watch Pages → Indexed and Performance → Queries. Expect the town pages to start appearing for "[town] remodeling" within 3–6 weeks of indexing.
- Each landing page CTA goes to the planner, so leads from SEO show up in Supabase with the same funnel as everything else.
