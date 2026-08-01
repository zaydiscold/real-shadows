/**
 * The sundial property: the bearing is a constant of the model, not of the
 * moment. The model draws for a viewer facing the equator, so the device's
 * top edge goes due south in the northern hemisphere and due north in the
 * southern, and it never moves. Held there, the on-screen east-west lean must
 * genuinely match the real shadow's east-west lean at every hour: with the
 * top at bearing B the screen vector (dx, dy) lands on compass east component
 * dx·cos(B·D2R)... concretely, top-south flips dx into east = -dx, top-north
 * keeps east = dx, and that must carry the same sign as the true shadow's
 * east component, sin((azimuth + 180)°).
 */
import { describe, expect, it } from 'vitest';
import { shadowBearing, shadowVector } from '../src/index.js';

const D2R = Math.PI / 180;

// a deterministic pseudo-random walk over the globe and the calendar
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('shadowBearing', () => {
  it('never changes with time: due south all year in the north', () => {
    let checked = 0;
    for (let d = 0; d < 365; d += 7) {
      for (let h = 0; h < 24; h += 3) {
        const date = new Date(Date.UTC(2026, 0, 1 + d, h));
        const bearing = shadowBearing(date, 37.77, -122.42); // san francisco
        if (!bearing) continue; // nothing up — nothing to align
        expect(bearing.degrees, date.toISOString()).toBe(180);
        expect(bearing.direction).toBe('s');
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(200);
  });

  it('never changes with time: due north all year in the south', () => {
    let checked = 0;
    for (let d = 0; d < 365; d += 7) {
      for (let h = 0; h < 24; h += 3) {
        const date = new Date(Date.UTC(2026, 0, 1 + d, h));
        const bearing = shadowBearing(date, -33.87, 151.21); // sydney
        if (!bearing) continue;
        expect(bearing.degrees, date.toISOString()).toBe(0);
        expect(bearing.direction).toBe('n');
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(200);
  });

  it('follows an explicit facing override', () => {
    const noon = new Date(Date.UTC(2026, 5, 21, 20)); // midday over sf
    expect(shadowBearing(noon, 37.77, -122.42, { facing: 'north' })?.degrees).toBe(0);
    const sydneyNoon = new Date(Date.UTC(2026, 5, 21, 2));
    expect(shadowBearing(sydneyNoon, -33.87, 151.21, { facing: 'south' })?.degrees).toBe(180);
  });

  it('matches the real shadow lean under the fixed bearing, everywhere', () => {
    const rand = mulberry32(20260722);
    let checked = 0;

    for (let i = 0; i < 500; i++) {
      const lat = rand() * 170 - 85;
      const lon = rand() * 360 - 180;
      const date = new Date(
        Date.UTC(2026, 0, 1) + Math.floor(rand() * 730 * 24 * 60) * 60 * 1000,
      );

      const bearing = shadowBearing(date, lat, lon);
      if (!bearing) continue; // nothing up — nothing to align

      const v = shadowVector(date, lat, lon);
      // real shadow's east component: it points opposite the caster
      const realEast = Math.sin(((v.azimuth as number) + 180) * D2R);
      if (Math.abs(realEast) < 1e-3) continue; // caster on the meridian, no lean

      // the on-screen dx mapped onto the compass, top edge held at the bearing:
      // top-south makes screen-right west (east = -dx), top-north keeps it east
      const screenEast = bearing.degrees === 180 ? -v.dx : v.dx;

      expect(
        Math.sign(screenEast),
        `${date.toISOString()} @ ${lat.toFixed(2)},${lon.toFixed(2)}`,
      ).toBe(Math.sign(realEast));
      checked++;
    }

    // the sample must actually exercise the property, not skip everything
    expect(checked).toBeGreaterThan(300);
  });

  it('returns null when nothing is above the horizon', () => {
    // deep astronomical night with the moon down does occur; scan for one
    let sawNull = false;
    for (let d = 0; d < 60 && !sawNull; d++) {
      for (let h = 0; h < 24 && !sawNull; h++) {
        const date = new Date(Date.UTC(2026, 0, 1 + d, h));
        if (shadowVector(date, 37.77, -122.42).source === 'none') {
          expect(shadowBearing(date, 37.77, -122.42)).toBeNull();
          sawNull = true;
        }
      }
    }
    expect(sawNull).toBe(true);
  });

  it('returns null for unusable coordinates', () => {
    expect(shadowBearing(new Date(), NaN, 0)).toBeNull();
  });
});
