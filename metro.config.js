// Learn more https://docs.expo.dev/guides/customizing-metro
import { getDefaultConfig } from '@expo/metro-config';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add support for .web.js extensions for React Native Web
config.resolver.sourceExts.push('web.js', 'web.ts', 'web.tsx');
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// Exclude native entry files from web builds
// Use blockList to prevent Metro from processing native entry files
// Metro blockList uses regex patterns that match against absolute file paths
if (!config.resolver.blockList) {
  config.resolver.blockList = [];
}
// Block the native entry file - Metro will match this against absolute paths
config.resolver.blockList.push(/[\/\\]src[\/\\]native[\/\\]index\.js$/);

// Configure transformer for ES modules
config.transformer = {
  ...config.transformer,
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: true, // Enable ES module import support
      inlineRequires: true,
    },
  }),
};

// Explicitly disable expo-router detection
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return middleware;
  },
};

export default config;

