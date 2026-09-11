import test from 'node:test';
import assert from 'node:assert/strict';
import {
  colaDelTelefono,
  indiceDeLaAgenda,
  nombresQueFaltan,
  type ContactoDeAgenda,
} from '../src/agenda.ts';

// §5.7 · La agenda de Google, cruzada con lo que ya está en el CRM.
//
// Augusto, 11/09, mirando 58 chats de WhatsApp recién importados: «todos los
// teléfonos están sin ser agendados». Los nombres existen — en su cuenta de
// Google. Esto es lo que decide cuál va a cuál.

// ------------------------------------------------------- cómo se compara

test('§5.7 · el mismo número escrito de cinco formas da la misma cola', () => {
  // Es el caso real: así llega de la agenda, del JID de WhatsApp, y tipeado.
  const formas = ['+52 1 55 2303 6183', '5215523036183', '521 5523036183', '52-1-5523036183', '(521) 5523036183'];
  const colas = new Set(formas.map(colaDelTelefono));
  assert.equal(colas.size, 1, 'las cinco formas tienen que dar lo mismo');
  assert.equal([...colas][0], '23036183');
});

test('§5.7 · un número corto no identifica a nadie y se descarta', () => {
  // Hacer coincidir dos números de seis dígitos es peor que no hacer nada.
  assert.equal(colaDelTelefono('123456'), '');
  assert.equal(colaDelTelefono(''), '');
  assert.equal(colaDelTelefono(null), '');
  assert.equal(colaDelTelefono('no es un teléfono'), '');
});

// ------------------------------------------------------- el índice

const AGENDA: ContactoDeAgenda[] = [
  { nombre: 'Danilo Protendit', telefonos: ['+55 11 98765-4321'] },
  { nombre: 'Ivo Unzaga', telefonos: ['+54 9 11 3333-4444', '011 3333-4444'] },
];

test('§5.7 · un contacto con dos formas del mismo número entra una vez', () => {
  const i = indiceDeLaAgenda(AGENDA);
  assert.equal(i.get('33334444'), 'Ivo Unzaga');
  assert.equal(i.get('87654321'), 'Danilo Protendit');
});

test('§5.7 · UN NUMERO COMPARTIDO POR DOS PERSONAS SE DESCARTA', () => {
  // Pasa de verdad: el telefono de la empresa guardado en la ficha de tres
  // personas. Elegir uno seria ponerle a un chat el nombre de otro — y un
  // nombre equivocado NO SE NOTA, mientras que un numero se reconoce.
  const i = indiceDeLaAgenda([
    { nombre: 'Recepción', telefonos: ['+54 11 5555-0000'] },
    { nombre: 'Marcela', telefonos: ['+54 11 5555-0000'] },
  ]);
  assert.equal(i.has('55550000'), false, 'ambiguo: no se elige ninguno');
});

test('§5.7 · el mismo contacto cargado dos veces no es un conflicto', () => {
  const i = indiceDeLaAgenda([
    { nombre: 'Ivo Unzaga', telefonos: ['+54 9 11 3333-4444'] },
    { nombre: 'Ivo Unzaga', telefonos: ['011 3333-4444'] },
  ]);
  assert.equal(i.get('33334444'), 'Ivo Unzaga');
});

test('§5.7 · un contacto sin nombre no aporta nada', () => {
  const i = indiceDeLaAgenda([{ nombre: '   ', telefonos: ['+54 9 11 3333-4444'] }]);
  assert.equal(i.size, 0);
});

// ------------------------------------------------------- qué se escribe

test('§5.7 · se completa el que no tiene nombre', () => {
  const i = indiceDeLaAgenda(AGENDA);
  const r = nombresQueFaltan([{ id: 'a', telefono: '5511987654321', nombre: '' }], i);
  assert.deepEqual(r, [{ id: 'a', nombre: 'Danilo Protendit' }]);
});

test('§5.7 · NO SE PISA UN NOMBRE QUE YA ESTA', () => {
  // Puede haberlo puesto una persona —«Juan Pérez - Logística»— y la agenda no
  // tiene por qué saber más que ella.
  const i = indiceDeLaAgenda(AGENDA);
  const r = nombresQueFaltan(
    [{ id: 'a', telefono: '5511987654321', nombre: 'Danilo - proveedor SP' }],
    i,
  );
  assert.deepEqual(r, []);
});

test('§5.7 · un teléfono que no está en la agenda se queda como está', () => {
  const i = indiceDeLaAgenda(AGENDA);
  assert.deepEqual(nombresQueFaltan([{ id: 'a', telefono: '5491100000000' }], i), []);
});

test('§5.7 · una fila sin teléfono no recibe nombre de nadie', () => {
  // Los chats que vienen con un LID no tienen número. Sin número no hay con
  // qué cruzar, y adivinar por nombre es justamente lo que no se hace.
  const i = indiceDeLaAgenda(AGENDA);
  assert.deepEqual(nombresQueFaltan([{ id: 'a', telefono: '' }], i), []);
});

test('§5.7 · una agenda vacía no produce ninguna escritura', () => {
  const r = nombresQueFaltan([{ id: 'a', telefono: '5511987654321' }], indiceDeLaAgenda([]));
  assert.deepEqual(r, []);
});
