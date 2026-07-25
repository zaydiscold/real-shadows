/**
 * The sundial property: for any moment and place where something is casting,
 * pointing the device's top edge at the returned bearing must line the
 * on-screen shadow up with the real one.
 *
 * The check is a round trip. The real shadow falls at azimuth + 180. If the
 * device top faces `degrees`, a screen vector at angle theta clockwise from
 * screen-top points at compass bearing degrees + theta. So
 * degrees + atan2(dx, -dy) must land back on azimuth + 180, exactly.
 */
import { describe, expect, it } from 'vitest';
import { shadowBearing, shadowVector } from '../src/index.js';

const R2D = 180 / Math.PI;

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
  it('closes the round trip within a hundredth of a degree, everywhere', () => {
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
      const screenAngle = Math.atan2(v.dx, -v.dy) * R2D;
      const reconstructed = (((bearing.degrees + screenAngle) % 360) + 360) % 360;
      const real = (((v.azimuth as number) + 180) % 360 + 360) % 360;

      const closure = Math.abs((((reconstructed - real + 540) % 360) + 360) % 360 - 180);
      expect(closure, `${date.toISOString()} @ ${lat.toFixed(2)},${lon.toFixed(2)}`).toBeLessThan(
        0.01,
      );
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
