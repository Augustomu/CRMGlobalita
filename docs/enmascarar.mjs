// Saca del prototipo los datos de personas reales.
//
//   node docs/enmascarar.mjs             muestra qué hay adentro, sin tocar nada
//   node docs/enmascarar.mjs --escribir  los reemplaza por datos inventados
//
// POR QUE EXISTE. El bundle `docs/_bundle/CRM de prospeccion.html` está
// commiteado y **el repositorio es público**. El 07/09/2026 se subió con seis
// teléfonos, dos nombres y un correo de contactos de verdad, usados como datos
// de ejemplo en las maquetas: no se ven abriendo el archivo —es un ZIP— pero
// cualquiera que clone el repo y corra `desempacar.mjs` los tiene.
//
// Y va a volver a pasar. Cada vez que se exporte el prototipo desde Design
// Components, las maquetas salen con lo que haya en pantalla, que suele ser la
// base de verdad. Por eso esto es una herramienta del repo y no un arreglo de
// una vez: se corre después de cada exportación, ANTES de commitear.
//
// QUE CUENTA COMO REAL. No se adivina: se compara contra la base local. Un
// nombre, un teléfono o un correo es real si existe en `perfil` o en `lead`.
// Sin base, el script avisa y no hace nada — antes que dar un falso «está
// limpio».

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { DatabaseSync } from 'node:sqlite';

const raiz = path.resolve(import.meta.dirname, '..');
const bundle = path.join(raiz, 'docs/_bundle/CRM de prospeccion.html');
const baseDatos = path.join(raiz, '.pb/pb_data/data.db');
const escribir = process.argv.includes('--escribir');

if (!fs.existsSync(bundle)) {
  console.error(`No encuentro el bundle en ${bundle}`);
  process.exit(1);
}
if (!fs.existsSync(baseDatos)) {
  console.error(
    'No encuentro la base en .pb/pb_data/data.db.\n' +
      'Sin ella no hay con qué comparar, y decir «está limpio» sin haber\n' +
      'comparado es peor que no revisar. Levantá PocketBase y volvé a correr.',
  );
  process.exit(1);
}

// ------------------------------------------------------------------ qué es real
const db = new DatabaseSync(baseDatos, { readOnly: true });
const filas = (sql) => db.prepare(sql).all();

const nombresReales = filas("SELECT DISTINCT nombre FROM perfil WHERE nombre LIKE '% %'")
  .map((r) => String(r.nombre).trim())
  // Un nombre corto da falsos positivos: «Ana Paula» aparece en cualquier texto.
  .filter((n) => n.length > 10);

const telefonosReales = filas(
  "SELECT DISTINCT telefono FROM perfil WHERE telefono != '' AND telefono IS NOT NULL",
)
  .map((r) => String(r.telefono))
  .filter((t) => t.length > 7);

const correosReales = filas("SELECT DISTINCT email FROM lead WHERE email != '' AND email IS NOT NULL")
  .map((r) => String(r.email).trim())
  .filter((c) => c.includes('@'));

// ------------------------------------------------------------- leer el ZIP
function leerEntradas(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('el bundle no es un ZIP válido');

  const cantidad = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entradas = [];

  for (let i = 0; i < cantidad; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error(`directorio central roto en la entrada ${i}`);
    const banderas = buf.readUInt16LE(p + 8);
    const metodo = buf.readUInt16LE(p + 10);
    const hora = buf.readUInt16LE(p + 12);
    const fecha = buf.readUInt16LE(p + 14);
    const compTam = buf.readUInt32LE(p + 20);
    const crudoTam = buf.readUInt32LE(p + 24);
    const nLargo = buf.readUInt16LE(p + 28);
    const eLargo = buf.readUInt16LE(p + 30);
    const cLargo = buf.readUInt16LE(p + 32);
    const externos = buf.readUInt32LE(p + 38);
    const offset = buf.readUInt32LE(p + 42);
    const nombre = buf.toString('utf8', p + 46, p + 46 + nLargo);

    // Los largos del encabezado LOCAL pueden diferir de los del central.
    const inicio = offset + 30 + buf.readUInt16LE(offset + 26) + buf.readUInt16LE(offset + 28);
    const bruto = buf.subarray(inicio, inicio + compTam);
    const contenido = metodo === 8 ? zlib.inflateRawSync(bruto) : Buffer.from(bruto);
    if (contenido.length !== crudoTam) throw new Error(`tamaño distinto al descomprimir ${nombre}`);

    entradas.push({ nombre, banderas, metodo, hora, fecha, externos, contenido });
    p += 46 + nLargo + eLargo + cLargo;
  }
  return entradas;
}

