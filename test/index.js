'use strict';

const chai = require('chai');
const chaiFs = require('chai-fs');
const chaiSubset = require('chai-subset');
const expect = chai.expect;
const _ = require('lodash');
const path = require('path');
const fs = require('fs-extra');
const spawnSync = require('child_process').spawnSync;
const execSync = require('child_process').execSync;
const Sandbox = require('nami-test').Sandbox;
const XRegExp = require('xregexp');
const testHelpers = require('nami-core/test/helpers.js');
const copySamplePackage = testHelpers.copySamplePackage;
const samplePackageFromScratch = testHelpers.samplePackageFromScratch;

chai.use(chaiSubset);
chai.use(chaiFs);

const currentUserIsRoot = process.getuid() === 0;

class NamiHandler {
  constructor(options) {
    options = options || {};

    this._configArgs = [];
    _.each(
      ['namiPrefix', 'optionsFile', 'noProfile', 'noRc'],
      key => {
        if (_.has(options, key)) {
          const value = options[key].toString();
          const argName = _.kebabCase(key);
          this._configArgs.push(`--${argName}=${value}`);
        }
      }
    );
    if (process.env.NAMI_TOOL_BINARY) {
      this._extraEnv = {};
      this._namiBin = process.env.NAMI_TOOL_BINARY;
    } else {
      this._extraEnv = {NAMI_TEST_RUNTIME: process.argv[0]};
      this._namiBin = path.join(__dirname, '../bin/nami');
    }
  }
  _spawnOpts() {
    const env = {};
    _.extend(env, process.env, this._extraEnv);
    return {env: env};
  }
  namiExec(argsString, options) {
    const argsArray = ['-c', `${this._namiBin} ${this._configArgs.join(' ')} ${argsString}`];
    const result = spawnSync('/bin/bash', argsArray, this._spawnOpts());
    return this._processSpawnResult(result, options);
  }
  namiSpawn(argsArray, options) {
    const result = spawnSync(
      this._namiBin,
      this._configArgs.concat(argsArray),
      this._spawnOpts());
    return this._processSpawnResult(result, options);
  }
  _processSpawnResult(result, options) {
    options = _.defaults(options || {}, {abortOnError: true});
    const stdout = result.stdout.toString();
    const stderr = result.stderr.toString();
    const status = result.status;
    if (status !== 0 && options.abortOnError) {
      throw new Error(stderr);
    }
    return {stdout, stderr, status};
  }
}

function getNewNamiHandler(sandbox) {
  const registryPrefix = sandbox.normalize('.nami');
  const installPrefix = sandbox.normalize('/opt/bitnami');
  const optionsFile = sandbox.write('nami.options', JSON.stringify({
    installation: {
      prefix: installPrefix
    },
    namiPrefix: registryPrefix
  }));
  return new NamiHandler({optionsFile: optionsFile});
}

