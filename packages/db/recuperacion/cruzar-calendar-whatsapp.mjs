// Propone unir cada persona del Calendar con su contacto de WhatsApp.
//
//   node packages/db/recuperacion/cruzar-calendar-whatsapp.mjs            simulacro
//   node packages/db/recuperacion/cruzar-calendar-whatsapp.mjs --aplicar  marca
//
// El histórico dejó a cada persona partida en dos mitades que no se tocan:
//
//   del Calendar  →  email, link de LinkedIn, la cuenta de origen, las reuniones
//   del CSV       →  cargo, país, ciudad, TELÉFONO
//
// Hoy los 178 perfiles con lead no tienen ni un teléfono, y los 244 teléfonos
// están en perfiles que ninguna cuenta trabajó. Unirlos completa las dos
// mitades de una.
//
// NO FUSIONA NADA. Marca `posible_duplicado_de` para que se apruebe desde la
// bandeja del CRM, que es lo que pidió Augusto y lo que manda D02: dos personas
// pueden llamarse igual, y una fusión equivocada mezcla el historial de
// reuniones de alguien con el teléfono de otro.

import { cruzar, cuantosCandidatos, segurosParaLote } from '../../core/src/cruce.ts';
import { entrar } from './entrar.mjs';

const APLICAR = process.argv.includes('--aplicar');
const pb = await entrar();

const perfiles = await pb.collection('perfil').getFullList();
const leads = await pb.collection('lead').getFullList({ fields: 'perfil,lista' });

const conLead = new Set(leads.map((l) => l.perfil));

// Los dos lados. El criterio es un hecho, no una etiqueta: quien tiene lead
// vino del Calendar (es la única fuente que dice de qué cuenta salió); quien
// tiene teléfono y no tiene lead vino del CSV.
const delCalendar = perfiles.filter((p) => conLead.has(p.id));
const delCsv = perfiles.filter((p) => !conLead.has(p.id) && p.telefono);

console.log('='.repeat(70));
console.log(APLICAR ? 'MARCANDO' : 'SIMULACRO — nada se escribe. Usá --aplicar');
console.log('='.repeat(70));
console.log('\ndel Calendar (con lead):', delCalendar.length, '· con teléfono:', delCalendar.filter((p) => p.telefono).length);
console.log('del CSV (sin lead, con teléfono):', delCsv.length);

const candidatos = cruzar(
  delCalendar.map((p) => ({ id: p.id, nombre: p.nombre })),
  delCsv.map((p) => ({ id: p.id, nombre: p.nombre, pais: p.pais, cargo: p.cargo })),
);

const porId = new Map(perfiles.map((p) => [p.id, p]));
const cuantos = cuantosCandidatos(candidatos);
const lote = segurosParaLote(candidatos);
const idsLote = new Set(lote.map((c) => `${c.del_calendar}|${c.del_csv}`));

const porConfianza = {};
for (const c of candidatos) porConfianza[c.confianza] = (porConfianza[c.confianza] ?? 0) + 1;

console.log('\nCANDIDATOS:', candidatos.length);
for (const [k, v] of Object.entries(porConfianza).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(v).padStart(4)}  ${k}`);
}
console.log('\n  uno a uno y exactos (se pueden aprobar en lote):', lote.length);
console.log('  el resto, de a uno:', candidatos.length - lote.length);

const personas = new Set(candidatos.map((c) => c.del_calendar));
console.log('\n  personas del Calendar que ganarían teléfono:', personas.size, 'de', delCalendar.length);

console.log('\nMUESTRA');
for (const c of candidatos.slice(0, 14)) {
  const a = porId.get(c.del_calendar);
  const b = porId.get(c.del_csv);
  const solo = idsLote.has(`${c.del_calendar}|${c.del_csv}`) ? '  ✓ lote' : '';
  console.log(
    `  ${String(a?.nombre ?? '').slice(0, 26).padEnd(28)} ↔ ${String(b?.nombre ?? '').slice(0, 26).padEnd(28)} ${c.confianza.padEnd(7)}${solo}`,
  );
}

if (!APLICAR) {
  console.log('\nNada se escribió.');
  process.exit(0);
}

// ------------------------------------------------------------------ marcado
//
// Se SUMA a lo que ya tenga marcado, no se pisa: el detector de duplicados
// marca por teléfono y por email, y esas propuestas siguen siendo válidas.
let marcados = 0;
const nuevos = new Map();
for (const c of candidatos) {
  for (const [a, b] of [
    [c.del_calendar, c.del_csv],
    [c.del_csv, c.del_calendar],
  ]) {
    if (!nuevos.has(a)) nuevos.set(a, new Set(porId.get(a)?.posible_duplicado_de ?? []));
    nuevos.get(a).add(b);
  }
}

for (const [id, otros] of nuevos) {
  await pb.collection('perfil').update(id, { posible_duplicado_de: [...otros] });
  marcados++;
}

console.log('\n' + '='.repeat(70));
console.log('Perfiles marcados:', marcados);
console.log('Se aprueban desde la bandeja de duplicados del CRM (menú ··· → Duplicados).');
console.log('='.repeat(70));
