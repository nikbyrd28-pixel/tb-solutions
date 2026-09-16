# UNDRGRND — curated underground rap

Discovery-first, curator-picked drops for underground/independent rap. Static
pages (no build step), matching the rest of this repo — data lives in a
dedicated Supabase project kept separate from Loop's production database.

## Phase 1 MVP (this build)

- Curated drop feed at `/undrgrnd/` — no artist upload portal yet; curators
  add tracks manually via `/undrgrnd/admin.html`.
- User accounts (`login.html` / `signup.html`, Supabase Auth).
- Saved-track library (`library.html`).
- Tracks are embedded (SoundCloud/YouTube/Bandcamp) rather than self-hosted —
  cheapest and reversible for now; revisit if/when self-hosting audio and
  offline playlists become worth the build cost.

## Roadmap

1. **Now:** lean MVP — prove listeners show up for curation.
2. **Phase 2:** Discord community around the drops.
3. **Phase 3:** Song wars — bracket-style, crowd-voted battles in Discord.
4. **Phase 4+:** offline playlists, once regular listening is proven and the
   self-hosted-audio question is revisited.

## Making yourself a curator

New accounts are listeners by default. To post drops, flip `is_curator` on
your profile row directly in the Supabase SQL editor for project
`avcslzbglebvrlywnevb`:

```sql
update public.profiles set is_curator = true where id = '<your-auth-user-id>';
```

Find your user id under Authentication → Users in the Supabase dashboard.

## Data

Schema (`profiles`, `tracks`, `drops`, `drop_tracks`, `saves`) and RLS
policies are defined in `supabase/migrations/0001_undrgrnd_init.sql` and
already applied to the live project.
