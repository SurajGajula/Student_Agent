import { registerRootComponent } from 'expo';
import App from './src/App';
import { useAuthStore } from './src/stores/authStore';

// Initialize auth in the background (for native platforms)
// The App component will handle rendering
useAuthStore.getState().initializeAuth().catch(err => {
  console.error('Auth initialization error:', err);
});

// Register the app component for native platforms
registerRootComponent(App);

