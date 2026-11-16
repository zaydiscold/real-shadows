<p align="center">
  <img src="./assets/banner.svg" alt="real-shadows" />
</p>

<h1 align="center">real-shadows</h1>

<p align="center">shadows that follow the real sun. and at night, the real moon.</p>

<p align="center">
  <img src="https://img.shields.io/badge/gzip-~4.5_kB-B4A7D6?style=flat-square&labelColor=1a1a2e" alt="size" />
  <img src="https://img.shields.io/github/actions/workflow/status/zaydiscold/real-shadows/ci.yml?style=flat-square&labelColor=1a1a2e" alt="ci" />
  <img src="https://img.shields.io/badge/dependencies-0-9b7dff?style=flat-square&labelColor=1a1a2e" alt="zero dependencies" />
  <img src="https://img.shields.io/badge/license-MIT-9b7dff?style=flat-square&labelColor=1a1a2e" alt="license" />
</p>

<p align="center">
  <a href="#what-it-does">what it does</a> · <a href="#install">install</a> · <a href="#quickstart">quickstart</a> · <a href="#from-a-terminal">cli</a> · <a href="#api">api</a> · <a href="#accuracy">accuracy</a> · <a href="#the-sundial">the sundial</a> · <a href="#the-sky-dial">the sky dial</a> · <a href="#every-number-one-line">the numbers</a> · <a href="#how-the-math-works">how the math works</a>
</p>

<br>

<p align="center">
  <a href="https://zaydiscold.github.io/real-shadows/">
    <img src="./assets/film.gif" alt="a day over san francisco: the sun crosses a horizon dial while the shadows under five cards shorten at noon and rake left. at sunset the moon is already rising in the east, the page sweeps to a starry night and the moon swings the shadows back the other way. then the same instant is shown in tokyo, mumbai, london and sydney" width="800" />
  </a>
</p>

<p align="center"><sub>a day and a night over san francisco, then one instant in four other skies. every number on screen is the library's. <a href="https://zaydiscold.github.io/real-shadows/">drag it yourself</a> · <a href="./assets/film.mp4">full film, 1080p mp4</a></sub></p>

<br>

<table>
  <tr>
    <td width="50%"><img src="./assets/still-day.jpg" alt="midday over san francisco: the sun high in the south, every card's shadow short and dropping almost straight down" /></td>
    <td width="50%"><img src="./assets/still-moonrise.jpg" alt="sunset: the sun sits on the west horizon while the moon rises in the east, and the shadows rake long to the east" /></td>
  </tr>
  <tr>
    <td><sub><b>noon.</b> the sun is high, so shadows are short and fall almost straight down.</sub></td>
    <td><sub><b>sunset.</b> the sun is on the horizon and the moon is already up behind you. through twilight the shadows keep the afterglow's direction while the moon fades in, so nothing jumps.</sub></td>
  </tr>
  <tr>
    <td><img src="./assets/still-sweep.jpg" alt="dusk in san francisco: the moon has taken over casting, and the page sweeps to its night theme" /></td>
    <td><img src="./assets/still-night.jpg" alt="just after midnight: the 97 percent lit moon high in the south casts faint, soft shadows under a field of stars" /></td>
  </tr>
  <tr>
    <td><sub><b>handoff.</b> the moon has the shadows now, and the page turns to its night theme from the real sky (<code>data-sky</code>, <code>data-sun</code>), not from a fixed hour.</sub></td>
    <td><sub><b>night.</b> the moon carries on, fainter and softer, scaled by how much of it is lit.</sub></td>
  </tr>
</table>

<br>
<br>

<p align="center">
  <img src="./assets/stars1.svg" alt="·" />
</p>

<br>
<br>

## what it does

computes where the sun actually is, for your latitude, longitude, and the current
moment, and writes the result onto the page as four css custom properties. your
existing `box-shadow` and `text-shadow` rules read them, and every shadow on the
page follows the real light: short and dark at noon, a long rake off to one side
on a summer evening. after sunset the moon takes over, fainter, scaled by how
much of its disc is lit. when nothing is up, shadows settle to a short neutral
offset instead of disappearing.

