// Convierte los volcados crudos de Google Calendar en `eventos-calendar.json`.
//
//   node packages/db/recuperacion/extraer-eventos.mjs carpeta/con/volcados
//
// Hay 15 calendarios y la mayoría de lo que tienen NO es prospección: reuniones
// internas, seguimientos de clientes, recurrentes de administración. Meter todo
// eso como leads ensuciaría el CRM más de lo que lo llenaría.
//
// Así que solo entra lo que tiene la huella del sistema viejo:
//
//   1. `LinkedIn:` o `PB_ID:` en la descripción — lo escribía el CRM anterior,
//      es identidad sin ambigüedad.
//   2. Título "Lead / Cuenta / Augusto" CON invitado externo — el patrón que
//      usaba el equipo, y el email confirma que hubo alguien de afuera.
//
// Lo demás se cuenta y se reporta, pero no se importa.

import fs from 'node:fs';
import path from 'node:path';

const CARPETA = process.argv[2];
if (!CARPETA) {
  console.error('Uso: node extraer-eventos.mjs CARPETA_CON_VOLCADOS');
  process.exit(1);
}

/** Los que están de los dos lados de la mesa: no son leads. */
const INTERNOS =
  /@globalita\.io$|^augustou|^unzi\.la12@|^augusto\.unzaga@|resource\.calendar\.google\.com$/i;

/** Las cuentas de prospección, por si el título las nombra. */
const CUENTAS = [
  'alberto', 'david', 'alejandro', 'edith', 'francisco', 'augusto',
  'daniel', 'ribalmar', 'thiago', 'sofia', 'maria',
];

function texto(e) {
  return `${e.summary ?? ''}\n${e.description ?? ''}`;
}

function linkedinDe(e) {
  const m = texto(e).match(/https?:\/\/[^\s<>"']*linkedin\.com\/[^\s<>"']+/i);
  return m ? m[0].replace(/[.,)]+$/, '') : '';
}

function pbIdDe(e) {
  const m = texto(e).match(/PB_ID:\s*([a-z0-9]{15})/i);
  return m ? m[1] : '';
}

function externosDe(e) {
  return (e.attendees ?? [])
    .map((a) => ({ email: String(a.email ?? ''), respuesta: a.responseStatus ?? '' }))
    .filter((a) => a.email && !INTERNOS.test(a.email));
}

/**
 * "Lead / Cuenta / Augusto", pero el orden no es fijo: aparece también como
 * "Alejandro - Augusto - Herik Brasil", con el lead al final. Se descartan las
 * partes que son nombres de cuentas y queda el resto.
 */
function leadYCuenta(summary) {
  const partes = String(summary)
    .split(/\s*[/|]\s*|\s+-\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (partes.length < 3) return null;

  const esCuenta = (p) => CUENTAS.includes(p.split(/\s+/)[0].toLowerCase());
  const cuentas = partes.filter(esCuenta);
  const resto = partes.filter((p) => !esCuenta(p));

  // Con las tres partes siendo cuentas no hay lead que sacar: es interna.
  if (!resto.length) return null;
  return { lead: resto[0], cuenta: cuentas.find((c) => !/^augusto/i.test(c)) ?? null };
}

// --------------------------------------------------------------- lectura
const archivos = fs
  .readdirSync(CARPETA)
  .filter((f) => f.endsWith('.txt') || f.endsWith('.json'))
  .map((f) => path.join(CARPETA, f));

const porId = new Map();
let leidos = 0;
for (const a of archivos) {
  let d;
  try {
    d = JSON.parse(fs.readFileSync(a, 'utf8'));
  } catch {
    continue;
  }
  for (const e of d.events ?? []) {
    leidos++;
    // El mismo evento aparece en el calendario del organizador y en el del
    // invitado: se queda uno solo.
    if (!porId.has(e.id)) porId.set(e.id, e);
  }
}

// ------------------------------------------------------------- clasificacion
const conHuella = [];
const conPatron = [];
const descartados = [];

for (const e of porId.values()) {
  const linkedin = linkedinDe(e);
  const pb_id = pbIdDe(e);
  const externos = externosDe(e);
  const inicio = e.start?.dateTime ?? e.start?.date ?? '';

  const base = {
    summary: e.summary ?? '',
    linkedin,
    pb_id,
    email: externos[0]?.email ?? '',
    inicio,
    event_id: e.id,
    respuesta: externos[0]?.respuesta ?? '',
  };

  if (linkedin || pb_id) {
    conHuella.push(base);
    continue;
  }

  const partido = leadYCuenta(e.summary ?? '');
  if (partido && externos.length) {
    conPatron.push({ ...base, lead_del_titulo: partido.lead, cuenta_del_titulo: partido.cuenta });
    continue;
  }

  descartados.push({ summary: e.summary ?? '', inicio, externos: externos.length });
}

// Lo que ya estaba recuperado no se pierde: el barrido anterior salio de una
// pasada distinta y puede tener eventos que estos volcados no traen.
const destino = path.join(import.meta.dirname, 'eventos-calendar.json');
const previos = fs.existsSync(destino) ? JSON.parse(fs.readFileSync(destino, 'utf8')) : [];
const porEvento = new Map(previos.map((e) => [e.event_id, e]));
let nuevos = 0;
for (const e of [...conHuella, ...conPatron]) {
  if (!porEvento.has(e.event_id)) nuevos++;
  porEvento.set(e.event_id, e);
}
const salida = [...porEvento.values()].sort((a, b) => a.inicio.localeCompare(b.inicio));

console.log('='.repeat(70));
console.log('archivos leídos:  ', archivos.length);
console.log('eventos crudos:   ', leidos, `(${porId.size} distintos)`);
console.log('='.repeat(70));
console.log('con huella del CRM viejo (LinkedIn / PB_ID):', conHuella.length);
console.log('con patrón de título + invitado externo:    ', conPatron.length);
console.log('descartados (no son prospección):          ', descartados.length);

const meses = {};
for (const e of salida) meses[e.inicio.slice(0, 7)] = (meses[e.inicio.slice(0, 7)] ?? 0) + 1;
console.log('\npor mes:', Object.entries(meses).sort().map(([k, v]) => `${k}:${v}`).join('  '));

fs.writeFileSync(destino, JSON.stringify(salida, null, 1));
console.log(
  '\nescrito:',
  destino,
  `(${salida.length} eventos: ${nuevos} nuevos sobre ${previos.length} que ya estaban)`,
);
console.log('Ahora: node packages/db/recuperacion/importar-calendar.mjs');
