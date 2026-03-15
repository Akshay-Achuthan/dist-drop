# dist-drop

CLI tool to automate frontend builds and copy to your WAR server (Wildfly, Weblogic, Tomcat).

## Problem

When developing frontend apps (Vue, React, Angular, etc.) embedded inside legacy Java WARs, every small change requires:

1. `npm run build` in the frontend project
2. Manually copy `dist/` or `build/` to the correct folder inside the WAR
3. Check if it works in the legacy app

This is repetitive and error-prone — folder names don't always match, build output folders vary by framework, and developers waste 3-5 minutes per cycle.

## Solution

A one-time interactive setup (`dist-drop init`) auto-detects your frontend project, then `dist-drop sync` or `dist-drop watch` handles the rest.

## Installation

```bash
npm install -g dist-drop
```

After installing, the `dist-drop` command is available globally.

## Commands

### `dist-drop init` — Interactive Setup

Set up your frontend project and WAR target path:

```bash
dist-drop init
```

**First time:** Asks for your frontend app path and WAR target path, auto-detects framework, saves config.

**Already configured:** Shows options to add, edit, or remove projects.

**Auto-detection supports:**

| Framework | Detection | Build Output |
|-----------|-----------|-------------|
| Vue 2/3 | `vue.config.js` or `@vue/cli-service` | `dist/` |
| React (CRA) | `react-scripts` | `build/` |
| React (Vite) | `@vitejs/plugin-react` | `dist/` |
| Angular | `angular.json` | `dist/<project>/` |
| Next.js | `next` in package.json | `out/` |
| Generic | Fallback | `dist/` |

### `dist-drop sync [project]` — Build + Drop

```bash
# Sync a specific project
dist-drop sync ui_b2b

# Sync all configured projects
dist-drop sync --all
```

Three sync modes:
- **Full Build + Drop** — `npm run build` then copy all files
- **Drop Only** — skip build, copy existing build output
- **Incremental Drop** — copy only files changed since last sync

### `dist-drop watch <project>` — Auto Sync on Save

```bash
dist-drop watch ui_b2b
```

Watches `src/` and `public/` for changes. On save: debounce 500ms, build, copy. Press Ctrl+C to stop.

### `dist-drop list` — Show Configured Projects

```bash
dist-drop list
```

Lists all configured projects with framework, source, target, and build status.

## Config File

`.distdroprc.json` is created in your working directory after running `dist-drop init`:

```json
{
  "version": 1,
  "warBase": "/path/to/wildfly/standalone/deployments/app.war",
  "projects": {
    "ui_b2b": {
      "source": "/path/to/your/frontend/ui_b2b",
      "framework": "vue2",
      "buildCmd": "npm run build",
      "buildOutput": "dist",
      "target": "/path/to/wildfly/standalone/deployments/app.war/Framewrk/B2B"
    }
  }
}
```

See `.distdroprc.example.json` for a template.

## Target Detection

During setup, dist-drop checks the WAR target folder:
- Has `dist/` inside → copies build output into `target/dist/`
- Has `index.html` or `css/` + `js/` → copies directly into target
- Empty folder → copies directly (first deploy)

## License

MIT

## Author

Akshay Achuthan
