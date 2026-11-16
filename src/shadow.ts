/**
 * The lighting model: turns a sun or moon position into a shadow offset.
 *
 * The sun is the light source whenever it is above the horizon. Below it, the
 * moon takes over, scaled by how much of its disc is lit. When neither is up
 * the shadow settles to a short neutral offset rather than vanishing, so a
 * layout does not lose its depth at 3am.
 */

import { moonIllumination, moonPosition, sunPosition } from './ephemeris.js';

/** Which body is casting, or `none` when nothing is above the horizon. */
export type ShadowSource = 'sun' | 'moon' | 'none' | 'default';

/**
 * Which way the observer is taken to be facing when the sky is flattened onto
 * a screen.
 *
 * A screen is a vertical plane, so only the light's left-right lean can be
 * shown; the model needs to know which horizon the viewer faces to get that
 * lean the right way round. `auto` faces the equator, which is what people
 * do: south in the northern hemisphere, north in the southern.
 */
export type Facing = 'auto' | 'south' | 'north';

export interface ShadowOptions {
  /** Offset in px when the light is directly overhead. Default 3.8. */
  minLength?: number;
  /** Offset in px when the light is on the horizon. Default 11.4. */
  maxLength?: number;
  /**
   * Curve of length against altitude. Default 1.45, which leans the stretch
   * toward the horizon so a low sun rakes noticeably while noon stays short.
   * 1 is linear; higher values delay the stretch further.
   */
  falloff?: number;
  /** Opacity when the light is on the horizon. Default 0.17. */
  minAlpha?: number;
  /** Opacity when the light is directly overhead. Default 1. */
  maxAlpha?: number;
  /** Blur in px when the light is on the horizon. 0 keeps every edge hard. Default 2. */
  maxBlur?: number;
  /** Let the moon cast once the sun is down. Default true. */
  moon?: boolean;
  /**
   * Opacity of a full moon's shadow relative to the sun's at the same
   * altitude. Default 0.7. Real moonlight is some five orders of magnitude
   * fainter, which would leave nothing on screen; this is the readable
   * stylisation of "dimmer, and cooler".
   */
  moonIntensity?: number;
  /** Which horizon the viewer faces. Default `auto`. */
  facing?: Facing;
  /**
   * Tint the shadow by its light source. Default false (neutral black).
   *
   * When on, `tint` in the result (and `--rs-tint` from the applier) is an
   * `R G B` triplet: neutral near-black under the sun, a cool blue-gray under
   * the moon. Moonlight is physically slightly redder than sunlight, but
   * human night vision is rod-driven and blue-biased (the Purkinje shift),
   * so moonlit scenes read cold; the tint follows perception.
   */
  tint?: boolean;
  /**
   * Carry the shadow smoothly through twilight. Default true.
   *
   * A hard handoff at sunset snaps the shadow from one side of the page to
   * the other in a single step, which nothing in the sky does. With this on,
   * the sun's shadow relaxes through civil twilight (the afterglow still
   * comes from where the sun went down) while the moon's fades in as the sky
   * darkens, and a rising or setting moon eases in and out over its first
   * four degrees. `false` restores the hard handoff.
   */
  twilight?: boolean;
  /**
   * How the sky is flattened onto the screen. Default `front`.
   *
   * `front` treats the page as a wall you face: only the light's east-west
   * lean shows, and shadows always fall down the page. `top` treats the page
   * as the ground seen from above: the shadow points directly away from the
   * light through the full circle, north up, exactly as it would under a
   * stick in the dirt. Lay a phone flat with `heading` set to its compass
   * heading and the shadows on screen run parallel to the real ones.
   */
  view?: 'front' | 'top';
  /**
   * Compass bearing of the top of the screen in degrees, for `view: 'top'`.
   * Default 0, north up.
   */
  heading?: number;
  /**
   * Height of the caster off the page in px. When set, length follows the
   * real projection `height / tan(altitude)` (capped at `maxLength`) in
   * place of the stylised curve: nothing at the zenith, long at the horizon.
   */
  height?: number;
}

/** A resolved shadow: where it falls, how dark it is, and what is casting it. */
export interface ShadowVector {
  /** Which body is casting. */
  source: ShadowSource;
  /** Horizontal offset in px. Positive is right. */
  dx: number;
  /** Vertical offset in px. Always positive, down the screen. */
  dy: number;
  /** Blur radius in px. */
  blur: number;
  /** Opacity, 0 to 1. */
  alpha: number;
  /** Altitude of the casting body in degrees, or null when nothing is up. */
  altitude: number | null;
  /** Azimuth of the casting body in degrees clockwise from north, or null. */
  azimuth: number | null;
  /** The sun's own altitude in degrees, whatever is casting. Drives sky phase. */
  sunAltitude: number;
  /** Relative brightness of the source, 0 to 1. The sun is always 1. */
  intensity: number;
  /** Shadow colour as an `R G B` triplet. `0 0 0` unless `tint` is on. */
  tint: string;
}

