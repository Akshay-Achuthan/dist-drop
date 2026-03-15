const chalk = require('chalk');
const inquirer = require('inquirer');
const { loadConfig, getProject, getAllProjects, CONFIG_FILE } = require('../utils/config');
const { runBuild } = require('../utils/builder');
const { copyToTarget, copyIncremental } = require('../utils/copier');
const logger = require('../utils/logger');

async function syncProject(projectConfig, mode) {
  const name = projectConfig.name;
  logger.blank();
  console.log(chalk.bold(`  ${chalk.yellow('▸')} ${name}`));
  console.log(`    ${chalk.hex('#D4A017')(projectConfig.source)} ${chalk.dim('→')} ${chalk.hex('#5B9BD5')(projectConfig.target)}`);
  logger.blank();

  const startTime = Date.now();

  // Build step (unless drop-only)
  if (mode !== 'drop-only') {
    const buildResult = await runBuild(projectConfig);
    if (!buildResult.success) {
      logger.error(`Sync failed for ${name} — build error`);
      return false;
    }
  } else {
    logger.info('Skipping build (drop-only mode)');
  }

  // Copy step
  let copyResult;
  if (mode === 'incremental') {
    // Use last sync time from config, or 0 for first run
    const since = projectConfig.lastSync || 0;
    copyResult = await copyIncremental(projectConfig, since);
  } else {
    copyResult = await copyToTarget(projectConfig);
  }

  if (!copyResult.success) {
    logger.error(`Sync failed for ${name} — copy error`);
    return false;
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  logger.blank();
  logger.success(`${chalk.bold(name)} synced in ${totalTime}s`);
  return true;
}

module.exports = async function sync(project, opts) {
  const config = await loadConfig();
  if (!config) {
    logger.error(`No ${chalk.bold(CONFIG_FILE)} found. Run ${chalk.yellow('dist-drop init')} first.`);
    return;
  }

  // Sync all projects
  if (opts.all) {
    const projects = getAllProjects(config);
    if (projects.length === 0) {
      logger.error('No projects configured.');
      return;
    }

    const { mode } = await promptMode();
    logger.blank();
    logger.info(`Syncing ${chalk.bold(projects.length)} project(s)...`);

    let successCount = 0;
    for (const proj of projects) {
      const ok = await syncProject(proj, mode);
      if (ok) successCount++;
    }

    logger.blank();
    logger.success(`Done: ${successCount}/${projects.length} projects synced.`);
    return;
  }

  // Sync single project
  if (!project) {
    // If no project specified, show a list to pick from
    const projects = getAllProjects(config);
    if (projects.length === 0) {
      logger.error('No projects configured.');
      return;
    }

    const { selectedProject } = await inquirer.prompt([{
      type: 'list',
      name: 'selectedProject',
      message: 'Select project to sync:',
      choices: projects.map(p => ({
        name: `${p.name} (${p.framework})`,
        value: p.name
      }))
    }]);
    project = selectedProject;
  }

  const projConfig = getProject(config, project);
  if (!projConfig) {
    logger.error(`Project ${chalk.bold(project)} not found in config.`);
    logger.dim('Available: ' + Object.keys(config.projects).join(', '));
    return;
  }

  const { mode } = await promptMode();
  await syncProject(projConfig, mode);
};

async function promptMode() {
  return inquirer.prompt([{
    type: 'list',
    name: 'mode',
    message: 'Sync mode:',
    choices: [
      { name: 'Full Build + Drop  — build then copy all files', value: 'full' },
      { name: 'Drop Only          — skip build, copy existing output', value: 'drop-only' },
      { name: 'Incremental Drop   — copy only changed files', value: 'incremental' }
    ]
  }]);
}
