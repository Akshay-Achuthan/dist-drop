const path = require('path');
const fs = require('fs-extra');

/**
 * Detect the frontend framework of a project directory.
 * Returns { framework, buildCmd, buildOutput } or null if not a frontend project.
 */
async function detectFramework(projectPath) {
  const pkgPath = path.join(projectPath, 'package.json');

  if (!await fs.pathExists(pkgPath)) {
    return null;
  }

  let pkg;
  try {
    pkg = await fs.readJson(pkgPath);
  } catch {
    return null;
  }

  const allDeps = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {})
  };

  // Check for config files
  const hasAngularJson = await fs.pathExists(path.join(projectPath, 'angular.json'));
  const hasVueConfig = await fs.pathExists(path.join(projectPath, 'vue.config.js'));

  // Angular
  if (hasAngularJson) {
    let projectName = pkg.name || path.basename(projectPath);
    try {
      const angularJson = await fs.readJson(path.join(projectPath, 'angular.json'));
      const defaultProject = angularJson.defaultProject;
      if (defaultProject) projectName = defaultProject;
    } catch { /* use pkg.name fallback */ }

    return {
      framework: 'angular',
      frameworkLabel: 'Angular',
      buildCmd: 'npm run build',
      buildOutput: path.join('dist', projectName)
    };
  }

  // Vue 2 (vue.config.js or @vue/cli-service)
  if (hasVueConfig || allDeps['@vue/cli-service']) {
    const isVue3 = allDeps.vue && /^\^?3\./.test(allDeps.vue);
    return {
      framework: isVue3 ? 'vue3' : 'vue2',
      frameworkLabel: isVue3 ? 'Vue 3' : 'Vue 2',
      buildCmd: 'npm run build',
      buildOutput: 'dist'
    };
  }

  // Next.js
  if (allDeps.next) {
    return {
      framework: 'nextjs',
      frameworkLabel: 'Next.js',
      buildCmd: 'npm run build && npm run export',
      buildOutput: 'out'
    };
  }

  // React with Vite
  if (allDeps['@vitejs/plugin-react']) {
    return {
      framework: 'react-vite',
      frameworkLabel: 'React (Vite)',
      buildCmd: 'npm run build',
      buildOutput: 'dist'
    };
  }

  // React CRA
  if (allDeps['react-scripts']) {
    return {
      framework: 'react-cra',
      frameworkLabel: 'React (CRA)',
      buildCmd: 'npm run build',
      buildOutput: 'build'
    };
  }

  // Vue 3 without vue.config.js (Vite-based)
  if (allDeps.vue && /^\^?3\./.test(allDeps.vue)) {
    return {
      framework: 'vue3',
      frameworkLabel: 'Vue 3',
      buildCmd: 'npm run build',
      buildOutput: 'dist'
    };
  }

  // Vue 2 without vue.config.js
  if (allDeps.vue && /^\^?2\./.test(allDeps.vue)) {
    return {
      framework: 'vue2',
      frameworkLabel: 'Vue 2',
      buildCmd: 'npm run build',
      buildOutput: 'dist'
    };
  }

  // Has a build script but no recognized framework — check if it's a backend
  if (pkg.scripts && pkg.scripts.build) {
    // Heuristic: if it has express/fastify/koa etc., it's likely a backend
    const backendIndicators = ['express', 'fastify', 'koa', 'hapi', '@nestjs/core'];
    const isBackend = backendIndicators.some(dep => allDeps[dep]);
    if (isBackend) {
      return null;
    }

    return {
      framework: 'generic',
      frameworkLabel: 'Generic',
      buildCmd: 'npm run build',
      buildOutput: 'dist'
    };
  }

  // No build script — not a buildable frontend project
  return null;
}

module.exports = { detectFramework };
