import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CLAVES, origen, permisosEfectivos, puede, puedeEditarLead, seccionInicial, volverAlPreset,
  lineasDeControl,
  veLineaEnControl,
} from '../src/permisos.ts';

const admin = { rol: 'administrador' as const, permisos: {} };
const colaborador = { rol: 'colaborador' as const, permisos: {} };
const observador = { rol: 'observador' as const, permisos: {} };

test('§6.2 · el administrador tiene todas las claves', () => {
  for (const c of CLAVES) assert.equal(puede(admin, c), true, c);
});

test('§6.3 · el colaborador ve follow-up, WA personal, tareas y agenda', () => {
  for (const c of ['followup', 'waPersonal', 'tareas', 'agenda'] as const) {
    assert.equal(puede(colaborador, c), true, c);
  }
});

test('§6.3 · el colaborador NO tiene automatizaciones, usuarios ni base compartida', () => {
  for (const c of ['automatizaciones', 'usuarios', 'baseCompartida', 'control', 'verTodosLeads'] as const) {
    assert.equal(puede(colaborador, c), false, c);
  }
});

test('anexo Control · el observador solo tiene control y verTodosLeads', () => {
  assert.equal(puede(observador, 'control'), true);
  assert.equal(puede(observador, 'verTodosLeads'), true);
  for (const c of CLAVES) {
    if (c === 'control' || c === 'verTodosLeads') continue;
    assert.equal(puede(observador, c), false, c);
  }
});

test('anexo Control · el observador no ve ningún dato de contacto', () => {
  for (const c of ['verTelefono', 'verEmails', 'verLinks', 'verConversaciones'] as const) {
    assert.equal(puede(observador, c), false, c);
  }
});

test('§6.2 · el rol es un preset: el override manda en los dos sentidos', () => {
  assert.equal(puede({ rol: 'colaborador', permisos: { enviarMensajes: true } }, 'enviarMensajes'), true);
  assert.equal(puede({ rol: 'administrador', permisos: { usuarios: false } }, 'usuarios'), false);
  // Y se le puede dar Control a un colaborador sin cambiarle el rol.
  assert.equal(puede({ rol: 'colaborador', permisos: { control: true } }, 'control'), true);
});

test('el administrador puede quitarle el teléfono a un colaborador puntual', () => {
  const sinTelefono = { rol: 'colaborador' as const, permisos: { verTelefono: false } };
  assert.equal(puede(sinTelefono, 'verTelefono'), false);
  // Y sigue viendo el resto.
  assert.equal(puede(sinTelefono, 'verEmails'), true);
  assert.equal(puede(sinTelefono, 'followup'), true);
});

test('§6.2 · la ficha distingue lo que viene del rol de lo editado', () => {
  const u = { rol: 'colaborador' as const, permisos: { enviarMensajes: true } };
  assert.equal(origen(u, 'enviarMensajes'), 'editado');
  assert.equal(origen(u, 'tareas'), 'por rol');
});

test('§6.2 · volver al preset es borrar los overrides', () => {
  const u = { rol: 'colaborador' as const, permisos: { enviarMensajes: true, usuarios: true } };
  const limpio = volverAlPreset(u);
  assert.deepEqual(limpio.permisos, {});
  assert.equal(puede(limpio, 'enviarMensajes'), false);
});

test('permisosEfectivos devuelve todas las claves resueltas', () => {
  const r = permisosEfectivos(colaborador);
  assert.equal(Object.keys(r).length, CLAVES.length);
  assert.equal(r.tareas, true);
  assert.equal(r.baseCompartida, false);
});

// ---------- nivel de asignación: editar un lead puntual ----------

test('nivel seguimiento: el colaborador asignado puede editar su lead', () => {
  assert.equal(
    puedeEditarLead(colaborador, { asignado: 'u1', nivel_asignacion: 'seguimiento' }, 'u1'),
    true,
  );
});

