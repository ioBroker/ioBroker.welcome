const gulp      = require('gulp');
const fs        = require('fs');
const cp        = require('child_process');

function deleteFoldersRecursive(path, exceptions) {
    if (fs.existsSync(path)) {
        const files = fs.readdirSync(path);
        for (const file of files) {
            const curPath = `${path}/${file}`;
            const stat = fs.statSync(curPath);
            if (exceptions && exceptions.find(p => curPath.endsWith(p))) {
                continue;
            }

            if (stat.isDirectory()) {
                deleteFoldersRecursive(curPath);
                fs.rmdirSync(curPath);
            } else {
                fs.unlinkSync(curPath);
            }
        }
    }
}

gulp.task('clean', done => {
    deleteFoldersRecursive('public');
    done();
});

function npmInstall() {
    return new Promise((resolve, reject) => {
        // Install node modules
        const cwd = `${__dirname.replace(/\\/g, '/')}/src/`;

        const cmd = `npm install -f`;
        console.log(`"${cmd} in ${cwd}`);

        // System call used for update of js-controller itself,
        // because during an installation the npm packet will be deleted too, but some files must be loaded even during the installation process.
        const exec = require('child_process').exec;
        const child = exec(cmd, {cwd});

        child.stderr.pipe(process.stderr);
        child.stdout.pipe(process.stdout);

        child.on('exit', (code /* , signal */) => {
            // code 1 is a strange error that cannot be explained. Everything is installed but error :(
            if (code && code !== 1) {
                reject(new Error(`Cannot install: ${code}`));
            } else {
                console.log(`"${cmd} in ${cwd} finished.`);
                // command succeeded
                resolve();
            }
        });
    });
}

const srcAdmin = `${__dirname}/src-admin/`;

function npmInstallAdmin() {
    return new Promise((resolve, reject) => {
        // Install node modules
        const cwd = srcAdmin.replace(/\\/g, '/');

        const cmd = `npm install -f`;
        console.log(`"${cmd} in ${cwd}`);

        // System call used for update of js-controller itself,
        // because during installation npm packet will be deleted too, but some files must be loaded even during the install process.
        const exec = cp.exec;
        const child = exec(cmd, {cwd});

        child.stderr.pipe(process.stderr);
        child.stdout.pipe(process.stdout);

        child.on('exit', (code /* , signal */) => {
            // code 1 is a strange error that cannot be explained. Everything is installed but error :(
            if (code && code !== 1) {
                reject(`Cannot install: ${code}`);
            } else {
                console.log(`"${cmd} in ${cwd} finished.`);
                // command succeeded
                resolve();
            }
        });
    });
}

function buildAdmin() {
    const version = JSON.parse(fs.readFileSync(`${__dirname}/package.json`).toString('utf8')).version;
    const data    = JSON.parse(fs.readFileSync(`${srcAdmin}package.json`).toString('utf8'));

    data.version = version;

    fs.writeFileSync(`${srcAdmin}package.json`, JSON.stringify(data, null, 4));

    return new Promise((resolve, reject) => {
        const options = {
            stdio: 'pipe',
            cwd:   srcAdmin
        };

        console.log(options.cwd);

        let script = `${srcAdmin}node_modules/@craco/craco/dist/bin/craco.js`;
        if (!fs.existsSync(script)) {
            script = `${__dirname}/node_modules/@craco/craco/dist/bin/craco.js`;
        }
        if (!fs.existsSync(script)) {
            console.error(`Cannot find execution file: ${script}`);
            reject(`Cannot find execution file: ${script}`);
        } else {
            const child = cp.fork(script, ['build'], options);
            child.stdout.on('data', data => console.log(data.toString()));
            child.stderr.on('data', data => console.log(data.toString()));
            child.on('close', code => {
                console.log(`child process exited with code ${code}`);
                code ? reject(`Exit code: ${code}`) : resolve();
            });
        }
    });
}

gulp.task('admin-0-clean', done => {
    deleteFoldersRecursive(`${__dirname}/admin/custom`);
    deleteFoldersRecursive(`${__dirname}/src-admin/build`);
    done();
});

gulp.task('admin-1-npm', async () => npmInstallAdmin());
gulp.task('admin-2-compile', async () => buildAdmin());

gulp.task('admin-3-copy', () => Promise.all([
    gulp.src(['src-admin/build/static/js/*.js', '!src-admin/build/static/js/vendors*.js']).pipe(gulp.dest('admin/custom/static/js')),
    gulp.src(['src-admin/build/static/js/*.map', '!src-admin/build/static/js/vendors*.map']).pipe(gulp.dest('admin/custom/static/js')),
    gulp.src(['src-admin/build/customComponents.js']).pipe(gulp.dest('admin/custom')),
    gulp.src(['src-admin/build/customComponents.js.map']).pipe(gulp.dest('admin/custom')),
    gulp.src(['src-admin/src/i18n/*.json']).pipe(gulp.dest('admin/custom/i18n')),
]));

gulp.task('admin-build', gulp.series(['admin-0-clean', 'admin-1-npm', 'admin-2-compile', 'admin-3-copy']));

gulp.task('2-npm', () => {
    if (fs.existsSync(`${__dirname}/src/node_modules`)) {
        return Promise.resolve();
    } else {
        return npmInstall();
    }
});

gulp.task('2-npm-dep', gulp.series('clean', '2-npm'));

function build() {
    return new Promise((resolve, reject) => {
        const options = {
            stdio: 'pipe',
            cwd:   `${__dirname}/src/`
        };

        const version = JSON.parse(fs.readFileSync(`${__dirname}/package.json`).toString('utf8')).version;
        const data = JSON.parse(fs.readFileSync(`${__dirname}/src/package.json`).toString('utf8'));
        data.version = version;
        fs.writeFileSync(`${__dirname}/src/package.json`, JSON.stringify(data, null, 4));

        console.log(options.cwd);

        let script = `${__dirname}/src/node_modules/react-scripts/scripts/build.js`;
        if (!fs.existsSync(script)) {
            script = `${__dirname}/node_modules/react-scripts/scripts/build.js`;
        }
        if (!fs.existsSync(script)) {
            console.error(`Cannot find execution file: ${script}`);
            reject(new Error(`Cannot find execution file: ${script}`));
        } else {
            const child = cp.fork(script, [], options);
            child.stdout.on('data', data => console.log(data.toString()));
            child.stderr.on('data', data => console.log(data.toString()));
            child.on('close', code => {
                console.log(`child process exited with code ${code}`);
                code ? reject(new Error(`Exit code: ${code}`)) : resolve();
            });
        }
    });
}

gulp.task('3-build', () => build());

gulp.task('3-build-dep', gulp.series('2-npm-dep', '3-build'));

gulp.task('5-copy', () =>
    gulp.src(['src/build/*/**', 'src/build/*', '!src/build/static/media/*.svg', '!src/build/static/media/*.txt'])
        .pipe(gulp.dest('public/')));

gulp.task('5-copy-dep', gulp.series('3-build-dep', '5-copy'));

gulp.task('default', gulp.parallel('5-copy-dep', 'admin-build'));
