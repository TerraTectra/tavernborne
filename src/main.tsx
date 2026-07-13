import React from 'react';
import ReactDOM from 'react-dom/client';
import TavernbornePreview from './App';
import { VisualPolishManager } from './three/VisualPolishManager';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TavernbornePreview />
    <VisualPolishManager />
  </React.StrictMode>,
);
