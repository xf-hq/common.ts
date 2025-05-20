import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';

export default tseslint.config(
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    ...tseslint.configs.disableTypeChecked,
  },
  {
    plugins: {
      '@eslint': eslint,
      '@stylistic': stylistic,
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      'no-invalid-this': 'warn',
      'no-this-before-super': 'warn',
      'no-unexpected-multiline': 'error',
      'no-unreachable': 'warn',
      'no-unused-vars': ['off', { vars: 'all', args: 'none', ignoreRestSiblings: true }],
      'no-var': 'error',
      'prefer-rest-params': 'off',
      'prefer-spread': 'off',
      'prefer-const': 'warn',

      '@stylistic/arrow-spacing': 'warn',
      '@stylistic/block-spacing': 'warn',
      '@stylistic/brace-style': ['warn', 'stroustrup', { allowSingleLine: true }],
      '@stylistic/comma-dangle': ['warn', {
        arrays: 'always-multiline',
        objects: 'always-multiline',
        imports: 'ignore',
        exports: 'ignore',
        functions: 'ignore',
        enums: 'always-multiline',
        tuples: 'always-multiline',
      }],
      '@stylistic/comma-spacing': 'warn',
      '@stylistic/func-call-spacing': ['warn', 'never'],
      '@stylistic/generator-star-spacing': ['warn', { before: false, after: true, method: { before: true, after: false } }],
      '@stylistic/key-spacing': 'warn',
      '@stylistic/keyword-spacing': ['warn', { after: true }],
      '@stylistic/member-delimiter-style': ['warn', {
        multiline: {
          delimiter: 'semi',
          requireLast: true,
        },
        singleline: {
          delimiter: 'semi',
          requireLast: false,
        },
        multilineDetection: 'brackets',
      }],
      '@stylistic/no-extra-semi': 'warn',
      '@stylistic/no-multi-spaces': 'warn',
      '@stylistic/no-whitespace-before-property': 'warn',
      '@stylistic/object-curly-spacing': ['warn', 'always'],
      '@stylistic/quotes': ['warn', 'single', { avoidEscape: true, allowTemplateLiterals: true }],
      '@stylistic/semi': 'warn',
      '@stylistic/semi-spacing': 'warn',
      '@stylistic/space-before-blocks': ['warn', 'always'],
      '@stylistic/space-before-function-paren': ['warn', 'always'],
      '@stylistic/space-in-parens': 'warn',
      '@stylistic/space-infix-ops': ['warn', { int32Hint: true }],
      '@stylistic/spaced-comment': ['warn', 'always', { exceptions: ['*'] }],
      '@stylistic/type-annotation-spacing': 'warn',
      '@stylistic/type-generic-spacing': 'warn',
      '@stylistic/type-named-tuple-spacing': 'warn',

      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'off',
      '@typescript-eslint/no-require-imports': 'error',
      '@typescript-eslint/no-this-alias': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    ignores: ['**/*.js'],
  },
);
