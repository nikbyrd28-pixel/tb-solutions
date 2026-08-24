# Brand plates — the cinematic layer

Four generated stills that give the marketing surfaces a photographic base.
They live in the Supabase `shop-sites` public bucket under `brand/`, the same
place every other Loop brand photo lives — nothing binary goes in this repo.

Base URL:

    https://qgbjiqdwzgkjkmqyjsmc.supabase.co/storage/v1/object/public/shop-sites/brand/

## The set

| File | What it is | Where it lands |
|---|---|---|
| `tbsol-glow.jpg` | Abstract long-exposure light rings over black | `/` — wash of light behind the hero |
| `tbsol-creator.jpg` | Creator filming a vertical short, ring-lit | `/content-studio/` — hero backdrop |
| `tbsol-desk.jpg` | Overhead creator's desk at night | `/marketing-engine/` — behind the header |
| `tbsol-studio.jpg` | Night desk, monitor glow as the key light | `/studio/` — behind the header |

Every one is wired as a decorative CSS layer: masked into the page background,
`pointer-events:none`, no layout of its own. If a file is missing the page
simply loses a wash of light — nothing moves, nothing breaks. That is why the
markup was safe to land before the uploads.

## How they were made

Higgsfield `soul_2`, quality 2k, 16:9, 2048×1152, style "General". The look is
the one the `/barbers/` page established: near-black `#07080c`, teal `#5df2e0`
into blue `#6f9dff` as practicals or rim light, real-photography feel, no text
baked in.

| File | Seed | Prompt |
|---|---|---|
| `tbsol-studio.jpg` | 968528 | Cinematic photograph, dark home-office studio at night in a small Pennsylvania town. A young man in a plain dark hoodie sits at a desk, seen from behind and slightly to the side, working at a large monitor. The monitor glow is the main light source, cool teal-cyan spilling across his shoulders and the desk surface. A second cool blue rim light from a window behind him. The room is near-black with deep shadows and a subtle haze in the air. Anamorphic 35mm look, shallow depth of field, filmic grain, natural skin texture. No text, no readable screen content, no logos, no watermark. Colour palette: near-black #07080c, teal #5df2e0, blue #6f9dff. |
| `tbsol-creator.jpg` | 999451 | Cinematic photograph of a creator filming a vertical video on a smartphone mounted on a tripod in a dark room. A soft ring light off to one side is the only practical, throwing cool teal-cyan light across the frame; a blue rim light separates the subject from a near-black background. The phone and the hands adjusting it are in sharp focus, the person behind is softly out of focus. Real photography, anamorphic 35mm, filmic grain, shallow depth of field, volumetric haze. No text, no readable screen content, no logos, no watermark. Palette: near-black #07080c, teal #5df2e0, blue #6f9dff. |
| `tbsol-glow.jpg` | 245560 | Abstract cinematic macro photograph of light: concentric glowing rings and fine particle trails floating above a black reflective surface, like a long-exposure light painting. Teal-cyan and electric blue with a whisper of violet, deep near-black background, volumetric haze, heavy bokeh, real anamorphic lens flare. No text, no interface, no screens, no people, no logos, no watermark. Palette: #07080c, #5df2e0, #6f9dff, #b98bff. |
| `tbsol-desk.jpg` | 423655 | Cinematic overhead photograph of a creator's desk at night on near-black matte wood: a smartphone lying screen-down, a small closed notebook, a coffee cup, a clip-on microphone and a coiled cable, arranged with generous empty space. Lit only by cool teal-cyan light raking in from one side with a blue rim, deep shadows, filmic grain, shallow depth of field. Real photography. No text, no logos, no readable screens, no watermark. Palette: near-black #07080c, teal #5df2e0, blue #6f9dff. |

### This run (2026-08-24)

Higgsfield job IDs and their renders — download the PNG, convert, upload under
the target name:

| Target | Job | PNG |
|---|---|---|
| `tbsol-studio.jpg` | `bb21d592-84dd-49ce-9680-a6588f50f2a7` | https://d8j0ntlcm91z4.cloudfront.net/user_3FIUdxi6utIjHcKqlglbncXFd5Q/hf_20260824_183255_bb21d592-84dd-49ce-9680-a6588f50f2a7.png |
| `tbsol-creator.jpg` | `44a3870e-2140-48d0-9c7b-ac8548c38645` | https://d8j0ntlcm91z4.cloudfront.net/user_3FIUdxi6utIjHcKqlglbncXFd5Q/hf_20260824_183255_44a3870e-2140-48d0-9c7b-ac8548c38645.png |
| `tbsol-glow.jpg` | `c6770897-a2cf-4fb8-9cb7-264e10543e85` | https://d8j0ntlcm91z4.cloudfront.net/user_3FIUdxi6utIjHcKqlglbncXFd5Q/hf_20260824_183255_c6770897-a2cf-4fb8-9cb7-264e10543e85.png |
| `tbsol-desk.jpg` | `83a24032-6d57-42d2-9f06-b0325789eb2c` | https://d8j0ntlcm91z4.cloudfront.net/user_3FIUdxi6utIjHcKqlglbncXFd5Q/hf_20260824_183255_83a24032-6d57-42d2-9f06-b0325789eb2c.png |

## Publishing a plate

Download the PNG from Higgsfield, then convert and upload under the name in the
table above — the pages are already pointing at these exact paths:

    magick plate.png -resize 1920x -quality 82 -strip tbsol-glow.jpg

JPEG, 1920px wide, under ~350KB. These sit behind text at 16–30% opacity, so
quality 82 is plenty and the weight matters more than the pixels.

To regenerate a plate, reuse its prompt above with `soul_2` at 2k, 16:9. Keep
the palette line — it is what makes a new plate sit next to the old ones.
