# GTFOH photos

The page ships with real job photos cropped from the Google Business Profile (`img/*.jpg`). They're low-res, so swap them for one of these when you can:

1. **Best:** original photos from the owner (same subjects, full resolution).
2. **Higgsfield renders.** These hit the account's daily generation limit on 2026-10-19, so run them once it resets. Model `gpt_image_2_5`, quality `high`, resolution `2k`. Save into `img/` and point `GTFOH.photos` in `index.html` at them.

Generated images go in the hero and service tiles only. Keep "Real jobs. Real trailer." limited to his actual photos.

| Slot (`GTFOH.photos`) | File | Aspect | Prompt |
|---|---|---|---|
| `heroBack` / `heroFront` | `hero.jpg` | 4:5 | Photorealistic editorial photo, golden hour in a leafy Pennsylvania suburban neighborhood. A steel-blue mid-size SUV (boxy 4Runner-style) parked at the curb, hitched to a black tandem-axle dump trailer with tall raw pine plank side boards and red-and-white reflective tape along the frame. The trailer is heaped with old household junk: a worn brown leather sectional, a mattress, a dresser, black contractor bags, a broken recliner. Low rear three-quarter angle, shallow depth of field, warm sun flare. No people, no text, no logos, no plate characters. 35mm, crisp, natural colors with cool blue shadows. |
| `furniture` | `carry.jpg` | 4:3 | Two workers in plain black t-shirts and work gloves carrying a bulky old fabric sofa down the front steps of a brick Pennsylvania twin home toward the street. Shot from behind and the side, faces not visible, late afternoon light. No text or logos. Documentary style, 35mm. |
| `cleanout` | `garage-before.jpg` | 4:3 | A cluttered suburban two-car garage packed with boxes, an old refrigerator, a treadmill, bikes, broken furniture and black trash bags, door open, daylight spilling in. No people, no text. 35mm documentary. |
| (spare) | `garage-after.jpg` | 4:3 | The same kind of two-car garage completely empty and swept clean, bare concrete, pegboard wall, door open with soft daylight. No people, no text. |
| (spare) | `fridge.jpg` | 4:3 | Gloved hands wheeling an old white refrigerator on a hand truck down a driveway toward a black dump trailer with raw pine plank sides. Face not visible. Overcast soft light. No text. |
| (spare) | `debris.jpg` | 4:3 | Renovation debris pile in a driveway: torn-out kitchen cabinets, drywall scraps, old laminate flooring, splintered deck boards, next to a black dump trailer with raw pine plank side boards. Late day light. No people, no text. |
