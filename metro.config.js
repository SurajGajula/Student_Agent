// metro.config.js (ES module)
import { getDefaultConfig } from '@expo/metro-config';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add support for web extensions
config.resolver.sourceExts.push('web.js', 'web.ts', 'web.tsx');

// Ensure platforms are correct
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// Block native entry files from web builds
config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : config.resolver.blockList
    ? [config.resolver.blockList]
    : []),
  /[\/\\]src[\/\\]native[\/\\]index\.js$/,
];

// Custom resolver guard (safe)
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    platform === 'web' &&
    moduleName.replace(/\\/g, '/').includes('src/native/index.js')
  ) {
    throw new Error(`Module ${moduleName} is not available for web`);
  }
  return defaultResolveRequest(context, moduleName, platform);
};

// Transformer options (keep minimal)
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: false,
  },
});

export default config;
