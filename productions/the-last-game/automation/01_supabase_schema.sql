-- ============================================================
-- THE LAST GAME — Faceless Auto-Channel state layer
-- Run once: Supabase → SQL Editor → New query → paste ALL → Run
-- (Already applied to project "Base" by the setup agent; this file
--  is the source of record so you can re-run / re-seed anytime.)
--
-- Two tables:
--   tlg_segments — the content queue (the book, pre-cut into Shorts)
--   tlg_posts    — a log row per platform per publish
-- The render engine and n8n use the service_role key (bypasses RLS).
-- The admin (nikbyrd28@gmail.com) can read/manage from the dashboard.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- QUEUE ----------
create table if not exists public.tlg_segments (
  id              uuid primary key default gen_random_uuid(),
  seq             int  not null default 0,          -- play order
  slug            text unique not null,
  title           text not null,                    -- YouTube/episode title
  hook_line       text,                             -- first 2s on-screen hook
  narration       text not null,                    -- the VO script
  caption         text,                             -- social caption
  hashtags        text[] default '{}',
  thumbnail_prompt text,
  aspect          text not null default '9:16',     -- 9:16 shorts | 16:9 long
  status          text not null default 'queued',   -- queued→rendering→rendered→posting→posted→error
  video_url       text,                             -- filled by the render engine
  render_job_id   text,
  posted_at       timestamptz,
  tiktok_post_id  text,
  ig_post_id      text,
  yt_video_id     text,
  last_error      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists tlg_segments_status_seq_idx on public.tlg_segments (status, seq);

-- ---------- POST LOG ----------
create table if not exists public.tlg_posts (
  id          uuid primary key default gen_random_uuid(),
  segment_id  uuid references public.tlg_segments(id) on delete cascade,
  platform    text not null,                        -- tiktok | instagram | youtube
  external_id text,
  url         text,
  status      text not null default 'ok',
  created_at  timestamptz not null default now()
);

-- ---------- updated_at trigger ----------
create or replace function public.tlg_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists tlg_segments_touch on public.tlg_segments;
create trigger tlg_segments_touch before update on public.tlg_segments
  for each row execute function public.tlg_touch_updated_at();

-- ---------- RLS (service_role bypasses; admin can view/manage) ----------
alter table public.tlg_segments enable row level security;
alter table public.tlg_posts    enable row level security;

drop policy if exists "admin all tlg_segments" on public.tlg_segments;
create policy "admin all tlg_segments" on public.tlg_segments
  for all to authenticated
  using  ((auth.jwt()->>'email') = 'nikbyrd28@gmail.com')
  with check ((auth.jwt()->>'email') = 'nikbyrd28@gmail.com');

drop policy if exists "admin all tlg_posts" on public.tlg_posts;
create policy "admin all tlg_posts" on public.tlg_posts
  for all to authenticated
  using  ((auth.jwt()->>'email') = 'nikbyrd28@gmail.com')
  with check ((auth.jwt()->>'email') = 'nikbyrd28@gmail.com');

-- ---------- SEED: the book, pre-cut into 16 short-form beats ----------
insert into public.tlg_segments (seq, slug, title, hook_line, narration, caption, hashtags, thumbnail_prompt)
select (ord)::int, slug, title, hook_line, narration, caption,
       (select array_agg(x) from jsonb_array_elements_text(tags) x), thumbnail_prompt
from jsonb_to_recordset($json$[
{"ord":1,"slug":"two-photographs","title":"Same Person. 15 Years Apart.","hook_line":"This man paid $48,000 for 3 suits. 15 years earlier he was holding his dying best friend.","narration":"This is me — Beverly Hills, forty-eight thousand dollars for three suits in one afternoon. And this is also me, fifteen years earlier, on a Compton sidewalk holding my best friend as he died. Same person. The distance between those two photographs is the whole story — and somewhere inside it was the United States government. This is The Last Game.","caption":"Same person. 15 years apart. 🎲 The whole story is in the gap. #TheLastGame","tags":["Compton","CIA","TrueStory","TheLastGame","Documentary"],"thumbnail_prompt":"split face, left gold Versace warm, right grieving teen cold blue, bold text SAME PERSON"},
{"ord":2,"slug":"norman","title":"The Dice Game That Started Everything","hook_line":"He watched his best friend get killed over a dice game at 15.","narration":"Summer, 1980. Me and my best friend Norman ditched school to shoot dice under a freeway bridge. Two rivals rode by on a bike and called out. Everybody ducked — except Norman. He wouldn't get down. One shot. I caught him before he hit the ground. Fifteen years old, and I became a pallbearer for the first time. It would not be the last. That morning is where the game really started.","caption":"He wouldn't get down. 💔 #Compton #TheLastGame","tags":["Compton","TrueStory","TheLastGame","Norman"],"thumbnail_prompt":"teen under freeway overpass at dawn, dice on cracked concrete, somber, bold text NORMAN"},
{"ord":3,"slug":"scarface-blueprint","title":"The Movie That Handed the Hood a Blueprint","hook_line":"In 1983 a single movie handed every kid in the hood a blueprint.","narration":"Before crack, powder cocaine was for people with money and connections. Then 1983 — Scarface hit the theaters, and suddenly every kid in the hood had a blueprint for the kingpin life. The cars, the clothes, the power. I wanted all of it. What none of us understood was that we were about to become the engines of a machine that would destroy our own neighborhoods.","caption":"1983 changed everything. 🎬 #Scarface #TheLastGame","tags":["Scarface","Compton","TrueStory","TheLastGame","80s"],"thumbnail_prompt":"1983 TV glowing in a dark room, young man watching, neon, bold text THE BLUEPRINT"},
{"ord":4,"slug":"the-catcher","title":"His Baseball Catcher Became His Drug Connect","hook_line":"His childhood baseball catcher handed him his first kilo.","narration":"Before the drugs, there was baseball. Me and Tone — Victory Park, ten and eleven years old. I pitched, he caught. We made the Little League all-stars, went to the World Series. Then a knee injury killed my sports dream. And the same Tone who caught my fastballs handed me my first sack of cocaine. The catcher became the connect. That's how it happens — never a stranger. Always someone you love.","caption":"The catcher became the connect. ⚾️➡️ #TheLastGame","tags":["Compton","TrueStory","TheLastGame","Baseball"],"thumbnail_prompt":"split: little league catcher warm super-8, and a kilo on a table cold, bold text THE CATCHER"},
{"ord":5,"slug":"300k-a-week","title":"$300,000 a Week at 20 — And How the Trap Works","hook_line":"By 20 he was making $300,000 a week. Here's how the trap actually works.","narration":"By my early twenties I was seeing over three hundred thousand dollars a week. Twenty cars. Houses across the city like chess pieces. First one in the hood wearing Versace before anybody knew what it was. I want you to feel how good it looked — because that's exactly how the trap works. Every high in this story gets a bill. And mine was coming.","caption":"$300K a week at 20. Then the bill came. 💵 #TheLastGame","tags":["Compton","TrueStory","TheLastGame","Money"],"thumbnail_prompt":"money counter and lowrider gold hour, worried man looking back, bold text $300K A WEEK"},
{"ord":6,"slug":"battering-ram","title":"The LAPD Used a Tank to Smash Homes","hook_line":"The LAPD used a literal 14,000-lb tank to smash homes in Compton.","narration":"While we got rich, the state declared war — a real one. Under Chief Daryl Gates the LAPD rolled a fourteen-thousand-pound armored battering ram through our streets, smashing houses with families still inside. My father, my brothers — treated like enemy combatants in their own home. That's why N.W.A picked up microphones. The music you loved? It was a war report.","caption":"The music you loved was a war report. 🚁 #Compton #NWA #TheLastGame","tags":["Compton","NWA","TrueStory","TheLastGame","History"],"thumbnail_prompt":"armored battering ram smashing a wall at night, searchlight, red-blue strobe, bold text WAR ON THE HOOD"},
{"ord":7,"slug":"cartel-switch","title":"One Cartel Decision Changed Compton Forever","hook_line":"One decision by the Colombian cartel changed Compton forever.","narration":"By the late eighties the Colombians made a call — stop dealing with Black gangs, hand the whole pipeline to the Mexican gangs. It wasn't just drugs. It was property, blocks, entire neighborhoods. In twenty-five years the map of my childhood flipped completely. I thought I was the one playing the game. I wasn't.","caption":"I thought I was playing the game. I wasn't. 🗺️ #TheLastGame","tags":["Compton","TrueStory","TheLastGame","History"],"thumbnail_prompt":"glowing supply-chain map redrawing over Los Angeles, cold blue, bold text THE SWITCH"},
{"ord":8,"slug":"two-americas","title":"15 Miles Between Two Different Americas","hook_line":"15 miles separated two completely different Americas.","narration":"Beverly Hills in the morning — forty-eight-thousand-dollar suits, marble floors. Compton by the afternoon — funerals and battering rams. Fifteen, twenty miles apart. I was the bridge between two Americas. And a bridge is a dangerous place to stand. Somebody is always watching who crosses it.","caption":"He was the bridge between two Americas. 🌉 #TheLastGame","tags":["Compton","BeverlyHills","TrueStory","TheLastGame"],"thumbnail_prompt":"driver profile, city in sunglasses shifting cold to warm, bold text TWO AMERICAS"},
{"ord":9,"slug":"penny-marshall","title":"A Hollywood Legend Mentored a Kingpin","hook_line":"A Hollywood legend mentored a Compton kingpin — and never asked questions.","narration":"Courtside at the Lakers, one person shone like a beacon — Penny Marshall. Laverne, the director of Big and A League of Their Own. She took me under her wing. Never once pried into my way of life. She just said, everyone deserves a chance to get over the fence. Years later, that woman would hand me a video camera that changed my entire life.","caption":"Everyone deserves a chance to get over the fence. 🎥 #TheLastGame","tags":["Compton","Hollywood","TrueStory","TheLastGame","PennyMarshall"],"thumbnail_prompt":"warm courtside friendship 1980s Lakers, golden light, bold text SHE SAW SOMETHING"},
{"ord":10,"slug":"beat-the-feds","title":"Nobody Beats the Feds. He Did.","hook_line":"Nobody beats the Feds. He did — and it was his biggest mistake.","narration":"1988. A six-year FBI investigation, and I was twenty-four. Everybody around me took the plea — decades, signed away. I was too proud. Federal cases end in conviction over ninety-nine percent of the time. I went to trial anyway. And I won. Acquitted. I felt invincible. But when you embarrass a ninety-nine-percent machine, it doesn't forget. It waits.","caption":"He beat a 99% machine. Big mistake. ⚖️ #TheLastGame","tags":["Compton","TrueStory","TheLastGame","Justice"],"thumbnail_prompt":"courtroom light beam on a defendant, newspaper ACQUITTED, bold text HE BEAT THE FEDS"},
{"ord":11,"slug":"freeway-rick","title":"Two Kingpins Tried to Rebuild What They Destroyed","hook_line":"Two kingpins teamed up to rebuild the city they helped destroy.","narration":"Freeway Rick Ross made hundreds of millions, then lost it all. When he came home, we teamed up — not as dealers, as builders. A forty-four-thousand-square-foot youth center on Crenshaw. The West Coast Apollo. We were finally doing it right. Then his old connect made one phone call from a federal prison — and everything we built walked straight into a trap.","caption":"Redemption… then one phone call. ☎️ #FreewayRickRoss #TheLastGame","tags":["Compton","FreewayRickRoss","TrueStory","TheLastGame"],"thumbnail_prompt":"two men over blueprints on Crenshaw, hopeful then shadow of a prison phone, bold text THE TRAP"},
{"ord":12,"slug":"just-say-no","title":"Reagan Said 'Just Say No' While the Trap Sprung","hook_line":"Reagan said 'Just Say No' on the TV while the sting went down.","narration":"A Denny's near the border. Rick and me, waiting on the deal that would set us up for life. On the TV, Ronald Reagan: just say no. My gut screamed something was wrong — I don't buy dope I've never seen. Rick swore his connect was family. We followed that Camaro into a parking lot. We had no idea we were walking into a federal sting years in the making.","caption":"'Just Say No' played while the trap sprung. 📺 #TheLastGame","tags":["Compton","Reagan","TrueStory","TheLastGame","History"],"thumbnail_prompt":"1980s diner, Reagan on a small TV, two men tense in a booth, bold text THE SETUP"},
{"ord":13,"slug":"gary-webb","title":"A Journalist Said His Supplier Worked for the CIA","hook_line":"A journalist told him the man who supplied him worked for the CIA.","narration":"Prison visiting room. A journalist named Gary Webb slid a folder across the table and said: your supplier will not testify — because he works for the CIA. And he always has. The man who made us rich, who brought us down, was a government asset the whole time. I felt like I'd been punched in the gut. Then Webb asked one question: how did your connect always know before every raid?","caption":"He worked for the CIA. The whole time. 📁 #GaryWebb #TheLastGame","tags":["CIA","GaryWebb","Compton","TrueStory","TheLastGame"],"thumbnail_prompt":"prison visiting room, a folder sliding across a table, red dot on a photo, bold text THE CIA"},
{"ord":14,"slug":"iran-contra","title":"How Cocaine Funded a Secret American War","hook_line":"This is how cocaine funded a secret American war.","narration":"Here is what Gary Webb was really telling me. In the eighties the U.S. wanted to overthrow Nicaragua's government, but Congress refused to pay for it. So the money came from somewhere else — cocaine, funneled through the Contras, into cities like mine. The Kerry Committee confirmed it. They put us in prison for something the record shows the government helped set in motion.","caption":"Cocaine funded a secret war. The record confirms it. 🌎 #IranContra #TheLastGame","tags":["IranContra","CIA","GaryWebb","TrueStory","TheLastGame"],"thumbnail_prompt":"Oval Office archival, glowing pipeline map to Nicaragua, bold text IRAN-CONTRA"},
{"ord":15,"slug":"ex-contractors","title":"He Got Crips and Bloods to Rebuild Compton Together","hook_line":"He got lifelong rival gangs to rebuild Compton — together.","narration":"After prison, I had an idea. Nobody would hire ex-gang members — so I would hire them myself. They all learned construction inside. I got Crips and Bloods, lifelong enemies, in the same backyard, agreeing to build instead of destroy. We turned an old market into a symbol of hope. Penny filmed it on a shattered iPhone. That footage got me a Netflix deal.","caption":"Rival gangs. One hammer. 🔨 #Compton #Redemption #TheLastGame","tags":["Compton","Redemption","TrueStory","TheLastGame"],"thumbnail_prompt":"former gang members in red and blue building together, hopeful, bold text THE EX-CONTRACTORS"},
{"ord":16,"slug":"council-vote","title":"He Raised $500K to Rebuild Compton. They Voted No.","hook_line":"He raised $500K to rebuild Compton. The council voted no — and got caught saying why.","narration":"2019. I stood before the Compton City Council with a half-million dollars raised and rival gangs ready to rebuild the city. The mayor said go. Then three council members voted it down. And I caught one of them on camera saying the real reason — it had nothing to do with my plan. It was politics. A personal vendetta. But I will never stop fighting for my community. One person at a time.","caption":"They voted no — and got caught saying why. 🎥 #Compton #TheLastGame","tags":["Compton","TrueStory","TheLastGame","Politics"],"thumbnail_prompt":"city council chamber, a man standing with a proposal, bold text THEY VOTED NO"}
]$json$) as t(ord int, slug text, title text, hook_line text, narration text, caption text, tags jsonb, thumbnail_prompt text)
on conflict (slug) do nothing;
