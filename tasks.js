const { deleteFoldersRecursive, buildReact, npmInstall, copyFiles } = require('@iobroker/build-tools');
const { existsSync } = require('node:fs');

function adminClean() {
    deleteFoldersRecursive(`${__dirname}/admin/custom`);
    deleteFoldersRecursive(`${__dirname}/src-admin/build`);
}

function adminCopyAllFiles() {
    copyFiles(['src-admin/src/i18n/*.json'], 'admin/custom/i18n');
    copyFiles(['src-admin/build/assets/*.js'], 'admin/custom/assets');
    copyFiles(['src-admin/build/customComponents.js'], 'admin/custom');
    copyFiles(['src-admin/build/customComponents.js.map'], 'admin/custom');
    copyFiles(['src-admin/build/assets/*.map'], 'admin/custom/assets');
}

if (process.argv.includes('--0-admin-clean')) {
    adminClean();
} else if (process.argv.includes('--1-admin-npm')) {
    npmInstall(`${__dirname}/src-admin`).catch(e => console.error(`Cannot install npm: ${e}`));
} else if (process.argv.includes('--2-admin-build')) {
    buildReact(`${__dirname}/src-admin`, { rootDir: __dirname, vite: true })
        .then(() => {
            if (!existsSync(`${__dirname}/src-admin/build/index.html`)) {
                console.error(`Cannot find ${__dirname}/src-admin/build/index.html after build`);
                process.exit(1);
            }
        })
        .catch(e => console.error(`Cannot build: ${e}`));
} else if (process.argv.includes('--3-admin-copy')) {
    adminCopyAllFiles();
} else if (process.argv.includes('--admin')) {
    adminClean();
    npmInstall(`${__dirname}/src-admin`)
        .then(() => buildReact(`${__dirname}/src-admin`, { rootDir: __dirname, vite: true }))
        .then(() => {
            if (!existsSync(`${__dirname}/src-admin/build/index.html`)) {
                console.error(`Cannot find ${__dirname}/src-admin/build/index.html after build`);
                process.exit(1);
            }
        })
        .then(() => adminCopyAllFiles());
} else if (process.argv.includes('--0-clean')) {
    deleteFoldersRecursive('public');
} else if (process.argv.includes('--1-npm')) {
    npmInstall(`${__dirname}/src-www`).catch(e => console.error(`Cannot install npm: ${e}`));
} else if (process.argv.includes('--2-build')) {
    buildReact(`${__dirname}/src`, { rootDir: __dirname, vite: true, tsc: true })
        .then(() => {
            if (!existsSync(`${__dirname}/src-www/build/index.html`)) {
                console.error(`Cannot find ${__dirname}/src-www/build/index.html after build`);
                process.exit(1);
            }
        })
        .catch(e => console.error(`Cannot build: ${e}`));
} else if (process.argv.includes('--3-copy')) {
    copyFiles(
        ['src-www/build/*/**', 'src-www/build/*', '!src/build/static/media/*.svg', '!src-www/build/static/media/*.txt'],
        'public/',
    );
} else if (process.argv.includes('--build-src')) {
    deleteFoldersRecursive('public');
    npmInstall(`${__dirname}/src-www`)
        .then(() => buildReact(`${__dirname}/src-www`, { rootDir: __dirname, vite: true, tsc: true }))
        .then(() => {
            if (!existsSync(`${__dirname}/src-www/build/index.html`)) {
                console.error(`Cannot find ${__dirname}/src-www/build/index.html after build`);
                process.exit(1);
            }
        })
        .then(() =>
            copyFiles(
                [
                    'src-www/build/*/**',
                    'src-www/build/*',
                    '!src-www/build/static/media/*.svg',
                    '!src-www/build/static/media/*.txt',
                ],
                'public/',
            ),
        )
        .catch(e => console.error(`Cannot build: ${e}`));
} else {
    adminClean();
    deleteFoldersRecursive('public');
    npmInstall(`${__dirname}/src-admin`)
        .then(() => buildReact(`${__dirname}/src-admin`, { rootDir: __dirname, vite: true }))
        .then(() => {
            if (!existsSync(`${__dirname}/src-admin/build/index.html`)) {
                console.error(`Cannot find ${__dirname}/src-admin/build/index.html after build`);
                process.exit(1);
            }
        })
        .then(() => adminCopyAllFiles())
        .then(() => npmInstall(`${__dirname}/src-www`))
        .then(() => buildReact(`${__dirname}/src-www`, { rootDir: __dirname, vite: true, tsc: true }))
        .then(() => {
            if (!existsSync(`${__dirname}/src-www/build/index.html`)) {
                console.error(`Cannot find ${__dirname}/src-www/build/index.html after build`);
                process.exit(1);
            }
        })
        .then(() =>
            copyFiles(
                [
                    'src-www/build/*/**',
                    'src-www/build/*',
                    '!src-www/build/static/media/*.svg',
                    '!src-www/build/static/media/*.txt',
                ],
                'public/',
            ),
        );
}
