/**
 * Low-precision solar and lunar ephemeris, after Paul Schlyter's
 * "Computing planetary positions" (stjarnhimlen.se/comp/ppcomp.html).
 *
 * Geocentric orbital elements are propagated linearly from the J2000 epoch,
 * converted to equatorial coordinates, then rotated into the observer's
 * horizontal frame. The moon additionally gets the dominant periodic
 * perturbations and a topocentric parallax correction.
 *
 * Accuracy against the JPL-derived astronomy-engine, measured by the test
 * suite across latitudes from 78N to 78S: sun within 0.05 degrees, moon
 * within 0.2 degrees. The method and the measured numbers are in the
 * README's accuracy section; test/accuracy.test.ts enforces the bounds.
 */

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

/** Julian date at the unix epoch (1970-01-01 00:00 UTC). */
const UNIX_JD = 2440587.5;

/** Julian date of Schlyter's epoch, 1999-12-31 00:00 UT ("day 0"). */
const SCHLYTER_EPOCH_JD = 2451543.5;

/** Julian date of J2000.0, used for sidereal time. */
const J2000_JD = 2451545.0;

const rev = (x: number): number => ((x % 360) + 360) % 360;
const sind = (d: number): number => Math.sin(d * D2R);
const cosd = (d: number): number => Math.cos(d * D2R);
const asind = (x: number): number => Math.asin(x) * R2D;
const atan2d = (y: number, x: number): number => Math.atan2(y, x) * R2D;

/** Wrap an angle in degrees to (-180, 180]. */
const wrap180 = (deg: number): number => ((((deg + 180) % 360) + 360) % 360) - 180;

/** Convert a Date to a Julian date. */
export function toJulian(date: Date): number {
  return date.getTime() / 86400000 + UNIX_JD;
}

/** Convert a Julian date back to a Date. */
export function fromJulian(jd: number): Date {
  return new Date((jd - UNIX_JD) * 86400000);
}

/** A position on the celestial sphere, in equatorial coordinates. */
export interface Equatorial {
  /** Right ascension, degrees. */
  ra: number;
  /** Declination, degrees. */
  dec: number;
  /** Distance. Earth radii for the moon, astronomical units for the sun. */
  dist: number;
  /** Ecliptic longitude, degrees. Used to separate waxing from waning. */
  lon: number;
}

/** A position in the observer's sky. */
export interface Horizontal {
  /** Altitude above the horizon, degrees. Negative below. */
  altitude: number;
  /** Azimuth, degrees clockwise from true north (90 = east, 180 = south). */
  azimuth: number;
}

/** Internal solar solution, retained because the moon's terms depend on it. */
interface SunSolution extends Equatorial {
  /** Mean anomaly, degrees. */
  meanAnomaly: number;
  /** Argument of perihelion, degrees. */
  perihelion: number;
  /** Obliquity of the ecliptic, degrees. */
  obliquity: number;
}

/**
 * The sun's geocentric equatorial position.
 *
 * The earth's orbit is nearly circular, so one iteration of Kepler's equation
 * is enough; the residual is well under an arcminute for any date this
 * century.
 */
function solveSun(jd: number): SunSolution {
  const d = jd - SCHLYTER_EPOCH_JD;

  const w = 282.9404 + 4.70935e-5 * d; // argument of perihelion
  const e = 0.016709 - 1.151e-9 * d; // eccentricity
  const M = rev(356.047 + 0.9856002585 * d); // mean anomaly
  const obliquity = 23.4393 - 3.563e-7 * d;

  // eccentric anomaly, first-order solution of Kepler's equation
  const E = M + R2D * e * sind(M) * (1 + e * cosd(M));

  // rectangular coordinates in the plane of the ecliptic
  const xv = cosd(E) - e;
  const yv = Math.sqrt(1 - e * e) * sind(E);

  const dist = Math.sqrt(xv * xv + yv * yv); // AU
  const lon = rev(atan2d(yv, xv) + w); // true ecliptic longitude

  // ecliptic to equatorial (the sun's ecliptic latitude is zero by definition)
  const xs = cosd(lon);
  const ys = sind(lon);
  const ye = ys * cosd(obliquity);
  const ze = ys * sind(obliquity);

  return {
    ra: rev(atan2d(ye, xs)),
    dec: atan2d(ze, Math.sqrt(xs * xs + ye * ye)),
    dist,
    meanAnomaly: M,
    perihelion: w,
    obliquity,
    lon,
  };
}