const DEFAULTS = {
  minLength: 3.8,
  maxLength: 11.4,
  falloff: 1.45,
  minAlpha: 0.17,
  maxAlpha: 1,
  maxBlur: 2,
  moon: true,
  moonIntensity: 0.7,
  facing: 'auto' as Facing,
  tint: false,
  twilight: true,
  view: 'front' as 'front' | 'top',
  heading: 0,
  height: 0,
};

/** Cool blue-gray for moonlit shadows; see the `tint` option. */
const MOON_TINT = '26 34 54';
const NEUTRAL_TINT = '0 0 0';

const D2R = Math.PI / 180;
const sind = (d: number): number => Math.sin(d * D2R);
const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
const round2 = (x: number): number => Math.round(x * 100) / 100;

/**
 * The sun's geometric altitude at apparent sunset. Refraction lifts the disc
 * by about 34 arcminutes and the disc's own radius adds another 16, so the
 * sun looks like it is setting when its centre is already this far down.
 */
const SUNSET_ALTITUDE = -0.833;

/** The end of civil twilight: the afterglow has stopped casting by here. */
const CIVIL_DUSK = -6;

/** Altitude over which a rising or setting moon eases in and out. */
const MOON_EASE = 4;

const smoothstep = (u: number): number => {
  const x = clamp(u, 0, 1);
  return x * x * (3 - 2 * x);
};

/** The unrounded shadow one light casts: where it falls and how dark it is. */
interface Cast {
  dx: number;
  dy: number;
  blur: number;
  alpha: number;
}

function castFrom(
  altitude: number,
  azimuth: number,
  intensity: number,
  o: typeof DEFAULTS,
  lat: number,
): Cast {
  const elevation = clamp(altitude, 0, 90);
  const overhead = sind(elevation); // 0 on the horizon, 1 at the zenith

  // Length depends only on how high the light is. Brightness, not geometry,
  // is what changes when the moon takes over.
  const length =
    o.height > 0
      ? clamp(o.height / Math.tan(Math.max(elevation, 0.5) * D2R), 0, o.maxLength)
      : o.minLength + (o.maxLength - o.minLength) * Math.pow(1 - elevation / 90, o.falloff);

  let dx: number;
  let dy: number;
  if (o.view === 'top') {
    // The page is the ground: the shadow points straight away from the light.
    const relative = (azimuth - o.heading) * D2R;
    dx = -Math.sin(relative) * length;
    dy = Math.cos(relative) * length;
  } else {
    // A screen can only show the light's east-west lean, so the vertical
    // component is a stylisation: shadows always fall down the page, deepest
    // when the light is highest. Physical accuracy here would send shadows up
    // the screen half the year, which reads as broken rather than correct.
    dx = facingSign(o.facing, lat) * Math.sin(azimuth * D2R) * length;
    dy = (0.4 + 0.6 * overhead) * length;
  }

  // The floor is the "nothing up" opacity. Without it a thin moon on the
  // horizon cast a fainter shadow (down to 0.02) than no moon at all (0.17),
  // so the page lost depth at moonrise and got it back at moonset.
  const floor = Math.min(o.minAlpha, o.maxAlpha);
  const alpha = clamp(
    Math.max((o.minAlpha + (o.maxAlpha - o.minAlpha) * overhead) * intensity, floor),
    0,
    1,
  );

  // Edges stay hard except for a whisper at grazing angles, where a real
  // shadow genuinely does diffuse.
  const blur = (1 - overhead) * (1 - overhead) * o.maxBlur;

  return { dx, dy, blur, alpha };
}

/** Resolve which way is left on screen: +1 facing south, -1 facing north. */
function facingSign(facing: Facing, lat: number): 1 | -1 {
  if (facing === 'south') return 1;
  if (facing === 'north') return -1;
  return lat >= 0 ? 1 : -1;
}

function isFiniteNumber(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x);
}

/**
 * Where the shadow falls for a location and moment.
 *
 * Invalid coordinates return a `default` vector rather than throwing, so a
 * page that has not resolved a location yet still renders sensible shadows.
 *
 * @param date the moment to compute for
 * @param lat latitude in degrees, north positive
 * @param lon longitude in degrees, east positive
 */
