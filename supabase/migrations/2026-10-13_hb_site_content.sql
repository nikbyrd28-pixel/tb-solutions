-- Hubs & Babydoll: editable site content for the Harmony sales page (no-code editor at /clients/hubsandbabydoll/harmony/edit/).
-- One row per editable field. Public page reads with the anon key; only HQ admins (hq_admins, is_hq_admin()) can write.
-- Depends on hq/supabase/001_hq.sql (hq_admins table + is_hq_admin()). Safe to re-run: seed uses ON CONFLICT DO NOTHING.

create table if not exists public.hb_site_content (
  page        text        not null,
  key         text        not null,
  value       jsonb       not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid        references auth.users(id) on delete set null,
  primary key (page, key)
);

alter table public.hb_site_content enable row level security;

drop policy if exists hb_site_content_read   on public.hb_site_content;
drop policy if exists hb_site_content_insert on public.hb_site_content;
drop policy if exists hb_site_content_update on public.hb_site_content;

create policy hb_site_content_read   on public.hb_site_content for select to anon, authenticated using (true);
create policy hb_site_content_insert on public.hb_site_content for insert to authenticated with check (public.is_hq_admin());
create policy hb_site_content_update on public.hb_site_content for update to authenticated using (public.is_hq_admin()) with check (public.is_hq_admin());

grant select on public.hb_site_content to anon, authenticated;
grant insert, update on public.hb_site_content to authenticated;

-- Stamp who/when on every write (client cannot forge updated_by).
create or replace function public.hb_site_content_stamp() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;
drop trigger if exists hb_site_content_stamp on public.hb_site_content;
create trigger hb_site_content_stamp before insert or update on public.hb_site_content
  for each row execute function public.hb_site_content_stamp();

-- Images: public-read bucket, admin-only writes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hb-site', 'hb-site', true, 8388608, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists hb_site_read   on storage.objects;
drop policy if exists hb_site_insert on storage.objects;
drop policy if exists hb_site_update on storage.objects;
drop policy if exists hb_site_delete on storage.objects;
create policy hb_site_read   on storage.objects for select to anon, authenticated using (bucket_id = 'hb-site');
create policy hb_site_insert on storage.objects for insert to authenticated with check (bucket_id = 'hb-site' and public.is_hq_admin());
create policy hb_site_update on storage.objects for update to authenticated using (bucket_id = 'hb-site' and public.is_hq_admin()) with check (bucket_id = 'hb-site' and public.is_hq_admin());
create policy hb_site_delete on storage.objects for delete to authenticated using (bucket_id = 'hb-site' and public.is_hq_admin());

