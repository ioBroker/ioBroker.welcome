"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WelcomeAdapter = void 0;
const express_1 = __importDefault(require("express"));
const node_fs_1 = require("node:fs");
const axios_1 = __importDefault(require("axios"));
const adapter_core_1 = require("@iobroker/adapter-core"); // Get common adapter utils
const IoBWebServer = __importStar(require("@iobroker/webserver"));
const node_https_1 = require("node:https");
const SUPPORTED_ADAPTERS = ['admin', 'web'];
/** Placeholder in index.html. Quoting and spacing depend on whether the file was minified by the build */
const REPLACEMENT_PATTERN = /window\.REPLACEMENT_TEXT\s*=\s*(['"])REPLACEMENT_TEXT\1/;
/** Delay before the page is re-rendered after an instance object was changed */
const RENDER_DELAY_MS = 1_000;
/** Build the URL of a web instance out of its native settings */
function buildInstanceUrl(native) {
    // Listening on "all interfaces" says nothing about the address the user must call
    let bind = !native.bind || native.bind === '0.0.0.0' || native.bind === '::' ? 'localhost' : native.bind;
    // IPv6 addresses must be enclosed in brackets
    if (bind.includes(':')) {
        bind = `[${bind}]`;
    }
    return `http${native.secure ? 's' : ''}://${bind}:${native.port}/`;
}
class WelcomeAdapter extends adapter_core_1.Adapter {
    startTimeout = null;
    renderTimeout = null;
    webServer = null;
    logoPng = null;
    /** Logo of the vendor. It has priority over the uploaded logo.png */
    vendorLogo = null;
    indexHtml = '';
    favicon = '';
    systemConfigOwn = null;
    welcomeConfig;
    httpsAxios;
    constructor(options = {}) {
        super({
            ...options,
            name: 'welcome',
        });
        this.on('ready', () => {
            this.#onReady().catch(e => this.log.error(`Cannot start adapter: ${e}`));
        });
        this.on('fileChange', (id, fileName) => {
            this.#onFileChange(id, fileName).catch(e => this.log.error(`Cannot process file change: ${e}`));
        });
        this.on('objectChange', id => this.#onObjectChange(id));
        this.on('unload', callback => this.#onUnload(callback));
        this.welcomeConfig = this.config;
        this.httpsAxios = axios_1.default.create({
            httpsAgent: new node_https_1.Agent({
                rejectUnauthorized: false,
            }),
        });
    }
    async #onFileChange(id, fileName) {
        if (id === this.namespace && fileName === 'logo.png') {
            // Invalidate the cached logo, so `renderIndexHtml` reads the new file
            this.logoPng = this.vendorLogo;
            this.indexHtml = await this.renderIndexHtml();
        }
    }
    /** Re-render the page if an instance was added, removed or reconfigured */
    #onObjectChange(id) {
        if (!id.startsWith('system.adapter.') || !SUPPORTED_ADAPTERS.includes(id.split('.')[2])) {
            return;
        }
        // Many objects can change at once (e.g., on upgrade), so render only once afterward
        if (this.renderTimeout) {
            clearTimeout(this.renderTimeout);
        }
        this.renderTimeout = setTimeout(() => {
            this.renderTimeout = null;
            this.renderIndexHtml()
                .then(html => (this.indexHtml = html))
                .catch(e => this.log.error(`Cannot render index.html: ${e}`));
        }, RENDER_DELAY_MS);
    }
    #onUnload(callback) {
        if (this.startTimeout) {
            clearTimeout(this.startTimeout);
            this.startTimeout = null;
        }
        if (this.renderTimeout) {
            clearTimeout(this.renderTimeout);
            this.renderTimeout = null;
        }
        try {
            this.webServer?.settings &&
                this.log?.debug(`terminating http${this.webServer.settings.secure ? 's' : ''} server on port ${this.webServer.settings.port}`);
            this.webServer?.server?.close();
        }
        catch {
            // ignore
        }
        callback();
    }
    /**
     * Collect all pages that must be shown on the welcome screen
     *
     * @param withIcons Read and encode the instance icons. Not required for the alive check
     */
    async getPages(withIcons = true) {
        let redirect = '';
        if (this.welcomeConfig.redirectToLink) {
            return { pages: [], redirect: this.welcomeConfig.redirectUrl };
        }
        const instances = await this.getObjectViewAsync('system', 'instance', {});
        const mapInstance = {};
        for (let r = 0; r < instances.rows.length; r++) {
            mapInstance[instances.rows[r].id] = instances.rows[r].value;
        }
        const pages = [];
        for (const id in mapInstance) {
            const instance = mapInstance[id];
            if (!instance?.common || !instance.native) {
                continue;
            }
            const url = buildInstanceUrl(instance.native);
            if (id.substring('system.adapter.'.length) === this.welcomeConfig.redirect) {
                redirect = url;
            }
            if (this.welcomeConfig.allInstances === false &&
                !this.welcomeConfig.specificInstances?.includes(id.substring('system.adapter.'.length))) {
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
            let iconFile = null;
            if (withIcons && instance.common.icon) {
                try {
                    iconFile = await this.readFileAsync(`${instance.common.name}.admin`, instance.common.icon);
                }
                catch (e) {
                    this.log.debug(`Cannot read icon of ${id}: ${e.toString()}`);
                }
            }
            let icon;
            if (iconFile && instance.common.icon?.endsWith('.jpg')) {
                icon = `data:image/jpg;base64,${iconFile.file.toString('base64')}`;
            }
            else if (iconFile && instance.common.icon?.endsWith('.png')) {
                icon = `data:image/png;base64,${iconFile.file.toString('base64')}`;
            }
            else if (iconFile && iconFile.file instanceof Buffer) {
                icon = `data:${iconFile.mimeType};base64,${iconFile.file.toString('base64')}`;
            }
            else if (iconFile) {
                icon = `data:${iconFile.mimeType};base64,${Buffer.from(iconFile.file).toString('base64')}`;
            }
            pages.push({
                icon,
                instance: instance._id.substring('system.adapter.'.length),
                title: instance.common.titleLang || instance.common.title,
                url,
            });
        }
        this.welcomeConfig.customLinks?.map(item => {
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
        return { pages, redirect };
    }
    async renderIndexHtml() {
        // try to read logo
        try {
            this.logoPng ||= await this.readFileAsync(this.namespace, 'logo.png');
        }
        catch {
            this.logoPng = null;
        }
        const _indexHtml = (0, node_fs_1.existsSync)(`${__dirname}/../src-www/build/index.html`)
            ? (0, node_fs_1.readFileSync)(`${__dirname}/../src-www/build/index.html`).toString()
            : (0, node_fs_1.readFileSync)(`${__dirname}/../public/index.html`).toString();
        const { pages, redirect } = await this.getPages();
        if (redirect) {
            return _indexHtml.replace(REPLACEMENT_PATTERN, () => `window.location="${redirect}".replace('localhost', window.location.hostname);`);
        }
        const IOBROKER_PAGES = {
            welcomePhrase: this.welcomeConfig.welcomePhrase,
            backgroundColor: this.welcomeConfig.backgroundColor,
            backgroundToolbarColor: this.welcomeConfig.backgroundToolbarColor,
            language: this.welcomeConfig.language || this.systemConfigOwn?.common?.language || 'en',
            logoPng: this.logoPng ? `data:${this.logoPng.mimeType};base64,${this.logoPng.file.toString('base64')}` : '',
            pages,
        };
        return _indexHtml.replace(REPLACEMENT_PATTERN, () => `window.IOBROKER_PAGES=${JSON.stringify(IOBROKER_PAGES)};`);
    }
    async #onReady() {
        this.welcomeConfig = this.config;
        if (this.subscribeForeignFiles) {
            await this.subscribeForeignFiles(this.namespace, 'logo.png');
        }
        this.systemConfigOwn = await this.getForeignObjectAsync('system.config');
        // If in system.config the vendor information is present, try to use logo from there
        const icon = this.systemConfigOwn?.native?.vendor?.logo || this.systemConfigOwn?.native?.vendor?.icon;
        if (icon) {
            // icon is `data:image/svg+xml;base64,...`. Split it into file and mimeType
            this.vendorLogo = {
                file: Buffer.from(icon.split(',')[1], 'base64'),
                mimeType: icon.substring(5, icon.indexOf(';base64')),
            };
            this.logoPng = this.vendorLogo;
        }
        if (this.systemConfigOwn?.native?.vendor?.icon) {
            this.favicon = this.systemConfigOwn.native.vendor.icon;
        }
        // Keep the page up to date if instances are added, removed or reconfigured
        await this.subscribeForeignObjectsAsync('system.adapter.*');
        this.indexHtml = await this.renderIndexHtml();
        this.initWebServer(this.welcomeConfig)
            .then(returnedServer => (this.webServer = returnedServer))
            .catch(err => {
            this.log.error(`Failed to initWebServer: ${err}`);
            this.terminate
                ? this.terminate(adapter_core_1.EXIT_CODES.ADAPTER_REQUESTED_TERMINATION)
                : process.exit(adapter_core_1.EXIT_CODES.ADAPTER_REQUESTED_TERMINATION);
        });
    }
    /** Check if the page behind the URL answers */
    async #isAlive(url) {
        try {
            // A page that requires authentication answers with 401/403 and is alive too,
            // so every status code must be accepted and evaluated here
            const options = { timeout: 1000, validateStatus: () => true };
            const response = url.startsWith('https://')
                ? await this.httpsAxios.get(url, options)
                : await axios_1.default.get(url, options);
            this.log.debug(`Checking ${url}: ${response.status}`);
            return response.status === 200 || response.status === 403 || response.status === 401;
        }
        catch (e) {
            this.log.debug(`Checking ${url}: ${e.toString()}`);
            return false;
        }
    }
    async renderAliveJson() {
        // Icons are not required here and reading them is expensive
        const { pages } = await this.getPages(false);
        this.log.debug(`Checking ${pages.length} pages`);
        return Promise.all(pages.map(page => this.#isAlive(page.url)));
    }
    //settings: {
    //    "port":   8080,
    //    "auth":   false,
    //    "secure": false,
    //    "bind":   "0.0.0.0", // "::"
    //    "cache":  false
    //}
    async initWebServer(settings) {
        const server = {
            app: null,
            server: null,
            settings,
        };
        settings.defaultUser = settings.defaultUser || 'system.user.admin';
        if (!settings.defaultUser.startsWith('system.user.')) {
            settings.defaultUser = `system.user.${settings.defaultUser}`;
        }
        if (settings.port) {
            server.app = (0, express_1.default)();
            server.app.disable('x-powered-by');
            server.app.use(async (req, res, next) => {
                const url = req.url.split('?')[0];
                if (!url || url === '/' || url === '/index.html') {
                    // index.html contains the rendered instance list, so it may not be cached by default
                    const maxAge = parseInt(this.welcomeConfig.staticAssetCacheMaxAge, 10) || 0;
                    res.set('Cache-Control', `public, max-age=${maxAge}`);
                    res.send(this.indexHtml);
                }
                else if (url === '/alive.json' || url === 'alive.json') {
                    res.json(await this.renderAliveJson());
                }
                else if (url === '/favicon.ico' && this.favicon?.startsWith('data:')) {
                    // data:<mime-type>;base64,<data>
                    const mimeType = this.favicon.substring(5, this.favicon.indexOf(';base64'));
                    const data = this.favicon.split(',')[1];
                    res.set('Content-Type', mimeType);
                    res.send(Buffer.from(data, 'base64'));
                }
                else {
                    next();
                }
            });
            server.app.use(express_1.default.static(`${__dirname}/../public`));
            try {
                const webserver = new IoBWebServer.WebServer({
                    app: server.app,
                    adapter: this,
                    secure: settings.secure,
                    // The welcome adapter usually owns port 80, so the acme adapter cannot bind it
                    // itself: answer the HTTP-01 challenges here unless the user turned that off
                    acmeChallenge: settings.acmeChallenge !== false,
                });
                server.server = await webserver.init();
            }
            catch (err) {
                this.log.error(`Cannot create web-server: ${err}`);
                this.terminate
                    ? this.terminate(adapter_core_1.EXIT_CODES.ADAPTER_REQUESTED_TERMINATION)
                    : process.exit(adapter_core_1.EXIT_CODES.ADAPTER_REQUESTED_TERMINATION);
                return null;
            }
            if (!server.server) {
                this.log.error(`Cannot create web-server`);
                this.terminate
                    ? this.terminate(adapter_core_1.EXIT_CODES.ADAPTER_REQUESTED_TERMINATION)
                    : process.exit(adapter_core_1.EXIT_CODES.ADAPTER_REQUESTED_TERMINATION);
                return null;
            }
            server.server.__server = server;
        }
        else {
            this.log.error('port missing');
            this.terminate
                ? this.terminate(adapter_core_1.EXIT_CODES.ADAPTER_REQUESTED_TERMINATION)
                : process.exit(adapter_core_1.EXIT_CODES.ADAPTER_REQUESTED_TERMINATION);
        }
        if (server.server) {
            let serverListening = false;
            let serverPort;
            server.server.on('error', e => {
                if (e.toString().includes('EACCES') && serverPort <= 1024) {
                    this.log.error(`node.js process has no rights to start server on the port ${serverPort}.\n` +
                        `Do you know that on linux you need special permissions for ports under 1024?\n` +
                        `You can call in shell following scrip to allow it for node.js: "iobroker fix"`);
                }
                else {
                    this.log.error(`Cannot start server on ${settings.bind || '0.0.0.0'}:${serverPort}: ${e}`);
                }
                if (!serverListening) {
                    this.terminate
                        ? this.terminate(adapter_core_1.EXIT_CODES.ADAPTER_REQUESTED_TERMINATION)
                        : process.exit(adapter_core_1.EXIT_CODES.ADAPTER_REQUESTED_TERMINATION);
                }
            });
            settings.port = parseInt(settings.port, 10) || 8082;
            serverPort = settings.port;
            this.getPort(settings.port, !settings.bind || settings.bind === '0.0.0.0' ? undefined : settings.bind || undefined, port => {
                if (port !== parseInt(settings.port)) {
                    this.log.error(`port ${settings.port} already in use`);
                    // retry every 10 seconds to open the welcome screen on port 80
                    if (this.startTimeout) {
                        clearTimeout(this.startTimeout);
                    }
                    this.startTimeout = setTimeout(() => {
                        this.startTimeout = null;
                        // The result must be stored, otherwise the server cannot be closed on unload
                        this.initWebServer(settings)
                            .then(returnedServer => (this.webServer = returnedServer))
                            .catch(e => this.log.error(`Failed to initWebServer: ${e}`));
                    }, (parseInt(this.welcomeConfig.retryInterval, 10) || 10) * 1000);
                    return;
                }
                serverPort = port;
                server.server?.listen(port, !settings.bind || settings.bind === '0.0.0.0' ? undefined : settings.bind || undefined, () => {
                    serverListening = true;
                    void this.setStateAsync('info.connection', true, true);
                });
                this.log.info(`http${settings.secure ? 's' : ''} server listening on port ${port}`);
            });
        }
        if (server.server) {
            return server;
        }
        return null;
    }
}
exports.WelcomeAdapter = WelcomeAdapter;
if (require.main !== module) {
    // Export the constructor in compact mode
    module.exports = (options) => new WelcomeAdapter(options);
}
else {
    // otherwise start the instance directly
    (() => new WelcomeAdapter())();
}
//# sourceMappingURL=main.js.map