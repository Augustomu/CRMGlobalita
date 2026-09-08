// Levanta una PocketBase local para desarrollo, aislada de cualquier otra
// instalacion: copia el ejecutable a .pb/ y usa su propia base.
//
//   node packages/db/dev.mjs           aplica migraciones y arranca
//   node packages/db/dev.mjs --seed    ademas carga los datos de demo
//   node packages/db/dev.mjs --reset   borra la base y empieza de cero

import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const raiz = path.resolve(import.meta.dirname, '../..');
const pb = path.join(raiz, '.pb');
const exe = path.join(pb, os.platform() === 'win32' ? 'pocketbase.exe' : 'pocketbase');
const datos = path.join(pb, 'pb_data');
const migraciones = path.join(raiz, 'packages/db/pb_migrations');
const semilla = path.join(raiz, 'packages/db/pb_seed');
const hooks = path.join(raiz, 'packages/db/pb_hooks');

const args = new Set(process.argv.slice(2));

function buscarEjecutable() {
  if (fs.existsSync(exe)) return;
  const candidatos = [
    path.join(os.homedir(), 'pocketbase', 'pocketbase.exe'),
    path.join(os.homedir(), 'pocketbase', 'pocketbase'),
  ];
  const encontrado = candidatos.find((c) => fs.existsSync(c));
  if (!encontrado) {
    console.error(
      'No encuentro el ejecutable de PocketBase.\n' +
        'Bajalo de https://pocketbase.io/docs/ y dejalo en .pb/',
    );
    process.exit(1);
  }
  fs.mkdirSync(pb, { recursive: true });
  fs.copyFileSync(encontrado, exe);
  console.log('Ejecutable copiado a .pb/ (no se toca tu instalacion original)');
}

function migrar(dir) {
  if (!fs.existsSync(dir)) return;
  execFileSync(exe, ['migrate', 'up', '--dir', datos, '--migrationsDir', dir], {
    stdio: 'inherit',
  });
}

if (args.has('--reset') && fs.existsSync(datos)) {
  fs.rmSync(datos, { recursive: true, force: true });
  console.log('Base borrada.');
}

buscarEjecutable();
migrar(migraciones);
if (args.has('--seed')) migrar(semilla);
superusuarioLocal();

console.log('\nPocketBase en http://127.0.0.1:8090/_/  (Ctrl+C para parar)\n');
spawn(exe, ['serve', '--dir', datos, '--migrationsDir', migraciones, '--hooksDir', hooks], {
  stdio: 'inherit',
});

/**
 * Crea el superusuario de la base LOCAL.
 *
 * Sin esto, PocketBase arranca sin superusuario y ABRE SOLO el navegador en
 * `/_/#/pbinstall/...` para que crees uno. Con `--reset` eso pasa cada vez, y
 * termina siendo una pestaña nueva por cada corrida.
 *
 * PocketBase exige un email con dominio: un `dev@local` lo rechaza con
 * "missing or invalid email address".
 *
 * La clave está a la vista a propósito: es la base de desarrollo, vive en
 * `.pb/` (fuera de git) y se borra entera con `--reset`. Produccion es otra
 * instalacion, en el VPS, y no la toca este script.
 */
function superusuarioLocal() {
  try {
    execFileSync(exe, ['superuser', 'upsert', 'dev@globalita.test', 'dev12345678', '--dir', datos], {
      stdio: 'pipe',
    });
    console.log('Superusuario local: dev@globalita.test / dev12345678');
  } catch (e) {
    // Que falle no es motivo para no levantar el servidor: como mucho vuelve a
    // pedirte que crees uno a mano.
    console.log('No se pudo crear el superusuario local:', e.message.split('\n')[0]);
  }
}