-- Seed: every editable field at the value currently hard-coded in the page (page keeps these as fallback).
insert into public.hb_site_content (page, key, value) values
  ('harmony', 'announce', '"10% off 2 bottles. 15% off 3 bottles, plus free shipping."'::jsonb),
  ('harmony', 'hero.eyebrow', '"Hubs & Babydoll"'::jsonb),
  ('harmony', 'hero.h1', '"Harmony Body Oil"'::jsonb),
  ('harmony', 'hero.lead', '"A body oil made from jojoba, sweet almond, flaxseed and castor oil, with vitamin E. It soaks in within a minute and keeps skin soft through the day without a greasy feel. Works on beards too. Poured by hand at home in small batches."'::jsonb),
  ('harmony', 'hero.ship', '"Ships in 1 to 2 business days"'::jsonb),
  ('harmony', 'hero.pickup', '"Local pickup available"'::jsonb),
  ('harmony', 'hero.gift', '"Gift note at checkout"'::jsonb),
  ('harmony', 'scents', '[{"key":"jas","name":"Jasmine & Gardenia","note":"Floral, soft","img":"img/harmony-jasmine-gardenia-body-oil.jpg"},{"key":"bay","name":"Bay Rum","note":"Warm, spiced, for him","img":"img/harmony-bay-rum-body-oil.jpg"},{"key":"choc","name":"Chocolate","note":"Cozy cocoa","img":"img/harmony-chocolate-body-oil.jpg"},{"key":"pep","name":"Peppermint","note":"Cooling, with lavender","img":"img/harmony-peppermint-oil.jpg"}]'::jsonb),
  ('harmony', 'oil.sizes', '[{"size":"2 oz","price":15,"note":"about a month"},{"size":"4 oz","price":25,"note":"about two months"},{"size":"8 oz","price":35,"note":"about four months"}]'::jsonb),
  ('harmony', 'oil.default_size', '"4 oz"'::jsonb),
  ('harmony', 'oil.tiers', '[{"qty":1,"off":0,"label":""},{"qty":2,"off":10,"label":"10% off"},{"qty":3,"off":15,"label":"15% off, free shipping"}]'::jsonb),
  ('harmony', 'ship.free_at', '50'::jsonb),
  ('harmony', 'ship.flat', '6'::jsonb),
  ('harmony', 'routine.h2', '"Goes well with"'::jsonb),
  ('harmony', 'routine.lead', '"Body wash and body butter in the same scent. Butter first, then a few drops of oil on top."'::jsonb),
  ('harmony', 'about.h2', '"About the oil"'::jsonb),
  ('harmony', 'about.rows', '[{"t":"Good for","d":"<b>Dry or tight skin.</b> Fine on sensitive skin and beards."},{"t":"Feels like","d":"Light, not heavy. Soaks in rather than sitting on top."},{"t":"Absorbs in","d":"About a minute. You can get dressed right after."},{"t":"Scent","d":"Noticeable up close, not loud. Fades to a light trace by evening."},{"t":"Does not contain","d":"Mineral oil, parabens, sulfates, or fillers."},{"t":"Ways to use it","d":"Body oil, beard oil, cuticle oil, or a few drops in the bath."}]'::jsonb),
  ('harmony', 'about.img', '"img/lifestyle.jpg"'::jsonb),
  ('harmony', 'ing.h2', '"What is in it"'::jsonb),
  ('harmony', 'ing.lead', '"Four plant oils, vitamin E, and the scent. Nothing else."'::jsonb),
  ('harmony', 'ing.items', '[{"h":"Jojoba oil","p":"The base of the blend. Close to the oil your skin makes on its own, so it absorbs easily."},{"h":"Sweet almond oil","p":"Softens rough spots and gives the oil its slip. Note: this is a tree nut oil."},{"h":"Flaxseed oil","p":"Rich in omega-3. Helps the oil hold moisture in longer."},{"h":"Castor oil","p":"Adds a light sheen. Good on beards and cuticles."},{"h":"Vitamin E","p":"Keeps the oil from going rancid in the bottle."},{"h":"Scent","p":"Jasmine & Gardenia, Bay Rum, Chocolate, or Peppermint."}]'::jsonb),
  ('harmony', 'howto.h2', '"How to use it"'::jsonb),
  ('harmony', 'howto.steps', '["After a shower, pat your skin so it is still a little damp.","Put 3 to 5 drops in your palm and rub it where you want it. Start with less, you can add more.","Give it about a minute to soak in, then get dressed.","For beards, 2 or 3 drops worked in from the skin out. For cuticles, one drop per hand."]'::jsonb),
  ('harmony', 'howto.note', '"Keep the bottle out of direct sun. A 4 oz bottle used once a day lasts about two months."'::jsonb),
  ('harmony', 'more.h2', '"Other things we make"'::jsonb),
  ('harmony', 'more.lead', '"Gift boxes, beard care, and duos. Tap a photo to see it full size, or <a href=\"https://hubsandbabydoll.com/shop\" style=\"color:var(--gold)\">see the full shop</a>."'::jsonb),
  ('harmony', 'story.h2', '"Who makes it"'::jsonb),
  ('harmony', 'story.p', '"Hubs & Babydoll is a small, Black-owned brand run from home. The oils are mixed and poured by hand in small batches, and every order is packed by the people who made it."'::jsonb),
  ('harmony', 'story.quote', '"\"Because the people who spend their lives pouring into others deserve to be poured into, too.\""'::jsonb),
  ('harmony', 'story.sig', '"Hubs & Babydoll"'::jsonb),
  ('harmony', 'faq.h2', '"Common questions"'::jsonb),
  ('harmony', 'faq.items', '[{"q":"Will it leave my skin or clothes greasy?","a":"Not if you use a few drops on damp skin and give it a minute. If it feels heavy, you used too much."},{"q":"How much do I use?","a":"3 to 5 drops per area on damp skin. A 4 oz bottle lasts about two months with daily use."},{"q":"Which scent should I pick?","a":"Jasmine & Gardenia is the floral one and a safe gift pick. Bay Rum is the men''s scent. Chocolate is warm and sweet. Peppermint is cooling and good on feet and legs. Still unsure? <a href=\"https://hubsandbabydoll.com/quiz\">Take the short scent quiz.</a>"},{"q":"Is it safe for sensitive skin?","a":"It is four plant oils and vitamin E with no added preservatives. It does contain sweet almond oil, which is a tree nut, so skip it if you have a nut allergy. Patch test first if you are not sure."},{"q":"How is it shipped?","a":"Orders go out in 1 to 2 business days. Local pickup is an option at checkout. See the <a href=\"https://hubsandbabydoll.com/shipping-policy\">shipping</a> and <a href=\"https://hubsandbabydoll.com/refund-policy\">refund</a> policies for details."}]'::jsonb),
  ('harmony', 'final.h2', '"Ready to order?"'::jsonb),
  ('harmony', 'final.btn', '"Pick a scent and size"'::jsonb),
  ('harmony', 'final.sub', '"From $15. Ships in 1 to 2 business days."'::jsonb),
  ('harmony', 'footer.copy', '"© 2026 Hubs & Babydoll · hubsbabydoll@gmail.com"'::jsonb),
  ('harmony', 'products', '[{"id":"b_jas","name":"Jasmine & Gardenia Body Butter","scent":"jas","cat":"butter","img":"img/jasmine-gardenia-body-butter.jpg","why":"Whipped shea, mango and cocoa butter. Goes on before the oil.","sizes":[{"size":"2 oz","price":20,"sold_out":false},{"size":"4 oz","price":35,"sold_out":false}]},{"id":"b_lav","name":"Lavender Rose Body Butter","scent":"lav","cat":"butter","img":"img/lavender-rose-body-butter.jpg","why":"Lavender and rose. Works with any of the oils.","sizes":[{"size":"2 oz","price":10,"sold_out":false},{"size":"4 oz","price":20,"sold_out":true}]},{"id":"b_choc","name":"Chocolate Body Butter","scent":"choc","cat":"butter","img":"img/chocolate-body-butter.jpg","why":"Same scent as the Chocolate oil. Use it underneath.","sizes":[{"size":"2 oz","price":10,"sold_out":false},{"size":"4 oz","price":20,"sold_out":true}]},{"id":"b_pep","name":"Peppermint Body Butter","scent":"pep","cat":"butter","img":"img/peppermint-body-butter.jpg","why":"Cooling. Good on feet and legs.","sizes":[{"size":"2 oz","price":10,"sold_out":false},{"size":"4 oz","price":20,"sold_out":true}]},{"id":"w_jas","name":"Jasmine & Gardenia Body Wash","scent":"jas","cat":"wash","img":"img/jasmine-gardenia-body-wash.jpg","why":"Sulfate-free body wash.","sizes":[{"size":"3.6 oz","price":18,"sold_out":false}]},{"id":"w_lav","name":"Lavender Rose Body Wash","scent":"lav","cat":"wash","img":"img/lavender-rose-body-wash.jpg","why":"Sulfate-free, soft lavender.","sizes":[{"size":"3.6 oz","price":18,"sold_out":false}]},{"id":"bc","name":"Bay Rum Beard Conditioner","scent":"bay","cat":"beard","img":"img/bay-rum-beard-conditioner.jpg","why":"Softens and detangles. Use the oil after.","sizes":[{"size":"3.6 oz","price":18,"sold_out":false}]},{"id":"bb","name":"Bay Rum Beard Balm","scent":"bay","cat":"beard","img":"img/beard-balm.jpg","why":"Shea, beeswax and argan. Holds shape.","sizes":[{"size":"2 oz","price":18,"sold_out":false}]},{"id":"bg","name":"Bay Rum Beard Gift Set","scent":"bay","cat":"set","img":"img/beard-gift.jpg","why":"1 oz beard oil and 1 oz balm in a gift box.","sizes":[{"size":"One size","price":35,"sold_out":false}]},{"id":"bs","name":"HEARD Bay Rum Beard Box","scent":"bay","cat":"set","img":"img/beard-set.jpg","why":"Wash, conditioner, oil and balm.","sizes":[{"size":"Full set","price":45,"sold_out":false}]},{"id":"heard","name":"HEARD Bay Rum Collection","scent":"bay","cat":"set","img":"img/heard.jpg","why":"Oil, butter, wash and two soft cloths.","sizes":[{"size":"Gift box","price":50,"sold_out":false}]},{"id":"seen","name":"SEEN Jasmine Gardenia Collection","scent":"jas","cat":"set","img":"img/seen.jpg","why":"8 oz wash, 4 oz butter, oil and cloths.","sizes":[{"size":"Gift box","price":50,"sold_out":false}]},{"id":"seenb","name":"SEEN Jasmine Gardenia Box","scent":"jas","cat":"set","img":"img/seen-box.jpg","why":"Wash, butter and oil in a keepsake box.","sizes":[{"size":"Gift box","price":35,"sold_out":false}]},{"id":"seenl","name":"SEEN Lavender Box","scent":"lav","cat":"set","img":"img/seen-lav.jpg","why":"Lavender Rose oil, butter and wash.","sizes":[{"size":"Gift box","price":45,"sold_out":false}]},{"id":"chesc","name":"Chocolate Escape Duo","scent":"choc","cat":"set","img":"img/choc-escape.jpg","why":"2 oz oil and 2 oz butter.","sizes":[{"size":"Duo","price":35,"sold_out":false}]},{"id":"pept","name":"Peppermint Treat Duo","scent":"pep","cat":"set","img":"img/pep-treat.jpg","why":"Peppermint butter and oil.","sizes":[{"size":"Duo","price":35,"sold_out":false}]}]'::jsonb)
on conflict (page, key) do nothing;
