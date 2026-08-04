import config, { reactConfig } from '@iobroker/eslint-config';

export default [
    ...config,
    ...reactConfig,
    {
        ignores: ['.__mf__temp/**/*', 'node_modules/**/*', 'build/**/*'],
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