/** Merge options over defaults without letting an explicit undefined clobber a default. */
function resolve(options: ShadowOptions): typeof DEFAULTS {
  const o = { ...DEFAULTS };
  for (const key of Object.keys(options) as Array<keyof ShadowOptions>) {
    const value = options[key];
    if (value !== undefined) (o as Record<string, unknown>)[key] = value;
  }
  return o;
}

export function shadowVector(
  date: Date,
  lat: number,
  lon: number,
  options: ShadowOptions = {},
): ShadowVector {
  const o = resolve(options);
  const when = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();

  if (!isFiniteNumber(lat) || !isFiniteNumber(lon) || Math.abs(lat) > 90) {
    return defaultVector(o);
  }

  const sun = sunPosition(when, lat, lon);
  const sunAltitude = sun.altitude;
  const sunUp = sunAltitude >= SUNSET_ALTITUDE;

  // How much of the shadow still belongs to the sun. Below the horizon it is
  // the afterglow casting, from the sun's own azimuth, fading out by the end
  // of civil twilight.
  const sunWeight = sunUp
    ? 1
    : o.twilight
      ? 1 - smoothstep((SUNSET_ALTITUDE - sunAltitude) / (SUNSET_ALTITUDE - CIVIL_DUSK))
      : 0;

  let moon: { altitude: number; azimuth: number } | null = null;
  let moonIntensity = 0;
  if (!sunUp && o.moon) {
    const m = moonPosition(when, lat, lon);
    if (m.altitude > 0) {
      moon = m;
      moonIntensity = o.moonIntensity * moonBrightness(moonIllumination(when).fraction);
    }
  }
  const moonWeight = moon
    ? (1 - sunWeight) * (o.twilight ? smoothstep(moon.altitude / MOON_EASE) : 1)
    : 0;
  const ambientWeight = 1 - sunWeight - moonWeight;

  const source: ShadowSource = sunUp ? 'sun' : moon ? 'moon' : 'none';
  if (source === 'none' && ambientWeight >= 1) return nothingUp(o, sunAltitude);

  // Blend whatever is casting. In full day and full night exactly one term
  // survives, so those are the plain sun and moon shadows; in between the
  // vector travels continuously instead of snapping.
  let dx = ambientWeight * o.minLength;
  let dy = ambientWeight * o.minLength;
  let blur = ambientWeight * o.maxBlur;
  let alpha = ambientWeight * o.minAlpha;
  if (sunWeight > 0) {
    const c = castFrom(sunAltitude, sun.azimuth, 1, o, lat);
    dx += sunWeight * c.dx;
    dy += sunWeight * c.dy;
    blur += sunWeight * c.blur;
    alpha += sunWeight * c.alpha;
  }
  if (moon && moonWeight > 0) {
    const c = castFrom(moon.altitude, moon.azimuth, moonIntensity, o, lat);
    dx += moonWeight * c.dx;
    dy += moonWeight * c.dy;
    blur += moonWeight * c.blur;
    alpha += moonWeight * c.alpha;
  }

  const caster = source === 'sun' ? sun : moon;
  return {
    source,
    dx: round2(dx),
    dy: round2(dy),
    blur: Math.round(blur),
    alpha: round2(alpha),
    altitude: caster ? round2(caster.altitude) : null,
    azimuth: caster ? round2(caster.azimuth) : null,
    sunAltitude: round2(sunAltitude),
    intensity: source === 'sun' ? 1 : source === 'moon' ? round2(moonIntensity) : 0,
    tint: o.tint && source === 'moon' ? MOON_TINT : NEUTRAL_TINT,
  };
}

/**
 * The moon's shadow-casting strength for a given illuminated fraction,
 * on a 0 to 1 scale where 1 is a full moon.
 *
 * A linear ramp in the lit fraction is the obvious model and it is wrong:
 * real moonlight follows the lunar phase law (Allen's astrophysical
 * quantities), m = 0.026·|a| + 4e-9·a^4 magnitudes for phase angle a, which
 * makes a half moon 9 percent as bright as full, not 50. The rough terrain
 * shadows itself at every angle except straight-on opposition.
 *
 * Rendering that curve literally would make every non-full moon invisible,
 * so the physical brightness is compressed with a fourth root into a usable
 * display range. The ordering and the spacing stay physical: full 1.0,
 * gibbous ~0.8, half ~0.55, crescent ~0.3.
 */
function moonBrightness(litFraction: number): number {
  const f = clamp(litFraction, 0, 1);
  // recover the phase angle from the lit fraction: f = (1 + cos a) / 2
  const a = (Math.acos(2 * f - 1) / Math.PI) * 180;
  const magnitudeDrop = 0.026 * a + 4e-9 * Math.pow(a, 4);
  const physical = Math.pow(10, -0.4 * magnitudeDrop);
  return Math.pow(physical, 0.25);
}

