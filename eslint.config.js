import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'test-results/**',
      'playwright-report/**',
      'blob-report/**',
      'src/runtime.bundle.js'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.worker
      }
    },
    rules: {
      // Runtime extension modules intentionally share the editor lexical runtime when the committed bundle is generated.
      'no-undef': 'off',
      'no-unused-vars': 'off'
    }
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      globals: globals.browser
    }
  },
  {
    files: ['tests/**/*.ts', 'playwright.config.ts', 'eslint.config.js', 'scripts/**/*.mjs'],
    languageOptions: {
      globals: globals.node
    }
  }
];
