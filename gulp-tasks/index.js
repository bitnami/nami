'use strict';

const fs = require('fs-extra');
const _ = require('lodash');
const path = require('path');
const tasks = {};
const tasksDir = path.join(__dirname, 'tasks');

_.each(fs.readdirSync(tasksDir), dir => {
  tasks[dir] = require(path.join(tasksDir, dir));
});

module.exports = {tasks};

