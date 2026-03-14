# dist-drop

Framework-agnostic CLI tool that automates building frontend apps and copying build output into legacy Java WARs (Wildfly, Weblogic, Tomcat).

## Problem

When developing frontend apps (Vue, React, Angular, etc.) embedded inside legacy Java WARs, every small change requires:

1. `npm run build` in the frontend project
2. Manually copy `dist/` or `build/` to the correct folder inside the WAR
3. Check if it works in the legacy app

This is repetitive and error-prone — folder names don't always match, build output folders vary by framework, and developers waste 3-5 minutes per cycle.

## Solution

A one-time interactive setup (`dist-drop init`) auto-detects your frontend projects, then `dist-drop sync` or `dist-drop watch` handles the rest.

## Installation

```bash
cd D:\Learnings\dist-drop
npm install
npm link
```

After `npm link`, the `dist-drop` command is available globally.

## Commands

### `dist-drop init` — Interactive Setup

Auto-detects frontend projects in a directory and creates `.distdroprc.json`:

```bash
dist-drop init
```

**Auto-detection supports:**

| Framework | Detection | Build Output |
|-----------|-----------|-------------|
| Vue 2/3 | `vue.config.js` or `@vue/cli-service` | `dist/` |
| React (CRA) | `react-scripts` | `build/` |
| React (Vite) | `@vitejs/plugin-react` | `dist/` |
| Angular | `angular.json` | `dist/<project>/` |
| Next.js | `next` in package.json | `out/` |
| Generic | Fallback | User specifies |

### `dist-drop sync [project]` — Build + Drop

```bash
# Sync a specific project
dist-drop sync ui_swift

# Sync all configured projects
dist-drop sync --all
```

Three sync modes:
- **Full Build + Drop** — `npm run build` then copy all files
- **Drop Only** — skip build, copy existing build output
- **Incremental Drop** — copy only files changed since last sync

### `dist-drop watch <project>` — Auto Sync on Save

```bash
dist-drop watch ui_k2_retail
```

Watches `src/` and `public/` for changes. On save: debounce 500ms, build, copy. Press Ctrl+C to stop.

### `dist-drop status` — Show Config

```bash
dist-drop status
```

Lists all configured projects with framework, source, target, and build status.

## Config File

`.distdroprc.json` is created in your working directory:

```json
{
  "version": 1,
  "warBase": "D:/wildfly-8.2.0.Final/standalone/deployments/ing_uat.war",
  "projects": {
    "ui_swift": {
      "source": "D:/credence/MERCURYFX/Apps/KOTAK/ui_swift",
      "framework": "vue2",
      "buildCmd": "npm run build",
      "buildOutput": "dist",
      "target": "D:/wildfly-8.2.0.Final/standalone/deployments/ing_uat.war/ui_swift/dist"
    }
  }
}
```

## Author

Akshay Achuthan
