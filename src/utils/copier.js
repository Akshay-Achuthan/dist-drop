const path = require('path');
const fs = require('fs-extra');
const ora = require('ora');

/**
 * Copy build output to WAR target directory.
 * Returns { fileCount, totalSize }
 */
async function copyToTarget(projectConfig) {
  const { source, buildOutput, target } = projectConfig;
  const srcDir = path.join(source, buildOutput);
  const spinner = ora('Copying files to target...').start();

  // Verify source build output exists
  if (!await fs.pathExists(srcDir)) {
    spinner.fail(`Build output not found: ${srcDir}`);
    return { success: false, fileCount: 0, totalSize: 0 };
  }

  try {
    // Ensure target directory exists, then clear it
    await fs.ensureDir(target);
    await fs.emptyDir(target);

    // Copy all files
    await fs.copy(srcDir, target);

    // Count files and total size
    const stats = await getDirectoryStats(target);
    spinner.succeed(`Copied ${stats.fileCount} files (${formatSize(stats.totalSize)}) to target`);

    return { success: true, ...stats };
  } catch (err) {
    spinner.fail(`Copy failed: ${err.message}`);
    return { success: false, fileCount: 0, totalSize: 0 };
  }
}

/**
 * Copy only files that changed since the given timestamp.
 * Returns { fileCount, totalSize }
 */
async function copyIncremental(projectConfig, sinceTimestamp) {
  const { source, buildOutput, target } = projectConfig;
  const srcDir = path.join(source, buildOutput);
  const spinner = ora('Copying changed files...').start();

  if (!await fs.pathExists(srcDir)) {
    spinner.fail(`Build output not found: ${srcDir}`);
    return { success: false, fileCount: 0, totalSize: 0 };
  }

  try {
    await fs.ensureDir(target);
    const stats = await copyChangedFiles(srcDir, target, sinceTimestamp);
    spinner.succeed(`Copied ${stats.fileCount} changed files (${formatSize(stats.totalSize)})`);
    return { success: true, ...stats };
  } catch (err) {
    spinner.fail(`Incremental copy failed: ${err.message}`);
    return { success: false, fileCount: 0, totalSize: 0 };
  }
}

async function copyChangedFiles(srcDir, destDir, since) {
  let fileCount = 0;
  let totalSize = 0;

  const items = await fs.readdir(srcDir, { withFileTypes: true });
  for (const item of items) {
    const srcPath = path.join(srcDir, item.name);
    const destPath = path.join(destDir, item.name);

    if (item.isDirectory()) {
      const sub = await copyChangedFiles(srcPath, destPath, since);
      fileCount += sub.fileCount;
      totalSize += sub.totalSize;
    } else {
      const stat = await fs.stat(srcPath);
      if (stat.mtimeMs > since) {
        await fs.ensureDir(destDir);
        await fs.copy(srcPath, destPath);
        fileCount++;
        totalSize += stat.size;
      }
    }
  }

  return { fileCount, totalSize };
}

async function getDirectoryStats(dir) {
  let fileCount = 0;
  let totalSize = 0;

  const items = await fs.readdir(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      const sub = await getDirectoryStats(fullPath);
      fileCount += sub.fileCount;
      totalSize += sub.totalSize;
    } else {
      const stat = await fs.stat(fullPath);
      fileCount++;
      totalSize += stat.size;
    }
  }

  return { fileCount, totalSize };
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

module.exports = { copyToTarget, copyIncremental, formatSize };
