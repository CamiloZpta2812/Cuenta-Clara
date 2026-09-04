import React from 'react';
import ReactDOM from 'react-dom/client';
import Root from './Root';
import ErrorBoundary from './ErrorBoundary';
import { registerServiceWorker } from './registerSW.js';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Root />
    </ErrorBoundary>
  </React.StrictMode>
);

registerServiceWorker();
