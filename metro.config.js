// metro.config.js (ES module)
import { getDefaultConfig } from '@expo/metro-config';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname, {
  // [Web-only]: Enables CSS support in Metro.
  isCSSEnabled: true,
});

// 1. Support for web extensions and CSS
// We use a spread to ensure we don't accidentally mutate the original array in a weird way
// and we add 'css' to the BEGINNING to prioritize it.
config.resolver.sourceExts = ['css', 'web.js', 'web.ts', 'web.tsx', 'mjs', ...config.resolver.sourceExts];
config.resolver.assetExts = config.resolver.assetExts.filter(ext => ext !== 'css');

// 2. Block native entry files from web builds
if (!config.resolver.blockList) {
  config.resolver.blockList = [];
} else if (!Array.isArray(config.resolver.blockList)) {
  config.resolver.blockList = [config.resolver.blockList];
}
config.resolver.blockList.push(/src\/native\/index\.js$/);

// 3. Ensure the transformer handles ES modules correctly
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

export default config;
