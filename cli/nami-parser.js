'use strict';

const _ = require('lodash');

const parserModule = require('cmd-parser');
const Parser = parserModule.Parser;
const ParserError = parserModule.ParserError;
const ParserExit = parserModule.ParserExit;

class NamiParser extends Parser {
  constructor(options) {
    options = _.defaults(options || {}, {logger: null});
    super(options);
    this.manager = null;
    this.toolName = 'nami';
    this.componentOptions = {};
    if (options.logger) {
      this.addOption({
        name: 'log-level',
        description: 'Configures the verbosity of nami messages',
        defaultValue: 'info', type: 'choice',
        hiddenValidValues: ['trace1', 'trace2', 'trace3', 'trace4', 'trace5', 'trace6', 'trace7', 'trace8'],
        allowedValues: ['trace', 'debug', 'info', 'warn', 'error', 'silent'],
        allowNegated: false, callback: function() { options.logger.level = this.value; },
        envvar: 'NAMI_LOG_LEVEL'
      });
    }
    // The manager uses this information sooner than the parser process the command line.
    // Maybe we could create another parser?
    this.addOption({
      name: 'nami-prefix',
      description: 'Nami Prefix',
      envvar: 'NAMI_PREFIX'
    });

    this.addOption({
      name: 'encryption-password',
      secret: true,
      type: 'password'
    });
    this.addOption({
      name: 'options-file',
      description: 'Provide JSON options file with basic nami configuration options',
      envvar: 'NAMI_CONFIG_FILE'
    });
    this.addOption({
      name: 'no-profile',
      description: 'Do not read system wide startup files or any of the personal initialization files',
      type: 'boolean',
      allowNegated: false
    });
    this.addOption({
      name: 'no-rc',
      description: 'Do not read any of the prersonal initialization files',
      type: 'boolean',
      allowNegated: false
    });
  }

  addGlobalFlags(obj) {
    const that = this;
    _.each(obj.getOptions(), function(opts, key) {
      const globalName = `component.${obj.id}.${key}`;
      const optionOpts = _.defaults({
        name: globalName,
        required: false,
        envvar: globalName.toUpperCase().replace(/\./g, '_'),
        secret: true
      }, opts);
      const option = that.addOption(optionOpts);
      option.callback = function() {
        let value = null;
        if (this.envvar && _.has(process.env, this.envvar)) {
          value = process.env[this.envvar];
        } else {
          value = option.value;
        }
        obj[key] = value;
      };
    });
  }
}
NamiParser.ParserError = ParserError;
NamiParser.ParserExit = ParserExit;
module.exports = NamiParser;
