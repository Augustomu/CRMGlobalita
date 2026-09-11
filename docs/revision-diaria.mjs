/**
 * La revisión diaria del CRM. Corre sola, todas las mañanas.
 *
 * POR QUE EXISTE. Augusto, 11/09: *«¿tenemos alguna tarea diaria de revisión de
 * código, análisis de base de datos, si está todo correcto?»*. La respuesta era
 * no. Había cinco tareas programadas y las cinco eran de BACKUP — que lo que
 * hay salga de la máquina—. Ninguna preguntaba si lo que hay **está bien**.
 *
 * Son dos preguntas distintas. Un backup impecable de una base corrupta es un
 * backup impecable de una base corrupta.
 *
 * LAS CUATRO COSAS QUE MIRA, y por qué cada una:
 *
 *   1. Los tests de `core`. Ahí viven todas las reglas de negocio. Si uno se
 *      rompió, se rompió una regla, y el CRM sigue andando igual — simplemente
 *      hace lo que no corresponde.
 *   2. Las dependencias. `core` no puede importar nada de afuera y nada puede
 *      apuntar al revés (regla 3 de CLAUDE.md). Es la regla que más barato se
 *      rompe sin que nadie lo note.
 *   3. El registro de errores. `revisar-aprendizajes.mjs` busca los que ya
 *      volvieron: contraste ilegible, CSS que se pisa, tamaños fuera de escala,
 *      handlers de PocketBase con el scope equivocado.
 *   4. La integridad de SQLite. `PRAGMA integrity_check` sobre la base y sobre
 *      la copia más reciente. Una base que se corrompe no avisa: sigue
 *      contestando hasta el día que no.
 *
 * NO TOCA NADA. Lee, comprueba y reporta. Sale 1 si algo está mal, que es lo
 * que hace que la tarea programada figure en rojo en el Programador de tareas.
 *
 *   node docs/revision-diaria.mjs
 */
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { existsSync, readdirSync, appendFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const problemas = [];
const lineas = [];

const decir = (m) => {
  console.log(m);
  lineas.push(m);
};

/** Corre un comando y cuenta si salió bien. No tira: se anota y se sigue. */
function paso(nombre, ejecutable, args) {
  try {
    execFileSync(ejecutable, args, { cwd: raiz, encoding: 'utf8', stdio: 'pipe' });
    decir(`[OK    ] ${nombre}`);
  } catch (e) {
    // La salida importa más que el código: `node --test` dice cuál test falló.
    const salida = String(e.stdout || '') + String(e.stderr || '');
    const ultimas = salida.trim().split('\n').slice(-6).join('\n      ');
    decir(`[FALLO ] ${nombre}\n      ${ultimas}`);
    problemas.push(nombre);
  }
}

decir(`\n=== REVISION DIARIA DEL CRM · ${new Date().toISOString()} ===`);

paso('tests de core', process.execPath, ['--test', 'packages/core/test/*.test.ts']);
paso('dependencias en una sola direccion', process.execPath, ['docs/revisar-dependencias.mjs']);
paso('errores del registro', process.execPath, ['docs/revisar-aprendizajes.mjs']);
paso('campos contra el esquema', process.execPath, ['docs/revisar-campos.mjs']);

/**
 * La base, y la copia más nueva.
 *
 * Se miran las dos porque son fallas distintas: la base se puede corromper hoy,
 * y una copia se puede haber guardado ya corrupta hace una semana. Descubrir lo
 * segundo el día que hay que restaurar es tarde.
 */
function revisarSqlite(nombre, ruta) {
  if (!existsSync(ruta)) {
    decir(`[SALTEA] ${nombre} — no existe: ${ruta}`);
    return;
  }
  try {
    const db = new DatabaseSync(ruta, { readOnly: true });
    const integridad = db.prepare('PRAGMA integrity_check').get();
    const valor = Object.values(integridad)[0];
    const fks = db.prepare('PRAGMA foreign_key_check').all();

    if (valor !== 'ok') {
      decir(`[FALLO ] ${nombre} — integrity_check: ${valor}`);
      problemas.push(nombre);
      return;
    }
    if (fks.length) {
      decir(`[FALLO ] ${nombre} — ${fks.length} referencias rotas`);
      problemas.push(nombre);
      return;
    }
    // Y que tenga datos. Una base integra y vacia pasa los dos chequeos de
    // arriba con total aplomo, y es justo lo que hay que ver.
    const n = (t) => {
      try {
        return db.prepare('select count(*) c from ' + t).get().c;
      } catch {
        return 0;
      }
    };
    const perfiles = n('perfil');
    const leads = n('lead');
    if (perfiles === 0) {
      decir(`[FALLO ] ${nombre} — 0 perfiles. La base esta vacia.`);
      problemas.push(nombre);
      return;
    }
    decir(`[OK    ] ${nombre} — ${perfiles} perfiles, ${leads} leads, integridad ok`);
  } catch (e) {
    decir(`[FALLO ] ${nombre} — no se pudo leer: ${e.message}`);
    problemas.push(nombre);
  }
}

revisarSqlite('base local', join(raiz, '.pb/pb_data/data.db'));

const dirCopias = join(raiz, '.pb/copias');
if (existsSync(dirCopias)) {
  const copias = readdirSync(dirCopias).sort();
  const ultima = copias[copias.length - 1];
  if (ultima) revisarSqlite(`copia mas nueva (${ultima})`, join(dirCopias, ultima, 'data.db'));
  decir(`[INFO  ] ${copias.length} copias guardadas`);
}

// El resultado queda escrito: si la tarea corre a las 09:00 y nadie estaba
// mirando, el log es lo unico que dice que paso.
try {
  const dirLog = join(raiz, '.pb/revisiones');
  mkdirSync(dirLog, { recursive: true });
  const hoy = new Date().toISOString().slice(0, 10);
  appendFileSync(join(dirLog, `revision-${hoy}.log`), lineas.join('\n') + '\n', 'utf8');
} catch {
  // Si no se puede escribir el log, la revision ya se dijo por pantalla.
}

if (problemas.length) {
  console.error(`\n${problemas.length} problema(s): ${problemas.join(', ')}`);
  process.exit(1);
}
console.log('\nTodo en orden: reglas, dependencias, registro de errores y base.');
