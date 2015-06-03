'use strict';

const Nami = require('./cli/nami-app');

let exitCode = 0;

const nami = new Nami();

try {
  exitCode = nami.exec();
} catch (e) {
  nami.error(e.message);
  nami.trace(e.stack);
  exitCode = nami.exitCode !== 0 ? nami.exitCode : 1;
}

process.exitCode = exitCode || nami.exitCode;
