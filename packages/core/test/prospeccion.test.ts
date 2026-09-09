import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  esProspeccion,
  porQueEsProspeccion,
  tieneFormaDeTitulo,
} from '../src/prospeccion.ts';

// ------------------------------------------ §7.6: señal 1, el link

test('un link de Sales Navigator alcanza', () => {
  assert.equal(
    esProspeccion({
      titulo: 'Café',
      descripcion: 'https://www.linkedin.com/sales/lead/ACwAAB123,NAME_SEARCH',
    }),
    true,
  );
});

test('un link de perfil normal también', () => {
  assert.equal(
    esProspeccion({ titulo: 'Café', descripcion: 'https://linkedin.com/in/marcelo-carneiro' }),
    true,
  );
});

test('nombrar LinkedIn en una nota NO es un link', () => {
  // «Le escribí por LinkedIn» no convierte un almuerzo en una reunión de
  // prospección: se busca el dominio, no la palabra.
  assert.equal(esProspeccion({ titulo: 'Almuerzo', descripcion: 'Le escribí por LinkedIn ayer' }), false);
});

// ------------------------------------------ §7.6: señal 2, el título

test('«Nombre / Cuenta / Augusto» es el título de siempre', () => {
  assert.equal(esProspeccion({ titulo: 'Marcelo Carneiro / Francisco / Augusto' }), true);
});

test('una sola barra no alcanza', () => {
  // «Almuerzo con Juan / martes» tiene una barra y no es una reunión.
  assert.equal(tieneFormaDeTitulo('Almuerzo con Juan / martes'), false);
  assert.equal(esProspeccion({ titulo: 'Almuerzo con Juan / martes' }), false);
});

test('las barras vacías no cuentan como partes', () => {
  assert.equal(tieneFormaDeTitulo('Reunión // '), false);
});

test('cuatro partes también valen', () => {
  // Alguna vez hubo dos personas de nuestro lado.
  assert.equal(tieneFormaDeTitulo('Jorge / Francisco / Bruno / Augusto'), true);
});

// ------------------------------------------ lo que queda afuera

test('el almuerzo, la clase y el cumpleaños quedan afuera', () => {
  for (const titulo of ['吃饭', 'Idiomas', 'Cumple de mamá', 'CGS Administrador']) {
    assert.equal(esProspeccion({ titulo }), false, titulo);
  }
});

test('sin título ni descripción, no', () => {
  assert.equal(esProspeccion({}), false);
  assert.equal(esProspeccion({ titulo: null, descripcion: null }), false);
});

// ------------------------------------------ por qué

test('dice cuál de las dos señales lo decidió', () => {
  // Sirve para explicarlo en pantalla: «entra por el link» o «entra por el
  // título» son dos motivos distintos, y uno de los dos puede estar mal puesto.
  assert.equal(
    porQueEsProspeccion({ descripcion: 'https://www.linkedin.com/in/x' }).senal,
    'link',
  );
  assert.equal(porQueEsProspeccion({ titulo: 'A / B / C' }).senal, 'titulo');
  assert.equal(porQueEsProspeccion({ titulo: 'Almuerzo' }).senal, 'ninguna');
});

test('el link gana sobre el título: es la señal más explícita', () => {
  const r = porQueEsProspeccion({
    titulo: 'A / B / C',
    descripcion: 'https://www.linkedin.com/in/x',
  });
  assert.equal(r.senal, 'link');
});
