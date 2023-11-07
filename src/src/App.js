import React from 'react';
import * as PropTypes from 'prop-types';
import { withStyles } from '@mui/styles';
import { ThemeProvider, StyledEngineProvider } from '@mui/material/styles';
import * as Sentry from '@sentry/browser';
import * as SentryIntegrations from '@sentry/integrations';

import {
    AppBar, Avatar,
    Button,
    Card, CardActions,
    CardContent, CardMedia,
    Toolbar, Typography,
} from '@mui/material';

import {
    I18n,
    Theme,
    Utils,
    ToggleThemeMenu,
} from '@iobroker/adapter-react-v5';

import logo from './assets/logo.png';

const styles = theme => ({
    page: {
        overflow: 'auto',
        width: '100%',
        height: 'calc(100% - 48px)',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: theme.spacing(2),
        alignSelf: 'center',
        padding: theme.spacing(3),
    },
    card: {
        width: 300,
        height: 295,
    },
});

Typography.propTypes = {
    color: PropTypes.string,
    variant: PropTypes.string,
    children: PropTypes.node,
};

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
        I18n.setLanguage(window.IOBROKER_PAGES.language || (window.navigator.userLanguage || window.navigator.language).substring(0, 2));
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
            themeName: Utils.getThemeName(),
            theme,
            alive: [],
        };

        document.body.style.backgroundColor = theme.palette.mode === 'dark' ? '#111' : '#fafafa';
        document.body.style.color = theme.palette.mode === 'dark' ? '#EEE' : '#111';
    }

    componentDidMount() {
        this.checkAllLinksIfTheyAlive()
            .catch(e => console.error(`Cannot check all links: ${e}`));
    }

    async checkAllLinksIfTheyAlive() {
        try {
            const response = await fetch(`./alive.json?t=${Date.now()}`);
            const alive = await response.json();
            this.setState({ alive });
        } catch (e) {
            console.error(`Cannot check all links: ${e}`);
        }
    }

    static getText(text) {
        if (!text) {
            return '';
        }
        if (typeof text === 'object') {
            return text[window.IOBROKER_PAGES.language || I18n.getLanguage()] || text.en;
        }

        return text;
    }

    static openLink = (page, inNewPage) => {
        const url = page.url.replace('localhost', window.location.hostname);
        if (!inNewPage) {
            window.location = url;
        } else {
            window.open(url, page.instance);
        }
    };

    renderCard(page, index) {
        if (page.url.includes('127.0.0.1') || page.url.includes('::1')) {
            if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' && !window.location.hostname.includes('::1')) {
                return null;
            }
        }

        return <Card
            key={page.instance}
            className={this.props.classes.card}
            style={this.state.alive[index] === false ? { opacity: 0.3 } : { opacity: 1 }}
        >
            <CardMedia
                sx={{
                    height: 140,
                    backgroundSize: 'contain',
                    marginTop: '10px',
                    cursor: 'pointer',
                }}
                onClick={() => App.openLink(page)}
                image={page.icon || logo}
                title={page.instance}
            />
            <CardContent
                onClick={() => App.openLink(page)}
                sx={{ cursor: 'pointer' }}
            >
                <Typography gutterBottom variant="h5" component="div" style={{ minHeight: 32 }}>
                    {page.instance || '&nbsp;'}
                </Typography>
                <Typography variant="body2" color="text.secondary" style={{ minHeight: 20 }}>
                    {App.getText(page.title)}
                </Typography>
            </CardContent>
            <CardActions sx={{ justifyContent: 'space-between' }}>
                <Button
                    size="small"
                    onClick={() => App.openLink(page)}
                >
                    {I18n.t('Open')}
                </Button>
                <Button
                    size="small"
                    onClick={() => App.openLink(page, true)}
                >
                    {I18n.t('Open in new tab')}
                </Button>
            </CardActions>
        </Card>;
    }

    toggleTheme(newThemeName) {
        const themeName = this.state.themeName;

        // dark => blue => colored => light => dark
        newThemeName = newThemeName || (themeName === 'dark' ? 'blue' :
            (themeName === 'blue' ? 'colored' :
                (themeName === 'colored' ? 'light' : 'dark')));

        if (newThemeName !== themeName) {
            Utils.setThemeName(newThemeName);

            const theme = Theme(newThemeName);

            this.setState({
                theme,
                themeName: Utils.getThemeName(theme),
                // themeType: this.getThemeType(theme),
            }, () => {
                this.props.onThemeChange && this.props.onThemeChange(newThemeName);
            });
        }
    }

    render() {
        const {
            theme,
        } = this.state;

        return <StyledEngineProvider injectFirst>
            <ThemeProvider theme={this.state.theme}>
                <AppBar position="static">
                    <Toolbar
                        variant="dense"
                        sx={{
                            backgroundColor: window.IOBROKER_PAGES.backgroundToolbarColor || theme.palette.primary.main,
                            color: Utils.invertColor(window.IOBROKER_PAGES.backgroundToolbarColor || theme.palette.primary.main, true),
                        }}
                    >
                        <Avatar alt="ioBroker" src={logo} sx={{ width: 32, height: 32, marginRight: 1 }} />
                        {window.IOBROKER_PAGES.welcomePhrase || I18n.t('ioBroker Welcome page')}
                        <div style={{ flexGrow: 1 }} />
                        <ToggleThemeMenu
                            t={I18n.t}
                            toggleTheme={() => this.toggleTheme()}
                            themeName={this.state.themeName}
                        />
                    </Toolbar>
                </AppBar>
                <div
                    className={this.props.classes.page}
                    style={{
                        backgroundColor: window.IOBROKER_PAGES.backgroundColor || undefined,
                        color: Utils.invertColor(window.IOBROKER_PAGES.backgroundColor || theme.palette.primary.main, true),
                    }}
                >
                    {window.IOBROKER_PAGES.pages.map((page, index) => this.renderCard(page, index))}
                </div>
            </ThemeProvider>
        </StyledEngineProvider>;
    }
}

export default withStyles(styles)(App);
