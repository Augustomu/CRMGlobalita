import test from 'node:test';
import assert from 'node:assert/strict';
import {
  colaDelTelefono,
  indiceDeLaAgenda,
  nombresQueFaltan,
  porQueFalloLaAgenda,
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

// §5.7 · Por qué falló la agenda, y qué hay que hacer.
//
// De dónde salieron estos mensajes: son los que contestó Google de verdad el
// 11/09, copiados del registro de PocketBase. El número de proyecto está
// cambiado a mano porque este repositorio es público.

test('§5.7 · un 403 de API apagada NO se lee como permiso faltante', () => {
  // ESTE ES EL CASO QUE COSTÓ TRES REPORTES. El hook decía «desconectala y
  // volvé a conectarla» y Augusto lo hizo, y los contactos seguían sin
  // aparecer, porque el interruptor está en otro lado.
  const real =
    'Error: HTTP 403 — People API has not been used in project 111122223333 before or it is ' +
    'disabled. Enable it by visiting ' +
    'https://console.developers.google.com/apis/api/people.googleapis.com/overview?project=111122223333 ' +
    'then retry. If you enabled this API recently, wait a few minutes for the action to propagate.';

  const r = porQueFalloLaAgenda(real);
  assert.equal(r.causa, 'api_apagada');
  // Y dice explícitamente que reconectar NO sirve: sin eso, «403» al lado de
  // una cuenta de Google lleva solo a volver a conectarla.
  assert.ok(/no se arregla desconectando/i.test(r.que_hacer));
});

test('§5.7 · y trae el enlace exacto, sin el punto de la oración pegado', () => {
  const real =
    'HTTP 403 — People API has not been used in project 111122223333 before or it is disabled. ' +
    'Enable it by visiting ' +
    'https://console.developers.google.com/apis/api/people.googleapis.com/overview?project=111122223333 ' +
    'then retry.';
  const r = porQueFalloLaAgenda(real);
  assert.equal(
    r.enlace,
    'https://console.developers.google.com/apis/api/people.googleapis.com/overview?project=111122223333',
  );
});

test('§5.7 · sin enlace en el texto, igual se dice a dónde ir', () => {
  // Google también contesta la forma corta, sin la URL. Mandar a «la consola de
  // Google Cloud» sin decir a qué pantalla es mandar a buscar.
  const r = porQueFalloLaAgenda('{"error":{"status":"PERMISSION_DENIED","reason":"SERVICE_DISABLED"}}');
  assert.equal(r.causa, 'api_apagada');
  assert.ok(r.enlace.startsWith('https://console.cloud.google.com/'));
});

test('§5.7 · el permiso que falta SÍ se arregla reconectando', () => {
  const r = porQueFalloLaAgenda('HTTP 403 — Request had insufficient authentication scopes.');
  assert.equal(r.causa, 'sin_permiso');
  assert.ok(/volvé a conectarla/i.test(r.que_hacer));
  assert.equal(r.enlace, '', 'no hay ninguna pantalla de Google a la que mandar');
});

test('§5.7 · el permiso revocado se distingue del que nunca estuvo', () => {
  // Los dos terminan en «volvé a conectarla», pero no son lo mismo y la causa
  // se usa para contar: si esto pasa seguido, algo está revocando el permiso.
  const r = porQueFalloLaAgenda('HTTP 401 — {"error":"invalid_grant"}');
  assert.equal(r.causa, 'permiso_vencido');
});

test('§5.7 · lo que no se reconoce se muestra tal cual, sin inventar', () => {
  // Una explicación amable e inventada es peor que el texto crudo: manda a
  // buscar donde no está.
  const r = porQueFalloLaAgenda('HTTP 500 — backend error');
  assert.equal(r.causa, 'otra');
  assert.equal(r.que_hacer, 'HTTP 500 — backend error');
});

test('§5.7 · sin mensaje no se rompe', () => {
  assert.equal(porQueFalloLaAgenda('').causa, 'otra');
  assert.ok(porQueFalloLaAgenda('').que_hacer.length > 0, 'siempre dice algo');
});
