import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './src/App';
import './src/styles';

// Render app immediately - initialization happens in App component via useEffect
const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    React.createElement(React.StrictMode, null,
      React.createElement(App)
    )
  );
}

