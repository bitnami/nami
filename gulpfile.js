'use strict';

const _ = require('lodash');
const gulp = require('gulp');
const commonTasks = require('bitnami-gulp-common-tasks')(gulp);
const runSequence = require('gulp4-run-sequence');
const path = require('path');
const fs = require('fs-extra');
const execSync = require('child_process').execSync;
const tap = require('gulp-tap');

const defaultRuntimeVersion = '8.17.0';
/* CI tasks */

const testFiles = './test/*.js';
const srcFiles = ['*.js', './cli/**/*.js', './lib/**/*.js', testFiles];
const testArgs = {sources: srcFiles, tests: testFiles};

commonTasks.test(testArgs);
commonTasks.ci(testArgs);

/* Build tasks */

const buildDir = path.resolve('./artifacts/build');

const runtime = {url: process.env.NODE_RUNTIME_URL || null};

if (!runtime.url) {
  runtime.name = 'node';
  runtime.version = defaultRuntimeVersion;
  runtime.destDir = './runtime';
}

const npmRegistry = process.env.NPM_REGISTRY || null;

// Set of packages to bundle with nami and globs to fetch its code relatives to package folder
const defaultFilter = ['**/*.js', '!test{,/**}', '!gulpfile.js', '!node_modules{,/**}'];
const bundledPkgs = {
  'nami-core': defaultFilter,
  'nami-utils': defaultFilter,
  'nami-logger': defaultFilter,
  'nami-test': defaultFilter,
  'cmd-parser': defaultFilter
};

// Files to be stripped out in the final distributable
const postBundleFilter = [
  '**/flycheck_*.js',
  '**/*~',
  '**/*.patch',
  '**/.git'
].concat(_.map(
  ['tests', 'test', 'tests.js', 'test.js'],
  (p) => `node_modules/**/${p}`))
  .concat(_.map(
    ['tests', 'test', 'tests.js', 'test.js'],
    (p) => `!node_modules/**/mocha/**/${p}`))
  .concat(_.map(
    ['tests', 'test', 'tests.js', 'test.js'],
    (p) => `!node_modules/**/chai/**/${p}`))
  .concat(_.map(
    ['code_of_conduct.md', 'releasenotes.md', 'readme.md', 'history.md',
      'changelog.md', 'contributing.md', 'changes.md'],
    (p) => `**/${p}`))
  .concat(_.map(
    ['scripts', 'bin', 'examples', 'example'],
    (p) => `node_modules/**/${p}`))
  .concat(['!node_modules/deasync/bin'])
  .concat(['node_modules/cssstyle/lib/properties/*'])
  .concat(_.map(
    ['nomnom', 'jsdoc-toolkit', 'nan'],
    (p) => `node_modules/${p}`))
  .concat([
    'node_modules/deasync/bin/*',
    '!node_modules/deasync/bin/linux-x64-node-8/**',
    '!node_modules/deasync/bin/linux-x64-node-10/**'
  ])
  .concat(['node_modules/JSV'])
  .concat([
    'node_modules/core-js/*.js',
    '!node_modules/core-js/package.json',
    '!node_modules/core-js/index.js',
    'node_modules/core-js/es*',
    'node_modules/core-js/client',
    'node_modules/core-js/core',
    'node_modules/core-js/fn',
    'node_modules/core-js/build',
    'node_modules/core-js/js',
    'node_modules/core-js/modules',
    'node_modules/core-js/web'
  ]);


function fixupPackages(context) {
  const bundleOutputDir = context.bundleOutputDir;
  // We update the package to its inmediate next version to use a (more restrictive)
  // different License (from WTFPL to Apache). The license was changed per our request
  // because some vendors tend to not like it.
  // As this is a 3rd-level dependency, updating it is not straightforward
  // https://github.com/jsdom/xml-name-validator/commit/a692a0fe6ede0f5060ec19f747853d401c873040
  gulp.task('fixup:xml-name-validator', () => {
    const destPkg = path.join(bundleOutputDir, 'node_modules/xml-name-validator');
    const pkgDir = path.join(context.buildDir, 'xml-name-validator');
    const origPkgJSON = JSON.parse(fs.readFileSync(path.join(destPkg, 'package.json')));

    fs.mkdirpSync(pkgDir);
    execSync(`npm pack xml-name-validator@3.0.0`, {cwd: pkgDir});
    execSync(`tar -xzf xml-name-validator-3.0.0.tgz 2>/dev/null`, {cwd: pkgDir});
    return gulp.src('**', {cwd: path.join(pkgDir, 'package')})
      .pipe(tap(function(f) {
        if (_.endsWith(f.path, 'package.json')) {
          const pkgJSON = JSON.parse(f.contents.toString());
          origPkgJSON.license = pkgJSON.license;
          f.contents = new Buffer(JSON.stringify(origPkgJSON, null, 4));
        }
      })).pipe(gulp.dest(destPkg));
  });
  return (callback) => {
    runSequence(
      'fixup:xml-name-validator',
      callback
    );
  };
}

function createMinimalPackagesTasks(context) {
  const bundleOutputDir = context.bundleOutputDir;
  const skipRecipes = ['zombie'];
  const modulesContext = {buildDir: context.buildDir, skip: skipRecipes};

  const tasks = require('./gulp-tasks');

  gulp.task('modules:prepareEnv', (callback) => {
    return fs.mkdirp(context.buildDir, callback);
  });

  tasks.tasks.modules(gulp, modulesContext);

  gulp.task('preinstallPackages', (cb) => {
    _.each(modulesContext.data, data => {
      context.npmInstall(`${data.packedModule} --no-save`, {cwd: bundleOutputDir});
    });
    cb(null);
  });
  return (callback) => {
    runSequence(
      'modules:prepareEnv',
      'modules:lodash',
      'modules:handlebars',
      'preinstallPackages',
      callback
    );
  };
}

commonTasks.bundle({
  buildDir,
  artifactName: 'nami-linux-x64',
  sources: [
    './package.json',
    './index.js',
    './cli/*.js',
    './templates/**/*.tpl',
    './bin/**/*'
  ],
  postWebpackFilter: [
    'index.js',
    'cli{,/**}',
  ],
  postBundleFilter,
  bundledPkgs,
  entrypoint: 'index.js',
  npmRegistry,
  runtime,
  noOptional: true,
  hooks: {
    'pre:installDeps': createMinimalPackagesTasks,
    'post:installDeps': fixupPackages,
  }
});

commonTasks.npm({
  buildDir,
  sources: [
    './index.js',
    './cli/*.js',
    './test/*.js'
  ],
  meta: [
    './bin/**/*',
    './templates/**/*.tpl',
    './COPYING'
  ]
});

/* General tasks */

gulp.task('clean', () => {
  runSequence('test:clean', 'ci-test:clean', 'bundle:clean');
});

gulp.task('default', gulp.series('bundle'));
