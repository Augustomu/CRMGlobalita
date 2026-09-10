// Levanta una PocketBase local para desarrollo, aislada de cualquier otra
// instalacion: copia el ejecutable a .pb/ y usa su propia base.
//
//   node packages/db/dev.mjs           aplica migraciones y arranca
//   node packages/db/dev.mjs --seed    ademas carga los datos de demo
//   node packages/db/dev.mjs --reset   borra la base y empieza de cero
//   node packages/db/dev.mjs --copia   solo hace una copia y sale
//   node packages/db/dev.mjs --copias  lista las copias que hay
//
// EL --reset NO BORRA NADA SIN COPIA, Y SE NIEGA SI HAY DATOS REALES.
// El por que esta escrito en copias.mjs. Resumido: el 08/09/2026 se perdieron
// 248 contactos y 298 reuniones importados, porque el --reset de entonces eran
// cuatro lineas sin red.
//
// EL --seed SE NIEGA CON EL MISMO CRITERIO, desde el 10/09/2026. No borra, pero
// crea ocho usuarios con la clave `demo12345` —uno administrador— y correrlo
// sobre la base de trabajo deja esas ocho puertas abiertas.

import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  FRASE_PARA_BORRAR,
  FRASE_PARA_SEMBRAR,
  copiar,
  copiasQueHay,
  carpetaDeCopias,
  pesoEnMb,
  queHayAdentro,
} from './copias.mjs';

const raiz = path.resolve(import.meta.dirname, '../..');

/*
 * El .env de la raiz, si esta.
 *
 * Ahi van las credenciales de Google (paso 4.6 de deploy/PASO-A-PASO.md). NO
 * pueden ir en un archivo del repo: es publico, y un client_secret commiteado
 * hay que rotarlo aunque se borre despues, porque queda en el historial.
 *
 * `loadEnvFile` es de Node, no una dependencia. Tira si el archivo no existe,
 * que es el caso normal: sin Google configurado el CRM funciona igual y la
 * pantalla de Cuentas conectadas dice "sin configurar".
 */
try {
  process.loadEnvFile(path.join(raiz, '.env'));
} catch {
  // No hay .env. Es lo esperado hasta que alguien conecte Google.
}
const pb = path.join(raiz, '.pb');
const exe = path.join(pb, os.platform() === 'win32' ? 'pocketbase.exe' : 'pocketbase');
// PB_DATOS deja arrancar una base limpia en otra carpeta SIN borrar la que ya
// existe. Es la salida sana cuando uno quiere empezar de cero: mover, no
// destruir.
const datos = process.env.PB_DATOS
  ? path.resolve(raiz, process.env.PB_DATOS)
  : path.join(pb, 'pb_data');
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

// --------------------------------------------------------------------------
// Las copias, y la red que faltaba
// --------------------------------------------------------------------------

if (args.has('--copias')) {
  const cs = copiasQueHay(pb);
  if (!cs.length) {
    console.log('Todavia no hay ninguna copia.');
  } else {
    console.log(`${cs.length} copias en ${carpetaDeCopias(pb)}\n`);
    for (const c of cs) {
      console.log('  ', c.padEnd(34), pesoEnMb(path.join(carpetaDeCopias(pb), c)) + ' MB');
    }
    console.log('\nPara volver a una:');
    console.log('   node packages/db/restaurar.mjs <nombre-de-la-copia>');
  }
  process.exit(0);
}

if (args.has('--copia')) {
  const d = copiar(pb, datos, 'a-mano');
  console.log(d ? `Copia hecha en ${d}` : 'No hay base que copiar todavia.');
  process.exit(0);
}

if (args.has('--reset')) {
  const hay = queHayAdentro(datos);

  // Sin poder mirar adentro se asume lo peor. Un "no pude leer la base" no es
  // permiso para borrarla.
  if (hay === null) {
    console.error(
      'No pude leer la base para saber que hay adentro, asi que NO la borro.\n' +
        'Si estas seguro, movela a mano y volve a correr.',
    );
    process.exit(1);
  }

  if (hay.existe && hay.reales > 0 && !args.has(FRASE_PARA_BORRAR)) {
    console.error(
      `\nNO borro nada: esta base tiene ${hay.reales} leads que no son de demo.\n\n` +
        `  perfiles ${hay.detalle.perfil}   leads ${hay.detalle.lead}   ` +
        `reuniones ${hay.detalle.reunion}   proyectos ${hay.detalle.proyecto}\n\n` +
        'Si de verdad los queres borrar:\n\n' +
        `   node packages/db/dev.mjs --reset ${FRASE_PARA_BORRAR}\n\n` +
        'Aun asi se hace una copia antes. Para arrancar limpio SIN tocar esto,\n' +
        'usa otra carpeta: PB_DATOS=.pb/pb_data_limpia node packages/db/dev.mjs\n',
    );
    process.exit(1);
  }

  if (fs.existsSync(datos)) {
    // La copia va SIEMPRE, incluso si adentro solo hay demo: distinguir "esto
    // era descartable" de "esto no" es justo lo que salio mal una vez.
    const copia = copiar(pb, datos, 'antes-del-reset');
    console.log(`Copia guardada en ${copia}`);
    console.log('   (volves con: node packages/db/restaurar.mjs ' + path.basename(copia) + ')');
    fs.rmSync(datos, { recursive: true, force: true });
    console.log('Base borrada.');
  }
}

