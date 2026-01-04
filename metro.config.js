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
config.resolver.sourceExts.push('web.js', 'web.ts', 'web.tsx', 'mjs', 'css');
config.resolver.assetExts.push('css');

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
