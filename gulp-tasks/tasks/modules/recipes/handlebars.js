'use strict';

const _ = require('lodash');
const gulp = require('gulp');
const path = require('path');
const tap = require('gulp-tap');

function getBuildTask(context) {
  return function() {
    const distFile = 'dist/handlebars.min.js';
    return gulp.src(
      ['package.json', distFile, 'LICENSE'],
      {cwd: context.packageSources}
    ).pipe(tap(function(f) {
      if (_.endsWith(f.path, distFile)) {
        f.path = path.join(path.dirname(f.path), 'index.js');
      }
      if (f.path === path.join(context.packageSources, 'package.json')) {
        const pkgJSON = JSON.parse(f.contents.toString());
        f.contents = new Buffer(
          JSON.stringify(
            context.utils.fixupPackageData(pkgJSON, {main: 'index.js'}),
            null, 4)
        );
      }
    })).pipe(gulp.dest(context.outputDir));
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
        const hb = require('handlebars');
        const tpl = hb.compile('hello {{name}}');
        console.log(tpl({name: 'world'}));
        `, response => {
          const expected = 'hello world';
          if (response !== expected) {
            throw new Error(
              `Package handlebars seems broken, expected '${expected}' but got '{response}'`
            );
          }
        }
      );
      callback();
    }
  };
}

module.exports = initialize;