/*
 * EL SEED DE DEMO NO CORRE SOBRE UNA BASE CON DATOS REALES.
 *
 * `--reset` ya se negaba con este mismo criterio; `--seed` no se negaba con
 * ninguno, y es la otra mitad del mismo problema. El seed no borra, pero
 * ESCRIBE, y lo que escribe son ocho usuarios con la clave `demo12345`:
 *
 *   pb_seed/1788600100_demo.js       Alberto (administrador), Sofia, Bruno, Vera
 *   pb_seed/1788601000_control_demo.js  Ignacio, Renata
 *   pb_seed/1788602000_partner.js       Alejandro, Nicolas
 *
 * Uno de ellos es administrador y esta `activo` y `verified`. Correr esto por
 * error sobre la base de trabajo —o sobre una restaurada de una copia— deja
 * ocho puertas abiertas con una clave que esta escrita en un repo publico.
 * (El `demo@globalita.test` de pb_migrations/1788603500 es otra cosa y NO es
 * el riesgo: nace `pendiente` y con una clave aleatoria de 40 caracteres.)
 *
 * El criterio es EL MISMO que el de `--reset`, no uno nuevo: `queHayAdentro()`
 * cuenta como reales los leads cuya lista no es una de las que planta el seed,
 * y ante la duda cuenta como real.
 *
 * La salida sana es la de siempre: otra carpeta, no esta base.
 *
 * Se chequea ACA ARRIBA, antes de `buscarEjecutable()` y de las migraciones:
 * si la respuesta va a ser que no, no hay razon para haber tocado nada primero.
 */
if (args.has('--seed')) {
  const hay = queHayAdentro(datos);

  if (hay === null) {
    console.error(
      'No pude leer la base para saber que hay adentro, asi que NO corro el seed.\n' +
        'El seed crea usuarios con clave conocida y no se escriben a ciegas.',
    );
    process.exit(1);
  }

  if (hay.existe && hay.reales > 0 && !args.has(FRASE_PARA_SEMBRAR)) {
    console.error(
      `\nNO corro el seed: esta base tiene ${hay.reales} leads que no son de demo.\n\n` +
        `  perfiles ${hay.detalle.perfil}   leads ${hay.detalle.lead}   ` +
        `reuniones ${hay.detalle.reunion}   usuarios ${hay.detalle.users}\n\n` +
        'El seed crea ocho usuarios con la clave `demo12345`, uno de ellos\n' +
        'administrador. Sobre una base de trabajo eso es una puerta abierta.\n\n' +
        'Para tener los datos de demo SIN tocar esta base:\n\n' +
        '   PB_DATOS=.pb/pb_data_demo node packages/db/dev.mjs --seed\n\n' +
        'Si de verdad los queres acá:\n\n' +
        `   node packages/db/dev.mjs --seed ${FRASE_PARA_SEMBRAR}\n`,
    );
    process.exit(1);
  }
}

buscarEjecutable();
migrar(migraciones);

if (args.has('--seed')) {
  // Aun cuando el chequeo de arriba dejo pasar, se copia antes. Escribir
  // tampoco es gratis: revertir un seed a mano es buscar 43 registros entre 26
  // tablas, y ya hubo que hacerlo una vez (limpiar-demo.mjs).
  const copia = copiar(pb, datos, 'antes-del-seed');
  if (copia) console.log(`Copia guardada en ${copia}`);
  migrar(semilla);
}

superusuarioLocal();

console.log('\nPocketBase en http://127.0.0.1:8090/_/  (Ctrl+C para parar)\n');
spawn(exe, ['serve', '--dir', datos, '--migrationsDir', migraciones, '--hooksDir', hooks], {
  stdio: 'inherit',
  /*
   * APP_URL es lo que va adentro del enlace del correo de alta (§6.7). En
   * produccion lo pone el .service; aca apunta al Vite local, para que el
   * enlace del correo abra la app que estas corriendo y no la de internet.
   *
   * Sin esto, dar de alta a alguien falla en desarrollo con "Falta APP_URL" —
   * que es correcto, pero pasaria en cada corrida.
   */
  env: {
    ...process.env,
    APP_URL: process.env.APP_URL || 'http://localhost:5173',
    /*
     * Donde CONTESTA PocketBase, que en desarrollo NO es donde vive la app:
     * Vite sirve en :5173 y PocketBase en :8090. Google redirige al
     * redirect_uri, que tiene que ser una ruta de este servidor; la vuelta
     * final al navegador va a APP_URL. En produccion son la misma cosa y
     * PB_URL ni se define.
     */
    PB_URL: process.env.PB_URL || 'http://127.0.0.1:8090',
    /*
     * Habilita /api/abrir, que lanza Chrome con el perfil de cada cuenta.
     *
     * Solo tiene sentido cuando PocketBase corre en la maquina de la persona,
     * que es exactamente el caso de desarrollo. El servicio del VPS NO define
     * esta variable, asi que ahi el endpoint contesta 404 y no existe: un
     * servidor remoto abriendo navegadores no le sirve a nadie y es una puerta
     * de mas.
     */
    CHROME_LOCAL: process.env.CHROME_LOCAL ?? '1',
    // Sin valor por defecto A PROPOSITO. Antes venia 'crm@globalita.test', un
    // dominio inventado, y eso terminaba siendo el remitente real de los
    // correos: el From no coincidia con la casilla autenticada y el servidor
    // los rechazaba. Vacio, manda el 'Sender address' del panel, que es el que
    // se carga junto con el usuario y la clave.
    MAIL_DESDE: process.env.MAIL_DESDE || '',
  },
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
