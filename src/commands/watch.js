const path = require('path');
const chalk = require('chalk');
const chokidar = require('chokidar');
const { loadConfig, getProject } = require('../utils/config');
const { runBuild } = require('../utils/builder');
const { copyToTarget } = require('../utils/copier');
const logger = require('../utils/logger');

module.exports = async function watch(project) {
  const config = await loadConfig();
  if (!config) {
    logger.error(`No ${chalk.bold('.distdroprc.json')} found. Run ${chalk.yellow('dist-drop init')} first.`);
    return;
  }

  const projConfig = getProject(config, project);
  if (!projConfig) {
    logger.error(`Project ${chalk.bold(project)} not found in config.`);
    logger.dim('Available: ' + Object.keys(config.projects).join(', '));
    return;
  }

  const srcDir = path.join(projConfig.source, 'src');
  const publicDir = path.join(projConfig.source, 'public');

  logger.blank();
  console.log(chalk.bold.cyan(`  dist-drop watch — ${projConfig.name}`));
  console.log(chalk.dim(`  Watching: ${srcDir}`));
  console.log(chalk.dim(`  Target:   ${projConfig.target}`));
  console.log(chalk.dim(`  Press Ctrl+C to stop\n`));

  let syncing = false;
  let pendingSync = false;
  let debounceTimer = null;

  async function doSync(changedFile) {
    if (syncing) {
      pendingSync = true;
      return;
    }

    syncing = true;
    const relPath = path.relative(projConfig.source, changedFile);
    logger.watch(`Change detected: ${chalk.bold(relPath)}`);

    const buildResult = await runBuild(projConfig);
    if (buildResult.success) {
      await copyToTarget(projConfig);
    }

    syncing = false;

    if (pendingSync) {
      pendingSync = false;
      logger.watch('Processing queued change...');
      await doSync(changedFile);
    }
  }

  const watcher = chokidar.watch([srcDir, publicDir], {
    ignored: [
      '**/node_modules/**',
      '**/.git/**'
    ],
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 300,
      pollInterval: 100
    }
  });

  watcher.on('all', (event, filePath) => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => doSync(filePath), 500);
  });

  watcher.on('error', (err) => {
    logger.error(`Watcher error: ${err.message}`);
  });

  logger.success('Watching for changes...');

  // Keep process alive
  process.on('SIGINT', () => {
    logger.blank();
    logger.info('Stopping watcher...');
    watcher.close();
    process.exit(0);
  });
};
