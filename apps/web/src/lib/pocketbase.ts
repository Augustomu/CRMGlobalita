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

/**
 * El SDK cancela sola cualquier petición nueva que "se parezca" a otra en vuelo
 * hacia la misma colección. Está pensado para búsquedas mientras se tipea, pero
 * acá rompe cosas legítimas: guardar un permiso y recargar la lista, o resolver
 * varias etiquetas seguidas al registrar un envío — la primera se cancelaba y el
 * error aparecía como "The request was aborted (autocancelled)".
 *
 * Todas nuestras llamadas se esperan con await y en orden, así que no hay
 * peticiones colgando que valga la pena cancelar.
 */
pb.autoCancellation(false);

// El SDK persiste la sesión en localStorage. El manual (§6.6) lo llama
// "mantener la sesión abierta"; el switch para desactivarlo llega en la Etapa 6.

/**
 * La URL de un endpoint propio del servidor (los de `pb_hooks`).
 *
 * Existe porque no todo lo que hace el CRM entra en el CRUD del SDK: dar de
 * alta a alguien tiene que pasar por el servidor para que la colección `users`
 * NO acepte `create` desde el navegador — si lo aceptara, cualquiera que sepa
 * la URL se da de alta solo, y §7.5 dice que no hay auto-registro.
 *
 * En producción es el mismo origen; en desarrollo, la instancia local. Se
 * arma con la misma base que usa el SDK para que no existan dos ideas de dónde
 * está el servidor.
 */
export function apiUrl(ruta: string): string {
  return `${url.replace(/\/+$/, '')}${ruta.startsWith('/') ? ruta : `/${ruta}`}`;
}
