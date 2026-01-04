// Learn more https://docs.expo.dev/guides/customizing-metro
import { getDefaultConfig } from '@expo/metro-config';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add support for .web.js and .web.mjs extensions for React Native Web
config.resolver.sourceExts.push('web.mjs', 'web.js', 'web.ts', 'web.tsx');
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// Exclude native entry files from web builds
// Use blockList to prevent Metro from processing native entry files
// Metro blockList uses regex patterns that match against absolute file paths
if (!config.resolver.blockList) {
  config.resolver.blockList = [];
} else if (!Array.isArray(config.resolver.blockList)) {
  // If blockList is not an array (e.g., it's a RegExp), convert it to an array
  config.resolver.blockList = [config.resolver.blockList];
}
// Block the native entry file - Metro will match this against absolute paths
// Match both forward and backslashes, and match anywhere in the path
config.resolver.blockList.push(/[\/\\]src[\/\\]native[\/\\]index\.js$/);
config.resolver.blockList.push(/src[\/\\]native[\/\\]index\.js$/);

// Also use a custom resolver to explicitly prevent resolving this file for web
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Block native entry file for web builds
  if (platform === 'web') {
    const normalizedModuleName = moduleName.replace(/\\/g, '/');
    if (
      normalizedModuleName === './src/native/index.js' ||
      normalizedModuleName === 'src/native/index.js' ||
      normalizedModuleName.endsWith('/src/native/index.js') ||
      normalizedModuleName.includes('src/native/index.js')
    ) {
      // Throw an error that Metro can handle - this will prevent the file from being resolved
      throw new Error(`Module ${moduleName} is not available for web platform`);
    }
  }
  // Use default resolver for everything else
  return defaultResolveRequest(context, moduleName, platform);
};

// Configure transformer to handle ES modules correctly for web builds
config.transformer = {
  ...config.transformer,
  // Disable module wrapping for web builds to prevent minification issues with ES modules
  unstable_disableModuleWrapping: true,
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: false, // Disable inline requires to avoid wrapping issues
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

