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

// Los documentos que además viven trackeados en docs/ se refrescan desde el
// bundle. Si no, un bundle nuevo los deja viejos EN SILENCIO: el de docs/ es el
// que se lee en GitHub y el que citan las notas, así que la copia stale sería
// la que todo el mundo mira.
const espejados = [
  ['MANUAL.md', 'docs/MANUAL.md'],
  ['MANUAL-control-proyectos.md', 'docs/MANUAL-control-proyectos.md'],
  ['DISENO-control-proyectos.md', 'docs/design/DISENO-control-proyectos.md'],
];
let refrescados = 0;
for (const [origen, copia] of espejados) {
  const desde = path.join(destino, origen);
  if (!fs.existsSync(desde)) continue;
  const hacia = path.join(raiz, copia);
  const antes = fs.existsSync(hacia) ? fs.readFileSync(hacia, 'utf8') : '';
  const ahora = fs.readFileSync(desde, 'utf8');
  if (antes.replace(/\r/g, '') !== ahora.replace(/\r/g, '')) {
    fs.copyFileSync(desde, hacia);
    console.log(`  ${copia} actualizado desde el bundle`);
    refrescados++;
  }
}

const pantallas = fs.readdirSync(destino).filter((f) => f.endsWith('.dc.html'));
console.log(`${pantallas.length} pantallas en docs/prototipo/ (regenerado desde el bundle)`);
console.log('El CLAUDE.md del bundle quedó como ESTRUCTURA-Y-DECISIONES.md');
if (!refrescados) console.log('Los documentos de docs/ ya estaban al día');
