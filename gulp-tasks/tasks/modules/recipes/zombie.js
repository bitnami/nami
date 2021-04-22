'use strict';

const _ = require('lodash');
const gulp = require('gulp');
const runSequence = require('gulp4-run-sequence');
const path = require('path');
const fs = require('fs-extra');
const execSync = require('child_process').execSync;
const rename = require('gulp-rename');
const tap = require('gulp-tap');

function getBuildTask(context) {
  return function(callback) {
    gulp.task('modules:lodash:build:copyCommonFiles', () => {
      return gulp.src(['**', '!**/*.js', '!lib/**'], {cwd: context.packageSources})
        .pipe(tap(function(f) {
          if (f.path === path.join(context.packageSources, 'package.json')) {
            const pkgJSON = JSON.parse(f.contents.toString());
            f.contents = new Buffer(
              JSON.stringify(
                context.utils.fixupPackageData(pkgJSON, {
                  dependencies: _.omit(pkgJSON.dependencies, 'babel-runtime')
                }),
                null, 4)
            );
          }
        })).pipe(gulp.dest(context.outputDir));
    });
    gulp.task('modules:lodash:build:copyLibs', () => {
      return gulp.src(['**/*.js', '!test/**'], {cwd: context.localRepositoryDir})
        .pipe(rename(function(file) {
          if (file.dirname.split('/')[0] === 'src') {
            file.dirname = file.dirname.replace(/^src(\/.*|$)/, 'lib$1');
          }
        })).pipe(tap(function(file) {
          if (path.basename(file.path) === 'index.js') {
            let extraText = '';
            const text = file.contents.toString();
            const cleanedText = text.replace(
                /^\s*static\s+([^\s=]+)\s*=\s*(.*)/gm,
              function(match, name, value) {
                extraText += `Browser.${name} = ${value}` +'\n';
                return `// ${match.trimLeft()}`;
              });
            file.contents = new Buffer(`${cleanedText}\n${extraText}`);
          }
        }))
        .pipe(gulp.dest(context.outputDir));
    });
    return runSequence(
      'modules:lodash:build:copyCommonFiles',
      'modules:lodash:build:copyLibs',
      callback);
  };
}

function getFetchTask(context) {
  return function(callback) {
    fs.mkdirpSync(context.downloadsDir);
    gulp.task('modules:zombie:fetch:git', (cb) => {
      context.localRepositoryDir = path.join(context.downloadsDir, 'git');
      const safeCommit = "92080eb770266e45c4fa1c0eb55bc2050c1d10eb"
      fs.mkdirpSync(context.localRepositoryDir);
      let repository = context.pkg.repository.url;
      const tag = `v${context.version}`;
      if (!repository.match(/git@github.com\/assaf\/zombie.git$/)) {
        throw new Error(`Unknown repository source: ${repository}`);
      }
      repository = repository.replace(/.*@/, 'https://');
      execSync(`git clone ${repository} ${context.localRepositoryDir}`, {stdio: 'ignore'});
      execSync(`git checkout ${safeCommit}`, {stdio: 'ignore', cwd: context.localRepositoryDir});
      cb();
    });
    gulp.task('modules:zombie:fetch:npm', (cb) => {
      fs.mkdirpSync(context.downloadsDir);
      const tail = execSync(`npm pack ${context.id}@${context.version}`, {cwd: context.downloadsDir}).toString().trim();
      context.packageSources = path.join(context.downloadsDir, tail);
      cb();
    });
    return runSequence(
      ['modules:zombie:fetch:git', 'modules:zombie:fetch:npm'],
      callback
    );
  };
}

function initialize(context) {
  return {
    build: getBuildTask(context),
    fetch: getFetchTask(context),
    test: callback => {
      context.utils.validatePackage(
        context.id,
        context.data.packedModule,
        `
        const Browser = require('zombie');
        const browser = new Browser();
        console.log(typeof browser.visit === 'function' ? 'OK' : 'ERROR');
        `, response => {
          if (response !== 'OK') {
            throw new Error('zombie package was not properly created');
          }
        }
      );
      callback();
    }
  };
}

module.exports = initialize;
