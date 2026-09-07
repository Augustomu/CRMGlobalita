import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CADENCIA_POR_DEFECTO, alEnviar, alResponder, canalDe, empujaAFase2, esFase2,
  esperaDespuesDe, siguientePaso, sumarDias, tocaHoy,
} from '../src/cadencia.ts';
import type { ConfigCadencia } from '../src/tipos.ts';

const cfg = CADENCIA_POR_DEFECTO;
const clonar = (): ConfigCadencia => structuredClone(cfg);

test('§5.1 · las esperas por defecto son las de la tabla del manual', () => {
  assert.equal(esperaDespuesDe(cfg, 'R1'), 15);
  assert.equal(esperaDespuesDe(cfg, 'R2'), 15);
  assert.equal(esperaDespuesDe(cfg, 'R3'), 21);
  assert.equal(esperaDespuesDe(cfg, 'R5'), 15);
  assert.equal(esperaDespuesDe(cfg, 'R7'), 21);
  assert.equal(esperaDespuesDe(cfg, 'R8'), 28);
});

test('D15 · después de R4 son 90 días, no 28: los 90 reemplazan', () => {
  assert.equal(empujaAFase2(cfg, 'R4'), true);
  assert.equal(esperaDespuesDe(cfg, 'R4'), 90);

  const r = alEnviar(cfg, { etapa: 'R4', situacion: 'en_curso', tiene_telefono: true }, '2026-09-04');
  assert.equal(r.proximo_contacto_propuesto, '2026-12-03');
  assert.deepEqual(r.etiquetas_a_agregar, ['Recordatorio', 'Fase 2']);
});

test('D15 · con Fase 2 apagada, R4 vuelve a usar su espera de 28', () => {
  const c = clonar();
  c.fase2_activa = false;
  assert.equal(esperaDespuesDe(c, 'R4'), 28);
  const r = alEnviar(c, { etapa: 'R4', situacion: 'en_curso', tiene_telefono: false }, '2026-09-04');
  assert.equal(r.proximo_contacto_propuesto, '2026-10-02');
  assert.deepEqual(r.etiquetas_a_agregar, ['Recordatorio']);
});

test('§5.1 · la espera se cuenta desde el envío, no desde la respuesta', () => {
  const r = alEnviar(cfg, { etapa: 'R1', situacion: 'en_curso', tiene_telefono: false }, '2026-09-04');
  assert.equal(r.proximo_contacto_propuesto, '2026-09-19');
});

test('§5.1 · después de R8 la cadencia termina y el lead queda agotado', () => {
  assert.equal(siguientePaso(cfg, 'R8'), undefined);
  const r = alEnviar(cfg, { etapa: 'R8', situacion: 'en_curso', tiene_telefono: true }, '2026-09-04');
  assert.equal(r.proximo_contacto_propuesto, null);
  assert.equal(r.situacion, 'agotado');
});

test('§5.1 · un paso pausado se saltea y el lead sigue al siguiente activo', () => {
  const c = clonar();
  c.pasos.find((p) => p.paso === 'R2')!.activo = false;
  assert.equal(siguientePaso(c, 'R1'), 'R3');
});

test('§5.1 · R4 y R8 salen por WhatsApp solo si hay teléfono', () => {
  assert.equal(canalDe(cfg, 'R4', true), 'whatsapp');
  assert.equal(canalDe(cfg, 'R4', false), 'linkedin');
  assert.equal(canalDe(cfg, 'R8', true), 'whatsapp');
  assert.equal(canalDe(cfg, 'R3', true), 'linkedin');
});

test('D04 · Fase 2 no es un estado: es estar en R5–R8', () => {
  assert.equal(esFase2('R4'), false);
  assert.equal(esFase2('R5'), true);
  assert.equal(esFase2('R8'), true);
});

test('D24 · el recontacto vuelve a entrar por R1', () => {
  assert.equal(siguientePaso(cfg, 'R0-recontacto'), 'R1');
});

test('D17 · solo le toca hoy a los en_curso con la fecha cumplida', () => {
  const hoy = '2026-09-04';
  assert.equal(tocaHoy({ situacion: 'en_curso', proximo_contacto: '2026-09-04' }, hoy), true);
  assert.equal(tocaHoy({ situacion: 'en_curso', proximo_contacto: '2026-08-20' }, hoy), true);
  assert.equal(tocaHoy({ situacion: 'en_curso', proximo_contacto: '2026-09-05' }, hoy), false);
  // Los otros cinco estados nunca disparan, sin importar la fecha.
  for (const s of ['contesto', 'pausado', 'agotado', 'esperando_recontacto', 'descartado'] as const) {
    assert.equal(tocaHoy({ situacion: s, proximo_contacto: '2026-01-01' }, hoy), false, s);
  }
});

test('§5.1 · el lead que responde sale de la cadencia automática', () => {
  assert.equal(alResponder('en_curso'), 'contesto');
  // Un descartado que escribe no vuelve a entrar solo.
  assert.equal(alResponder('descartado'), 'descartado');
});

test('sumarDias no se corre por husos horarios ni por cambios de mes', () => {
  assert.equal(sumarDias('2026-09-04', 15), '2026-09-19');
  assert.equal(sumarDias('2026-12-31', 1), '2027-01-01');
  assert.equal(sumarDias('2028-02-28', 1), '2028-02-29');
});

