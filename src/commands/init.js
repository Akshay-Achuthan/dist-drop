const path = require('path');
const inquirer = require('inquirer');
const chalk = require('chalk');
const figlet = require('figlet');
const boxen = require('boxen');
const fs = require('fs-extra');
const { detectFramework } = require('../utils/detector');
const { loadConfig, saveConfig, CONFIG_FILE } = require('../utils/config');
const logger = require('../utils/logger');

module.exports = async function init() {
  logger.blank();
  console.log(chalk.hex('#D4A017').bold(figlet.textSync('DIST-DROP', { font: 'ANSI Shadow' })));
  console.log(chalk.dim('  A CLI tool to automate frontend builds and copy to your WAR server\n'));

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
  const selectedProject = await promptAndDetectProject(existingConfig);
  if (!selectedProject) return;

  const warResult = await promptWarTarget(selectedProject);

  if (!warResult) return;

  const { warBase, projectConfig } = warResult;

  // Merge with existing projects
  const allProjects = existingConfig
    ? { ...existingConfig.projects, ...projectConfig }
    : projectConfig;

  // Show summary — only the project being added
  showSummary(warBase, projectConfig);

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
    warBase: warBase.replace(/\\/g, '/'),
    projects: allProjects
  };

  const configPath = await saveConfig(config);
  logger.blank();
  logger.success(`Config saved to ${chalk.bold(configPath)}`);
  const projectName = Object.keys(projectConfig)[0];
  logger.dim(`Run ${chalk.yellow(`dist-drop sync ${projectName}`)} to build and deploy.`);
  logger.blank();
};

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Prompt for frontend project path. Validates it's a real frontend project.
 * Loops on invalid/wrong path.
 */
async function promptAndDetectProject(existingConfig) {
  while (true) {
    const { projectPath } = await inquirer.prompt([{
      type: 'input',
      name: 'projectPath',
      message: 'Enter your frontend app path (e.g. D:/projects/ui_b2b):',
      validate: (val) => {
        if (!val.trim()) return 'Path is required';
        return fs.pathExistsSync(val.trim()) ? true : 'Directory does not exist. Try again.';
      }
    }]);

    const resolvedPath = path.resolve(projectPath.trim());

    const detection = await detectFramework(resolvedPath);
    if (!detection) {
      logger.error('Not a frontend project — no package.json with a build script found.');
      logger.blank();
      continue;
    }

    const projectName = path.basename(resolvedPath);

    if (existingConfig && existingConfig.projects[projectName]) {
      logger.warn(`${chalk.bold(projectName)} is already configured.`);
      logger.blank();
      continue;
    }

    const fw = chalk.white(detection.frameworkLabel);
    const out = chalk.dim(`→ ${detection.buildOutput}/`);
    console.log(`✅ ${chalk.bold(projectName)} ${fw} ${out}`);
    logger.blank();

    return { name: projectName, path: resolvedPath, detected: detection };
  }
}

/**
 * Prompt for WAR target path. Validates directory exists.
 * Auto-detects dist/ inside to decide final copy target.
 */
async function promptWarTarget(proj) {
  while (true) {
    const { targetPath } = await inquirer.prompt([{
      type: 'input',
      name: 'targetPath',
      message: 'WAR target path (exact folder where build output should go):',
      validate: (val) => {
        if (!val.trim()) return 'Path is required';
        return fs.pathExistsSync(val.trim()) ? true : 'Directory does not exist. Try again.';
      }
    }]);

    const resolvedTarget = path.resolve(targetPath.trim()).replace(/\\/g, '/');

    // Validate: must have dist/, or build output files (index.html, css/, js/), or be empty
    const distPath = path.join(resolvedTarget, 'dist');
    const hasDist = await fs.pathExists(distPath);
    const hasIndex = await fs.pathExists(path.join(resolvedTarget, 'index.html'));
    const hasCss = await fs.pathExists(path.join(resolvedTarget, 'css'));
    const hasJs = await fs.pathExists(path.join(resolvedTarget, 'js'));
    const entries = await fs.readdir(resolvedTarget);
    const isEmpty = entries.length === 0;

    const isValidTarget = hasDist || hasIndex || (hasCss && hasJs) || isEmpty;

    if (!isValidTarget) {
      logger.error('This doesn\'t look like a valid deploy target — no dist/, index.html, or css/js found.');
      logger.dim('Enter the exact folder where build output is deployed.');
      logger.blank();
      continue;
    }

    // Extract warBase from path (everything up to and including .war)
    const warMatch = resolvedTarget.match(/^(.+\.war)/i);
    const warBase = warMatch ? warMatch[1] : resolvedTarget;

    const finalTarget = hasDist ? distPath.replace(/\\/g, '/') : resolvedTarget;

    logger.success(`Target: ${chalk.hex('#5B9BD5').bold(finalTarget)}${hasDist ? chalk.dim(' (dist/ detected)') : isEmpty ? chalk.dim(' (empty folder — first deploy)') : chalk.dim(' (no dist/ — copying directly)')}`);
    logger.blank();

    return {
      warBase,
      projectConfig: {
        [proj.name]: {
          source: proj.path.replace(/\\/g, '/'),
          framework: proj.detected.framework,
          buildCmd: proj.detected.buildCmd,
          buildOutput: proj.detected.buildOutput,
          target: finalTarget
        }
      }
    };
  }
}