no network calls, no permissions, no dependencies. the astronomy is computed
locally from the clock, so it works offline, in node, and in any framework or
none. 4.6 kB gzipped as an es module, 3.6 kB as the script-tag build
(checked by `npm run size`).

it also stamps `data-sky="day|golden|dusk|night"` and `data-sun="up|down"` on the
root element, which makes sun-driven theming (golden-hour tints, a dark mode that
flips at actual sunset) one css selector.

<br>
<br>

<p align="center">
  <img src="./assets/stars2.svg" alt="·" />
</p>

<br>
<br>

## install

```bash
npm i real-shadows
```

pnpm, yarn, and bun work the same way (`pnpm add`, `yarn add`, `bun add`).

or skip the install entirely, straight from a cdn, no build step:

```html
<script src="https://cdn.jsdelivr.net/npm/real-shadows@1"></script>
<script>
  RealShadows.realShadows({ lat: 37.77, lon: -122.42 });
</script>
```

`@1` pins the major version, so you get fixes but never a breaking change.

## quickstart

one call, one css line:

```js
import { realShadows } from 'real-shadows';

realShadows({ lat: 37.77, lon: -122.42 });
```

```css
.card {
  box-shadow: var(--rs-x) var(--rs-y) var(--rs-blur) rgb(0 0 0 / var(--rs-alpha));
}
```

that's the whole integration. the library refreshes every five minutes (the
movement between refreshes is sub-pixel, so nothing visibly jumps), recomputes
when a laptop wakes, and pauses while the tab is hidden.

theming hooks, if you want them:

```css
[data-sky='golden'] body { background: #f2e9d8; }   /* golden hour tint */
[data-sun='down'] body   { background: #17171c; }   /* dark when the sun is actually down */
```

### where the location comes from

the library never asks for a location. you pass one in; the three usual sources:

```js
// 1. hardcode a place (a city center is plenty; accuracy is city-level anyway)
realShadows({ lat: 51.51, lon: -0.13 });

// 2. ask the browser (requires a permission prompt)
navigator.geolocation.getCurrentPosition((p) =>
  realShadows({ lat: p.coords.latitude, lon: p.coords.longitude }),
);

// 3. an ip-geo service you already use, or your server's geo headers
```

### a shadow scale

the library writes one offset, the shadow cast by something sitting on the page.
design systems usually want a scale, and a scale falls out of multiplying it: a
thing twice as far off the page throws a shadow twice as long. `calc()` does the
whole job, no extra api.

```css
:root {
  --sm: 0.6;  /* resting on the surface */
  --md: 1;    /* the library's own offset */
  --lg: 2.2;  /* lifted, a modal or a drag */
}
.card   { box-shadow: calc(var(--rs-x) * var(--sm)) calc(var(--rs-y) * var(--sm))
                      var(--rs-blur) rgb(0 0 0 / var(--rs-alpha)); }
.dialog { box-shadow: calc(var(--rs-x) * var(--lg)) calc(var(--rs-y) * var(--lg))
                      calc(var(--rs-blur) * var(--lg)) rgb(0 0 0 / var(--rs-alpha)); }
```

every tier stays on the same sun, so the whole page reads as one light source at
one moment. that is the part a static shadow scale cannot do.

## from a terminal

`npx` runs the package's command without installing it, so this prints the
shadow being cast over a location right now:

```bash
npx real-shadows 37.77 -122.42
```

```
when     2026-07-27T19:39:03.867Z
where    37.77, -122.42
casting  sun
sky      day (sun 69.6deg, up)
caster   alt 69.6deg, az 154.0deg
offset   2.05px, 4.51px
blur     0px
opacity  0.95
tint     rgb(0 0 0)
moon     97% lit, waxing
sundial  aim device top 178deg (s)

css:  box-shadow: 2.05px 4.51px 0px rgb(0 0 0 / 0.95);
```

real output, midday over san francisco: the sun nearly overhead at 69.6 degrees,
so the shadow is short and falls almost straight down.

`--at <iso-date>` asks about another moment. ten hours later, after dark:

```bash
npx real-shadows 37.77 -122.42 --at 2026-07-28T05:30:00Z
```

```
casting  moon
sky      night (sun -21.1deg, down)
caster   alt 21.5deg, az 154.7deg
offset   3.82px, 5.53px
blur     1px
opacity  0.3
moon     98% lit, waxing
sundial  aim device top 189deg (s)
```

