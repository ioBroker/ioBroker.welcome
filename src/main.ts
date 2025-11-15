import express, { type Express } from 'express';
import { existsSync, readFileSync } from 'node:fs';
import axios, { type AxiosInstance, type AxiosResponse } from 'axios';
import { Adapter, type AdapterOptions, EXIT_CODES } from '@iobroker/adapter-core'; // Get common adapter utils
import * as IoBWebServer from '@iobroker/webserver';
import type { Server } from 'node:http';
import { Agent } from 'node:https';

const SUPPORTED_ADAPTERS = ['admin', 'web'];

interface WelcomeConfig {
    allInstances?: boolean;
    specificInstances?: string[];
    redirect: string;
    port: number | string;
    auth: boolean;
    secure: boolean;
    bind: string;
    language?: ioBroker.Languages;
    defaultUser: string;
    welcomePhrase: string;
    backgroundColor: string;
    backgroundToolbarColor: string;
    retryInterval: number;
    customLinks?: { icon: string; name: string; desc: string; link: string; blank: boolean; enabled: boolean }[];
    redirectToLink: boolean;
    redirectUrl: string;
    // Optional parameters
    staticAssetCacheMaxAge: number;
}

export class WelcomeAdapter extends Adapter {
    private startTimeout: NodeJS.Timeout | null = null;
    private webServer: null | {
        settings: WelcomeConfig;
        app: null | Express;
        server: null | (Server & { __server: { app: null | Express; server: null | Server } });
    } = null;
    private logoPng: { file: string | Buffer; mimeType?: string } | null = null;
    private indexHtml = '';
    private favicon = '';
    private systemConfigOwn: ioBroker.SystemConfigObject | null | undefined = null;
    private welcomeConfig: WelcomeConfig;
    private readonly httpsAxios: AxiosInstance;

