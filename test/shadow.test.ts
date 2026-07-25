/**
 * Units for the lighting model itself: geometry, handoff, hemisphere
 * behaviour, clamps, and the fallbacks for bad input.
 */
import { describe, expect, it } from 'vitest';
import { shadowVector, skyPhase, sunPosition, moonPosition, compassLabel } from '../src/index.js';

const SF = { lat: 37.77, lon: -122.42 };
const SYDNEY = { lat: -33.87, lon: 151.21 };

// Known moments, UTC. 2026-06-21 20:00 UTC = 13:00 PDT, high summer sun in SF.
const SF_NOON = new Date('2026-06-21T20:00:00Z');
const SF_MORNING = new Date('2026-06-21T15:00:00Z'); // 08:00 PDT, sun in the east
const SF_EVENING = new Date('2026-07-22T02:00:00Z'); // 19:00 PDT prev day, sun in the west

describe('geometry', () => {
  it('noon shadow is short, morning and evening shadows are long', () => {
    const noon = shadowVector(SF_NOON, SF.lat, SF.lon);
    const morning = shadowVector(SF_MORNING, SF.lat, SF.lon);
    const evening = shadowVector(SF_EVENING, SF.lat, SF.lon);

    const len = (v: { dx: number; dy: number }) => Math.hypot(v.dx, v.dy);
    expect(len(noon)).toBeLessThan(len(morning));
    expect(len(noon)).toBeLessThan(len(evening));
  });

  it('morning sun in the east throws the shadow right; evening sun, left', () => {
    // facing south (northern hemisphere): east is to the viewer's left, so
    // the shadow of an eastern sun falls to the right
    const morning = shadowVector(SF_MORNING, SF.lat, SF.lon);
    const evening = shadowVector(SF_EVENING, SF.lat, SF.lon);
    expect(morning.dx).toBeGreaterThan(0);
    expect(evening.dx).toBeLessThan(0);
  });

  it('shadows always fall down the screen', () => {
    for (let h = 0; h < 24; h++) {
      const v = shadowVector(new Date(Date.UTC(2026, 5, 21, h)), SF.lat, SF.lon);
      expect(v.dy).toBeGreaterThan(0);
    }
  });

  it('length decreases monotonically as altitude rises', () => {
    // sample the morning climb: each higher sun should shorten the shadow
    let lastLen = Infinity;
    let lastAlt = -Infinity;
    for (const h of [15, 16, 17, 18, 19, 20]) {
      const v = shadowVector(new Date(Date.UTC(2026, 5, 21, h)), SF.lat, SF.lon);
      if (v.source !== 'sun' || v.altitude === null) continue;
      if (v.altitude > lastAlt) {
        const len = Math.hypot(v.dx, v.dy);
        expect(len).toBeLessThanOrEqual(lastLen + 1e-9);
        lastLen = len;
        lastAlt = v.altitude;
      }
    }
  });

  it('alpha rises with altitude and stays clamped to [0, 1]', () => {
    const noon = shadowVector(SF_NOON, SF.lat, SF.lon);
    const evening = shadowVector(SF_EVENING, SF.lat, SF.lon);
    expect(noon.alpha).toBeGreaterThan(evening.alpha);
    for (let h = 0; h < 24; h++) {
      const v = shadowVector(new Date(Date.UTC(2026, 2, 20, h)), SF.lat, SF.lon);
      expect(v.alpha).toBeGreaterThanOrEqual(0);
      expect(v.alpha).toBeLessThanOrEqual(1);
    }
  });

  it('blur is zero at high sun and small near the horizon', () => {
    const noon = shadowVector(SF_NOON, SF.lat, SF.lon);
    expect(noon.blur).toBe(0);
    for (let h = 0; h < 24; h++) {
      const v = shadowVector(new Date(Date.UTC(2026, 2, 20, h)), SF.lat, SF.lon);
      expect(v.blur).toBeGreaterThanOrEqual(0);
      expect(v.blur).toBeLessThanOrEqual(2);
    }
  });
});

describe('southern hemisphere', () => {
  it('mirrors the horizontal lean for a viewer facing north', () => {
    // Sydney, 2026-01-15 21:00 UTC = 08:00 AEDT: morning sun in the east.
    // Facing north, east is to the viewer's RIGHT, so the shadow leans left.
    const morning = new Date('2026-01-15T21:00:00Z');
    const v = shadowVector(morning, SYDNEY.lat, SYDNEY.lon);
    expect(v.source).toBe('sun');
    expect(v.dx).toBeLessThan(0);

    // forcing facing:'south' flips it back
    const forced = shadowVector(morning, SYDNEY.lat, SYDNEY.lon, { facing: 'south' });
    expect(forced.dx).toBeGreaterThan(0);
  });
});

