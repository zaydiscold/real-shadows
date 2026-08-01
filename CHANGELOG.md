# changelog

## 1.2.0

- the sundial holds still. `shadowBearing()` now returns the model's one
  fixed alignment — device top due south (180°) in the northern hemisphere,
  due north (0°) in the southern, flipped by `facing` — instead of a bearing
  that drifted through the day. the old number chased the stylised down-page
  component of the on-screen shadow, so it changed as the sun moved; the
  constant bearing is the point of the sundial: set the phone down once and
  the on-screen lean tracks the real shadow all day

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
