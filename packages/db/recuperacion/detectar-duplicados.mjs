// Detecta perfiles que se pisan y los MARCA. Nunca fusiona (D02).
//
//   node packages/db/recuperacion/detectar-duplicados.mjs            # simulacro
//   node packages/db/recuperacion/detectar-duplicados.mjs --aplicar
//   ... --aplicar --limpiar-marcas   # ademas BORRA las marcas que ya no propone
//
// Despues de importar de dos fuentes distintas quedan perfiles de la misma
// persona por duplicado: el Calendar trae nombre + LinkedIn + cuenta pero sin
// telefono; el CSV de WhatsApp trae nombre + telefono pero sin LinkedIn.
//
// Este script los emparenta y deja el trabajo listo para que una persona
// decida en la bandeja de duplicados. La fusion no puede ser automatica: hay
// dos personas distintas compartiendo un telefono (Mauricio Mantovani y Paul
// Goris, +31 6 3179xxxx), y fusionarlas seria un error irreversible.
//
// EL PROBLEMA DEL NOMBRE DE PILA. El titulo del evento es "Marcelo / Francisco
// / Augusto", asi que 173 de los 187 perfiles del Calendar tienen una sola
// palabra por nombre. Emparejar "Marcelo" con todos los Marcelo del CSV daba
// 181 grupos: mas ruido que trabajo util, y una bandeja de 181 pantallas no la
// mira nadie.
//
// Hace falta un segundo dato que confirme. Hay dos, y con cualquiera alcanza:
//   - el slug de LinkedIn      -> `marcelomcarneiro` contiene "carneiro"
//   - el email del invitado    -> `emilliapaulino11@gmail.com` contiene "paulino"
// Sin ninguno de los dos NO se marca: dejar a la persona sin emparejar es mejor
// que enterrarla entre falsos positivos.

import { entrar } from './entrar.mjs';
import { huella, sinConQueConfirmar } from '../../core/src/dedupe.ts';

const APLICAR = process.argv.includes('--aplicar');
const pb = await entrar();

const todos = await pb.collection('perfil').getFullList({ sort: 'created' });

// Los perfiles ya fusionados no se vuelven a comparar: quedan como rastro para
// poder llegar al que sobrevivio, nada mas.
const perfiles = todos.filter((p) => !p.fusionado_en);

// El email vive en el lead (es de la relacion, no de la persona), asi que hay
// que traerlo aparte.
const leads = await pb.collection('lead').getFullList({ fields: 'perfil,email,email2,email3' });
const emailsDe = new Map();
for (const l of leads) {
  const suyos = [l.email, l.email2, l.email3].filter(Boolean);
  if (suyos.length) emailsDe.set(l.perfil, [...(emailsDe.get(l.perfil) ?? []), ...suyos]);
}

/** Dos perfiles que una persona ya declaro distintos no vuelven a la bandeja. */
function yaSeMiraron(a, b) {
  const da = a.distinto_de ?? [];
  const db = b.distinto_de ?? [];
  return da.includes(b.id) || db.includes(a.id);
}

console.log('='.repeat(70));
console.log(APLICAR ? 'MARCANDO' : 'SIMULACRO — nada se escribe');
console.log('perfiles:', perfiles.length, '| leads con email:', emailsDe.size);
console.log('='.repeat(70));

/** Nombre normalizado para comparar: sin acentos, sin puntuación, sin orden. */
function tokens(nombre) {
  return new Set(
    (nombre || '')
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2),
  );
}

/** Cuánto se parecen dos nombres: 1 = uno contiene al otro entero. */
function parecido(a, b) {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.size || !tb.size) return 0;
  let comunes = 0;
  for (const t of ta) if (tb.has(t)) comunes++;
  return comunes / Math.min(ta.size, tb.size);
}

const grupos = new Map(); // clave -> { motivo, ids: Set }

function agrupar(clave, motivo, a, b) {
  if (yaSeMiraron(a, b)) return;
  if (!grupos.has(clave)) grupos.set(clave, { motivo, ids: new Set() });
  grupos.get(clave).ids.add(a.id);
  grupos.get(clave).ids.add(b.id);
}

