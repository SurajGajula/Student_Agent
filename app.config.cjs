const path = require('path');
const fs = require('fs');

// Environment variables must be set directly (via export, EC2, Docker, etc.)
// No .env file loading - use environment variables only

// Read values directly from environment variables
// Try EXPO_PUBLIC_ prefix first (standard for Expo web), then fallback to others
// IMPORTANT: For Amplify builds, variables must be available to the Node.js process
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Force output to stderr (which Amplify shows) to verify this file is being executed
// Use multiple methods to ensure output is visible
process.stderr.write('[app.config.cjs] ===== FILE IS BEING EXECUTED =====\n');
process.stdout.write('[app.config.cjs] ===== FILE IS BEING EXECUTED (stdout) =====\n');
console.log('[app.config.cjs] ===== FILE IS BEING EXECUTED (console.log) =====');
console.error('[app.config.cjs] ===== FILE IS BEING EXECUTED (console.error) =====');

// Log all SUPABASE-related env vars
const supabaseEnvVars = Object.keys(process.env).filter(k => k.includes('SUPABASE') || k.includes('STRIPE') || k.includes('EXPO_PUBLIC'));
process.stderr.write('[app.config.cjs] process.env keys with SUPABASE/STRIPE/EXPO_PUBLIC: ' + supabaseEnvVars.join(', ') + '\n');
console.log('[app.config.cjs] process.env keys:', supabaseEnvVars.join(', '));

const stripePublishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || process.env.STRIPE_PUBLISHABLE_KEY || process.env.VITE_STRIPE_PUBLISHABLE_KEY;
// Default to production URL for mobile apps (iOS/Android builds), localhost only for development
const isProduction = process.env.NODE_ENV === 'production' || !process.env.EXPO_PUBLIC_API_URL;
const apiUrl = process.env.EXPO_PUBLIC_API_URL || process.env.API_URL || process.env.VITE_API_URL || 
  (isProduction ? 'https://studentagent.site' : 'http://localhost:3001');

// Debug logging during build (always log in app.config.cjs since it only runs at build time)
console.error('[app.config.cjs] ===== ENVIRONMENT VARIABLES CHECK =====');
console.error('[app.config.cjs] EXPO_PUBLIC_SUPABASE_URL:', process.env.EXPO_PUBLIC_SUPABASE_URL ? '✓ (' + (process.env.EXPO_PUBLIC_SUPABASE_URL || '').substring(0, 30) + '...)' : '✗');
console.error('[app.config.cjs] SUPABASE_URL:', process.env.SUPABASE_URL ? '✓ (' + (process.env.SUPABASE_URL || '').substring(0, 30) + '...)' : '✗');
console.error('[app.config.cjs] EXPO_PUBLIC_SUPABASE_ANON_KEY:', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ? '✓ (length: ' + (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '').length + ')' : '✗');
console.error('[app.config.cjs] SUPABASE_PUBLISHABLE_KEY:', process.env.SUPABASE_PUBLISHABLE_KEY ? '✓ (length: ' + (process.env.SUPABASE_PUBLISHABLE_KEY || '').length + ')' : '✗');
console.error('[app.config.cjs] Resolved supabaseUrl:', supabaseUrl ? '✓ (' + supabaseUrl.substring(0, 30) + '...)' : '✗ EMPTY');
console.error('[app.config.cjs] Resolved supabaseAnonKey:', supabaseAnonKey ? '✓ (length: ' + supabaseAnonKey.length + ')' : '✗ EMPTY');
console.error('[app.config.cjs] ======================================');

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

// Use Logo.png from AppStore folder as app icon
if (fs.existsSync('./AppStore/Logo.png')) {
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
      favicon: fs.existsSync('./AppStore/Logo.png') ? "./AppStore/Logo.png" : 
               (fs.existsSync('./assets/favicon.png') ? "./assets/favicon.png" : undefined),
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

