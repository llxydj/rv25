// .eslintrc.js
module.exports = {
    root: true,
    parser: '@typescript-eslint/parser', // TypeScript parser
    parserOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      project: './tsconfig.json',
    },
    env: {
      browser: true,
      node: true,
      es2021: true,
    },
    plugins: [
      '@typescript-eslint',
      'react-hooks',
      'react',
      '@next/next',
    ],
    extends: [
      'eslint:recommended',
      'plugin:@typescript-eslint/recommended',
      'plugin:react/recommended',
      'plugin:react-hooks/recommended',
      'plugin:@next/next/recommended',
    ],
    rules: {
      // TypeScript
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
  
      // React hooks
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
  
      // Next.js
      '@next/next/no-html-link-for-pages': 'error',
  
      // General JS
      'no-unused-vars': 'off',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    ignorePatterns: [
      'node_modules/',
      '.next/',
      'dist/',
      'build/',
      'out/',
      'coverage/',
      'public/sw.js',
      'public/sw-enhanced.js',
      'public/service-worker.js',
      'public/workbox-*.js',
      'jest.config.cjs',
      'jest.setup.js',
      'next.config.mjs',
      'postcss.config.cjs',
      'types/supabase.ts',
    ],
  };
  