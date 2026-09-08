import test from 'node:test';
import assert from 'node:assert/strict';
import { coincide, sinAcentos } from '../src/busqueda.ts';

// §7.2 — «Buscador por nombre, empresa, teléfono, ciudad».
//
// La base es latinoamericana: si el buscador exige la tilde, hay que saber cómo
// está escrito el nombre antes de buscarlo.
test('buscar sin tildes encuentra lo que las tiene', () => {
  assert.equal(coincide(['Lucía Gonçalves'], 'Lucia'), true);
  assert.equal(coincide(['María de los Ángeles Fernández Villagrán'], 'Fernandez'), true);
  assert.equal(coincide(['Amílcar Sitoe'], 'amilcar'), true);
  // Y al revés: escribirla de más tampoco puede fallar.
  assert.equal(coincide(['Lucia Goncalves'], 'Lucía'), true);
});

test('busca en todos los campos que le den, no sólo en el nombre', () => {
  const fila = ['Wellington Abner Simões', 'Opus CM', 'São Paulo'];
  assert.equal(coincide(fila, 'opus'), true);
  assert.equal(coincide(fila, 'sao paulo'), true);
  assert.equal(coincide(fila, 'Curitiba'), false);
});

test('la consulta vacía no filtra nada', () => {
  assert.equal(coincide(['Herik Pires'], ''), true);
  assert.equal(coincide(['Herik Pires'], '   '), true);
  // Los campos vacíos no rompen ni generan coincidencias fantasma.
  assert.equal(coincide([null, undefined, ''], 'algo'), false);
});

test('sinAcentos deja el texto comparable', () => {
  assert.equal(sinAcentos('Gonçalves'), 'goncalves');
  assert.equal(sinAcentos('MARÍA'), 'maria');
  assert.equal(sinAcentos(null), '');
});
