import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TOPE_DE_PAGINAS,
  estadoDeLista,
  medidaDelEncabezado,
  paginasParaResultados,
  paraMedir,
  resultadosDelEncabezado,
  sePuedeMedirSola,
  sinMedir,
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

// §3.4 · «Sin medir» NO es lo mismo que «agotada», aunque las dos salgan del
// mismo `0 >= 0`.
//
// El 10/09 se cargaron las 22 búsquedas guardadas reales de Augusto y las 22
// figuraban AGOTADAS, porque `paginas` venía en 0: el documento traía los
// nombres y los ids, no cuántas páginas tiene cada una. La única lectura
// posible de esa pantalla era «se terminaron», y lo que pasaba era «nunca se
// midieron». La diferencia decide qué hace uno: ir a cargar listas nuevas, o ir
// a medir las que ya están.
test('§3.4 · una lista sin medir no dice «agotada»', () => {
  const listas = [
    lista({ id: 'nueva', paginas: 0 }),
    lista({ id: 'usada', orden: 2, pagina: 10, paginas: 10 }),
    lista({ id: 'viva', orden: 3, pagina: 2, paginas: 8 }),
  ];
  assert.equal(estadoDeLista(listas[0], listas), 'sin medir');
  assert.equal(estadoDeLista(listas[1], listas), 'agotada');
  assert.equal(estadoDeLista(listas[2], listas), 'en uso');
});

test('§3.4 · sinMedir devuelve exactamente las que faltan medir', () => {
  const listas = [
    lista({ id: 'a', paginas: 0 }),
    lista({ id: 'b', paginas: 12 }),
    lista({ id: 'c', paginas: 0 }),
  ];
  assert.deepEqual(sinMedir(listas).map((l) => l.id), ['a', 'c']);
  assert.deepEqual(sinMedir([]), []);
  assert.deepEqual(sinMedir([lista({ id: 'z', paginas: 5 })]), []);
});

test('§3.4 · sin medir NO entra en la cola, y eso está bien', () => {
  // Una lista cuyo tamaño nadie midió no puede prometer invitaciones. Que no
  // trabaje es lo correcto; lo que no era correcto es llamarla «agotada».
  const listas = [lista({ id: 'sinmedir', orden: 1, paginas: 0 })];
  assert.equal(laQueTrabaja(listas), null);
  assert.equal(restantes(listas[0]), 0);
});

test('§3.4 · el resumen las cuenta aparte, y sólo si las hay', () => {
  const conFaltantes = [
    lista({ id: 'a', paginas: 0 }),
    lista({ id: 'b', orden: 2, paginas: 10 }),
  ];
  const texto = resumenDeListas(conFaltantes);
  assert.ok(texto.includes('sin medir'), texto);
  assert.ok(texto.includes('2 listas'), texto);

  // Con todas medidas no se menciona: un «· 0 sin medir» permanente es ruido.
  assert.ok(!resumenDeListas([lista({ id: 'b', paginas: 10 })]).includes('sin medir'));
});

// ===========================================================================
// §3.4 · Medir: el total se DESCUBRE, no se tipea
// ===========================================================================
//
// La otra mitad de «sin medir». Sales Navigator escribe arriba de la lista
// cuántos resultados tiene la búsqueda, y de ahí sale el total de páginas.
// Estos tests son sobre la REGLA: el texto entra como string y sale un número.
// De qué elemento del DOM sale ese texto es cosa de `apps/worker/src/salesnav.ts`.

test('§3.4 · el encabezado se lee en los tres idiomas de las cuentas', () => {
  // Los formatos son los que sirve LinkedIn segun el idioma de la sesion: las
  // cuentas estan en castellano, ingles y portugues segun a quien prospectan.
  assert.equal(resultadosDelEncabezado('About 1,234 results'), 1234);
  assert.equal(resultadosDelEncabezado('1,234 results'), 1234);
  assert.equal(resultadosDelEncabezado('1 result'), 1);
  assert.equal(resultadosDelEncabezado('Aproximadamente 1.234 resultados'), 1234);
  assert.equal(resultadosDelEncabezado('Más de 2.500 resultados'), 2500);
  assert.equal(resultadosDelEncabezado('Cerca de 1.234 resultados'), 1234); // portugués
  assert.equal(resultadosDelEncabezado('Mais de 2.500 resultados'), 2500);
  // El «+» de las búsquedas grandes, y el salto de línea del innerText.
  assert.equal(resultadosDelEncabezado('About 1,000+ results'), 1000);
  assert.equal(resultadosDelEncabezado('1,234\nresults'), 1234);
  // Con el conteo en la mitad de una frase más larga.
  assert.equal(resultadosDelEncabezado('Mostrando 1-25 de 1.234 resultados'), 1234);
});

