# Nick Byrd TV

Your own YouTube + TikTok + funnel. Next.js 16 · Supabase (project "Base") · Vercel.

## Routes
- `/` — YouTube-style home: hero, Chaos Feed rail, video grid, email capture
- `/watch/[slug]` — player, likes, comments, up-next, members paywall
- `/feed` — TikTok-style vertical snap feed; join card slides in after 3 swipes
- `/join` — 2-step funnel: free email → Inner Circle ($5) / Day One ($20)
- `/community` — members wall (locked posts blur + "Unlock")
- `/login` — magic link + Google
- `/admin/upload` — upload video/thumbnail to Supabase Storage, publish (ADMIN_EMAILS only)

## Setup
1. Migration is already applied to Base (tables prefixed `nb_`, buckets `videos` + `thumbnails`, 5 seed videos).
2. `.env.local` — add `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Settings → API). URL + anon key are filled in.
3. Supabase → Auth → URL Configuration: add `https://YOUR-DOMAIN/auth/callback` to redirect URLs. Enable Google provider if you want it.
4. `npm run dev`

## Deploy
`vercel` — set the same env vars in the Vercel project.

## Money
Create two Stripe Payment Links, paste into `NEXT_PUBLIC_STRIPE_LINK_INNER_CIRCLE` / `_DAY_ONE`. When a payment lands, a Stripe webhook → n8n → `update nb_profiles set tier='inner_circle' where id=…` flips the paywall. (`nb_memberships` table is ready for that.)

## n8n
Every new lead POSTs to `N8N_LEAD_WEBHOOK_URL` → send welcome email, add to your list, ping you.

## Real video hosting
Supabase Storage works for launch. When bandwidth costs bite, move to Bunny Stream or Cloudflare Stream — just change `video_url` per row; nothing else changes.

Delete the seed rows once you upload real videos: `delete from nb_videos where video_url like '%gtv-videos-bucket%';`
