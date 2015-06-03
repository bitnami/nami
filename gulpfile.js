'use strict';

const _ = require('lodash');
const gulp = require('gulp');
const runSequence = require('run-sequence');
const del = require('del');
const mocha = require('gulp-mocha');
const istanbul = require('gulp-istanbul');
const eslint = require('gulp-eslint');
const eslintTeamcity = require('eslint-teamcity');
const fs = require('fs');
const path = require('path');
const install = require('gulp-install');
const webpack = require('webpack-stream');
const download = require('gulp-download');
const rename = require('gulp-rename');
const chmod = require('gulp-chmod');
const tar = require('gulp-tar');
const untar = require('gulp-vinyl-untar');
const gzip = require('gulp-gzip');
const gunzip = require('gulp-gunzip');
const filter = require('gulp-filter');
const babel = require('gulp-babel');


/* CI tasks */

const testFiles = './test/*.js';
const srcFiles = ['*.js', './cli/**/*.js', './lib/**/*.js', testFiles];

const formatReportsConfig = {
  test: 'spec',
  coverage: ['lcov', 'json', 'text-summary', 'html'],
  lint: undefined
};

const formatReportsConfigCI = {
  test: 'mocha-teamcity-reporter',
  coverage: ['lcov', 'json', 'text-summary', 'html', 'teamcity'],
  lint: eslintTeamcity
};

// We have to find a way of doing this without global variables
function overrideFormatterForCI() {
  _.each(formatReportsConfigCI, (value, key) => {
    formatReportsConfig[key] = value;
  });
}

gulp.task('lint', () => {
  // ESLint ignores files with "node_modules" paths.
  // So, it's best to have gulp ignore the directory as well.
  // Also, Be sure to return the stream from the task;
  // Otherwise, the task may end before the stream has finished.
  return gulp.src(srcFiles)
    // eslint() attaches the lint output to the "eslint" property
    // of the file object so it can be used by other modules.
    .pipe(eslint())
    // eslint.format() outputs the lint results to the console.
    // Alternatively use eslint.formatEach() (see Docs).
    // .pipe(eslint.format('node_modules/eslint-teamcity/index.js'));
    .pipe(eslint.format(formatReportsConfig.lint));
    // To have the process exit with an error code (1) on
    // lint error, return the stream and pipe to failAfterError last.
    // .pipe(eslint.failAfterError());
});

gulp.task('pre-test', () => {
  return gulp.src(srcFiles)
    // Covering files
    .pipe(istanbul())
    // Force `require` to return covered files
    .pipe(istanbul.hookRequire());
});

gulp.task('test', ['pre-test'], () => {
  return gulp.src(testFiles, {read: false})
    .pipe(mocha({reporter: formatReportsConfig.test}))
    // Creating the reports after tests ran
    .pipe(istanbul.writeReports({reporters: formatReportsConfig.coverage}));
    // Enforce a coverage of at least 90%
    // .pipe(istanbul.enforceThresholds({ thresholds: { global: 90 } }));
});

_.each(['lint', 'test'], function(name) {
  gulp.task(`ci-${name}`, () => {
    overrideFormatterForCI();
    runSequence('clean', name);
  });
});

gulp.task('ci-tasks', () => {
  runSequence(['ci-lint', 'ci-test']);
});


/* Build tasks */

const buildDir = './build';
const bundleOutputDir = `${buildDir}/bundle`;
const bundleOutputName = 'nami-linux-x64';
const npmPackageOutputDir = `${buildDir}/npm-package`;
const runtimeUrl = process.env.NODE_RUNTIME_URL;

// Set of packages to bundle with nami and globs to fetch its code relatives to package folder
const defaultFilter = ['**/*.js', '!test{,/**}', '!gulpfile.js', '!node_modules{,/**}'];
const bundledPackages = {
  'nami-core': defaultFilter,
  'nami-utils': defaultFilter,
  'nami-logger': defaultFilter,
  'nami-test': defaultFilter,
  'cmd-parser': defaultFilter
};

