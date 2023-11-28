
var __defProp = Object.defineProperty;
var __markAsModule = (target) => __defProp(target, "__esModule", {value: true});
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {get: all[name], enumerable: true});
};


// packages/@lwrjs/label-module-provider/src/index.ts
__markAsModule(exports);
__export(exports, {
  default: () => src_default
});
const crypto = require("crypto");
function generateModule(value) {
  return `export default \`${value}\``;
}

const MODULE_NAME = '@process/env/';

var ProcessEnvModuleProvider = class {
    constructor({ provideDefault = false }, { config, runtimeEnvironment: { defaultLocale, lwrVersion } }) {
        this.name = 'process-env-module-provider';
        this.version = lwrVersion;
        this.provideDefault = provideDefault;
        // normalize the label directories
    }

    async getEnvInfo(specifier) {
        // Check if this provider handles given specifier package/prefix
        // Modules handled by this provider have specifiers in this form: "{package}/{labelReference}"
        const envInfo = process.env[specifier];

        if (!envInfo) {
            return undefined;
        }

        return { envReference: specifier, envValue: envInfo };
    }
    async getModuleEntry({ specifier }, runtimeParams = {}) {
      if (!specifier.startsWith(MODULE_NAME)) {
        return undefined;
      }

      const info = await this.getEnvInfo(specifier.slice(MODULE_NAME.length));

      if (info) {
        const safeReference = info.envReference.replace(/\./g, '-');
        return {
          id: `${specifier}`,
          virtual: true,
          entry: `<virtual>/@process-env/${safeReference}`,
          specifier,
          version: this.version,
        };
      }
    }
    async getModule({ specifier, namespace, name = specifier }, runtimeParams = {}) {
      // Retrieve the Module Entry
      const moduleEntry = await this.getModuleEntry({ specifier }, runtimeParams);

      if (!moduleEntry) {
        return;
      }

      const envInfo = (await this.getEnvInfo(specifier.slice(MODULE_NAME.length)));
      const compiledSource = (0, generateModule)(envInfo.envValue);
      // Construct a Compiled Module
      return {
        id: moduleEntry.id,
        specifier,
        namespace,
        name,
        version: this.version,
        originalSource: compiledSource,
        moduleEntry,
        ownHash: (0, crypto.createHash)('md5').update(compiledSource).digest('hex'),
        compiledSource,
      };
    }
}
var src_default = ProcessEnvModuleProvider;