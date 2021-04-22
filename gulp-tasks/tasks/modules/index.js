'use strict';

const fs = require('fs-extra');
const _ = require('lodash');
const path = require('path');
const runSequence = require('gulp4-run-sequence');
const recipes = {};
const recipesDir = path.join(__dirname, 'recipes');
const execSync = require('child_process').execSync;
const del = require('del');

function defaultClean(context) {
  return () => del(context.root);
}
function defaultFetch(context) {
  return callback => {
    fs.mkdirpSync(context.downloadsDir);
    const tail = execSync(`npm pack ${context.id}@${context.version}`, {cwd: context.downloadsDir}).toString().trim();
    context.packageSources = path.join(context.downloadsDir, tail);
    callback();
  };
}

function defaultExtract(context) {
  return callback => {
    fs.mkdirpSync(context.srcDir);
    execSync(`tar -xzf ${context.packageSources} 2>/dev/null`, {cwd: context.srcDir});
    context.packageSources = path.join(context.srcDir, 'package');
    callback();
  };
}
function defaultPack(context) {
  return function(cb) {
    const packed = execSync(`npm pack ${context.outputDir}`, {cwd: context.root}).toString().trim();
    context.data.packedModule = path.join(context.root, packed);
    cb();
  };
}

function loadRecipe(id, recipeCreator, context, gulp) {
  const allSteps = [];
  const steps = recipeCreator(context, gulp);
  _.each({
    clean: defaultClean,
    fetch: defaultFetch,
    extract: defaultExtract,
    build: null,
    pack: defaultPack,
    test: null,
  }, (defaulCb, step) => {
    if (!_.has(steps, step)) {
      if (defaulCb === null) {
        throw new Error(`Missing required step '${step}' in '${id}' recipe`);
      } else {
        steps[step] = defaulCb(context);
      }
    }
    const stepName = `modules:${id}:${step}`;
    gulp.task(stepName, steps[step]);
    allSteps.push(stepName);
  });
  gulp.task(`modules:${id}`, (cb) => {
    return runSequence.apply(null, allSteps.concat(cb));
  });
}
_.each(fs.readdirSync(path.join(recipesDir)), recipe => {
  if (path.extname(recipe) === '.js') {
    const id = path.parse(recipe).name;
    const recipeDefinition = require(path.join(recipesDir, recipe));
    if (!_.isFunction(recipeDefinition)) {
      console.error(`Skipping erroneous recipe ${recipe}`);
      return;
    }
    recipes[id] = (gulp, context) => loadRecipe(id, recipeDefinition, context, gulp);
  }
});


function getPackageVersion(name) {
  const pkgFile = require.resolve(`${name}/package.json`);
  const pkgData = fs.readJSONSync(pkgFile);
  return pkgData.version;
}
function fixupPackageData(data, overrides) {
  const newData = _.clone(data);
  newData.dependencies = {};
  newData.scripts = {};
  newData.bin = {};
  _.extend(newData, overrides || {});
  return newData;
}

function validatePackage(name, distFile, validationJS, validationCb) {
  const testDir = path.join(path.dirname(distFile), `${name}_test`);
  fs.mkdirpSync(testDir);
  const dependencies = {};
  dependencies[name] = distFile;
  fs.mkdirpSync(testDir);
  fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify({
    name: 'dummy',
    version: '1.0.0',
    license: 'MIT',
    description: `helper for ${name} testing`,
    repository: 'example.com',
    dependencies: dependencies
  }, null, 4));
  const indexJS = path.join(testDir, 'index.js');
  fs.writeFileSync(indexJS, validationJS);
  execSync(`npm install --production --no-optional ${distFile}`, {cwd: testDir});
  const response = execSync(`${process.argv[0]} ${indexJS}`).toString().trim();
  return validationCb(response);
}


function initializeRecipes(gulp, context) {
  if (!context) { throw new Error('You must provide a context'); }
  if (!context.data) { context.data = {}; }
  if (!context.skip) {context.skip = []; }
  if (!context.buildDir) {
    throw new Error(`Option 'buildDir' is required`);
  }
  const results = {};
  _.each(recipes, (recipeLoader, id) => {
    if (_.includes(context.skip, id)) {
      return;
    }
    const recipeRoot = path.join(context.buildDir, id);
    context.data[id] = {};
    const recipeContext = {
      root: recipeRoot,
      id: id,
      gulp: gulp,
      pkg: fs.readJSONSync(require.resolve(`${id}/package.json`)),
      version: getPackageVersion(id),
      srcDir: path.join(recipeRoot, 'src'),
      downloadsDir: path.join(recipeRoot, 'downloads'),
      outputDir: path.join(recipeRoot, 'output'),
      data: context.data[id],
      bundleDir: context.bundleDir,
      utils: {getPackageVersion, fixupPackageData, validatePackage}
    };
    results[id] = recipeContext;
    recipeLoader(gulp, recipeContext);
  });
}

_.extend(initializeRecipes, recipes);

module.exports = initializeRecipes;
