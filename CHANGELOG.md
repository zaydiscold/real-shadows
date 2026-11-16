# changelog

## 1.2.0

- twilight is continuous. the sun-to-moon handoff used to snap the shadow from
  one side of the page to the other in a single step (about 22px at default
  lengths). the sun's shadow now relaxes through civil twilight, cast by the
  afterglow from where the sun went down, while the moon's fades in; a rising
  or setting moon eases over its first four degrees. full day and full night
  are unchanged. `twilight: false` restores the hard handoff
- `view: 'top'`: the page as the ground seen from above. the shadow points
  straight away from the light through the full circle, north up, instead of
  only leaning east or west. `heading` (and `handle.setHeading()`) rotates it
  to a device compass, so a phone lying flat shows shadows parallel to the
  real ones
- `moonBrightLimb(date, lat, lon)`: which way the lit edge of the moon faces
  for an observer (bright-limb position angle minus the parallactic angle), so
  a drawn moon can lean the way the real one does: on its back near the
  equator, mirrored in the southern hemisphere. checked against
  astronomy-engine across the 13-place grid, worst case under 3 degrees
- `height`: length from the real projection, `height / tan(altitude)`, capped
  at `maxLength`, in place of the stylised curve
- moon-cast shadows no longer drop below the "nothing up" opacity. a thin moon
  on the horizon used to resolve as low as 0.02, fainter than no moon at all
  (0.17), so a page lost depth at moonrise. about a quarter of moonlit moments
  were affected
- `interval` of 0, NaN or a negative number falls back to five minutes instead
  of handing setInterval a runaway loop
- an empty or invalid `prefix` falls back to `rs` instead of writing `---x`

## 1.1.1

- cli: reject unknown flags instead of silently running with "now". a typo
  like `--date` (for `--at`) used to be ignored and print the current moment
  with exit 0; it now fails with the usage text
- fresh readme gif and social card, re-recorded from the current demo ui

## 1.1.0

- `npx real-shadows <lat> <lon>` prints the shadow being cast over a location
  right now, with `--at` for another moment and `--json` for scripts. lets you
  check the numbers, and watch the sun/moon handoff, without wiring up a page

## 1.0.0

initial release.

- sun and moon ephemeris (schlyter), oracle-tested against astronomy-engine
  on every ci run: sun < 0.05°, moon < 0.2° (topocentric parallax applied)
- the shadow model: length and lean from altitude and azimuth, hemisphere-aware
  facing, the sun→moon→neutral handoff at the refracted horizon
- moon intensity follows the lunar phase law (allen), fourth-root compressed:
  full 1.0, half ~0.55, crescent ~0.44. not a linear ramp in the lit fraction
- opt-in `tint`: `--rs-tint` r g b triplet, cool blue-gray under the moon
  (perceptual, purkinje shift), neutral black otherwise
- css custom-property applier with visibility pause, wake refresh, and a
  clean `stop()`; `data-sky` / `data-sun` attributes for theming
- `shadowBearing()`: the sundial. aim the device top at the bearing and
  on-screen shadows run parallel to real ones (round trip < 0.01°)
