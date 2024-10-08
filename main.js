const express = require('express');
const fs = require('node:fs');
const axios = require('axios');
const utils = require('@iobroker/adapter-core'); // Get common adapter utils
const IoBWebServer = require('@iobroker/webserver');
const adapterName = require('./package.json').name.split('.').pop();

let webServer = null;
let indexHtml;
let adapter;
let logoPng;
let startTimeout = null;

function startAdapter(options) {
    options = options || {};

    Object.assign(options, {
        name: adapterName,
        unload: callback => {
            if (startTimeout) {
                clearTimeout(startTimeout);
                startTimeout = null;
            }
            try {
                webServer &&
                    webServer.settings &&
                    adapter &&
                    adapter.log &&
                    adapter.log.debug(
                        `terminating http${webServer.settings.secure ? 's' : ''} server on port ${webServer.settings.port}`,
                    );
                webServer?.server?.close();
            } catch {
                // ignore
            }
            callback();
        },
        ready: async () => main(),
        fileChange: async (id, name) => {
            if (name === 'logo.png') {
                indexHtml = await renderIndexHtml();
            }
        },
    });

    adapter = new utils.Adapter(options);

    return adapter;
}

const SUPPORTED_ADAPTERS = ['admin', 'web'];

async function getPages() {
    let redirect = '';

    if (adapter.config.redirectToLink) {
        return { pages: [], redirect: adapter.config.redirectUrl };
    }

    const instances = await adapter.getObjectViewAsync('system', 'instance', {});
    const mapInstance = {};
    for (let r = 0; r < instances.rows.length; r++) {
        mapInstance[instances.rows[r].id] = instances.rows[r].value;
    }
    const pages = [];
    for (const id in mapInstance) {
        const instance = mapInstance[id];
        const url = `http${instance.native.secure ? 's' : ''}://${instance.native.bind === '0.0.0.0' ? 'localhost' : instance.native.bind}:${instance.native.port}/`;
        if (id.substring('system.adapter.'.length) === adapter.config.redirect) {
            redirect = url;
        }

        if (
            adapter.config.allInstances === false &&
            adapter.config.specificInstances &&
            !adapter.config.specificInstances.includes(id.substring('system.adapter.'.length))
        ) {
            continue;
        }
        if (!instance.common || !instance.native) {
            continue;
        }
        if (!instance.common.enabled) {
            continue;
        }
        if (instance.common.onlyWWW) {
            continue;
        }
        if (!SUPPORTED_ADAPTERS.includes(instance.common.name)) {
            continue;
        }
        let icon = await adapter.readFileAsync(`${instance.common.name}.admin`, instance.common.icon);
        if (instance.common.icon.endsWith('.jpg')) {
            icon = `data:image/jpg;base64,${icon.file.toString('base64')}`;
        } else if (instance.common.icon.endsWith('.png')) {
            icon = `data:image/png;base64,${icon.file.toString('base64')}`;
        } else {
            if (icon.file instanceof Buffer) {
                icon = `data:${icon.mimeType};base64,${icon.file.toString('base64')}`;
            } else {
                icon = `data:${icon.mimeType};base64,${Buffer.from(icon.file).toString('base64')}`;
            }
        }
        pages.push({
            icon,
            instance: instance._id.substring('system.adapter.'.length),
            title: instance.common.titleLang || instance.common.title,
            url,
        });
    }

    if (adapter.config.customLinks) {
        adapter.config.customLinks.map(item => {
            if (item.enabled) {
                pages.push({
                    icon: item.icon,
                    instance: item.name,
                    title: item.desc,
                    url: item.link,
                    blank: item.blank,
                });
            }
        });
    }

    return { pages, redirect };
}

async function renderIndexHtml() {
    // try to read logo
    try {
        logoPng = await adapter.readFileAsync(adapter.namespace, 'logo.png');
    } catch {
        logoPng = null;
    }

    const _indexHtml = fs.existsSync(`${__dirname}/src/build/index.html`)
        ? fs.readFileSync(`${__dirname}/src/build/index.html`).toString()
        : fs.readFileSync(`${__dirname}/public/index.html`).toString();

    const systemConfig = await adapter.getForeignObjectAsync('system.config');
    const { pages, redirect } = await getPages();

    if (redirect) {
        return _indexHtml.replace(
            'window.REPLACEMENT_TEXT="REPLACEMENT_TEXT"',
            `window.location="${redirect}".replace('localhost', window.location.hostname);`,
        );
    }

    const IOBROKER_PAGES = {
        welcomePhrase: adapter.config.welcomePhrase,
        backgroundColor: adapter.config.backgroundColor,
        backgroundToolbarColor: adapter.config.backgroundToolbarColor,
        language: adapter.config.language || systemConfig.common.language,
        logoPng: logoPng ? `data:${logoPng.mimeType};base64,${logoPng.file.toString('base64')}` : '',
        pages,
    };

    return _indexHtml.replace(
        'window.REPLACEMENT_TEXT="REPLACEMENT_TEXT"',
        `window.IOBROKER_PAGES=${JSON.stringify(IOBROKER_PAGES)};`,
    );
}

