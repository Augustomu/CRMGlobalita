// Copias de la base local, y la regla de que NADA se borra sin una antes.
//
// POR QUÉ EXISTE ESTE ARCHIVO
//
// El 08/09/2026 corrí `dev.mjs --reset` unas diez veces mientras trabajaba en
// otra cosa. Cada corrida borraba la base entera. Cuando Augusto preguntó si el
// import de sus 248 contactos y sus 298 reuniones seguía cargado, la respuesta
// era no: se había ido en el primer reset y en los nueve siguientes.
//
// El `--reset` de entonces eran cuatro líneas: un flag, un `rmSync`, y listo.
// Sin copia, sin preguntar, sin mirar qué había adentro. Un dato real y uno de
// demo valían lo mismo.
//
// LAS TRES REGLAS
//
//   1. Antes de borrar cualquier cosa, se copia. Siempre. Sin excepción y sin
//      flag que lo saltee.
//   2. Si la base tiene datos que NO son de demo, `--reset` se niega. Para
//      insistir hay que escribir una frase larga que nadie tipea por inercia.
//   3. Las copias no se borran solas. Ocupar disco es barato; perder los
//      contactos de dos años de trabajo, no.
//
// La copia es del directorio entero de PocketBase, no un dump: así se restaura
// devolviéndolo a su lugar, sin depender de que el formato del dump siga siendo
// legible dentro de un año.

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

// `node:sqlite` se pide con createRequire y no con import: la lectura tiene que
// ser SINCRONA para poder decidir antes de borrar, y un import dinamico
// obligaria a que toda la cadena sea async.
const require = createRequire(import.meta.url);

/** Las listas de origen que planta el seed. Todo lo demás es trabajo real. */
const LISTAS_DE_DEMO = new Set([
  'Relleno de demo',
  'Contacto directo',
  'Recuperado del import',
]);

/**
 * Qué hay adentro de la base, sin levantar PocketBase.
 *
 * Se lee el SQLite directo porque esto tiene que funcionar justo cuando el
 * servidor NO está corriendo — que es el momento en que uno resetea.
 *
 * Devuelve `null` si no se puede leer: sin poder mirar, se asume lo peor y no
 * se borra nada.
 */
export function queHayAdentro(datos) {
  const archivo = path.join(datos, 'data.db');
  if (!fs.existsSync(archivo)) return { existe: false, total: 0, reales: 0, detalle: {} };

  let DatabaseSync;
  try {
    ({ DatabaseSync } = require('node:sqlite'));
  } catch {
    return null;
  }

  let db;
  try {
    db = new DatabaseSync(archivo, { readOnly: true });
  } catch {
    return null;
  }

  const contar = (tabla, donde = '') => {
    try {
      return db.prepare(`SELECT COUNT(*) n FROM ${tabla}${donde ? ` WHERE ${donde}` : ''}`).get().n;
    } catch {
      return 0;
    }
  };

  const detalle = {};
  for (const t of ['perfil', 'lead', 'reunion', 'proyecto', 'mensaje', 'envio', 'users', 'tarea']) {
    detalle[t] = contar(t);
  }

  // Un lead es "real" si su lista no es una de las que planta el seed. Es una
  // heurística, y por eso es CONSERVADORA: ante la duda cuenta como real.
  let reales = 0;
  try {
    const filas = db.prepare('SELECT lista, COUNT(*) n FROM lead GROUP BY lista').all();
    for (const f of filas) if (!LISTAS_DE_DEMO.has(String(f.lista ?? ''))) reales += f.n;
  } catch {
    reales = detalle.lead;
  }

  db.close();
  return { existe: true, total: detalle.lead + detalle.perfil, reales, detalle };
}

/** Dónde viven las copias. Fuera de git, y nunca se limpian solas. */
export function carpetaDeCopias(pb) {
  return path.join(pb, 'copias');
}

function sello() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/**
 * Copia la base entera.
 *
 * Devuelve la ruta de la copia, o `null` si no había nada que copiar.
 *
 * Se copian también los `-wal` y `-shm`: son parte de la base. Copiar sólo el
 * `.db` con el WAL afuera deja una copia sin las últimas escrituras — que en
 * PocketBase pueden ser horas de trabajo.
 */
export function copiar(pb, datos, motivo = 'manual') {
  if (!fs.existsSync(datos)) return null;
  const destino = path.join(carpetaDeCopias(pb), `${sello()}-${motivo}`);
  fs.mkdirSync(destino, { recursive: true });
  fs.cpSync(datos, destino, { recursive: true });
  return destino;
}

/** Las copias que hay, de la más nueva a la más vieja. */
export function copiasQueHay(pb) {
  const dir = carpetaDeCopias(pb);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => fs.statSync(path.join(dir, f)).isDirectory())
    .sort()
    .reverse();
}

/** Cuánto ocupa un directorio, en MB, para poder decirlo. */
export function pesoEnMb(dir) {
  let total = 0;
  const recorrer = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) recorrer(p);
      else total += fs.statSync(p).size;
    }
  };
  try {
    recorrer(dir);
  } catch {
    return 0;
  }
  return Math.round((total / 1024 / 1024) * 10) / 10;
}

/**
 * Devuelve una copia a su lugar.
 *
 * Antes de pisar la base actual, la copia. Restaurar también es destruir: si
 * uno restaura la copia equivocada sin esto, se lleva puesto lo que había.
 */
export function restaurar(pb, datos, nombre) {
  const origen = path.join(carpetaDeCopias(pb), nombre);
  if (!fs.existsSync(origen)) throw new Error(`No existe la copia «${nombre}».`);
  const antes = copiar(pb, datos, 'antes-de-restaurar');
  fs.rmSync(datos, { recursive: true, force: true });
  fs.cpSync(origen, datos, { recursive: true });
  return antes;
}

/** La frase que hay que escribir para borrar datos reales. */
export const FRASE_PARA_BORRAR = '--si-quiero-borrar-datos-reales';

/**
 * La frase para sembrar datos de demo sobre una base que tiene datos reales.
 *
 * El seed no borra, pero escribe ocho usuarios con la clave `demo12345` —uno
 * administrador—, así que sobre la base de trabajo es una puerta abierta. Es
 * distinta de la de borrar a propósito: son dos permisos distintos y no tiene
 * que alcanzar con haber tipeado uno.
 */
export const FRASE_PARA_SEMBRAR = '--si-quiero-datos-de-demo-aca';
