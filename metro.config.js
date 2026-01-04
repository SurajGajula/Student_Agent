// metro.config.js (ES module)
import { getDefaultConfig } from '@expo/metro-config';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// 1. Add support for web extensions and CSS
const extensions = ['web.js', 'web.ts', 'web.tsx', 'mjs', 'css'];
config.resolver.sourceExts = [...config.resolver.sourceExts, ...extensions];
config.resolver.platforms = ['ios', 'android', 'web'];

// 2. Block native entry files from web builds using a simpler pattern
if (!config.resolver.blockList) {
  config.resolver.blockList = [];
} else if (!Array.isArray(config.resolver.blockList)) {
  config.resolver.blockList = [config.resolver.blockList];
}
// This pattern is safer for different OS path separators
config.resolver.blockList.push(/src\/native\/index\.js$/);

// 3. Keep minimal transformer options
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

export default config;