// EL BUG QUE ESTE TEST EXISTE PARA QUE NO PASE.
//
// En inglés el separador de miles es la coma y en castellano y portugués es el
// punto. El MISMO texto —«1.234»— vale 1234 en una cuenta y sería 1,234 en la
// otra. Leerlo con `parseFloat`, que es lo que sale solo, convierte
// «1.234 resultados» en 1: la lista queda con UNA página, figura medida, y
// nadie tiene por qué sospechar. Es peor que no medir — una lista sin medir se
// ve y se arregla; una lista mal medida se cree.
test('§3.4 · el separador de miles no se confunde: «1.234» nunca es 1', () => {
  assert.equal(resultadosDelEncabezado('Aproximadamente 1.234 resultados'), 1234);
  assert.notEqual(resultadosDelEncabezado('Aproximadamente 1.234 resultados'), 1);
  assert.equal(resultadosDelEncabezado('About 1,234 results'), 1234);
  // Los dos estilos de agrupar, con dos grupos.
  assert.equal(resultadosDelEncabezado('1.234.567 resultados'), 1234567);
  assert.equal(resultadosDelEncabezado('1,234,567 results'), 1234567);
  // El grupo de arranque puede tener 1, 2 o 3 dígitos.
  assert.equal(resultadosDelEncabezado('12.345 resultados'), 12345);
  assert.equal(resultadosDelEncabezado('123,456 results'), 123456);
});

test('§3.4 · lo que no se puede leer dice NO SE SABE, no 0 ni un número inventado', () => {
  // `null` y no 0: 0 ya significa «sin medir», y encima se ve igual que
  // «agotada». Y un número inventado hace prometer invitaciones que no existen.
  assert.equal(resultadosDelEncabezado('Se cambió el DOM y acá no hay nada'), null);
  assert.equal(resultadosDelEncabezado(''), null);
  assert.equal(resultadosDelEncabezado(null), null);
  assert.equal(resultadosDelEncabezado(undefined), null);
  // Un número suelto sin la palabra no es un total: puede ser el de una página,
  // el de un filtro o el de un badge.
  assert.equal(resultadosDelEncabezado('1.234'), null);
  assert.equal(resultadosDelEncabezado('Página 3 de 40'), null);
  // Lo que NO tiene forma de miles no se interpreta: «1.5» no es 15 ni 1500.
  assert.equal(resultadosDelEncabezado('1.5 resultados'), null);
  assert.equal(resultadosDelEncabezado('12.34 results'), null);
  assert.equal(resultadosDelEncabezado('2.5K results'), null);
  // Los dos separadores a la vez: uno es de miles y el otro decimal, y cuál es
  // cuál depende de un idioma que el texto no dice. No se tira una moneda.
  assert.equal(resultadosDelEncabezado('1.234,56 resultados'), null);
  assert.equal(resultadosDelEncabezado('1,234.56 results'), null);
});

test('§3.4 · una búsqueda vacía se lee como 0, y eso no es un error de lectura', () => {
  // 0 leído de verdad ≠ no se pudo leer. La lista sigue sin entrar en la cola
  // igual, pero el motivo es otro y hay que poder decirlo: los filtros de esa
  // búsqueda no traen a nadie.
  assert.equal(resultadosDelEncabezado('0 resultados'), 0);
  assert.equal(resultadosDelEncabezado('0 results'), 0);
  assert.equal(paginasParaResultados(0, 25), 0);
  // Sin el dígito escrito NO es 0: «No results» puede ser una búsqueda vacía o
  // una página que ni cargó, y eso no se adivina.
  assert.equal(resultadosDelEncabezado('No results found'), null);
  assert.equal(resultadosDelEncabezado('Sin resultados'), null);
});

