const { shared } = require('@iobroker/adapter-react-v5/modulefederation.admin.config');

module.exports = {
    name: 'ConfigCustomWelcomeSet',
    filename: 'customComponents.js',
    exposes: {
        './Components': './src/Components.jsx',
    },
    shared,
};