function _fixPackageJsonForNpm() {
  const pkgInfo = JSON.parse(fs.readFileSync('./package.json'));
  delete pkgInfo.scripts;
  return pkgInfo;
}

function _mergeDeps() {
  const pkgInfo = JSON.parse(fs.readFileSync('./package.json'));
  _.each(bundledPackages, (props, pkg) => {
    const deps = JSON.parse(fs.readFileSync(path.join('./node_modules', pkg, 'package.json'))).dependencies;
    _.assign(pkgInfo.dependencies, deps);
    delete pkgInfo.dependencies[pkg];
  });
  delete pkgInfo.devDependencies;
  return pkgInfo;
}

function _scanPackagesFolder(folder) {
  // this returns a list with all the packages under a node_modules folder
  return fs.readdirSync(folder)
  // this avoids the `.bin` folder to be returned as a package
  .filter((x) => x !== '.bin');
}

function _relativizeBundledPackages(base) {
  const result = [];
  _.map(bundledPackages, (globs, pkg) => {
    _.each(globs, (i) => {
      let exclude = '';
      if (i.substring(0, 1) === '!') {
        exclude = '!';
        i = i.substring(1);
      }
      result.push(`${exclude}${path.join(base, 'node_modules', pkg)}/${i}`);
    });
  });
  return result;
}

function _relativizeBundledPackagesRoot(base) {
  const result = [];
  _.map(bundledPackages, (globs, pkg) => {
    result.push(`${path.join(base, 'node_modules', pkg)}`);
  });
  return result;
}

function checkRuntimeUrl() {
  if (!runtimeUrl) throw new Error('Environment var NODE_RUNTIME_URL is not defined. Runtime cannot be downloaded.');
}

gulp.task('bundle:clean', () => {
  return del([
    bundleOutputDir,
    `${buildDir}/${bundleOutputName}.tar.gz`
  ]);
});

gulp.task('bundle:preinstallPackages', () => {
  return gulp.src(['./package.json'], {base: './'})
    .pipe(install());
});

gulp.task('bundle:copySources', () => {
  return gulp.src([
    './package.json',
    './index.js',
    './cli/*.js',
    './templates/**/*.tpl',
    './bin/**/*'
  ], {base: './'})
    .pipe(gulp.dest(bundleOutputDir));
});

gulp.task('bundle:copyBundledPackages', () => {
  const base = './';
  return gulp.src(_relativizeBundledPackages(base), {base})
    .pipe(gulp.dest(bundleOutputDir));
});

gulp.task('bundle:mergeDeps', () => {
  return fs.writeFileSync(path.join(bundleOutputDir, 'package.json'), JSON.stringify(_mergeDeps(), null, 2));
});

gulp.task('bundle:installDeps', () => {
  return gulp.src([`${bundleOutputDir}/package.json`], {base: bundleOutputDir})
    .pipe(install({production: true}));
});

gulp.task('bundle:webpackize', () => {
  const externals = {};
  _.each(_scanPackagesFolder(`${bundleOutputDir}/node_modules`), (pkg) => externals[pkg] = `commonjs ${pkg}`);
  _.each(bundledPackages, (props, pkg) => delete externals[pkg]);
  const webpackConfig = {
    entry: {app: `${bundleOutputDir}/index.js`},
    target: 'node',
    node: { // tells webpack not to mock `__filename` nor `__dirname`
      __filename: false,
      __dirname: false,
    },
    output: {
      filename: 'nami.js'
    },
    module: {
      loaders: [
        {test: /\.json$/, loader: 'json'},
      ]
    },
    resolve: {
      root: [
        path.resolve(bundleOutputDir)
      ],
      modulesDirectories: [
        path.join(bundleOutputDir, 'node_modules/')
      ]
    },
    externals
  };

  return gulp.src([`${bundleOutputDir}/index.js`], {base: bundleOutputDir})
    .pipe(webpack(webpackConfig))
    .pipe(gulp.dest(bundleOutputDir));
});

