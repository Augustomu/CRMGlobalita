/**
 * Lo que el código escribe, contra lo que la base acepta.
 *
 * POR QUE EXISTE. El 11/09/2026 la familia 6 del registro —programar contra el
 * modelo imaginado— volvió TRES VECES EN DOS HORAS, siempre igual:
 *
 *   · `tipo: 'sin_clasificar'` en un select que sólo acepta «personal» y
 *     «trabajo». PocketBase rechazaba la fila entera y los mensajes de WhatsApp
 *     llegaban a una pantalla vacía.
 *   · `{ quien: 'ellos', cuando: ... }` donde el resto del código dice
 *     `{ quien: 'in'|'out', en: ... }`.
 *   · Un teléfono al que se le pegaba el país cuando ya lo traía.
 *
 * Los tres se habrían visto abriendo el esquema. Ninguno se vio, porque el
 * esquema está a dos carpetas de distancia y hay que acordarse de mirarlo.
 * Esto lo mira solo.
 *
 * QUE COMPRUEBA:
 *   1. Que cada campo que el código escribe EXISTA en esa colección.
 *   2. Que los valores literales de un `select` estén entre los permitidos.
 *
 * QUE NO PUEDE VER: los valores que salen de una variable. `quien: q` puede ser
 * cualquier cosa en tiempo de ejecución, y eso lo cuida el tipo de TypeScript.
 * Lo que esto agarra son las constantes escritas a mano, que es como se
 * cometieron los tres.
 *
 *   node docs/revisar-campos.mjs      # sale 1 si algo no coincide
 */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const base = join(raiz, '.pb/pb_data/data.db');

if (!existsSync(base)) {
  console.log('No hay base local todavía: no hay contra qué comparar.');
  process.exit(0);
}

const db = new DatabaseSync(base, { readOnly: true });

/** El esquema real: colección → { campo → valores permitidos | null }. */
const esquema = new Map();
for (const c of db.prepare('select name, fields from _collections').all()) {
  const campos = new Map();
  for (const f of JSON.parse(c.fields)) {
    campos.set(f.name, Array.isArray(f.values) && f.values.length ? f.values : null);
  }
  // Los de sistema valen en cualquier colección.
  for (const s of ['id', 'created', 'updated']) if (!campos.has(s)) campos.set(s, null);
  esquema.set(c.name, campos);
}

/** Los archivos que escriben en la base. */
function archivos(dir, salida = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) archivos(p, salida);
    else if (/\.(ts|tsx|js)$/.test(e.name)) salida.push(p);
  }
  return salida;
}

const problemas = [];

for (const ruta of [join(raiz, 'apps/worker/src'), join(raiz, 'apps/web/src')].flatMap((d) =>
  existsSync(d) ? archivos(d) : [],
)) {
  const texto = readFileSync(ruta, 'utf8');

  // `collection('lo_que_sea').create({ ... })` o `.update(algo, { ... })`.
  //
  // EL CUERPO SE RECORTA CONTANDO LLAVES, no con una expresión perezosa. La
  // primera versión usaba `[\s\S]*?` hasta el primer `})`, y con un objeto de
  // una sola línea seguía leyendo hasta el bloque SIGUIENTE: atribuía los
  // campos de `mensaje` a la colección `lead` y daba 16 avisos falsos. Un
  // chequeo que grita en falso no lo corre nadie, que es la lección del
  // chequeo B de este mismo registro.
  const re = /collection\(['"`](\w+)['"`]\)\s*\.\s*(create|update)\(/g;
  let m;
  while ((m = re.exec(texto)) !== null) {
    const [, coleccion] = m;
    const campos = esquema.get(coleccion);
    if (!campos) continue; // No es una colección de esta base.

    /*
     * El `{` tiene que estar DENTRO de esta llamada.
     *
     * `update(perfilId, datos)` no lleva objeto literal: los campos salen de
     * una variable. La primera versión buscaba el próximo `{` del archivo y se
     * llevaba el cuerpo de la función siguiente — cinco avisos falsos de
     * `useAgenda.ts` y otros cinco de `ImportarCsv.tsx`.
     *
     * Si el paréntesis de la llamada cierra antes de que aparezca un `{`, no
     * hay nada que revisar acá.
     */
    let abre = -1;
    let parens = 1;
    for (let i = m.index + m[0].length; i < texto.length && parens > 0; i++) {
      const ch = texto[i];
      if (ch === '(') parens++;
      else if (ch === ')') parens--;
      else if (ch === '{') {
        abre = i;
        break;
      }
    }
    if (abre < 0) continue;
    let nivel = 0;
    let cierra = -1;
    for (let i = abre; i < texto.length && i < abre + 4000; i++) {
      if (texto[i] === '{') nivel++;
      else if (texto[i] === '}') {
        nivel--;
        if (nivel === 0) {
          cierra = i;
          break;
        }
      }
    }
    if (cierra < 0) continue;
    const cuerpo = texto.slice(abre + 1, cierra);

    // Sólo lo que está al primer nivel del objeto: `nombre: valor,`.
    const soloPrimerNivel = cuerpo.replace(/{[^{}]*}/g, '{}');
    const campoRe = /^\s{2,}(\w+):\s*(.*)$/gm;
    let c;
    while ((c = campoRe.exec(soloPrimerNivel)) !== null) {
      const [, nombre, valorCrudo] = c;
      if (!campos.has(nombre)) {
        problemas.push(
          `${ruta.replace(raiz, '.')}: «${coleccion}» no tiene el campo «${nombre}»`,
        );
        continue;
      }
      const permitidos = campos.get(nombre);
      if (!permitidos) continue;

      // Sólo los literales: `'texto'` o `"texto"`. Lo demás es una variable.
      const lit = /^['"`]([^'"`]*)['"`]\s*,?\s*$/.exec(valorCrudo.trim());
      if (!lit) continue;
      if (lit[1] !== '' && !permitidos.includes(lit[1])) {
        problemas.push(
          `${ruta.replace(raiz, '.')}: «${coleccion}.${nombre}» = "${lit[1]}" ` +
            `no está entre [${permitidos.join(', ')}]`,
        );
      }
    }
  }
}

if (problemas.length) {
  console.error('\nLo que el código escribe no coincide con la base:\n');
  for (const p of problemas) console.error('  · ' + p);
  console.error(`\n${problemas.length} problema(s).`);
  process.exit(1);
}

console.log('Lo que el código escribe coincide con el esquema de la base.');
