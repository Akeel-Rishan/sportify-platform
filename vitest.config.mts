import { defineConfig } from 'vitest/config';
import ts from 'typescript';

export default defineConfig({
  plugins: [
    {
      name: 'nest-typescript-metadata',
      enforce: 'pre',
      transform(source, id) {
        if (!/\/apps\/api\/(?:src|test)\/.*\.ts$/.test(id.replaceAll('\\', '/'))) return;
        // Same legacy decorator/metadata settings as the production TypeScript build.
        const result = ts.transpileModule(source, {
          fileName: id,
          compilerOptions: {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.ESNext,
            experimentalDecorators: true,
            emitDecoratorMetadata: true,
            sourceMap: true,
            inlineSources: true,
            esModuleInterop: true,
          },
        });
        return { code: result.outputText, map: result.sourceMapText ?? null };
      },
    },
  ],
  test: {
    environment: 'node',
    include: [
      'apps/{api,worker}/src/**/*.test.ts',
      'packages/{validation,database,migrations,verification-email}/src/**/*.test.ts',
      'apps/api/test/**/*.e2e-spec.ts',
      'database/tests/unit/**/*.test.mjs',
    ],
    clearMocks: true,
    restoreMocks: true,
    unstubEnvs: true,
    maxWorkers: 2,
    reporters: ['default', 'junit'],
    outputFile: { junit: 'test-results/unit.xml' },
    coverage: {
      provider: 'v8',
      include: [
        'apps/{api,worker}/src/**/*.ts',
        'packages/validation/src/environment.ts',
        'packages/database/src/**/*.ts',
        'packages/migrations/src/**/*.ts',
        'packages/verification-email/src/**/*.ts',
      ],
      exclude: ['**/*.test.ts', '**/browser.ts'],
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
