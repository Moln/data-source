import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import importPlugin from 'eslint-plugin-import';

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [
        js.configs.recommended,
        ...tseslint.configs.recommended,
        importPlugin.flatConfigs.recommended,
        importPlugin.flatConfigs.typescript,
    ],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
        "@typescript-eslint/no-explicit-any": ["off"],
        "@typescript-eslint/no-unsafe-function-type": ["off"],
        "no-prototype-builtins": ["off"],
        "no-case-declarations": ["off"],
    },
  },
)
