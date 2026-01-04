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

// Disable router transforms (we're not using expo-router)
config.transformer = {
  ...config.transformer,
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false,
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

