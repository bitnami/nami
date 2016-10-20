'use strict';

const path = require('path');
const fs = require('fs');
const Parser = require('./nami-parser');
const _ = require('nami-utils/lodash-extra.js');
const Manager = require('nami-core');
const hu = require('nami-utils');
const strftime = require('strftime');
const Logger = require('nami-logger');
const JsonParser = require('nami-core/lib/json-parser.js');
const templates = require('nami-utils/templates');
const pkgData = require('../package.json');
const hpRootDir = path.dirname(path.dirname(fs.realpathSync(__filename)));
const templatesDir = path.join(hpRootDir, 'templates');
const buildTimestamp = path.join(hpRootDir, 'timestamp');

class NamiCliApp {
  constructor(options) {
    options = _.defaults(options || {}, {logger: null});

    this._exitCode = 0;
    this.version = pkgData.version;
    this.revision = '0';
    this.builtOn = '';

    try {
      this.builtOn = hu.file.read(buildTimestamp).trim();
    } catch (e) {
      /* not-empty */
    }

    this.logger = options.logger || new Logger({
      logFile: hu.os.getTempFile(strftime('nami_%s.log')),
      logFileLevel: 7, prefix: 'nami'
    });

    hu.delegate(this, ['logToFile', 'info', 'error', 'debug', 'warn', 'trace'], this.logger);
    hu.delegate(this, {logLevel: 'level'}, this.logger);

    this.parser = new Parser({logger: this.logger, throwOnExit: true, allowProcessExit: false});
    // We do a preliminary parsing without the commands
    // populated so we can get some basic settings such as the log-level
    this.parser.parse(process.argv.slice(2), {
      abortOnUnknown: false,
      abortOnError: false,
      silent: true,
      onlyFlags: true
    });

    const managerConfiguration = _.merge({
      logger: this.logger,
      encryptionPassword: this.parser.getOptionValue('encryption-password'),
      registryPrefix: this.parser.getOptionValue('nami-prefix')
    }, this._loadNamiEnvironment({
      cfgFile: this.parser.getOptionValue('options-file'),
      noProfile: this.parser.getOptionValue('no-profile'),
      noRc: this.parser.getOptionValue('no-rc')
    }));

    this.manager = new Manager(managerConfiguration);
    // This is slow and is not yet useful. It is intended to allow providing options
    // for multiple installed packages. For example, if my package 'foo' expects
    // mysql, the population of global flags will allow passing:
    //
    // --component.mysql.password=something
    //
    // We will revisit this and its performance implications once multi-packages setup
    // is fully supported
    //
    // _.each(this.manager.listPackages(), function(pkg) {
    //   _this.parser.addGlobalFlags(pkg);
    // });

    this.parser.addOption({
      name: 'version', description: 'Nami Version',
      allowNegated: false, type: 'boolean', exitAfterCallBack: true,
      callback: () => console.log(this.versionString)
    });

    this._populateCommands();
  }

  get exitCode() {
    return this._exitCode || this.manager.exitCode;
  }

  set exitCode(value) {
    this._exitCode = value;
  }

  get versionString() {
    let text = `${this.version}-${this.revision}`;
    if (!_.isEmpty(this.builtOn)) text += ` (${strftime('%F %T', new Date(parseInt(this.builtOn, 10)))})`;
    return text;
  }

  _loadEnvironmentFile(file) {
    const config = {};
    this.debug(`Loading ${file}`);
    if (JsonParser.isJSON(file)) {
      const json = JsonParser.parse(file);
      _.each({
        'installation.prefix': 'installationPrefix',
        'encryption.password': 'encryptionPassword',
        'serialization.policy': 'serializationPolicy',
        'namiPrefix': 'registryPrefix',
        'logging.logLevel': 'logLevel'
      }, (key, jsonKey) => {
        if (_.has(json, jsonKey)) {
          this.trace(`Reading key ${jsonKey}`);
          config[key] = _.get(json, jsonKey);
        }
      });
    } else {
      this.debug('Parsing non-JSON files is still not implemented');
    }
    return config;
  }

