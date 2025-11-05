
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { v4 as uuidv4 } from 'uuid'; // Import uuid

// Make uuid available globally for components that need it, or pass as prop.
// For simplicity in this project structure, we can attach to window if needed,
// but passing props is the React-way. App.tsx now imports it directly.

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
