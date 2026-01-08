import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './src/App';
import './src/styles.css';

// Set favicon dynamically
const setFavicon = () => {
  // Remove existing favicon links
  const existingLinks = document.querySelectorAll('link[rel*="icon"]');
  existingLinks.forEach(link => link.remove());

  // Use the favicon path
  // In production builds, Expo processes favicon from app.config.cjs and places it at /favicon.png
  // During development, Metro can serve from public folder (if configured) or we use the assets path
  // For now, use root path which should work after Expo export
  // If it doesn't work in dev, try /public/favicon.png or /assets/favicon.png
  let faviconPath = '/favicon.png';
  
  // Create standard favicon link
  const link = document.createElement('link');
  link.rel = 'icon';
  link.type = 'image/png';
  link.href = faviconPath;
  document.head.appendChild(link);
  
  // Also add shortcut icon (for older browsers)
  const shortcutLink = document.createElement('link');
  shortcutLink.rel = 'shortcut icon';
  shortcutLink.type = 'image/png';
  shortcutLink.href = faviconPath;
  document.head.appendChild(shortcutLink);
  
  // Add apple-touch-icon for better iOS support
  const appleTouchIcon = document.createElement('link');
  appleTouchIcon.rel = 'apple-touch-icon';
  appleTouchIcon.href = faviconPath;
  document.head.appendChild(appleTouchIcon);
};

// Set favicon when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setFavicon);
} else {
  setFavicon();
}

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    React.createElement(React.StrictMode, null,
      React.createElement(App)
    )
  );
}
