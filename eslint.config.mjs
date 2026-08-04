import config from '@iobroker/eslint-config';

export default [
    ...config,
    {
        ignores: [
            'test/**/*',
            '*.config.mjs',
            'node_modules/**/*',
            'build/**/*',
            'public/**/*',
            'admin/**/*',
            'src-admin/**/*',
            'src-www/**/*',
        ],
    },
    {
        rules: {
            '@typescript-eslint/no-require-imports': 'off',
            'jsdoc/require-jsdoc': 'off',
            'jsdoc/require-param': 'off',
            'jsdoc/check-param-names': 'off',
        },
    },
];
