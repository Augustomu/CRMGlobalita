import test from 'node:test';
import assert from 'node:assert/strict';
import {
  estadoDeLista,
  laQueTrabaja,
  mover,
  restantes,
  resumenDeCuentas,
  resumenDeListas,
  salidasDeHoy,
  vuelvenALaCola,
  type CuentaInvitacion,
  type LeadDeCuenta,
  type ListaInvitacion,
} from '../src/invitacion.ts';

const HOY = '2026-09-08';

const lista = (x: Partial<ListaInvitacion> & { id: string }): ListaInvitacion => ({
  cuenta: 'c1',
  nombre: 'lista ' + x.id,
  fuente: 'sales_navigator',
  orden: 1,
  pagina: 0,
  paginas: 10,
  por_pagina: 25,
  ...x,
});

const cuenta = (x: Partial<CuentaInvitacion> & { id: string }): CuentaInvitacion => ({
  abrev: x.id.toUpperCase(),
  estado_sesion: 'activa',
  cupo_diario: 40,
  objetivo_semanal: 200,
  ...x,
});

const CANCEL = { dias_sin_aceptar: 90, espera_recontacto_dias: 60, tope_diario_por_cuenta: 30 };

test('§7.3 · quedan las paginas que faltan por lo que rinde una pagina', () => {
  assert.equal(restantes(lista({ id: 'a', pagina: 12, paginas: 40, por_pagina: 25 })), 700);
  // Agotada no es "negativo": es cero.
  assert.equal(restantes(lista({ id: 'b', pagina: 40, paginas: 40 })), 0);
  assert.equal(restantes(lista({ id: 'c', pagina: 45, paginas: 40 })), 0);
});

test('el script trabaja la de mayor prioridad QUE TODAVIA TENGA PAGINAS', () => {
  const listas = [
    lista({ id: 'primera', orden: 1, pagina: 10, paginas: 10 }),
    lista({ id: 'segunda', orden: 2, pagina: 3, paginas: 20 }),
    lista({ id: 'tercera', orden: 3 }),
  ];
  assert.equal(laQueTrabaja(listas)?.id, 'segunda');
  assert.equal(estadoDeLista(listas[0], listas), 'agotada');
  assert.equal(estadoDeLista(listas[1], listas), 'en uso');
  assert.equal(estadoDeLista(listas[2], listas), 'en espera');
});

test('sin material no trabaja ninguna', () => {
  const listas = [lista({ id: 'a', pagina: 10, paginas: 10 })];
  assert.equal(laQueTrabaja(listas), null);
});

test('mover renumera TODAS, no solo las dos que se cruzan', () => {
  const listas = [
    lista({ id: 'a', orden: 1 }),
    lista({ id: 'b', orden: 2 }),
    lista({ id: 'c', orden: 3 }),
  ];
  assert.deepEqual(mover(listas, 'c', -1), [
    { id: 'a', orden: 1 },
    { id: 'c', orden: 2 },
    { id: 'b', orden: 3 },
  ]);
  // Contra el borde no pasa nada, no se rompe el orden.
  assert.deepEqual(mover(listas, 'a', -1), []);
  assert.deepEqual(mover(listas, 'c', 1), []);
});

test('los resumenes de una linea', () => {
  assert.equal(resumenDeListas([]), 'sin listas asignadas');
  assert.equal(resumenDeListas([lista({ id: 'a' })]), '1 lista · 1 con páginas');
  assert.equal(
    resumenDeListas([lista({ id: 'a' }), lista({ id: 'b', pagina: 10, paginas: 10 })]),
    '2 listas · 1 con páginas',
  );
  assert.equal(
    resumenDeCuentas([
      cuenta({ id: 'a' }),
      cuenta({ id: 'b', estado_sesion: 'caida' }),
      cuenta({ id: 'c', estado_sesion: 'sin_vincular' }),
    ]),
    '2 vinculadas de 10 · 1 activas',
  );
});

