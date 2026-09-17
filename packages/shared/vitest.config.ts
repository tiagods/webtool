import { defineConfig } from 'vitest/config';
import { coverageThresholds, coverageExclude } from '../../vitest.shared';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
    coverage: {
      ...coverageThresholds,
      provider: 'v8',
      exclude: coverageExclude,
      include: ['src/**/*.ts'],
    },
  },
});