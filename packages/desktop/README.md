# Desktop Package

`packages/desktop` contains the Electron desktop host for this repo.

## Current Scope

The desktop package now provides:

- a package-local Electron runtime
- a secure `main` + `preload` foundation
- a typed launch-intent model for opening/focusing the app
- a small CLI wrapper to launch the desktop shell
- development mode against the local LWR server at `http://localhost:3000/app`
- packaged mode that serves the built `dist/web` bundle from a local embedded HTTP server
- a home window plus per-org instance windows backed by the `/extension` route
- desktop-backed org storage, code workspace flows, and PMD installation
- a localhost automation API on port `12346` by default for external tooling

## Parity Decisions

### Keep

- Desktop CLI launch from `packages/desktop/src/cli/desktopCli.ts`
- Org connection storage and alias management
- Per-org desktop windows via `/extension`
- External automation endpoints for opening org windows and forwarding SOQL/API/Apex/navigation requests
- Code workspace selection, retrieve, export, and analyzer flows

### Modernize

- Production renderer delivery now packages `dist/web` instead of relying on a webpack renderer bundle
- Legacy callback IPC is reduced to a small typed main-process request/response bus
- PMD setup is project-local and template-backed instead of assuming a preinstalled legacy app layout
- Electron menu/automation wiring is now owned by the desktop host instead of the old global singleton modules

### Drop

- The old dedicated localhost callback manager internals
- Webpack-specific Electron renderer packaging from the legacy desktop app
- Legacy no-op bridge pieces that only existed to support the previous app shell boot model

## Commands

From the repo root:

```sh
npm run build:desktop
npm run start:dev:desktop
npm run start:dev:desktop:all
npm run desktop:open
npm run package:desktop
npm run make:desktop
```

From this package:

```sh
npm run build
npm run build:renderer
npm run test
npm run start:dev
npm run package
npm run make
node dist/cli/desktopCli.js --org my-alias
```

## Notes

- `start:dev` waits for the local web server at `http://localhost:3000`.
- A root-level `npm install` now bootstraps `packages/desktop` as part of the repo postinstall flow.
- `package` and `make` build the production web bundle before packaging the desktop app.
- Packaged desktop builds include `dist/web` and `packages/desktop/resources` as Forge extra resources.
- GitHub publishing and macOS signing/notarization are env-driven through Forge config.
- `start:dev:desktop:all` is the easiest local workflow when the web server is not already running.
