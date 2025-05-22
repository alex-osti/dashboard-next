// eslint.config.mjs
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import pluginReact from 'eslint-plugin-react';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [...compat.extends("next/core-web-vitals")];

eslintConfig.push({
  files: ["**/*.js", "**/*.jsx", "**/*.ts", "**/*.tsx"], // Good practice to specify files
  plugins: {
    react: pluginReact
  },
  rules: {
    'react/no-unescaped-entities': ['error', {
      forbid: [
        { char: '>', alternative: '>' },    // Corrected
        { char: '"', alternative: '"' },  // Corrected
        { char: '}', alternative: '}' }   // Corrected
        // Apostrophe ' is intentionally left out of this list, so it should be allowed.
      ]
    }],
  },
});

export default eslintConfig;