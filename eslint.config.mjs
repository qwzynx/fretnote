import js from "@eslint/js";
import globals from "globals";
import ts from "typescript-eslint";
import svelte from "eslint-plugin-svelte";
import svelteParser from "svelte-eslint-parser";

export default ts.config(
  {
    ignores: [
      "dist/**",
      "target/**",
      "src-tauri/target/**",
      "node_modules/**",
      "public/**",
      "scripts/**",
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.es2021 },
    },
    rules: {
      // Deliberate no-ops are common here: `.catch(() => {})` on ALTER TABLE
      // for a column that already exists, and swallowed localStorage errors.
      "no-empty": ["error", { allowEmptyCatch: true }],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Worth knowing about — a key lets Svelte reuse DOM nodes instead of
      // rebuilding the list — but most of the hits here iterate module-level
      // constant arrays where it changes nothing. Warn, and key the ones
      // that iterate real data.
      "svelte/require-each-key": "warn",
      // `{" "}` in a chord-over-lyrics line is deliberate whitespace, not a
      // redundant expression — the alignment depends on it.
      "svelte/no-useless-mustaches": "off",
      // State here is replaced immutably (`membership = new Map(membership)`)
      // rather than mutated in place, which is already reactive.
      "svelte/prefer-svelte-reactivity": "off",
    },
  },
  {
    // `.svelte.ts` modules carry runes too, so they need the Svelte parser
    // rather than the plain TS one.
    files: ["**/*.svelte", "**/*.svelte.ts"],
    languageOptions: {
      parser: svelteParser,
      parserOptions: { parser: ts.parser },
    },
  }
);
