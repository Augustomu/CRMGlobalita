import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decidirRuteoEntrante, type PerfilConTelefono } from '../src/ruteo.ts';

test('§5.8 · sin ningún perfil que coincida, es un entrante desconocido', () => {
  const r = decidirRuteoEntrante('cuenta-AL', []);
  assert.deepEqual(r, { accion: 'desconocido' });
});

test('§5.8 · coincide un perfil con lead en esta cuenta: entra al follow-up, no crea nada', () => {
  const candidatos: PerfilConTelefono[] = [
    { perfil_id: 'p1', telefono: '5511987654321', leads: [{ lead_id: 'l1', cuenta_id: 'cuenta-DL' }] },
  ];
  const r = decidirRuteoEntrante('cuenta-DL', candidatos);
  assert.deepEqual(r, { accion: 'conocido_en_esta_cuenta', perfil_id: 'p1', lead_id: 'l1' });
});

test('D08 · coincide un perfil, pero solo tiene lead en OTRA cuenta: no se auto-asigna', () => {
  const candidatos: PerfilConTelefono[] = [
    { perfil_id: 'p1', telefono: '5519998877665', leads: [{ lead_id: 'l1', cuenta_id: 'cuenta-AL' }] },
  ];
  const r = decidirRuteoEntrante('cuenta-DL', candidatos);
  assert.equal(r.accion, 'conocido_otra_cuenta');
  assert.equal(r.accion === 'conocido_otra_cuenta' && r.perfil_id, 'p1');
  assert.deepEqual(
    r.accion === 'conocido_otra_cuenta' && r.leads_otras_cuentas,
    [{ lead_id: 'l1', cuenta_id: 'cuenta-AL' }],
  );
});

test('D08 · un perfil sin ningún lead todavía también es "otra cuenta": nunca se auto-asigna', () => {
  const candidatos: PerfilConTelefono[] = [{ perfil_id: 'p1', telefono: '5511987654321', leads: [] }];
  const r = decidirRuteoEntrante('cuenta-DL', candidatos);
  assert.equal(r.accion, 'conocido_otra_cuenta');
});

test('D08 · el mismo perfil trabajado por dos cuentas (D27): rutea a la que preguntó', () => {
  const candidatos: PerfilConTelefono[] = [
    {
      perfil_id: 'p1',
      telefono: '5519998877665',
      leads: [
        { lead_id: 'l-al', cuenta_id: 'cuenta-AL' },
        { lead_id: 'l-dl', cuenta_id: 'cuenta-DL' },
      ],
    },
  ];
  const r = decidirRuteoEntrante('cuenta-DL', candidatos);
  assert.deepEqual(r, { accion: 'conocido_en_esta_cuenta', perfil_id: 'p1', lead_id: 'l-dl' });
});

test('D08 · dos perfiles distintos comparten teléfono: nunca se adivina, va a elegir a mano', () => {
  const candidatos: PerfilConTelefono[] = [
    { perfil_id: 'p1', telefono: '5511987654321', leads: [] },
    { perfil_id: 'p2', telefono: '5511987654321', leads: [] },
  ];
  const r = decidirRuteoEntrante('cuenta-DL', candidatos);
  assert.deepEqual(r, { accion: 'ambiguo', candidatos: ['p1', 'p2'] });
});
