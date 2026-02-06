const path = require('path');
const fs = require('fs');

// Environment variables must be set directly (via export, EC2, Docker, etc.)
// No .env file loading - use environment variables only

// Read values directly from environment variables
// Try EXPO_PUBLIC_ prefix first (standard for Expo web), then fallback to others
// IMPORTANT: For Amplify builds, variables must be available to the Node.js process
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;


const stripePublishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || process.env.STRIPE_PUBLISHABLE_KEY || process.env.VITE_STRIPE_PUBLISHABLE_KEY;
// Default to production URL for mobile apps (iOS/Android builds), localhost only for development
const isProduction = process.env.NODE_ENV === 'production' || !process.env.EXPO_PUBLIC_API_URL;
const apiUrl = process.env.EXPO_PUBLIC_API_URL || process.env.API_URL || process.env.VITE_API_URL || 
  (isProduction ? 'https://studentagent.site' : 'http://localhost:3001');


const expoConfig = {
  name: "Student Agent",
  slug: "student-agent",
  version: "1.0.1",
  orientation: "portrait",
  userInterfaceStyle: "light",
  splash: {
    resizeMode: "contain",
    backgroundColor: "#f0f0f0"
  },
};

// Use Logo.png from assets folder as app icon
if (fs.existsSync('./assets/Logo.png')) {
  expoConfig.icon = "./assets/Logo.png";
} else if (fs.existsSync('./AppStore/Logo.png')) {
  expoConfig.icon = "./AppStore/Logo.png";
} else if (fs.existsSync('./assets/icon.png')) {
  expoConfig.icon = "./assets/icon.png";
}

// Only add splash image if file exists
if (fs.existsSync('./assets/splash.png')) {
  expoConfig.splash.image = "./assets/splash.png";
}

module.exports = {
  expo: {
    ...expoConfig,
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.sfstudio.studentagent.app",
      buildNumber: "2",
      orientation: "portrait"
    },
    android: {
      package: "com.sfstudio.studentagent.app",
      versionCode: 2,
      orientation: "portrait",
      ...(fs.existsSync('./assets/adaptive-icon.png') && {
        adaptiveIcon: {
          foregroundImage: "./assets/adaptive-icon.png",
          backgroundColor: "#f0f0f0"
        }
      })
    },
    web: {
      favicon: fs.existsSync('./assets/Logo.png') ? "./assets/Logo.png" : 
               (fs.existsSync('./AppStore/Logo.png') ? "./AppStore/Logo.png" : 
               (fs.existsSync('./assets/favicon.png') ? "./assets/favicon.png" : undefined)),
      bundler: "metro",
      entryPoint: "./index.web.js",
      // Disable service worker to avoid cache errors
      serviceWorker: false,
    },
    experiments: {
      typedRoutes: false
    },
    scheme: "studentagent",
    extra: {
      // Support both old VITE_/EXPO_PUBLIC_ prefixes and new SUPABASE_ prefix
      // Always include these keys (even if empty) so we can debug
      supabaseUrl: supabaseUrl || '',
      supabaseAnonKey: supabaseAnonKey || '',
      ...(stripePublishableKey && { stripePublishableKey }),
      apiUrl: apiUrl,
      eas: {
        projectId: ""
      }
    }
  }
};

