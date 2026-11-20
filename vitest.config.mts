import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['apps/{api,worker}/src/**/*.test.ts', 'packages/validation/src/**/*.test.ts'],
    clearMocks: true,
    restoreMocks: true,
    unstubEnvs: true,
    maxWorkers: 2,
    reporters: ['default', 'junit'],
    outputFile: { junit: 'test-results/unit.xml' },
    coverage: {
      provider: 'v8',
      include: ['apps/{api,worker}/src/**/*.ts', 'packages/validation/src/environment.ts'],
      exclude: ['**/*.test.ts'],
      reporter: ['text', 'json-summary', 'html', 'lcov'],
      thresholds: {
        'apps/*/src/config/*.ts': { statements: 95, branches: 90, functions: 95, lines: 95 },
        'packages/validation/src/environment.ts': {
          statements: 95,
          branches: 90,
          functions: 95,
          lines: 95,
        },
      },
    },
  },
});