async function main() {
    adapter.subscribeForeignFiles && (await adapter.subscribeForeignFiles(adapter.namespace, 'logo.png'));

    indexHtml = await renderIndexHtml();

    initWebServer(adapter.config)
        .then(returnedServer => (webServer = returnedServer))
        .catch(err => {
            adapter.log.error(`Failed to initWebServer: ${err}`);
            adapter.terminate
                ? adapter.terminate(utils.EXIT_CODES.ADAPTER_REQUESTED_TERMINATION)
                : process.exit(utils.EXIT_CODES.ADAPTER_REQUESTED_TERMINATION);
        });
}

async function renderAliveJson() {
    const { pages } = await getPages();
    const alive = [];
    for (let p = 0; p < pages.length; p++) {
        try {
            const response = await axios.get(pages[p].url, { timeout: 1000 });
            alive[p] = response.status === 200;
        } catch {
            pages[p].url = '';
            alive[p] = false;
        }
    }
    return alive;
}

//settings: {
//    "port":   8080,
//    "auth":   false,
//    "secure": false,
//    "bind":   "0.0.0.0", // "::"
//    "cache":  false
//}
async function initWebServer(settings) {
    const server = {
        app: null,
        server: null,
        io: null,
        settings,
    };

    settings.defaultUser = settings.defaultUser || 'system.user.admin';
    if (!settings.defaultUser.startsWith('system.user.')) {
        settings.defaultUser = `system.user.${settings.defaultUser}`;
    }

    if (settings.port) {
        server.app = express();
        server.app.disable('x-powered-by');

        server.app.use(async (req, res, next) => {
            const url = req.url.split('?')[0];
            if (!url || url === '/' || url === '/index.html') {
                res.set('Cache-Control', `public, max-age=${adapter.config.staticAssetCacheMaxAge}`);
                res.send(indexHtml);
            } else if (url === '/alive.json' || url === 'alive.json') {
                res.json(await renderAliveJson());
            } else {
                next();
            }
        });

        server.app.use(express.static(`${__dirname}/public`));

        const appOptions = {};
        if (settings.cache) {
            appOptions.maxAge = 30758400000; // one year
        }

        try {
            const webserver = new IoBWebServer.WebServer({ app: server.app, adapter, secure: settings.secure });
            server.server = await webserver.init();
        } catch (err) {
            adapter.log.error(`Cannot create web-server: ${err}`);
            adapter.terminate
                ? adapter.terminate(utils.EXIT_CODES.ADAPTER_REQUESTED_TERMINATION)
                : process.exit(utils.EXIT_CODES.ADAPTER_REQUESTED_TERMINATION);
            return;
        }
        if (!server.server) {
            adapter.log.error(`Cannot create web-server`);
            adapter.terminate
                ? adapter.terminate(utils.EXIT_CODES.ADAPTER_REQUESTED_TERMINATION)
                : process.exit(utils.EXIT_CODES.ADAPTER_REQUESTED_TERMINATION);
            return;
        }

        server.server.__server = server;
    } else {
        adapter.log.error('port missing');
        adapter.terminate
            ? adapter.terminate(utils.EXIT_CODES.ADAPTER_REQUESTED_TERMINATION)
            : process.exit(utils.EXIT_CODES.ADAPTER_REQUESTED_TERMINATION);
    }

    if (server.server) {
        let serverListening = false;
        let serverPort;
        server.server.on('error', e => {
            if (e.toString().includes('EACCES') && serverPort <= 1024) {
                adapter.log.error(
                    `node.js process has no rights to start server on the port ${serverPort}.\n` +
                        `Do you know that on linux you need special permissions for ports under 1024?\n` +
                        `You can call in shell following scrip to allow it for node.js: "iobroker fix"`,
                );
            } else {
                adapter.log.error(`Cannot start server on ${settings.bind || '0.0.0.0'}:${serverPort}: ${e}`);
            }
            if (!serverListening) {
                adapter.terminate
                    ? adapter.terminate(utils.EXIT_CODES.ADAPTER_REQUESTED_TERMINATION)
                    : process.exit(utils.EXIT_CODES.ADAPTER_REQUESTED_TERMINATION);
            }
        });

        settings.port = parseInt(settings.port, 10) || 8082;
        serverPort = settings.port;

        adapter.getPort(
            settings.port,
            !settings.bind || settings.bind === '0.0.0.0' ? undefined : settings.bind || undefined,
            port => {
                port = parseInt(port, 10);
                if (port !== settings.port && !settings.findNextPort) {
                    adapter.log.error(`port ${settings.port} already in use`);
                    // retry every 10 seconds to open the welcome screen on port 80
                    if (startTimeout) {
                        clearTimeout(startTimeout);
                    }
                    startTimeout = setTimeout(
                        () => {
                            startTimeout = null;
                            initWebServer(settings);
                        },
                        (parseInt(adapter.config.retryInterval, 10) || 10) * 1000,
                    );
                    return;
                }
                serverPort = port;
                server.server.listen(
                    port,
                    !settings.bind || settings.bind === '0.0.0.0' ? undefined : settings.bind || undefined,
                    () => {
                        serverListening = true;
                        adapter.setState('info.connection', true, true);
                    },
                );

                adapter.log.info(`http${settings.secure ? 's' : ''} server listening on port ${port}`);
            },
        );
    }

    if (server.server) {
        return server;
    }
    return null;
}

// If started as allInOne/compact mode => return function to create instance
if (module && module.parent) {
    module.exports = startAdapter;
} else {
    // or start the instance directly
    startAdapter();
}
