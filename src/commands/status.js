const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');
const { loadConfig, getAllProjects, CONFIG_FILE } = require('../utils/config');
const logger = require('../utils/logger');

module.exports = async function status() {
  const config = await loadConfig();
  if (!config) {
    logger.error(`No ${chalk.bold(CONFIG_FILE)} found. Run ${chalk.cyan('dist-drop init')} first.`);
    return;
  }

  const projects = getAllProjects(config);

  logger.blank();
  console.log(chalk.bold.cyan('  dist-drop status\n'));
  console.log(chalk.dim(`  Config: ${path.join(process.cwd(), CONFIG_FILE)}`));
  console.log(chalk.dim(`  WAR:    ${config.warBase}`));
  console.log(chalk.dim(`  Projects: ${projects.length}`));
  logger.blank();

  if (projects.length === 0) {
    logger.warn('No projects configured.');
    return;
  }

  // Table header
  const nameW = 24;
  const fwW = 14;
  const statusW = 12;

  console.log(
    '  ' +
    chalk.bold('Project'.padEnd(nameW)) +
    chalk.bold('Framework'.padEnd(fwW)) +
    chalk.bold('Target Exists'.padEnd(statusW)) +
    chalk.bold('Build Output')
  );
  console.log('  ' + chalk.dim('─'.repeat(nameW + fwW + statusW + 20)));

  for (const proj of projects) {
    const targetExists = await fs.pathExists(proj.target);
    const buildExists = await fs.pathExists(path.join(proj.source, proj.buildOutput));

    const statusIcon = targetExists
      ? chalk.green('✔ yes')
      : chalk.dim('✖ no');

    const buildIcon = buildExists
      ? chalk.green('✔ present')
      : chalk.dim('✖ missing');

    console.log(
      '  ' +
      chalk.bold(proj.name.padEnd(nameW)) +
      chalk.yellow(proj.framework.padEnd(fwW)) +
      statusIcon.padEnd(statusW + 10) +
      buildIcon
    );
    console.log(
      '  ' +
      chalk.dim(proj.source) +
      chalk.dim(' → ') +
      chalk.dim(proj.target)
    );
    logger.blank();
  }
};
