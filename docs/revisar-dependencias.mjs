/**
 * Que las dependencias vayan en una sola dirección (regla 3 de CLAUDE.md).
 *
 * POR QUÉ EXISTE ESTE ARCHIVO. La regla 3 decía «se verifica en CI con
 * dependency-cruiser». No había dependency-cruiser, no había CI y no había
 * `.github/`: era la única regla del proyecto que se declaraba automatizada, y
 * era la única que no tenía nada detrás. Una regla que se dice verificada se
 * deja de mirar a mano — es lo peor de los dos mundos.
 *
 * Lo que se exige, que es lo que la regla quiere decir en este repo:
 *
 *   1. `packages/core/` no importa NADA de afuera de sí mismo. Ni la app, ni la
 *      base, ni paquetes de npm. Son reglas de negocio puras: si una necesita
 *      leer algo, el dato entra por argumento. Es lo que permite testearlas sin
 *      levantar nada.
 *   2. `packages/core/` no importa de `packages/db/` ni de `apps/`. Es el caso
 *      particular de arriba que rompería la dirección de la flecha.
 *   3. `apps/web/` no importa de `packages/db/`. La web habla con PocketBase por
 *      HTTP; el esquema y las migraciones son de otro lado.
 *
 * Sale 1 si algo apunta al revés, para poder colgarlo de un hook o de CI el día
 * que exista.
 */
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');

/** Todos los archivos de código bajo una carpeta. */
function archivos(dir, ext = ['.ts', '.tsx']) {
  const salida = [];
  const ver = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        if (e.name !== 'node_modules' && e.name !== 'dist') ver(p);
      } else if (ext.includes(path.extname(e.name))) salida.push(p);
    }
  };
  if (fs.existsSync(dir)) ver(dir);
  return salida;
}

/** De dónde importa un archivo. Cubre `import`, `export ... from` y `import()`. */
function importaDe(archivo) {
  const texto = fs.readFileSync(archivo, 'utf8');
  const encontrados = [];
  const patrones = [
    /(?:^|\n)\s*import\s[^;]*?from\s*['"]([^'"]+)['"]/g,
    /(?:^|\n)\s*export\s[^;]*?from\s*['"]([^'"]+)['"]/g,
    /(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const re of patrones) {
    for (const m of texto.matchAll(re)) encontrados.push(m[1]);
  }
  return encontrados;
}

const problemas = [];
const rel = (p) => path.relative(RAIZ, p).split(path.sep).join('/');

// ---- 1 y 2 · core no mira para afuera.
for (const f of archivos(path.join(RAIZ, 'packages/core/src'))) {
  for (const d of importaDe(f)) {
    // Lo de node: se permite explícitamente: no es una dependencia del
    // proyecto y no crea una flecha entre paquetes.
    if (d.startsWith('node:')) continue;
    if (d.startsWith('./') || d.startsWith('../')) {
      // Relativo, pero apuntando fuera de core.
      const destino = path.resolve(path.dirname(f), d);
      if (!destino.startsWith(path.join(RAIZ, 'packages/core'))) {
        problemas.push(`${rel(f)} importa fuera de core: ${d}`);
      }
      continue;
    }
    problemas.push(`${rel(f)} importa de afuera: ${d}`);
  }
}

// ---- 3 · la web no toca el paquete de la base.
for (const f of archivos(path.join(RAIZ, 'apps/web/src'))) {
  for (const d of importaDe(f)) {
    if (d.startsWith('@crm/db') || d.includes('packages/db')) {
      problemas.push(`${rel(f)} importa del paquete de la base: ${d}`);
    }
  }
}

if (problemas.length) {
  console.error('Dependencias apuntando al revés (regla 3 de CLAUDE.md):\n');
  for (const p of problemas) console.error('  · ' + p);
  console.error(`\n${problemas.length} en total.`);
  process.exit(1);
}
console.log('Las dependencias van en una sola dirección.');
