const { deleteFoldersRecursive, buildReact, npmInstall, copyFiles } = require('@iobroker/build-tools');
const { existsSync } = require('node:fs');

function adminCopyAllFiles() {
    copyFiles(['src-admin/build/static/js/*.js', '!src-admin/build/static/js/vendors*.js'], 'admin/custom/static/js');
    copyFiles(['src-admin/build/static/js/*.map', '!src-admin/build/static/js/vendors*.map'], 'admin/custom/static/js');
    copyFiles(['src-admin/build/static/js/*mui_material_styles*.*'], 'admin/custom/static/js');
    copyFiles(['src-admin/build/static/js/*mui_material_Button_Button*.*'], 'admin/custom/static/js');
    copyFiles(['src-admin/build/static/js/*iobroker_json-config*.*'], 'admin/custom/static/js');
    copyFiles(['src-admin/build/customComponents.js'], 'admin/custom');
    copyFiles(['src-admin/build/customComponents.js.map'], 'admin/custom');
    copyFiles(['src-admin/src/i18n/*.json'], 'admin/custom/i18n');
}

function adminClean() {
    deleteFoldersRecursive(`${__dirname}/admin/custom`);
    deleteFoldersRecursive(`${__dirname}/src-admin/build`);
}

if (process.argv.includes('--0-admin-clean')) {
    adminClean();
} else if (process.argv.includes('--1-admin-npm')) {
    npmInstall(`${__dirname}/src-admin`).catch(e => console.error(`Cannot install npm: ${e}`));
} else if (process.argv.includes('--2-admin-build')) {
    buildReact(`${__dirname}/src-admin`, { rootDir: __dirname, craco: true })
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
        .then(() => buildReact(`${__dirname}/src-admin`, { rootDir: __dirname, craco: true }))
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
    npmInstall(`${__dirname}/src`).catch(e => console.error(`Cannot install npm: ${e}`));
} else if (process.argv.includes('--2-build')) {
    buildReact(`${__dirname}/src`, { rootDir: __dirname })
        .then(() => {
            if (!existsSync(`${__dirname}/src/build/index.html`)) {
                console.error(`Cannot find ${__dirname}/src/build/index.html after build`);
                process.exit(1);
            }
        })
        .catch(e => console.error(`Cannot build: ${e}`));
} else if (process.argv.includes('--3-copy')) {
    copyFiles(
        ['src/build/*/**', 'src/build/*', '!src/build/static/media/*.svg', '!src/build/static/media/*.txt'],
        'public/',
    );
} else if (process.argv.includes('--build-src')) {
    deleteFoldersRecursive('public');
    npmInstall(`${__dirname}/src`)
        .then(() => buildReact(`${__dirname}/src`, { rootDir: __dirname }))
        .then(() => {
            if (!existsSync(`${__dirname}/src/build/index.html`)) {
                console.error(`Cannot find ${__dirname}/src/build/index.html after build`);
                process.exit(1);
            }
        })
        .then(() =>
            copyFiles(
                ['src/build/*/**', 'src/build/*', '!src/build/static/media/*.svg', '!src/build/static/media/*.txt'],
                'public/',
            ),
        )
        .catch(e => console.error(`Cannot build: ${e}`));
} else {
    adminClean();
    deleteFoldersRecursive('public');
    npmInstall(`${__dirname}/src-admin`)
        .then(() => buildReact(`${__dirname}/src-admin`, { rootDir: __dirname, craco: true }))
        .then(() => {
            if (!existsSync(`${__dirname}/src-admin/build/index.html`)) {
                console.error(`Cannot find ${__dirname}/src-admin/build/index.html after build`);
                process.exit(1);
            }
        })
        .then(() => adminCopyAllFiles())
        .then(() => npmInstall(`${__dirname}/src`))
        .then(() => buildReact(`${__dirname}/src`, { rootDir: __dirname }))
        .then(() => {
            if (!existsSync(`${__dirname}/src/build/index.html`)) {
                console.error(`Cannot find ${__dirname}/src/build/index.html after build`);
                process.exit(1);
            }
        })
        .then(() =>
            copyFiles(
                ['src/build/*/**', 'src/build/*', '!src/build/static/media/*.svg', '!src/build/static/media/*.txt'],
                'public/',
            ),
        )
        .catch(e => console.error(`Cannot build: ${e}`));
}
