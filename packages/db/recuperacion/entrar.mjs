// Conexión a PocketBase para los scripts de recuperación.
//
// Contra la base local alcanza con las credenciales de demo. Contra producción
// no hay ninguna clave guardada en el repo ni en el VPS a propósito, así que se
// pide por teclado y no queda en el historial del shell ni en un archivo.
//
//   PB_URL=https://crm.globalita.tech PB_USER=augusto.unzaga@outlook.com.ar \
//     node packages/db/recuperacion/importar-contactos.mjs --aplicar

import { createInterface } from 'node:readline';
import PocketBase from 'pocketbase';

const PB_URL = process.env.PB_URL || 'http://127.0.0.1:8090';
const LOCAL = PB_URL.includes('127.0.0.1') || PB_URL.includes('localhost');

const PB_USER = process.env.PB_USER || (LOCAL ? 'alberto@globalita.test' : '');
/** `_superusers` para entrar como administrador de PocketBase, `users` para la app. */
const PB_COL = process.env.PB_COL || 'users';

/** Pregunta sin dejar rastro. No hay eco: la clave no se ve al tipearla. */
function preguntar(texto) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      reject(
        new Error(
          'Hace falta la clave y no hay teclado disponible.\n' +
            'Corré el script desde una terminal, o pasá PB_PASS por variable de entorno.',
        ),
      );
      return;
    }
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    // Silencia el eco mientras se escribe la clave.
    const escribir = rl._writeToOutput?.bind(rl);
    rl._writeToOutput = (s) => escribir?.(s.includes(texto) ? s : '');
    rl.question(texto, (v) => {
      rl.close();
      process.stdout.write('\n');
      resolve(v.trim());
    });
  });
}

/** Devuelve un cliente ya autenticado. Todos los scripts entran por acá. */
export async function entrar() {
  const usuario = PB_USER || (await preguntar(`Usuario de ${PB_URL}: `));
  const clave = process.env.PB_PASS || (LOCAL ? 'demo12345' : await preguntar('Clave: '));

  const pb = new PocketBase(PB_URL);
  pb.autoCancellation(false);
  try {
    await pb.collection(PB_COL).authWithPassword(usuario, clave);
  } catch (e) {
    const detalle = e?.status === 400 ? 'usuario o clave incorrectos' : e?.message || String(e);
    throw new Error(`No se pudo entrar a ${PB_URL} como ${usuario}: ${detalle}`);
  }
  return pb;
}

export { PB_URL, LOCAL };
