/**
 * Copyright (c) 2026 Arthur - Pathly. All rights reserved.
 * Ce code source est la propriété exclusive de son auteur.
 * Toute reproduction, modification, distribution ou utilisation non autorisée est strictement interdite.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