the caster hands off to the moon on its own. opacity drops from 0.95 to 0.3, and
the edge picks up a 1px blur because the moon is low. `--json` gives the same
thing machine-readable.

<br>
<br>

<p align="center">
  <img src="./assets/stars3.svg" alt="·" />
</p>

<br>
<br>

## api

### `realShadows(options)`

starts the loop, writes the variables, returns a handle.

| option | default | meaning |
|---|---|---|
| `lat`, `lon` | required | decimal degrees; north and east positive. |
| `element` | `document.documentElement` | where the variables and attributes are written. |
| `prefix` | `'rs'` | custom property prefix: `--rs-x`, `--rs-y`, `--rs-blur`, `--rs-alpha`. |
| `interval` | `300000` | refresh cadence in ms. five minutes moves the offset well under a pixel. |
| `attributes` | `true` | also stamp `data-sky` and `data-sun`. |
| `now` | live clock | a fixed `Date`, or a `() => Date`, for demos and time scrubbers. |
| `onUpdate` | none | called with each written `ShadowVector`. |
| `moon` | `true` | let the moon cast at night; `false` goes straight to the neutral shadow. |
| `minLength`, `maxLength` | `3.8`, `11.4` | offset in px at zenith and at the horizon. |
| `facing` | `'auto'` | which horizon the viewer faces; see below. |
| `twilight` | `true` | carry the shadow continuously through dusk and dawn instead of snapping at the horizon. the afterglow keeps casting from the sun's azimuth until civil dusk (−6°) while the moon fades in. `false` is the hard handoff. |
| `view` | `'front'` | `'front'`: the page is a wall you face, shadows lean east or west and fall down the page. `'top'`: the page is the ground seen from above, and the shadow points straight away from the light through the full circle, north up. |
| `heading` | `0` | for `view: 'top'`: compass bearing of the top of the screen. `handle.setHeading(deg)` updates it live from a device compass. |
| `height` | off | px off the page. when set, length is the real projection `height / tan(altitude)`, capped at `maxLength`. |
| `tint` | `false` | also write `--rs-tint`, an `r g b` triplet: neutral black under the sun, cool blue-gray under the moon. moonlight is physically a touch redder than sunlight, but night vision is rod-driven and blue-biased (the purkinje shift), so moonlit scenes read cold. use it as `box-shadow: ... rgb(var(--rs-tint) / var(--rs-alpha))`. |

the handle: `refresh()` recomputes now, `setLocation(lat, lon)` moves,
`current()` returns the last vector, `stop()` clears everything it wrote.
calling `realShadows()` during server rendering is a safe no-op.

### headless functions

all pure, no dom, importable anywhere: canvas, webgl, or your own applier.

| function | returns |
|---|---|
| `shadowVector(date, lat, lon, opts?)` | `{ source, dx, dy, blur, alpha, altitude, azimuth, sunAltitude, intensity }` |
| `skyPhase(date, lat, lon)` | `{ sky, sunUp, sunAltitude }` |
| `shadowBearing(date, lat, lon)` | `{ degrees, direction, source }` or `null`. see the sundial |
| `sunPosition(date, lat, lon)` | `{ altitude, azimuth }` degrees; azimuth clockwise from north |
| `moonPosition(date, lat, lon)` | `{ altitude, azimuth }`, parallax-corrected |
| `moonIllumination(date)` | `{ fraction, phase, waxing }` |
| `moonBrightLimb(date, lat, lon)` | degrees clockwise from the top of the disc to the lit edge, as the observer sees it. 90 lit on the right, 180 lit underneath like a bowl. draws a moon glyph that leans the way the real one does. within 3° of astronomy-engine |

### which way is the viewer facing

a screen is a vertical plane, so only the light's east or west lean can be shown.
to lean the right way the model assumes you face the equator: south in the
northern hemisphere, north in the southern, which is where the sun spends the
day. `facing: 'south' | 'north'` overrides the guess.

> **note:** the vertical component is a stylisation. on-screen shadows always
> fall *down* the page, deepest at noon, shallow near the horizon. physically
> correct verticals would send shadows up the screen for half the day, which
> reads as broken, not accurate. the horizontal lean, the length, the opacity,
> and the day-to-night handoff are all real.

