import config, { reactConfig } from '@iobroker/eslint-config';

export default [
    ...config,
    ...reactConfig,
    {
        rules: {
            '@typescript-eslint/no-require-imports': 'off',
        },
    },
];
