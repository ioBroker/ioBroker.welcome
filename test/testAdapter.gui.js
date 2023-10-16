const engineHelper = require('./engineHelper');
const guiHelper = require('./guiHelper');

let gPage;

describe('welcome-gui', () => {
    before(async function (){
        this.timeout(240_000);

        // install js-controller, web and vis-2-beta
        await engineHelper.startIoBroker();
        const { page } = await guiHelper.startBrowser(process.env.CI === 'true');
        gPage = page;
    });

    it('Check web server', async function (){
        this.timeout(5_000);
        await gPage.waitForSelector('.MuiAvatar-root', { timeout: 5_000 });
    });

    after(async function () {
        this.timeout(5000);
        await guiHelper.stopBrowser();
        console.log('BROWSER stopped');
        await engineHelper.stopIoBroker();
        console.log('ioBroker stopped');
    });
});