export const coverageThresholds = {
  perFile: true,
  statements: 95,
  branches: 94,
  functions: 95,
  lines: 95,
} as const;

export const coverageExclude = [
  '**/*.d.ts',
  '**/*.config.*',
  '**/index.ts',
  '**/layout.tsx',
  '**/page.tsx',
  '**/loading.tsx',
  '**/error.tsx',
  '**/not-found.tsx',
  '**/.next/**',
  '**/dist/**',
  '**/node_modules/**',
];