import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
// LOS TOKENS SE IMPORTAN, NO SE ENLAZAN. Estaban en public/ con un <link> en
// el index: un archivo estatico que el navegador cachea y que un recargado
// normal NO vuelve a pedir. El 11/09 eso hizo que Augusto reportara TRES VECES
// que los colores de WhatsApp no aparecian, y las tres veces la respuesta fue
// «recarga con Ctrl+Shift+R» — o sea, pedirle que compense una decision de
// arquitectura. Importado, Vite le pone una huella al nombre y el navegador lo
// vuelve a pedir solo cada vez que cambia.
import './design-tokens.css';
import './estilos.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
