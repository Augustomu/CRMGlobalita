import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CADENCIA_POR_DEFECTO } from '../src/cadencia.ts';
import { etiquetaDeUltimoEnvio, planDeEnvio } from '../src/envio.ts';
import type { LeadCadencia } from '../src/tipos.ts';

const cfg = CADENCIA_POR_DEFECTO;
const HOY = '2026-09-07';

const leadBase: LeadCadencia = { etapa: 'R1', situacion: 'en_curso', tiene_telefono: true };

test('§5.10 · registrar un envío arma la fila del historial con todo lo medible', () => {
  const plan = planDeEnvio(cfg, leadBase, {
    lead_id: 'lead-1',
    paso: 'R1',
    canal: 'linkedin',
    idioma: 'pt',
    texto: 'Olá Lucia, tudo bem?',
    plantilla_id: 'p-r1-a',
    a_mano: true,
  }, HOY);

  assert.deepEqual(plan.envio, {
    lead: 'lead-1',
    paso: 'R1',
    enviado_en: HOY,
    canal: 'linkedin',
    plantilla: 'p-r1-a',
    idioma: 'pt',
    texto: 'Olá Lucia, tudo bem?',
    a_mano: true,
  });
});

test('§5.10 · se agrega la etiqueta Recordatorio (regla de fábrica)', () => {
  const plan = planDeEnvio(cfg, leadBase, {
    lead_id: 'lead-1', paso: 'R1', canal: 'linkedin', idioma: 'es', texto: 'x', a_mano: true,
  }, HOY);
  assert.deepEqual(plan.etiquetas_a_agregar, ['Recordatorio']);
});

test('§5.10 + D15 · enviar R4 agrega Fase 2 y propone 90 días', () => {
  const plan = planDeEnvio(cfg, { ...leadBase, etapa: 'R4' }, {
    lead_id: 'lead-1', paso: 'R4', canal: 'whatsapp', idioma: 'pt', texto: 'x', a_mano: true,
  }, HOY);
  assert.deepEqual(plan.etiquetas_a_agregar, ['Recordatorio', 'Fase 2']);
  assert.equal(plan.proximo_contacto_propuesto, '2026-12-06');
});

test('§5.10 · la próxima fecha se PROPONE: va aparte de lo que se aplica al lead', () => {
  const plan = planDeEnvio(cfg, leadBase, {
    lead_id: 'lead-1', paso: 'R1', canal: 'linkedin', idioma: 'es', texto: 'x', a_mano: true,
  }, HOY);
  assert.equal(plan.proximo_contacto_propuesto, '2026-09-22');
  // Lo que sí se aplica solo: el último contacto.
  assert.equal(plan.lead.f_ultimo_contacto, HOY);
  assert.ok(!('proximo_contacto' in plan.lead));
});

test('§5.1 · un lead que ya contestó no vuelve a la cadencia automática por registrar un envío', () => {
  const plan = planDeEnvio(cfg, { ...leadBase, situacion: 'contesto' }, {
    lead_id: 'lead-1', paso: 'R2', canal: 'linkedin', idioma: 'es', texto: 'x', a_mano: true,
  }, HOY);
  assert.equal(plan.lead.situacion, 'contesto');
});

test('§5.1 · registrar R8 deja el lead agotado y sin próximo contacto', () => {
  const plan = planDeEnvio(cfg, { ...leadBase, etapa: 'R8' }, {
    lead_id: 'lead-1', paso: 'R8', canal: 'whatsapp', idioma: 'pt', texto: 'x', a_mano: true,
  }, HOY);
  assert.equal(plan.lead.situacion, 'agotado');
  assert.equal(plan.proximo_contacto_propuesto, null);
});

test('§5.11 · el agradecimiento no mueve la cadencia ni propone fecha', () => {
  const plan = planDeEnvio(cfg, { ...leadBase, situacion: 'contesto' }, {
    lead_id: 'lead-1', paso: 'agradecimiento', canal: 'whatsapp', idioma: 'es', texto: 'Gracias!', a_mano: true,
  }, HOY);
  assert.deepEqual(plan.etiquetas_a_agregar, []);
  assert.equal(plan.proximo_contacto_propuesto, null);
  assert.equal(plan.lead.situacion, 'contesto');
  assert.equal(plan.lead.f_ultimo_contacto, HOY);
});

test('un texto escrito a mano queda sin plantilla, y eso es un dato válido', () => {
  const plan = planDeEnvio(cfg, leadBase, {
    lead_id: 'lead-1', paso: 'R1', canal: 'linkedin', idioma: 'es', texto: 'escrito a mano', a_mano: true,
  }, HOY);
  assert.equal(plan.envio.plantilla, '');
});

test('§7.2 · el último mensaje se muestra como su R, o FU si fue suelto', () => {
  assert.equal(etiquetaDeUltimoEnvio('R3'), 'R3');
  assert.equal(etiquetaDeUltimoEnvio('R0'), 'R0');
  // El sufijo no entra en la fila; el detalle está en la ficha.
  assert.equal(etiquetaDeUltimoEnvio('R0-recontacto'), 'R0');
  assert.equal(etiquetaDeUltimoEnvio('agradecimiento'), 'FU');
  assert.equal(etiquetaDeUltimoEnvio(''), 'FU');
  assert.equal(etiquetaDeUltimoEnvio(null), 'FU');
});
