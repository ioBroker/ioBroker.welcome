import React from 'react';
import { withStyles } from '@mui/styles';
import { ThemeProvider, StyledEngineProvider } from '@mui/material/styles';
import * as Sentry from '@sentry/browser';
import * as SentryIntegrations from '@sentry/integrations';

import { AppBar } from '@mui/material';

import {I18n, Theme, Utils} from '@iobroker/adapter-react-v5';

const styles = theme => ({
});

class App extends React.Component {
    constructor(props) {
        super(props);
        const extendedProps = { ...props };
        const translations = {
            en: require('./i18n/en.json'),
            de: require('./i18n/de.json'),
            ru: require('./i18n/ru.json'),
            pt: require('./i18n/pt.json'),
            nl: require('./i18n/nl.json'),
            fr: require('./i18n/fr.json'),
            it: require('./i18n/it.json'),
            es: require('./i18n/es.json'),
            pl: require('./i18n/pl.json'),
            uk: require('./i18n/uk.json'),
            'zh-cn': require('./i18n/zh-cn.json'),
        };

        I18n.setTranslations(translations);
        extendedProps.sentryDSN = window.sentryDSN;

        // activate sentry plugin
        Sentry.init({
            dsn: this.sentryDSN,
            release: `iobroker.welcome@${window.adapterVersion}`,
            integrations: [
                new SentryIntegrations.Dedupe(),
            ],
        });
        const theme = Theme(Utils.getThemeName(''));

        this.state = {
            theme,
            themeType: theme.palette.mode,
        };
    }

    render() {
        const {
            theme,
            themeType,
        } = this.state;

        return <StyledEngineProvider injectFirst>
            <ThemeProvider theme={this.state.theme}>
                <div className="App" style={{ background: theme.palette.background.default, color: theme.palette.text.primary }}>
                    <AppBar position="static">
                        ioBroker
                        {I18n.t('Welcome page')}
                    </AppBar>
                </div>
            </ThemeProvider>
        </StyledEngineProvider>;
    }
}

export default withStyles(styles)(App);
