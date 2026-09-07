import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linkWhatsApp, normalizarTelefono, paraWhatsApp } from '../src/telefono.ts';

test('§5.7 · antepone el código del país cuando el número viene sin él', () => {
  assert.equal(normalizarTelefono('19 99887-7665', 'Brasil').valor, '5519998877665');
  assert.equal(normalizarTelefono('11 4321-5678', 'Argentina').valor, '541143215678');
});

test('D29 · si ya viene con el código puesto, no lo duplica', () => {
  assert.equal(normalizarTelefono('+55 19 99887-7665', 'Brasil').valor, '5519998877665');
  assert.equal(normalizarTelefono('5511987654321', 'Brasil').valor, '5511987654321');
});

test('D29 · saca el 0 de larga distancia', () => {
  assert.equal(normalizarTelefono('011 4321-5678', 'Argentina').valor, '541143215678');
});

test('D29 · Argentina: el 15 va después del código de área, se saca de ahí', () => {
  const r = normalizarTelefono('011 15-4321-5678', 'Argentina');
  assert.equal(r.valor, '541143215678');
  assert.equal(r.valido, true);
});

test('D29 · acepta nombre completo o ISO-2 para el país (§5.6)', () => {
  assert.equal(normalizarTelefono('11 4321-5678', 'AR').valor, '541143215678');
  assert.equal(normalizarTelefono('11 4321-5678', 'ar').valor, '541143215678');
});

test('D29 · sin número o con país desconocido queda marcado para revisar, no se pierde', () => {
  const sinNumero = normalizarTelefono('', 'Argentina');
  assert.equal(sinNumero.valido, false);
  assert.equal(sinNumero.raw, '');

  const paisRaro = normalizarTelefono('11 4321-5678', 'Marte');
  assert.equal(paisRaro.valido, false);
  assert.equal(paisRaro.raw, '11 4321-5678'); // el original nunca se pierde
});

test('D29 · un número demasiado corto queda marcado para revisar', () => {
  const r = normalizarTelefono('123', 'Argentina');
  assert.equal(r.valido, false);
  assert.equal(r.motivo, 'no da un número válido');
});

test('§5.7 · Argentina necesita el 9 después del 54 para que abra wa.me', () => {
  assert.equal(paraWhatsApp('541143215678'), '5491143215678');
  // Si ya lo trae, no lo duplica.
  assert.equal(paraWhatsApp('5491143215678'), '5491143215678');
});

test('§5.7 · Brasil: un celular en formato viejo (8 dígitos) recibe el 9° dígito', () => {
  // Código 55 + área 19 + 8 dígitos viejos (98877665, empieza en 9 -> rango móvil).
  assert.equal(paraWhatsApp('551998877665'), '5519998877665');
});

test('§5.7 · un fijo de Brasil (no empieza en 6-9) no se toca', () => {
  assert.equal(paraWhatsApp('551933221100'), '551933221100');
});

test('§5.7 · sin teléfono válido, no hay link de WhatsApp', () => {
  assert.equal(linkWhatsApp({ valor: '', valido: false }), undefined);
  assert.equal(linkWhatsApp({ valor: '541143215678', valido: false }), undefined);
});

test('§5.7 · con teléfono válido, el link usa wa.me y el formato para WhatsApp', () => {
  assert.equal(linkWhatsApp({ valor: '541143215678', valido: true }), 'https://wa.me/5491143215678');
});
