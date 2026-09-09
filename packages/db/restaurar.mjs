// Devuelve una copia de la base a su lugar.
//
//   node packages/db/restaurar.mjs                    lista las copias
//   node packages/db/restaurar.mjs <nombre>           restaura esa
//   node packages/db/restaurar.mjs --ultima           restaura la más nueva
//
// Restaurar TAMBIÉN es destruir: pisa lo que hay. Por eso antes copia la base
// actual — si uno restaura la copia equivocada, no perdió nada, sólo tiene que
// restaurar la otra.
//
// Parar PocketBase antes de correr esto. Con el servidor levantado, el WAL
// abierto se mezcla con el de la copia y la base queda inconsistente.

import fs from 'node:fs';
import path from 'node:path';
import { carpetaDeCopias, copiasQueHay, pesoEnMb, queHayAdentro, restaurar } from './copias.mjs';

const raiz = path.resolve(import.meta.dirname, '../..');
const pb = path.join(raiz, '.pb');
const datos = process.env.PB_DATOS ? path.resolve(raiz, process.env.PB_DATOS) : path.join(pb, 'pb_data');

const args = process.argv.slice(2);
const copias = copiasQueHay(pb);

if (!copias.length) {
  console.error('No hay ninguna copia todavía.');
  process.exit(1);
}

function listar() {
  console.log(`Copias en ${carpetaDeCopias(pb)}:\n`);
  for (const c of copias) {
    const dentro = queHayAdentro(path.join(carpetaDeCopias(pb), c));
    const cuenta = dentro?.existe
      ? `${dentro.detalle.perfil} perfiles · ${dentro.detalle.lead} leads (${dentro.reales} reales)`
      : 'sin datos legibles';
    console.log('  ', c.padEnd(34), String(pesoEnMb(path.join(carpetaDeCopias(pb), c)) + ' MB').padStart(9), ' ', cuenta);
  }
  console.log('\nPara restaurar:  node packages/db/restaurar.mjs <nombre>');
}

if (!args.length) {
  listar();
  process.exit(0);
}

const nombre = args[0] === '--ultima' ? copias[0] : args[0];

if (!copias.includes(nombre)) {
  console.error(`No existe la copia «${nombre}».\n`);
  listar();
  process.exit(1);
}

// Qué se va a perder y qué se va a recuperar, ANTES de tocar nada.
const ahora = queHayAdentro(datos);
const copia = queHayAdentro(path.join(carpetaDeCopias(pb), nombre));

console.log('Ahora:', ahora?.existe ? `${ahora.detalle.perfil} perfiles · ${ahora.detalle.lead} leads` : 'base vacía');
console.log('Copia:', copia?.existe ? `${copia.detalle.perfil} perfiles · ${copia.detalle.lead} leads` : 'sin datos');

// Lo que no puede pasar es restaurar con el servidor levantado: tiene la base
// abierta y las escrituras que haga después de la copia se mezclan con lo
// restaurado.
//
// Se comprueba PREGUNTÁNDOLE al servidor, no mirando si existe un `data.db-wal`.
// Ese archivo queda en disco después de cualquier escritura, con PocketBase
// prendido o apagado: usarlo como señal bloqueaba la restauración justo cuando
// hacía falta, que es con todo parado.
const responde = await fetch('http://127.0.0.1:8090/api/health', {
  signal: AbortSignal.timeout(1500),
})
  .then(() => true)
  .catch(() => false);

if (responde) {
  console.error(
    '\nPocketBase está corriendo en el 8090. Paralo antes de restaurar,\n' +
      'o sus escrituras se mezclan con las de la copia.',
  );
  process.exit(1);
}

const respaldo = restaurar(pb, datos, nombre);
console.log(`\nRestaurada «${nombre}».`);
if (respaldo) console.log(`Lo que había quedó guardado en ${respaldo}`);
