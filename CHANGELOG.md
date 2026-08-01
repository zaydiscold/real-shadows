# changelog

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
