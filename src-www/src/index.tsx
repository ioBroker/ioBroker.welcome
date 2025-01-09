import React from 'react';
import { createRoot } from 'react-dom/client';
import pack from '../package.json';
import App from './App';
import './index.css';
import * as serviceWorker from './serviceWorker';

declare global {
    interface Window {
        sentryDSN: string;
        adapterName: string | undefined;
        IOBROKER_PAGES: {
            language?: ioBroker.Languages;
            backgroundToolbarColor?: string;
            logoPng?: string;
            welcomePhrase?: string;
            backgroundColor?: string;
            pages: { url: string; instance: string; icon: string; title: string }[];
        };
    }
}

window.adapterName = 'welcome';
window.sentryDSN = 'https://c9c27734f2f1491fafb2cbc7195f1701@sentry.iobroker.net/244';

console.log(`iobroker.${window.adapterName}@${pack.version}`);

const container = window.document.getElementById('root');

if (container) {
    const root = createRoot(container);
    root.render(<App adapterVersion={pack.version} />);
}

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: http://bit.ly/CRA-PWA
serviceWorker.unregister();
