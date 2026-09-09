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

const resumen = { perfiles: 0, leads: 0, cuentas: 0, reuniones: 0, saltados: 0, ambiguos: 0 };

/** La zona del sistema viejo. Sin esto la fecha se lee corrida (D23). */
const ZONA = 'America/Argentina/Buenos_Aires';
const AHORA = new Date().toISOString().replace('T', ' ');

/**
 * Los `google_event_id` que ya estan en la base.
 *
 * Se bajan de una y se comparan en memoria: preguntar por cada una de las 288
 * seria 288 consultas para no hacer nada la segunda vez que uno corre esto.
 */
const yaImportadas = new Set();
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
    // El unico 'no' que consta. Los otros 181 son 'needsAction' o vacio.
    rechazo: ev.respuesta === 'declined',
  });
}

// Un mismo perfil puede tener varias reuniones (reagendadas): se agrupan.
const porPersona = new Map();
for (const p of plan) {
  const clave = p.slug || p.urn || p.email || huella(p.nombre_completo, '');
  if (!porPersona.has(clave)) porPersona.set(clave, { ...p, reuniones: [] });
  porPersona.get(clave).reuniones.push({ inicio: p.reunion, event_id: p.event_id, asistio: p.asistio, rechazo: p.rechazo });
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

/*
 * Lo que ya se importó antes, para no duplicarlo.
 *
 * Va DESPUÉS de entrar: estaba antes, usando `pb` cuando todavía no existía.
 * El ReferenceError caía en el catch de al lado, el set quedaba vacío, y la
 * segunda corrida intentaba crear las 288 reuniones de nuevo — chocando contra
 * el índice único de `google_event_id`. Un catch que se traga un error de
 * programación lo convierte en un bug silencioso.
 */
if (APLICAR) {
  const previas = await pb.collection('reunion').getFullList({ fields: 'google_event_id' });
  for (const r of previas) if (r.google_event_id) yaImportadas.add(r.google_event_id);
  if (yaImportadas.size) console.log('Reuniones ya importadas antes:', yaImportadas.size);
}

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
    const arreglos = {};
    if (porAbrev[0].nombre_perfil !== nombre) arreglos.nombre_perfil = nombre;
    if (!porAbrev[0].linea_negocio) {
      arreglos.linea_negocio = /alberto/i.test(nombre) ? 'inversiones' : 'ia';
    }
    if (Object.keys(arreglos).length) {
      await pb.collection('cuenta').update(porAbrev[0].id, arreglos);
    }
    cacheCuentas.set(nombre, porAbrev[0].id);
    return porAbrev[0].id;
  }

  const todas = await pb.collection('cuenta').getFullList();
  const slot = Math.max(0, ...todas.map((c) => c.slot ?? 0)) + 1;
  // La linea de negocio no es opcional: una cuenta sin linea deja sus proyectos
  // invisibles para cualquier observador limitado a un negocio. Alberto es
  // inversiones (SENG); el resto, IA (Globalita).
  const linea_negocio = /alberto/i.test(nombre) ? 'inversiones' : 'ia';

  const r = await pb.collection('cuenta').create({
    abrev, nombre_perfil: nombre, slot, linea_negocio,
    estado_sesion: 'sin_vincular', sesion_wa: 'sin_vincular',
    cupo_diario: 40, objetivo_semanal: 200,
  });
  resumen.cuentas++;
  cacheCuentas.set(nombre, r.id);
  return r.id;
}