/** Nothing above the horizon: a short, faint, neutral shadow. */
function nothingUp(o: typeof DEFAULTS, sunAltitude: number): ShadowVector {
  return {
    source: 'none',
    dx: round2(o.minLength),
    dy: round2(o.minLength),
    blur: o.maxBlur,
    alpha: round2(o.minAlpha),
    altitude: null,
    azimuth: null,
    sunAltitude: round2(sunAltitude),
    intensity: 0,
    tint: NEUTRAL_TINT,
  };
}

/** No usable location: the conventional top-left light source. */
function defaultVector(o: typeof DEFAULTS): ShadowVector {
  const length = (o.minLength + o.maxLength) / 2;
  const diagonal = round2(length / Math.SQRT2);
  return {
    source: 'default',
    dx: diagonal,
    dy: diagonal,
    blur: 0,
    alpha: round2((o.minAlpha + o.maxAlpha) / 2),
    altitude: null,
    azimuth: null,
    sunAltitude: 0,
    intensity: 1,
    tint: NEUTRAL_TINT,
  };
}

/** Coarse description of the sky, by the sun's altitude. */
export type Sky = 'day' | 'golden' | 'dusk' | 'night';

export interface SkyState {
  /** Which band the sun's altitude falls in. */
  sky: Sky;
  /** Whether the sun is geometrically above the horizon. */
  sunUp: boolean;
  /** The sun's altitude in degrees. */
  sunAltitude: number;
}

/**
 * Classify the sky by where the sun is.
 *
 * The bands follow the conventional twilight definitions: golden hour spans
 * the six degrees either side of the horizon, civil twilight runs to six
 * degrees down, and nautical twilight to twelve, past which the sky is dark
 * enough to call night.
 *
 * `sunUp` is reported separately because the golden band straddles the
 * horizon. Anything that needs to know whether it is actually dark outside,
 * such as an automatic dark mode, should read `sunUp`, not `sky`.
 */
export function skyPhase(date: Date, lat: number, lon: number): SkyState {
  if (!isFiniteNumber(lat) || !isFiniteNumber(lon) || Math.abs(lat) > 90) {
    return { sky: 'day', sunUp: true, sunAltitude: 0 };
  }
  const when = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const altitude = sunPosition(when, lat, lon).altitude;

  let sky: Sky;
  if (altitude >= 6) sky = 'day';
  else if (altitude >= -6) sky = 'golden';
  else if (altitude >= -12) sky = 'dusk';
  else sky = 'night';

  return { sky, sunUp: altitude >= 0, sunAltitude: round2(altitude) };
}

/** A compass bearing, in degrees and as a sixteen-point label. */
export interface Bearing {
  /** Degrees clockwise from true north. Full precision; round for display. */
  degrees: number;
  /** Sixteen-point compass label, such as `ssw`. */
  direction: string;
  /** Which body the alignment is against. */
  source: 'sun' | 'moon';
}

const COMPASS_16 = [
  'n', 'nne', 'ne', 'ene', 'e', 'ese', 'se', 'sse',
  's', 'ssw', 'sw', 'wsw', 'w', 'wnw', 'nw', 'nnw',
];

/** Convert a compass bearing in degrees to a sixteen-point label. */
export function compassLabel(degrees: number): string {
  const index = Math.round((((degrees % 360) + 360) % 360) / 22.5) % 16;
  return COMPASS_16[index] as string;
}

/**
 * The compass bearing to point a device's top edge so that its on-screen
 * shadows line up with the real shadows around it.
 *
 * The screen shadow only carries the light's east-west lean, since it always
 * falls down the page. This works out the rotation that reconciles that
 * flattened vector with the true shadow bearing, which is simply opposite the
 * light. Point the top of the phone at the returned bearing and the shadow
 * under a card on screen runs parallel to the shadow under the phone.
 *
 * Returns null when nothing is above the horizon to cast, or when the
 * coordinates are unusable.
 */
export function shadowBearing(
  date: Date,
  lat: number,
  lon: number,
  options: ShadowOptions = {},
): Bearing | null {
  const v = shadowVector(date, lat, lon, options);
  if ((v.source !== 'sun' && v.source !== 'moon') || v.azimuth === null) return null;

  // a shadow points away from whatever is casting it
  const realBearing = v.azimuth + 180;
  // the on-screen shadow's angle, measured clockwise from the top of the screen
  const screenAngle = Math.atan2(v.dx, -v.dy) / D2R;

  const degrees = (((realBearing - screenAngle) % 360) + 360) % 360;
  return { degrees, direction: compassLabel(degrees), source: v.source };
}
