// Don't silently swallow unhandled rejections
process.on('unhandledRejection', (e) => {
    throw e;
});

// enable the should interface and load chai-as-promised by default.
// Note: chai must stay on v4 and chai-as-promised on v7, because newer versions are ESM only
const chaiAsPromised = require('chai-as-promised');
const { should, use } = require('chai');

should();
use(chaiAsPromised);