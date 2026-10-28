# The press

This folder prints the profile README. GitHub sets the words; the press prints the sheets: every image on the profile is an SVG drawn here, in the house style of [khaledsaeed.tech](https://khaledsaeed.tech). The site is a 1-bit print run, and so is this: square corners, one 4x4 Bayer lattice for every tone, registration marks where the rules cross the rails, type in the site's own faces set as outlines, so nothing has to load a font.

## How a printing happens

1. `.github/workflows/press.yml` runs every hour at :17. Beirut keeps whole-hour offsets, so that is :17 in Beirut too, in every season.
2. `press/build.mjs` reads the Beirut clock (`lib/clock.mjs`), the content (`content.mjs`) and one number from GitHub (`lib/data.mjs`, the year's contributions), then calls every sheet in `sheets/` for both stocks: near-black for GitHub's dark theme, bone for the light one.
3. `press/proof.mjs` checks the printing against the house rules and the budgets. If it fails, nothing is published and the last good printing stays up.
4. The prints are force-pushed as one orphan commit to the `prints` branch. The README reads them from `raw.githubusercontent.com/.../prints/`, which GitHub serves with a five-minute cache.

Between 01:00 and 07:00 Beirut time the press stops, the same hours the portrait sleeps on the site: the first run after 01:00 pulls the night edition, and nothing is published again until morning.

## The sheets

| Sheet | Files | Moves |
| --- | --- | --- |
| `masthead.mjs` | the hero: name, thesis, the portrait | the plates land in register, he waves once, then breathes and blinks; at night he dozes and the moon turns |
| `rule.mjs` | the four section rules | static |
| `ks30.mjs` | the stack as a 30-pin chip, from the site's datasheet | static |
| `postcard.mjs` | the reply postcard, with a scannable sorting barcode | static |
| `stamps.mjs` | the pane of link stamps | static |
| `slug.mjs` | the colour bar: commits by hour of day in Beirut (`lib/hours.mjs`) | static |

Each sheet exports `print(ctx)` and returns its files. Shared pieces live in `lib/`: `type.mjs` (outlines, and a glyph atlas so each letter is cut once), `dither.mjs` (tones as patterns, with coarser lattices when GitHub scales a sheet down), `sheet.mjs` (rules, rails, registration and crop marks), `palette.mjs`, `glyphs.mjs` (the site's two-plate icons), `mark.mjs` (the K), `code128.mjs`, `sprite.mjs` and `png.mjs` (an indexed PNG encoder and decoder, so the build needs nothing but Node).

## Working on it

Needs Node 22 or newer.

```bash
npm ci
npm run build          # prints into dist/ (asks GitHub for the one number; add -- --offline to skip)
npm run build:night    # the night edition (prints as if it were 01:30 in Beirut)
npm run proof          # the house rules, budgets and README checks
npm run readme         # rewrite README.md from content.mjs
npm run preview        # the README as GitHub renders it, both themes, desktop and phone, into .proof/
npm run shoot -- dist/masthead-dark.svg --widths 846,308 --at 500,3000   # photograph sheets
```

`node press/build.mjs --at <ISO time>` prints any moment; `--data press/fixtures/data.json` prints from a saved figure; `--only masthead,postcard` prints a few sheets.

**Changing what it says.** Identity, stack and principles are the site's (`lib/site.ts` and `lib/content/profile.ts` in khaledsaeed.tech), copied into `content.mjs`. `npm run check:content` compares the two against a checkout of the site next to this one. After an edit, run `npm run readme` and commit `README.md` with the change; the workflow refuses to print from a stale README.

**The portrait.** `assets/portrait.json` holds frames pulled straight off the site's own WebGL portrait. To pull new ones, run the site (`pnpm dev -p 3456` in khaledsaeed.tech), then `npm run capture`: it drives the shader in headless Chrome on a virtual clock, makes him look out of the page and wave, and reads every frame off the canvas, one pixel per dither dot.

**Press hours.** The slug counts commits by Beirut hour over the last year. The per-day counts are kept in the Actions cache; only the 24 totals are printed. With the workflow's own token it counts public repositories; to include private ones, add a fine-grained, read-only `PRESS_TOKEN` secret.

## House rules

`proof.mjs` fails a printing that has: live `<text>`, scripts, `foreignObject` or a font face; any external resource; anything rounded (`rx`, circles, round caps or joins); an em dash or an emoji in anything a visitor reads; a file over its budget; a README image without alt text, with a height (GitHub boxes and rounds those), with whitespace inside its link, or pointing at a print that does not exist.

Fonts: Hanken Grotesk, Geist and JetBrains Mono, under the SIL Open Font License (`fonts/OFL.txt`).
