[![Build Status](https://api.travis-ci.org/bitnami/nami.svg?branch=master)](http://travis-ci.org/bitnami/nami)

# nami

_Nami_ is a synchronous node-based command line tool designed to ease the deployment of runtime, servers and web applications in multiple environments.

- _Application specific_: automate the configuration process with a simple API.
- _Customize your stack_: deploy your app using any runtime version, do not depend on Linux distro package versions.

> Please note this library is currently under active development. Any release versioned 0.x is subject to backwards incompatible changes.

## Installation

_Nami_ is supported in any 64-bit Linux distribution. OS X and Windows platforms are not supported right now. We are open to PRs to support other platforms.

### Bundled version

Download the latest _nami_ version with a bundled runtime (Node.js) at https://downloads.bitnami.com/nami/

```
$ wget https://downloads.bitnami.com/nami/nami-0.0.1-linux-x64.tgz
$ tar -xzf nami-0.0.1-linux-x64.tar.gz
$ nami-0.0.1/bin/nami --help
```

### Development version

_Nami_ requires Node.js and npm already installed on the system. Clone the repo and install dependencies and runtime.

```
$ git clone https://github.com/bitnami/nami
$ cd nami
$ npm install
$ npm run install-runtime
$ bin/nami --help
```

## Get started

_Nami_ provides different ways of operation through its multiple cli commands, all of them following the format:
```
$ nami [<global-options> | <command> [<command-options> [<command-arguments>]]]
```
`<global-options>`: Global Nami options that are not specific to any particular sub-command.

`<command>`: Command to execute: `list`, `install`, `unpack`, `uninstall`, `test`, `initialize`, `new`, `execute`, `start`, `stop`, `restart`, `status`, `inspect`

`<command-options>`: Options related to the command being executed.

`<command-arguments>`: Command-specific arguments.

## How to unpack and initialize a module

There are several _nami_ modules for Linux x64 that you can download at https://downloads.bitnami.com/nami-modules.

```
$ tar -xzf mariadb-10.1.13-5-linux-x64.tar.gz
$ cd mariadb-10.1.13-5-linux-x64
$ sudo nami unpack .
```

That way it is possible to check the inputs for the MariaDB module.

The MariaDB files have been copied to `/opt/bitnami` by default. Then check if it was registered and show the properties to configure the MariaDB database.

```
$ sudo nami list mariadb
["com.bitnami.mariadb"]
```

Then it is possible to add any property to initialize the module. In this case we set up a root password.

```
$ nami initialize mariadb --rootPassword nami
nami INFO  Initializing mariadb
mariadb INFO  ==> Creating 'root' user with unrestricted access...
mariadb INFO  ==> Flushing privileges...
mariadb INFO  ==> Enabling remote connections...
mariadb INFO
mariadb INFO #####################################################
mariadb INFO   Installation parameters for mariadb:
mariadb INFO     Password: ****
mariadb INFO #####################################################
mariadb INFO
nami INFO  mariadb successfully initialized
```

The MariaDB database is initialized and the persistent data and config folders `data/` and `conf/` are created into the `/bitnami` folder by default.

Then start the MariaDB database.

```
$ nami start mariadb
com.bitnami.mariadb started
```

## How to implement a _nami_ module

Populate the files for a new module.

```
$ nami new --id "com.bitnami.sample" sample_package
nami INFO  Creating new nami package under /home/user/sample_package
$> tree sample_package
sample_package
|-- nami.js
```

Copy your files into `files/` and install the module:
```
$ cd sample_package
$ sudo nami install .
```

The files will be copied to `/opt/bitnami` folder by default.

You can find more info about how to create a _nami_ module at the [Nami User Guide](docs/Nami.md).

## Licensing

_Nami_ is licensed under the GPL, Version 2.0. See the [COPYING](COPYING) file for the full license text.

## Contributing

Check our [Contributing](CONTRIBUTING.md) guide.
 