describe('the day-night handoff', () => {
  it('every moment resolves to sun, moon, or none, and sun wins while up', () => {
    let sun = 0;
    let moon = 0;
    let none = 0;
    for (let d = 0; d < 30; d++) {
      for (let h = 0; h < 24; h += 2) {
        const date = new Date(Date.UTC(2026, 6, 1 + d, h));
        const v = shadowVector(date, SF.lat, SF.lon);
        if (v.source === 'sun') {
          sun++;
          expect(sunPosition(date, SF.lat, SF.lon).altitude).toBeGreaterThanOrEqual(-0.834);
        } else if (v.source === 'moon') {
          moon++;
          expect(moonPosition(date, SF.lat, SF.lon).altitude).toBeGreaterThan(0);
        } else {
          none++;
          expect(v.source).toBe('none');
        }
      }
    }
    // over a month, all three states must actually occur
    expect(sun).toBeGreaterThan(0);
    expect(moon).toBeGreaterThan(0);
    expect(none).toBeGreaterThan(0);
  });

  it('moon: false skips straight to the neutral fallback at night', () => {
    // find a moment when the moon would cast
    outer: for (let d = 0; d < 30; d++) {
      for (let h = 0; h < 24; h++) {
        const date = new Date(Date.UTC(2026, 6, 1 + d, h));
        const withMoon = shadowVector(date, SF.lat, SF.lon);
        if (withMoon.source === 'moon') {
          const without = shadowVector(date, SF.lat, SF.lon, { moon: false });
          expect(without.source).toBe('none');
          break outer;
        }
      }
    }
  });

  it('a moonlit shadow is fainter than a sunlit one at the same altitude', () => {
    // compare intensities rather than hunting matched altitudes: moon
    // intensity is capped below the sun's 1.0 by construction
    for (let d = 0; d < 30; d++) {
      for (let h = 0; h < 24; h++) {
        const v = shadowVector(new Date(Date.UTC(2026, 6, 1 + d, h)), SF.lat, SF.lon);
        if (v.source === 'moon') {
          expect(v.intensity).toBeLessThan(1);
          expect(v.intensity).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe('bad input', () => {
  it('missing or invalid coordinates return the default vector, not a throw', () => {
    for (const [lat, lon] of [
      [NaN, 0],
      [0, NaN],
      [Infinity, 0],
      [91, 0],
      [undefined as unknown as number, 0],
    ]) {
      const v = shadowVector(new Date(), lat as number, lon as number);
      expect(v.source).toBe('default');
      expect(v.dx).toBeGreaterThan(0);
      expect(v.dy).toBeGreaterThan(0);
    }
  });

  it('an invalid date falls back to now', () => {
    const v = shadowVector(new Date('nonsense'), SF.lat, SF.lon);
    expect(['sun', 'moon', 'none']).toContain(v.source);
  });
});

describe('skyPhase', () => {
  it('classifies a full san francisco day into the expected bands', () => {
    // 2026-06-21: sunrise ~05:48, sunset ~20:35 PDT
    const midnight = skyPhase(new Date('2026-06-21T09:00:00Z'), SF.lat, SF.lon); // 02:00 PDT
    const noon = skyPhase(SF_NOON, SF.lat, SF.lon);
    const sunset = skyPhase(new Date('2026-06-22T03:35:00Z'), SF.lat, SF.lon); // 20:35 PDT

    expect(midnight.sky).toBe('night');
    expect(midnight.sunUp).toBe(false);
    expect(noon.sky).toBe('day');
    expect(noon.sunUp).toBe(true);
    expect(sunset.sky).toBe('golden');
  });

  it('sunUp is the raw horizon fact, independent of the golden band', () => {
    // just after sunset the sky is still golden but the sun is down —
    // the case an automatic dark mode must get right
    const justAfter = skyPhase(new Date('2026-06-22T03:50:00Z'), SF.lat, SF.lon); // 20:50 PDT
    expect(justAfter.sky).toBe('golden');
    expect(justAfter.sunUp).toBe(false);
  });
});

describe('compassLabel', () => {
  it('maps the cardinal and boundary bearings', () => {
    expect(compassLabel(0)).toBe('n');
    expect(compassLabel(90)).toBe('e');
    expect(compassLabel(180)).toBe('s');
    expect(compassLabel(270)).toBe('w');
    expect(compassLabel(359.9)).toBe('n');
    expect(compassLabel(-90)).toBe('w');
    expect(compassLabel(202.5)).toBe('ssw');
  });
});