  _loadNamiEnvironment(options) {
    options = _.opts(options, {cfgFile: null, noProfile: false, noRc: false});
    const files = [];
    if (!options.noProfile) {
      files.push('/etc/namirc');
      if (!options.noRc) {
        files.push('~/.namirc', '~/.nami.json');
      }
    }
    if (options.cfgFile) {
      files.push(options.cfgFile);
    }
    const config = {};
    _.each(files, file => {
      const normFile = hu.file.normalize(file);
      if (hu.file.exists(normFile)) {
        _.extend(config, this._loadEnvironmentFile(normFile, options));
      }
    });
    return config;
  }

  _executePkgCmd(obj, cmd) {
    const callOpts = cmd.providedArguments || [];
    const cmdOpts = cmd.getFlattenOptions({camelize: true});
    callOpts.push(cmdOpts);
    return (obj.exports[cmd.name]).apply(obj, callOpts);
  }

  _processSelectedServiceCmd(obj, cmdName, cmdOpts, appOpts) {
    const cmd = obj.parser.getCommand(cmdName);
    cmd.parseData(cmdOpts);
    if (!_.isEmpty(appOpts)) {
      obj.parser.parse(
        appOpts,
        {abortIfRequiredAndNotProvided: false}
      );
    }
    const result = this._executePkgCmd(obj, cmd);
    // If the command did not returner a proper status
    // (like when then command is manually overwritten in main.json), we manually ask for it
    const status = result || obj.status();
    return status;
  }

  _trapTerminationSignals(obj) {
    _.each(['SIGINT', 'SIGTERM'], signal => {
      process.on(signal, () => {
        try {
          obj.stop();
        } catch (e) {
          this.warn(`The service failed to stop: ${e.message}`);
        } finally {
          process.exit();
        }
      });
    });
  }
  _reportServiceCmdResult(result) {
    console.log(result.msg || result.statusOutput);
  }
  serviceStart(obj, cmdOpts, appOpts) {
    // TODO: This is a hack to make sure we do not break stacksmith containers
    // and I hate myself for doing it. The idea is to remove this after we are
    // sure the --foreground flag is in its proper place
    if (appOpts.length === 1 && appOpts[0] === '--foreground') {
      appOpts = [];
      cmdOpts.foreground = true;
      this.logger.warn(
        'Using legacy format for start command, please move the --foreground flag before the service name'
      );
    }
    const result = this._processSelectedServiceCmd(obj, 'start', cmdOpts, appOpts);

    if (cmdOpts.foreground) {
      this._trapTerminationSignals(obj);
    } else {
      this._reportServiceCmdResult(result);
    }
    return result;
  }
  serviceStop(obj, cmdOpts, appOpts) {
    const result = this._processSelectedServiceCmd(obj, 'stop', cmdOpts, appOpts);
    console.log(result.msg || result.statusOutput);
    return result;
  }
  serviceStatus(obj, cmdOpts, appOpts) {
    const result = this._processSelectedServiceCmd(obj, 'status', cmdOpts, appOpts);
    this._reportServiceCmdResult(result);
    this.exitCode = result.code;
    return result;
  }
  serviceRestart(obj, cmdOpts, appOpts) {
    const result = this._processSelectedServiceCmd(obj, 'restart', cmdOpts, appOpts);
    if (cmdOpts.foreground) {
      this._trapTerminationSignals(obj);
    } else {
      this._reportServiceCmdResult(result);
    }
    return result;
  }

  listPackagesCmd(/* options */) {
    this.debug('Installed Packages');
    const res = this.manager.listPackages();
    console.log(JSON.stringify(_.keys(res)));
  }

