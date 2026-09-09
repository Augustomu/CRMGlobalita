import { test } from 'node:test';
import assert from 'node:assert/strict';
import { personasAdentro, planDeSeparacion } from '../src/fusion.ts';

const leads = [
  { id: 'l1', perfil: 'p1', cuenta: 'c-al', cuenta_abrev: 'AL', email: 'jdeleonmx@yahoo.com.mx' },
  { id: 'l2', perfil: 'p1', cuenta: 'c-fr', cuenta_abrev: 'FR', email: 'larahjorge07@gmail.com' },
];

test('D02 · dos correos distintos en un perfil son dos personas', () => {
  assert.equal(personasAdentro(leads), 2);
});

test('D02 · el mismo correo en dos cuentas es una sola persona', () => {
  const mismo = leads.map((l) => ({ ...l, email: 'jorge@empresa.com' }));
  assert.equal(personasAdentro(mismo), 1);
});

test('D02 · los leads sin correo no cuentan como personas', () => {
  assert.equal(personasAdentro([{ id: 'l9', perfil: 'p1', cuenta: 'c', email: '' }]), 0);
  assert.equal(personasAdentro([{ id: 'l9', perfil: 'p1', cuenta: 'c' }]), 0);
});

test('§7.10 · el lead elegido se queda y el otro sale con el mismo nombre', () => {
  const p = planDeSeparacion('Jorge', leads, ['l2']);
  assert.deepEqual(p.quedan, ['l2']);
  assert.deepEqual(p.salen, [
    { lead: 'l1', nombre: 'Jorge', email: 'jdeleonmx@yahoo.com.mx' },
  ]);
  assert.equal(p.sinCambios, false);
});

test('§7.10 · no se inventa un nombre a partir del correo', () => {
  // El que sale sigue siendo un «Jorge»: otro, pero un Jorge. Sacar
  // «Jdeleonmx» del correo sería cambiar un dato malo por uno peor.
  assert.equal(planDeSeparacion('Jorge', leads, ['l2']).salen[0]!.nombre, 'Jorge');
});

test('§7.10 · si están todos elegidos no hay nada que separar', () => {
  const p = planDeSeparacion('Jorge', leads, ['l1', 'l2']);
  assert.equal(p.sinCambios, true);
  assert.deepEqual(p.quedan, ['l1', 'l2']);
});
