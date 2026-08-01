import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const CLI = new URL('../dist/cli.js', import.meta.url).pathname;

/**
 * The CLI runs against the built output, so these only mean anything after a
 * build. Skipping rather than failing keeps `vitest` useful on a clean
 * checkout; CI always builds first.
 */
const run = (args: string[]): string =>
  execFileSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });

describe.skipIf(!existsSync(CLI))('cli', () => {
  it('prints a shadow for a location', () => {
    const out = run(['37.77', '-122.42']);
    expect(out).toMatch(/casting\s+(sun|moon|none)/);
    expect(out).toMatch(/box-shadow:/);
  });

  it('reads a negative longitude as a longitude, not a flag', () => {
    // regression: `--at` absent made atIndex -1, and `atIndex + 1` ate argv[0]
    const out = run(['37.77', '-122.42']);
    expect(out).toContain('37.77, -122.42');
  });

  it('honours --at, and hands off to the moon after dark', () => {
    const out = run(['37.77', '-122.42', '--at', '2026-07-30T09:00:00Z']);
    expect(out).toContain('casting  moon');
    expect(out).toContain('sun -32.8deg, down');
  });

  it('emits parseable json', () => {
    const parsed = JSON.parse(run(['51.51', '-0.13', '--at', '2026-06-21T12:00:00Z', '--json']));
    expect(parsed.shadow.source).toBe('sun');
    expect(parsed.sky.sky).toBe('day');
    expect(parsed.lat).toBe(51.51);
  });

  it('rejects nonsense coordinates instead of printing a bogus shadow', () => {
    expect(() => run(['abc', '12'])).toThrow();
    expect(() => run(['200', '12'])).toThrow();
  });

  it('rejects a flag it does not know instead of silently running with now', () => {
    // regression: `--date 2026-01-01` (a typo for --at) used to be ignored
    expect(() => run(['37.77', '-122.42', '--date', '2026-01-01'])).toThrow();
  });
});
