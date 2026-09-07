import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  decidirAlta, extraerUrn, huella, identidad, normalizarSlug, normalizarTexto,
} from '../src/dedupe.ts';

test('D02 · el slug sale igual de cualquier forma de URL pública', () => {
  const esperado = 'wellington-abner-simoes-4a2b91';
  assert.equal(normalizarSlug('https://www.linkedin.com/in/wellington-abner-simoes-4a2b91/'), esperado);
  assert.equal(normalizarSlug('linkedin.com/in/Wellington-Abner-Simoes-4a2b91'), esperado);
  assert.equal(normalizarSlug('https://linkedin.com/in/wellington-abner-simoes-4a2b91?utm_source=share'), esperado);
  assert.equal(normalizarSlug('https://www.linkedin.com/in/wellington-abner-simoes-4a2b91#about'), esperado);
});

test('D02 · una URL de Sales Navigator no tiene slug público, tiene urn', () => {
  const url = 'https://www.linkedin.com/sales/lead/ACwAAAB7x2sBb,NAME_SEARCH,dR4p';
  assert.equal(normalizarSlug(url), '');
  assert.equal(extraerUrn(url), 'ACwAAAB7x2sBb');
});

test('la huella ignora acentos, mayúsculas y puntuación', () => {
  assert.equal(normalizarTexto('João Sílva'), 'joao silva');
  assert.equal(huella('João Sílva', 'Vale S.A.'), 'joaosilva|valesa');
});

test('D02 · las variantes de sufijo de empresa dan la misma huella', () => {
  // "Vale S.A." y "Vale SA" son la misma empresa en dos CSV distintos.
  assert.equal(huella('Joao Silva', 'Vale S.A.'), huella('JOAO SILVA', 'Vale SA'));
  assert.equal(huella('Herik Pires', 'Braskem Ltda.'), huella('herik pires', 'BRASKEM LTDA'));
});

test('D02 · personas distintas de la misma empresa no colisionan', () => {
  assert.notEqual(huella('Joao Silva', 'Vale'), huella('Maria Silva', 'Vale'));
});

test('sin nombre no hay huella: no se sugiere nada', () => {
  assert.equal(huella('', 'Vale'), '');
});

const conocidos = [
  { id: 'p1', slug: 'wellington-abner-simoes-4a2b91', urn: '', huella: 'wellingtonabnersimoes|globaltec' },
  { id: 'p2', slug: '', urn: 'ACwAAAB7x2sBb', huella: 'herikpires|braskem' },
];

test('D02 · coincide por slug: es el mismo perfil', () => {
  const r = decidirAlta(identidad({ url: 'https://linkedin.com/in/wellington-abner-simoes-4a2b91/', nombre: 'Wellington Abner Simoes' }), conocidos);
  assert.equal(r.accion, 'mismo');
  assert.equal(r.accion === 'mismo' && r.perfil_id, 'p1');
});

test('D02 · el CSV completa el slug que le faltaba al perfil de Sales Navigator', () => {
  // p2 entró por Sales Navigator (solo urn). Ahora llega el mismo por CSV, con slug.
  const entrante = identidad({
    url: 'https://www.linkedin.com/in/herik-pires-77c1/',
    url_sales: 'https://www.linkedin.com/sales/lead/ACwAAAB7x2sBb,NAME_SEARCH,x1',
    nombre: 'Herik Pires',
    empresa: 'Braskem',
  });
  const r = decidirAlta(entrante, conocidos);
  assert.equal(r.accion, 'mismo');
  assert.equal(r.accion === 'mismo' && r.perfil_id, 'p2');
  assert.deepEqual(r.accion === 'mismo' && r.completar, { slug: 'herik-pires-77c1' });
});

test('D02 · misma huella sin link: entra igual, marcado como posible duplicado', () => {
  const r = decidirAlta(identidad({ nombre: 'Wellington Abner Simoes', empresa: 'GlobalTec' }), conocidos);
  assert.equal(r.accion, 'nuevo_posible_duplicado');
  assert.deepEqual(r.accion === 'nuevo_posible_duplicado' && r.candidatos, ['p1']);
});

test('D02 · nada coincide: perfil nuevo', () => {
  const r = decidirAlta(identidad({ url: 'https://linkedin.com/in/otra-persona-9z/', nombre: 'Otra Persona', empresa: 'Acme' }), conocidos);
  assert.equal(r.accion, 'nuevo');
});

