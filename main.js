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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
const SUPPORTED_ADAPTERS = ['admin', 'web'];
class WelcomeAdapter extends adapter_core_1.Adapter {
    startTimeout = null;
    webServer = null;
    logoPng = null;
    indexHtml = '';
    welcomeConfig;
    constructor(options = {}) {
        super({
            ...options,
            name: 'welcome',
        });
        this.on('ready', () => this.#onReady());
        this.on('fileChange', (id, fileName) => this.#onFileChange(id, fileName));
        this.on('unload', callback => this.#onUnload(callback));
        this.welcomeConfig = this.config;
    }
    async #onFileChange(_id, fileName) {
        if (fileName === 'logo.png') {
            this.indexHtml = await this.renderIndexHtml();
        }
    }
    #onUnload(callback) {
        if (this.startTimeout) {
            clearTimeout(this.startTimeout);
            this.startTimeout = null;
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
    async getPages() {
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
            const url = `http${instance.native.secure ? 's' : ''}://${instance.native.bind === '0.0.0.0' ? 'localhost' : instance.native.bind}:${instance.native.port}/`;
            if (id.substring('system.adapter.'.length) === this.welcomeConfig.redirect) {
                redirect = url;
            }
            if (this.welcomeConfig.allInstances === false &&
                !this.welcomeConfig.specificInstances?.includes(id.substring('system.adapter.'.length))) {
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
            let iconFile = instance.common.icon ? await this.readFileAsync(`${instance.common.name}.admin`, instance.common.icon) : null;
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
        if (this.welcomeConfig.customLinks) {
            this.welcomeConfig.customLinks.map(item => {
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
    async renderIndexHtml() {
        // try to read logo
        try {
            this.logoPng = await this.readFileAsync(this.namespace, 'logo.png');
        }
        catch {
            this.logoPng = null;
        }
        const _indexHtml = (0, node_fs_1.existsSync)(`${__dirname}/../src-www/build/index.html`)
            ? (0, node_fs_1.readFileSync)(`${__dirname}/../src-www/build/index.html`).toString()
            : (0, node_fs_1.readFileSync)(`${__dirname}/public/index.html`).toString();
        const systemConfig = await this.getForeignObjectAsync('system.config');
        const { pages, redirect } = await this.getPages();
        if (redirect) {
            return _indexHtml.replace('window.REPLACEMENT_TEXT="REPLACEMENT_TEXT"', `window.location="${redirect}".replace('localhost', window.location.hostname);`);
        }
        const IOBROKER_PAGES = {
            welcomePhrase: this.welcomeConfig.welcomePhrase,
            backgroundColor: this.welcomeConfig.backgroundColor,
            backgroundToolbarColor: this.welcomeConfig.backgroundToolbarColor,
            language: this.welcomeConfig.language || systemConfig?.common?.language || 'en',
            logoPng: this.logoPng ? `data:${this.logoPng.mimeType};base64,${this.logoPng.file.toString('base64')}` : '',
            pages,
        };
        return _indexHtml.replace('window.REPLACEMENT_TEXT="REPLACEMENT_TEXT"', `window.IOBROKER_PAGES=${JSON.stringify(IOBROKER_PAGES)};`);
    }
    async #onReady() {
        this.welcomeConfig = this.config;
        this.subscribeForeignFiles && (await this.subscribeForeignFiles(this.namespace, 'logo.png'));
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
    async renderAliveJson() {
        const { pages } = await this.getPages();
        const alive = [];
        for (let p = 0; p < pages.length; p++) {
            try {
                const response = await axios_1.default.get(pages[p].url, { timeout: 1000 });
                alive[p] = response.status === 200;
            }
            catch {
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
                    res.set('Cache-Control', `public, max-age=${this.welcomeConfig.staticAssetCacheMaxAge}`);
                    res.send(this.indexHtml);
                }
                else if (url === '/alive.json' || url === 'alive.json') {
                    res.json(await this.renderAliveJson());
                }
                else {
                    next();
                }
            });
            server.app.use(express_1.default.static(`${__dirname}/public`));
            try {
                const webserver = new IoBWebServer.WebServer({
                    app: server.app,
                    adapter: this,
                    secure: settings.secure,
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
                        this.initWebServer(settings);
                    }, (parseInt(this.welcomeConfig.retryInterval, 10) || 10) * 1000);
                    return;
                }
                serverPort = port;
                server.server?.listen(port, !settings.bind || settings.bind === '0.0.0.0' ? undefined : settings.bind || undefined, () => {
                    serverListening = true;
                    this.setState('info.connection', true, true);
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