gulp.task('bundle:deleteSources', () => {
  return del([
    `${bundleOutputDir}/index.js`,
    `${bundleOutputDir}/cli{,/**}`,
  ].concat(_relativizeBundledPackagesRoot(bundleOutputDir)));
});

gulp.task('bundle:renameEntryfile', () => {
  fs.renameSync(path.join(bundleOutputDir, 'nami.js'), path.join(bundleOutputDir, 'index.js'));
});

gulp.task('bundle:addRuntime', () => {
  return download(runtimeUrl)
    .pipe(rename('./node'))
    .pipe(chmod(755))
    .pipe(gulp.dest(`${bundleOutputDir}/runtime`));
});

gulp.task('bundle:addLicense', () => {
  return gulp.src('./COPYING')
    .pipe(gulp.dest(bundleOutputDir));
});

gulp.task('bundle:compress', () => {
  return gulp.src(`${bundleOutputDir}{,/**}`, {base: bundleOutputDir})
    .pipe(rename((p) => p.dirname = path.join(bundleOutputName, p.dirname)))
    .pipe(tar(`${bundleOutputName}.tar`))
    .pipe(gzip())
    .pipe(gulp.dest(buildDir));
});

gulp.task('npm-pack:clean', () => {
  return del([
    npmPackageOutputDir
  ]);
});

gulp.task('npm-pack:transpile', () => {
  return gulp.src([
    './index.js',
    './cli/*.js',
    './test/*.js'
  ], {base: './'})
    .pipe(babel({presets: ['es2015']}))
    .pipe(gulp.dest(npmPackageOutputDir));
});

gulp.task('npm-pack:copyMeta', () => {
  return gulp.src([
    './bin/**/*',
    './templates/**/*.tpl',
    './COPYING'
  ], {base: './'})
    .pipe(gulp.dest(npmPackageOutputDir));
});

gulp.task('npm-pack:fixPackageInfo', () => {
  return fs.writeFileSync(path.join(npmPackageOutputDir, 'package.json'),
                          JSON.stringify(_fixPackageJsonForNpm(), null, 2));
});

gulp.task('bundle-webpack', () => {
  runSequence(
    'bundle:clean',
    'bundle:preinstallPackages',
    'bundle:copySources',
    'bundle:copyBundledPackages',
    'bundle:mergeDeps',
    'bundle:installDeps',
    'bundle:webpackize',
    'bundle:deleteSources',
    'bundle:renameEntryfile',
    'bundle:addRuntime',
    'bundle:addLicense',
    'bundle:compress'
  );
});

gulp.task('bundle', () => {
  checkRuntimeUrl();
  runSequence(
    'bundle:clean',
    'bundle:preinstallPackages',
    'bundle:copySources',
    'bundle:installDeps',
    'bundle:addRuntime',
    'bundle:addLicense',
    'bundle:compress'
  );
});

gulp.task('npm-pack', () => {
  checkRuntimeUrl();
  runSequence(
    'npm-pack:clean',
    'npm-pack:transpile',
    'npm-pack:copyMeta',
    'npm-pack:fixPackageInfo'
  );
});


/* General tasks */

const nodeVersion = '6.2.2';

gulp.task('clean', () => {
  return del([
    'coverage/**/*',
    'reports/**/*',
    buildDir
  ]);
});

gulp.task('install-runtime', () => {
  return download(`https://nodejs.org/dist/v${nodeVersion}/node-v${nodeVersion}-linux-x64.tar.gz`)
    .pipe(gunzip())
    .pipe(untar())
    .pipe(filter([`node-v${nodeVersion}-linux-x64/bin/node`]))
    .pipe(rename('node'))
    .pipe(chmod(755))
    .pipe(gulp.dest('./runtime'));
});

gulp.task('default', ['install-runtime']);