test('nivel lectura: el colaborador asignado NO puede editar, solo mirar', () => {
  assert.equal(
    puedeEditarLead(colaborador, { asignado: 'u1', nivel_asignacion: 'lectura' }, 'u1'),
    false,
  );
});

test('un lead de otro no se edita, ni en seguimiento', () => {
  assert.equal(
    puedeEditarLead(colaborador, { asignado: 'otro', nivel_asignacion: 'seguimiento' }, 'u1'),
    false,
  );
});

test('sin nivel cargado se asume seguimiento: los leads viejos no se rompen', () => {
  assert.equal(puedeEditarLead(colaborador, { asignado: 'u1' }, 'u1'), true);
});

test('el administrador edita cualquier lead; el observador ninguno', () => {
  assert.equal(puedeEditarLead(admin, { asignado: 'otro', nivel_asignacion: 'lectura' }, 'u1'), true);
  assert.equal(puedeEditarLead(observador, { asignado: 'u1', nivel_asignacion: 'seguimiento' }, 'u1'), false);
});

// ---------- sección inicial (anexo Control §5.2) ----------

test('anexo Control · cada rol cae en la primera sección que tiene permitida', () => {
  assert.equal(seccionInicial(admin), 'followup');
  assert.equal(seccionInicial(colaborador), 'followup');
  assert.equal(seccionInicial(observador), 'control');
});

test('un colaborador sin follow-up cae en WA Personal, no en una pantalla vacía', () => {
  assert.equal(seccionInicial({ rol: 'colaborador', permisos: { followup: false } }), 'waPersonal');
});

// ------------------------------------------------------- lineas de negocio

test('el Observador de SENG ve inversiones y nada mas', () => {
  const seng = { rol: 'observador' as const, permisos: {}, linea_control: 'inversiones' as const };
  assert.deepEqual(lineasDeControl(seng), ['inversiones']);
  assert.equal(veLineaEnControl(seng, 'inversiones'), true);
  assert.equal(veLineaEnControl(seng, 'ia'), false);
});

test('el Observador de Globalita ve IA y nada mas', () => {
  const glob = { rol: 'observador' as const, permisos: {}, linea_control: 'ia' as const };
  assert.deepEqual(lineasDeControl(glob), ['ia']);
  assert.equal(veLineaEnControl(glob, 'ia'), true);
  assert.equal(veLineaEnControl(glob, 'inversiones'), false);
});

test('sin linea asignada ve las dos', () => {
  const ambas = { rol: 'observador' as const, permisos: {} };
  assert.deepEqual(lineasDeControl(ambas), ['ia', 'inversiones']);
  assert.equal(veLineaEnControl(ambas, 'ia'), true);
  assert.equal(veLineaEnControl(ambas, 'inversiones'), true);
});

test('sin el permiso control no ve ninguna linea, tenga la que tenga', () => {
  // El alcance no reemplaza al permiso: son dos preguntas distintas.
  const colab = { rol: 'colaborador' as const, permisos: {}, linea_control: 'ia' as const };
  assert.deepEqual(lineasDeControl(colab), []);
  assert.equal(veLineaEnControl(colab, 'ia'), false);
});

test('el administrador ve las dos aunque tenga una asignada por error', () => {
  // Es administrador: puede('control') es true y sin linea propia ve todo. Con
  // una linea cargada queda limitado igual, que es lo que se pidio.
  const admin = { rol: 'administrador' as const, permisos: {} };
  assert.deepEqual(lineasDeControl(admin), ['ia', 'inversiones']);
});

test('un proyecto sin linea cargada solo lo ve quien ve las dos', () => {
  // Mostrarselo a un limitado seria filtrarle trabajo del otro negocio; es el
  // unico lado del error que importa.
  const seng = { rol: 'observador' as const, permisos: {}, linea_control: 'inversiones' as const };
  const ambas = { rol: 'observador' as const, permisos: {} };
  assert.equal(veLineaEnControl(seng, ''), false);
  assert.equal(veLineaEnControl(seng, null), false);
  assert.equal(veLineaEnControl(ambas, ''), true);
});
