# Migrating Chrome Extension Build from Rollup to Vite

## Overview
This document details the step-by-step process to migrate the Chrome extension build system from Rollup to Vite. The goal is to improve build speed, modernize the toolchain, and simplify configuration, while maintaining all current features and outputs.

---

## 1. Motivation & Benefits

**Why migrate to Vite?**
- **Faster builds and hot reloads** thanks to native ES modules and optimized dev server.
- **Simpler configuration** for multi-entry builds and static asset handling.
- **Better plugin ecosystem** and future-proofing.
- **Improved DX** with instant feedback and modern error overlays.
- **Easier maintenance** as Vite is now the standard for modern web tooling.

---

## 2. Analyze Current Rollup Setup

### Entry Points
- `src/client_chrome/main.js` → `chrome_ext/scripts/`
- `src/client_chrome/workers/background.js` → `chrome_ext/scripts/background.js`
- `src/client_chrome/inject/inject_salesforce.js` → `chrome_ext/scripts/inject_salesforce.js`
- `src/client_chrome/inject/inject_toolkit.js` → `chrome_ext/scripts/inject_toolkit.js`

### Static Assets Copied
- `src/client/assets/styles/`, `src/client/assets/libs/`, `src/client/assets/images/`, `src/client/assets/releaseNotes.json`
- `node_modules/@salesforce-ux/design-system/assets/`
- `src/client_chrome/views/`, `src/client_chrome/scripts/`, `src/client_chrome/images/`
- `manifest.json` (with dynamic replacements)

### Plugins Used
- LWC plugin for Lightning Web Components
- Node polyfills
- PostCSS
- Alias, replace, copy

---

## 3. Migration Plan (Detailed)

### Step 1: Install Vite and Plugins

Run the following commands to install Vite and all required plugins:

```sh
npm install --save-dev vite vite-plugin-static-copy @rollup/plugin-replace
# For LWC support (if available):
npm install --save-dev vite-plugin-lwc
# For Node polyfills (if needed):
npm install --save-dev vite-plugin-node-polyfills
```

