#!/usr/bin/env node

const { program } = require('commander');
const pkg = require('../package.json');

program
  .name('dist-drop')
  .description(pkg.description)
  .version(pkg.version);

program
  .command('init')
  .description('Interactive setup — auto-detect projects and create .distdroprc.json')
  .action(() => require('../src/commands/init')());

program
  .command('sync [project]')
  .description('Build + copy project to WAR target')
  .option('-a, --all', 'Sync all configured projects')
  .action((project, opts) => require('../src/commands/sync')(project, opts));

program
  .command('watch <project>')
  .description('Watch for changes and auto build + copy')
  .action((project) => require('../src/commands/watch')(project));

program
  .command('status')
  .description('Show current config and last sync times')
  .action(() => require('../src/commands/status')());

program.parse();
