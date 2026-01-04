import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppRegistry } from 'react-native-web';
import App from './src/App';
import './src/styles.css';
import { useAuthStore } from './src/stores/authStore';

// Initialize auth before rendering app
const initializeApp = async () => {
  await useAuthStore.getState().initializeAuth();
  
  const rootElement = document.getElementById('root');
  if (rootElement) {
    ReactDOM.createRoot(rootElement).render(
      React.createElement(React.StrictMode, null,
        React.createElement(App)
      )
    );
  }
};

initializeApp();

