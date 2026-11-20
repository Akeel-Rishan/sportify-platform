import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import nextVitals from 'eslint-config-next/core-web-vitals';
import prettier from 'eslint-config-prettier/flat';
import globals from 'globals';

const typescriptFiles = ['apps/**/*.{ts,tsx}', 'packages/**/*.ts'];

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/coverage/**',
      '**/test-results/**',
      'tmp/**',
      '**/next-env.d.ts',
    ],
  },
  {
    ...js.configs.recommended,
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: { globals: globals.node },
  },
  ...tseslint.configs.recommended.map((config) => ({ ...config, files: ['vitest.config.mts'] })),
  ...nextVitals.map((config) => ({ ...config, files: ['apps/web/**/*.{ts,tsx,js,jsx}'] })),
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: typescriptFiles,
  })),
  {
    files: typescriptFiles,
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@sportify/web', '@sportify/api', '@sportify/worker', '@sportify/*/src/**'],
              message:
                'Use public shared package exports; application internals are not shared packages.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/**/*.ts', 'apps/**/*.tsx'],
    ignores: ['apps/*/src/config/env.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message: 'Read configuration through the application config boundary.',
        },
      ],
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    settings: { next: { rootDir: 'apps/web/' } },
    plugins: {
      boundaries: {
        rules: {
          'no-client-server-config': {
            meta: {
              type: 'problem',
              schema: [],
              messages: {
                server:
                  'Client components cannot import server configuration. Use the public allowlist.',
              },
            },
            create(context) {
              let client = false;
              return {
                Program(node) {
                  client = node.body.some(
                    (statement) =>
                      statement.type === 'ExpressionStatement' &&
                      statement.directive === 'use client',
                  );
                },
                ImportDeclaration(node) {
                  if (
                    client &&
                    /(?:server-env|server-only|@sportify\/shared-config)/.test(node.source.value)
                  )
                    context.report({ node, messageId: 'server' });
                },
              };
            },
          },
        },
      },
    },
    rules: { 'boundaries/no-client-server-config': 'error' },
  },
  prettier,
];
