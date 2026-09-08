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

fs.rmSync(destino, { recursive: true, force: true });
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

const pantallas = fs.readdirSync(destino).filter((f) => f.endsWith('.dc.html'));
console.log(`${pantallas.length} pantallas en docs/prototipo/ (regenerado desde el bundle)`);
