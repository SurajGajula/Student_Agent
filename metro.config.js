import { getDefaultConfig } from '@expo/metro-config';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add support for .mjs files
config.resolver.sourceExts.push('mjs');

// Block native entry files from web builds
if (config.resolver.blockList) {
  const blockList = Array.isArray(config.resolver.blockList) 
    ? config.resolver.blockList 
    : [config.resolver.blockList];
  config.resolver.blockList = [...blockList, /src\/native\/index\.js$/];
} else {
  config.resolver.blockList = [/src\/native\/index\.js$/];
}

export default config;
