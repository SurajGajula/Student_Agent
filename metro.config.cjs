// metro.config.cjs
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Serve favicon from public folder in development
config.server = config.server || {};
config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    // Serve favicon from public folder if it exists
    if (req.url === '/favicon.png' || req.url === '/favicon.ico') {
      const publicFavicon = path.join(__dirname, 'public', 'favicon.png');
      if (fs.existsSync(publicFavicon)) {
        res.setHeader('Content-Type', 'image/png');
        return res.sendFile(publicFavicon);
      }
      // Fallback to assets folder
      const assetsFavicon = path.join(__dirname, 'assets', 'favicon.png');
      if (fs.existsSync(assetsFavicon)) {
        res.setHeader('Content-Type', 'image/png');
        return res.sendFile(assetsFavicon);
      }
    }
    return middleware(req, res, next);
  };
};

module.exports = config;