<br>
<br>

<p align="center">
  <img src="./assets/stars4.svg" alt="·" />
</p>

<br>
<br>

## accuracy

positions come from a compact classical ephemeris (schlyter), checked in ci
against [astronomy-engine](https://github.com/cosinekitty/astronomy), a
jpl-derived reference good to arcseconds. the grid: 13 places from longyearbyen
(78°n) to mcmurdo (78°s), sampled across two years.

| body | max error | mean error |
|---|---|---|
| sun | 0.013° | 0.007° |
| moon | 0.085° | 0.029° |
| moon illumination | 0.0006 | n/a |

0.013 degrees is about 47 arcseconds, a fortieth of the sun's own disc. for a
shadow offset quantised to hundredths of a pixel, anything past a tenth of a
degree is invisible; the extra precision is free, so it ships. the test suite
*asserts* sun < 0.05° and moon < 0.2° on every commit, so the table above is
enforced, not aspirational.

the moon's position includes topocentric parallax, the roughly one-degree shift
from the observer standing on the earth's surface rather than at its centre.
that shift is the difference between "the moon has risen" and "not yet".

two conventions worth knowing. all returned altitudes are **geometric**:
atmospheric refraction (about half a degree of lift at the horizon) is exported
as `refraction(altitude)` for anyone who wants apparent altitudes, but is not
baked into positions, so a comparison against a sunrise app will differ by
about that much right at the horizon (the day-to-night *handoff* does use the
refracted threshold of −0.833°, so shadows still switch at sunset as your eyes
see it). and on unusable coordinates `skyPhase` falls back to
`{ sky: 'day', sunUp: true }`; an auto dark mode built on it fails light,
not dark.

## the sundial

`shadowBearing(date, lat, lon)` returns the compass bearing to point your
device's top edge so the shadows on screen line up with the real shadows on
your desk:

```js
const b = shadowBearing(new Date(), 37.77, -122.42);
// { degrees: 149.2, direction: 'sse', source: 'sun' }
```

aim the top of the phone at 149° and the shadow under a card on screen runs
parallel to the shadow under your coffee cup. the round trip (device bearing
plus on-screen shadow angle equals the true shadow bearing) closes within a
hundredth of a degree in the test suite, over 500 random places and moments.

the bearing is yours: it depends on where you stand and when you ask, and it
moves through the day as the sun does. that is not drift, it is the point:
the on-screen vertical is stylised (always down the page), so the rotation
that reconciles screen and sky has to change as the light swings. same
formula, same number, as the sundial on [zayd.wtf](https://zayd.wtf).

## the sky dial

<p align="center">
  <img src="./assets/sky-dial.gif" alt="a horizon dial scrubbed through 24 hours: the sun and a half-lit moon travel their real arcs from east to west, and the readout underneath says which one is casting the page's shadows" width="800" />
</p>

<p align="center"><sub>a full day, scrubbed. live on <a href="https://zayd.wtf/unstructured/lesson1/">zayd.wtf</a>, where the same model lights the page.</sub></p>

the same numbers drawn as a picture. the horizon runs east, south, west; the
sun and the moon sit at their real altitude and azimuth for your location, each
on the dotted track it will actually follow today, and the moon is drawn lit on
the side `moonBrightLimb()` says faces the sun. dragging the slider runs the clock
twelve hours either way, and the line underneath reads what `shadowVector`
returns: who is up, how high, how much of the moon is lit, and which of them is
casting the shadows on the page.

everything it needs is public api:

```js
import { sunPosition, moonPosition, moonIllumination, moonBrightLimb, shadowVector } from 'real-shadows';

const at = new Date();
const sun = sunPosition(at, lat, lon);      // { altitude, azimuth } in degrees
const moon = moonPosition(at, lat, lon);    // same shape
const { fraction } = moonIllumination(at);  // 0 new, 1 full
const limb = moonBrightLimb(at, lat, lon);  // degrees clockwise from the top of the disc to the lit edge
const { source } = shadowVector(at, lat, lon); // 'sun' | 'moon' | 'none' | 'default'
```

## every number, one line

everything the library reports (in the demo readout and in
`npx real-shadows`) with the line of math that produces it, so any number on
the screen can be checked by hand:

| number | the line | proven by |
|---|---|---|
| caster alt/az | schlyter's classical ephemeris; moon topocentric | oracle in ci vs astronomy-engine: sun < 0.05°, moon < 0.2° |
| sky | sun altitude bands: ≥ 6° day, ≥ −6° golden, ≥ −12° dusk, else night | handoff tests at fixed dates |
| length | `min + (max − min) · (1 − alt/90)^1.45` | monotonic-in-altitude unit test |
| offset x | `±sin(azimuth) · length`: the light's true east-west lean; sign from `facing` | model units, signs checked in the demo |
| offset y | `(0.4 + 0.6 · sin(alt)) · length`: stylised, always down the page | model units |
| opacity | `(0.17 + 0.83 · sin(alt)) · intensity`, floored at 0.17, clamped to 1 | clamp and floor tests |
| blur | `round((1 − sin alt)² · 2)` px | bounds test |
| moon intensity | lunar phase law (allen), fourth-root compressed: full 1.0, half ~0.55 | scaling test |
| sundial | `(azimuth + 180) − atan2(dx, −dy)`, mod 360 | round trip < 0.01° over 500 random places and moments |

the handoff rule threading them together: the sun casts down to −0.833° (the
refracted horizon). below that the three lights are blended, not swapped:
`w_sun = 1 − S((−0.833° − alt) / 5.167°)` fades the afterglow out by civil
dusk, `w_moon = (1 − w_sun) · S(moonAlt / 4°)` fades the moon in, and whatever
is left goes to the neutral fallback `(minLength, minLength, minAlpha)`.
`S(u) = 3u² − 2u³`. a test walks 40 days in three cities minute by minute and
asserts the shadow never moves more than 2px in a step.

<br>
<br>

<p align="center">
  <img src="./assets/stars5.svg" alt="·" />
</p>

<br>
<br>

## how the math works

three steps, all local arithmetic:

1. **ephemeris.** the sun's and moon's orbital elements are propagated from the
   j2000 epoch (schlyter's method: kepler's equation, one newton step, the
   twelve largest lunar perturbations), then rotated through the ecliptic and
   the observer's sidereal time into altitude and azimuth. the moon's altitude
   is then dropped by its parallax. ~200 lines, no lookup tables.

2. **the lighting model.** altitude sets the length, `min + (max−min) ·
   (1−alt/90)^1.45`, the exponent leaning the stretch toward the horizon so a
   low sun rakes dramatically while noon stays short. altitude also sets the
   opacity, which breathes from 1.0 overhead down to 0.17 at the horizon.
   azimuth sets the lean. edges stay hard except within a couple of degrees of
   the horizon, where real shadows genuinely diffuse (blur ≤ 2px).

3. **the handoff.** when the sun drops below −0.833° (the refracted horizon:
   sunset as your eyes define it), the moon starts to take over if it's up. it
   is a crossfade, not a switch: a near-full moon rises opposite the setting
   sun, so a hard swap would throw every shadow across the page in one step.
   the afterglow keeps casting from the sun's azimuth until civil dusk (−6°)
   while the moon fades in. its strength
   follows the real lunar phase law (a half moon is 9% as bright as full, not
   50: rough terrain shadows itself at every angle except opposition),
   compressed with a fourth root so partial phases stay visible, times a 0.7
   stylisation factor. real moonlight is five orders of magnitude fainter than
   sunlight; rendering that honestly would render nothing.

## what it is not

not a sunrise/sunset calendar (no event times, no eclipses; use suncalc or
astronomy-engine for that), not a soft-shadow renderer (offsets stay crisp by
design), not a geolocation library (bring your own coordinates), and not
sub-arcsecond astronomy (it is a lighting model with honest inputs).

<br>
<br>

<p align="center">
  <img src="./assets/wisps.svg" alt="" />
</p>

<br>
<br>

<p align="center"><strong>zayd / cold</strong></p>

<p align="center">
  <a href="https://zayd.wtf">zayd.wtf</a> · <a href="https://x.com/coldcooks">twitter</a> · <a href="https://github.com/zaydiscold">github</a>
  <br>
  <em>icarus only fell because he flew</em>
</p>
