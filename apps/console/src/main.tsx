import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Chart from 'chart.js/auto';

import App from './App';
import { AuthProvider } from './lib/auth';

import './index.css';

Chart.defaults.font.family = 'Inter, sans-serif';
Chart.defaults.font.size = 10.5;
Chart.defaults.color = '#7A8194';
Chart.defaults.plugins.tooltip.backgroundColor = '#0F1115';
Chart.defaults.plugins.tooltip.cornerRadius = 3;
Chart.defaults.plugins.tooltip.padding = 8;

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root missing from index.html');

createRoot(rootEl).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);
