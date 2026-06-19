import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './chrome/ErrorBoundary';
import { BrowserCompatGuard } from './chrome/BrowserCompatGuard';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserCompatGuard>
        <App />
      </BrowserCompatGuard>
    </ErrorBoundary>
  </React.StrictMode>,
);
