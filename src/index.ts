/**
 * real-shadows — shadows that follow the real sun.
 *
 * Computes where the sun, or at night the moon, actually is for a location,
 * and turns that into a shadow offset you can hand straight to CSS.
 */

export {
  toJulian,
  fromJulian,
  refraction,
  sunPosition,
  moonPosition,
  moonIllumination,
  type Horizontal,
  type Equatorial,
  type MoonIllumination,
} from './ephemeris.js';

export {
  shadowVector,
  shadowBearing,
  skyPhase,
  compassLabel,
  type ShadowVector,
  type ShadowOptions,
  type ShadowSource,
  type Facing,
  type Sky,
  type SkyState,
  type Bearing,
} from './shadow.js';

export { realShadows, type RealShadowsOptions, type RealShadowsHandle } from './apply.js';
