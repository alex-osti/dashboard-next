// eslint.config.mjs
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
// import pluginReact from 'eslint-plugin-react'; // Likely not needed due to next/core-web-vitals

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals"), // Base Next.js rules (includes react, react-hooks, next, jsx-a11y)
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
      'react/no-unescaped-entities': ['warn', { // Set to 'warn' for now
        forbid: [
          { char: '>', alternative: '>' },
          { char: '"', alternative: '"' },
          { char: '}', alternative: '}' },
          { char: '{', alternative: '{' },
          // By not listing "'", we are telling *this specific rule override*
          // that we don't want to forbid it.
          // If next/core-web-vitals still flags it, its base config is stricter.
        ],
      }],
      // Example: Allow console.log during development
      'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',

      // Add any other specific rule overrides here.
      // For example, if you use prop spreading and want to allow it:
      // 'react/jsx-props-no-spreading': 'off',
    },
  }
];

export default eslintConfig;