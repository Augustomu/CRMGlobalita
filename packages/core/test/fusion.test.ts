import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planDeFusion, planDeLeads, type PerfilFusionable } from '../src/fusion.ts';

const base = (p: Partial<PerfilFusionable>): PerfilFusionable => ({
  id: 'x', created: '2026-01-01', slug: '', urn: '', huella: '', nombre: '',
  cargo: '', empresa: '', web: '', industria: '', pais: '', ciudad: '',
  resumen: '', telefono: '', telefono_raw: '', telefono_valido: false,
  no_contactar: false,
  ...p,
});

test('D02 · el cruce Calendar + WhatsApp se completa solo', () => {
  // Uno trae el LinkedIn, el otro el teléfono. Es el caso que motivó todo.
  const plan = planDeFusion([
    base({ id: 'cal', created: '2026-01-01', slug: 'emilia-namburete-56ba451b1', nombre: 'Emilia' }),
    base({
      id: 'wa', created: '2026-02-01', nombre: 'Emilia Paulino', cargo: 'Gerente',
      pais: 'Mozambique', telefono: '2588474xxxxx', telefono_valido: true,
    }),
  ]);

  assert.equal(plan.sobrevive, 'cal');
  assert.deepEqual(plan.absorbidos, ['wa']);
  assert.equal(plan.resultado.slug, 'emilia-namburete-56ba451b1');
  assert.equal(plan.resultado.telefono, '2588474xxxxx');
  assert.equal(plan.resultado.telefono_valido, true);
  assert.equal(plan.resultado.cargo, 'Gerente');
  assert.equal(plan.resultado.pais, 'Mozambique');
});

test('sobrevive el más viejo: es el que tiene la historia colgada', () => {
  const plan = planDeFusion([
    base({ id: 'nuevo', created: '2026-06-01', nombre: 'B' }),
    base({ id: 'viejo', created: '2025-01-01', nombre: 'A' }),
  ]);
  assert.equal(plan.sobrevive, 'viejo');
});

test('los desacuerdos reales se reportan, no se ocultan', () => {
  const plan = planDeFusion([
    base({ id: 'a', created: '2026-01-01', nombre: 'Thiago Gomes', pais: 'Brasil' }),
    base({ id: 'b', created: '2026-02-01', nombre: 'Tiago Gomes', pais: 'Brasil' }),
  ]);
  const nombres = plan.conflictos.find((c) => c.campo === 'nombre');
  assert.ok(nombres, 'el nombre difiere y tiene que aparecer como conflicto');
  assert.equal(nombres!.valores.length, 2);
  // El país coincide, así que no es conflicto.
  assert.equal(plan.conflictos.find((c) => c.campo === 'pais'), undefined);
});

test('un campo vacío no genera conflicto: se completa y listo', () => {
  const plan = planDeFusion([
    base({ id: 'a', created: '2026-01-01', nombre: 'Ana', empresa: '' }),
    base({ id: 'b', created: '2026-02-01', nombre: 'Ana', empresa: 'Vale' }),
  ]);
  assert.equal(plan.resultado.empresa, 'Vale');
  assert.equal(plan.conflictos.find((c) => c.campo === 'empresa'), undefined);
});

test('no_contactar es pegajoso: si uno lo tiene, el fusionado lo tiene', () => {
  // Perder un pedido de no contacto al fusionar sería grave (D33).
  const plan = planDeFusion([
    base({ id: 'a', created: '2026-01-01', nombre: 'Ana', no_contactar: false }),
    base({ id: 'b', created: '2026-02-01', nombre: 'Ana', no_contactar: true }),
  ]);
  assert.equal(plan.resultado.no_contactar, true);
});

test('el teléfono no queda "válido" si el que gana no lo estaba', () => {
  const plan = planDeFusion([
    base({ id: 'a', created: '2026-01-01', nombre: 'Ana', telefono: '123', telefono_valido: false }),
    base({ id: 'b', created: '2026-02-01', nombre: 'Ana', telefono: '5511999999999', telefono_valido: true }),
  ]);
  // Gana el del más viejo, que no estaba validado.
  assert.equal(plan.resultado.telefono, '123');
  assert.equal(plan.resultado.telefono_valido, false);
});

