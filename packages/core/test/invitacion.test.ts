import test from 'node:test';
import assert from 'node:assert/strict';
import {
  estadoDeLista,
  laQueTrabaja,
  mover,
  restantes,
  resumenDeCuentas,
  urlDeLista,
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

// El estado de la sesión NO es un campo: se deduce de cuán vieja es la última
// señal (`core/sesion.ts`, 15 minutos). El reloj va fijo y las señales llevan
// la Z, que es como las guarda PocketBase («2026-09-08 21:18:23.421Z»): así el
// test dice lo mismo en cualquier zona horaria.
const AHORA = new Date('2026-09-10T12:00:00.000Z');
const SENAL_VIVA = '2026-09-10 11:55:00.000Z'; // 5 minutos → activa
const SENAL_VIEJA = '2026-09-10 10:00:00.000Z'; // 2 horas → caída

const cuenta = (x: Partial<CuentaInvitacion> & { id: string }): CuentaInvitacion => ({
  abrev: x.id.toUpperCase(),
  ultima_senal_li: SENAL_VIVA,
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
    resumenDeCuentas(
      [
        cuenta({ id: 'a' }),
        cuenta({ id: 'b', ultima_senal_li: SENAL_VIEJA }),
        cuenta({ id: 'c', ultima_senal_li: null }),
      ],
      AHORA,
    ),
    '2 vinculadas de 10 · 1 activas',
  );
});

test('§7.3 · en pausa TODO va en cero: el panel dice que va a pasar hoy', () => {
  const cuentas = [cuenta({ id: 'c1' })];
  const listas = new Map([['c1', [lista({ id: 'a' })]]]);
  const leads: LeadDeCuenta[] = [{ cuenta: 'c1', situacion: 'en_curso', proximo_contacto: HOY }];
  const [r] = salidasDeHoy(cuentas, listas, leads, CANCEL, HOY, true, AHORA);
  assert.deepEqual(r, { cuenta: 'C1', invitaciones: 0, seguimiento: 0, cancelaciones: 0, frenada: false });
});

test('la cuenta con la sesion caida va en cero y se marca frenada', () => {
  // Mostrar su cupo lleno seria prometer envios que no van a ocurrir: es como
  // alguien se entera tarde de que se le cayo la sesion.
  const cuentas = [cuenta({ id: 'c1', ultima_senal_li: SENAL_VIEJA })];
  const listas = new Map([['c1', [lista({ id: 'a' })]]]);
  const [r] = salidasDeHoy(cuentas, listas, [], CANCEL, HOY, false, AHORA);
  assert.equal(r.invitaciones, 0);
  assert.equal(r.frenada, true);
});

