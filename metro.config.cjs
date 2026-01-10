// metro.config.cjs
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Serve favicon from assets/Logo.png or public folder in development
config.server = config.server || {};
config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    // Serve favicon from assets/Logo.png, public folder, or assets/favicon.png
    if (req.url === '/favicon.png' || req.url === '/favicon.ico') {
      // First try Logo.png from assets folder
      const assetsLogo = path.join(__dirname, 'assets', 'Logo.png');
      if (fs.existsSync(assetsLogo)) {
        res.setHeader('Content-Type', 'image/png');
        return res.sendFile(assetsLogo);
      }
      // Fallback to public folder
      const publicFavicon = path.join(__dirname, 'public', 'favicon.png');
      if (fs.existsSync(publicFavicon)) {
        res.setHeader('Content-Type', 'image/png');
        return res.sendFile(publicFavicon);
      }
      // Last fallback to assets/favicon.png
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
