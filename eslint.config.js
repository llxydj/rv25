// eslint.config.js
import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";
import nextPlugin from "@next/eslint-plugin-next";

export default [
  js.configs.recommended,
  tsPlugin.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    ignores: [
      "node_modules/",
      ".next/",
      "dist/",
      "build/",
      "out/",
      "src/lib/__tests__/**",
      "public/sw.js",
      "public/sw-enhanced.js",
      "public/service-worker.js",
      "public/workbox-*.js",
      "jest.config.cjs",
      "jest.setup.js",
      "next.config.mjs",
      "postcss.config.cjs",
      "types/supabase.ts"
    ],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        project: "./tsconfig.json",
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "@next/next": nextPlugin,
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "@next/next/no-html-link-for-pages": "error",
    },
  },
];
