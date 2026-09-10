/**
 * Saca los datos de demo que quedaron del seed del 08/09/2026.
 *
 *   node packages/db/recuperacion/limpiar-demo.mjs             # simulacro
 *   node packages/db/recuperacion/limpiar-demo.mjs --aplicar
 *
 * POR QUÉ ESTO NO ES «BORRAR TODO LO DEL SEED».
 *
 * El seed corrió a las 21:18 del 08/09 y en ese mismo minuto se crearon cosas
 * que HOY SON REALES. Un borrado por fecha se llevaría puesto medio CRM:
 *
 *   cuenta            AL, DL, FR, ED nacieron ahí y tienen 171 leads reales
 *                     colgando. Borrarlas deja 171 leads sin cuenta.
 *   plantilla         las 12 nacieron ahí y OCHO están editadas: son los
 *                     mensajes que Augusto viene escribiendo, en es y pt.
 *   regla             las 4 son suyas, incluida «Lead nuevo de Brasil a
 *                     Francisco», que es ruteo de verdad.
 *   etiqueta          las 15 son su vocabulario —«Compras SP», «MX Norte»,
 *                     «PIV», «Parceria»—, no etiquetas genéricas de ejemplo.
 *   lista_invitacion  configuración de las listas por cuenta.
 *
 * Nada de eso se toca. Lo que sí se va es lo que NADIE puso y NADIE usa:
 * tareas y actividades inventadas (todas con `usuario` vacío), los chats
 * personales de mentira, los entrantes de ejemplo, el usuario de demo y los
 * dos leads de prueba del alta manual.
 *
 * REGLA DE LA CASA: esto no borra nada sin `--aplicar`, y antes hay que tener
 * una copia (`node packages/db/dev.mjs --copia`). Ver la primera sección de
 * CLAUDE.md, que está primera porque ya se rompió una vez.
 */
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APLICAR = process.argv.includes('--aplicar');
const BASE = process.env.CRM_PB_DATA_DIR
  ? path.join(process.env.CRM_PB_DATA_DIR, 'data.db')
  : path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '.pb', 'pb_data', 'data.db');

const db = new DatabaseSync(BASE, { readOnly: !APLICAR });

/** Lo que se va, con el porqué al lado. */
const PLAN = [
  {
    tabla: 'tarea',
    donde: "usuario = ''",
    que: 'tareas del seed — las 12, ninguna asignada a nadie',
  },
  {
    tabla: 'actividad',
    donde: "usuario = ''",
    que: 'actividad inventada — «Asigno 2 leads a Sofia Ferrer», «Suspendio a Vera Molina»',
  },
  {
    tabla: 'entrante',
    donde: '1 = 1',
    que: 'los 4 entrantes de ejemplo',
  },
  {
    tabla: 'chat_personal',
    // Los cinco del seed tienen teléfonos inventados 549341555000x; los seis
    // que se cargaron el 09/09 para poder probar el filtro dicen «(demo)».
    donde: "telefono like '54934155500%' or nombre like '%(demo)%'",
    que: 'chats personales de mentira: 5 del seed + 6 de prueba del filtro',
  },
  {
    tabla: 'users',
    donde: "email = 'demo@globalita.test'",
    que: 'el usuario de demo, que quedó en «pendiente» y nunca entró',
  },
];

/** Los dos leads de prueba del alta manual, con su perfil. */
const LEADS_PRUEBA = "lista = 'Carga manual'";

const contar = (tabla, donde) => db.prepare(`select count(*) c from ${tabla} where ${donde}`).get().c;

console.log(`\n=== LIMPIAR DEMO ${APLICAR ? '· APLICANDO' : '· SIMULACRO (nada se borra)'} ===`);
console.log(`base: ${BASE}\n`);

let total = 0;
for (const p of PLAN) {
  const n = contar(p.tabla, p.donde);
  total += n;
  console.log(`  ${String(n).padStart(3)}  ${p.tabla.padEnd(15)} ${p.que}`);
}

// Los leads de prueba se miran aparte porque arrastran su perfil.
const pruebas = db.prepare(
  `select l.id, l.perfil, p.nombre,
          (select count(*) from reunion r where r.lead = l.id) reuniones,
          (select count(*) from envio e where e.lead = l.id) envios
     from lead l left join perfil p on p.id = l.perfil
    where ${LEADS_PRUEBA}`,
).all();

console.log(`\n  ${String(pruebas.length).padStart(3)}  ${'lead'.padEnd(15)} leads de prueba del alta manual, con su perfil:`);
for (const l of pruebas) {
  console.log(`       · ${l.nombre} — ${l.reuniones} reuniones, ${l.envios} envíos`);
}

// GUARDA: un lead de prueba con reuniones o envíos NO es de prueba.
const conHistoria = pruebas.filter((l) => l.reuniones || l.envios);
if (conHistoria.length) {
  console.error('\n! FRENO: alguno de esos leads tiene reuniones o envíos. No se toca nada.');
  process.exit(1);
}
total += pruebas.length * 2;

console.log(`\n  ${total} registros en total.`);
console.log('\nNO SE TOCA: cuenta, plantilla, regla, etiqueta, lista_invitacion, perfil, lead');
console.log('            (salvo los 2 de prueba), reunion, evento_externo, envio.\n');

if (!APLICAR) {
  console.log('Simulacro. Para hacerlo de verdad, con copia hecha antes:');
  console.log('  node packages/db/dev.mjs --copia');
  console.log('  node packages/db/recuperacion/limpiar-demo.mjs --aplicar\n');
  process.exit(0);
}

for (const p of PLAN) {
  const n = db.prepare(`delete from ${p.tabla} where ${p.donde}`).run().changes;
  console.log(`  ${String(n).padStart(3)}  ${p.tabla} borrados`);
}
for (const l of pruebas) {
  db.prepare('delete from lead where id = ?').run(l.id);
  if (l.perfil) db.prepare('delete from perfil where id = ?').run(l.perfil);
}
console.log(`  ${pruebas.length}  leads de prueba y sus perfiles borrados`);

console.log('\n=== COMO QUEDO ===');
for (const t of ['tarea', 'actividad', 'entrante', 'chat_personal', 'users', 'lead', 'perfil', 'cuenta', 'plantilla', 'etiqueta', 'regla']) {
  console.log(`  ${t.padEnd(16)} ${db.prepare(`select count(*) c from ${t}`).get().c}`);
}
