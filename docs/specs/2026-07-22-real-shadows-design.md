# real-shadows — design spec

**Date:** 2026-07-22
**Status:** approved design, pre-implementation
**Origin:** extracted from zayd.wtf's `sky-almanac.js` (the sun/moon-driven shadow system)

## Pitch

> Your UI's shadows follow the real sun.

A zero-dependency (~3 KB gzipped) JavaScript library that computes where the sun
— or at night, the moon — actually is for a given location, and drives CSS
shadows to match. Noon → short, dark, straight down. Summer evening → long rake
to the left. Full-moon night → faint silver offset. Nothing up → a neutral
resting shadow.

## Scope

**In:**
- Schlyter low-precision ephemeris: sun + moon geocentric position → topocentric alt/az
- The shadow model `shadowVector()`: alt/az → `{dx, dy, alpha, source, alt, az}`
  with the day→moon→none handoff (moon intensity scaled by illuminated fraction)
- CSS applier `realShadows()`: writes custom properties + sky attributes on a schedule
- Sky-phase classifier: `data-sky="day|golden|dusk|night"` (sun altitude bands
  +6°/−6°/−12°) and `data-sun="up|down"` (raw horizon fact)
- Sundial `shadowBearing()`: the compass bearing to aim the device's top edge so
  on-screen shadows align with real desk shadows (math verified — see Accuracy)
- Moon illumination fraction (needed for night intensity; simplified synodic model)

**Out (stays on zayd.wtf):** meteor showers, events almanac, moon glyphs/SVG,
copy lines, travel.json bootstrap, the me⇄you perspective bus, twilight paper
tints.

**Location is bring-your-own** `{lat, lon}`. The library makes zero network
calls, requests zero permissions, and works offline and in Node. The README
documents the three ways users typically get a location (hardcoded city,
`navigator.geolocation`, IP-geo service) without shipping any of them.

## API

```js
import { realShadows, shadowVector, shadowBearing, skyPhase,
         sunPosition, moonPosition } from 'real-shadows';

// magic one-liner — writes CSS vars + attributes, refreshes every 5 min
const handle = realShadows({ lat: 37.77, lon: -122.42 });
handle.update({ lat, lon });  // move (returns nothing; re-applies immediately)
handle.now();                 // current shadowVector result
handle.stop();                // clear interval, remove vars/attributes
```

```css
/* one line converts any element */
.card { box-shadow: var(--rs-x) var(--rs-y) var(--rs-blur) rgb(0 0 0 / var(--rs-alpha)); }
[data-sky="night"] .card { /* optional theming hooks */ }
```

### `realShadows(options)`

| option | default | meaning |
|---|---|---|
| `lat`, `lon` | required | decimal degrees, lon east-positive |
| `minLength` | `3.45` | px offset when the light is overhead |
| `maxLength` | `10.35` | px offset when the light grazes the horizon |
| `interval` | `300000` | refresh ms (sub-pixel steps between refreshes → reduced-motion safe) |
| `element` | `document.documentElement` | where vars + attributes land |
| `prefix` | `'rs'` | CSS var prefix (`--rs-x` …) |
| `moon` | `true` | hand off to the moon at night; `false` → straight to the neutral fallback |
| `date` | live clock | fixed `Date` or `() => Date` for demos/time-scrubbers |

Writes: `--rs-x`, `--rs-y`, `--rs-blur` (0 at high sun, ≤2 px near horizon),
`--rs-alpha` (breathes with altitude; moon far dimmer), `data-sky`, `data-sun`.
No location / bad coords → the classic top-left default vector, vars still set
(CSS never breaks).

### Headless exports (for canvas / three.js / React / art)

- `shadowVector(date, lat, lon, opts?)` → `{ dx, dy, alpha, source: 'sun'|'moon'|'none', alt, az, sunAlt, intensity }`
- `shadowBearing(date, lat, lon)` → `{ deg, dir }` or `null` (nothing up)
- `skyPhase(date, lat, lon)` → `{ sky: 'day'|'golden'|'dusk'|'night', sunUp: boolean, sunAlt }`
- `sunPosition(date, lat, lon)` / `moonPosition(date, lat, lon)` → `{ alt, az }` (+ `illum` on moon)

