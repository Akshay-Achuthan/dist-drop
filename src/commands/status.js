const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');
const figlet = require('figlet');
const boxen = require('boxen');
const { loadConfig, getAllProjects, CONFIG_FILE } = require('../utils/config');
const logger = require('../utils/logger');

module.exports = async function status() {
  const config = await loadConfig();
  if (!config) {
    logger.error(`No ${chalk.bold(CONFIG_FILE)} found. Run ${chalk.yellow('dist-drop init')} first.`);
    return;
  }

  const projects = getAllProjects(config);

  logger.blank();
  console.log(chalk.hex('#D4A017').bold(figlet.textSync('DIST-DROP', { font: 'ANSI Shadow' })));
  console.log(chalk.dim('  A CLI tool to automate frontend builds and copy to your WAR server\n'));

  if (projects.length === 0) {
    logger.warn('No projects configured. Run ' + chalk.yellow('dist-drop init') + ' to get started.');
    return;
  }

  // Project cards
  const lines = [];
  for (let i = 0; i < projects.length; i++) {
    const proj = projects[i];
    const targetExists = await fs.pathExists(proj.target);
    const buildExists = await fs.pathExists(path.join(proj.source, proj.buildOutput));

    const targetStatus = targetExists ? chalk.green('✅ yes') : chalk.red('❌ no');
    const buildStatus = buildExists ? chalk.green('✅ yes') : chalk.red('❌ no');

    lines.push(chalk.bold.yellow(`📦 ${proj.name}`) + chalk.dim(` (${proj.framework})`));
    lines.push('');
    lines.push(chalk.white('Source:') + ' ' + chalk.hex('#D4A017')(proj.source));
    lines.push(chalk.white('Target:') + ' ' + chalk.hex('#5B9BD5')(proj.target));
    lines.push('');
    lines.push(chalk.white('Target Exists:') + ' ' + targetStatus);
    lines.push(chalk.white('Build Output:') + '  ' + buildStatus);

    if (i < projects.length - 1) {
      lines.push('');
      lines.push(chalk.yellow('─'.repeat(50)));
      lines.push('');
    }
  }

  console.log(boxen(lines.join('\n'), { padding: 1, borderColor: 'yellow', borderStyle: 'round', title: chalk.bold.yellow(`Projects (${projects.length})`), titleAlignment: 'left' }));
  logger.blank();
};
