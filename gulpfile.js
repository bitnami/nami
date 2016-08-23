'use strict';

const gulp = require('gulp');
const commonTasks = require('bitnami-gulp-common-tasks')(gulp);
const runSequence = require('run-sequence');

const runtimeVersion = '6.2.1';
const runtimeDir = './runtime';

/* CI tasks */

const testFiles = './test/*.js';
const srcFiles = ['*.js', './cli/**/*.js', './lib/**/*.js', testFiles];
const testArgs = {sources: srcFiles, tests: testFiles};

commonTasks.test(testArgs);
commonTasks.ci(testArgs);

/* Build tasks */

const buildDir = './artifacts/build';

const runtime = {url: process.env.NODE_RUNTIME_URL || null};

if (!runtime.url) {
  runtime.name = 'node';
  runtime.version = runtimeVersion;
  runtime.destDir = runtimeDir;
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
  bundledPkgs,
  entrypoint: 'index.js',
  npmRegistry,
  runtime
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

commonTasks['install-node']({version: runtimeVersion, destination: runtimeDir});

gulp.task('clean', () => {
  runSequence('test:clean', 'ci-test:clean', 'bundle:clean');
});

gulp.task('default', ['install-runtime']);
