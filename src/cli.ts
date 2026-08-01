#!/usr/bin/env node
/**
 * `npx real-shadows <lat> <lon>` — print the shadow being cast right now.
 *
 * Exists so you can check the numbers, and see that the sun and moon really do
 * hand off, without wiring anything into a page first.
 */

import { moonIllumination, shadowBearing, shadowVector, skyPhase } from './index.js';

const USAGE = `usage: npx real-shadows <lat> <lon> [--json] [--at <iso-date>]

  lat, lon   decimal degrees, north and east positive
  --at       a moment other than now, e.g. --at 2026-12-21T17:00:00Z
  --json     machine-readable output

examples:
  npx real-shadows 37.77 -122.42
  npx real-shadows 51.51 -0.13 --at 2026-06-21T05:00:00Z --json`;

function fail(message: string): never {
  process.stderr.write(`real-shadows: ${message}\n\n${USAGE}\n`);
  process.exit(1);
}

const argv = process.argv.slice(2);
if (argv.length === 0 || argv.includes('-h') || argv.includes('--help')) {
  process.stdout.write(`${USAGE}\n`);
  process.exit(0);
}

const json = argv.includes('--json');
const unknown = argv.find((a) => a.startsWith('--') && a !== '--json' && a !== '--at' && a !== '--help');
if (unknown) fail(`unknown flag: ${unknown}`);
const atIndex = argv.indexOf('--at');
// guard the -1 case: without --at, `atIndex + 1` is 0 and would eat the latitude.
// note a bare `-` prefix is legal here, since a west longitude is negative.
const atValueIndex = atIndex === -1 ? -1 : atIndex + 1;
const positional = argv.filter((a, i) => !a.startsWith('--') && i !== atValueIndex);

const lat = Number(positional[0]);
const lon = Number(positional[1]);
if (!Number.isFinite(lat) || !Number.isFinite(lon)) fail('need a numeric lat and lon');
if (Math.abs(lat) > 90) fail('latitude must be between -90 and 90');

let when = new Date();
if (atIndex !== -1) {
  const raw = argv[atIndex + 1];
  if (!raw) fail('--at needs a date');
  when = new Date(raw);
  if (Number.isNaN(when.getTime())) fail(`could not parse date: ${raw}`);
}

const shadow = shadowVector(when, lat, lon);
const sky = skyPhase(when, lat, lon);
const bearing = shadowBearing(when, lat, lon);
const moon = moonIllumination(when);

if (json) {
  process.stdout.write(
    `${JSON.stringify({ at: when.toISOString(), lat, lon, shadow, sky, bearing, moon }, null, 2)}\n`,
  );
  process.exit(0);
}

const pct = (n: number): string => `${Math.round(n * 100)}%`;
const deg = (n: number | null): string => (n === null ? '--' : `${n.toFixed(1)}deg`);

const lines = [
  ['when', when.toISOString()],
  ['where', `${lat}, ${lon}`],
  ['casting', shadow.source],
  ['sky', `${sky.sky} (sun ${deg(sky.sunAltitude)}, ${sky.sunUp ? 'up' : 'down'})`],
  ['caster', `alt ${deg(shadow.altitude)}, az ${deg(shadow.azimuth)}`],
  ['offset', `${shadow.dx}px, ${shadow.dy}px`],
  ['blur', `${shadow.blur}px`],
  ['opacity', String(shadow.alpha)],
  ['tint', `rgb(${shadow.tint})`],
  ['moon', `${pct(moon.fraction)} lit, ${moon.waxing ? 'waxing' : 'waning'}`],
  ['sundial', bearing ? `aim device top ${Math.round(bearing.degrees)}deg (${bearing.direction})` : '--'],
];

const width = Math.max(...lines.map(([k]) => (k as string).length));
for (const [key, value] of lines) {
  process.stdout.write(`${(key as string).padEnd(width)}  ${value}\n`);
}
process.stdout.write(
  `\ncss:  box-shadow: ${shadow.dx}px ${shadow.dy}px ${shadow.blur}px rgb(${shadow.tint} / ${shadow.alpha});\n`,
);