function showSummary(warBase, projects) {

  const lines = [];
  for (const [name, proj] of Object.entries(projects)) {
    lines.push(chalk.bold.yellow(`📦 ${name}`) + chalk.dim(` (${proj.framework})`));
    lines.push('');
    lines.push(chalk.gray('Source:') + ' ' + chalk.hex('#D4A017')(proj.source));
    lines.push(chalk.gray('WAR:') + '    ' + chalk.dim(warBase));
    lines.push(chalk.gray('Target:') + ' ' + chalk.hex('#5B9BD5')(proj.target));
    lines.push('');
    lines.push(chalk.gray('Build:') + '  ' + chalk.dim(proj.buildCmd) + chalk.yellow(' → ') + chalk.dim(proj.buildOutput + '/'));
    lines.push('');
  }
  // Remove trailing blank line
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();

  logger.blank();
  console.log(boxen(lines.join('\n'), { padding: 1, borderColor: 'yellow', borderStyle: 'round', title: chalk.bold.yellow('Summary'), titleAlignment: 'left' }));
  logger.blank();
}

// ── REMOVE MODE ──────────────────────────────────────────────────────

async function handleRemove(config) {
  const names = Object.keys(config.projects);

  const { toRemove } = await inquirer.prompt([{
    type: 'list',
    name: 'toRemove',
    message: 'Select project to remove:',
    choices: names.map(n => ({ name: `${n} (${config.projects[n].framework})`, value: n }))
  }]);

  delete config.projects[toRemove];

  const remaining = Object.keys(config.projects).length;
  if (remaining === 0) {
    logger.warn('All projects removed. Config will be empty.');
  }

  const configPath = await saveConfig(config);
  logger.blank();
  logger.success(`Removed ${chalk.bold(toRemove)}. ${remaining} project(s) remaining.`);
  logger.dim(`Config: ${configPath}`);
  logger.blank();
}

// ── EDIT MODE ────────────────────────────────────────────────────────

async function handleEdit(config) {
  const names = Object.keys(config.projects);

  let toEdit;
  if (names.length === 1) {
    toEdit = names[0];
    logger.info(`Auto-selected ${chalk.bold(toEdit)}`);
  } else {
    const { picked } = await inquirer.prompt([{
      type: 'list',
      name: 'picked',
      message: 'Select project to edit:',
      choices: names.map(n => ({
        name: `${n}  →  ${config.projects[n].target}`,
        value: n
      }))
    }]);
    toEdit = picked;
  }

  const proj = config.projects[toEdit];
  console.log(chalk.dim(`\n  Current settings for ${chalk.bold(toEdit)}:`));
  console.log(chalk.gray('    source:  ') + chalk.hex('#D4A017')(proj.source));
  console.log(chalk.gray('    build:   ') + chalk.dim(proj.buildCmd + ' → ' + proj.buildOutput + '/'));
  console.log(chalk.gray('    target:  ') + chalk.hex('#5B9BD5')(proj.target) + '\n');

  const { whatToEdit } = await inquirer.prompt([{
    type: 'list',
    name: 'whatToEdit',
    message: 'What do you want to change?',
    choices: [
      { name: 'Source path        — change frontend project path', value: 'source' },
      { name: 'Target path        — change WAR target path', value: 'target' },
      { name: 'Both               — change source and target', value: 'both' }
    ]
  }]);

  // Edit source path
  if (whatToEdit === 'source' || whatToEdit === 'both') {
    const selectedProject = await promptAndDetectProject(null);
    if (selectedProject) {
      config.projects[toEdit].source = selectedProject.path.replace(/\\/g, '/');
      config.projects[toEdit].framework = selectedProject.detected.framework;
      config.projects[toEdit].buildCmd = selectedProject.detected.buildCmd;
      config.projects[toEdit].buildOutput = selectedProject.detected.buildOutput;
    }
  }

  // Edit target path
  if (whatToEdit === 'target' || whatToEdit === 'both') {
    const p = config.projects[toEdit];
    const dummyProj = { name: toEdit, path: p.source, detected: { buildCmd: p.buildCmd, buildOutput: p.buildOutput, framework: p.framework } };
    const warResult = await promptWarTarget(dummyProj);
    if (warResult) {
      config.warBase = warResult.warBase;
      config.projects[toEdit].target = warResult.projectConfig[toEdit].target;
    }
  }

  const configPath = await saveConfig(config);
  logger.blank();
  logger.success(`Updated ${chalk.bold(toEdit)}`);
  logger.dim(`Config: ${configPath}`);
  logger.blank();
}
