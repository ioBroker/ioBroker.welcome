import React from 'react';
import { ThemeProvider, StyledEngineProvider } from '@mui/material/styles';
import * as Sentry from '@sentry/browser';

import { AppBar, Avatar, Button, Card, CardActions, CardContent, CardMedia, Toolbar, Typography } from '@mui/material';

import { I18n, Theme, Utils, ToggleThemeMenu, Icon, type IobTheme } from '@iobroker/adapter-react-v5';

import logo from './assets/logo.svg';

import enLang from './i18n/en.json';
import deLang from './i18n/de.json';
import ruLang from './i18n/ru.json';
import ptLang from './i18n/pt.json';
import nlLang from './i18n/nl.json';
import frLang from './i18n/fr.json';
import itLang from './i18n/it.json';
import esLang from './i18n/es.json';
import plLang from './i18n/pl.json';
import ukLang from './i18n/uk.json';
import zhLang from './i18n/zh-cn.json';

const styles: Record<'page' | 'card' | 'logo', React.CSSProperties> = {
    page: {
        overflow: 'auto',
        width: '100%',
        height: 'calc(100% - 48px)',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 16,
        alignSelf: 'center',
        padding: 24,
    },
    card: {
        width: 300,
        height: 295,
    },
    logo: {
        width: 'auto',
        height: 32,
        marginRight: 10,
    },
};

interface AppProps {
    adapterVersion: string;
}

interface AppState {
    themeName: 'dark' | 'light';
    theme: IobTheme;
    alive: (boolean | undefined)[];
}

export default class App extends React.Component<AppProps, AppState> {
    constructor(props: AppProps) {
        super(props);
        const translations = {
            en: enLang,
            de: deLang,
            ru: ruLang,
            pt: ptLang,
            nl: nlLang,
            fr: frLang,
            it: itLang,
            es: esLang,
            pl: plLang,
            uk: ukLang,
            'zh-cn': zhLang,
        };

        I18n.setTranslations(translations);
        I18n.setLanguage(
            window.IOBROKER_PAGES.language ||
                // @ts-expect-error userLanguage is deprecated
                (window.navigator.userLanguage || window.navigator.language).substring(0, 2),
        );

        // activate sentry plugin
        if (window.sentryDSN) {
            Sentry.init({
                dsn: window.sentryDSN,
                release: `iobroker.welcome@${props.adapterVersion}`,
                integrations: [Sentry.dedupeIntegration()],
            });
        }

        const theme = Theme(Utils.getThemeName());

        this.state = {
            themeName: Utils.getThemeName() as 'dark' | 'light',
            theme,
            alive: [],
        };

        document.body.style.backgroundColor = theme.palette.mode === 'dark' ? '#111' : '#fafafa';
        document.body.style.color = theme.palette.mode === 'dark' ? '#EEE' : '#111';
    }

    componentDidMount(): void {
        this.checkAllLinksIfTheyAlive().catch(e => console.error(`Cannot check all links: ${e}`));
    }

    async checkAllLinksIfTheyAlive(): Promise<void> {
        try {
            const response = await fetch(`./alive.json?t=${Date.now()}`);
            const alive = await response.json();
            this.setState({ alive });
        } catch (e) {
            console.error(`Cannot check all links: ${e}`);
        }
    }

    static getText(text: ioBroker.StringOrTranslated): string {
        if (!text) {
            return '';
        }
        if (typeof text === 'object') {
            return text[window.IOBROKER_PAGES.language || I18n.getLanguage()] || text.en;
        }

        return text;
    }

    static openLink = (page: { url: string; instance: string }, inNewPage?: boolean): void => {
        const url = page.url.replace('localhost', window.location.hostname);
        if (!inNewPage) {
            window.location.href = url;
        } else {
            window.open(url, page.instance);
        }
    };

    renderCard(
        page: { url: string; instance: string; icon: string; title: string },
        index: number,
    ): React.JSX.Element | null {
        if (page.url.includes('127.0.0.1') || page.url.includes('::1')) {
            if (
                window.location.hostname !== 'localhost' &&
                window.location.hostname !== '127.0.0.1' &&
                !window.location.hostname.includes('::1')
            ) {
                return null;
            }
        }

        return (
            <Card
                key={page.instance}
                style={{ ...styles.card, opacity: this.state.alive[index] === false ? 0.3 : 1 }}
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
                    <Typography
                        gutterBottom
                        variant="h5"
                        component="div"
                        style={{ minHeight: 32 }}
                    >
                        {page.instance || '&nbsp;'}
                    </Typography>
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        style={{ minHeight: 20 }}
                    >
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
            </Card>
        );
    }

    toggleTheme(newThemeName?: 'dark' | 'light'): void {
        const themeName = this.state.themeName;

        // dark => light => dark
        newThemeName = newThemeName || (themeName === 'dark' ? 'light' : 'dark');

        if (newThemeName !== themeName) {
            Utils.setThemeName(newThemeName);

            const theme = Theme(newThemeName);

            this.setState({
                theme,
                themeName: newThemeName,
            });
        }
    }

    render(): React.JSX.Element {
        const { theme } = this.state;

        return (
            <StyledEngineProvider injectFirst>
                <ThemeProvider theme={this.state.theme}>
                    <AppBar position="static">
                        <Toolbar
                            variant="dense"
                            sx={{
                                backgroundColor:
                                    window.IOBROKER_PAGES.backgroundToolbarColor || theme.palette.primary.main,
                                color: Utils.invertColor(
                                    window.IOBROKER_PAGES.backgroundToolbarColor || theme.palette.primary.main,
                                    true,
                                ),
                            }}
                        >
                            {window.IOBROKER_PAGES.logoPng ? (
                                <Icon
                                    alt="ioBroker"
                                    src={window.IOBROKER_PAGES.logoPng || logo}
                                    style={styles.logo}
                                />
                            ) : (
                                <Avatar
                                    alt="ioBroker"
                                    src={logo}
                                    style={styles.logo}
                                />
                            )}
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
                        style={{
                            ...styles.page,
                            backgroundColor: window.IOBROKER_PAGES.backgroundColor || undefined,
                            color: Utils.invertColor(
                                window.IOBROKER_PAGES.backgroundColor || theme.palette.primary.main,
                                true,
                            ),
                        }}
                    >
                        {window.IOBROKER_PAGES.pages.map((page, index) => this.renderCard(page, index))}
                    </div>
                </ThemeProvider>
            </StyledEngineProvider>
        );
    }
}
