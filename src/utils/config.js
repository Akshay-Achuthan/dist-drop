const path = require('path');
const fs = require('fs-extra');

const CONFIG_FILE = '.distdroprc.json';

function getConfigPath() {
  return path.join(process.cwd(), CONFIG_FILE);
}

async function loadConfig() {
  const configPath = getConfigPath();
  if (!await fs.pathExists(configPath)) {
    return null;
  }

  try {
    const config = await fs.readJson(configPath);
    if (!config.version || !config.projects) {
      return null;
    }
    return config;
  } catch {
    return null;
  }
}

async function saveConfig(config) {
  const configPath = getConfigPath();
  await fs.writeJson(configPath, config, { spaces: 2 });
  return configPath;
}

function getProject(config, name) {
  if (!config || !config.projects) return null;

  // Exact match
  if (config.projects[name]) {
    return { name, ...config.projects[name] };
  }

  // Case-insensitive match
  const key = Object.keys(config.projects).find(
    k => k.toLowerCase() === name.toLowerCase()
  );
  if (key) {
    return { name: key, ...config.projects[key] };
  }

  return null;
}

function getAllProjects(config) {
  if (!config || !config.projects) return [];
  return Object.entries(config.projects).map(([name, proj]) => ({
    name,
    ...proj
  }));
}

module.exports = { loadConfig, saveConfig, getProject, getAllProjects, CONFIG_FILE };
