/**
 * The oracle suite: every position this library computes is checked against
 * astronomy-engine, a JPL-derived reference good to arcseconds. The accuracy
 * numbers in the README are these assertions, run on every commit.
 *
 * astronomy-engine is a dev dependency only; nothing here ships.
 */
import { describe, expect, it } from 'vitest';
import * as A from 'astronomy-engine';
import { moonIllumination, moonPosition, sunPosition } from '../src/index.js';

const PLACES: Array<[string, number, number]> = [
  ['longyearbyen', 78.22, 15.65],
  ['reykjavik', 64.15, -21.94],
  ['london', 51.51, -0.13],
  ['san francisco', 37.77, -122.42],
  ['tokyo', 35.68, 139.69],
  ['mexico city', 19.43, -99.13],
  ['singapore', 1.35, 103.82],
  ['quito', -0.18, -78.47],
  ['nairobi', -1.29, 36.82],
  ['sao paulo', -23.55, -46.63],
  ['sydney', -33.87, 151.21],
  ['ushuaia', -54.8, -68.3],
  ['mcmurdo', -77.85, 166.67],
];

const DATES: Date[] = [];
for (let year = 2026; year <= 2027; year++) {
  for (const [m, d] of [
    [0, 15],
    [2, 20],
    [5, 21],
    [8, 23],
    [11, 21],
  ] as Array<[number, number]>) {
    for (const h of [0, 5, 9, 13, 17, 21]) {
      DATES.push(new Date(Date.UTC(year, m, d, h, 37, 0)));
    }
  }
}

/** Topocentric geometric position from the reference implementation. */
function reference(body: A.Body, date: Date, lat: number, lon: number) {
  const observer = new A.Observer(lat, lon, 0);
  const eq = A.Equator(body, date, observer, true, true);
  // no refraction argument → geometric altitude, matching our model
  const hor = A.Horizon(date, observer, eq.ra, eq.dec);
  return { altitude: hor.altitude, azimuth: hor.azimuth };
}

/** Angular separation on the sky between two alt-az positions, degrees. */
function skyError(
  a: { altitude: number; azimuth: number },
  b: { altitude: number; azimuth: number },
): number {
  const dAlt = a.altitude - b.altitude;
  let dAz = a.azimuth - b.azimuth;
  if (dAz > 180) dAz -= 360;
  if (dAz < -180) dAz += 360;
  return Math.hypot(dAlt, dAz * Math.cos((b.altitude * Math.PI) / 180));
}

describe('sun position vs astronomy-engine', () => {
  it('stays within 0.05 degrees everywhere, all year', () => {
    let max = 0;
    for (const [, lat, lon] of PLACES) {
      for (const date of DATES) {
        const err = skyError(sunPosition(date, lat, lon), reference(A.Body.Sun, date, lat, lon));
        max = Math.max(max, err);
      }
    }
    expect(max).toBeLessThan(0.05);
  });
});

describe('moon position vs astronomy-engine', () => {
  it('stays within 0.2 degrees everywhere, all year', () => {
    let max = 0;
    for (const [, lat, lon] of PLACES) {
      for (const date of DATES) {
        const err = skyError(moonPosition(date, lat, lon), reference(A.Body.Moon, date, lat, lon));
        max = Math.max(max, err);
      }
    }
    expect(max).toBeLessThan(0.2);
  });
});

describe('moon illumination vs astronomy-engine', () => {
  it('fraction stays within 0.005', () => {
    let max = 0;
    for (const date of DATES) {
      const refFraction = A.Illumination(A.Body.Moon, date).phase_fraction;
      max = Math.max(max, Math.abs(moonIllumination(date).fraction - refFraction));
    }
    expect(max).toBeLessThan(0.005);
  });

  it('waxing flag matches the reference phase angle', () => {
    for (const date of DATES) {
      // reference: phase angle in [0,360), 0=new, 180=full; waxing below 180
      const refPhase = A.MoonPhase(date);
      const waxing = refPhase < 180;
      expect(moonIllumination(date).waxing, date.toISOString()).toBe(waxing);
    }
  });
});