test('§3.4 · de los resultados al total de páginas, con la última incompleta', () => {
  assert.equal(paginasParaResultados(1234, 25), 50); // 49,36 → 50
  assert.equal(paginasParaResultados(25, 25), 1);
  assert.equal(paginasParaResultados(26, 25), 2); // la última va incompleta y cuenta
  assert.equal(paginasParaResultados(1, 25), 1);
  // Sin saber cuánto rinde una página no hay división posible: NO SE SABE.
  // Devolver 0 sería decir «medida y vacía» de algo que nadie midió.
  assert.equal(paginasParaResultados(1234, 0), null);
  assert.equal(paginasParaResultados(1234, -25), null);
  assert.equal(paginasParaResultados(-1, 25), null);
  assert.equal(paginasParaResultados(Number.NaN, 25), null);
});

// Sales Navigator corta el paginado alrededor de las 100 páginas aunque la
// búsqueda diga más resultados. NO ESTÁ VERIFICADO contra LinkedIn —está
// anotado como hipótesis en `TOPE_DE_PAGINAS`— y se topea igual porque es el
// error barato: sin tope la lista promete invitaciones que la plataforma no
// entrega y la corrida navega páginas vacías.
test('§3.4 · el paginado se topea, y el recorte no es silencioso', () => {
  assert.equal(TOPE_DE_PAGINAS, 100);
  // 2.500 a 25 por página son exactamente las 100: entra justo, no se recorta.
  const justo = medidaDelEncabezado('Más de 2.500 resultados', 25);
  assert.deepEqual(justo, { resultados: 2500, paginas: 100, topeado: false });
  // Uno más y ya no entra: se guarda 100 y se dice que se recortó.
  const pasado = medidaDelEncabezado('About 12,000 results', 25);
  assert.deepEqual(pasado, { resultados: 12000, paginas: 100, topeado: true });
});

test('§3.4 · la medición entera, y el «no se sabe» que no toca nada', () => {
  assert.deepEqual(medidaDelEncabezado('About 1,234 results', 25), {
    resultados: 1234,
    paginas: 50,
    topeado: false,
  });
  // Encabezado ilegible → null. Quien llama NO escribe nada: una lista que
  // sigue sin medir es un problema que se ve, una con un total inventado es un
  // problema que se cree.
  assert.equal(medidaDelEncabezado('el DOM cambió', 25), null);
  assert.equal(medidaDelEncabezado('About 1,234 results', 0), null);
});

test('§3.4 · sólo se puede medir sola la que tiene a dónde ir', () => {
  assert.equal(sePuedeMedirSola(lista({ id: 'a', origen_id: '1995468452' })), true);
  // Sin `origen_id` no hay búsqueda a la que entrar.
  assert.equal(sePuedeMedirSola(lista({ id: 'b' })), false);
  // Un CSV no tiene encabezado que leer: el total lo sabe el archivo.
  assert.equal(sePuedeMedirSola(lista({ id: 'c', fuente: 'csv', origen_id: 'marzo.csv' })), false);
  assert.equal(sePuedeMedirSola(lista({ id: 'd', fuente: 'manual', origen_id: '1995468452' })), false);
});

test('§3.4 · a medir van las sin medir con dirección, en orden de prioridad', () => {
  const listas = [
    lista({ id: 'tercera', orden: 3, paginas: 0, origen_id: '1990990676' }),
    lista({ id: 'medida', orden: 1, paginas: 40, origen_id: '1995468452' }),
    lista({ id: 'primera', orden: 2, paginas: 0, origen_id: '1995468452' }),
    lista({ id: 'csv', orden: 4, paginas: 0, fuente: 'csv', origen_id: 'marzo.csv' }),
    lista({ id: 'huerfana', orden: 5, paginas: 0 }),
  ];
  // En orden porque una corrida se puede cortar en la mitad —por un aviso de
  // LinkedIn, por la franja horaria— y lo que tiene que quedar medido primero
  // es lo que se va a trabajar primero.
  assert.deepEqual(paraMedir(listas).map((l) => l.id), ['primera', 'tercera']);
  assert.deepEqual(paraMedir([]), []);
});
