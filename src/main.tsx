import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { fitPhoneScreen } from './phoneFit';
import './styles.css';

// Celulares en modo escritorio: se escala la página al ancho real del teléfono
fitPhoneScreen();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
