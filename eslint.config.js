import globals from 'globals';
import js from '@eslint/js';

export default [
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.node,
                ...globals.es2021
            }
        },
        rules: {
            'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
            'no-console': ['warn', { allow: ['warn', 'error', 'info', 'debug'] }],
            'eqeqeq': ['error', 'always', { null: 'ignore' }],
            'prefer-const': 'error'
        }
    },
    {
        ignores: ['node_modules/**', 'dist/**', 'coverage/**', 'test/index.html']
    }
];
