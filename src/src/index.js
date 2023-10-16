import React from 'react';
import { ThemeProvider, StyledEngineProvider } from '@mui/material/styles';
import { createRoot } from 'react-dom/client';
import { StylesProvider, createGenerateClassName } from '@mui/styles';

import { Theme, Utils } from '@iobroker/adapter-react-v5';

import './index.css';
import App from './App';
import * as serviceWorker from './serviceWorker';
import pkg from '../package.json';

window.adapterName = 'welcome';
window.adapterVersion = pkg.version;
window.sentryDSN = 'https://c9c27734f2f1491fafb2cbc7195f1701@sentry.iobroker.net/244';
let themeName = Utils.getThemeName();

console.log(`iobroker.${window.adapterName}@${pkg.version} using theme "${themeName}"`);

const generateClassName = createGenerateClassName({
    productionPrefix: 'web',
});

function build() {
    const container = document.getElementById('root');
    const root = createRoot(container);
    return root.render(
        <StylesProvider generateClassName={generateClassName}>
            <StyledEngineProvider injectFirst>
                <ThemeProvider theme={Theme(themeName)}>
                    <App
                        onThemeChange={_theme => {
                            themeName = _theme;
                            build();
                        }}
                    />
                </ThemeProvider>
            </StyledEngineProvider>
        </StylesProvider>,
    );
}

build();

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: http://bit.ly/CRA-PWA
serviceWorker.unregister();
