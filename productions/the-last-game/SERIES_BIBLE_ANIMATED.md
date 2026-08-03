# THE LAST GAME — Animated Series Bible
*Locked foundation for the animated adaptation.*

## ⭐ HOUSE STYLE (LOCKED): "HUB CITY"
The signature, original look of the channel — designed to go viral like the top faceless
cartoon accounts (Dimpey Studios, StickTales) while staying unmistakably *ours*.

- **Line & color:** thick confident uniform black ink outlines + flat punchy saturated
  color (thumbnail-readable), with a **gritty halftone texture + cinematic noir lighting**.
- **Characters:** large half-lidded, attitude-filled eyes; simple but characterful.
- **Signature palette:** warm amber/sepia base + bold pops of **Blood-red & Crip-blue** +
  deep shadow (the Compton/flag motif).
- **Format (every video):** persistent **top caption "POV/hook" bar** + one **huge bold
  outlined WORD payoff**; fast cuts; ends on "…follow for the story / The Last Game."
- **Locked CHICO (HUB CITY) reference:** `https://d8j0ntlcm91z4.cloudfront.net/user_3FIUdxi6utIjHcKqlglbncXFd5Q/hf_20260803_231047_f35149fa-f305-4b59-8c26-8e9d3deb4df7.png` — job `f35149fa-f305-4b59-8c26-8e9d3deb4df7`
- **Style prompt token (paste into every generation):** *"original 'HUB CITY' signature style — bold graphic-novel cartoon, thick black ink outlines, flat punchy saturated color, gritty halftone texture, cinematic noir lighting, warm-amber base with Blood-red & Crip-blue pops, large half-lidded attitude eyes, mobile-first high-contrast, NOT photoreal, NOT 3D."*

> The earlier Boondocks-anime pass (below) is archived as an alternate; **HUB CITY is the
> production style going forward.**

---

## (Archived alt) Boondocks-style anime
*Style: 2000s adult anime (Madhouse/Boondocks-influenced) applied to 1980s Compton.*

## House style
Clean cel shading, thick black linework, expressive angular character designs, cinematic anime lighting, muted warm urban palette. Hand-drawn anime look — never photoreal, never 3D. Vertical 9:16 for the short-form series. Two-world grade: warm Compton amber for the streets, cold blue for loss/power.

## Locked character designs (reference-locked so the cast is identical every episode)
- **CHICO** (teen lead / adult narrator): `https://d8j0ntlcm91z4.cloudfront.net/user_3FIUdxi6utIjHcKqlglbncXFd5Q/hf_20260802_155953_e9cc9149-4bc0-4fc4-87b7-da39a3e9756c.png` — job `e9cc9149-4bc0-4fc4-87b7-da39a3e9756c`
- **NORMAN** (best friend): `https://d8j0ntlcm91z4.cloudfront.net/user_3FIUdxi6utIjHcKqlglbncXFd5Q/hf_20260802_160004_c8c42c65-0e87-4090-a964-12d5655e6e47.png` — job `c8c42c65-0e87-4090-a964-12d5655e6e47`
- **TITLE LOGO / sting**: `https://d8j0ntlcm91z4.cloudfront.net/user_3FIUdxi6utIjHcKqlglbncXFd5Q/hf_20260802_160030_d63907a5-a821-49a3-b9c8-a3a6e4cf906a.png` — job `d63907a5-a821-49a3-b9c8-a3a6e4cf906a`

> Reuse these job ids as image references in every scene generation to keep characters/logo consistent across episodes.

## Voices (cast)
- **Narrator** — adult Chico looking back: warm, weathered, reflective.
- **Teen Chico** — younger, guarded.
- **Norman** — younger, warm/upbeat.
(Distinct seed_audio voices, reused per character every episode.)

## Episode format (premium 60–90s, vertical)
**Cold open (hook) → title sting → dialogue scenes (characters actually talk) → cliffhanger + end card.** Score under the whole thing, ducked beneath the voices. Burned captions.

---

## EPISODE 1 — "NORMAN" (script)
1. **COLD OPEN** — Chico & Norman laughing on a Compton block, golden hour.
   - NARRATOR (VO): *"This is the last morning I ever saw my best friend alive."*
   - NORMAN: *"All or nothin', Cheek — you got this!"*
2. **TITLE STING** — the logo ignites on black, red+blue underline, musical hit: **THE LAST GAME.**
3. **THE BRIDGE** — teens shooting dice under the freeway.
   - TEEN CHICO: *"Parlay!"*
   - NARRATOR (VO): *"We should've been in school. Instead we were under the bridge, chasing a hot streak."*
4. **THE RIVALS** — two kids roll past on a bike.
   - RIVAL: *"What's up, Blood!"*
   - NARRATOR (VO): *"In Compton, the wrong color on the wrong block was a death sentence."*
5. **THE MOMENT** — a homie grabs Norman.
   - CHICO/HOMIE: *"Get down!"*
   - NORMAN: *"Nah — I ain't runnin'."*
   - (Gunshot implied by a stark flash + hard cut to silence. No gore.)
6. **AFTERMATH** — wide, cold blue, Chico cradling Norman on the pavement.
   - NARRATOR (VO, breaking): *"Fifteen years old. And I carried my best friend off that pavement myself."*
7. **CLIFFHANGER + END CARD** — Chico's face hardens; cut to logo.
   - NARRATOR (VO): *"I didn't know it yet — but that morning started a war that ran all the way to the White House. This is The Last Game."*

## Production pipeline (per episode)
still (w/ character refs) → image-to-video clip → per-line voice takes → `explainer_video` assemble + burned captions → generate score → `sandbox_exec` ffmpeg mix score under voices → publish → write `video_url` to `tlg_segments`.