describe('Nami App', function() {
  this.timeout(15000);
  describe('Command Line', function() {
    let h = null;
    function initializeNamiHandler() {
      h = getNewNamiHandler(new Sandbox());
      return h;
    }

    before(initializeNamiHandler);
    describe('Help Menu', function() {
      function getOptionReText(name, options) {
        options = _.defaults(options || {}, {default: '.*', type: 'string', allowed: '.*'});
        let text = `--${name}`;
        if (options.type !== 'boolean') {
          text += `\\s+\\<${name}\\>\\s+.*\\n+\\s*Default:\\s${options.default}\\n`;
        } else {
          text += `\\s+.*\\n+`;
        }
        if (options.type === 'choice' || options.allowed !== '.*') text += `\\s*Allowed:\\s${options.allowed}`;
        return `${text}\\n+`;
      }
      function getHelpRe(extraRe) {
        // XRegExp uses this naming and usage
        /* eslint-disable new-cap, no-useless-escape, prefer-template */
        const mainHelpRe = XRegExp(
        '^\nUsage: nami \<options\> \<command\>\n*'
          + '\\s+where \<options\> include:\n+'
          + '--help\\s+\n+'
          + getOptionReText('log-level', {default: 'info', allowed: 'trace, debug, info, warn, error, silent'})
          + getOptionReText('nami-prefix')
          + getOptionReText('options-file')
          + getOptionReText('no-profile', {type: 'boolean'})
          + getOptionReText('no-rc', {type: 'boolean'})
          + getOptionReText('version', {type: 'boolean'})
          + 'And \<command\> is one of: list, install, unpack, uninstall,'
          + ' test, initialize, new, execute, start, stop, restart, status, inspect\\n+'
          + 'To get more information about a command, you can execute:\\n+'
          + `\\s*nami \<command\> --help\\n+${extraRe || ''}$`
        );
        /* eslint-enable new-cap, no-useless-escape, prefer-template */
        return mainHelpRe;
      }
      it('Appears when called without arguments', function() {
        const stdout = h.namiExec('').stdout;
        expect(stdout).to.match(getHelpRe());
      });
      it('Appears when called with --help', function() {
        const stdout = h.namiExec('--help').stdout;
        expect(stdout).to.match(getHelpRe());
      });
      it('Appears when called with wrong commands, as well as an error message', function() {
        const result = h.namiExec('asdf', {abortOnError: false});
        expect(result.stdout).to.match(getHelpRe());
        // nami ERROR Unknown command 'asdf'
        expect(result.stderr).to.match(/Unknown command 'asdf'/);
        expect(result.status).to.be.eql(1);
      });
    });
    describe('Version Menu', function() {
      it('Appears when called with --version', function() {
        const stdout = h.namiExec('--version').stdout;
        // expects something like `1.0.0`, `1.0.0-alpha1`,
        // `1.0.0 (2016-02-17 12:59:20)` or `1.0.0-alpha1 (2016-02-17 12:59:20)`
        /* eslint-disable max-len */
        expect(stdout).to.match(/^((\d+\.)?(\d+\.)?(\*|\d+))(-([a-zA-Z0-9_])+)?(\s\(([0-9]){4}-([0-9]){2}-([0-9]){2}\s([0-9]){2}:([0-9]){2}:([0-9]){2}\))?\n$/);
        /* eslint-enable max-len */
      });
    });
    xdescribe('Load Configuration', function() {
      it('General configuration options are properly loaded', function() {
        expect(false).to.be.eql(true);
      });
    });
  });
  describe('#execute()', function() {
    let h = null;
    let sb = null;
    const samplePackageData = {
      id: 'main_package',
      exports: {
        hello: {arguments: ['who']}
      },
      mainJS: `
$app.exports.hello = function(who) {
return 'Hello ' + (who || 'you');
 };`
    };
    beforeEach(function() {
      sb = new Sandbox();
      h = getNewNamiHandler(sb);
    });
    it('Executes commands defined by a package', function() {
      const mainPkgDir = samplePackageFromScratch(samplePackageData);
      h.namiExec(`install ${mainPkgDir}`);
      const stdout = h.namiExec('execute main_package hello bitnami').stdout.trim();
      expect(JSON.parse(stdout)).to.be.eql('Hello bitnami');
    });
    it('Uninitialized components do not allow executing commands', function() {
      const mainPkgDir = samplePackageFromScratch(samplePackageData);
      h.namiExec(`unpack ${mainPkgDir}`);
      const result = h.namiExec('execute main_package hello bitnami', {abortOnError: false});

      expect(result.status).to.be.eql(5);
      expect(result.stdout).to.match(
          /not fully installed. You cannot execute commands/
      );
    });
    it('Do not require required parameters to be able to call functions', function() {
      const packageData = _.cloneDeep(samplePackageData);
      _.extend(packageData, {
        properties: {
          password: {type: 'password', required: true}
        }
      });
      const mainPkgDir = samplePackageFromScratch(packageData);
      h.namiExec(`install ${mainPkgDir} --password=bitnami`);
      const stdout = h.namiExec('execute main_package hello bitnami').stdout.trim();
      expect(JSON.parse(stdout)).to.be.eql('Hello bitnami');
    });
  });
  describe('#inspect()', function() {
    let h = null;
    let sb = null;
    beforeEach(function() {
      sb = new Sandbox();
      h = getNewNamiHandler(sb);
    });
    it('Show information about an installed package', function() {
      const id = 'demo_package';
      const pkgDir = copySamplePackage(id);
      const prefix = sb.normalize('/opt/bitnami');
      const expectedInstalldir = path.join(prefix, id);
      expect(expectedInstalldir).to.not.be.a.path();
      h.namiExec(`install ${pkgDir}`);
      expect(expectedInstalldir).to.be.a.directory();
      const result = h.namiExec(`inspect ${id}`);
      const data = JSON.parse(result.stdout);
      expect(data).to.containSubset({
        id: 'demo_package', name: 'demo_package', version: '1.0.0',
        environment: {}, installedAsRoot: currentUserIsRoot,
        revision: 1, lifecycle: 'installed',
        installdir: expectedInstalldir,
        installPrefix: prefix, values: {}, extends: ['Component'],
        exports: []
      });
    });
  });
  describe('#list()', function() {
    let h = null;
    let sb = null;
    beforeEach(function() {
      sb = new Sandbox();
      h = getNewNamiHandler(sb);
    });
    it('Lists all the installed packages', function() {
      _.each(['sample-service', 'demo_package'], function(id) {
        const pkgDir = copySamplePackage(id);
        h.namiExec(`install ${pkgDir}`);
      });
      const result = h.namiExec('list');
      expect(JSON.parse(result.stdout.trim())).to.be.eql(
        ['com.bitnami.service', 'demo_package']
      );
    });
  });
  describe('#eval()', function() {
    let h = null;
    let sb = null;
    beforeEach(function() {
      sb = new Sandbox();
      h = getNewNamiHandler(sb);
    });
    it('Evaluates a file in nami context', function() {
      const id = 'demo_package';
      const pkgDir = copySamplePackage(id);
      const prefix = sb.normalize('/opt/bitnami');
      const expectedInstalldir = path.join(prefix, id);
      expect(expectedInstalldir).to.not.be.a.path();
      h.namiExec(`install ${pkgDir}`);
      expect(expectedInstalldir).to.be.a.directory();

      const jsFile = sb.write('sample.js', `
      const list = $manager.listPackages();
console.log(list.demo_package.version);
`);
      const result = h.namiExec(`eval ${jsFile}`);
      expect(result.stdout.trim()).to.be.eql('1.0.0');
    });
  });
  describe('Services management', function() {
    class ServiceTestHelper {
      constructor(opts) {
        opts = _.defaults(opts || {}, {id: 'dummy_service'});
        this._sandbox = new Sandbox();
        this._namiHandler = getNewNamiHandler(this._sandbox);
        this.id = opts.id;
        this.installdir = null;
      }
      _copyPackage() {
        const pkgDir = copySamplePackage('sample-service');
        const prefix = this._sandbox.normalize('/opt/bitnami');
        this.installdir = path.join(prefix, this.id);
        return pkgDir;
      }
      install() {
        const pkgDir = this._copyPackage();
        this._namiHandler.namiExec(`install ${pkgDir}`);
      }
      unpack() {
        const pkgDir = this._copyPackage();
        this._namiHandler.namiExec(`unpack ${pkgDir}`);
      }
      getPid() {
        try {
          return parseInt(fs.readFileSync(path.join(this.installdir, 'tmp/service.pid')).toString().trim(), 10);
        } catch (e) {
          return null;
        }
      }
      isRunning() {
        const pid = this.getPid();
        if (!pid) return false;
        try {
          return process.kill(pid, 0);
        } catch (e) {
          return false;
        }
      }
      _callCommand(cmd) {
        return execSync(
          `${this.installdir}/ctlscript.sh ${cmd} > /dev/null 2> /dev/null`,
          {detached: true}
        ).toString().trim();
      }
      start() {
        return this._callCommand('start');
      }
      stop() {
        return this._callCommand('stop');
      }
      namiExec(cmd, opts) {
        return this._namiHandler.namiExec(cmd, opts);
      }
      cleanUp() {
        this.stop();
        // Make sure it is stopped
        try {
          process.kill(this.getPid());
        } catch (e) { /* not empty */ }
        _.each(['tmp/service.pid', 'logs/service.log'], f => {
          fs.removeSync(path.join(this.installdir, f));
        });
      }
    }
    describe('Start', function() {
      let helper = null;
      beforeEach(function() {
        helper = new ServiceTestHelper();
        helper.install();
      });
      afterEach(() => helper.cleanUp());

      it('Starts a service', function() {
        expect(helper.isRunning()).to.be.eql(false);
        helper.namiExec(`start ${helper.id}`);
        expect(helper.isRunning()).to.be.eql(true);
      });
    });
    describe('Stop', function() {
      let helper = null;
      beforeEach(function() {
        helper = new ServiceTestHelper();
        helper.install();
      });
      afterEach(() => helper.cleanUp());

      it('Stops a service', function() {
        helper.start();
        expect(helper.isRunning()).to.be.eql(true);
        helper.namiExec(`stop ${helper.id}`);
        expect(helper.isRunning()).to.be.eql(false);
      });
    });
    describe('Status', function() {
      it('Gets service status', function() {
        const helper = new ServiceTestHelper();
        helper.install();

        expect(helper.isRunning()).to.be.eql(false);
        let result = helper.namiExec(`status ${helper.id}`, {abortOnError: false});
        expect(result.status).to.be.eql(1);
        expect(result.stdout).to.match(/not running/);

        helper.start();

        expect(helper.isRunning()).to.be.eql(true);
        result = helper.namiExec(`status ${helper.id}`, {abortOnError: false});
        expect(result.status).to.be.eql(0);
        expect(result.stdout).to.match(/is running/);

        helper.cleanUp();
      });
      it('A non-initialized service status returns non-zero exit code', function() {
        const helper = new ServiceTestHelper();
        helper.unpack();

        const result = helper.namiExec(`status ${helper.id}`, {abortOnError: false});
        expect(result.status).to.be.eql(5);
        expect(result.stderr).to.match(
            /not fully installed. You cannot execute commands/
        );
        helper.cleanUp();
      });
    });
  });
  describe('Install packages', function() {
    let h = null;
    let sb = null;
    beforeEach(function() {
      sb = new Sandbox();
      h = getNewNamiHandler(sb);
    });
    it('Installs a sample package with default installdir', function() {
      const pkgDir = copySamplePackage('demo_package');
      const expectedInstalldir = sb.normalize('/opt/bitnami/demo_package');
      expect(expectedInstalldir).to.not.be.a.path();
      h.namiExec(`install ${pkgDir}`);
      expect(expectedInstalldir).to.be.a.directory();
      expect(path.join(expectedInstalldir, 'steps.txt')).to.be.a.file();
    });
    it('Installs a sample package with custom installdir', function() {
      const pkgDir = copySamplePackage('demo_package');
      const prefix = sb.normalize('/bitrock/apps');
      const expectedInstalldir = `${prefix}/demo_package`;
      expect(expectedInstalldir).to.not.be.a.path();
      h.namiExec(`install --prefix=${prefix} ${pkgDir}`);
      expect(expectedInstalldir).to.be.a.directory();
      expect(path.join(expectedInstalldir, 'steps.txt')).to.be.a.file();
    });
    it('Returns 1 if postInstallation fails', function() {
      const pkgDir = copySamplePackage('erroneus-postInstallation');
      const result = h.namiExec(`install ${pkgDir}`, {abortOnError: false});
      expect(result.status).to.be.eql(1);
    });
    describe('Installs a sample package with options', function() {
      let pkgDir = null;
      let expectedInstalldir = null;
      const options = {
        password: 'bitnami', force: true
      };

      beforeEach(function() {
        const pkgId = 'parameters-test';
        pkgDir = copySamplePackage(pkgId);
        expectedInstalldir = sb.normalize(`/opt/bitnami/${pkgId}`);
      });
      function validateOptions(installdir) {
        const optionsFile = path.join(installdir, 'options.json');
        expect(optionsFile).to.be.a.file();
        const data = JSON.parse(fs.readFileSync(optionsFile));
        expect(data).to.containSubset(options);
      }
      it('Installs a sample package with options in standard format', function() {
        const args = [];
        _.each(options, (val, key) => args.push(`--${key}=${val}`));
        h.namiExec(`install ${pkgDir} ${args.join(' ')}`);
        validateOptions(expectedInstalldir);
      });
      it('Installs a sample package with options provided in inputs-file', function() {
        const inputsFile = sb.write('inputs-file.json', JSON.stringify(options));
        h.namiExec(`install ${pkgDir} --inputs-file ${inputsFile}`);
        validateOptions(expectedInstalldir);
      });
      it('Installs a sample package with options provided in inputs-file with env vars', function() {
        const newOptions = {};
        const envVars = [];
        _.each(options, (val, key) => {
          const tmpVarName = _.uniqueId('ENV_VAR_');
          envVars.push(tmpVarName);
          newOptions[key] = `{{$global.env.${tmpVarName}}}`;
          process.env[tmpVarName] = val;
        });
        const inputsFile = sb.write('inputs-file.json', JSON.stringify(newOptions));
        h.namiExec(`install ${pkgDir} --inputs-file ${inputsFile}`);
        validateOptions(expectedInstalldir);
        _.each(envVars, n => delete process.env[n]);
      });
    });
    it('Installs a sample package with options from inputs file', function() {
      const pkgId = 'parameters-test';
      const pkgDir = copySamplePackage(pkgId);
      const expectedInstalldir = sb.normalize(`/opt/bitnami/${pkgId}`);
      const options = {
        password: 'bitnami', force: true
      };
      const args = [];
      _.each(options, (val, key) => args.push(`--${key}=${val}`));

      h.namiExec(`install ${pkgDir} ${args.join(' ')}`);
      const optionsFile = path.join(expectedInstalldir, 'options.json');
      expect(optionsFile).to.be.a.file();
      const data = JSON.parse(fs.readFileSync(optionsFile));
      expect(data).to.containSubset(options);
    });

    it('Throws an error when providing a wrong argument', function() {
      const pkgDir = copySamplePackage('demo_package');
      expect(function() {
        h.namiExec(`install ${pkgDir} --foo=bar`);
      }).to.throw(/Unknown flag: --foo/);
    });
  });
});