  execute(pkgName, options) {
    const obj = _.first(this.manager.search(pkgName));
    if (obj.lifecycle !== 'installed') {
      throw new Error(`${obj.id} is not fully installed. You cannot execute commands`);
    }
    obj.parser.parse(options.args || [], {
      abortOnUnknown: false, abortIfRequiredAndNotProvided: false
    });
    const cmd = obj.parser.selectedCommand;
    if (cmd === null) {
      return obj.parser.showHelp();
    }
    this.debug(`Executing ${pkgName} ${cmd.name}`);
    return this._executePkgCmd(obj, cmd);
  }

  _findTemplateFile(resource, options) {
    options = _.opts(options, {type: 'component', example: false});
    const type = options.type.toLowerCase();

    let searchDirs = [type, ''];

    // Prepend the same searh paths under the examples top dir
    if (options.example) {
      searchDirs = _.map(searchDirs, dir => path.join('examples', dir)).concat(searchDirs);
    }

    searchDirs = _.map(searchDirs, dir => path.join(templatesDir, dir));

    const resourceDir = searchDirs.find(dir => hu.file.exists(path.join(dir, resource)));

    if (resourceDir) {
      const resourceFile = path.join(resourceDir, resource);
      this.trace(`'${resource}' found in '${resourceFile}'`);
      return resourceFile;
    } else {
      throw new Error(`Cannot find '${resource}' in any of:\n  ${searchDirs.join('\n  ')}`);
    }
  }

  scaffold(pkg, options) {
    options = _.opts(options, {
      name: null, id: null, version: '1.0.0', revision: 0,
      type: 'Component', kind: 'template', example: false
    });

    pkg = hu.file.normalize(pkg);
    const name = options.name || options.id || path.basename(pkg);

    this.info(`Creating new nami package under ${pkg}`);

    if (hu.file.exists(pkg)) {
      if (options.force) {
        this.warn(`Overwriting files under ${pkg}`);
      } else {
        throw new Error(`Directory ${pkg} already exists`);
      }
    }
    if (options.kind !== 'template') {
      options.example = true;
    }

    hu.file.mkdir(pkg);

    const templateOpts = {
      name: name, id: options.id || name, revision: options.revision,
      version: options.version
    };

    _.each({'nami.json.tpl': 'nami.json', 'main.js.tpl': 'main.js'}, (file, template) => {
      templates.renderToFile(
        this._findTemplateFile(template, options), path.join(pkg, file), templateOpts
      );
    });
  }

  exposeManagerCmd(cmdOpts, optionsOpts) {
    const that = this;
    cmdOpts = _.defaults(cmdOpts || {}, {outputHandler: _.noop, minArgs: 1, maxArgs: 1, namedArgs: ['package']});
    const managerCmd = cmdOpts.managerCmd || cmdOpts.name;
    const outputHandler = cmdOpts.outputHandler;
    if (!this.manager[managerCmd]) {
      throw new Error(`Cannot find manager command ${managerCmd}`);
    }
    const cmd = this.manager[managerCmd].bind(this.manager);

    const namedArg = cmdOpts.namedArgs[0];

    cmdOpts.callback = function() {
      try {
        const result = cmd(this.arguments[namedArg], _.extend(
          this.getFlattenOptions({camelize: true}),
          {args: this.extraArgs}
        ));
        outputHandler(result);
      } catch (e) {
        console.error(e.message);
        that.trace(e.stack);
        that.exitCode = 1;
      }
    };
    this.parser.addCommand(cmdOpts, optionsOpts || []);
  }

