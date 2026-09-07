import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLAVES, origen, permisosEfectivos, puede, volverAlPreset } from '../src/permisos.ts';

const admin = { rol: 'administrador' as const, permisos: {} };
const colaborador = { rol: 'colaborador' as const, permisos: {} };

test('§6.2 · el administrador tiene las 12 claves', () => {
  for (const c of CLAVES) assert.equal(puede(admin, c), true, c);
});

test('§6.3 · el colaborador por defecto solo tiene tareas y agenda', () => {
  assert.equal(puede(colaborador, 'tareas'), true);
  assert.equal(puede(colaborador, 'agenda'), true);
  for (const c of CLAVES) {
    if (c === 'tareas' || c === 'agenda') continue;
    assert.equal(puede(colaborador, c), false, c);
  }
});

test('§6.2 · el rol es un preset, no una jaula: el override manda en los dos sentidos', () => {
  assert.equal(puede({ rol: 'colaborador', permisos: { enviarMensajes: true } }, 'enviarMensajes'), true);
  assert.equal(puede({ rol: 'administrador', permisos: { usuarios: false } }, 'usuarios'), false);
});

test('§6.2 · la ficha distingue lo que viene del rol de lo editado', () => {
  const u = { rol: 'colaborador' as const, permisos: { enviarMensajes: true } };
  assert.equal(origen(u, 'enviarMensajes'), 'editado');
  assert.equal(origen(u, 'tareas'), 'por rol');
});

test('§6.2 · volver al preset es simplemente borrar los overrides', () => {
  const u = { rol: 'colaborador' as const, permisos: { enviarMensajes: true, usuarios: true } };
  const limpio = volverAlPreset(u);
  assert.deepEqual(limpio.permisos, {});
  assert.equal(puede(limpio, 'enviarMensajes'), false);
});

test('permisosEfectivos devuelve las 12 claves resueltas', () => {
  const r = permisosEfectivos(colaborador);
  assert.equal(Object.keys(r).length, 12);
  assert.equal(r.tareas, true);
  assert.equal(r.baseCompartida, false);
});