/**
 * The moon's geocentric equatorial position, including the largest periodic
 * perturbations.
 *
 * The moon's orbit is eccentric enough (e = 0.0549) that Kepler's equation
 * needs a Newton refinement after the first-order guess; without it the
 * position error reaches several arcminutes near perigee. The twelve
 * longitude and five latitude terms that follow are the ones larger than
 * roughly an arcminute, dominated by the evection and variation.
 */
function solveMoon(jd: number, sun: SunSolution): Equatorial {
  const d = jd - SCHLYTER_EPOCH_JD;

  const N = rev(125.1228 - 0.0529538083 * d); // longitude of ascending node
  const i = 5.1454; // inclination
  const w = rev(318.0634 + 0.1643573223 * d); // argument of perigee
  const a = 60.2666; // semi-major axis, earth radii
  const e = 0.0549; // eccentricity
  const M = rev(115.3654 + 13.0649929509 * d); // mean anomaly

  // Kepler's equation: first-order guess, then one Newton step
  let E = M + R2D * e * sind(M) * (1 + e * cosd(M));
  E = E - (E - R2D * e * sind(E) - M) / (1 - e * cosd(E));

  // position in the plane of the moon's orbit
  const xv = a * (cosd(E) - e);
  const yv = a * (Math.sqrt(1 - e * e) * sind(E));
  const v = atan2d(yv, xv); // true anomaly
  const r = Math.sqrt(xv * xv + yv * yv); // distance, earth radii

  // rotate into ecliptic coordinates
  const xh = r * (cosd(N) * cosd(v + w) - sind(N) * sind(v + w) * cosd(i));
  const yh = r * (sind(N) * cosd(v + w) + cosd(N) * sind(v + w) * cosd(i));
  const zh = r * (sind(v + w) * sind(i));

  let lon = rev(atan2d(yh, xh));
  let lat = atan2d(zh, Math.sqrt(xh * xh + yh * yh));

  // perturbation arguments
  const Ls = rev(sun.meanAnomaly + sun.perihelion); // sun's mean longitude
  const Lm = rev(N + w + M); // moon's mean longitude
  const D = rev(Lm - Ls); // mean elongation
  const F = rev(Lm - N); // argument of latitude
  const Ms = sun.meanAnomaly;

  // longitude perturbations, largest first: evection, variation, yearly equation
  lon +=
    -1.274 * sind(M - 2 * D) +
    0.658 * sind(2 * D) -
    0.186 * sind(Ms) -
    0.059 * sind(2 * M - 2 * D) -
    0.057 * sind(M - 2 * D + Ms) +
    0.053 * sind(M + 2 * D) +
    0.046 * sind(2 * D - Ms) +
    0.041 * sind(M - Ms) -
    0.035 * sind(D) -
    0.031 * sind(M + Ms) -
    0.015 * sind(2 * F - 2 * D) +
    0.011 * sind(M - 4 * D);

  // latitude perturbations
  lat +=
    -0.173 * sind(F - 2 * D) -
    0.055 * sind(M - F - 2 * D) -
    0.046 * sind(M + F - 2 * D) +
    0.033 * sind(F + 2 * D) +
    0.017 * sind(2 * M + F);

  // distance perturbations, earth radii
  const dist = r - 0.58 * cosd(M - 2 * D) - 0.46 * cosd(2 * D);

  lon = rev(lon);

  // ecliptic to equatorial
  const obl = sun.obliquity;
  const cosLat = cosd(lat);
  const xg = cosd(lon) * cosLat;
  const yg = sind(lon) * cosLat;
  const zg = sind(lat);

  const xe = xg;
  const ye = yg * cosd(obl) - zg * sind(obl);
  const ze = yg * sind(obl) + zg * cosd(obl);

  return {
    ra: rev(atan2d(ye, xe)),
    dec: atan2d(ze, Math.sqrt(xe * xe + ye * ye)),
    dist,
    lon,
  };
}

/** Greenwich mean sidereal time, in degrees, plus the observer's longitude. */
function localSiderealTime(jd: number, lonEast: number): number {
  const d = jd - J2000_JD;
  const t = d / 36525;
  const gmst = 280.46061837 + 360.98564736629 * d + 0.000387933 * t * t;
  return rev(gmst + lonEast);
}

/**
 * Equatorial to horizontal coordinates for an observer at (lat, lonEast).
 *
 * Azimuth is returned clockwise from true north, the compass convention,
 * rather than Schlyter's from-south convention.
 */