> **Note:** If `vite-plugin-lwc` is not available or not compatible, you may need to adapt the Rollup LWC plugin or use a custom loader. See the [LWC OSS](https://github.com/salesforce/lwc) repo for updates.

### Step 2: Create `vite.config.js`

- Define all entry points under `build.rollupOptions.input`.
- Use `vite-plugin-static-copy` for all static assets and HTML files.
- Use the `transform` option for `manifest.json` to inject the correct icon and version.
- Configure the LWC plugin for all LWC directories.
- Add aliases for any custom import paths.
- Add node polyfills if your code relies on Node built-ins.

#### Example: Handling Service/Background Workers
- Vite supports building workers via multi-entry. If you use `importScripts` or dynamic imports, test these flows after migration.
- For Manifest V3, background scripts must be ES modules. Vite outputs ESM by default, but check for compatibility.

#### Example: CSP and Manifest Caveats
- Chrome extensions have strict Content Security Policies (CSP). Avoid inline scripts/styles and use only allowed features.
- Vite injects some dev scripts in development mode; always test the extension in production build mode.

### Step 3: Update NPM Scripts

Update your `package.json` scripts:

```json
"scripts": {
  "build:extension": "vite build --config vite.config.js",
  "dev:extension": "vite --config vite.config.js",
  // Remove old Rollup scripts
}
```

Remove any Rollup-specific scripts and dependencies after migration is complete.

### Step 4: Refactor Imports/Polyfills
- Replace any Rollup-specific import patterns (e.g., `import.meta.url` handling is different in Vite).
- If you use Node built-ins (e.g., `path`, `fs`), ensure you polyfill or refactor for browser compatibility.
- Test all LWC imports and dynamic component loading.

### Step 5: Test the Build
- Run `npm run build:extension` and verify all outputs in `chrome_ext/` match the previous Rollup build.
- Load the extension in Chrome (chrome://extensions, enable Developer Mode, Load Unpacked, select `chrome_ext/`).
- Test all features: background, inject scripts, UI, static assets, and manifest.
- For development, use `npm run dev:extension` and test hot reload (note: some extension APIs may not work in dev mode).

### Step 6: Clean Up
- Remove `rollup.config.mjs` and all Rollup-related plugins from `devDependencies`.
- Update onboarding and developer documentation to reference Vite.
- Optionally, keep Rollup config for a short period to allow rollback if issues arise.

### Step 7: Rollback Plan & Parallel Builds
- During migration, you can keep both Rollup and Vite configs/scripts.
- Use separate output folders (e.g., `chrome_ext_rollup/` and `chrome_ext/`) to compare builds.
- Once Vite is validated, remove Rollup entirely.

---

## 4. Example `vite.config.js` (Expanded)

```js
import { defineConfig } from 'vite';
import lwc from 'vite-plugin-lwc'; // or custom plugin
import { viteStaticCopy } from 'vite-plugin-static-copy';
import replace from '@rollup/plugin-replace';
import path from 'path';
import fs from 'fs';

const isProduction = process.env.NODE_ENV === 'production';
const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));

export default defineConfig({
  root: '.',
  build: {
    outDir: 'chrome_ext',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'src/client_chrome/main.js'),
        background: path.resolve(__dirname, 'src/client_chrome/workers/background.js'),
        inject_salesforce: path.resolve(__dirname, 'src/client_chrome/inject/inject_salesforce.js'),
        inject_toolkit: path.resolve(__dirname, 'src/client_chrome/inject/inject_toolkit.js'),
      },
      output: {
        entryFileNames: 'scripts/[name].js',
        chunkFileNames: 'scripts/[name]-[hash].js',
        assetFileNames: 'assets/[name][extname]',
        format: 'esm',
        sourcemap: true,
      },
    },
    sourcemap: true,
    emptyOutDir: true,
  },
  plugins: [
    lwc({
      enableDynamicComponents: true,
      modules: [
        { dir: 'src/client_chrome/components' },
        { dir: 'src/client/lwc/modules' },
        { dir: 'src/client/lwc/components' },
        { dir: 'src/client/lwc/applications/documentation' },
        { dir: 'src/client/lwc/applications/explorers' },
        // add more as needed
      ],
    }),
    replace({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
      'process.env.IS_CHROME': true,
      preventAssignment: true,
      'import.meta.url': '""',
    }),
    viteStaticCopy({
      targets: [
        { src: 'src/client/assets/styles', dest: '.' },
        { src: 'src/client/assets/libs', dest: '.' },
        { src: 'src/client/assets/images', dest: '.' },
        { src: 'src/client/assets/releaseNotes.json', dest: '.' },
        { src: 'node_modules/@salesforce-ux/design-system/assets', dest: '.' },
        { src: 'src/client_chrome/views', dest: '.' },
        { src: 'src/client_chrome/scripts', dest: '.' },
        { src: 'src/client_chrome/images', dest: '.' },
        {
          src: 'manifest.json',
          dest: '.',
          transform: (contents) => {
            let newContents = contents.toString();
            newContents = newContents.replace(
              '__buildLogo__',
              isProduction ? 'images/sf-toolkit-icon-128.png' : 'images/sf-toolkit-icon-128-dev.png'
            );
            newContents = newContents.replace('__buildVersion__', pkg.version);
            return newContents;
          },
        },
      ],
    }),
    // Add node polyfills if needed
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // add more aliases as needed
    },
  },
});
```

---

## 5. Migration Checklist
- [ ] Install Vite and plugins
- [ ] Create `vite.config.js` with all entry points and asset copies
- [ ] Update npm scripts
- [ ] Remove Rollup config and dependencies
- [ ] Test build and extension in Chrome
- [ ] Update documentation
- [ ] Validate LWC compatibility and dynamic imports
- [ ] Test background/inject scripts and static asset loading
- [ ] Compare output with Rollup build for parity

---

## 6. Troubleshooting & Tips (Expanded)
- **LWC Support:** If no official Vite plugin, adapt the Rollup LWC plugin or use a custom loader. See [LWC OSS Issues](https://github.com/salesforce/lwc/issues) for community solutions.
- **Manifest Transform:** Use the `transform` option in static copy or a custom plugin for dynamic replacements. Validate the manifest in Chrome after build.
- **Polyfills:** Use Vite plugins for Node polyfills if needed for legacy code. Test for missing globals (e.g., `Buffer`, `process`).
- **Multi-Entry:** Use Vite's `build.rollupOptions.input` for multiple entry points. Each entry becomes a separate output file.
- **Static Assets:** Use `vite-plugin-static-copy` for all non-JS assets. Double-check asset paths in the built extension.
- **Testing:** Always compare the output structure and test in Chrome before removing Rollup. Use Chrome's extension errors console for debugging.
- **CSP Issues:** If you see CSP errors, check for inline scripts/styles or eval usage. Refactor to use external files only.
- **Background/Service Workers:** For Manifest V3, background scripts must be ESM. Test worker registration and messaging.
- **Dev Mode Limitations:** Some extension APIs may not work in Vite dev server mode. Always test a production build.

---

## 7. Rollup vs Vite Config Mapping (Summary Table)

| Feature/Plugin         | Rollup Config                | Vite Config/Plugin                |
|------------------------|------------------------------|-----------------------------------|
| Entry Points           | `input` array/object         | `build.rollupOptions.input`        |
| Output Dir             | `output.dir`/`output.file`   | `build.outDir`                    |
| LWC Plugin             | `@lwc/rollup-plugin`         | `vite-plugin-lwc` (or custom)      |
| Static Copy            | `rollup-plugin-copy`         | `vite-plugin-static-copy`          |
| Replace                | `@rollup/plugin-replace`     | `@rollup/plugin-replace`           |
| Node Polyfills         | `rollup-plugin-polyfill-node`| `vite-plugin-node-polyfills`       |
| PostCSS                | `rollup-plugin-postcss`      | Vite built-in or plugin            |
| Aliases                | `@rollup/plugin-alias`       | `resolve.alias`                    |
| Manifest Transform     | `copy.transform`             | `viteStaticCopy.transform`         |

---

## 8. FAQ: Common Migration Issues

**Q: My extension doesn't load in Chrome after migration.**
- Check the output structure and ensure all scripts/assets are in the correct place.
- Validate `manifest.json` and check for missing or misnamed files.

**Q: LWC components fail to load or render.**
- Ensure all LWC modules are included in the plugin config.
- Check for plugin compatibility or missing dependencies.

**Q: Background or inject scripts don't run.**
- Confirm entry points and output filenames match what `manifest.json` expects.
- For background scripts, ensure ESM output for Manifest V3.

**Q: Static assets (images, CSS) are missing.**
- Double-check `vite-plugin-static-copy` targets and output paths.
- Use absolute or relative paths as needed in your code.

**Q: I see CSP errors in the console.**
- Refactor to avoid inline scripts/styles. Use only external files.

---

## 9. How to Contribute to the New Build System
- All build config is now in `vite.config.js`. Please:
  - Document any changes in this file.
  - Add new entry points or asset copy rules as needed.
  - Test changes in both dev and production modes.
  - Update this migration doc with lessons learned or new troubleshooting tips.
- For major changes, open a PR and request review from the core maintainers.

---

## 10. References & Further Reading
- [Vite Documentation](https://vitejs.dev/)
- [vite-plugin-static-copy](https://github.com/sapphi-red/vite-plugin-static-copy)
- [LWC OSS](https://github.com/salesforce/lwc)
- [Chrome Extension Vite Example](https://github.com/antfu/vite-plugin-chrome-extension)
- [Chrome Extension Manifest V3 Docs](https://developer.chrome.com/docs/extensions/mv3/)
- [Vite Plugin List](https://vitejs.dev/plugins/)

---

## Next Steps
1. **Prototype the Vite config and test a build.**
2. **Iterate on plugin compatibility (especially LWC).**
3. **Update all scripts and documentation.**
4. **Remove Rollup and legacy configs.** 