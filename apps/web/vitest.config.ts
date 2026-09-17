import { defineConfig } from 'vitest/config';
import { coverageThresholds, coverageExclude } from '../../vitest.shared';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['app/**/*.test.{ts,tsx}', 'components/**/*.test.{ts,tsx}', 'lib/**/*.test.{ts,tsx}'],
    coverage: {
      ...coverageThresholds,
      provider: 'v8',
      exclude: coverageExclude,
      include: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'lib/**/*.{ts,tsx}'],
    },
  },
});