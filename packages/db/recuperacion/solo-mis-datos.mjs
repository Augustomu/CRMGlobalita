// Deja en la base SOLO lo que vino de los archivos de Augusto.
//
//   node packages/db/recuperacion/solo-mis-datos.mjs            simulacro
//   node packages/db/recuperacion/solo-mis-datos.mjs --aplicar  borra y reimporta
//
// POR QUÉ BORRA TODO Y VUELVE A IMPORTAR, EN VEZ DE BORRAR «LO DE DEMO»
//
// Distinguir un perfil de demo de uno real por su contenido no se puede hacer
// bien. Lo intenté de dos formas y las dos tenían falsos positivos: la primera
// se llevaba puestas 38 personas que sí vinieron del Calendar —las que el
// evento no decía de qué cuenta salieron, así que el import no les creó lead—;
// la segunda, otras tantas cuyo nombre en la base no coincide exactamente con
// el del evento.
//
// Un borrado que a veces se lleva datos reales no sirve, y peor: no avisa.
//
// Los dos imports son idempotentes y están verificados contra los archivos
// (248 de 248 contactos, 288 de 298 eventos — los 10 restantes son bloqueos de
// agenda sin invitado). Así que vaciar y reimportar da exactamente lo que vino
// de las fuentes, sin adivinar nada.
//
// LO QUE NO SE TOCA: usuarios, cuentas, plantillas, etiquetas y tareas. Es
// configuración del sistema, no datos de prospección.

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { entrar } from './entrar.mjs';

const APLICAR = process.argv.includes('--aplicar');
const aqui = import.meta.dirname;

/** Las colecciones que se vacían, en orden: primero lo que depende de otros. */
const A_VACIAR = ['reunion', 'proyecto', 'mensaje', 'envio', 'lead', 'perfil'];

const pb = await entrar();

console.log('='.repeat(66));
console.log(APLICAR ? 'BORRANDO Y REIMPORTANDO' : 'SIMULACRO — nada se borra. Usá --aplicar');
console.log('='.repeat(66));

const antes = {};
for (const c of [...A_VACIAR, 'tarea', 'users', 'cuenta', 'plantilla', 'etiqueta']) {
  const r = await pb.collection(c).getList(1, 1);
  antes[c] = r.totalItems;
}

console.log('\nSe vacían:');
for (const c of A_VACIAR) console.log(`  ${c.padEnd(10)} ${String(antes[c]).padStart(4)}`);
console.log('\nNo se tocan:');
for (const c of ['tarea', 'users', 'cuenta', 'plantilla', 'etiqueta']) {
  console.log(`  ${c.padEnd(10)} ${String(antes[c]).padStart(4)}`);
}

if (!APLICAR) {
  console.log('\nDespués se reimportan los dos archivos. Nada se escribió.');
  process.exit(0);
}

// -------------------------------------------------------------- el vaciado
for (const c of A_VACIAR) {
  let borrados = 0;
  // De a tandas: `getFullList` de 900 y borrar, hasta que no quede nada.
  for (;;) {
    const filas = await pb.collection(c).getFullList({ fields: 'id', batch: 500 });
    if (!filas.length) break;
    for (const f of filas) {
      await pb.collection(c).delete(f.id);
      borrados++;
    }
  }
  console.log(`  ${c}: ${borrados} borrados`);
}

// Las tareas quedan, pero su lead ya no existe: se les saca la referencia para
// que no apunten a un id muerto.
const tareas = await pb.collection('tarea').getFullList();
let sueltas = 0;
for (const t of tareas) {
  if (!t.lead) continue;
  await pb.collection('tarea').update(t.id, { lead: '' });
  sueltas++;
}
if (sueltas) console.log(`  tarea: ${sueltas} quedaron sin lead (el lead que tenían era de demo)`);

// ------------------------------------------------------------ la reimportación
console.log('\nReimportando…\n');
const correr = (script) => {
  console.log(`--- ${script}`);
  execFileSync(process.execPath, [path.join(aqui, script), '--aplicar'], { stdio: 'inherit' });
  console.log();
};

// El orden importa: el Calendar crea cuentas, perfiles Y leads —es la única
// fuente que dice de qué cuenta salió cada persona—. El CSV suma perfiles.
correr('importar-calendar.mjs');
correr('importar-contactos.mjs');
correr('detectar-duplicados.mjs');

console.log('='.repeat(66));
for (const c of [...A_VACIAR, 'tarea']) {
  const r = await pb.collection(c).getList(1, 1);
  console.log(`  ${c.padEnd(10)} ${String(antes[c]).padStart(4)} → ${String(r.totalItems).padStart(4)}`);
}
console.log('='.repeat(66));