// 1. Mismo teléfono normalizado. Fuerte, pero NO concluyente.
const porTel = new Map();
for (const p of perfiles) {
  if (!p.telefono) continue;
  if (!porTel.has(p.telefono)) porTel.set(p.telefono, []);
  porTel.get(p.telefono).push(p);
}
for (const [tel, v] of porTel) {
  if (v.length < 2) continue;
  for (let i = 1; i < v.length; i++) agrupar(`tel:${tel}`, 'mismo teléfono', v[0], v[i]);
}

// 2. Misma huella nombre+empresa (D02).
//
// Con la empresa vacia la huella degenera en "mismo nombre", y como el Calendar
// guarda solo el nombre de pila eso emparejaba a todos los Luiz entre si. La
// regla vale cuando hay empresa; sin ella no dice nada.
const porHuella = new Map();
for (const p of perfiles) {
  if (!p.empresa) continue;
  const h = p.huella || huella(p.nombre, p.empresa);
  if (!h) continue;
  if (!porHuella.has(h)) porHuella.set(h, []);
  porHuella.get(h).push(p);
}
for (const [h, v] of porHuella) {
  if (v.length < 2) continue;
  for (let i = 1; i < v.length; i++) agrupar(`huella:${h}`, 'mismo nombre y empresa', v[0], v[i]);
}

// 3. El cruce que interesa: uno con LinkedIn (Calendar) y otro con teléfono
//    (CSV) completan datos distintos de la misma persona.
const conLinkedIn = perfiles.filter((p) => (p.slug || p.urn) && !p.telefono);
const conTelefono = perfiles.filter((p) => p.telefono && !p.slug && !p.urn);

/** Todo junto y sin separadores, para buscar un apellido adentro. */
function aplanar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * ¿Hay algo, además del nombre de pila, que confirme que son la misma persona?
 *
 * Se buscan las partes del nombre completo del candidato (todas menos la
 * primera) dentro del slug de LinkedIn y de los emails. Es lo que distingue
 * a Marcelo Carneiro de Marcelo Manhães cuando el Calendar solo dice "Marcelo".
 */
function confirma(perfilCalendar, nombreCompleto) {
  const donde = [aplanar(perfilCalendar.slug)];
  for (const e of emailsDe.get(perfilCalendar.id) ?? []) donde.push(aplanar(e.split('@')[0]));

  const utiles = donde.filter(Boolean);
  if (!utiles.length) return null; // no hay con qué confirmar

  // La confirmación tiene que ser un dato NUEVO. Si el Calendar dice "Pedro",
  // encontrar "pedro" en `pedro-herrera` no confirma nada: es lo mismo que ya
  // hizo coincidir los nombres. Así "Pedro" dejaba de emparejar con cualquier
  // "José Pedro Madureira" de la base.
  const yaSabido = tokens(perfilCalendar.nombre);
  const partes = [...tokens(nombreCompleto)].filter((t) => t.length >= 4 && !yaSabido.has(t));
  if (!partes.length) return null;

  if (utiles.some((d) => partes.some((t) => d.includes(t)))) {
    return perfilCalendar.slug ? 'apellido en el perfil de LinkedIn' : 'apellido en el email';
  }
  return null;
}

for (const a of conLinkedIn) {
  for (const b of conTelefono) {
    if (parecido(a.nombre, b.nombre) < 0.75) continue;

    // Sin una segunda señal no se marca. Un nombre de pila compartido no es
    // evidencia: hay tres Marcelo, cuatro Daniel y cinco Alejandro en la base.
    const motivo = confirma(a, b.nombre);
    if (!motivo) continue;

    agrupar(`cruce:${a.id}`, motivo, a, b);
  }
}

// Un grupo de uno no es un duplicado: queda asi cuando el unico par que lo
// formaba ya se resolvio a mano.
for (const [clave, g] of grupos) if (g.ids.size < 2) grupos.delete(clave);

// ------------------------------------------------------------------ reporte
const porMotivo = {};
for (const g of grupos.values()) porMotivo[g.motivo] = (porMotivo[g.motivo] ?? 0) + 1;