test('el perfil fusionado deja de estar marcado como duplicado', () => {
  const plan = planDeFusion([
    base({ id: 'a', created: '2026-01-01', nombre: 'Ana' }),
    base({ id: 'b', created: '2026-02-01', nombre: 'Ana' }),
  ]);
  assert.deepEqual(plan.resultado.posible_duplicado_de, []);
});

test('fusionar uno solo no tiene sentido y falla', () => {
  assert.throws(() => planDeFusion([base({ id: 'a' })]));
});

test('los leads del absorbido pasan al sobreviviente', () => {
  const plan = planDeLeads('viejo', ['nuevo'], [
    { id: 'L1', perfil: 'viejo', cuenta: 'ALB' },
    { id: 'L2', perfil: 'nuevo', cuenta: 'DAV' },
  ]);
  assert.deepEqual(plan.mover, ['L2']);
  assert.deepEqual(plan.choques, []);
});

test('un perfil sin leads (el del CSV) no genera trabajo', () => {
  // Es el caso normal: el CSV importa perfiles, no relaciones.
  const plan = planDeLeads('cal', ['wa'], [{ id: 'L1', perfil: 'cal', cuenta: 'ALB' }]);
  assert.deepEqual(plan.mover, []);
  assert.deepEqual(plan.choques, []);
});

test('dos leads en la misma cuenta chocan y no se mueven solos', () => {
  // `lead` es único por (perfil, cuenta): moverlo daría error de base. Y aunque
  // no lo diera, son dos historias de envíos y elegir cuál se tira no le toca
  // al sistema.
  const plan = planDeLeads('viejo', ['nuevo'], [
    { id: 'L1', perfil: 'viejo', cuenta: 'ALB', cuenta_abrev: 'ALB' },
    { id: 'L2', perfil: 'nuevo', cuenta: 'ALB', cuenta_abrev: 'ALB' },
  ]);
  assert.deepEqual(plan.mover, []);
  assert.equal(plan.choques.length, 1);
  assert.deepEqual(plan.choques[0]!.leads, ['L1', 'L2']);
  assert.equal(plan.choques[0]!.cuenta_abrev, 'ALB');
});

test('dos absorbidos que chocan entre sí también se detectan', () => {
  const plan = planDeLeads('viejo', ['a', 'b'], [
    { id: 'LA', perfil: 'a', cuenta: 'DAV' },
    { id: 'LB', perfil: 'b', cuenta: 'DAV' },
  ]);
  assert.deepEqual(plan.mover, []);
  assert.deepEqual(plan.choques[0]!.leads, ['LA', 'LB']);
});

test('el nombre gana el que dice más, no el más viejo', () => {
  // El Calendar guarda "Marcelo"; el CSV, "Marcelo Carneiro". Sin esta regla la
  // fusión perdía el apellido — justo el dato que había que recuperar.
  const plan = planDeFusion([
    base({ id: 'cal', created: '2026-01-01', nombre: 'Marcelo', slug: 'marcelomcarneiro' }),
    base({ id: 'csv', created: '2026-02-01', nombre: 'Marcelo Carneiro', telefono: '5531999xxxxx' }),
  ]);
  assert.equal(plan.sobrevive, 'cal');
  assert.equal(plan.resultado.nombre, 'Marcelo Carneiro');
  // Ampliar no es contradecir: no hay nada que mirar a mano.
  assert.equal(plan.conflictos.find((c) => c.campo === 'nombre'), undefined);
});

test('dos nombres que se contradicen siguen siendo conflicto', () => {
  const plan = planDeFusion([
    base({ id: 'a', created: '2026-01-01', nombre: 'Thiago Gomes' }),
    base({ id: 'b', created: '2026-02-01', nombre: 'Tiago Gomes' }),
  ]);
  assert.equal(plan.resultado.nombre, 'Thiago Gomes');
  assert.ok(plan.conflictos.find((c) => c.campo === 'nombre'));
});

test('los acentos y el orden no rompen la ampliación', () => {
  const plan = planDeFusion([
    base({ id: 'a', created: '2026-01-01', nombre: 'Nicolás' }),
    base({ id: 'b', created: '2026-02-01', nombre: 'NICOLAS VALENCIA GARCIA' }),
  ]);
  assert.equal(plan.resultado.nombre, 'NICOLAS VALENCIA GARCIA');
  assert.equal(plan.conflictos.find((c) => c.campo === 'nombre'), undefined);
});
