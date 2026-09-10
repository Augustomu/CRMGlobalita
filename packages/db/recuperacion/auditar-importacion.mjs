/**
 * ¿Entró TODO lo que se exportó? Se contesta con un número, no con memoria.
 *
 * POR QUÉ EXISTE. El 09/09/2026 Augusto dijo que faltaba un contacto —«Erick
 * Márquez»— y agregó: *«visto que tenemos mucho cuidado con los datos, no
 * puede faltar ningún dato»*. Tiene razón, y el problema era que no había
 * forma de contestarle sin escribir un script a medida. Esto es ese script,
 * ya no a medida.
 *
 * Aquella vez la respuesta fue: los 248 teléfonos de los dos CSV estaban en la
 * base, y esa persona no estaba en ninguno de los dos. O sea que el dato no se
 * perdió: nunca llegó. Son dos cosas MUY distintas y conviene poder
 * distinguirlas en un minuto.
 *
 * CÓMO COMPARA. Por los últimos ocho dígitos del teléfono, no por el número
 * entero: el mismo contacto aparece escrito «+52 1 55…», «5215 5…» y con
 * espacios, y comparar completo no encuentra nada. Es la misma cuenta que usa
 * el filtro de chats, a propósito: dos formas de comparar terminarían dando
 * dos respuestas.
 *
 * LA TRAMPA QUE YA COSTÓ UNA VUELTA. La columna del teléfono se busca EXACTA,
 * `Phone 1 - Value`. Con `/phone|tel/i` matcheaba «Phonetic First Name» y
 * daba 0 teléfonos con los 239 ahí adelante. Está en APRENDIZAJES.
 *
 * Uso:
 *   node packages/db/recuperacion/auditar-importacion.mjs <csv> [<csv>...]
 *   node packages/db/recuperacion/auditar-importacion.mjs ~/Downloads/*.csv --buscar "marquez"
 *
 * Sale 1 si falta alguno. No escribe nada: sólo mira.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
// fileURLToPath y no `url.pathname`: en Windows la ruta viene con %20 en cada
// espacio, y «C:\Users\Augusto%20Unzaga%20AMU\…» no existe.
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const iBuscar = args.indexOf('--buscar');
const buscado = iBuscar >= 0 ? (args[iBuscar + 1] ?? '').toLowerCase() : '';
const csvs = args.filter((a, i) => !a.startsWith('--') && i !== iBuscar + 1);

if (!csvs.length) {
  console.error('Falta el CSV. Uso: node packages/db/recuperacion/auditar-importacion.mjs <csv>...');
  process.exit(1);
}

const BASE = process.env.CRM_PB_DATA_DIR
  ? path.join(process.env.CRM_PB_DATA_DIR, 'data.db')
  : path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '.pb', 'pb_data', 'data.db');

/** Un CSV de Google Contacts: comillas dobles, y comas y saltos adentro. */
function filas(texto) {
  const out = [];
  let campo = '';
  let fila = [];
  let enComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (enComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i++; } else enComillas = false;
      } else campo += c;
    } else if (c === '"') enComillas = true;
    else if (c === ',') { fila.push(campo); campo = ''; }
    else if (c === '\n') { fila.push(campo); out.push(fila); fila = []; campo = ''; }
    else if (c !== '\r') campo += c;
  }
  if (campo || fila.length) { fila.push(campo); out.push(fila); }
  return out.filter((f) => f.some((x) => x.trim()));
}

const ocho = (t) => String(t ?? '').replace(/[^0-9]/g, '').slice(-8);

if (!fs.existsSync(BASE)) {
  console.error('No encuentro la base en ' + BASE + '. Con PB_DATOS/CRM_PB_DATA_DIR se apunta a otra.');
  process.exit(1);
}
const db = new DatabaseSync(BASE, { readOnly: true });

/** Todo teléfono que la base conoce, normalizado y crudo. */
const enBase = new Map();
for (const r of db.prepare('select nombre, telefono, telefono_raw from perfil').all()) {
  for (const t of [r.telefono, r.telefono_raw]) {
    const k = ocho(t);
    if (k.length >= 6) enBase.set(k, r.nombre);
  }
}
console.log(`Base: ${enBase.size} teléfonos distintos en ${BASE.replace(os.homedir(), '~')}`);

let conTelefono = 0;
let sinTelefono = 0;
const faltan = [];
const coincidencias = [];

for (const ruta of csvs) {
  if (!fs.existsSync(ruta)) { console.error(`  ! no existe: ${ruta}`); continue; }
  const f = filas(fs.readFileSync(ruta, 'utf8'));
  const cab = f[0].map((x) => x.trim());
  // EXACTA. Ver el comentario de arriba: /phone|tel/i da 0.
  const iTel = cab.findIndex((x) => /^Phone 1 - Value$/i.test(x));
  const iNom = cab.findIndex((x) => /^(First Name|Name)$/i.test(x));
  const iApe = cab.findIndex((x) => /^Last Name$/i.test(x));

  console.log(`\n${path.basename(ruta)} · ${f.length - 1} contactos · columna «${cab[iTel] ?? 'NO ENCONTRADA'}»`);
  if (iTel < 0) {
    console.error('  ! sin columna «Phone 1 - Value»: no es una exportación de Google Contacts.');
    continue;
  }

  for (const fila of f.slice(1)) {
    const nombre = [fila[iNom], fila[iApe]].filter(Boolean).join(' ').trim() || '(sin nombre)';
    if (buscado && fila.join(' ').toLowerCase().includes(buscado)) {
      coincidencias.push(`${path.basename(ruta)} → ${nombre}`);
    }
    const k = ocho(fila[iTel]);
    if (k.length < 6) { sinTelefono++; continue; }
    conTelefono++;
    if (!enBase.has(k)) faltan.push(`${nombre} (${fila[iTel]})`);
  }
}

console.log(`\n${conTelefono} contactos con teléfono · ${sinTelefono} sin teléfono en el CSV`);
if (faltan.length) {
  console.log(`\nFALTAN ${faltan.length} EN LA BASE:`);
  for (const x of faltan) console.log('  ' + x);
} else {
  console.log('Todos están en la base. No falta ninguno.');
}

if (buscado) {
  console.log(`\n¿Aparece «${buscado}» en algún CSV?`);
  if (coincidencias.length) for (const c of coincidencias) console.log('  sí: ' + c);
  else console.log('  NO, en ninguno. Si falta en la base, es porque nunca se exportó.');
}

process.exit(faltan.length ? 1 : 0);
