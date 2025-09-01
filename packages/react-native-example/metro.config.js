const { makeMetroConfig } = require('@rnx-kit/metro-config');
const { resolve } = require('metro-resolver');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const pack = require('../../packages/router/package.json');
const modules = Object.keys(pack.peerDependencies);

const extraConfig = {
  watchFolders: [root],
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
  resolver: {
    unstable_enableSymlinks: true,
    resolveRequest: (context, moduleName, platform) => {
      if (moduleName === '@sigmela/router') {
        return {
          type: 'sourceFile',
          filePath: path.join(root, 'packages', 'router', 'src', 'index.ts'),
        };
      }
      return resolve(context, moduleName, platform);
    },
    extraNodeModules: modules.reduce((acc, name) => {
      acc[name] = path.join(__dirname, 'node_modules', name);
      return acc;
    }),
  },
};

const metroConfig = makeMetroConfig(extraConfig);

module.exports = metroConfig;
