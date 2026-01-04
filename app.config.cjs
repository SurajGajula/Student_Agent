const path = require('path');
const fs = require('fs');

// Environment variables must be set directly (via export, EC2, Docker, etc.)
// No .env file loading - use environment variables only

// Read values directly from environment variables
// Try EXPO_PUBLIC_ prefix first (standard for Expo web), then fallback to others
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const stripePublishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || process.env.STRIPE_PUBLISHABLE_KEY || process.env.VITE_STRIPE_PUBLISHABLE_KEY;
const apiUrl = process.env.EXPO_PUBLIC_API_URL || process.env.API_URL || process.env.VITE_API_URL || 'http://localhost:3001';

// Debug logging (only in build, not in runtime)
if (process.env.NODE_ENV !== 'production' || process.env.AMPLIFY_BUILD) {
  console.log('Environment variables check:');
  console.log('EXPO_PUBLIC_SUPABASE_URL:', process.env.EXPO_PUBLIC_SUPABASE_URL ? '✓' : '✗');
  console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? '✓' : '✗');
  console.log('EXPO_PUBLIC_SUPABASE_ANON_KEY:', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ? '✓' : '✗');
  console.log('SUPABASE_PUBLISHABLE_KEY:', process.env.SUPABASE_PUBLISHABLE_KEY ? '✓' : '✗');
  console.log('Resolved supabaseUrl:', supabaseUrl ? '✓' : '✗');
  console.log('Resolved supabaseAnonKey:', supabaseAnonKey ? '✓' : '✗');
}

const expoConfig = {
  name: "Student Agent",
  slug: "student-agent",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "light",
  splash: {
    resizeMode: "contain",
    backgroundColor: "#f0f0f0"
  },
};

// Only add icon if file exists (required for prebuild)
if (fs.existsSync('./assets/icon.png')) {
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
      bundleIdentifier: "com.studentagent.app"
    },
    android: {
      package: "com.studentagent.app",
      ...(fs.existsSync('./assets/adaptive-icon.png') && {
        adaptiveIcon: {
          foregroundImage: "./assets/adaptive-icon.png",
          backgroundColor: "#f0f0f0"
        }
      })
    },
    web: {
      ...(fs.existsSync('./assets/favicon.png') && { favicon: "./assets/favicon.png" }),
      bundler: "metro",
    },
    experiments: {
      typedRoutes: false
    },
    scheme: "studentagent",
    extra: {
      // Support both old VITE_/EXPO_PUBLIC_ prefixes and new SUPABASE_ prefix
      // Only include keys if they have values (Expo may filter out undefined/empty)
      ...(supabaseUrl && { supabaseUrl }),
      ...(supabaseAnonKey && { supabaseAnonKey }),
      ...(stripePublishableKey && { stripePublishableKey }),
      apiUrl: apiUrl,
      eas: {
        projectId: ""
      }
    }
  }
};

