import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerPKG } from '@electron-forge/maker-pkg';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import fs from 'fs';
import path from 'path';

import dotenv from 'dotenv';
dotenv.config();

const isDarwin = process.platform == 'darwin';
const isMas = isDarwin && process.argv.includes('mas');
let osxPackagerConfig = {}
let osxMaker = null

if (isDarwin) {
  if (!isMas) {
    osxMaker = new MakerZIP({}, ['darwin'])
    osxPackagerConfig = {
      osxSign: {
        identity: process.env.IDENTIFY_DARWIN_CODE,
        provisioningProfile: './build/Witsy_Darwin.provisionprofile',
        optionsForFile: () => { return {
          hardenedRuntime: true,
          entitlements: './build/Entitlements.darwin.plist'
        }; },
      },
      osxNotarize: {
        appleId: process.env.APPLE_ID,
        appleIdPassword: process.env.APPLE_PASSWORD,
        teamId: process.env.APPLE_TEAM_ID
      }
    }
  } else {
    osxMaker = new MakerPKG({ identity: process.env.IDENTITY_MAS_PKG, })
    osxPackagerConfig = {
      osxUniversal: {
      },
      osxSign: {
        identity: process.env.IDENTITY_MAS_CODE,
        provisioningProfile: './build/Witsy_MAS.provisionprofile',
        optionsForFile: () => { return {
          hardenedRuntime: true,
          entitlements: './build/Entitlements.mas.plist'
        }; },
      },
    }
  }
}

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    icon: 'assets/icon',
    executableName: 'Witsy',
    appBundleId: 'com.nabocorp.witsy',
    extendInfo: './build/Info.plist',
    buildVersion: `${process.env.BUILD_NUMBER}`,
    ...osxPackagerConfig,
  },
  rebuildConfig: {},
  makers: [new MakerSquirrel({}), osxMaker, new MakerRpm({}), new MakerDeb({})],
  plugins: [
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/main.ts',
          config: 'vite.main.config.ts',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.ts',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
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
  hooks: {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    packageAfterPrune: async (forgeConfig, buildPath, electronVersion, platform, arch) => {
      fs.unlinkSync(path.join(buildPath, 'node_modules/@iktakahiro/markdown-it-katex/node_modules/.bin/katex'))
    }
  }
};

export default config;