    public constructor(options: Partial<AdapterOptions> = {}) {
        super({
            ...options,
            name: 'welcome',
        });
        this.on('ready', () => this.#onReady());
        this.on('fileChange', (id, fileName) => this.#onFileChange(id, fileName));
        this.on('unload', callback => this.#onUnload(callback));
        this.welcomeConfig = this.config as WelcomeConfig;
        this.httpsAxios = axios.create({
            httpsAgent: new Agent({
                rejectUnauthorized: false,
            }),
        });
    }

    async #onFileChange(_id: string, fileName: string): Promise<void> {
        if (fileName === 'logo.png') {
            this.indexHtml = await this.renderIndexHtml();
        }
    }

    #onUnload(callback: () => void): void {
        if (this.startTimeout) {
            clearTimeout(this.startTimeout);
            this.startTimeout = null;
        }
        try {
            this.webServer?.settings &&
                this.log?.debug(
                    `terminating http${this.webServer.settings.secure ? 's' : ''} server on port ${this.webServer.settings.port}`,
                );
            this.webServer?.server?.close();
        } catch {
            // ignore
        }
        callback();
    }

    async getPages(): Promise<{
        pages: { icon?: string; instance: string; title?: ioBroker.StringOrTranslated; url: string; blank?: boolean }[];
        redirect: string;
    }> {
        let redirect = '';

        if (this.welcomeConfig.redirectToLink) {
            return { pages: [], redirect: this.welcomeConfig.redirectUrl };
        }

        const instances = await this.getObjectViewAsync('system', 'instance', {});
        const mapInstance: Record<string, ioBroker.InstanceObject> = {};
        for (let r = 0; r < instances.rows.length; r++) {
            mapInstance[instances.rows[r].id] = instances.rows[r].value;
        }
        const pages: {
            icon?: string;
            instance: string;
            title?: ioBroker.StringOrTranslated;
            url: string;
            blank?: boolean;
        }[] = [];
        for (const id in mapInstance) {
            const instance = mapInstance[id];
            const url = `http${instance.native.secure ? 's' : ''}://${instance.native.bind === '0.0.0.0' ? 'localhost' : instance.native.bind}:${instance.native.port}/`;
            if (id.substring('system.adapter.'.length) === this.welcomeConfig.redirect) {
                redirect = url;
            }

            if (
                this.welcomeConfig.allInstances === false &&
                !this.welcomeConfig.specificInstances?.includes(id.substring('system.adapter.'.length))
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
            const iconFile = instance.common.icon
                ? await this.readFileAsync(`${instance.common.name}.admin`, instance.common.icon)
                : null;
            let icon: string | undefined;
            if (iconFile && instance.common.icon?.endsWith('.jpg')) {
                icon = `data:image/jpg;base64,${iconFile.file.toString('base64')}`;
            } else if (iconFile && instance.common.icon?.endsWith('.png')) {
                icon = `data:image/png;base64,${iconFile.file.toString('base64')}`;
            } else if (iconFile && iconFile.file instanceof Buffer) {
                icon = `data:${iconFile.mimeType};base64,${iconFile.file.toString('base64')}`;
            } else if (iconFile) {
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

    async renderIndexHtml(): Promise<string> {
        // try to read logo
        try {
            this.logoPng ||= await this.readFileAsync(this.namespace, 'logo.png');
        } catch {
            this.logoPng = null;
        }

        const _indexHtml = existsSync(`${__dirname}/../src-www/build/index.html`)
            ? readFileSync(`${__dirname}/../src-www/build/index.html`).toString()
            : readFileSync(`${__dirname}/public/index.html`).toString();

        const { pages, redirect } = await this.getPages();

        if (redirect) {
            return _indexHtml.replace(
                'window.REPLACEMENT_TEXT="REPLACEMENT_TEXT"',
                `window.location="${redirect}".replace('localhost', window.location.hostname);`,
            );
        }

        const IOBROKER_PAGES = {
            welcomePhrase: this.welcomeConfig.welcomePhrase,
            backgroundColor: this.welcomeConfig.backgroundColor,
            backgroundToolbarColor: this.welcomeConfig.backgroundToolbarColor,
            language: this.welcomeConfig.language || this.systemConfigOwn?.common?.language || 'en',
            logoPng: this.logoPng ? `data:${this.logoPng.mimeType};base64,${this.logoPng.file.toString('base64')}` : '',
            pages,
        };

        return _indexHtml.replace(
            "window.REPLACEMENT_TEXT = 'REPLACEMENT_TEXT'",
            `window.IOBROKER_PAGES=${JSON.stringify(IOBROKER_PAGES)};`,
        );
    }

    async #onReady(): Promise<void> {
        this.welcomeConfig = this.config as WelcomeConfig;
        if (this.subscribeForeignFiles) {
            await this.subscribeForeignFiles(this.namespace, 'logo.png');
        }
        this.systemConfigOwn = await this.getForeignObjectAsync('system.config');

        // If in system.config the vendor information is present, try to use logo from there
        const icon: string | undefined =
            this.systemConfigOwn?.native?.vendor?.logo || this.systemConfigOwn?.native?.vendor?.icon;
        if (icon) {
            // icon is `data:image/svg+xml;base64,...`. Split it into file and mimeType
            this.logoPng = {
                file: Buffer.from(icon.split(',')[1], 'base64'),
                mimeType: icon.substring(5, icon.indexOf(';base64')),
            };
        }
        if (this.systemConfigOwn?.native?.vendor?.icon) {
            this.favicon = this.systemConfigOwn.native.vendor.icon;
        }

        this.indexHtml = await this.renderIndexHtml();

        this.initWebServer(this.welcomeConfig)
            .then(returnedServer => (this.webServer = returnedServer))
            .catch(err => {
                this.log.error(`Failed to initWebServer: ${err}`);
                this.terminate
                    ? this.terminate(EXIT_CODES.ADAPTER_REQUESTED_TERMINATION)
                    : process.exit(EXIT_CODES.ADAPTER_REQUESTED_TERMINATION);
            });
    }

    async renderAliveJson(): Promise<boolean[]> {
        const { pages } = await this.getPages();
        const alive: boolean[] = [];
        this.log.debug(`Checking pages`);

        for (let p = 0; p < pages.length; p++) {
            try {
                let response: AxiosResponse<any, any>;
                if (pages[p].url.startsWith('https://')) {
                    response = await this.httpsAxios.get(pages[p].url, { timeout: 1000 });
                } else {
                    response = await axios.get(pages[p].url, { timeout: 1000 });
                }
                this.log.debug(`Checking ${pages[p].url}: ${response.status}`);
                alive[p] = response.status === 200 || response.status === 403 || response.status === 401;
            } catch (e) {
                this.log.debug(`Checking ${pages[p].url}: ${e.toString()}`);
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
    async initWebServer(settings: WelcomeConfig): Promise<{
        settings: WelcomeConfig;
        app: null | Express;
        server: null | (Server & { __server: { app: null | Express; server: null | Server } });
    } | null> {
        const server: {
            settings: WelcomeConfig;
            app: null | Express;
            server: null | (Server & { __server: { app: null | Express; server: null | Server } });
        } = {
            app: null,
            server: null,
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
                    res.set('Cache-Control', `public, max-age=${this.welcomeConfig.staticAssetCacheMaxAge}`);
                    res.send(this.indexHtml);
                } else if (url === '/alive.json' || url === 'alive.json') {
                    res.json(await this.renderAliveJson());
                } else if (url === '/favicon.ico' && this.favicon?.startsWith('data:')) {
                    // data:<mime-type>;base64,<data>
                    const mimeType = this.favicon.substring(5, this.favicon.indexOf(';base64'));
                    const data = this.favicon.split(',')[1];
                    res.set('Content-Type', mimeType);
                    res.send(Buffer.from(data, 'base64'));
                } else {
                    next();
                }
            });

            server.app.use(express.static(`${__dirname}/public`));

            try {
                const webserver: any = new IoBWebServer.WebServer({
                    app: server.app,
                    adapter: this as unknown as ioBroker.Adapter,
                    secure: settings.secure,
                });
                server.server = await webserver.init();
            } catch (err) {
                this.log.error(`Cannot create web-server: ${err}`);
                this.terminate
                    ? this.terminate(EXIT_CODES.ADAPTER_REQUESTED_TERMINATION)
                    : process.exit(EXIT_CODES.ADAPTER_REQUESTED_TERMINATION);
                return null;
            }
            if (!server.server) {
                this.log.error(`Cannot create web-server`);
                this.terminate
                    ? this.terminate(EXIT_CODES.ADAPTER_REQUESTED_TERMINATION)
                    : process.exit(EXIT_CODES.ADAPTER_REQUESTED_TERMINATION);
                return null;
            }

            server.server.__server = server;
        } else {
            this.log.error('port missing');
            this.terminate
                ? this.terminate(EXIT_CODES.ADAPTER_REQUESTED_TERMINATION)
                : process.exit(EXIT_CODES.ADAPTER_REQUESTED_TERMINATION);
        }

        if (server.server) {
            let serverListening = false;
            let serverPort: number;
            server.server.on('error', e => {
                if (e.toString().includes('EACCES') && serverPort <= 1024) {
                    this.log.error(
                        `node.js process has no rights to start server on the port ${serverPort}.\n` +
                            `Do you know that on linux you need special permissions for ports under 1024?\n` +
                            `You can call in shell following scrip to allow it for node.js: "iobroker fix"`,
                    );
                } else {
                    this.log.error(`Cannot start server on ${settings.bind || '0.0.0.0'}:${serverPort}: ${e}`);
                }
                if (!serverListening) {
                    this.terminate
                        ? this.terminate(EXIT_CODES.ADAPTER_REQUESTED_TERMINATION)
                        : process.exit(EXIT_CODES.ADAPTER_REQUESTED_TERMINATION);
                }
            });

            settings.port = parseInt(settings.port as string, 10) || 8082;
            serverPort = settings.port;

            this.getPort(
                settings.port,
                !settings.bind || settings.bind === '0.0.0.0' ? undefined : settings.bind || undefined,
                port => {
                    if (port !== parseInt(settings.port as string)) {
                        this.log.error(`port ${settings.port} already in use`);
                        // retry every 10 seconds to open the welcome screen on port 80
                        if (this.startTimeout) {
                            clearTimeout(this.startTimeout);
                        }
                        this.startTimeout = setTimeout(
                            () => {
                                this.startTimeout = null;
                                this.initWebServer(settings);
                            },
                            (parseInt(this.welcomeConfig.retryInterval as unknown as string, 10) || 10) * 1000,
                        );
                        return;
                    }
                    serverPort = port;
                    server.server?.listen(
                        port,
                        !settings.bind || settings.bind === '0.0.0.0' ? undefined : settings.bind || undefined,
                        () => {
                            serverListening = true;
                            this.setState('info.connection', true, true);
                        },
                    );

                    this.log.info(`http${settings.secure ? 's' : ''} server listening on port ${port}`);
                },
            );
        }

        if (server.server) {
            return server;
        }
        return null;
    }
}

if (require.main !== module) {
    // Export the constructor in compact mode
    module.exports = (options: Partial<AdapterOptions> | undefined) => new WelcomeAdapter(options);
} else {
    // otherwise start the instance directly
    (() => new WelcomeAdapter())();
}
