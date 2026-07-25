import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    treeshake: true,
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
