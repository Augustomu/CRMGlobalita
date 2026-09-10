import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  avisoDeDeteccion, DATOS_QUE_CONFIRMAN, decidirAlta, extraerUrn, huella, identidad,
  normalizarSlug, normalizarTexto, sinConQueConfirmar,
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


/* ---------------------------------------------------------------------------
 * Hasta dónde llega el detector (D02, §7.10)
 * ------------------------------------------------------------------------ */

test('D02 · un perfil sin ninguno de los cuatro datos es invisible para el detector', () => {
  assert.equal(sinConQueConfirmar({}), true);
  assert.equal(sinConQueConfirmar({ slug: '', urn: '', telefono: '', empresa: '' }), true);
  // Los espacios no son un dato: «  » no confirma nada.
  assert.equal(sinConQueConfirmar({ telefono: '   ' }), true);
  // Con cualquiera de los cuatro alcanza para que alguna de las tres reglas
  // del detector pueda llegar a ese perfil.
  for (const campo of DATOS_QUE_CONFIRMAN) {
    assert.equal(sinConQueConfirmar({ [campo]: 'algo' }), false, campo);
  }
});

test('D02 · la bandeja vacía dice que nadie marcó, no que no haya duplicados', () => {
  // Los números son los de la base del 10/09/2026.
  const a = avisoDeDeteccion({ vivos: 410, marcados: 0, invisibles: 60, ultima_marca: '' });
  assert.equal(a.titulo, 'Nadie marcó ningún perfil como posible duplicado');
  assert.equal(a.ciego, true);
  assert.match(a.detalle, /no busca por su cuenta/);
  assert.match(a.detalle, /410 perfiles vivos, 60 no tienen con qué confirmarse/);
  // Lo que NO puede decir nunca: que está limpio.
  assert.doesNotMatch(a.detalle, /limpi/i);
});

test('D02 · sin punto ciego no se inventa una advertencia', () => {
  const a = avisoDeDeteccion({ vivos: 12, marcados: 0, invisibles: 0, ultima_marca: '' });
  assert.equal(a.ciego, false);
  assert.doesNotMatch(a.detalle, /perfiles vivos/);
});

test('D02 · con marcas dice cuántas y hasta cuándo, en singular y en plural', () => {
  const uno = avisoDeDeteccion({
    vivos: 410, marcados: 1, invisibles: 60, ultima_marca: '2026-09-10 04:33:17.696Z',
  });
  assert.equal(uno.titulo, '1 perfil marcado, hasta el 10/09/26');

  const tres = avisoDeDeteccion({
    vivos: 410, marcados: 3, invisibles: 60, ultima_marca: '2026-09-10 04:33:17.696Z',
  });
  assert.equal(tres.titulo, '3 perfiles marcados, hasta el 10/09/26');
  assert.equal(tres.ciego, true);
});

test('D02 · sin fecha de marca no se inventa una', () => {
  const a = avisoDeDeteccion({ vivos: 410, marcados: 3, invisibles: 0, ultima_marca: '' });
  assert.equal(a.titulo, '3 perfiles marcados');
});
