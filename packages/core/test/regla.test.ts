import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DE_FABRICA,
  describir,
  queFalta,
  resumen,
  sePuedeBorrar,
  type Regla,
} from '../src/regla.ts';

const regla = (x: Partial<Regla> & { id: string }): Regla => ({
  nombre: 'Regla ' + x.id,
  disparador: 'se agrega una etiqueta',
  condicion: '',
  accion: 'crear una tarea',
  activa: true,
  de_fabrica: false,
  ...x,
});

test('§7.9 · una regla de fabrica se apaga pero no se borra', () => {
  // Borrarla dejaria un sistema que sigue haciendo algo que ya no figura en
  // ningun lado: el comportamiento vive en el codigo y la fila es la unica
  // forma de enterarse de que existe.
  assert.equal(sePuedeBorrar(regla({ id: 'a', de_fabrica: true })), false);
  assert.equal(sePuedeBorrar(regla({ id: 'b' })), true);
});

test('las dos de fabrica describen algo que el sistema YA hace', () => {
  assert.equal(DE_FABRICA.length, 2);
  assert.ok(DE_FABRICA.every((r) => r.de_fabrica));
  assert.ok(DE_FABRICA.every((r) => r.id && r.nombre && r.disparador && r.accion));
});

test('sin nombre, disparador o accion la regla no se puede crear', () => {
  assert.deepEqual(queFalta({ nombre: '', disparador: null, accion: null }), [
    'el nombre',
    'el disparador',
    'la acción',
  ]);
  assert.deepEqual(queFalta({ nombre: '  ', disparador: 'x', accion: 'y' }), ['el nombre']);
  assert.deepEqual(queFalta({ nombre: 'Con nombre', disparador: 'x', accion: 'y' }), []);
});

test('la descripcion se lee como una frase', () => {
  assert.equal(
    describir({ disparador: 'el lead responde', condicion: '', accion: 'crear una tarea' }),
    'Si el lead responde, entonces crear una tarea.',
  );
  assert.equal(
    describir({ disparador: 'el lead responde', condicion: 'de una cuenta', accion: 'crear una tarea' }),
    'Si el lead responde y de una cuenta, entonces crear una tarea.',
  );
  // «sin condición» es la opcion de NO poner condicion: no se escribe.
  assert.equal(
    describir({ disparador: 'el lead responde', condicion: 'sin condición', accion: 'crear una tarea' }),
    'Si el lead responde, entonces crear una tarea.',
  );
});

test('el resumen cuenta las activas sobre el total', () => {
  assert.equal(resumen([regla({ id: 'a' }), regla({ id: 'b', activa: false })]), '1 de 2 activas');
  assert.equal(resumen([]), '0 de 0 activas');
});
