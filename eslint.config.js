import eslint from "@eslint/js";
import globals from "globals";

export default [
  eslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2022,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      semi: ["error", "always"],
      quotes: ["warn", "double", { avoidEscape: true, allowTemplateLiterals: true }],
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-extend-native": "error",
      "no-global-assign": "error",
      "no-var": "error",
      "prefer-const": "warn",
      "no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      }],
      camelcase: ["warn", {
        properties: "never",
        ignoreDestructuring: true,
        ignoreImports: true,
        ignoreGlobals: true,
        allow: ["^[a-z]+(_[a-z]+)*$"],
      }],
      "new-cap": ["warn", {
        newIsCap: true,
        capIsNew: false,
        properties: false,
      }],
      radix: "error",
      eqeqeq: ["warn", "always", { null: "ignore" }],
      "no-console": "off",
      "no-debugger": "error",
      "no-alert": "error",
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-duplicate-imports": "error",
      "no-useless-constructor": "warn",
      "prefer-template": "warn",
      "no-nested-ternary": "warn",
      "max-depth": ["warn", 4],
      complexity: ["warn", 20],
      "no-throw-literal": "error",
      "prefer-promise-reject-errors": "error",
    },
  },
  {
    files: ["**/*.jsx"],
    rules: {
      camelcase: "off",
    },
  },
  {
    ignores: [
      "node_modules/",
      "dist/",
      "build/",
      "migrations/",
      "backend/migrations/",
      "uploads/",
      "storage/",
      "**/*.min.js",
      "**/*.config.js",
    ],
  },
];
