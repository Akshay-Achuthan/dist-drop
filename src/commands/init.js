const path = require('path');
const inquirer = require('inquirer');
const chalk = require('chalk');
const { scanProjects } = require('../utils/detector');
const { loadConfig, saveConfig, CONFIG_FILE } = require('../utils/config');
const logger = require('../utils/logger');

module.exports = async function init() {
  logger.blank();
  console.log(chalk.bold.cyan('  dist-drop init'));
  console.log(chalk.dim('  Interactive setup — auto-detect projects and configure targets\n'));

  // Check for existing config
  const existingConfig = await loadConfig();

  let mode;

  if (existingConfig && Object.keys(existingConfig.projects).length > 0) {
    const existingNames = Object.keys(existingConfig.projects);
    logger.info(`Existing config: ${chalk.bold(existingNames.join(', '))}`);
    logger.blank();

    const { setupMode } = await inquirer.prompt([{
      type: 'list',
      name: 'setupMode',
      message: 'What would you like to do?',
      choices: [
        { name: 'Add projects      — keep existing config, add more projects', value: 'add' },
        { name: 'Edit projects     — modify existing project settings', value: 'edit' },
        { name: 'Remove projects   — remove projects from config', value: 'remove' }
      ]
    }]);
    mode = setupMode;
  } else {
    mode = 'new';
  }

  // --- REMOVE MODE ---
  if (mode === 'remove') {
    return await handleRemove(existingConfig);
  }

  // --- EDIT MODE ---
  if (mode === 'edit') {
    return await handleEdit(existingConfig);
  }

  // --- NEW or ADD MODE ---
  const warBase = mode === 'add'
    ? existingConfig.warBase
    : await promptWarBase();

  const sourceDir = await promptSourceDir();

  // Scan for projects
  logger.blank();
  logger.info(`Scanning ${chalk.bold(sourceDir)}...`);
  logger.blank();

  const scanned = await scanProjects(sourceDir);
  const frontendProjects = scanned.filter(p => p.detected);
  const skippedProjects = scanned.filter(p => !p.detected);

  if (frontendProjects.length === 0) {
    logger.error('No frontend projects found in this directory.');
    logger.dim('Make sure the directory contains folders with package.json files.');
    return;
  }

  // Display detected projects
  console.log(chalk.dim(`  Found ${frontendProjects.length} project(s):\n`));
  for (const proj of frontendProjects) {
    const fw = chalk.yellow(proj.detected.frameworkLabel.padEnd(12));
    const out = chalk.dim(`→ ${proj.detected.buildOutput}/`);
    const already = (mode === 'add' && existingConfig.projects[proj.name])
      ? chalk.dim(' (already configured)')
      : '';
    console.log(`  ${chalk.green('✔')} ${chalk.bold(proj.name.padEnd(24))} ${fw} ${out}${already}`);
  }
  for (const proj of skippedProjects) {
    const hasPkg = require('fs-extra').pathExistsSync(path.join(proj.path, 'package.json'));
    if (hasPkg) {
      console.log(`  ${chalk.dim('⊘')} ${chalk.dim(proj.name.padEnd(24))} ${chalk.dim('(skipped — no build output)')}`);
    }
  }
  logger.blank();

  // In add mode, only show projects not already configured
  const availableProjects = mode === 'add'
    ? frontendProjects.filter(p => !existingConfig.projects[p.name])
    : frontendProjects;

  if (availableProjects.length === 0) {
    logger.info('All detected projects are already configured.');
    return;
  }

  // Select projects
  const { selectedProjects } = await inquirer.prompt([{
    type: 'checkbox',
    name: 'selectedProjects',
    message: 'Select projects to configure:',
    choices: availableProjects.map(p => ({
      name: `${p.name} (${p.detected.frameworkLabel})`,
      value: p.name,
      checked: false
    })),
    validate: (val) => val.length > 0 ? true : 'Select at least one project'
  }]);

  // Ask WAR base if new setup
  const finalWarBase = mode === 'new'
    ? warBase
    : existingConfig.warBase;

  // Configure target for each
  logger.blank();
  logger.info('Configure target folders inside the WAR:');
  logger.blank();

  const newProjects = await promptProjectTargets(selectedProjects, frontendProjects, finalWarBase);

  // Merge projects
  const allProjects = mode === 'add'
    ? { ...existingConfig.projects, ...newProjects }
    : newProjects;

  // Show summary
  showSummary(finalWarBase, allProjects);

  const { confirm } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirm',
    message: 'Save this configuration?',
    default: true
  }]);

  if (!confirm) {
    logger.warn('Setup cancelled.');
    return;
  }

  const config = {
    version: 1,
    warBase: finalWarBase.replace(/\\/g, '/'),
    projects: allProjects
  };

  const configPath = await saveConfig(config);
  logger.blank();
  logger.success(`Config saved to ${chalk.bold(configPath)}`);
  logger.dim(`Run ${chalk.cyan('dist-drop sync <project>')} to build and deploy.`);
  logger.blank();
};

// ── Helpers ──────────────────────────────────────────────────────────

async function promptSourceDir() {
  const { sourceDir } = await inquirer.prompt([{
    type: 'input',
    name: 'sourceDir',
    message: 'Where are your frontend projects?',
    default: process.cwd(),
    validate: (val) => {
      const fs = require('fs-extra');
      return fs.pathExistsSync(val) ? true : 'Directory does not exist';
    }
  }]);
  return sourceDir;
}

async function promptWarBase() {
  const { warBase } = await inquirer.prompt([{
    type: 'input',
    name: 'warBase',
    message: 'WAR base path (e.g. D:/wildfly/standalone/deployments/app.war):',
    validate: (val) => val.trim() ? true : 'WAR base path is required'
  }]);
  return warBase;
}

