import globals from 'globals'
import pluginJs from '@eslint/js/dist/eslintrc.cjs'
import tseslint from 'typescript-eslint'
import prettierPlugin from 'eslint-plugin-prettier'
import unusedImportsPlugin from 'eslint-plugin-unused-imports'
import importPlugin from 'eslint-plugin-import'

export default tseslint.config(
  {
    ignores: ['dist', 'node_modules'],
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      prettier: prettierPlugin,
      'unused-imports': unusedImportsPlugin,
      import: importPlugin,
    },
    rules: {
      'prettier/prettier': 'error',
      'unused-imports/no-unused-imports': 'warn',
      'import/order': [
        'warn',
        { alphabetize: { order: 'asc', caseInsensitive: true }, 'newlines-between': 'always' },
      ],
    },
  },
  {
    languageOptions: {
      globals: globals.browser,
      parser: tseslint.parser,
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
)
