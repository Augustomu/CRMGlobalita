import PocketBase from 'pocketbase';

/**
 * En producción la app la sirve la propia PocketBase desde `pb_public/`, así que
 * la API está en el mismo origen: no hace falta configurar ninguna URL ni abrir
 * CORS. En desarrollo apunta a la instancia local que levanta
 * `npm run db:dev`, y VITE_PB_URL pisa cualquiera de los dos si hace falta.
 */
const url =
  import.meta.env.VITE_PB_URL ||
  (import.meta.env.DEV ? 'http://127.0.0.1:8090' : window.location.origin);

export const pb = new PocketBase(url);

// El SDK persiste la sesión en localStorage. El manual (§6.6) lo llama
// "mantener la sesión abierta"; el switch para desactivarlo llega en la Etapa 6.