test('§7.3 · en pausa TODO va en cero: el panel dice que va a pasar hoy', () => {
  const cuentas = [cuenta({ id: 'c1' })];
  const listas = new Map([['c1', [lista({ id: 'a' })]]]);
  const leads: LeadDeCuenta[] = [{ cuenta: 'c1', situacion: 'en_curso', proximo_contacto: HOY }];
  const [r] = salidasDeHoy(cuentas, listas, leads, CANCEL, HOY, true);
  assert.deepEqual(r, { cuenta: 'C1', invitaciones: 0, seguimiento: 0, cancelaciones: 0, frenada: false });
});

test('la cuenta con la sesion caida va en cero y se marca frenada', () => {
  // Mostrar su cupo lleno seria prometer envios que no van a ocurrir: es como
  // alguien se entera tarde de que se le cayo la sesion.
  const cuentas = [cuenta({ id: 'c1', estado_sesion: 'caida' })];
  const listas = new Map([['c1', [lista({ id: 'a' })]]]);
  const [r] = salidasDeHoy(cuentas, listas, [], CANCEL, HOY, false);
  assert.equal(r.invitaciones, 0);
  assert.equal(r.frenada, true);
});

test('las invitaciones son el minimo entre el cupo y lo que queda en las listas', () => {
  const cuentas = [cuenta({ id: 'c1', cupo_diario: 40 })];
  // Solo quedan 2 paginas x 25 = 50 -> manda el cupo.
  const mucho = new Map([['c1', [lista({ id: 'a', pagina: 8, paginas: 10 })]]]);
  assert.equal(salidasDeHoy(cuentas, mucho, [], CANCEL, HOY, false)[0].invitaciones, 40);
  // Queda 1 pagina x 25 = 25 -> manda el material.
  const poco = new Map([['c1', [lista({ id: 'a', pagina: 9, paginas: 10 })]]]);
  assert.equal(salidasDeHoy(cuentas, poco, [], CANCEL, HOY, false)[0].invitaciones, 25);
});

test('el seguimiento cuenta los que ya les toca, y las cancelaciones respetan el tope', () => {
  const cuentas = [cuenta({ id: 'c1', cupo_diario: 0 })];
  const leads: LeadDeCuenta[] = [
    { cuenta: 'c1', situacion: 'en_curso', proximo_contacto: '2026-09-01' }, // vencido: toca
    { cuenta: 'c1', situacion: 'en_curso', proximo_contacto: HOY },          // hoy: toca
    { cuenta: 'c1', situacion: 'en_curso', proximo_contacto: '2026-10-01' }, // futuro: no
    { cuenta: 'c1', situacion: 'pausado', proximo_contacto: HOY },           // pausado: no
    // Invitada hace mas de 90 dias, sin aceptar ni cancelar: se cancela.
    { cuenta: 'c1', situacion: 'en_curso', f_invitacion: '2026-01-01' },
    // Ya aceptada: no se cancela.
    { cuenta: 'c1', situacion: 'en_curso', f_invitacion: '2026-01-01', f_aceptacion: '2026-01-05' },
  ];
  const [r] = salidasDeHoy(cuentas, new Map(), leads, CANCEL, HOY, false);
  assert.equal(r.seguimiento, 2);
  assert.equal(r.cancelaciones, 1);
});

test('los que vuelven a la cola se agrupan por CUANDO vuelven', () => {
  const cuentas = [cuenta({ id: 'c1' })];
  const leads: LeadDeCuenta[] = [
    { cuenta: 'c1', situacion: 'agotado', f_cancelada: '2026-07-01' }, // +60d = 30/08: ya
    { cuenta: 'c1', situacion: 'agotado', f_cancelada: '2026-07-12' }, // +60d = 10/09: esta semana
    { cuenta: 'c1', situacion: 'agotado', f_cancelada: '2026-07-20' }, // +60d = 18/09: proxima
    { cuenta: 'c1', situacion: 'agotado', f_cancelada: '2026-08-30' }, // +60d = 29/10: todavia no
  ];
  assert.deepEqual(vuelvenALaCola(cuentas, leads, CANCEL, HOY), [
    { cuenta: 'C1', cuando: 'hoy', n: 1 },
    { cuenta: 'C1', cuando: 'esta semana', n: 1 },
    { cuenta: 'C1', cuando: 'próxima semana', n: 1 },
  ]);
});
