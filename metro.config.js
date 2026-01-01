// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('@expo/metro-config');

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

module.exports = config;

