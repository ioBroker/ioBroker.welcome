const engineHelper = require('@iobroker/legacy-testing/engineHelper');
const guiHelper = require('@iobroker/legacy-testing/guiHelper');

let gPage;
process.env.ADMIN_VERSION = '8.0.1';
const rootDir = `${__dirname}/../`;

describe('welcome-gui', () => {
    before(async function () {
        this.timeout(240_000);

        // install js-controller
        await engineHelper.startIoBrokerAdapters();
        const { page } = await guiHelper.startBrowser(
            'welcome',
            rootDir,
            process.env.CI === 'true',
            '#tab-instances/config/system.adapter.acme.0/statusTab',
        );
        gPage = page;
    });

    it('Check web server', async function () {
        this.timeout(5_000);
        await gPage.waitForSelector('.MuiAvatar-root', { timeout: 5_000 });
    });

    after(async function () {
        this.timeout(5000);
        await guiHelper.stopBrowser();
        console.log('BROWSER stopped');
        await engineHelper.stopIoBrokerAdapters();
        console.log('ioBroker stopped');
    });
});
