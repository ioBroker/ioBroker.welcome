import config from '@iobroker/eslint-config';

export default [
    ...config,
    {
        rules: {
            '@typescript-eslint/no-require-imports': 'off',
        },
    },
];
