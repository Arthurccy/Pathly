/**
 * Copyright (c) 2026 Arthur - Pathly. All rights reserved.
 * Ce code source est la propriété exclusive de son auteur.
 * Toute reproduction, modification, distribution ou utilisation non autorisée est strictement interdite.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Retired bank connectors must not leave credentials in browser storage.
try {
  for (const key of Object.keys(localStorage)) {
    if (/^pathly_(bridge_|gocardless_|pending_bridge$|pending_gocardless$)/.test(key)) {
      localStorage.removeItem(key);
    }
  }
} catch { /* Storage may be unavailable in privacy mode. */ }

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
