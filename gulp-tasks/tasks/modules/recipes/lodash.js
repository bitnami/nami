'use strict';

const runSequence = require('gulp4-run-sequence');
const path = require('path');
const fs = require('fs-extra');
const execSync = require('child_process').execSync;
const tap = require('gulp-tap');

function getBuildTask(context) {
  return function(mainCallback) {
    let lodashCli = null;
    // When running inside Gulp, this will point to the gulp instance
    const gulp = context.gulp;
    fs.mkdirpSync(context.outputDir);
    gulp.task('modules:lodash:build:prerequisites', (prCb) => {
      const lodashHelperDir = path.join(context.srcDir, 'lodash-cli');
      fs.mkdirpSync(lodashHelperDir);
      // We ignore the patch level
      const version = context.version.split('.').slice(0,2).join('.');
      fs.writeFileSync(path.join(lodashHelperDir, 'package.json'), JSON.stringify({
        name: 'lodash-build-helper',
        version: '1.0.0',
        license: 'MIT',
        repository: 'example.com',
        description: 'helper for lodash building',
        dependencies: {'lodash-cli': version}
      }));
      // We setup lodash-cli
      execSync(`npm install`, {cwd: lodashHelperDir});
      lodashCli = path.join(lodashHelperDir, 'node_modules/.bin/lodash');
      prCb();
    });
    gulp.task('modules:lodash:build:copyCommonFiles', () => {
      return gulp.src(['LICENSE', 'package.json'], {cwd: context.packageSources})
        .pipe(tap(function(f) {
          if (f.path === path.join(context.packageSources, 'package.json')) {
            const pkgJSON = JSON.parse(f.contents.toString());
            f.contents = new Buffer(
              JSON.stringify(
                context.utils.fixupPackageData(pkgJSON, {main: 'index.js'}),
                null, 4)
            );
          }
        })).pipe(gulp.dest(context.outputDir));
    });
    gulp.task('modules:lodash:build:buildMinimal', (callback) => {
      execSync(`${lodashCli} -s -p --output ${path.join(context.outputDir, 'index.js')}`, {quiet: false});
      callback();
    });
    return runSequence(
      'modules:lodash:build:prerequisites',
      'modules:lodash:build:copyCommonFiles',
      'modules:lodash:build:buildMinimal',
      mainCallback
    );
  };
}


function initialize(context) {
  return {
    build: getBuildTask(context),
    test: callback => {
      context.utils.validatePackage(
        context.id,
        context.data.packedModule,
        `
        const _ = require('lodash');
        function normalizeVersion(v) {
          return v.split('.').slice(0, 2).join('.');
        }
        console.log(normalizeVersion(_.VERSION) === normalizeVersion('${context.version}') ? 'OK' : 'ERROR');
        `, response => {
          if (response !== 'OK') {
            throw new Error('lodash package was not properly created' + response);
          }
        }
      );
      callback();
    }
  };
}

module.exports = initialize;
