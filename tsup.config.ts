import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: { index: 'src/index.ts', cli: 'src/cli.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    treeshake: true,
    // Two entries that share code make tsup split the common part into a
    // chunk, leaving dist/index.js as a bare re-export. That breaks any
    // consumer copying index.js on its own, which is exactly how the demo
    // page loads it: the chunk 404s and the module never evaluates.
    // Each entry carries its own copy instead; the duplication is ~3 kB.
    splitting: false,
    target: 'es2020',
    outExtension: ({ format }) => ({ js: format === 'cjs' ? '.cjs' : '.js' }),
  },
  {
    // script-tag build: window.RealShadows
    entry: { 'real-shadows': 'src/global.ts' },
    format: ['iife'],
    globalName: 'RealShadows',
    minify: true,
    target: 'es2020',
    outExtension: () => ({ js: '.global.js' }),
  },
]);
