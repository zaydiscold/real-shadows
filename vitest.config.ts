import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node', // apply.test.ts opts into happy-dom via its pragma
    include: ['test/**/*.test.ts'],
  },
});
