// Recupera leads desde el histórico de Google Calendar.
//
//   node packages/db/recuperacion/importar-calendar.mjs                 # simulacro
//   node packages/db/recuperacion/importar-calendar.mjs --aplicar       # escribe
//   PB_URL=https://crm.globalita.tech ... --aplicar                     # produccion
//
// Los eventos del sistema viejo traen, en el titulo y la descripcion:
//   "Marcelo / Francisco / Augusto"
//   LinkedIn: https://www.linkedin.com/in/marcelomcarneiro
//   PB_ID: r8w2vd3ithxi7qb
//
// De ahi salen: nombre del lead, cuenta de origen, perfil de LinkedIn, email
// del invitado y la fecha de la reunion. Son los leads que MAS valen: llegaron
// hasta la reunion.

import fs from 'node:fs';
import path from 'node:path';
import { entrar, PB_URL } from './entrar.mjs';
import { normalizarSlug, extraerUrn, huella } from '../../core/src/dedupe.ts';

const RAIZ = path.resolve(import.meta.dirname, '../../..');
const APLICAR = process.argv.includes('--aplicar');

const eventos = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, 'eventos-calendar.json'), 'utf8'),
);

/**
 * Los titulos vienen como "Lead / Cuenta / Augusto", con guion en los mas
 * viejos, y algunos no siguen el patron. Los que no matchean se reportan en vez
 * de adivinarlos.
 */
function partirTitulo(summary) {
  const partes = String(summary).split(/\s*[\/|-]\s*/).map((s) => s.trim()).filter(Boolean);
  if (partes.length >= 3) return { lead: partes[0], cuenta: normalizarCuenta(partes[1]) };
  return { lead: partes[0] ?? '', cuenta: null };
}

/**
 * La misma cuenta aparece escrita de varias formas a lo largo de los meses:
 * "David", "David Luna", "Francisco", "Francisco Hernandez", "ALejandro". Sin
 * esto se crearían cuentas duplicadas, y la cuenta es de donde cuelga todo el
 * trabajo de prospección.
 *
 * Se queda con el primer nombre, que es lo único constante.
 */
function normalizarCuenta(nombre) {
  const primero = String(nombre).trim().split(/\s+/)[0] ?? '';
  if (!primero) return null;
  return primero[0].toUpperCase() + primero.slice(1).toLowerCase();
}

/** Un link de LinkedIn puede venir en cinco formas; solo dos son usables. */
function clasificarLink(url) {
  if (!url) return { tipo: 'sin_link', slug: '', urn: '' };
  const slug = normalizarSlug(url);
  if (/^manual-\d+/.test(slug)) return { tipo: 'placeholder', slug: '', urn: '' };
  // Un "slug" que empieza en acwaa/acoaa es en realidad un URN mal pegado.
  if (/^ac[ow]aa/i.test(slug)) return { tipo: 'urn_como_slug', slug: '', urn: slug };
  if (url.includes('/sales/lead/')) {
    return { tipo: 'sales_navigator', slug: '', urn: extraerUrn(url) };
  }
  if (slug) return { tipo: 'slug', slug, urn: '' };
  return { tipo: 'roto', slug: '', urn: '' };
}

const resumen = { perfiles: 0, leads: 0, cuentas: 0, reuniones: 0, saltados: 0 };
const porTipo = {};
const plan = [];

for (const ev of eventos) {
  // El extractor ya resolvio los titulos donde el lead no va primero
  // ("Alejandro - Augusto - Herik Brasil"). Si lo hizo, se le cree: partir el
  // titulo a ciegas daria "Alejandro" como nombre del lead, que es la cuenta.
  const delTitulo = partirTitulo(ev.summary);
  const nombreLead = ev.lead_del_titulo || delTitulo.lead;
  const cuenta = normalizarCuenta(ev.cuenta_del_titulo ?? '') ?? delTitulo.cuenta;
  const link = clasificarLink(ev.linkedin);
  porTipo[link.tipo] = (porTipo[link.tipo] ?? 0) + 1;

  if (!nombreLead) {
    resumen.saltados++;
    continue;
  }

  plan.push({
    nombre: nombreLead,
    nombre_completo: ev.nombre_invitado || nombreLead,
    cuenta: cuenta,
    slug: link.slug,
    urn: link.urn,
    tipo_link: link.tipo,
    email: ev.email ?? '',
    telefono: ev.telefono ?? '',
    ciudad: ev.ciudad ?? '',
    pb_id_viejo: ev.pb_id,
    reunion: ev.inicio,
    event_id: ev.event_id,
    asistio: ev.respuesta === 'accepted',
  });
}

// Un mismo perfil puede tener varias reuniones (reagendadas): se agrupan.
const porPersona = new Map();
for (const p of plan) {
  const clave = p.slug || p.urn || p.email || huella(p.nombre_completo, '');
  if (!porPersona.has(clave)) porPersona.set(clave, { ...p, reuniones: [] });
  porPersona.get(clave).reuniones.push({ inicio: p.reunion, event_id: p.event_id, asistio: p.asistio });
}

