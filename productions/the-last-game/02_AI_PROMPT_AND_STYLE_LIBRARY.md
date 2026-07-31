# THE LAST GAME — AI PROMPT & STYLE LIBRARY
### Reusable generation system for Midjourney · Higgsfield · Runway · Kling (franchise-wide)

> Paste the **Style Suffix** onto EVERY image prompt so all 8 episodes look like one film. Use the **Character Sheets** to keep faces consistent across shots (generate each character sheet once, then use `--cref` / character-reference / seed-lock features).

---

## 1. GLOBAL STYLE SUFFIXES (append to every prompt)

**COMPTON / STREETS world:**
```
, warm sodium-vapor amber, crushed teal shadows, anamorphic lens, halation on light sources, heavy 35mm film grain, 2.39:1, prestige Netflix documentary-drama, shot on Kodak Vision3, --ar 2.39:1 --style raw
```

**POWER world (Beverly Hills / federal / CIA / prison bureaucracy):**
```
, cold desaturated institutional blue-grey, clinical white, hard shadows, symmetrical composition, locked tripod, subtle fluorescent flicker, 35mm, 2.39:1, prestige documentary, --ar 2.39:1 --style raw
```

**ARCHIVAL / "the record" (Reagan, Battering Ram, Iran-Contra, data cards):**
```
, VHS tape texture, CRT scanlines, chromatic aberration, tracking distortion, 1980s broadcast news look, timestamp overlay, degraded, --ar 4:3
```

**Negative / avoid (Midjourney `--no`, or omit in RW/KL):** `--no modern cars, smartphones, LED lights, clean digital sheen, cartoon, cgi plastic skin, text artifacts, watermark`

---

## 2. CHARACTER CONSISTENCY SHEETS
*Generate each once as a front/¾/profile sheet, save the seed / character-reference, reuse everywhere. All are dramatized recreations of real figures/composite roles — cast look-alikes for live action; for AI, describe type, not a named living person's likeness, to stay rights-safe.*

### CHICO (young, 15 — Act 2)
```
character reference sheet, 15-year-old African American boy, 1980, short natural hair, expressive serious eyes, lean, plain blue t-shirt, front / three-quarter / profile views, neutral studio, consistent face, cinematic, film grain --ar 16:9 --style raw
```

### CHICO (early 20s, kingpin peak — Act 3)
```
character reference sheet, early-20s African American man, 1985, confident, sharp jaw, thin mustache, 1980s Versace-style suit and gold chain, front / three-quarter / profile, consistent face, cinematic, film grain --ar 16:9 --style raw
```

### CHICO (narrator, present day — VO framing shots)
```
character reference sheet, weathered dignified African American man in his late 50s, close-cropped greying hair, calm knowing eyes, simple dark shirt, front / three-quarter / profile, warm low-key portrait light, cinematic, film grain --ar 16:9 --style raw
```

### NORMAN (best friend, 15)
```
character reference sheet, cheerful 15-year-old African American boy, 1980, bright genuine smile, short afro, blue and black clothing, front / three-quarter / profile, warm light, consistent face, film grain --ar 16:9 --style raw
```

### TONE (the mentor, late 20s)
```
character reference sheet, charismatic late-20s African American man, 1983, flashy 1980s style, gold, confident smirk, front / three-quarter / profile, warm nightclub light, consistent face, film grain --ar 16:9 --style raw
```

### "GRANDPA CRIP" (the father, 50s–60s)
```
character reference sheet, stern loving 55-year-old African American man, 1970s, weathered hands, work shirt, Louisiana-to-California dignity, front / three-quarter / profile, warm lamp light, film grain --ar 16:9 --style raw
```

### PENNY-TYPE (director/mentor, warm, 40s) — *cast a look-alike; AI as archetype only*
```
character reference sheet, warm funny white woman film director in her mid-40s, 1988, curly dark hair, kind eyes, casual chic, front / three-quarter / profile, golden affectionate light, film grain --ar 16:9 --style raw
```

### GARY WEBB-TYPE (investigative journalist, early 40s) — *Ep 104; archetype*
```
character reference sheet, intense early-40s white male investigative journalist, early 1990s, glasses, rumpled shirt, heavy briefcase, front / three-quarter / profile, cold institutional light, film grain --ar 16:9 --style raw
```

### BLANDON-TYPE (the supplier/informant, pudgy, 40s) — *Ep 102–104; archetype*
```
character reference sheet, cocksure pudgy Latino man in his 40s, late 1980s, disarming smile that never reaches the eyes, gold watch, front / three-quarter / profile, warm-then-cold light, film grain --ar 16:9 --style raw
```

---

## 3. HERO LOCATION PLATES (reuse for coverage)

- **Nord Street block** — `1970s Compton residential block, bungalows, chain-link, leaning palm, cracked sidewalk` + street suffix
- **The freeway underpass** (Norman) — `concrete freeway overpass, cracked asphalt below, morning haze` + street suffix
- **The church** — `modest Black Baptist church interior, stained-glass shafts, wooden pews` + street suffix
- **Victory Park** — `1970s Little League baseball diamond, chain-link backstop, Super-8 warmth` + `Super-8, 8mm, warm flicker`
- **Beverly Hills / Bijan** — `opulent 1988 Beverly Hills luxury boutique, marble, glass` + power suffix
- **The Forum courtside** — `1980s NBA arena courtside, golden light` + street suffix (warm exception)
- **Federal courthouse** — `cold 1988 federal courthouse interior, venetian blinds` + power suffix
- **Prison courtyard** — `high concrete prison courtyard, small high windows` + power suffix

---

## 4. SIGNATURE MOTIF PLATES (macro inserts, used across all 8 eps)

- **Dice** — `extreme macro two red dice on cracked asphalt, golden raking light, shallow` + street suffix
- **Kilo brick** — `a taped kilo brick on a table, cold light` + power suffix
- **Crack rock** — `a single rock on cracked pavement, macro` + street suffix
- **Chess pieces** — `chess pieces scattered on a dark board, one king toppling, dramatic light`
- **Chain-link fence / open gate** — `chain-link fence dissolving into an open gate, backlit, symbolic`
- **Shattered iPhone** (redemption payoff, Ep 107/108) — `an old iPhone with a shattered cracked screen filming, poetic, macro`
- **Red/blue light** — `red and blue police light pulsing across a concrete wall at night`

---

## 5. VIDEO-MODEL TIPS (per engine)

- **Runway (Gen-3/4):** best for *subtle in-shot motion* (dust, parallax, grade migration, push-ins). Keep prompts to ONE action verb. Use image-to-video from your MJ still for consistency.
- **Kling:** best for *character motion & lip areas, slow-mo, morph transitions* (dice→crack, baseball→brick). Use start+end frame keyframing for the morphs.
- **Higgsfield:** best for *camera-move DNA* (360 orbit, crash-zoom, dolly, FPV) — lead every HF prompt with the CAMERA MOVE, then subject, then grade.
- **Midjourney:** all stills, plates, character sheets, thumbnails. `--style raw` + suffix always. Use `--cref [url]` for face consistency, `--sref` to lock the franchise look across a whole batch.

**Pipeline:** MJ still → (upscale) → image-to-video in RW/KL for motion → grade to the two-world LUT in post → cut to the master script.