console.log('\nGrupos encontrados:', grupos.size);
for (const [m, n] of Object.entries(porMotivo).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(4)}  ${m}`);
}

// LO QUE ESTE SCRIPT NO PUEDE VER, dicho por el propio script.
//
// Las tres reglas de arriba necesitan teléfono, empresa, slug o urn. Un perfil
// que no tiene ninguno de los cuatro no puede caer en ningún grupo, y no
// decirlo hace que un "0 grupos" se lea como "no hay duplicados". La cuenta la
// hace `sinConQueConfirmar()` en core, que es la misma que usa la bandeja: dos
// definiciones de "con qué se confirma" se desincronizan a la primera.
const ciegos = perfiles.filter(sinConQueConfirmar);
console.log(
  `\nFuera de alcance: ${ciegos.length} de ${perfiles.length} perfiles vivos no tienen`,
  'con qué confirmarse (ni LinkedIn, ni empresa, ni teléfono).',
);
console.log('Sobre ésos este script no dice nada, ni a favor ni en contra.');

const mapa = new Map(perfiles.map((p) => [p.id, p]));
console.log('\nDetalle:');
for (const [, g] of grupos) {
  const ps = [...g.ids].map((id) => mapa.get(id)).filter(Boolean);
  console.log(`\n  [${g.motivo}]`);
  for (const p of ps) {
    const ident = p.slug ? `/in/${p.slug}` : p.urn ? `urn:${p.urn.slice(0, 12)}` : '—';
    console.log(
      `    ${p.nombre.slice(0, 32).padEnd(34)} ${(p.cargo || '').padEnd(10)} ${(p.pais || '').padEnd(12)} ${ident.padEnd(26)} ${p.telefono ? '+' + p.telefono : ''}`,
    );
  }
}

if (!APLICAR) {
  console.log('\nNada se marcó. Con --aplicar se anotan en posible_duplicado_de.');
  process.exit(0);
}

// ----------------------------------------------------------------- escritura
const enGrupos = new Set([...grupos.values()].flatMap((g) => [...g.ids]));

// LAS MARCAS VIEJAS YA NO SE BORRAN SOLAS, y esto cambio el 10/09/2026.
//
// La idea original era razonable: si no, la bandeja arrastra para siempre lo
// que una corrida anterior propuso. Pero las marcas no las pone solo este
// script. Los tres perfiles de Herik los emparento una persona a mano el 09/09
// —no los encuentra ninguna de las tres reglas de aca, porque ninguno tiene
// slug y solo uno tiene telefono— y estaban esperando en la bandeja.
//
// Medido antes de tocar nada: una corrida con --aplicar sobre la base del
// 10/09 encuentra 0 grupos y borraba las 3 marcas. O sea que el script que
// existe para LLENAR la bandeja la vaciaba, y en silencio.
//
// Ahora hay que pedirlo. Es la primera regla del CLAUDE.md: los borrados los
// pide Augusto, y una marca puesta a mano es trabajo de una persona.
const LIMPIAR = process.argv.includes('--limpiar-marcas');
const sobrantes = perfiles.filter(
  (p) => !enGrupos.has(p.id) && (p.posible_duplicado_de ?? []).length,
);

let limpiados = 0;
if (LIMPIAR) {
  for (const p of sobrantes) {
    await pb.collection('perfil').update(p.id, { posible_duplicado_de: [] });
    limpiados++;
  }
} else if (sobrantes.length) {
  console.log('\n' + '-'.repeat(70));
  console.log(`SE DEJAN COMO ESTAN ${sobrantes.length} marcas que esta corrida no vuelve a`);
  console.log('proponer. Puede ser que alguien las haya puesto a mano:');
  for (const p of sobrantes) console.log(`    ${p.id}  ${p.nombre}`);
  console.log('Para borrarlas igual: --aplicar --limpiar-marcas');
  console.log('-'.repeat(70));
}

let marcados = 0;
for (const g of grupos.values()) {
  const ids = [...g.ids];
  for (const id of ids) {
    await pb.collection('perfil').update(id, {
      posible_duplicado_de: ids.filter((o) => o !== id),
    });
    marcados++;
  }
}

console.log('\n' + '='.repeat(70));
console.log('Perfiles marcados:', marcados, 'en', grupos.size, 'grupos');
if (limpiados) console.log('Marcas viejas borradas:', limpiados);
console.log('Se resuelven a mano desde la bandeja de duplicados del CRM.');
console.log('='.repeat(70));