console.log('='.repeat(66));
console.log(APLICAR ? 'IMPORTANDO' : 'SIMULACRO (no escribe nada) — usa --aplicar para escribir');
console.log('destino:', PB_URL);
console.log('='.repeat(66));
console.log('\nEventos leidos:', eventos.length);
console.log('Personas distintas:', porPersona.size);
console.log('\nCalidad de los links:');
for (const [t, n] of Object.entries(porTipo).sort((a, b) => b[1] - a[1])) {
  const nota = { slug: 'usable', urn_como_slug: 'usable (es URN)', sales_navigator: 'usable (es URN)', placeholder: 'SIN PERFIL REAL', roto: 'SIN PERFIL REAL', sin_link: 'SIN LINK' }[t];
  console.log(`  ${String(n).padStart(3)}  ${t.padEnd(16)} ${nota}`);
}

const cuentas = [...new Set([...porPersona.values()].map((p) => p.cuenta).filter(Boolean))];
console.log('\nCuentas de origen encontradas:', cuentas.join(', '));

console.log('\nPersonas a recuperar:');
for (const p of [...porPersona.values()].slice(0, 40)) {
  const id = p.slug ? `/in/${p.slug}` : p.urn ? `urn:${p.urn.slice(0, 14)}…` : '(sin perfil)';
  console.log(
    `  ${(p.cuenta ?? '?').padEnd(11)} ${p.nombre_completo.slice(0, 26).padEnd(27)} ${id.padEnd(34)} ${p.reuniones.length} reunión(es)  ${p.email || ''}`,
  );
}

if (!APLICAR) {
  console.log('\nNada se escribio. Con --aplicar se crean perfiles, cuentas y leads.');
  process.exit(0);
}

// ---------------------------------------------------------------- escritura
const pb = await entrar();

/**
 * La abreviatura es la identidad de la cuenta (§2), así que se busca por ahí y
 * se reusa el slot existente. Los nombres del Calendar (Francisco, Edith…) son
 * los reales; si la cuenta ya existe con otro `nombre_perfil`, se corrige.
 */
const ABREV = { Francisco: 'FR', Edith: 'ED', Alejandro: 'AL', David: 'DL', Bruno: 'BR', Augusto: 'AU' };
const cacheCuentas = new Map();

async function cuentaId(nombre) {
  if (cacheCuentas.has(nombre)) return cacheCuentas.get(nombre);

  const abrev = ABREV[nombre] ?? nombre.slice(0, 2).toUpperCase();
  const porAbrev = await pb.collection('cuenta').getFullList({ filter: `abrev = "${abrev}"` });

  if (porAbrev[0]) {
    // Existe el slot: se le pone el nombre real que dice el Calendar.
    if (porAbrev[0].nombre_perfil !== nombre) {
      await pb.collection('cuenta').update(porAbrev[0].id, { nombre_perfil: nombre });
    }
    cacheCuentas.set(nombre, porAbrev[0].id);
    return porAbrev[0].id;
  }

  const todas = await pb.collection('cuenta').getFullList();
  const slot = Math.max(0, ...todas.map((c) => c.slot ?? 0)) + 1;
  const r = await pb.collection('cuenta').create({
    abrev, nombre_perfil: nombre, slot,
    estado_sesion: 'sin_vincular', sesion_wa: 'sin_vincular',
    cupo_diario: 40, objetivo_semanal: 200,
  });
  resumen.cuentas++;
  cacheCuentas.set(nombre, r.id);
  return r.id;
}

for (const p of porPersona.values()) {
  // Perfil: se busca por los identificadores de D02 antes de crear.
  let perfil = null;
  for (const [campo, valor] of [['slug', p.slug], ['urn', p.urn]]) {
    if (!valor) continue;
    const hit = await pb.collection('perfil').getFullList({ filter: `${campo} = "${valor}"` });
    if (hit[0]) { perfil = hit[0]; break; }
  }

  const datos = {
    slug: p.slug, urn: p.urn,
    huella: huella(p.nombre_completo, ''),
    nombre: p.nombre_completo,
    ciudad: p.ciudad,
    telefono: p.telefono, telefono_raw: p.telefono, telefono_valido: false,
  };

  if (perfil) {
    await pb.collection('perfil').update(perfil.id, datos);
  } else {
    perfil = await pb.collection('perfil').create(datos);
    resumen.perfiles++;
  }

  if (!p.cuenta) continue;
  const cid = await cuentaId(p.cuenta);

  const yaLead = await pb.collection('lead').getFullList({
    filter: `perfil = "${perfil.id}" && cuenta = "${cid}"`,
  });
  const ultima = p.reuniones.map((r) => r.inicio).sort().at(-1);
  const datosLead = {
    perfil: perfil.id, cuenta: cid,
    // Llegaron a reunion: contestaron, asi que salen de la cadencia automatica.
    situacion: 'contesto',
    etapa: 'R1',
    email: p.email,
    lista: 'Recuperado de Google Calendar',
    nota: `Recuperado del histórico de Calendar. ID en la base vieja: ${p.pb_id_viejo ?? 'sin PB_ID'}. ${p.reuniones.length} reunión(es), la última el ${String(ultima).slice(0, 10)}.`,
    f_respuesta: ultima,
    f_ultimo_contacto: ultima,
  };
  if (yaLead[0]) await pb.collection('lead').update(yaLead[0].id, datosLead);
  else { await pb.collection('lead').create(datosLead); resumen.leads++; }
  resumen.reuniones += p.reuniones.length;
}

console.log('\n' + '='.repeat(66));
console.log('Perfiles creados:', resumen.perfiles);
console.log('Cuentas creadas:', resumen.cuentas);
console.log('Leads creados:', resumen.leads);
console.log('Reuniones registradas en la nota:', resumen.reuniones);
console.log('='.repeat(66));
