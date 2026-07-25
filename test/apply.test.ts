// @vitest-environment happy-dom
/**
 * The DOM applier, run under happy-dom: variables written, attributes
 * stamped, options respected, and a stop() that leaves no trace.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { realShadows, type RealShadowsHandle } from '../src/index.js';

const SF = { lat: 37.77, lon: -122.42 };
const NOON = new Date('2026-06-21T20:00:00Z'); // 13:00 PDT, sun well up

let handle: RealShadowsHandle | null = null;

afterEach(() => {
  handle?.stop();
  handle = null;
  vi.useRealTimers();
});

describe('realShadows', () => {
  it('writes the four variables and both attributes to the root', () => {
    handle = realShadows({ ...SF, now: NOON });
    const root = document.documentElement;

    expect(root.style.getPropertyValue('--rs-x')).toMatch(/px$/);
    expect(root.style.getPropertyValue('--rs-y')).toMatch(/px$/);
    expect(root.style.getPropertyValue('--rs-blur')).toMatch(/px$/);
    expect(Number(root.style.getPropertyValue('--rs-alpha'))).toBeGreaterThan(0);
    expect(root.getAttribute('data-sky')).toBe('day');
    expect(root.getAttribute('data-sun')).toBe('up');
  });

  it('respects a custom element and prefix', () => {
    const el = document.createElement('div');
    handle = realShadows({ ...SF, now: NOON, element: el, prefix: 'shadow' });

    expect(el.style.getPropertyValue('--shadow-x')).toMatch(/px$/);
    expect(document.documentElement.style.getPropertyValue('--rs-x')).toBe('');
  });

  it('attributes: false writes variables only', () => {
    const el = document.createElement('div');
    handle = realShadows({ ...SF, now: NOON, element: el, attributes: false });

    expect(el.style.getPropertyValue('--rs-x')).toMatch(/px$/);
    expect(el.hasAttribute('data-sky')).toBe(false);
    expect(el.hasAttribute('data-sun')).toBe(false);
  });

  it('setLocation moves the light immediately', () => {
    const el = document.createElement('div');
    handle = realShadows({ ...SF, now: NOON, element: el });
    const before = el.style.getPropertyValue('--rs-x');

    // Sydney at the same instant: pre-dawn, entirely different sky
    handle.setLocation(-33.87, 151.21);
    const after = el.style.getPropertyValue('--rs-x');
    expect(after).not.toBe(before);
  });

  it('refresh() returns the vector it wrote, and current() agrees', () => {
    handle = realShadows({ ...SF, now: NOON });
    const v = handle.refresh();
    expect(v.source).toBe('sun');
    expect(handle.current()).toEqual(v);
  });

  it('a clock function is consulted on every refresh', () => {
    let t = NOON.getTime();
    const el = document.createElement('div');
    handle = realShadows({ ...SF, element: el, now: () => new Date(t) });
    const noonX = el.style.getPropertyValue('--rs-x');

    t += 6 * 60 * 60 * 1000; // six hours later, evening
    handle.refresh();
    expect(el.style.getPropertyValue('--rs-x')).not.toBe(noonX);
  });

  it('updates on the interval', () => {
    vi.useFakeTimers();
    let t = NOON.getTime();
    const updates: number[] = [];
    handle = realShadows({
      ...SF,
      now: () => new Date(t),
      interval: 1000,
      onUpdate: (v) => updates.push(v.dx),
    });

    expect(updates.length).toBe(1); // the initial write
    t += 60 * 60 * 1000;
    vi.advanceTimersByTime(1000);
    expect(updates.length).toBe(2);
  });

  it('stop() removes every variable and attribute it wrote', () => {
    const el = document.createElement('div');
    handle = realShadows({ ...SF, now: NOON, element: el });
    handle.stop();
    handle = null;

    for (const name of ['--rs-x', '--rs-y', '--rs-blur', '--rs-alpha']) {
      expect(el.style.getPropertyValue(name)).toBe('');
    }
    expect(el.hasAttribute('data-sky')).toBe(false);
    expect(el.hasAttribute('data-sun')).toBe(false);
  });

  it('stop() is idempotent', () => {
    handle = realShadows({ ...SF, now: NOON });
    handle.stop();
    expect(() => handle?.stop()).not.toThrow();
    handle = null;
  });

  it('refresh() after stop() does not resurrect the variables', () => {
    const el = document.createElement('div');
    handle = realShadows({ ...SF, now: NOON, element: el });
    handle.stop();
    handle.refresh();
    handle.setLocation(0, 0);
    expect(el.style.getPropertyValue('--rs-x')).toBe('');
    expect(el.hasAttribute('data-sky')).toBe(false);
    handle = null;
  });

  it('an explicitly undefined option keeps its default', () => {
    // { moon: undefined } must behave like { }, not like { moon: false }
    const el = document.createElement('div');
    handle = realShadows({ ...SF, now: NOON, element: el, moon: undefined });
    expect(handle.current()?.source).toBe('sun');
    handle.stop();
    handle = null;
  });
});
