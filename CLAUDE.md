# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`iobroker.welcome` is an ioBroker adapter that runs a small web server (default port 80) showing a landing page with
cards for every enabled `admin` and `web` instance, plus user-defined custom links. It can also redirect straight to one
instance or an arbitrary URL instead of showing the page.

The repo contains **three independently built artifacts**:

| Source      | Output                                | What it is                                                                    |
| ----------- | ------------------------------------- | ----------------------------------------------------------------------------- |
| `src/`      | `build/` (via `tsc`)                  | The Node.js adapter (`WelcomeAdapter`), TypeScript, CommonJS                   |
| `src-www/`  | `public/` (via vite + `tasks.js`)     | The React SPA served as the welcome page                                      |
| `src-admin/`| `admin/custom/` (via vite + `tasks.js`)| Module-Federation remote with the custom instance-picker for the admin config |

All three outputs are generated and git-ignored — never hand-edit `build/`, `public/`, `admin/custom/`, or `src-*/build/`.

## Commands

```bash
npm run npm            # install deps in root + src-www + src-admin (plain `npm i` only covers the root)
npm run build          # node tasks -> builds BOTH frontends (src-admin -> admin/custom, src-www -> public)
npm run tsc            # compiles src/main.ts -> build/ (NOT part of `npm run build`)
npm run build-admin    # only the admin component
npm run build-web      # only the www page
npm test               # test:package + test:integration (integration also runs the puppeteer GUI test)
npm run release-patch  # release-script: bumps version, moves README changelog into io-package.json, runs build
```

Frontend dev servers (both need a running ioBroker for real data):

```bash
cd src-www   && npm start   # vite on :3000, proxies /adapter -> localhost:8081
cd src-admin && npm start   # vite on :4173
```

Linting uses `@iobroker/eslint-config` (which also supplies the prettier config): `npx eslint` in the root, or
`npm run lint` inside `src-www` / `src-admin`. Type-check a frontend without emitting: `cd src-www && npm run check-ts`.

`npm run build` runs each step through `tasks.js`; individual steps are exposed as `npm run 0-clean`, `1-npm`,
`2-build`, `3-copy` (www) and `0-admin-clean` … `3-admin-copy` (admin), which is the fastest way to re-run just the
failing part of a build.

### Tests

The layout follows the other ioBroker adapters (`ioBroker.acme`, `ioBroker.hmip`): every suite is addressed
explicitly by an npm script, `.mocharc.json` only preloads `test/mocha.setup.js` (which rethrows unhandled
rejections). Do not reintroduce a `mocha.custom.opts` — that mocha-6 mechanism was removed in mocha 8.

```bash
npm run test:package      # @iobroker/testing packageFiles
npm run test:integration  # @iobroker/testing integration, then test:gui
npm run test:gui          # puppeteer GUI test only
npm test                  # test:package + test:integration
```

`test/testAdapter.gui.test.js` uses `@iobroker/legacy-testing` + puppeteer: it installs a real js-controller and
admin 8 under `tmp/`, opens `#tab-instances/config/system.adapter.welcome.0/_settings` and waits for
`#welcome-custom-component` — the root `div` of `src-admin/src/WelcomeComponent.tsx`. It therefore needs a built
`admin/custom/` (`npm run build-admin`) and takes minutes; screenshots land in `tmp/screenshots/`. Keep that id in
place when touching the component.

## Architecture

### Server-side rendering by string replacement

There is no REST API for the page content. `src/main.ts` renders everything at startup:

1. `getPages()` reads all `system.adapter.*` instance objects, keeps the ones in `SUPPORTED_ADAPTERS`
   (`admin`, `web`) that are enabled and not `onlyWWW`, builds `http(s)://bind:port/` URLs from `instance.native`,
   base64-inlines each adapter icon read from `<name>.admin`, then appends the enabled `customLinks`.
2. `renderIndexHtml()` loads `index.html` and replaces the placeholder script with
   `window.IOBROKER_PAGES = {pages, language, welcomePhrase, colors, logoPng}`.
3. The SPA (`src-www/src/App.tsx`) reads `window.IOBROKER_PAGES` synchronously in its constructor.

**Contract:** `src-www/index.html` must keep the literal line `window.REPLACEMENT_TEXT = 'REPLACEMENT_TEXT'`.
`main.ts` matches that exact string for the pages case and the double-quoted spelling
(`window.REPLACEMENT_TEXT="REPLACEMENT_TEXT"`) for the redirect case — changing quoting/spacing on either side silently
breaks the injection (the page then loads with `window.IOBROKER_PAGES` undefined).

`renderIndexHtml()` prefers `../src-www/build/index.html` over the packaged copy, so a freshly built `src-www` is picked
up without running the copy step.

### Runtime endpoints (`initWebServer`)

Express app behind `@iobroker/webserver` (handles the certificate lookup when `secure` is set):
`/` → the pre-rendered HTML, `/alive.json` → per-page reachability probe, `/favicon.ico` → vendor icon from
`system.config.native.vendor`, everything else → `express.static` from `<__dirname>/public`.

`alive.json` is computed on request: axios GET each page URL with a 1 s timeout (a self-signed-cert-tolerant axios
instance for https); 200/401/403 count as alive. The SPA polls it once on mount and dims dead cards.

Because the adapter usually wants port 80, a busy port is not fatal: it logs and retries every `retryInterval` seconds
via `startTimeout`. The logo comes from the adapter's own `logo.png` file (live-updated via `subscribeForeignFiles` →
`fileChange`) or from `system.config.native.vendor.logo/icon`.

### Admin custom component

`src-admin` is a Module-Federation remote named `ConfigCustomWelcomeSet` (see `src-admin/vite.config.ts`) exposing
`./Components` → `{ WelcomeComponent }`. `WelcomeComponent` extends `ConfigGeneric` from `@iobroker/json-config` and
renders the instance checkbox table, writing `allInstances` / `specificInstances`.

`tasks.js` copies the vite output to `admin/custom/` (`customComponents.js`, `assets/`, `i18n/`), and
`admin/jsonConfig.json` references it as `"url": "custom/customComponents.js"` with
`"name": "ConfigCustomWelcomeSet/Components/WelcomeComponent"`. Renaming the federation name, the exposed key, or the
component means updating `jsonConfig.json` too.

### Adding or changing a setting

A config field lives in three places that must stay in sync:

- `io-package.json` → `native` (default value)
- `admin/jsonConfig.json` → the field definition
- `src/main.ts` → the `WelcomeConfig` interface

Translations are split by consumer: `admin/i18n/` (jsonConfig labels), `src-admin/src/i18n/` (custom component, keys are
prefixed `welcome_`), `src-www/src/i18n/` (the welcome page). All eleven languages exist in each folder.

## Conventions

- Node >= 22 for the adapter package; the frontends are React 19 + MUI 9 + `@iobroker/gui-components` (v10 — the former
  `@iobroker/adapter-react-v5`), built with vite 8.
- New changelog entries go into `README.md` under the `### **WORK IN PROGRESS**` placeholder comment; the release script
  moves them into `io-package.json` `common.news` and must not be hand-edited there.
- The adapter is `compact`-capable: `src/main.ts` exports a factory when required as a module and self-starts otherwise —
  keep that bottom block intact.
