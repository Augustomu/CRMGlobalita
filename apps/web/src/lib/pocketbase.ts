import PocketBase from 'pocketbase';

// Apunta a la instancia de desarrollo que levanta packages/db/dev.mjs
// (npm run db:dev -- --seed). En producción, VITE_PB_URL la reemplaza.
export const pb = new PocketBase(import.meta.env.VITE_PB_URL ?? 'http://127.0.0.1:8090');

// Persiste la sesión en localStorage por defecto (comportamiento del SDK).
// El manual (§6.6) llama a esto "mantener la sesión abierta"; acá queda
// siempre prendido para el desarrollo — la UI del login lo expone en Etapa 6.