function escribirZip(entradas) {
  const locales = [];
  const central = [];
  let cursor = 0;

  for (const e of entradas) {
    const nom = Buffer.from(e.nombre, 'utf8');
    const datos = e.metodo === 8 ? zlib.deflateRawSync(e.contenido, { level: 9 }) : e.contenido;
    const crc = zlib.crc32(e.contenido);

    const L = Buffer.alloc(30);
    L.writeUInt32LE(0x04034b50, 0);
    L.writeUInt16LE(20, 4);
    // Se apaga el bit 3: los tamaños van en el encabezado, no en un descriptor
    // al final. Si quedara prendido, un lector estricto no encuentra los datos.
    L.writeUInt16LE(e.banderas & ~0x08, 6);
    L.writeUInt16LE(e.metodo, 8);
    L.writeUInt16LE(e.hora, 10);
    L.writeUInt16LE(e.fecha, 12);
    L.writeUInt32LE(crc, 14);
    L.writeUInt32LE(datos.length, 18);
    L.writeUInt32LE(e.contenido.length, 22);
    L.writeUInt16LE(nom.length, 26);
    locales.push(L, nom, datos);

    const C = Buffer.alloc(46);
    C.writeUInt32LE(0x02014b50, 0);
    C.writeUInt16LE(20, 4);
    C.writeUInt16LE(20, 6);
    C.writeUInt16LE(e.banderas & ~0x08, 8);
    C.writeUInt16LE(e.metodo, 10);
    C.writeUInt16LE(e.hora, 12);
    C.writeUInt16LE(e.fecha, 14);
    C.writeUInt32LE(crc, 16);
    C.writeUInt32LE(datos.length, 20);
    C.writeUInt32LE(e.contenido.length, 24);
    C.writeUInt16LE(nom.length, 28);
    C.writeUInt32LE(e.externos, 38);
    C.writeUInt32LE(cursor, 42);
    central.push(C, nom);

    cursor += 30 + nom.length + datos.length;
  }

  const cuerpo = Buffer.concat(locales);
  const dir = Buffer.concat(central);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(entradas.length, 8);
  fin.writeUInt16LE(entradas.length, 10);
  fin.writeUInt32LE(dir.length, 12);
  fin.writeUInt32LE(cuerpo.length, 16);
  return Buffer.concat([cuerpo, dir, fin]);
}

// ------------------------------------------------------------ los inventados
//
// Deterministas: el mismo dato real da siempre el mismo reemplazo, así el
// prototipo sigue siendo coherente —la misma persona en dos pantallas sigue
// siendo la misma— y correr esto dos veces no cambia nada.
const NOMBRES = ['Ricardo Menezes', 'Tomás Ibarra', 'Lucía Ferrán', 'Bruno Salgado',
                 'Paula Restrepo', 'Iván Mercado', 'Sofía Landa', 'Diego Ferrán'];

function inventarTelefono(i) {
  // Prefijos que no se asignan como celular: no le caen a nadie.
  const n = String(i + 1).padStart(4, '0');
  return i % 2 ? `+55 11 90000 ${n}` : `+52 55 0000 ${n}`;
}

const TEXTO = /\.(html|md|json|js|css|txt)$/i;

// ------------------------------------------------------------------- trabajar
const entradas = leerEntradas(fs.readFileSync(bundle));
const reemplazos = new Map();
const porArchivo = new Map();
let total = 0;

function anotar(archivo) {
  porArchivo.set(archivo, (porArchivo.get(archivo) ?? 0) + 1);
  total++;
}

for (const e of entradas) {
  if (!TEXTO.test(e.nombre)) continue;
  let texto = e.contenido.toString('utf8');
  const original = texto;

  // El orden importa: primero el correo (que puede contener un nombre), después
  // el nombre, y al final el teléfono.
  for (const correo of correosReales) {
    if (!texto.includes(correo)) continue;
    if (!reemplazos.has(correo)) {
      reemplazos.set(correo, `contacto${reemplazos.size + 1}@empresa-ejemplo.com`);
    }
    texto = texto.split(correo).join(reemplazos.get(correo));
    anotar(e.nombre);
  }
  for (const nombre of nombresReales) {
    if (!texto.includes(nombre)) continue;
    if (!reemplazos.has(nombre)) {
      reemplazos.set(nombre, NOMBRES[reemplazos.size % NOMBRES.length]);
    }
    texto = texto.split(nombre).join(reemplazos.get(nombre));
    anotar(e.nombre);
  }
  for (const tel of telefonosReales) {
    if (!texto.includes(tel)) continue;
    if (!reemplazos.has(tel)) reemplazos.set(tel, inventarTelefono(reemplazos.size));
    texto = texto.split(tel).join(reemplazos.get(tel));
    anotar(e.nombre);
  }

  if (texto !== original) e.contenido = Buffer.from(texto, 'utf8');
}

// -------------------------------------------------------------------- contar
if (!total) {
  console.log('El bundle está limpio: ningún nombre, teléfono ni correo de la base.');
  process.exit(0);
}

console.log(`Datos de personas reales en el bundle: ${reemplazos.size} distintos, en ${porArchivo.size} archivos.\n`);
for (const [archivo, n] of [...porArchivo].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(3)}  ${archivo}`);
}

if (!escribir) {
  console.log('\nNo se tocó nada. Para reemplazarlos:\n  node docs/enmascarar.mjs --escribir');
  process.exit(0);
}

fs.writeFileSync(bundle, escribirZip(entradas));
console.log(`\nBundle reescrito: ${fs.statSync(bundle).size} bytes.`);
console.log('Verificá con `node docs/desempacar.mjs` y volvé a correr esto sin --escribir.');
