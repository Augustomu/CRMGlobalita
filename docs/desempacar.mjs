// Desempaca el prototipo para poder leerlo.
//
//   node docs/desempacar.mjs
//
// EL PROTOTIPO VIVE EN UN SOLO LUGAR: `docs/_bundle/CRM de prospeccion.html`,
// que a pesar del nombre es un ZIP — es como lo exporta Design Components.
//
// Antes las 29 pantallas estaban ADEMAS sueltas en `docs/prototipo/`, y eso se
// prestaba a confusión: dos copias que se desincronizan en cuanto llega un
// bundle nuevo y alguien se olvida de reextraer. Ahora `docs/prototipo/` está
// en .gitignore y se regenera con este script: el zip es la única verdad.
//
// El script no pisa nada que no venga del bundle: borra la carpeta y la vuelve
// a escribir entera.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const raiz = path.resolve(import.meta.dirname, '..');
const bundle = path.join(raiz, 'docs/_bundle/CRM de prospeccion.html');
const destino = path.join(raiz, 'docs/prototipo');

if (!fs.existsSync(bundle)) {
  console.error(`No encuentro el bundle en ${bundle}`);
  process.exit(1);
}

// Expand-Archive exige la extensión .zip, así que se copia con ese nombre a un
// temporal. El bundle original no se toca.
const tmp = path.join(raiz, '.pb', 'prototipo.zip');
fs.mkdirSync(path.dirname(tmp), { recursive: true });
fs.copyFileSync(bundle, tmp);

// En Windows esto falla con EPERM si algo tiene la carpeta abierta: un editor,
// el explorador, o un servidor estático sirviéndola. `maxRetries` cubre el
// bloqueo momentáneo; si igual no se puede, se avisa con el motivo en vez de
// tirar un stack trace de fs.
try {
  fs.rmSync(destino, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
} catch (e) {
  console.error(
    `No pude borrar ${destino}: ${e.code}.\n` +
      'Cerrá lo que la tenga abierta (un editor, el explorador, un servidor) y probá de nuevo.',
  );
  process.exit(1);
}
fs.mkdirSync(destino, { recursive: true });

try {
  if (process.platform === 'win32') {
    execFileSync(
      'powershell',
      ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${tmp}' -DestinationPath '${destino}' -Force`],
      { stdio: 'inherit' },
    );
  } else {
    execFileSync('unzip', ['-o', '-q', tmp, '-d', destino], { stdio: 'inherit' });
  }
} finally {
  fs.rmSync(tmp, { force: true });
}

// El bundle trae su propio CLAUDE.md, que describe el PROTOTIPO: sus secciones,
// sus convenciones y su backlog. Dejarlo con ese nombre adentro del repo es un
// problema: cualquier agente que trabaje en esa carpeta lo lee como
// instrucciones de construcción, y son otra cosa que el CLAUDE.md de la raíz.
const suCLAUDE = path.join(destino, 'CLAUDE.md');
if (fs.existsSync(suCLAUDE)) {
  fs.renameSync(suCLAUDE, path.join(destino, 'ESTRUCTURA-Y-DECISIONES.md'));
}

// Los documentos del bundle NO se copian encima de los de docs/.
//
// Antes sí: el bundle refrescaba docs/MANUAL.md, para que una versión nueva del
// prototipo no dejara el manual viejo en silencio. Desde el 08/09/2026 la
// dirección es la contraria — `docs/MANUAL.md` es el documento único y vivo, y
// el del bundle es la copia que quedó congelada adentro del prototipo. Copiarlo
// encima borraría todo lo que se decidió después, y sin decir nada.
//
// Así que sólo se avisa. Quien vea el aviso decide qué llevar de un lado al
// otro; lo que no puede pasar es que lo decida un script.
const suManual = path.join(destino, 'MANUAL.md');
const nuestro = path.join(raiz, 'docs/MANUAL.md');
let distintos = false;
if (fs.existsSync(suManual) && fs.existsSync(nuestro)) {
  const a = fs.readFileSync(suManual, 'utf8').replace(/\r/g, '');
  const b = fs.readFileSync(nuestro, 'utf8').replace(/\r/g, '');
  distintos = a !== b;
}

const pantallas = fs.readdirSync(destino).filter((f) => f.endsWith('.dc.html'));
console.log(`${pantallas.length} pantallas en docs/prototipo/ (regenerado desde el bundle)`);
console.log('El CLAUDE.md del bundle quedó como ESTRUCTURA-Y-DECISIONES.md');
if (distintos) {
  console.log('');
  console.log('El MANUAL.md del bundle no es igual al de docs/. Es lo esperable:');
  console.log('docs/MANUAL.md es el documento vivo y el del bundle quedó congelado');
  console.log('cuando se armó el prototipo. NO se copió nada encima.');
}