  _populateCommands() {
    const manager = this.manager;
    const parser = this.parser;
    const that = this;
    this.parser.manager = manager;

    parser.addCommand({name: 'list', description: 'List Installed Packages', callback: function() {
      that.listPackagesCmd({args: this.extraArgs});
    }});


    // INSTALL CMD
    const commonInstallOpts = [
      {
        name: 'install-prefix', cliName: 'prefix', alias: 'prefix',
        description: 'Installation Prefix', defaultValue: manager.installationPrefix
      },
      {name: 'force', type: 'boolean', description: 'Force reinstallation', allowNegated: false}
    ];
    this.exposeManagerCmd({
      name: 'install',
      enableBuiltInHelp: false,
      description: 'Install a package in the system. It can be a directory or a zip file.'
    }, commonInstallOpts);

    // No post installation
    this.exposeManagerCmd({
      name: 'unpack',
      description: 'Install package without performing its post-installation (only unpack files)'
    }, commonInstallOpts);

    this.exposeManagerCmd({name: 'uninstall', description: 'Uninstall a package'});


    parser.addCommand({
      name: 'test', description: 'Test an already installed package',
      namedArgs: ['pkgName'],
      minArgs: 1, maxArgs: 1,
      callback: function() {
        try {
          const options = this.getFlattenOptions({camelize: true});
          const exclude = (options.exclude || '').split(';');
          const include = (options.include || '*').split(';');
          let grep = null;
          if (!_.isEmpty(options.grep)) {
            try {
              grep = new RegExp(options.grep);
            } catch (e) {
              that.warn('Invalid pattern provided. Ignoring it');
              that.trace(e.message);
            }
          }
          manager.test(this.arguments.pkgName, function(failures) {
            if (failures > 0) {
              process.exit(1);
            }
          }, {
            testDir: options.testDir,
            include: include,
            exclude: exclude,
            grep: grep,
            reporter: options.reporter,
            fileReporter: options.fileReporter,
            reportFile: options.reportFile
          });
        } catch (e) {
          console.log(e.message);
          that.trace(e.stack);
          that.exitCode = 1;
        }
      }
    }, [
      {name: 'test-dir', description: 'Directory containing the tests to execute'},
      {name: 'grep', description: 'Only execute tests matching the provided regular expression', defaultValue: ''},
      {
        name: 'include',
        description: 'Semicolon-separated list of patterns to match against the list of test files for inclusion',
        defaultValue: '*'
      },
      {
        name: 'exclude',
        description: 'Semicolon-separated list of patterns to match against the list of test files for exclusion',
        defaultValue: ''
      },
      {
        name: 'reporter',
        defaultValue: 'spec',
        description: 'Format used for mocha tests report printed to the standard output',
        type: 'choice', validValues: ['spec', 'json', 'xunit'], canBeEmpty: false
      },
      {
        name: 'file-reporter',
        defaultValue: 'xunit',
        description: 'Format used for mocha tests report printed to a file',
        type: 'choice', validValues: ['spec', 'json', 'xunit'], canBeEmpty: true
      },
      {
        name: 'report-file', description: 'File where the tests report will be written'
      }
    ]);

    // Only post installation
    this.exposeManagerCmd({
      name: 'initialize', managerCmd: 'initializePackage',
      description: 'Initialized a previously unpacked packaged (run its post-installlation steps)'
    }, [
      {name: 'force', type: 'boolean', description: 'Force re-initialization of an already initialized package'}
    ]);

    parser.addCommand({
      name: 'console', description: 'Opens the interactive nami console',
      secret: true, namedArgs: ['pkgName'],
      minArgs: 0, maxArgs: 1,
      callback: function() {
        try {
          manager.console(
            this.arguments.pkgName,
            _.extend(this.getFlattenOptions({camelize: true}), {args: this.extraArgs})
          );
        } catch (e) {
          console.log(e.message);
          that.trace(e.stack);
          that.exitCode = 1;
        }
      }
    });

    parser.addCommand({
      name: 'eval', description: 'Execute file in nami environment', secret: true,
      namedArgs: ['file'],
      minArgs: 1, maxArgs: 1,
      callback: function() {
        manager.evalFile(
          this.arguments.file,
          _.extend(this.getFlattenOptions({camelize: true}), {args: this.extraArgs})
        );
      }
    }, [
      {
        name: 'package',
        defaultValue: null,
        description: 'Instead of the global context, invoke in the context of the provided package'
      }
    ]);

    parser.addCommand({
      name: 'new', description: 'Creates a new nami package template',
      minArgs: 1, maxArgs: 1, namedArgs: ['package'],
      callback: function() {
        that.scaffold(
          this.arguments.package, this.getFlattenOptions({camelize: true})
        );
      }
    }, [
      {name: 'force', type: 'boolean'},
      {name: 'name', defaultValue: null},
      {name: 'id', defaultValue: null},
      {name: 'version', defaultValue: '1.0.0'},
      {
        name: 'kind',
        defaultValue: 'template',
        description: 'Kind of skeleton to use',
        type: 'choice',
        validValues: ['template', 'detailed', 'full']
      },
      {
        name: 'type',
        defaultValue: 'Component',
        type: 'choice',
        validValues: ['DatabaseService', 'Service', 'Component'],
        description: 'Kind of component to package'
      }
    ]);


    parser.addCommand({
      name: 'execute', description: 'Execute one of the package exported commands',
      minArgs: 1, maxArgs: 1, namedArgs: ['package'],
      callback: function() {
        try {
          const result = that.execute(this.arguments.package, _.extend(
            this.getFlattenOptions({camelize: true}),
            {args: this.extraArgs}
          ));
          console.log(JSON.stringify(result, null, 2));
        } catch (e) {
          console.log(e.message);
          that.trace(e.stack);
          that.exitCode = 1;
        }
      }
    });


    const serviceCmds = {};
    const serviceMethods = {
      start: 'serviceStart', stop: 'serviceStop',
      restart: 'serviceRestart', 'status': 'serviceStatus'
    };
    _.each({
      start: 'Start service', stop: 'Stop service',
      restart: 'Restart service', status: 'Get service status'
    }, function(description, name) {
      const serviceMethodName = serviceMethods[name];
      const cmd = that[serviceMethodName].bind(that);
      serviceCmds[name] = parser.addCommand({
        name: name, description: description,
        minArgs: 1, maxArgs: 1, namedArgs: ['service'],
        callback: function() {
          const serviceName = this.arguments.service;
          const obj = _.first(manager.search(serviceName));
          if (!_.contains(hu.getInheritanceChain(obj), 'Service')) {
            throw new Error(`Service commands are only supported for services`);
          }
          if (obj.lifecycle !== 'installed') {
            throw new Error(`${obj.id} is not fully installed. You cannot execute commands`);
          }
          return cmd(obj, this.getFlattenOptions({camelize: true}), this.extraArgs);
        }
      });
    });

    _.each(['start', 'restart'], function(name) {
      serviceCmds[name].addOption({name: 'foreground', type: 'boolean'});
    });

    this.exposeManagerCmd({
      name: 'refresh', managerCmd: 'refreshMetadata', secret: true,
      desciption: 'Update package metadata files from source dir'
    });

    parser.addCommand({
      name: 'inspect', description: 'Inspect installer package metadata',
      namedArgs: ['pkgName'],
      minArgs: 1, maxArgs: 1,
      callback: function() {
        try {
          const result = manager.inspectPackage(this.arguments.pkgName);
          console.log(JSON.stringify(result, null, 2));
        } catch (e) {
          console.log(e.message);
          that.trace(e.stack);
          that.exitCode = 1;
        }
      }
    });
  }

  parse(args) {
    this.parser.parse(args);
  }

  exec(options) {
    options = _.defaults(options || {}, {args: null});
    const args = options.args || process.argv.slice(2);
    try {
      this.parse(args);
    } catch (e) {
      if (e instanceof Parser.ParserExit) {
        if (e.exitCode !== 0) this.error(e.message);
        this.exitCode = e.exitCode;
        return e.exitCode;
      }
      if (e instanceof Parser.ParserError) {
        if (e.showHelp) {
          this.parser.showHelp({throw: false});
        }
        this.exitCode = 1;
      }
      this.error(e.message);
      this.trace(e.stack);
      return this.exitCode;
    }
    const cmd = this.parser.selectedCommand;
    if (!cmd) {
      this.parser.showHelp({throw: false});
    } else {
      // Cmd was not already handled")
      if (cmd.callback === null) {
        this.trace(`Possibly unhandled command ${cmd.name}`);
      }
    }
    return 0;
  }
}

module.exports = NamiCliApp;
