const fs = require('node:fs');
const path = require('node:path');

const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const { MakerDMG } = require('@electron-forge/maker-dmg');
const { MakerZIP } = require('@electron-forge/maker-zip');
const { AutoUnpackNativesPlugin } = require('@electron-forge/plugin-auto-unpack-natives');
const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { PublisherGithub } = require('@electron-forge/publisher-github');

const repoRoot = path.resolve(__dirname, '../..');
const packagedWebRoot = path.join(repoRoot, 'dist', 'web');
const desktopResourcesRoot = path.join(__dirname, 'resources');
const configuredIcon = process.env.DESKTOP_APP_ICON;
const hasConfiguredIcon = configuredIcon && fs.existsSync(configuredIcon);

const publishers = process.env.GITHUB_TOKEN
    ? [
          new PublisherGithub({
              authToken: process.env.GITHUB_TOKEN,
              prerelease: process.env.GITHUB_PRERELEASE === 'true',
              repository: {
                  name: process.env.GITHUB_REPOSITORY_NAME || 'sf-toolkit-web',
                  owner: process.env.GITHUB_REPOSITORY_OWNER || 'grebmann',
              },
          }),
      ]
    : [];

module.exports = {
    packagerConfig: {
        asar: true,
        appBundleId: 'com.sftoolkit.desktop',
        appCategoryType: 'public.app-category.developer-tools',
        executableName: 'Workbench Desktop',
        extraResource: [packagedWebRoot, desktopResourcesRoot],
        ignore: [/^\/src($|\/)/, /^\/resources($|\/)/],
        name: 'Workbench Desktop',
        osxNotarize:
            process.env.APPLE_ID && process.env.APPLE_ID_PASSWORD && process.env.APPLE_TEAM_ID
                ? {
                      appleId: process.env.APPLE_ID,
                      appleIdPassword: process.env.APPLE_ID_PASSWORD,
                      teamId: process.env.APPLE_TEAM_ID,
                  }
                : undefined,
        osxSign:
            process.env.APPLE_SIGN_IDENTITY || process.env.APPLE_TEAM_ID
                ? {
                      identity: process.env.APPLE_SIGN_IDENTITY || undefined,
                      hardenedRuntime: true,
                      signatureFlags: 'library',
                      teamId: process.env.APPLE_TEAM_ID || undefined,
                  }
                : undefined,
        ...(hasConfiguredIcon ? { icon: configuredIcon } : {}),
    },
    rebuildConfig: {},
    makers: [new MakerDMG({}, ['darwin']), new MakerZIP({}, ['darwin'])],
    publishers,
    plugins: [
        new AutoUnpackNativesPlugin(),
        new FusesPlugin({
            version: FuseVersion.V1,
            [FuseV1Options.RunAsNode]: false,
            [FuseV1Options.EnableCookieEncryption]: true,
            [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
            [FuseV1Options.EnableNodeCliInspectArguments]: false,
            [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
            [FuseV1Options.OnlyLoadAppFromAsar]: true,
        }),
    ],
};
