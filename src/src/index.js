import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import * as serviceWorker from './serviceWorker';
import pkg from '../package.json';

window.adapterName = 'welcome';
window.adapterVersion = pkg.version;
window.sentryDSN = 'https://c9c27734f2f1491fafb2cbc7195f1701@sentry.iobroker.net/244';

console.log(`iobroker.${window.adapterName}@${pkg.version}`);

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: http://bit.ly/CRA-PWA
serviceWorker.unregister();