test('las invitaciones son el minimo entre el cupo y lo que queda en las listas', () => {
  const cuentas = [cuenta({ id: 'c1', cupo_diario: 40 })];
  // Solo quedan 2 paginas x 25 = 50 -> manda el cupo.
  const mucho = new Map([['c1', [lista({ id: 'a', pagina: 8, paginas: 10 })]]]);
  assert.equal(salidasDeHoy(cuentas, mucho, [], CANCEL, HOY, false, AHORA)[0].invitaciones, 40);
  // Queda 1 pagina x 25 = 25 -> manda el material.
  const poco = new Map([['c1', [lista({ id: 'a', pagina: 9, paginas: 10 })]]]);
  assert.equal(salidasDeHoy(cuentas, poco, [], CANCEL, HOY, false, AHORA)[0].invitaciones, 25);
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
  const [r] = salidasDeHoy(cuentas, new Map(), leads, CANCEL, HOY, false, AHORA);
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

// §8.1 · El bug que cierra este test: la cuenta sin NINGUNA señal.
//
// Hasta el 10/09 «frenada» se leía de `cuenta.estado_sesion`, un campo del seed
// de demo que decía «activa» en cinco cuentas que nunca habían tenido sesión.
// El panel les mostraba el cupo lleno y la cola las daba por listas para
// enviar. El propio comentario de `salidasDeHoy` dice que eso es «prometer
// envíos que no van a ocurrir» — lo decía mientras lo hacía.
test('§8.1 · sin señal no hay sesión: va frenada aunque el registro diga otra cosa', () => {
  const cuentas = [cuenta({ id: 'c1', ultima_senal_li: null })];
  const listas = new Map([['c1', [lista({ id: 'a' })]]]);
  const [r] = salidasDeHoy(cuentas, listas, [], CANCEL, HOY, false, AHORA);
  assert.equal(r.frenada, true);
  assert.equal(r.invitaciones, 0);

  // Y una señal ilegible tampoco es una sesión viva: ante la duda, frenada.
  const rara = [cuenta({ id: 'c1', ultima_senal_li: 'cualquier cosa' })];
  assert.equal(salidasDeHoy(rara, listas, [], CANCEL, HOY, false, AHORA)[0].frenada, true);
});

test('§8.1 · la señal fresca sí deja salir', () => {
  const cuentas = [cuenta({ id: 'c1', ultima_senal_li: SENAL_VIVA })];
  const listas = new Map([['c1', [lista({ id: 'a' })]]]);
  const [r] = salidasDeHoy(cuentas, listas, [], CANCEL, HOY, false, AHORA);
  assert.equal(r.frenada, false);

  // El corte son 15 minutos: 14 pasa, 16 no. Sin esto, cambiar el umbral no
  // rompería ningún test.
  const en = (min: number) =>
    new Date(AHORA.getTime() - min * 60000).toISOString().replace('T', ' ');
  assert.equal(
    salidasDeHoy([cuenta({ id: 'c1', ultima_senal_li: en(14) })], listas, [], CANCEL, HOY, false, AHORA)[0].frenada,
    false,
  );
  assert.equal(
    salidasDeHoy([cuenta({ id: 'c1', ultima_senal_li: en(16) })], listas, [], CANCEL, HOY, false, AHORA)[0].frenada,
    true,
  );
});

// §3.4 · La dirección de una lista se ARMA, no se guarda.
//
// Augusto pasó las 22 búsquedas guardadas el 10/09 y las URLs venían como las
// copia uno del navegador: con `lipi` y `snfl` pegados atrás. Esos dos son
// tracking de la sesión que generó el link — cambian en cada visita y no
// identifican la búsqueda. Se guarda el id y la dirección sale sola.
test('§3.4 · de un savedSearchId sale la URL, siempre limpia', () => {
  assert.equal(
    urlDeLista('sales_navigator', '1995468452'),
    'https://www.linkedin.com/sales/search/people?savedSearchId=1995468452',
  );
  // Con espacios alrededor, que es como llega de un copiar y pegar.
  assert.equal(
    urlDeLista('sales_navigator', '  1990990676  '),
    'https://www.linkedin.com/sales/search/people?savedSearchId=1990990676',
  );
});

test('§3.4 · lo que no es un id no se convierte en un link roto', () => {
  // El pegado más probable: la URL entera adentro del campo. Armar la
  // dirección con eso da algo que PARECE un link y no lleva a ningún lado,
  // que es peor que no tener nada.
  assert.equal(
    urlDeLista('sales_navigator', 'https://www.linkedin.com/sales/search/people?savedSearchId=123'),
    '',
  );
  assert.equal(urlDeLista('sales_navigator', '1995468452&lipi=urn%3Ali'), '');
  assert.equal(urlDeLista('sales_navigator', ''), '');
  assert.equal(urlDeLista('sales_navigator', null), '');
  assert.equal(urlDeLista('sales_navigator', undefined), '');
});

test('§3.4 · un CSV no tiene dirección y no se le inventa una', () => {
  assert.equal(urlDeLista('csv', 'contactos-marzo.csv'), '');
  assert.equal(urlDeLista('manual', '1995468452'), '');
});
