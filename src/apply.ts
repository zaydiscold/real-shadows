/**
 * The DOM binding: writes the shadow onto an element as custom properties,
 * and keeps them current as the light moves.
 *
 * Everything downstream is plain CSS. The library never touches a style rule
 * of yours, only the variables your rules read, which is what keeps it usable
 * from any framework or none.
 */

import { shadowVector, skyPhase, type ShadowOptions, type ShadowVector } from './shadow.js';

export interface RealShadowsOptions extends ShadowOptions {
  /** Latitude in degrees, north positive. */
  lat: number;
  /** Longitude in degrees, east positive. */
  lon: number;
  /**
   * Where the custom properties and attributes are written.
   * Defaults to the document element, so they cascade to the whole page.
   * Any element with an inline style works, SVG roots included.
   */
  element?: Element & ElementCSSInlineStyle;
  /** Custom property prefix. Default `rs`, giving `--rs-x` and friends. */
  prefix?: string;
  /**
   * How often to recompute, in milliseconds. Default 5 minutes, which moves
   * the offset by well under a pixel per step.
   */
  interval?: number;
  /**
   * Also set `data-sky` and `data-sun` attributes for theming. Default true.
   */
  attributes?: boolean;
  /**
   * A fixed instant, or a function returning one, instead of the live clock.
   * Useful for demos, time scrubbers, and tests.
   */
  now?: Date | (() => Date);
  /** Called after every update, with the vector that was written. */
  onUpdate?: (vector: ShadowVector) => void;
}

export interface RealShadowsHandle {
  /** Recompute and write immediately. */
  refresh(): ShadowVector;
  /** Move to a new location and rewrite immediately. */
  setLocation(lat: number, lon: number): ShadowVector;
  /**
   * Set the compass bearing of the top of the screen and rewrite immediately.
   * Only meaningful with `view: 'top'`; feed it a device compass heading and
   * the shadows on screen stay parallel to the real ones as the device turns.
   */
  setHeading(degrees: number): ShadowVector;
  /** The vector written by the most recent update. */
  current(): ShadowVector | null;
  /** Stop updating and remove everything this handle wrote. */
  stop(): void;
}

const DEFAULT_INTERVAL = 5 * 60 * 1000;

const NOOP_HANDLE: RealShadowsHandle = {
  refresh: () => nullVector(),
  setLocation: () => nullVector(),
  setHeading: () => nullVector(),
  current: () => null,
  stop: () => {},
};

function nullVector(): ShadowVector {
  return {
    source: 'default',
    dx: 0,
    dy: 0,
    blur: 0,
    alpha: 0,
    altitude: null,
    azimuth: null,
    sunAltitude: 0,
    intensity: 0,
    tint: '0 0 0',
  };
}

/**
 * Start writing sun-driven shadow variables onto the page.
 *
 * Writes `--rs-x`, `--rs-y`, `--rs-blur` and `--rs-alpha`, plus `data-sky`
 * and `data-sun` attributes, then keeps them current. Returns a handle for
 * moving the location, forcing a refresh, or tearing the whole thing down.
 *
 * Outside a browser this is a no-op that returns an inert handle, so it is
 * safe to call during server rendering. The pure functions in this package
 * work anywhere.
 *
 * ```js
 * const shadows = realShadows({ lat: 37.77, lon: -122.42 });
 * ```
 * ```css
 * .card { box-shadow: var(--rs-x) var(--rs-y) var(--rs-blur) rgb(0 0 0 / var(--rs-alpha)); }
 * ```
 */
export function realShadows(options: RealShadowsOptions): RealShadowsHandle {
  if (typeof document === 'undefined') return NOOP_HANDLE;

  const {
    element = document.documentElement,
    attributes = true,
    now,
    onUpdate,
    prefix: prefixOption,
    interval: intervalOption,
    ...shadowOptions
  } = options;

  // A prefix that is not a usable identifier would write properties no rule
  // can read (`---x`), so anything else falls back to the default.
  const prefix =
    typeof prefixOption === 'string' && /^[A-Za-z_][\w-]*$/.test(prefixOption) ? prefixOption : 'rs';

  // setInterval treats 0, NaN and negatives as "as fast as possible", which
  // turns a typo into a loop recomputing the sky hundreds of times a second.
  const interval =
    typeof intervalOption === 'number' && Number.isFinite(intervalOption) && intervalOption > 0
      ? intervalOption
      : DEFAULT_INTERVAL;

  let lat = options.lat;
  let lon = options.lon;
  let heading = shadowOptions.heading;
  let latest: ShadowVector | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let stopped = false;

  const varName = (suffix: string): string => `--${prefix}-${suffix}`;

  const clock = (): Date => {
    if (typeof now === 'function') return now();
    if (now instanceof Date) return now;
    return new Date();
  };

  function write(): ShadowVector {
    // a stopped handle stays stopped: refresh() after stop() must not
    // resurrect the variables that stop() just removed
    if (stopped) return latest ?? nullVector();
    const when = clock();
    const v = shadowVector(when, lat, lon, { ...shadowOptions, heading });

    const style = element.style;
    style.setProperty(varName('x'), `${v.dx}px`);
    style.setProperty(varName('y'), `${v.dy}px`);
    style.setProperty(varName('blur'), `${v.blur}px`);
    style.setProperty(varName('alpha'), String(v.alpha));
    style.setProperty(varName('tint'), v.tint);

    if (attributes) {
      const phase = skyPhase(when, lat, lon);
      element.setAttribute('data-sky', phase.sky);
      element.setAttribute('data-sun', phase.sunUp ? 'up' : 'down');
    }

    latest = v;
    onUpdate?.(v);
    return v;
  }

  // Recompute on wake rather than waiting out the remaining interval, so a
  // laptop opened after lunch is not still lit for breakfast.
  function onVisible(): void {
    if (!stopped && !document.hidden) write();
  }

  function start(): void {
    timer = setInterval(() => {
      // Background tabs throttle timers anyway; skipping the work outright
      // keeps a hidden tab from doing arithmetic nobody can see.
      if (!document.hidden) write();
    }, interval);
    document.addEventListener('visibilitychange', onVisible);
  }

  write();
  start();

  return {
    refresh: write,
    setLocation(nextLat: number, nextLon: number): ShadowVector {
      lat = nextLat;
      lon = nextLon;
      return write();
    },
    setHeading(degrees: number): ShadowVector {
      if (Number.isFinite(degrees)) heading = degrees;
      return write();
    },
    current: () => latest,
    stop(): void {
      if (stopped) return;
      stopped = true;
      if (timer !== null) clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);

      for (const suffix of ['x', 'y', 'blur', 'alpha', 'tint']) {
        element.style.removeProperty(varName(suffix));
      }
      if (attributes) {
        element.removeAttribute('data-sky');
        element.removeAttribute('data-sun');
      }
    },
  };
}
