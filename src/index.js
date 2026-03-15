// Command router — each command is loaded on demand from bin/dist-drop.js
// This file serves as the package main entry for programmatic usage

const init = require('./commands/init');
const sync = require('./commands/sync');
const watch = require('./commands/watch');
const list = require('./commands/status');

module.exports = { init, sync, watch, list };