function toHorizontal(jd: number, eq: Equatorial, lat: number, lonEast: number): Horizontal {
  const H = rev(localSiderealTime(jd, lonEast) - eq.ra); // hour angle

  const sinAlt = sind(lat) * sind(eq.dec) + cosd(lat) * cosd(eq.dec) * cosd(H);
  const altitude = asind(Math.max(-1, Math.min(1, sinAlt)));

  const azimuth = rev(
    atan2d(-cosd(eq.dec) * sind(H), sind(eq.dec) * cosd(lat) - cosd(eq.dec) * sind(lat) * cosd(H)),
  );

  return { altitude, azimuth };
}

/**
 * Correct a geocentric altitude for the observer's displacement from the
 * earth's centre.
 *
 * Parallax shifts a body along the vertical circle through it, which leaves
 * azimuth unchanged and only lowers the altitude. For the sun the shift is
 * under 9 arcseconds and not worth applying; for the moon it reaches a full
 * degree, which is the difference between "the moon has risen" and "not yet".
 *
 * @param altitude geocentric altitude, degrees
 * @param dist distance to the body, in earth radii
 */
function applyParallax(altitude: number, dist: number): number {
  const horizontalParallax = asind(1 / dist);
  return altitude - horizontalParallax * cosd(altitude);
}

/**
 * Atmospheric refraction, in degrees, for a given apparent altitude.
 *
 * Saemundsson's formula. Refraction lifts a body near the horizon by about
 * 34 arcminutes, which is why the sun's disc is fully visible when it is
 * geometrically already below the horizon.
 */
export function refraction(altitudeDeg: number): number {
  if (altitudeDeg < -1) return 0;
  return 1.02 / Math.tan((altitudeDeg + 10.3 / (altitudeDeg + 5.11)) * D2R) / 60;
}

/**
 * The sun's position in the sky at a given time and place.
 *
 * @param date the moment to compute for
 * @param lat latitude in degrees, north positive
 * @param lon longitude in degrees, east positive
 */
export function sunPosition(date: Date, lat: number, lon: number): Horizontal {
  const jd = toJulian(date);
  return toHorizontal(jd, solveSun(jd), lat, lon);
}

/** The moon's position in the sky, corrected for the observer's parallax. */
export function moonPosition(date: Date, lat: number, lon: number): Horizontal {
  const jd = toJulian(date);
  const sun = solveSun(jd);
  const moon = solveMoon(jd, sun);
  const horiz = toHorizontal(jd, moon, lat, lon);
  return {
    altitude: applyParallax(horiz.altitude, moon.dist),
    azimuth: horiz.azimuth,
  };
}

/** How much of the moon's disc is lit, and which way it is heading. */
export interface MoonIllumination {
  /** Illuminated fraction of the disc, 0 at new moon to 1 at full. */
  fraction: number;
  /** Phase as a fraction of the synodic month, 0 new, 0.5 full, 1 new again. */
  phase: number;
  /** True while the lit fraction is growing. */
  waxing: boolean;
}

/**
 * The moon's illuminated fraction.
 *
 * Derived from the actual sun-earth-moon geometry rather than a mean synodic
 * cycle, so it stays accurate through the moon's elliptical orbit. The
 * fraction is what the shadow model needs: a thin crescent throws far less
 * light than a full moon.
 */
export function moonIllumination(date: Date): MoonIllumination {
  const jd = toJulian(date);
  const sun = solveSun(jd);
  const moon = solveMoon(jd, sun);

  // sun distance in earth radii, to put both bodies in the same units
  const sunDist = sun.dist * 23454.8;

  // geocentric elongation of the moon from the sun
  const cosElong =
    sind(sun.dec) * sind(moon.dec) + cosd(sun.dec) * cosd(moon.dec) * cosd(sun.ra - moon.ra);
  const elong = Math.acos(Math.max(-1, Math.min(1, cosElong)));

  // selenocentric phase angle: the sun-moon-earth angle at the moon
  const phaseAngle = Math.atan2(
    sunDist * Math.sin(elong),
    moon.dist - sunDist * Math.cos(elong),
  );

  const fraction = (1 + Math.cos(phaseAngle)) / 2;

  // A waxing moon leads the sun in ecliptic longitude by 0 to 180 degrees.
  // The illuminated fraction alone cannot tell the two halves of the month
  // apart, since a first and last quarter are both half lit.
  const waxing = wrap180(moon.lon - sun.lon) > 0;

  // phase runs 0 to 1 over the synodic month: 0 new, 0.25 first quarter,
  // 0.5 full, 0.75 last quarter
  const phase = waxing ? fraction / 2 : 1 - fraction / 2;

  return { fraction, phase, waxing };
}
