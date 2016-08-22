'use strict';

const _ = require('lodash');
const gulp = require('gulp');
const commonTasks = require('bitnami-gulp-common-tasks')(gulp);
const runSequence = require('run-sequence');


/* CI tasks */

const testFiles = './test/*.js';
const srcFiles = ['*.js', './cli/**/*.js', './lib/**/*.js', testFiles];
const testArgs = {sources: srcFiles, tests: testFiles};

commonTasks.test(testArgs);
commonTasks.ci(testArgs);

/* Build tasks */

const buildDir = './build';

const runtime = {url: process.env.NODE_RUNTIME_URL || null};

if (!runtime.url) {
  runtime.name = 'node';
  runtime.version = '6.2.1';
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
].concat(_.map(['tests', 'test', 'tests.js', 'test.js'], (p) => `node_modules/**/${p}`))
.concat(_.map(['tests', 'test', 'tests.js', 'test.js'], (p) => `!node_modules/**/mocha/**/${p}`))
.concat(_.map(['tests', 'test', 'tests.js', 'test.js'], (p) => `!node_modules/**/chai/**/${p}`))
.concat(_.map(['code_of_conduct.md', 'releasenotes.md', 'readme.md', 'history.md',
               'changelog.md', 'contributing.md', 'license.md', 'changes.md'], (p) => `**/${p}`))
.concat(_.map(['nomnom', 'jsdoc-toolkit', 'nan'], (p) => `node_modules/${p}`))
.concat(['node_modules/deasync/bin/*', '!node_modules/deasync/bin/linux-x64-node-6/**'])
.concat(['node_modules/JSV'])
.concat([
	 'node_modules/core-js/*.js',
         'node_modules/core-js/LICENSE',
	 '!node_modules/core-js/package.json',
         '!node_modules/core-js/index.js', 
         'node_modules/core-js/es*',
         'node_modules/core-js/client',
         'node_modules/core-js/core',
         'node_modules/core-js/fn',
         'node_modules/core-js/build',
         'node_modules/core-js/js',
         'node_modules/core-js/modules',
         'node_modules/core-js/web',
	]);



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

gulp.task('clean', () => {
  runSequence('test:clean', 'ci-test:clean', 'bundle:clean');
});

gulp.task('default', ['install-runtime']);
