const { task, src, dest, series, watch } = require('gulp');
const run = require('gulp-run');
const postcss = require('gulp-postcss');
const bodyText = require("./typographist");
const browserSync = require('browser-sync').create();


const appDir = "_app";
const siteDir = "_site";

task('build:styles', () => {
    return src(appDir + '/styles/*.css')
        .pipe(postcss(bodyText))
        .pipe(dest(siteDir))
});

task('build:jekyll', function() {
    return src(".")
        .pipe(run('jekyll build --config _config.yml'));
});

task('build', series('build:jekyll', 'build:styles'/*, 'build:copydeps'*/), done => {
    return done();
});


task('build:jekyll:watch', series('build', done => {
    browserSync.reload();
    return done();
}));

task("serve", series("build", done => {
    browserSync.init({
        server: siteDir,
        ghostMode: false,
        logFileChanges: true,
        open: true
    });

    const restart = require('gulp-restart');
    watch('_config.yml', series('build:jekyll:watch'));
    watch('_app/styles/*.css', series('build:styles'));
    watch('_chapters/*.+(md|markdown|MD)', series('build:jekyll:watch'));
    watch('_layouts/*.html', series('build:jekyll:watch'));
    watch('typographist.js', restart);
    watch(['index.html'], series('build:jekyll:watch'));

    return done();
}));
