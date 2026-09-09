import test from 'node:test';
import assert from 'node:assert/strict';
import { pasaElFiltro, siguienteEstado, tituloDelFiltro } from '../src/filtro.ts';

test('§7.2 · el ciclo es todos → con → sin → todos', () => {
  assert.equal(siguienteEstado('todos'), 'con');
  assert.equal(siguienteEstado('con'), 'sin');
  // Cierra: tres toques dejan la lista como estaba, sin tener que buscar cómo
  // apagar el filtro.
  assert.equal(siguienteEstado('sin'), 'todos');
});

test('§7.2 · «con» va antes que «sin»', () => {
  // Es lo que se busca nueve de cada diez veces: a quién le puedo escribir.
  // Excluirlos es el caso de limpieza de datos y va después.
  assert.equal(siguienteEstado('todos'), 'con');
});

test('§7.2 · «todos» deja pasar todo', () => {
  assert.equal(pasaElFiltro('todos', true), true);
  assert.equal(pasaElFiltro('todos', false), true);
});

test('§7.2 · «con» deja los que tienen, «sin» los que no', () => {
  assert.equal(pasaElFiltro('con', true), true);
  assert.equal(pasaElFiltro('con', false), false);
  assert.equal(pasaElFiltro('sin', true), false);
  assert.equal(pasaElFiltro('sin', false), true);
});

test('§7.2 · el título dice qué va a pasar en el próximo toque', () => {
  // Un botón que cambia de significado al tocarlo tiene que decir a dónde va,
  // o el segundo toque es una sorpresa.
  assert.ok(/tocá para ver los que no/.test(tituloDelFiltro('con', 'WhatsApp')));
  assert.ok(/tocá para quitar el filtro/.test(tituloDelFiltro('sin', 'WhatsApp')));
  assert.ok(/Filtrar por WhatsApp/.test(tituloDelFiltro('todos', 'WhatsApp')));
});
