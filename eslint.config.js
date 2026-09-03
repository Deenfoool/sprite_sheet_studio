import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'test-results/**', 'playwright-report/**', 'blob-report/**']
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
      // Extension modules are intentionally concatenated into the editor runtime by page-loader.js.
      // Names such as state/el/toast are therefore lexical runtime dependencies, not browser globals.
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
    files: ['tests/**/*.ts', 'playwright.config.ts', 'eslint.config.js'],
    languageOptions: {
      globals: globals.node
    }
  }
];
