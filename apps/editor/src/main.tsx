import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { PreviewPage } from './pages/PreviewPage';
import './index.css';

const isPreview = new URLSearchParams(window.location.search).get('preview') === '1';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isPreview ? <PreviewPage /> : <App />}
  </StrictMode>
);
