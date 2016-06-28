# Introduction

Nami is a synchronous node-based command line tool designed to ease the installation and ongoing management of packages.

<!-- # TODO: Installation -->
<!-- # TODO: Configuration -->

# Basic commands

Nami provides different ways of operation through its multiple cli commands, all of them following the format:

```bash
$> nami [<global-options> | <command> [<command-options> [<command-arguments>]]]
```

* `<global-options>`: Global Nami options that are not specific to any particular sub-command.
* `<command>`: Command to execute.
* `<command-options>`: Options related to the command being executed.
* `<command-arguments>`: Command-specific arguments.

Lets see the different parts in a real command:

```bash
$> nami --log-level=trace install --force --prefix=/opt/bitnami ./sample-package
```

In the above example, the different parts would be:

* `<global-options>`: `--log-level=trace`, setting the verbosity of the log to trace.
* `<command>`: `install`, sub-command used to install packages.
* `<command-options>`: `--force --prefix=/opt/bitnami`. Provides the installation prefix and forces the reinstallation of the package.
* `<command-arguments>`: `./sample-package`. Install expects the path to the package to install as an argument.

Although we will be providing a detailed explanation of the most important commands, you can always get a quick summary of them using the help menu:



```
$> nami --help
nami --help

Usage: nami <options> <command>

 where <options> include:
...
And <command> is one of: list, install, unpack, uninstall, test, initialize, new, execute, start, stop, restart, status, inspect

To get more information about a command, you can execute:

   nami <command> --help
```

```
$> nami install --help
Install a package in the system. It can be a directory or a zip file.

Usage: install <options> <package>

 where <options> include:

--help                                                       Display this help menu

--prefix <prefix>                                            Installation Prefix
                                                             Default: /opt/bitnami

--force                                                      Force reinstallation
```

## list

List the installed packages in the system:

```
$> nami list
["com.bitnami.mariadb","com.bitnami.nginx", "com.bitnami.apache"]
```

The result is returned in JSON format so it is easily parseable by external tools.


## inspect

Provide information of an installed package in JSON format:

```
$> nami inspect com.bitnami.mariadb
{
  "id": "com.bitnami.mariadb",
  "name": "mariadb",
  "version": "5.5.46",
  "revision": "0",
  "installedAsRoot": true,
  "lifecycle": "installed",
  "installdir": "/opt/bitnami/mariadb",
  "installPrefix": "/opt/bitnami",
  "values": {
    "mariadbPort": 3306
  },
  "extends": [
    "Service"
  ],
  "environment": {},
  "exports": [
    "start",
    "restart",
    "stop",
    "log",
    "status"
  ]
}
```
The returned metadata includes basic settings provided in the `nami.json` file such as the `id`, `name` and `version` as well as information about the current state:

* `installedAsRoot`: Specifies if the package was installed with root privileges)
* `lifecycle`: The current installation state. A package is only fully functional in the `installed` state.
* `installdir`: Directory containing the application files. It corresponds to the `$app.installdir` variable.
* `installPrefix`: Main installation prefix which contains the installdir.
* `values`: The current package properties and values. Passwords are not serialized by default.
* `extends`: Which kind of package is it ([Supported Package Types](#supported-package-types)).
* `exports`: The package supported commands.

## install

Installs a package. The generic installation command is:

```
$> nami install [<install-options>] <path-to-package> [<package-options>]
```

* `<install-options>`: Allows tweaking the installation process. The min supported options are `--prefix` (configures the installation directory, defaults to `/opt/bitnami`) and `--force` (forces reinstallation of an already installed package).
* `<path-to-package>`: Path to a directory containg the package to install.
* `<package-options>`: Options passed to the package. Packages can define these inputs in its `nami.json` file. You can can find a detailed explanation of how to do it in the [Package Inputs](#package-inputs) section.

In the case of the `mariadb` package, it would look like:

```
$> nami install --prefix /opt/binami ~/bitnami-mariadb --password=bitnami --port=3306
nami INFO  Installing /home/bitrock/bitnami-mariadb
nami INFO  com.bitnami.mariadb successfully installed into /opt/bitnami/mariadb
```

If you try to execute the above command twice, you get get an error:

```
$> nami install --prefix /opt/binami ~/bitnami-mariadb --password=bitnami --port=3306
nami INFO  Installing /home/bitrock/bitnami-mariadb
Package com.bitnami.mariadb seems to be already installed
```

But you can force the re-installation using the `--force` flag:

```
$> nami install --prefix /opt/binami ~/bitnami-mariadb --password=bitnami --port=3306
nami INFO  Installing /home/bitrock/bitnami-mariadb
nami WARN  Reinstalling package com.bitnami.mariadb
nami INFO  com.bitnami.mariadb successfully installed into /opt/bitnami/mariadb
```

## unpack

Unpacks a package. It will perform an standard installation but it will stop right before the `postInstallation` [hook](#hooks). It will also ignore required parameters not provided. An unpacked package does not allow executing any command or be used by other packages until it is not "initialized". Its syntax is very similar to the `install` command:

```
$> nami unpack [<install-options>] <path-to-package> [<package-options>]
```

Although it does support passing options to the package being unpacked, as the command is intended to perform a generic installation that will be later on particularized, required options will not make the process fail as they would do in a regular `install` command:

```
# Fails to install because password is required
$> nami install ./bitnami-mariadb
nami INFO  Installing /home/bitrock/bitnami-mariadb
The following options are required: password

# Unpack does not fail with missing required parameters
$> nami unpack ./bitnami-mariadb
nami INFO  Unpacking /home/bitrock/bitnami-mariadb
nami INFO  mariadb successfully unpacked into /opt/bitnami/mysql
```

## initialize

Finish a previous unpacked installation. It will only perform the `postInstallation` [hook](#hooks). Combining `unpack` + `initialize` in two separated steps is equivalent to `nami install`. After unpacking the package, it is already registered in the system, you won't need it source to initialize it, only to refer it by id or name. Its syntax is:

```
$> nami initialize [<initialize-options>] <package-id-or-name> [<package-options>]
```

Where `<initialize-options>` only currently supports the `--force` flag, which will re-initialize an already fully installed package.

In the case of the `mariadb` example:

```
$> nami initialize com.bitnami.mariadb --password=bitnami
```

Please note that the `initialize` command does not reference a directory containing the package anymore, it references the package id (or name), as it is already known to the system.

Also, despite the `unpack` command, that does not validate all the required parameters are provided, they will be validated when using `initialize`:

```
$> nami initialize com.bitnami.mariadb
nami INFO  Initializing mariadb
The following options are required: password
```

## uninstall

Removes a previously installed package:

```
$> nami uninstall <package-id-or-name>
```

This will remove all the copied files as well as execute the [uninstallation hooks](#uninstallation-hooks).

To remove the installed `mariadb` package:

```
$> nami uninstall com.bitnami.mariadb
```

## new

Create a new package template. This command is intended to make the creation of new packages easier:

```
$> nami new --id "com.bitnami.sample" sample_package
nami INFO  Creating new nami package under /home/bitrock/sample_package
$> tree sample_package
sample_package
|-- nami.json
`-- main.js
```

You can configure which kind of package you are creating (the `extends` property) through the `--type` flag. For example, to create a service, you should start with:

```
$> nami new --id "com.bitnami.mariadb" --type Service ./bitnami-mariadb
```

This will create a very basic service-like package.

You can also use the `--kind` flag to configure the complexity of the generated package. By default it is set to `template`, that creates a minimal example, but you can set it to `full` and get a much more complicated one.

## execute

Looks for the specified installed package and executes one of its exported commands:

```bash
$> nami execute mariadb createDatabase --owner bitnami wordpress_db
```

The above example executes the `createDatabase` command of `mariadb` to create a database named `wordpress_db` and will grant permissions to the `bitnami` user. We will explain how to export commands in the [Exposing Commands](#exposing-commands) section but a basic example achieving it would look like:

```json
{
  "id": "com.bitnami.mariadb",
  "name": "mariadb",
  ...
  "exports": {
    "createDatabase": {
      "arguments": ["databaseName"],
      "options": {
        "owner": {"default": "root"}
      }
    }
  }
}
```

## test

<!-- TODO: Add more examples of calls here -->

Allows to execute your package tests

```
$> nami test mariadb
nami INFO  Testing com.bitnami.mariadb

  Database creation
    ✓ Creates Databases
    ✓ Creates Databases granting permissions


  2 passing (10ms)
```


You can learn how to create tests for your application in the [Testing your packages](#testing-your-packages) section.

## console

Opens an interactive nami console that exposes all the built-in packages ($file, $os, $net...). There are two __modes of operation__:

* __Global console__: A global console with the `$manager` object available, which allows you to list all the installed packages as well as full access to them

```
$> nami console
nami> const php = $manager.findByID('com.bitnami.php')
nami> php.version
'5.5.30'
```

* __Package console__: A specific console for the requested package, exposed as `$app`.

In many of the examples in this guide, whenever you see the `nami>` prompt, we will be using the console (the __package console__ in most of them).

```
$> nami console php
nami> $app.id
'com.bitnami.php'
nami> $app.version
'5.5.30'
...
```

You can find additional information in the [Interactive Console](#interactive-console) section.

## eval

Executes a JavaScript file in the nami context.

It can execute scripts in the __global__ context:

```javascript
// sample.js
const _ = require('lodash');
const lines = [];

_.each($manager.listPackages(), function(pkg) {
   lines.push(`${pkg.name} ${pkg.version}`);
});

$file.write('/tmp/nami-packages.txt', lines.join('\n'));
console.log('Written summary file');
```

```
$> nami eval 'sample.js'
Written summary file

$> cat /tmp/nami-packages.txt
mariadb 5.5.46
cakephp 3.1.7
php 5.5.30
...
```

Or for a specific __package__ (exposed through the `$app` global variable):

```javascript
console.log(`${$app.name} ${$app.version}`);
```

```
$> nami eval --package com.bitnami.mariadb 'sample.js'
mariadb 10.1.11
```

This command is really helpful when troubleshooting errors while developing your modules without having to uninstall + install for every change.

## start / stop / restart / status

<!-- TODO: Change this section to service related commands and create individual sections for them separately. Explain --foreground, the exit code in status... -->

These commands are only supported by Service-type packages and allow starting, stopping or getting their status:

```bash
$> nami status mariadb
com.bitnami.mariadb not running

$> nami start mariadb
com.bitnami.mariadb started

$> nami status mariadb
com.bitnami.mariadb is running

$> nami stop mariadb
com.bitnami.mariadb stopped

$> nami restart mariadb
com.bitnami.mariadb restarted
```

# Packages

Nami packages allow you to define an installation procedure for your applications using a high level language and easy to learn structure.

A nami package is defined by some __metadata__ defining its basic properties and capabilities, the __logic__ implementing those capabilities as well as installation steps, and a set of __files__ to be copied at install time.

## Package structure

A sample package structure looks like:

```
$> tree sample_package
sample_package
|-- nami.json
|-- main.js
|-- helpers.js
|-- test
|   |-- connectivity.js
|   `-- main-tests.js
|-- templates
|   |-- conf
|       `-- file.conf.tpl
`-- files
    |-- docs
    |   `-- README
    |-- conf
    |   `-- default.conf
    `-- bin
        `-- run
```

### nami.json

This file defines the package __metadata__. It includes basic information such as a name, version and unique id, as well as other settings defining package custom properties and supported commands (exposed through command line as well as JavaScript). This is the __only required file__ to define a package (you can find how this file can be useful just by itself in the [Wrapping a Linux Service](#wrapping-a-linux-service-in-a-nami-package) section).

```json
{
  "id": "com.bitnami.mariadb",
  "name": "mariadb",
  "extends": ["Service"],
  "revision": 1,
  "author": {"name": "Your Company", "url": "https://example.com"},
  "version": "5.5.46",
  "properties": {
    "password": {"type": "password", "description": "Root user Password"},
    "port": {"description": "Port"},
    ...
  },
  "exports": {
    "createDatabase": {
      "arguments": ["databaseName"],
      "options": {
        "owner": {"default": "root"}
      }
    }
  },
  "service": {
    ...
  },
  "installation": {
    ...
  }
}
```

### main.js / helpers.js

These files contain the package __logic__. This logic may be used to define how the package will be installed (through [Installation Hooks](#installation-hooks)). It can also be used to implement [package commands](#exposing-commands), available after finishing the installation (such as adding a new user to WordPress).

Although is only a recommendation, `main.js` is intended to be as clean as possible, defining mainly "public" commands and installation hooks, while `helpers.js` is intended to contain all those accessory functions used in `main.js`.

And example would be:

```javascript
// main.js

// Define install hooks
$app.postInstallation = function() {
  $app.helpers.initializeMariaDB();
}

// Expose exported commands
$app.exports.createDatabase = $app.helpers.createDatabase;
```

```javascript
// helpers.js

$app.helpers.initializeMariaDB = function() {
 ...
 $os.runProgram('scripts/mysql_install_db', [`--defaults-file=${$app.service.confFile}`]);
 ...
};

$app.helpers.mysqlExecute = function(query, options) {
 ...
 return $os.runProgram('bin/mysql', cmdOpts);
};

$app.helpers.createDatabase = function(name, options) {
 ...
 $app.helpers.mysqlExecute(`CREATE DATABASE ${name}`);
 ...
};

```

### files/

This is the folder containing the files to be unpacked at install time. By default, all files located under `files/` will be copied into the selected installation directory but this behavior can be tweaked. You will find more information in the [Packing Files](#packing-files) section.

### templates/

Folder containing [_handlebar_](http://handlebarsjs.com/) template files. When installing, this folder is saved in the nami registry so they will be also available to on-going package commands. This directory will be  automatically searched for templates by name.

The templates are rendered using the [`$hb`](#hb) built-in package (a convenient wrapper around _handlebars_):

```
// Render a template located in the templates folder by providing a relative path
nami> $hb.render('conf/file.conf.tpl', {port: '8000'}})
'[Connection]\nport=8000\n'
```

Apart form those in the `templates/` directory, you can render any template by path:

```
# hello template
Hello to {{to}}!
```

```
// Render by providing a specific path
nami> $hb.render('/tmp/hello.tpl', {to: 'you'}})
'# hello template\nHello to you!\n\n'
```

### test/

Application tests are placed inside this directory. They will be accesible after the application has been installed through the `nami test` command.

You can find additional information in the [Testing your packages](#testing-your-packages) section.

## Supported Package Types

All packages must define which kind of component they are extending. Depending of this type, they will need to support some functionalities and will get some extra behavior.

The type of a package is configured through the `extends` key in `nami.json`:

```json
{
  ...
  "extends": ["Component"],
  ...
}
```

The currently supported values are [Component](#component-type) (the default type) and [Service](#service-type).


### Component type

This type is the most basic one. Is also the default one if `extends` is not defined. This basic type includes the basic package functionaly. It allows packing files, installation logic and supports intputs and exporting commands. We have seen its structure in most of the examples:

```json
{
  "id": "com.bitnami.sample",
  "name": "com.bitnami.sample",
  "extends": ["Component"],
  "revision": 1,
  "author": {"name": "Your Company", "url": "https://example.com"},
  "version": "1.0.0",
  "properties": {
  },
  "exports": {
  },
  "installation": {
  }
}
```

### Service Type

The [Service](#service-type) type is an extension of the basic [Component](#component-type). It requires defining some extra metadata in the `nami.json` file and in exchange, nami will add some more functionality to the package. Services support the additional commands `start`, `stop`, `restart`, `status` and `log`. They also support some new built-in attributes: `$app.logFile`, `$app.confFile`, `$app.pidFile`, `$app.socketFile` (all of them supporting handlebar templates resolution):


```json
{
  "id": "com.bitnami.nginx",
  ...
  "extends": ["Service"],
  ...
  "service": {
    "pidFile": "{{$app.tmpDir}}/nginx.pid",
    "ports": ["80", "443"],
    "logFile": "{{$app.logsDir}}/access.log",
    "socketFile": "{{$app.tmpDir}}/nginx.sock",
    "confFile": "{{$app.confDir}}/nginx.conf",
    "start": {
      "timeout": 10,
      "username": "root",
      "command": "{{$app.installdir}}/sbin/nginx"
    }
  }
}
```

If the package states that extends `Service` but does not define the `service` section, nami will complain:

```
Error loading metadata: child "service" fails because ["service" is required]
```

It will also fail if you provide the section but do not extend `Service`:

```
Error loading metadata: "service" is not allowed
```

#### Services settings

Those settings configure some general attributes of the service object as well as providing default values for the service commands configuration.

In the next sections, we will detail all the supported settings for services and some [examples of usage](#examples).

##### pidFile

It defines the path to the service pid file. When no `stop` and `status` commands are provided, the pid will be internally used by Nami to check if the process is running and to kill it. This field is __mandatory__.

A common example is to reference it under the application temporary directory, `$app.tmpDir` (`$app.installdir/tmp`):

```json
{
  ...
  "service": {
    ...
    "pidFile": "{{$app.tmpDir}}/sample.pid"
    ...
   }
}
```

It will then be accessible as `$app.pidFile` in your JavaScript code:

```
$> nami console com.bitnami.sample
nami> $app.pidFile
'/opt/bitnami/sample/tmp/sample.pid'
```

You will also be able to retrieve its pid using the `$app.getPid` method (it will verify that the pidFile exists, and return `null` otherwise), check the service status and even stop it:

```
nami> $app.getPid()
7590
nami> $app.status()
{ isRunning: true,
  code: 0,
  statusName: 'running',
  statusOutput: 'com.bitnami.sample is running' }

nami> $app.stop()
{ isRunning: false,
  code: 1,
  statusName: 'stopped',
  statusOutput: 'com.bitnami.sample not running',
  msg: 'com.bitnami.sample stopped' }
```

##### logFile

Defines the path to the application installation log. It is used in certain commands to provide feedback about the service state (for example, `nami start --foreground sample` will start the service and tail the log). This field is __mandatory__.

It is usually referenced under the service logs directory, `$app.logsDir` (`$app.installdir/logs`):

```json
{
  ...
  "service": {
    ...
    "logFile": "{{$app.logsDir}}/sample.log"
    ...
   }
}
```

It will then be accessible as `$app.logFile` in your JavaScript code, or even get its latest entries:

```
nami> $app.logFile
'/opt/bitnami/sample/logs/sample.log'

nami> $app.log()
Starting sample...
PID: 7590
STATUS: OK
'Starting sample...\nPID: 7590\nSTATUS: OK'
```

##### socketFile

The path to the service socket file. It is optional and does not provide any extended functionaly yet. It is used mainly for convenience, to be able to access it through the `$app.socketFile` attribute


```json
{
  ...
  "service": {
    ...
    "socketFile": "{{$app.tmpDir}}/sample.sock"
    ...
   }
}
```

```
nami> $app.logFile
'/opt/bitnami/sample/tmp/sample.sock'
```

##### confFile

The path to the service configuration file. It is optional and does not provide any extended functionaly yet. It is used mainly for convenience, to be able to access it through the `$app.confFile` attribute. It is usually referenced under the service conf directory, `$app.confDir` (`$app.installdir/conf`):

```json
{
  ...
  "service": {
    ...
    "confFile": "{{$app.confDir}}/sample.cnf"
    ...
   }
}
```

```
nami> $app.confFile
'/opt/bitnami/sample/conf/sample.cnf'
```

##### ports

A list of ports expected to be available before installing.

```json
{
  ...
  "service": {
    ...
    "ports": ["80", "443"]
    ...
   }
}
```

The installation will abort if any of them is in use or if you don't have enough privileges to use them:

```
$> nami install ./bitnami-sample
Error executing 'preInstallChecks': Cannot bind to port 80. Do you have enough privileges?

$> sudo nami install ./bitnami-sample
Error executing 'preInstallChecks': Port 80 is in use. Please stop the service using it
```

Using harcoded values is not usually the best approach so you would probably need to define a customizable port property:

```json
{
  ...
  "properties": {
    "port": {"default": 80, "description": "Service Port"}
  },
  "service": {
    ...
    "ports": ["{{$app.port}}"]
    ...
   }
}
```

```
$> sudo nami install ./bitnami-sample
Error executing 'preInstallChecks': Port 80 is in use. Please stop the service using it

$> nami install ./bitnami-sample --port 8080
...
nami INFO  sample successfully installed into /opt/bitnami/sample
```

##### env

Environment variables to define before launching any of the service commands (`start`, `stop` or `restart`). Its values can reference other environment variables through the _handlerbar_ object variable `{{global.env}}`:

```json
{
  ...
  "service": {
    ...
    "env": {
       "PATH": "{{$app.installdir}}:{{$global.env.PATH}}",
       "JAVA_HOME": "{{$app.installdir}}"
    }
    ...
   }
}
```

##### username / group

The Unix username and group the executed service commands will run under:

```json
{
  ...
  "service": {
    ...
    "username": "mysql",
    "group": "mysql"
    ...
   }
}
```

#### Service commands

The main purpose of the service section is to define how the service is started and stopped, as well as how to check its state. This functionality (in conjuntion with some of the service settings such as the [pidFile](#pidFile)) is the defined through the `start`, `stop`, `restart` and `status` commands.

##### Common settings

We will individually talk about each command but first, we will define its shared structure. All the commands share the same supported settings, many of them used to overwrite the [Service Settings](#service_settings) with more specific values.

```json
{
  ...
  "service": {
    ...
    "start": {
      "command": "{{$app.binDir}}/mysqld_safe --defaults-file={{$app.confFile}}",
      "username": "mysql",
      "group": "mysql",
      "wait": 5,
      "timeout": "30",
      "workingDirectory": "{{$app.installdir}}/data",
      "env": {
        "PATH": "{{$app.installdir}}:{{$global.env.PATH}}"
      }
    }
    ...
   }
}
```

In this example, we are using the `start` command, but it applies to any of the others (updating its values appropriately).

* `command`: The command line to execute.
* `username`: Overwrites the service level value [username](#username-group)
* `group`: Overwrites the service level value [group](#username-group)
* `wait`: Fixed time in seconds to wait after the command was executed. This is useful in cases in which the service reports its status as running (for example the pid is already written) but require some additional time to be ready. It defaults to 0 seconds
* `timeout`: Max time to wait in seconds for the service to change to the required status. For example, if the service is stopped and `timeout` is set to 5 seconds, an error will be reported if the service is not running in 5 seconds. Unlike when using `wait`, the code won't wait the full timeout if the service is properly started before it reaches it. When both times are provided, the code will first wait a maximum of `timeout` seconds until the service change its status, and then the full `wait` seconds afterwards. It defaults to 30 seconds.
* `workingDirectory`: The directory from which all the commands will be executed.
* `env`: Extends (overwritting overlapped variables) the service level [env](#env)

Commands can also be defined in the JavaScript files by extending the `$app.service` hash:

```javascript
$app.service.start = function() {
    try {
       $os.runProgram(`{$app.binDir}/mysqld_safe`, `--defaults-file=${$app.confFile}`, {runInBackground: true});
    } catch(e) {
       $app.error(`Failed to start service`)
    }
    return $app.status();
}

```

In the above example we implemented our own custom start command in JavaScript and ended by returning `$app.status()`. The reason is that Nami expects a certain format to be returned when calling the different commands:

```javascript
{ isRunning: false,
  code: 1,
  statusName: 'stopped',
  statusOutput: 'com.bitnami.sample not running' }
```

When using the `nami.json` form, the result hash is automatically constructed by nami based on the current service status and the success of the executed command but if you are reimplementing it, you should either rely on a working `$app.status` to return the proper format (usually internally provided by checking the `pidFile`) or to manually return a proper hash:

* `isRunning`: Whether the service is running or not after calling the command.
* `code`: The `exit code`, `0` meaning running and `1` stopped.
* `statusName`: Status name: `running`, `stopped`, `unknown` (there is something really wrong and we cannot determine the status of the service).
* `statusOutput`: The printable status output. `sample is running`, `sample not running`...
* `msg`: This is an optional parameter intended to provide some more details about the result of the command. For example, starting a service would return `sample is already running` if it was already running and `sample started`.

For example, the above start method could be rewritten (using a very simplistic approach) as:

```javascript
$app.service.start = function() {
    try {
       $os.runProgram(`{$app.binDir}/mysqld_safe`, `--defaults-file=${$app.confFile}`, {runInBackground: true});
       return {isRunning: true, code: 0, statusName: 'running', statusOutput: `${$app.id} running`};
    } catch(e) {
       $app.error(`Failed to start service`)
       return {isRunning: false, code: 1, statusName: 'stopped', statusOutput: `Failed to start ${$app.id}`};
    }
    return $app.status();
}
```

##### start

This is the only required command. Others can be omitted by using the [pidFile](#pidfile) (killing to `stop`, ps over it for `status`...) but there is no way of doing the same to start. A basic definition would be:


```json
{
  ...
  "service": {
    ...
    "start": {
      "command": "./catalina.sh start",
      "username": "daemon",
      "group": "daemon",
      "wait": 5,
      "timeout": "30",
      "workingDirectory": "{{$app.binDir}}"
    }
    ...
   }
}
```

After calling the `command`, nami will wait a maximum of 30 seconds for the service to start (by calling `$app.status()`). If that timeout is reached before starting, an error will be thrown. If the service starts before that, nami will wait an additional 5 seconds to make sure the service had time to really start.

##### stop

This command is optional. If none is provided, the system will use the `pidFile` to kill it. It will first try to send the process the `SIGTERM` signal, and if it was not stopped after `timeout` seconds a `SIGKILL` signal will be sent.

If the service is successfully stopped, the `pidFile` will be automatically cleaned up.

##### restart

This command is rarely implemented. If it is not provided, it will be internally defined as `stop + start`.

##### status

If it is not provided, Nami will determine whether the service is running or not based on the `pidFile` (if it exists and contains a running proces is running, stopped otherwise).

If it was provided through the `nami.json`, the exit code of the launched command will be used as to determine the status of the service, `0` meaning `running` and not `0` `stopped`.

As previously mentioned, it can be also implemented in pure JavaScript by returning the proper format:

```javascript
$app.service.status = function() {
    if ($app.getPid() !== null)
       return {isRunning: true, code: 0, statusName: 'running', statusOutput: `${$app.id} running`};
    } else {
       return {isRunning: false, code: 1, statusName: 'stopped', statusOutput: `Failed to start ${$app.id}`};
    }
}
```

Of course, the above wouln't be very useful, as it is still using the `pidFile` under the hood (by calling the built-in `$app.getPid()`), which is what Nami would have done for you by default.

#### Examples

##### Wrapping a Linux service in a Nami package

This is really useful for quickly adding all the nami goodies to your already installed system services. It can be implemented as simple as:


```json
{
   "id": "com.bitnami.upstart-apache",
   "name": "upstart-apache",
   "version": "1.0.0",
   "extends": ["Service"],
   "service": {
     "pidFile": "/var/run/apache2/apache2.pid",
     "logFile": "/var/log/apache2/access.log",
     "start": {
       "command": "/etc/init.d/apache2 start"
     },
     "stop": {
       "command": "/etc/init.d/apache2 stop"
     },
     "restart": {
       "command": "/etc/init.d/apache2 restart"
     },
     "status": {
       "command": "/etc/init.d/apache2 status"
     }
   }
}
```

You don't even need JavaScript files, the `nami.json` file is enough. And you will be able to programmatically manipulate the system service and even using it from other packages as explained in the [Using other installed packages](#using-other-installed-packages) section:

```
$> sudo nami console upstart-apache
nami> $app.status()
{ isRunning: true,
  code: 0,
  statusName: 'running',
  statusOutput: 'com.bitnami.upstart-apache is running' }
nami> $app.log()
::1 - - [08/Feb/2016:18:54:21 +0100] "GET / HTTP/1.1" 200 11764 "-" "curl/7.35.0"
'::1 - - [08/Feb/2016:18:54:21 +0100] "GET / HTTP/1.1" 200 11764 "-" "curl/7.35.0"'
nami> $app.getPid()
64017
nami> $app.stop()
{ isRunning: false,
  code: 1,
  statusName: 'stopped',
  statusOutput: 'com.bitnami.upstart-apache not running',
  msg: 'com.bitnami.upstart-apache stopped' }
...
```

## Packing files

Files to be packed are defined in the `packaging` section inside `installation`:

```json
{
  ...
  "installation": {
  	"packaging": {
  	  "components": [{
       "name": "default",
       "folders": [{
         "name": "data",
         "files": [{"origin": ["files/*"]}]
        }]
      }]
  	}
  }
  ...
}
```

If `packaging` is not provided, nami will try to pack all files inside the `files/` directory in the root of your package directory (if it exists). To disable this behavior, you can simply provided an empty one:

```json
{
  ...
  "installation": {
  	"packaging": {}
  }
  ...
}
```

### Packaging Components

The files to pack are organized in components, which in turn contains folders. Both of these elements support a set of common attributes:


* `name`: The name of the component. Used to reference it programmatically
* `destination`: The directory where the packed files (if any) will be unpacked into. Child folders will inherit this value if they do not contain one. It can contain handlebar references. Also, relative paths will be resolved using the `$app.installdir` as a reference.
* `permissions`: If defined, permissions applied to the unpacked files.
* `owner`: If defined and running as root, owner of the unpacked files.
* `group`:  If defined and running as root, group of the unpacked files.
* `strip`: Allows striping the specified level of directories from the packed files. For example, packing `files` folder will end up as `{{$app.installdir}}/files` with `strip==0`. If `strip` is set to 1, if will make the contents of `files/` to be packed instead (removes the first level of the directory path, `files/`). It works similar to the `--strip-components` option of the `tar` unix command.
* `selected`: Controls whether or not the component will be installed.
* `shouldBePacked`: Controls whether or not the component will be packed (used when calling the `package` nami command).

All of these attributes but `name`, are inherited by child elements if they do not provide their own.

#### Component elements

```json
{
  ...
  "name": "default",
  "destination": "{{$app.installdir}}/data",
  "permissions": "777",
  "owner": "daemon",
  "group": "daemon",
  "strip": 0,
  "selected": true,
  "shouldBePacked": true,
  "folders": [ ... ],
  "tagOperations": {
    "data": [{
      "setPermissions": {
        "permissions": "755"
      }
    }]
  }
  ...
}
```
In addition to the common attributes, they also include the `folders` attribute, which contains an array of folders to pack.

#### Folder elements

```json
{
  ...
  "name": "data",
  "destination": "{{$app.installdir}}/data",
  "permissions": "777",
  "owner": "daemon",
  "group": "daemon",
  "strip" 0,
  "selected": true,
  "shouldBePacked": true,
  "folders": [ ... ],
  "tagOperations": {
     "data": {
       "SetPermissions": {
           "permissions": "755"
       }
     }
  }
  ...
}
```

* `name`: The name of the component. Used to reference it programmatically
* `destination`: The directory where the packed files (if any) will be unpacked into. Child folders will inherit this value if they do not contain one. It can contain handlebar references.
* `permissions`: If defined, permissions applied to the unpacked files.
* `owner`: If defined and running as root, owner of the unpacked files.
* `group`:  If defined and running as root, group of the unpacked files.
* `strip`: Allows striping the specified level of directories from the packed files. For example, packing `files` folder will end up as `{{$app.installdir}}/files` with `strip==0`. If `strip` is set to 1, if will make the contents of `files/` to be packed instead (removes the first level of the directory path, `files/`). It works similar to the `--strip-components` option of the `tar` unix command.
* `selected`: Controls whether or not the component will be installed.
* `shouldBePacked`: Controls whether or not the component will be packed (used when calling the `package` nami command).
* `folders`: Packed folders within the component.


## Package Inputs

Sometimes you will need to be able to request configuration settings either at install time or when executing package commands. To support this you will need to add inputs to your package.

Inputs are defined through the `properties` attribute, which is used to define public package properties, which can used as the mentioned inputs:

```json
{
  "id": "com.bitnami.sample",
  "name": "sample",
  ...
  "properties": {
    "propertyName": {"default": "Some default value", "description": "propertyName description"},
    "otherProperty": {"type": "boolean", "description": "otherProperty description"}
  }
  ...
}
```

For each of the keys of the `properties` hash, a new property (and input) will be defined. In this generic case, the package will now support two command line options:


```
nami install ./bitnami-sample --help
nami INFO  Installing /home/bitrock/bitnami-sample

Usage: com.bitnami.sample <options>

 where <options> include:

 ...

--propertyName <propertyName>                                propertyName description
                                                             Default: Some default value

--otherProperty                                              otherProperty description

```

They will also be available in the JavaScript code as attributes of the `$app` object:

```
$> nami console com.bitnami.sample
nami> $app.propertyName
'Some default value'
nami> $app.otherProperty
false
```

The accepted attributes for properties are:

* `value`: The current value of the property.
* `default`: The default value for the property. Returned if the is empty, undefined or null.
* `type`: The type of input. It can be: "password", "string", "boolean" and "choice". Defaults to "string".
* `validValues`: Allowed values when `type` is set to "choice".
* `required`: If enabled, the parameter must be provided at install (or initialize) time. Defaults to "false".
* `description`: Short description for the property.
* `serializable`: Controls whether the property value can be stored on disk or not. If not provided, it defaults to true in all types but password.
* `cliName`: Command line flag name (it defaults to the name).

Depending on the provided definition, specially its type, it will be represented and validated in a different way:

* __String type__: This is the default so you can skip the `type` attribute. It does not include any special handling.

```json
{
  "id": "com.bitnami.sample",
  "name": "sample",
  ...
  "properties": {
    "username": {"type": "string", "description": "Name of the user", "default": "user"}
  }
  ...
}
```

```
$> nami install sample --username bitnami
$> nami console com.bitnami.sample
nami> $app.username
'bitnami'
```

* __Boolean type__: Its value is either `true` or `false`. It defaults to false and does not require a value from command line:

```json
{
  "id": "com.bitnami.sample",
  "name": "sample",
  ...
  "properties": {
    "enable-backup": {"type": "boolean", "description": "Enables bakcups"}
  }
  ...
}
```

```
# Providing the flag set its value to true
$> nami install sample --enable-backup

# The value can be force by explicitly providing it
$> nami install sample --enable-backup=false

# Or through the `no` prefix
$> nami install sample --no-enable-backup
```

* __Choice type__: Through the `validValues` property, a set of allowed values is configured. It will reject any value outside this subset:

```json
{
  "id": "com.bitnami.sample",
  "name": "sample",
  ...
  "properties": {
    "installation-type": {
      "type": "choice", "description": "Installation type",
      "validValues": ["full", "standard", "minimal"]
    }
  }
  ...
}
```

```
nami install ./bitnami-sample --installation-type foo
nami INFO  Installing /home/bitrock/bitnami-sample
'foo' is not a valid value for 'installation-type'. Allowed: full, standard, minimal
```

* __Password type__: Password types mostly behave like the basic string type but their values are not saved after installation (by default). They will return their default value instead:

```json
{
  "id": "com.bitnami.sample",
  "name": "sample",
  ...
  "properties": {
    "password": {
      "type": "password", "description": "Application Password", "default": "bitnami"
    }
  }
  ...
}
```

```
$> nami install ./bitnami-sample --password foobar
...
$> nami console com.bitnami.sample
nami> $app.password
'bitnami'
```

This behavior can be modified by enforcing its `serializable` attribute:

```json
{
  "id": "com.bitnami.sample",
  "name": "sample",
  ...
  "properties": {
    "password": {
      "type": "password", "description": "Application Password",
      "default": "bitnami", "serializable": true
    }
  }
  ...
}
```

```
$> nami install ./bitnami-sample --password foobar
...
$> nami console com.bitnami.sample
nami> $app.password
'foobar'
```

Please note that you have to be careful with this setting, as passwords will be saved in plain text.


## Package logic

### Built-in modules

<!-- TODO: Link to the JSDoc documentation -->

To help you in writing your package logic, nami exposes a set of built-in modules. These modules are automatically available as global variables so you won't need to require them.

As nami is a synchronous tool, all of its utility functions are synchronous unless named with the `*Async` suffix.

#### $file

File maniputlation utilities (`$file.read`, `$file.write`, `$file.chown`...).


When used in the contex of a package (in your package JavaScript files), relative files are normalized based to your package installation directory:

```javascript
// If you package installation directory is /opt/bitnami/mariadb
$> nami console mariadb
nami> $file.normalize('bin')
'/opt/bitnami/mariadb/bin'

// Will write /opt/bitnami/mariadb/test.txt
nami> $file.write('test.txt', 'hello')
...
```

If you use the global context console, they will normalize based on the current working directory.

#### $os

Commands related to the operating system detection and manipulation (`$os.addUser`, `$os.addGroup`, `$os.runProgram`).


#### $net

Network related commands (`$net.isPortInUse`, `$net.canBindToPort`).

#### $crypt

Includes cryptographic functions. Is a convenience wrapper around the node crypto module.

#### $hb

It stands for HandleBars. This module allows rendering templates resolving [_handlebar_](http://handlebarsjs.com/) references.

When used in the context of an application, relative paths referencing templates will first try to be resolved inside the packed `templates/` folder.

#### $util

General purpose utils (`$util.sleep`).

### Hooks

While installing (or uninstalling) a package, Nami exposes certain points of execution that can be overwritten in the package JavaScript files.

To define one of those hooks you just need to attach them to the `$app` object:

```javascript
$app.postInstallation = function() {
   console.log('Installation finished!');
}
```

What the above code is saying is: 'After the installation of the files, execute this function I'm attaching'. Depending on the hook name, the code provided will be executed at a different point of the installation (or uninstallation) workflow.

#### Installation Hooks

This hooks are executed when calling the `nami install` command (or the `unpack` and `initialize` variants).

In order of execution:

* `$app.preInstallation`: Executed at the very beginning of the installation process. The are useful to check for pre-requisites.
* `$app.preUnpackFiles`: Executed before unpacking the files. Is useful, for example, to add users to the system that will own some of the unpacked files.
* `$app.postUnpackFiles`: Executed right after unpacking the files. Is useful to fix up permissions or create additional files or directories.
* `$app.postInstallation`: Executed after the `$app.postUnpackFiles` hook.

Some other less useful hooks worth mentioning are:

* `$app.preInstallChecks`: Some special component types provide a built-in hook to perform some initial checks at the very beginning. An example would be the Service-type, which will use it to ensure the required ports are free. This hook is rarely modified, usually just to disable the default behavior.
* `$app.installFiles`:  This hook is not usually modified as it would overwrite the default internal behavior, the file copying phase.

Looking at all the hooks you may have noticed that `$app.postInstallation` seems a little redundant having a `$app.postUnpackFiles`. The reason to have those separated is because nami allows separating the installation of a package in two steps: unpack + initialization.

In the unpack steps, all installation hooks until (inclusive) `$app.postUnpackFiles` will be executed, but not `$app.postInstallation`. The idea is to allow performing a generic pre-installation of the package without using the provided inputs. This way a future initialization will just call `$app.postInstallation`, which will be much faster:

```
# Unpack without providing any specific configuration
$> nami unpack ./bitnami-mysql/
nami INFO  Installing /home/bitrock/bitnami-mysql
com.bit INFO  Before unpacking the files
com.bit INFO  After unpacking the files
nami INFO  com.bitnami.mysql successfully installed into /opt/bitnami/mysql
```

And at some other point:

```
# Initialize the package. Move all the logic involving the specific inputs (password, port) to the `$app.postInstallation`
$> nami initialize com.bitnami.sample_service --password=bitnami --port=3306
nami INFO  Initializing com.bitnami.mysql
com.bit INFO  Running post installation
nami INFO  com.bitnami.mysql successfully initialized
```

A specific application could be used when creating Docker containers. You could add `nami unpack` to your Dockerfile and perform a `nami initialize` in the first launch, so every user will be able to provide a different set of initialization parameters without having to wait for all the files to be unpacked.

#### Uninstallation Hooks

This hooks are called when invoking the `nami uninstall` command.

In order of execution:

* `$app.preUninstallation`: Executed before removing the installed files. It is useful to perform an initial clean up such as stopping services.
* `$app.uninstallFiles`: This hook is not usually modified as would overwrite the default internal behavior, the deletion of all unpacked files.
* `$app.postUninstallation`: Executed after removing the installed files. It is useful to clean up temporary files left behind after the automatic file deletion.

## Exposing commands

A package can define a lot of internal logic used internally either at install time or after that, to perform specific tasks.

By default, all this functionality is internal to the package so it is not possible to use it by external consumers of our package (other packages or an user calling our package from command line).


To expose this functionality, you need to both explicitly list the supported capabilities in the `nami.json` file:

```json
{
  "id": "com.bitnami.mariadb",
  "name": "mariadb",
  ...
  "exports": {
    "createDatabase": {
      "arguments": ["databaseName"],
      "options": {
        "owner": {"default": "root"}
      }
    }
  }
}
```

as well as attach the function methods in the special `$app.exports` hash:

```javascript
$app.exports.createDatabase = function mariaDbCreateDatabase(databaseName, options) {
  ...
}
```

If you only declare the command in the metadata but do not actually export it in your JavaScript code, you will receive a validation error when installing your package:

```
$> nami install ./bitnami-mariadb
nami INFO  Installing /home/bitrock/bitnami-mariadb
'com.bitnami.mariadb' does not implement all the declared exports. Missing: createDatabase
```

However, if you define the method in the `$app.exports` hash but is not mentioned in the JSON file, you won't get any error, it will simply kept hidden.


Taking a deeper look to the JSON file, the generic format to define the exposed commands would be:

```json
{
  "id": "com.bitnami.sample",
  "name": "sample",
  ...
  "exports": {
    "commandName": {
      "description": "Command Description",
      "arguments": ["arg1", "arg2", "arg3"],
      "options": {
        "flag1": {
          "description": "Configures value1",
          "default": "some value", "type": "string"
        },
        "boolean_flag": {"description": "Boolean option", "type": "boolean", },
        "password_flag": {"description": "A password", "type": "password"}
      }
    },
    "otherCommand": {
      "description": "Other Command Description",
      "arguments": ["arg1", "arg2"],
      ...
    }
  }
}
```

Each key in the `exports` hash correspond to the command being exposed. For each of those command, you can specify certain attributes:

* `arguments`: An array of the supported command arguments
* `options`: A hash containing the supported flags. Each of these flags can be defined the same way inputs for the package are. You can find more information in the [Package Inputs](#package-inputs) section
* `description`: The command description

The above example would result in the below help menu:

```
$> nami execute com.bitnami.sample otherCommand --help

Other Command Description

Usage: otherCommand <options> <arg1> <arg2>

 where <options> include:

--help                                                       Display this help menu

$> nami execute com.bitnami.sample commandName --help

Command Description

Usage: commandName <options> <arg1> <arg2> <arg3>

 where <options> include:

--help                                                       Display this help menu

--flag1 <flag1>                                              Configures value1
                                                             Default: some value

--boolean_flag                                               Boolean option

--password_flag <password_flag>                              A password
                                                             Default:
```

And a possible implementation in our `main.js` file could be:

```javascript
// Options expects something like: {flag1: 'some value', 'boolean_flag': true, 'password_flag': 'bitnami'}
$app.exports.commandName = function(arg1, arg2, arg3, options) {
   console.log(`Called 'commandName' with arg1=${arg1}, arg2=${arg2}, arg3=${arg3}`, options);
}

$app.exports.otherCommand = function(arg1, arg2) {
   console.log(`Called 'otherCommand' with arg1=${arg1}, arg2=${arg2}`);
}
```

Which would lead to different outputs depending on the command line calls:

```
$> nami execute com.bitnami.sample commandName A B C
Called 'commandName' with arg1=A, arg2=B, arg3=C { flag1: 'some value', boolean_flag: false, password_flag: '' }

$> nami execute com.bitnami.sample commandName --flag1 foo --boolean_flag A B C
Called 'commandName' with arg1=A, arg2=B, arg3=C { flag1: 'foo', boolean_flag: true, password_flag: '' }

$> nami execute com.bitnami.sample otherCommand A BCalled 'otherCommand' with arg1=A, arg2=B
Called 'otherCommand' with arg1=A, arg2=B
```

## Using other installed packages

Nami packages can specify dependencies other other installed packages so they can later on be used from the JavaScript files. To illustrate this, we will define to packages, `helloworld` (the usual example) and `say` (a fancy wrapper around console.log):

* `helloworld`

```json
{
  "id": "com.bitnami.helloworld",
  "name": "helloworld",
  "revision": "0",
  "version": "1.0.0",
  "expects": ["com.bitnami.say"],
  "exports": {
    "hello": {
      "arguments": ["to"],
      "options": {
        "shout": {"type": "boolean"}
      }
    }
  }
}
```

```javascript
// main.js
const say = $modules["com.bitnami.say"].say;

$app.exports.hello = function(to, options) {
  options = options || {shout: false};
  say(`Hello world to ${to || 'you'}`, {
    capitalize: options.shout
  });
}
```

* `say`

```json
{
  "id": "com.bitnami.say",
  "name": "say",
  "revision": "0",
  "version": "1.0.0",
  "exports": {
    "say": {
      "arguments": ["msg"],
      "options": {
        "capitalize": {"type": "boolean"}
      }
    }
  }
}
```
```javascript
// main.js
$app.exports.say = function(msg, options) {
  options = options || {capitalize: false};
  console.log(options.capitalize ? msg.toUpperCase() : msg);
}
```

As you can see from the `helloworld` package definition, we have defined the dependency with `say` using the `expects` property:

```json
{
  ...
  "expects": ["com.bitnami.say"],
  ...
}
```
You could also provide a hash in the form:

```json
{
  ...
  "expects": {"com.bitnami.say": "printer"},
  ...
}
```

Which will make the `com.bitnami.say` package available as `printer` (or any other arbitrary non-repeated identifier) instead. In that case, you would reference it as:

```javascript
$modules['printer'].say();
```

If you try to install it before the `say` package, you will receive an error:

```bash
$> nami install ./bitnami-hello/
nami INFO  Installing /home/bitrock/bitnami-hello
Error loading module requirements: Cannot find any module matching the provided specification 'com.bitnami.say'
```

You will then need to install `say` first:

```bash
$> nami install ./bitnami-say/
nami INFO  Installing /home/bitrock/bitnami-say
nami INFO  say successfully installed into /opt/bitnami/say

$> nami install ./bitnami-hello/
nami INFO  Installing /home/bitrock/bitnami-hello
nami INFO  helloworld successfully installed into /opt/bitnami/helloworld
```

Now you can use the `hello` command. Either from command line:

```bash
$> nami execute helloworld hello --shout bitnami
HELLO WORLD TO BITNAMI
```

Or from the console:

```
$> nami console helloworld
nami> $app.exports.hello('bitnami', {shout: true})
HELLO WORLD TO BITNAMI
```

## Testing your packages

Is a good practice to include tests in your package to ensure it is in good shape after installation. To define those tests, you just need to create a folder named `test` in your package directory and all `.js` files contained within will be searched for test declarations:

```
$> tree sample_package
sample_package
|-- nami.json
|-- main.js
`-- test
    `-- common.js
```

In the above example, our application tests are defined in the `test/common.js` file. Nami supports tests written using the [Mocha](https://mochajs.org/) framework together with the [Chai](http://chaijs.com/) assertion library. They will look similar to the below snippet:

```javascript
describe('Required files', function() {
  it('Includes all the required files', function() {
    _.each(['README', 'LICENSE', 'bin/gui', 'bin/cli', 'lib/common.so'], function(file) {
      expect($file.normalize(file)).to.be.a.path();
    });
  });
  it('Has executable permissions set on the binaries', function() {
    _.each(['bin/gui', 'bin/cli'], function(file) {
      expect($file.executable(file)).to.be.eql(true);
    });
  });
});

describe('Basic functionality', function() {
  describe('Modules', function() {
    it('Includes core module', function() {
      expect($os.runProgram('bin/cli', 'list-modules')).to.contain(/core/);
    });
  });
  it('Reports the proper version', function() {
    expect($os.runProgram('bin/cli', '--version').trim()).to.be.eql($app.version);
  });
});

```

And are executed (after the application is installed) through the `nami test` command:

```
$> nami test sampleapp
nami INFO  Testing com.bitnami.sample

  Required files
    ✓ Includes all the required files
    ✓ Has executable permissions set on the binaries

  Basic functionality
    ✓ Reports the proper version
    Modules
      ✓ Includes core module

  4 passing (8ms)

```

Basically, `describe` is using to group tests (and can be nested), and `it` is used to define the actual tests. Then you can use `expect` to perform multiple assertions. You can find more information in [https://mochajs.org](https://mochajs.org/) and [http://chaijs.com](http://chaijs.com/).

When defining your tests, apart from mocha and chai, you will have access to all the nami built-in packages and the application object through the `$app` variable. The exact same environment you get in the `main.js` and `helpers.js` files. In addition, you will also have access to the `$test` module, which, for now, only exports the `Sandbox` class, which allows easily handling the creating and cleaning up of sample files for your tests.

<!-- TODO: Do we need to document Sandbox here? -->

The `nami test` command also supports some command line options that make it even more powerful.

By default, tests are searched in the `test/` special dir (which is saved after installing the package) but you can also point nami to look inside a different directory with the `--test-dir` option:

```bash
$> nami test --test-dir ~/other-tests/ sampleapp
```

You can also provide patterns to include and exclude the execution of certain test files using `--include` and `--exclude`. For example, we can execute an specific test file:

```bash
$> nami test --test-dir ~/other-tests/ --include '*/optional.js' sampleapp
```

Or exclude one:

```bash
$> nami test --test-dir ~/other-tests/ --exclude '*/optional.js' sampleapp
```

You can even only execute tests (or groups of tests) only matching a certain pattern using `--grep`:

```bash
$> nami test --grep 'Reports the proper version' sampleapp
nami INFO  Testing com.bitnami.sample

  Basic functionality
    ✓ Reports the proper version

  1 passing (7ms)

```

## Creating your first Package

A minimal nami package would be as simple as writing a nami.json file with contents (even if it won't do much):

```json
{
  "id": "com.bitnami.sample",
  "name": "sample_package",
  "version": "1.0.0"
}
```

But there is a better way of starting up with a package template:

```
$> nami new --id "com.bitnami.sample" sample_package
```

Which will result in a folder named `sample_package` with a `nami.json` and `main.js` template files inside ready to be extended.

`nami.json` will contain a slightly more complex version of our above example:

```json
{
  "id": "com.bitnami.sample",
  "name": "com.bitnami.sample",
  "extends": ["Component"],
  "revision": 1,
  "author": {"name": "Your Company", "url": "https://example.com"},
  "version": "1.0.0",
  "properties": {
  },
  "exports": {
  },
  "installation": {
  }
}
```

While `main.js` will contain a showcase of all the installation hooks available. Installing the new created package will demonstrate it:

```
$> sudo nami install sample_package
nami INFO  Installing /home/bitrock/sample_package
com.bit INFO  Before unpacking the files
com.bit INFO  After unpacking the files
com.bit INFO  Running post installation
nami INFO  com.bitnami.sample successfully installed into /opt/bitnami/com.bitnami.sample
```

It is also possible to use a service-based template using the nami new command:

```
$> nami new --type Service --id "com.bitnami.sample_service" sample_service
nami INFO  Creating new nami package under /home/bitrock/sample_service
```

```json
{
  "id": "com.bitnami.sample_service",
  "name": "com.bitnami.sample_service",
  "extends": ["Service"],
  "revision": "0",
  "author": {"name": "Your Company", "url": "https://example.com"},
  "version": "1.0.0",
  "owner": {"username": "daemon"},
  "properties": {
    "port": {"default": 3456, "description": "Port"}
  },
  "exports": {
  },
  "service": {
    "pidFile": "{{$app.tmpDir}}/com.bitnami.sample_service.pid",
    "ports": ["{{$app.port}}"],
    "logFile": "{{$app.logsDir}}/com.bitnami.sample_service.log",
    "socketFile": "{{$app.tmpDir}}/com.bitnami.sample_service.sock",
    "start": {
      "timeout": 10,
      "command": "echo 'Service com.bitnami.sample_service started!' && sleep 1000  & echo $! > {{$app.pidFile}}"
    }
  },
  "installation": {}
}
```

### Adding files to your package

The previous package examples are fun to show how small a package definition cat get, but they don't get much work done. In most of the cases, you will want to at least get some files copied.

By default, if you create a `files/` directory inside your package folder, they will be automatically unpacked to the component installation directory at install time:

```
$> tree sample_package
sample_package
|-- nami.json
`-- files
    `-- hello.txt
```

```
$> nami  install sample_package
nami INFO  Installing /home/bitrock/sample_package
nami INFO  com.bitnami.sample successfully installed into /opt/bitnami/sample

$> ls /opt/bitnami/sample
hello.txt
```

You can see the contents of `files/` were copied to the installation directory, which defaults to the default installation prefix, usually `/opt/bitnami`, plus the package name.

If you want to structure your files in a more complex way and it does not match the desired structure under the installation directory, you will need to manually select which files and where to unpack them by grouping them into `components` and `folders`:

```json

{
  "id": "com.bitnami.sample",
  "name": "com.bitnami.sample",
  "extends": ["Component"],
  "revision": 1,
  "version": "1.0.0",
  "installation": {
    "packaging": {
      "components": [{
        "name": "default",
        "folders": [{
          "name": "data",
          "destination": "{{$app.installdir}}/data",
          "files": [{"origin": ["files/*"]}]
        }]
      }]
    }
  }
}
```

You can find a detailed explanation of all the supported settings in the [Packing files](#packing-files) section.

#### Modifying the package installation prefix

As previously mentioned, by default, packages are installed under `<installprefix>/<name>`. If you want to tweak this installation directory name without having to modify the package name, for example to install under `foobar`, you can use the `installation.prefix` JSON attribute:

```json
{
  "id": "com.bitnami.sample",
  "name": "sample",
  "extends": ["Component"],
  "revision": 0,
  "version": "1.0.0",
  "installation": {
    "prefix": "foobar"
  }
}
```

This will result in the package being installed under `/opt/bitnami/foobar` while still preserving its name as `sample`


You can check the "Installing Packages" section to know more about how to configure the default installation prefix.

### Adding actions to your package

If you have followed all the previous steps, you should now have a fancy way of coping files from your source package to a desired location, not very useful yet. In this section, you will learn how to add logic to your package so you can perform actions while installing or later on, over an already installed package.

Nami packages currently support providing two special JavaScript files: `main.js`, intended to contain all the high level logic, and 'helpers.js', intended to contain all accessory methods used in `main.js`. A good rule of thumb would be trying to put all the "public" or "pretty" methods under `main.js` and all the internal functions in `helpers.js`. In these files, you will have access to the package object through the special global variable `$app`, as well as some utility packages: `$file`, `$os`, `$crypt`, `$net`, `$hb` and `$util`.


For now, we will start by assuming all logic will be placed in `main.js` and will try to refactor it later on.

The main logic you will need to add to your `main.js` file will be that related to install time. For this purpose, Nami exposes some hooks so you can provide logic to execute at different points of the execution. You can find a detailed list of those hooks in the [Installation Hooks](#installation-hooks) section.


### Adding inputs to your package

Most of the installation procedures will require accepting inputs from the user, such as a password or a port for a certain service to listen at. Nami supports defining how to receive these inputs via command line options:

```
$> nami install ./bitnami-mysql/ --password=bitnami --port=3306 --enable-remote-connections
...
```

In the above example, three parameters were defined, a _password_, a _string_ and a _boolean_. A sample definition for them would be:

```json
{
  "id": "com.bitnami.mysql",
  "name": "mysql",
  "extends": ["Service"],
  "revision": 0,
  "version": "1.0.0",
  "properties": {
    "port": {"default": 3306, "description": "Port"},
    "password": {"type": "password", "required": true, "description": "Database root password"},
    "enable-remote-connections": {"type": "boolean", "description": "Enable connections from remote servers"}
  }
}
```

Depending of the specified type (which defaults to _string_), they will be processed differently in the command line (like booleans assuming true when provided) and handled later on (passwords are not stored by default).

The generated help menu for this definition would be:

```
$> nami install ./bitnami-mysql/ --help

Usage: com.bitnami.mysql <options>

 where <options> include:

--help

--inputs-file <inputs-file>                    JSON file containing a map of command line flags
                                               Default:

--port <port>                                  Port
                                               Default: 3306

--password <password>                          Database root password
                                               Default:

--enable-remote-connections                    Enable connections from remote servers
```

# Troubleshooting

## Log

Nami logs a lot of information into its log along its execution. Much of this information is usually not relevant so it is not printed by default but this can be changed through the `log-level` flag:

```
$> nami --help
...
--log-level <log-level>                                      Configures the verbosity of nami messages
                                                             Default: info
                                                             Allowed: trace, debug, info, warn, error, silent
...
```

There are also other much more verbose values that are not shown there: from `trace1` to `trace8`:

```
$> nami --log-level=trace start mariadb
nami --log-level=trace start com.bitnami.mariadb
mariadb TRACE [runProgram] Executing: null ./bin/mysqld --defaults-file=/opt/bitnami/mariadb/conf/my.cnf
mariadb TRACE code: 0
mariadb TRACE stdout:

mariadb TRACE stderr:

com.bitnami.mariadb started

$> nami --log-level=trace8 start mariadb
nami --log-level=trace8 start com.bitnami.mariadb
mariadb TRACE [normalize] File normalization: tmp -> /opt/bitnami/mariadb/tmp
mariadb TRACE [normalize] File normalization: /opt/bitnami/mariadb/tmp/mysqld.pid -> /opt/bitnami/mariadb/tmp/mysqld.pid
...
mariadb TRACE [exists] File normalization: /opt/bitnami/mariadb/logs -> /opt/bitnami/mariadb/logs
mariadb TRACE [exists] File normalization: /tmp -> /tmp
mariadb TRACE [exists] File normalization: /tmp -> /tmp
mariadb TRACE [normalize] File normalization: conf -> /opt/bitnami/mariadb/conf
mariadb TRACE [normalize] File normalization: /opt/bitnami/mariadb/conf/my.cnf -> /opt/bitnami/mariadb/conf/my.cnf
mariadb TRACE [runProgram] Executing: null ./bin/mysqld --defaults-file=/opt/bitnami/mariadb/conf/my.cnf
mariadb TRACE [runProgram] Executing internal command: '/bin/sh' ["-c","./bin/mysqld --defaults-file=/opt/bitnami/mariadb/conf/my.cnf &"]
mariadb TRACE [runProgram] RESULT: {"code":0,"stderr":"","stdout":""}
mariadb TRACE code: 0
mariadb TRACE stdout:

mariadb TRACE stderr:

mariadb TRACE [normalize] File normalization: tmp -> /opt/bitnami/mariadb/tmp
mariadb TRACE [normalize] File normalization: /opt/bitnami/mariadb/tmp/mysqld.pid -> /opt/bitnami/mariadb/tmp/mysqld.pid
mariadb TRACE [normalize] File normalization: tmp -> /opt/bitnami/mariadb/tmp
...
```

In addition, a log file is generated under `/tmp/nami_%timestamp%.log`:

```
$> cat /tmp/nami_1455014410.log
[Tue Feb 09 2016 11:40:10 GMT+0100 (CET)] nami INFO  Installing /home/bitrock/bitnami-mariadb
[Tue Feb 09 2016 11:40:10 GMT+0100 (CET)] nami WARN  Reinstalling package com.bitnami.mariadb
[Tue Feb 09 2016 11:40:37 GMT+0100 (CET)] nami INFO  mariadb successfully installed into /opt/bitnami/mariadb
```

## Interactive console

While working in developing a module or simply when exploring new functionalities, the interactive console is the best tool. It allows running an interactive interpreter with all the Nami built-in functionaly available:

```
$> nami console
nami> $file.write('/tmp/hello', 'Hello from Nami!')

nami> $file.read('/tmp/hello')
'Hello from Nami!'
nami> $os.isPlatform('linux')
true
```

In the above example, we are using the [global console](#console), which is independent of any installed package (`$app` is not available). In addition to the built-in modules, it exports the `$manager` object, which allows to manipulate all the packages in the system. You can consider it the core of Nami:

```
// List Packages
nami> Object.keys($manager.listPackages())
[ 'com.bitnami.mariadb',
  'com.bitnami.php',
  'com.bitnami.upstart-apache']

// Search for a package
nami> const mariadb = $manager.search('com.bitnami.mariadb')[0]
nami> mariadb.version
'10.1.11'
...
```

The [global console](#console) is really convenient when exploring and getting familiar with new functionalities as well as quickly testing code. If what you need is however to troubleshoot some package-related issue, you will find more convenient the [app console](#console). This console exposes the requested package as `$app` (as in the package scripts):

```
$> nami console com.bitnami.mariadb
nami> $app.version
'10.1.11'
```

The `$manager` object is also included for convenience, but please note __it will not be available in the package scripts__, so don't rely on it when writing your packages.
