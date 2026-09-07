// Detecta perfiles que se pisan y los MARCA. Nunca fusiona (D02).
//
//   node packages/db/recuperacion/detectar-duplicados.mjs            # simulacro
//   node packages/db/recuperacion/detectar-duplicados.mjs --aplicar
//
// Despues de importar de dos fuentes distintas quedan perfiles de la misma
// persona por duplicado: el Calendar trae nombre + LinkedIn + cuenta pero sin
// telefono; el CSV de WhatsApp trae nombre + telefono pero sin LinkedIn.
//
// Este script los emparenta y deja el trabajo listo para que una persona
// decida en la bandeja de duplicados. La fusion no puede ser automatica: hay
// dos personas distintas compartiendo un telefono (Mauricio Mantovani y Paul
// Goris, +31 6 3179xxxx), y fusionarlas seria un error irreversible.

import { entrar, PB_URL } from './entrar.mjs';
import { huella } from '../../core/src/dedupe.ts';

const APLICAR = process.argv.includes('--aplicar');


const pb = await entrar();

const todos = await pb.collection('perfil').getFullList({ sort: 'created' });

// Los perfiles ya fusionados no se vuelven a comparar: quedan como rastro para
// poder llegar al que sobrevivio, nada mas.
const perfiles = todos.filter((p) => !p.fusionado_en);

/** Dos perfiles que una persona ya declaro distintos no vuelven a la bandeja. */
function yaSeMiraron(a, b) {
  const da = a.distinto_de ?? [];
  const db = b.distinto_de ?? [];
  return da.includes(b.id) || db.includes(a.id);
}
console.log('='.repeat(70));
console.log(APLICAR ? 'MARCANDO' : 'SIMULACRO — nada se escribe');
console.log('perfiles:', perfiles.length);
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

const grupos = new Map(); // clave -> { motivo, perfiles[] }

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
const porHuella = new Map();
for (const p of perfiles) {
  const h = p.huella || huella(p.nombre, p.empresa);
  if (!h) continue;
  if (!porHuella.has(h)) porHuella.set(h, []);
  porHuella.get(h).push(p);
}
for (const [h, v] of porHuella) {
  if (v.length < 2) continue;
  for (let i = 1; i < v.length; i++) agrupar(`huella:${h}`, 'mismo nombre y empresa', v[0], v[i]);
}

// 3. Nombres muy parecidos entre las DOS fuentes: uno con LinkedIn (Calendar)
//    y otro con teléfono (CSV). Es el cruce que interesa: completan datos
//    distintos de la misma persona.
const conLinkedIn = perfiles.filter((p) => (p.slug || p.urn) && !p.telefono);
const conTelefono = perfiles.filter((p) => p.telefono && !p.slug && !p.urn);

/**
 * El Calendar solo guarda el PRIMER nombre (el título del evento es
 * "Marcelo / Francisco / Augusto"), así que "Marcelo" empata con los tres
 * Marcelos del CSV. Pero el slug sí trae el apellido: `marcelomcarneiro`.
 *
 * Comparar contra el slug desambigua: de los tres Marcelos, solo Carneiro
 * aparece dentro de `marcelomcarneiro`.
 */
function apellidoEnSlug(slug, nombreCompleto) {
  if (!slug) return false;
  const s = slug.replace(/[^a-z]/gi, '').toLowerCase();
  const partes = [...tokens(nombreCompleto)];
  // Alcanza con que UNA parte del nombre (que no sea el primer nombre) esté
  // dentro del slug: es lo que distingue Carneiro de Manhães.
  return partes.slice(1).some((t) => t.length >= 4 && s.includes(t));
}

for (const a of conLinkedIn) {
  for (const b of conTelefono) {
    const p = parecido(a.nombre, b.nombre);
    if (p < 0.75) continue;

    // Si el perfil del Calendar tiene slug, se exige que el apellido del
    // candidato aparezca ahí. Sin esa comprobación, un nombre de pila común
    // arrastra a media base.
    if (a.slug && !apellidoEnSlug(a.slug, b.nombre)) continue;

    // Sin slug (solo URN) no hay con qué desambiguar: se marca igual, pero
    // queda para que lo mire una persona, que es de lo que se trata.
    agrupar(`cruce:${a.id}`, a.slug ? 'mismo nombre y apellido en el perfil' : 'mismo nombre, sin apellido para confirmar', a, b);
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

const mapa = new Map(perfiles.map((p) => [p.id, p]));
console.log('\nDetalle:');
for (const [clave, g] of grupos) {
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
console.log('Se resuelven a mano desde la bandeja de duplicados del CRM.');
console.log('='.repeat(70));
