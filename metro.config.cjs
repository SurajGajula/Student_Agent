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
    // Handle favicon requests to prevent 500 errors
    if (req.url === '/favicon.png' || req.url === '/favicon.ico') {
      // First try Logo.png from assets folder
      const assetsLogo = path.join(__dirname, 'assets', 'Logo.png');
      if (fs.existsSync(assetsLogo)) {
        try {
          const fileData = fs.readFileSync(assetsLogo);
          res.setHeader('Content-Type', 'image/png');
          res.setHeader('Content-Length', fileData.length);
          res.statusCode = 200;
          return res.end(fileData);
        } catch (err) {
          // If file read fails, return 204 No Content to suppress error
          res.statusCode = 204;
          return res.end();
        }
      }
      // Fallback to public folder
      const publicFavicon = path.join(__dirname, 'public', 'favicon.png');
      if (fs.existsSync(publicFavicon)) {
        try {
          const fileData = fs.readFileSync(publicFavicon);
          res.setHeader('Content-Type', 'image/png');
          res.setHeader('Content-Length', fileData.length);
          res.statusCode = 200;
          return res.end(fileData);
        } catch (err) {
          // If file read fails, return 204 No Content to suppress error
          res.statusCode = 204;
          return res.end();
        }
      }
      // Last fallback to assets/favicon.png
      const assetsFavicon = path.join(__dirname, 'assets', 'favicon.png');
      if (fs.existsSync(assetsFavicon)) {
        try {
          const fileData = fs.readFileSync(assetsFavicon);
          res.setHeader('Content-Type', 'image/png');
          res.setHeader('Content-Length', fileData.length);
          res.statusCode = 200;
          return res.end(fileData);
        } catch (err) {
          // If file read fails, return 204 No Content to suppress error
          res.statusCode = 204;
          return res.end();
        }
      }
      // If no favicon found, return 204 No Content to suppress browser error
      res.statusCode = 204;
      return res.end();
    }
    return middleware(req, res, next);
  };
};

module.exports = config;
