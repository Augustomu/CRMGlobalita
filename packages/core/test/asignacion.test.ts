import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FILTRO_VACIO,
  TOPE_VISIBLE,
  coinciden,
  hayFiltros,
  opcionesDe,
  repartoPorCuenta,
  resumenDeLote,
  seleccionValida,
  todosLosQueCoinciden,
  type FiltroLote,
  type LeadAsignable,
} from '../src/asignacion.ts';

const lead = (x: Partial<LeadAsignable> & { id: string }): LeadAsignable => ({
  nombre: 'Nombre ' + x.id,
  empresa: 'Empresa',
  cargo: 'Jefe de Planta',
  ciudad: 'Rosario',
  pais: 'Argentina',
  industria: 'Metalurgia',
  cuenta: 'AL',
  asignado: 'u1',
  ...x,
});

const f = (x: Partial<FiltroLote> = {}): FiltroLote => ({ ...FILTRO_VACIO, ...x });

const base = [
  lead({ id: 'a' }),
  lead({ id: 'b', pais: 'Brasil', ciudad: 'Curitiba', cuenta: 'DL' }),
  lead({ id: 'c', industria: 'Textil', asignado: 'u2' }),
  lead({ id: 'd', nombre: 'Villagrán', empresa: 'Opus CM' }),
];

test('§7.8 · una lista de valores vacia significa TODOS, no ninguno', () => {
  // Es lo contrario de lo intuitivo al escribirlo y lo intuitivo al usarlo:
  // no elegir ningun pais es no filtrar por pais.
  assert.equal(coinciden(base, FILTRO_VACIO).length, 4);
  assert.equal(hayFiltros(FILTRO_VACIO), false);
});

test('los filtros se combinan y son por valor', () => {
  assert.deepEqual(coinciden(base, f({ pais: ['Brasil'] })).map((l) => l.id), ['b']);
  assert.deepEqual(coinciden(base, f({ cuenta: 'DL' })).map((l) => l.id), ['b']);
  assert.deepEqual(coinciden(base, f({ industria: ['Textil'] })).map((l) => l.id), ['c']);
  // Dos valores del mismo campo son un O.
  assert.equal(coinciden(base, f({ pais: ['Brasil', 'Argentina'] })).length, 4);
  // Dos campos distintos son un Y: no hay nadie de Brasil en Textil.
  assert.equal(coinciden(base, f({ pais: ['Brasil'], industria: ['Textil'] })).length, 0);
});

test('la busqueda mira nombre, empresa y cargo', () => {
  assert.deepEqual(coinciden(base, f({ busqueda: 'opus' })).map((l) => l.id), ['d']);
  assert.equal(coinciden(base, f({ busqueda: 'jefe de planta' })).length, 4);
});

test('«seleccionar todos» alcanza a TODOS los que coinciden, no a los visibles', () => {
  // Si marcara solo los 40 dibujados, el boton que dice "seleccionar los 380"
  // estaria asignando 40 y nadie se daria cuenta hasta contar los que
  // quedaron sin repartir.
  const muchos = Array.from({ length: TOPE_VISIBLE + 25 }, (_, i) => lead({ id: 'x' + i }));
  assert.equal(todosLosQueCoinciden(muchos, FILTRO_VACIO).length, TOPE_VISIBLE + 25);
});

test('cambiar el filtro limpia lo seleccionado que ya no coincide', () => {
  // Asignar lo que no esta en pantalla es asignar a ciegas.
  const seleccion = ['a', 'b', 'c'];
  assert.deepEqual(seleccionValida(seleccion, base, f({ pais: ['Brasil'] })), ['b']);
  assert.deepEqual(seleccionValida(seleccion, base, FILTRO_VACIO), ['a', 'b', 'c']);
});

test('las opciones salen de los datos, sin repetir y ordenadas', () => {
  assert.deepEqual(opcionesDe(base, 'pais'), ['Argentina', 'Brasil']);
  assert.deepEqual(opcionesDe(base, 'ciudad'), ['Curitiba', 'Rosario']);
  // Los vacios no son una opcion.
  assert.deepEqual(opcionesDe([lead({ id: 'z', pais: '  ' })], 'pais'), []);
});

test('el resumen cuenta cuantos de los que coinciden YA son suyos', () => {
  assert.equal(resumenDeLote(base, FILTRO_VACIO, 'u2', 'Sofía Ferrer'), '4 leads en la base · 1 ya es de Sofía');
  assert.equal(resumenDeLote(base, FILTRO_VACIO, 'u1', 'Alberto'), '4 leads en la base · 3 ya son de Alberto');
});

test('el reparto por cuenta ordena por cantidad', () => {
  // Importa porque nadie deberia quedar con los leads de una sola cuenta: si
  // esa sesion se cae, esa persona se queda sin trabajo.
  const leads = [
    lead({ id: '1', cuenta: 'AL' }),
    lead({ id: '2', cuenta: 'DL' }),
    lead({ id: '3', cuenta: 'DL' }),
    lead({ id: '4', cuenta: 'FR', asignado: 'otro' }),
  ];
  assert.deepEqual(repartoPorCuenta(leads, 'u1'), [
    { cuenta: 'DL', cuantos: 2 },
    { cuenta: 'AL', cuantos: 1 },
  ]);
});
