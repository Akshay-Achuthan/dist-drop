const { spawn } = require('child_process');
const path = require('path');
const ora = require('ora');
const logger = require('./logger');

/**
 * Run the build command in the project directory.
 * Returns { success, duration }
 */
async function runBuild(projectConfig) {
  const { source, buildCmd, name } = projectConfig;
  const spinner = ora(`Building ${name || path.basename(source)}...`).start();
  const startTime = Date.now();

  return new Promise((resolve) => {
    const isWin = process.platform === 'win32';
    const child = spawn(isWin ? 'cmd' : 'sh', [isWin ? '/c' : '-c', buildCmd], {
      cwd: source,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'production' }
    });

    let stderr = '';
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      if (code === 0) {
        spinner.succeed(`Build complete (${duration}s)`);
        resolve({ success: true, duration });
      } else {
        spinner.fail(`Build failed (exit code ${code})`);
        if (stderr.trim()) {
          logger.error(stderr.trim().split('\n').slice(-10).join('\n'));
        }
        resolve({ success: false, duration });
      }
    });

    child.on('error', (err) => {
      spinner.fail(`Build error: ${err.message}`);
      resolve({ success: false, duration: 0 });
    });
  });
}

module.exports = { runBuild };
