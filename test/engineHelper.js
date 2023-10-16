const fs = require('fs');
const setup = require('@iobroker/legacy-testing');

let rootDir = `${__dirname}/../../../`;
let objects = null;
let states  = null;
let onStateChanged = null;

function deleteFoldersRecursive(path) {
    if (path.endsWith('/')) {
        path = path.substring(0, path.length - 1);
    }
    if (fs.existsSync(path)) {
        const files = fs.readdirSync(path);
        for (const file of files) {
            const curPath = `${path}/${file}`;
            const stat = fs.statSync(curPath);
            if (stat.isDirectory()) {
                deleteFoldersRecursive(curPath);
                fs.rmdirSync(curPath);
            } else {
                fs.unlinkSync(curPath);
            }
        }
    }
}

function startIoBroker(options) {
    options = options || {};
    if (options.rootDir) {
        rootDir = options.rootDir;
    }

    return new Promise(async resolve => {
        // delete the old project
        deleteFoldersRecursive(`${rootDir}tmp/screenshots`);

        await setup.setOfflineState('system.adapter.welcome.0.alive', { val: false });

        setup.setupController(null, async systemConfig => {
            // disable statistics and set license accepted
            systemConfig.common.licenseConfirmed = true;
            systemConfig.common.diag = 'none';
            await setup.setObject('system.config', systemConfig);

            // lets the web adapter start on port 18080
            const config = await setup.getAdapterConfig(0, 'welcome');
            if (config && config.common) {
                config.native.port = 18080;
                config.common.enabled = true;
                await setup.setAdapterConfig(config.common, config.native, 0, 'welcome');
            }

            setup.startController(
                false, // do not start widgets
                (/* id, obj */) => {},
                (id, state) => onStateChanged && onStateChanged(id, state),
                async (_objects, _states) => {
                    objects = _objects;
                    states = _states;
                    setup.startCustomAdapter('welcome', 0);
                    await checkIsWelcomeStartedAsync(states);
                    resolve({ objects, states });
                });
        });
    });
}

async function stopIoBroker() {
    await setup.stopCustomAdapter('welcome', 0);

    await new Promise(resolve =>
        setup.stopController(normalTerminated => {
            console.log(`Adapter normal terminated: ${normalTerminated}`);
            resolve();
        }));
}

function checkIsWelcomeStarted(states, cb, counter) {
    counter = counter === undefined ? 20 : counter;
    if (counter === 0) {
        return cb && cb(`Cannot check value Of State system.adapter.welcome.0.alive`);
    }

    states.getState('system.adapter.welcome.0.alive', (err, state) => {
        console.log(`[${counter}]Check if welcome is started "system.adapter.welcome.0.alive" = ${JSON.stringify(state)}`);
        err && console.error(err);
        if (state && state.val) {
            cb && cb();
        } else {
            setTimeout(() =>
                checkIsWelcomeStarted(states, cb, counter - 1), 500);
        }
    });
}

function checkIsWelcomeStartedAsync(states, counter) {
    return new Promise(resolve => checkIsWelcomeStarted(states, resolve, counter));
}

module.exports = {
    startIoBroker,
    stopIoBroker,
    setOnStateChanged: cb => onStateChanged = cb
};