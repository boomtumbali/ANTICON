import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './vercel.js';
import '@fontsource-variable/inter-tight';
import '@fontsource-variable/geist-mono';
import './anticon.css';
import './page.css';
import './landing.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