async function promptProjectTargets(selectedProjects, frontendProjects, warBase) {
  const projects = {};

  for (const projectName of selectedProjects) {
    const proj = frontendProjects.find(p => p.name === projectName);

    const { targetFolder } = await inquirer.prompt([{
      type: 'input',
      name: 'targetFolder',
      message: `Target folder inside WAR for ${chalk.bold(projectName)} (just the name, e.g. "${projectName}"):`,
      default: projectName
    }]);

    const { wantOverride } = await inquirer.prompt([{
      type: 'confirm',
      name: 'wantOverride',
      message: `  Override detected settings? (${proj.detected.frameworkLabel}, ${proj.detected.buildCmd}, ${proj.detected.buildOutput}/)`,
      default: false
    }]);

    let buildCmd = proj.detected.buildCmd;
    let buildOutput = proj.detected.buildOutput;

    if (wantOverride) {
      const overrides = await inquirer.prompt([
        { type: 'input', name: 'buildCmd', message: '  Build command:', default: buildCmd },
        { type: 'input', name: 'buildOutput', message: '  Build output folder:', default: buildOutput }
      ]);
      buildCmd = overrides.buildCmd;
      buildOutput = overrides.buildOutput;
    }

    const normalizedWarBase = warBase.replace(/\\/g, '/');
    const normalizedTarget = targetFolder.replace(/\\/g, '/');

    const isAbsolute = /^[a-zA-Z]:[\\/]/.test(targetFolder) || targetFolder.startsWith('/');
    const targetBase = isAbsolute
      ? `${normalizedTarget}/${buildOutput}`
      : `${normalizedWarBase}/${normalizedTarget}/${buildOutput}`;

    projects[projectName] = {
      source: proj.path.replace(/\\/g, '/'),
      framework: proj.detected.framework,
      buildCmd,
      buildOutput,
      target: targetBase
    };
  }

  return projects;
}

function showSummary(warBase, projects) {
  logger.blank();
  console.log(chalk.bold.cyan('  Summary:\n'));
  console.log(chalk.dim(`  WAR base: ${warBase}`));
  logger.blank();
  for (const [name, proj] of Object.entries(projects)) {
    console.log(`  ${chalk.bold(name)}`);
    console.log(chalk.dim(`    source:  ${proj.source}`));
    console.log(chalk.dim(`    build:   ${proj.buildCmd} → ${proj.buildOutput}/`));
    console.log(chalk.dim(`    target:  ${proj.target}`));
    logger.blank();
  }
}

// ── REMOVE MODE ──────────────────────────────────────────────────────

async function handleRemove(config) {
  const names = Object.keys(config.projects);

  const { toRemove } = await inquirer.prompt([{
    type: 'checkbox',
    name: 'toRemove',
    message: 'Select projects to remove:',
    choices: names.map(n => ({ name: `${n} (${config.projects[n].framework})`, value: n })),
    validate: (val) => val.length > 0 ? true : 'Select at least one'
  }]);

  for (const name of toRemove) {
    delete config.projects[name];
  }

  const remaining = Object.keys(config.projects).length;
  if (remaining === 0) {
    logger.warn('All projects removed. Config will be empty.');
  }

  const configPath = await saveConfig(config);
  logger.blank();
  logger.success(`Removed ${toRemove.length} project(s). ${remaining} remaining.`);
  logger.dim(`Config: ${configPath}`);
  logger.blank();
}

// ── EDIT MODE ────────────────────────────────────────────────────────

async function handleEdit(config) {
  const names = Object.keys(config.projects);

  const { toEdit } = await inquirer.prompt([{
    type: 'list',
    name: 'toEdit',
    message: 'Select project to edit:',
    choices: names.map(n => ({
      name: `${n}  →  ${config.projects[n].target}`,
      value: n
    }))
  }]);

  const proj = config.projects[toEdit];
  console.log(chalk.dim(`\n  Current settings for ${chalk.bold(toEdit)}:`));
  console.log(chalk.dim(`    source:      ${proj.source}`));
  console.log(chalk.dim(`    buildCmd:    ${proj.buildCmd}`));
  console.log(chalk.dim(`    buildOutput: ${proj.buildOutput}`));
  console.log(chalk.dim(`    target:      ${proj.target}\n`));

  const updates = await inquirer.prompt([
    { type: 'input', name: 'buildCmd', message: 'Build command:', default: proj.buildCmd },
    { type: 'input', name: 'buildOutput', message: 'Build output folder:', default: proj.buildOutput },
    { type: 'input', name: 'target', message: 'Full target path:', default: proj.target }
  ]);

  config.projects[toEdit].buildCmd = updates.buildCmd;
  config.projects[toEdit].buildOutput = updates.buildOutput;
  config.projects[toEdit].target = updates.target.replace(/\\/g, '/');

  // Option to edit WAR base too
  const { editWar } = await inquirer.prompt([{
    type: 'confirm',
    name: 'editWar',
    message: `Change WAR base? (currently: ${config.warBase})`,
    default: false
  }]);

  if (editWar) {
    const { newWar } = await inquirer.prompt([{
      type: 'input',
      name: 'newWar',
      message: 'New WAR base path:',
      default: config.warBase
    }]);
    config.warBase = newWar.replace(/\\/g, '/');
  }

  const configPath = await saveConfig(config);
  logger.blank();
  logger.success(`Updated ${chalk.bold(toEdit)}`);
  logger.dim(`Config: ${configPath}`);
  logger.blank();
}