All pure, no DOM, importable in Node.

## Shadow model (ported as-is, constants become options)

- Length: `min + (max − min) · (1 − alt/90)^1.45` — the 1.45 exponent leans the
  curve toward the horizon for the long-summer-evening stretch
- Direction: "facing the southern sky" mapping, exact site formula:
  `dx = sin(az)·len` (morning sun in the east → shadow to the lower-right; evening
  sun in the west → lower-left), `dy = (0.4 + 0.6·sin(alt))·len` — always downward,
  deepest when the light is highest. The light rakes right → down → left across the day.
- Alpha: `0.15 + 0.85·sin(alt)` sun / `(0.12 + 0.5·sin(alt))·intensity` moon,
  ×1.15 display boost, clamped [0.1, 1]
- Moon intensity: `0.45 + 0.55·illuminatedFraction`
- Blur: `round((1−sin(alt))² · 2)` px — hard edges except a whisper at the horizon
- Handoff: sun below −0.833° (refracted horizon) → moon if up → else neutral
  `{min, min, alpha 0.16}`

## Accuracy (verified 2026-07-22, and shipped as the test suite)

Compared against SunCalc across 5 latitudes (Reykjavik 64°N → Sydney 33°S,
including the equator) × 3 seasons:

- **Sun: max angular error 0.21°** — invisible in a shadow offset
- **Moon: ≤ ~0.4° alt / ~1.6° az** (geocentric model, no topocentric parallax)
- **Sundial round-trip closes within 0.2°:** aiming the device top at
  `shadowBearing().deg` puts the on-screen shadow angle on the true real-world
  shadow bearing (`realBearing = az + 180`; `deg = realBearing − atan2(dx, −dy)`)

CI runs this as the oracle test (SunCalc is a **dev**-dependency only), asserting
sun < 0.3° and moon < 2° — the README's accuracy claim is continuously proven,
not asserted.

## Repo & packaging

- `~/Desktop/real-shadows/` → github.com/zaydiscold/real-shadows, npm `real-shadows` (confirmed available), MIT
- TypeScript source, tsup build → ESM + CJS + IIFE (`RealShadows` global for script tags), full `.d.ts`
- Structure: `src/ephemeris.ts` (Schlyter math), `src/shadow.ts` (model),
  `src/apply.ts` (DOM applier), `src/index.ts`; `test/` (vitest: oracle +
  model units + sundial round-trip + handoff edges); `demo/` (static page:
  location picker + time scrubber — drag through the day, watch the light rake
  right → down → left)
- README: demo GIF, quickstart (the one-liner + one CSS line), accuracy section,
  sundial section, "how the math works" (Schlyter, in Zayd's voice), BYO-location
  recipes, headless usage
- Demo hosting: GitHub Pages from `demo/`; zayd.wtf may later link or embed it
- zayd.wtf becomes the first consumer eventually (replace the inlined shadow
  portion of sky-almanac.js with the package) — **separate later project, not
  part of v1**

## Error handling

- Invalid/missing lat/lon → default vector, no throw (matches site behavior)
- SSR/Node: `realShadows()` no-ops without `document` (returns inert handle);
  headless functions always work
- `Date` invalid → treated as `new Date()`

## Testing

1. Oracle accuracy suite (above)
2. Shadow-model units: length monotonic in altitude, alpha clamps, blur bounds,
   moon intensity scaling, neutral fallback values
3. Handoff: sun-up / moon-up / neither, at a fixed date+location table
4. Sundial round-trip property test across random dates/locations (skip when source='none')
5. DOM applier: vars written/removed, prefix respected, stop() cleans up (happy-dom)

## Non-goals

- No geolocation/IP lookups, no network, ever
- No React/Vue wrappers in v1 (CSS-var contract makes them unnecessary)
- No rise/set times, no eclipses, no meteor anything
- No sub-0.2° precision chasing — accuracy appropriate to the output medium
