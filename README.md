[![Build Status](https://api.travis-ci.org/bitnami/nami.svg?branch=master)](http://travis-ci.org/bitnami/nami)

> **ALERT**: Please note this library is currently under active development. Any release versioned 0.x is subject to backwards incompatible changes.

# nami

_Nami_ is a synchronous node-based command line tool designed to ease the deployment of runtime, servers and web applications in multiple environments.

- _Application specific_: automate the configuration process with a simple API.
- _Customize your stack_: deploy your app using any runtime version, do not depend on Linux distro package versions.



## Installation

_Nami_ is supported in any 64-bit Linux distribution. OS X and Windows platforms are not supported right now. We are open to PRs to support other platforms.

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
 
