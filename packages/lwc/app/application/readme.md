# Application Modules Guide

This folder contains all launchable applications under `application/*`.

The single source of truth for app registration is:
- `packages/lwc/app/component/skeleton/registry/applicationRegistry.js`

The skeleton shell and left menu consume that registry, so you should only need to update one file when adding a new `application/*` app.

## Required Folder Structure

Each application should follow this structure:

```text
packages/lwc/app/application/<appFolder>/
  app/
    app.js
    app.html
    app.css (optional)
```

## How To Add A New Application

1. Create your app component in this folder:
   - `packages/lwc/app/application/<appFolder>/app/`
2. In `skeleton/registry/applicationRegistry.js`, import the module:
   - `import myApp_app from 'myApp/app';`
3. Add one entry in `APPLICATION_ENTRIES` with:
   - `name`: module name used by shell, usually `<appFolder>/app`
   - `module`: imported constructor (`myApp_app`)
   - `path`: route/menu slug (used in `applicationName`)
   - `label`: tab/menu display label
   - behavior flags (`isFullHeight`, `isDeletable`, `isOfflineAvailable`, etc.)
   - menu metadata (`menuGroup`, `menuOrder`)
4. Save and run a build:
   - `npm run build:extension:main`

## Required Metadata Fields

The minimum practical fields for a new app entry are:
- `name`
- `module`
- `path`
- `label`
- `isFullHeight`
- `isDeletable`
- `isOfflineAvailable`
- `isTabVisible`
- `menuGroup`
- `menuOrder`

## Menu Groups

Current build section groups are declared in `APPLICATION_MENU_GROUPS`:
- `data`
- `code`
- `explorers`
- `deploy`

If you need a new application group, add it to `APPLICATION_MENU_GROUPS` and then reference it from your app entry via `menuGroup`.

## Common Pitfalls

- `path` is the route key. It does not have to match folder name, but it must be unique.
- `name` must match the module loader key used by the shell (for example `metadata/app`).
- If an app should work without login, set `isOfflineAvailable: true`.
- For Chrome-only/Electron-only behavior, set `isChromeOnly` or `isElectronOnly`.