for (const p of porPersona.values()) {
  /*
   * Buscar antes de crear, en el orden de D02.
   *
   * Los dos primeros son identificadores: si coinciden, es la misma persona y
   * punto. El tercero, la huella (nombre normalizado), NO lo es — y por eso
   * sólo vale cuando devuelve UNO solo.
   *
   * Sin el paso de la huella este import no era repetible: 39 de los 298
   * eventos no traen link, así que sus personas no tienen ni slug ni urn, y
   * cada corrida les creaba un perfil nuevo. La primera vez que se corrió dos
   * veces aparecieron 75 duplicados.
   *
   * Cuando la huella devuelve varios no se elige ninguno: se crea uno marcado
   * `posible_duplicado_de`, que es lo que D02 pide — la fusión nunca es
   * automática, la aprueba una persona desde la bandeja de duplicados.
   */
  const laHuella = huella(p.nombre_completo, '');
  let perfil = null;
  let ambiguo = null;

  for (const [campo, valor] of [['slug', p.slug], ['urn', p.urn]]) {
    if (!valor) continue;
    const hit = await pb.collection('perfil').getFullList({ filter: `${campo} = "${valor}"` });
    if (hit[0]) { perfil = hit[0]; break; }
  }

  if (!perfil && laHuella) {
    const porHuella = await pb.collection('perfil').getFullList({ filter: `huella = "${laHuella}"` });
    if (porHuella.length === 1) {
      perfil = porHuella[0];
    } else if (porHuella.length > 1) {
      /*
       * Varios con el mismo nombre y sin link para desempatar.
       *
       * Antes de darlos por ambiguos hay que ver si alguno lo creó ESTE mismo
       * import en una corrida anterior: se reconoce porque tiene un lead con
       * `lista = 'Recuperado de Google Calendar'` en la misma cuenta. Sin este
       * paso, cada corrida sumaba 31 perfiles nuevos — la operación no era
       * repetible justo para la gente peor identificada.
       */
      if (p.cuenta) {
        const cid = await cuentaId(p.cuenta);
        for (const cand of porHuella) {
          const suyos = await pb.collection('lead').getFullList({
            filter: `perfil = "${cand.id}" && cuenta = "${cid}" && lista = "Recuperado de Google Calendar"`,
          });
          if (suyos.length) { perfil = cand; break; }
        }
      }
      if (!perfil) ambiguo = porHuella[0].id;
    }
  }

  const datos = {
    slug: p.slug, urn: p.urn,
    huella: laHuella,
    nombre: p.nombre_completo,
    ciudad: p.ciudad,
    telefono: p.telefono, telefono_raw: p.telefono, telefono_valido: false,
  };

  if (perfil) {
    // Sólo se completa lo que falta: si el perfil ya tiene ciudad o teléfono
    // cargados a mano, un import no tiene por qué pisarlos con vacío.
    const arreglos = {};
    for (const [k, v] of Object.entries(datos)) {
      if (v && !perfil[k]) arreglos[k] = v;
    }
    if (Object.keys(arreglos).length) await pb.collection('perfil').update(perfil.id, arreglos);
  } else {
    if (ambiguo) {
      datos.posible_duplicado_de = ambiguo;
      resumen.ambiguos++;
    }
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
  let leadId;
  if (yaLead[0]) {
    await pb.collection('lead').update(yaLead[0].id, datosLead);
    leadId = yaLead[0].id;
  } else {
    const creado = await pb.collection('lead').create(datosLead);
    leadId = creado.id;
    resumen.leads++;
  }

  // Las reuniones, como REGISTROS y no solo como texto en la nota.
  //
  // Antes se contaban en la nota y nada mas. El dato entraba, pero el dashboard
  // de Control (§7.11.2) no lo veia: sus ocho tarjetas, el grafico por mes y
  // los agrupadores leen la coleccion `reunion`. Con 288 reuniones reales
  // adentro de una nota, el tablero seguia mostrando las de demo.
  //
  // `google_event_id` es lo que hace esto repetible: es el id del evento en
  // Calendar, asi que reimportar reconoce lo que ya esta en vez de duplicarlo
  // (es el mismo motivo de D10).
  for (const r of p.reuniones) {
    if (!r.inicio) continue;
    if (r.event_id && yaImportadas.has(r.event_id)) continue;

    // Pasada o futura. Lo que no se puede es marcar "asistio" algo que todavia
    // no ocurrio: inflaria la conversion con reuniones que no pasaron, que es
    // justo lo que §7.11.2 dice que no hay que hacer.
    const paso = String(r.inicio) < AHORA;
    await pb.collection('reunion').create({
      lead: leadId,
      inicio: r.inicio,
      zona: ZONA,
      duracion_min: 30,
      // Solo se afirma lo que consta en Calendar. `needsAction` es "el
      // invitado nunca toco el boton", no "no vino": mucha gente va a
      // reuniones sin aceptar nunca el evento. Marcar esas como no-asistio
      // inventaba 181 ausencias y dejaba el tablero diciendo 41% de
      // asistencia sobre algo que nadie midio.
      estado: !paso ? 'pendiente' : r.asistio ? 'asistio' : r.rechazo ? 'no-asistio' : 'sin_dato',
      google_event_id: r.event_id ?? '',
      sync: 'omitida',
      sync_detalle: 'recuperada del historico de Calendar',
      notas: r.asistio || r.rechazo ? '' : 'No consta si asistió: el invitado nunca respondió la invitación de Calendar.',
    });
    if (r.event_id) yaImportadas.add(r.event_id);
    resumen.reuniones++;
  }
}

console.log('\n' + '='.repeat(66));
console.log('Perfiles creados:', resumen.perfiles);
console.log('Cuentas creadas:', resumen.cuentas);
console.log('Leads creados:', resumen.leads);
console.log('Reuniones creadas:', resumen.reuniones);
if (resumen.ambiguos) {
  console.log(
    `Marcados como posible duplicado: ${resumen.ambiguos}` +
      '  (mismo nombre que otro perfil, sin link para desempatar — se revisan a mano)',
  );
}
console.log('='.repeat(66));
