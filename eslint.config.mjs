// eslint.config.mjs
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals"), // Base Next.js rules
  {
    // Customizations and overrides
    files: ["**/*.js", "**/*.jsx", "**/*.ts", "**/*.tsx"],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        browser: true,
        es2021: true,
        node: true,
      },
    },
    rules: {
      'react/no-unescaped-entities': ['warn', { // Set to 'warn' to avoid build breaks during setup
        forbid: [
          // We explicitly list what MUST be escaped.
          // If a character is not in this list, this specific rule override won't flag it.
          { char: '>', alternative: '>', message: 'Always escape ">" in JSX text with ">".' },
          { char: '}', alternative: '}', message: 'Always escape "}" in JSX text with "}" (especially if not part of an expression).' },
          { char: '{', alternative: '{', message: 'Always escape "{" in JSX text with "{" (especially if not part of an expression).' },
          // By NOT including an entry for "'" (apostrophe) or '"' (double quote) here,
          // we are telling THIS PART of the ESLint config that we don't mind them being unescaped.
          // HOWEVER, the base "next/core-web-vitals" might still enforce escaping for them.
        ],
      }],
      'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    },
  }
];

export default eslintConfig;