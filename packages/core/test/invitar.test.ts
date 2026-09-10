import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  AZAR_MEDIO,
  CONFIG_INVITAR_INICIAL,
  aQuienLeToca,
  enCooldown,
  esperaDeArranqueMs,
  factorDeEspera,
  frenoPorAviso,
  fueraDeHorario,
  paginaAlTerminar,
  porQueNoInvita,
  ritmoDespuesDe,
  turnoDeInvitaciones,
  type ConfigInvitar,
  type CuentaQueInvita,
} from '../src/invitar.ts';
import type { ListaInvitacion } from '../src/invitacion.ts';

// El reloj va fijo: si el test dependiera de la hora en que se corre, fallaría
// solo de noche — que es exactamente el caso que hay que probar.
//
// La franja horaria es HORA LOCAL, así que el reloj se arma con hora local y no
// con un instante UTC. Con un `2026-09-10T12:00:00.000Z` el test pasa en
// Buenos Aires (09:00) y falla en Ciudad de México (06:00, fuera de la franja),
// que es donde se corrió la primera vez.
const A_LAS = (hora: number) => new Date(2026, 8, 10, hora, 0, 0, 0);
const AHORA = A_LAS(10);

// Las señales llevan la Z, que es como las guarda PocketBase, y salen del mismo
// reloj para que la frescura no dependa de la zona.
const hace = (minutos: number) =>
  new Date(AHORA.getTime() - minutos * 60_000).toISOString().replace('T', ' ');
const SENAL_VIVA = hace(5); // → activa
const SENAL_VIEJA = hace(120); // → caída

/** Un instante fijo, para lo que se compara contra un ISO exacto. */
const INSTANTE = new Date('2026-09-10T12:00:00.000Z');

const CONFIG: ConfigInvitar = CONFIG_INVITAR_INICIAL;

const cuenta = (x: Partial<CuentaQueInvita> & { id: string }): CuentaQueInvita => ({
  abrev: x.id.toUpperCase(),
  ultima_senal_li: SENAL_VIVA,
  cupo_diario: 40,
  objetivo_semanal: 200,
  chrome_perfil: 'Profile 1',
  cooldown_hasta: null,
  ...x,
});

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

// ---------------------------------------------------------------------------
// §5.3 · Cupos y ventana de envío de invitaciones
// ---------------------------------------------------------------------------

test('§5.3 · el cupo diario de la cuenta manda sobre cuántas salen', () => {
  const cuentas = [cuenta({ id: 'c1', cupo_diario: 40 })];
  const listas = new Map([['c1', [lista({ id: 'a' })]]]); // 10 páginas × 25 = 250
  const [t] = turnoDeInvitaciones(cuentas, listas, new Map(), CONFIG, false, AHORA);
  assert.equal(t.cuantas, 40);

  // Y descuenta lo que ya salió hoy: no es «40 por corrida», es «40 por día».
  const [con15] = turnoDeInvitaciones(cuentas, listas, new Map([['c1', 15]]), CONFIG, false, AHORA);
  assert.equal(con15.cuantas, 25);
});

test('§5.3 · el script trabaja la lista de mayor prioridad QUE TODAVÍA TENGA PÁGINAS', () => {
  const listas = new Map([
    [
      'c1',
      [
        lista({ id: 'primera', orden: 1, pagina: 10, paginas: 10 }), // agotada
        lista({ id: 'segunda', orden: 2, pagina: 9, paginas: 10 }), // 1 página = 25
        lista({ id: 'tercera', orden: 3 }),
      ],
    ],
  ]);
  const [t] = turnoDeInvitaciones([cuenta({ id: 'c1' })], listas, new Map(), CONFIG, false, AHORA);
  assert.equal(t.lista?.id, 'segunda');
  // Sin material no hay invitación por más cupo que sobre: 25 < 40.
  assert.equal(t.cuantas, 25);
});

test('§5.3 · sin material la cuenta no invita, y lo dice', () => {
  const listas = new Map([['c1', [lista({ id: 'a', pagina: 10, paginas: 10 })]]]);
  const [t] = turnoDeInvitaciones([cuenta({ id: 'c1' })], listas, new Map(), CONFIG, false, AHORA);
  assert.equal(t.cuantas, 0);
  assert.equal(t.impedimento?.freno, 'sin_material');
});

test('§5.3 · cumplido el cupo del día, la cuenta se detiene', () => {
  const listas = new Map([['c1', [lista({ id: 'a' })]]]);
  const [t] = turnoDeInvitaciones(
    [cuenta({ id: 'c1', cupo_diario: 40 })],
    listas,
    new Map([['c1', 40]]),
    CONFIG,
    false,
    AHORA,
  );
  assert.equal(t.cuantas, 0);
  assert.equal(t.impedimento?.freno, 'cupo_cumplido');
});

// ---------------------------------------------------------------------------
// §8.1 · Si la cuenta puede operar
// ---------------------------------------------------------------------------

test('§8.1 · sin señal no hay sesión: no se invita aunque el registro diga otra cosa', () => {
  const listas = [lista({ id: 'a' })];
  // Es el mismo bug de `salidasDeHoy`: el campo `estado_sesion` del seed decía
  // «activa» en cinco cuentas que nunca dieron una señal. Acá no se lee.
  assert.equal(
    porQueNoInvita(cuenta({ id: 'c1', ultima_senal_li: null }), listas, 0, CONFIG, false, AHORA)?.freno,
    'sin_vincular',
  );
  assert.equal(
    porQueNoInvita(cuenta({ id: 'c1', ultima_senal_li: SENAL_VIEJA }), listas, 0, CONFIG, false, AHORA)?.freno,
    'sesion_caida',
  );
  assert.equal(porQueNoInvita(cuenta({ id: 'c1' }), listas, 0, CONFIG, false, AHORA), null);
});

test('§8.1 · sin perfil de Chrome no se abre nada: abriría el de otra cuenta', () => {
  const listas = [lista({ id: 'a' })];
  const sinChrome = cuenta({ id: 'c1', chrome_perfil: '' });
  assert.equal(porQueNoInvita(sinChrome, listas, 0, CONFIG, false, AHORA)?.freno, 'sin_chrome');
  assert.equal(
    porQueNoInvita(cuenta({ id: 'c1', chrome_perfil: null }), listas, 0, CONFIG, false, AHORA)?.freno,
    'sin_chrome',
  );
});

test('§8.1 · la franja horaria: 08:00 sí, 22:00 no', () => {
  // El repositorio viejo bloquea 22:00–08:00 y esta es la misma regla, ahora
  // configurable. `hasta` es excluida: a las 22:00 en punto ya no se opera.
  assert.equal(fueraDeHorario(A_LAS(7), CONFIG), true);
  assert.equal(fueraDeHorario(A_LAS(8), CONFIG), false);
  assert.equal(fueraDeHorario(A_LAS(21), CONFIG), false);
  assert.equal(fueraDeHorario(A_LAS(22), CONFIG), true);
  assert.equal(fueraDeHorario(A_LAS(3), CONFIG), true);

  const listas = [lista({ id: 'a' })];
  assert.equal(
    porQueNoInvita(cuenta({ id: 'c1' }), listas, 0, CONFIG, false, A_LAS(3))?.freno,
    'fuera_de_horario',
  );
});

test('§8.1 · una franja vacía no habilita las veinticuatro horas', () => {
  const nunca = { ...CONFIG, hora_desde: 8, hora_hasta: 8 };
  assert.equal(fueraDeHorario(A_LAS(8), nunca), true);
  assert.equal(fueraDeHorario(A_LAS(15), nunca), true);
  // Y la que cruza la medianoche funciona como se lee: de 20 a 4.
  const nocturna = { ...CONFIG, hora_desde: 20, hora_hasta: 4 };
  assert.equal(fueraDeHorario(A_LAS(21), nocturna), false);
  assert.equal(fueraDeHorario(A_LAS(2), nocturna), false);
  assert.equal(fueraDeHorario(A_LAS(12), nocturna), true);
});

test('§8.1 · el freno por aviso de LinkedIn no se levanta antes de tiempo', () => {
  const frenada = cuenta({ id: 'c1', cooldown_hasta: hace(-360) });
  assert.equal(enCooldown(frenada, AHORA), true);
  assert.equal(enCooldown(cuenta({ id: 'c1', cooldown_hasta: hace(60) }), AHORA), false);
  assert.equal(enCooldown(cuenta({ id: 'c1' }), AHORA), false);
  // Una fecha ilegible NO levanta el freno: ante la duda, la opción cara es
  // dejar operar.
  assert.equal(enCooldown(cuenta({ id: 'c1', cooldown_hasta: 'cualquier cosa' }), AHORA), true);

  assert.equal(
    porQueNoInvita(frenada, [lista({ id: 'a' })], 0, CONFIG, false, AHORA)?.freno,
    'cooldown',
  );
});

test('§7.3 · la pausa general vale para el proceso, no sólo para la pantalla', () => {
  const imp = porQueNoInvita(cuenta({ id: 'c1' }), [lista({ id: 'a' })], 0, CONFIG, true, AHORA);
  assert.equal(imp?.freno, 'pausa_general');
});

test('§8.1 · los frenos salen en orden: lo que no se discute, primero', () => {
  // Una cuenta con TODO mal a la vez tiene que decir «en pausa», no «sin
  // material»: arreglar el material no la hace arrancar.
  const rota = cuenta({
    id: 'c1',
    ultima_senal_li: null,
    chrome_perfil: '',
    cupo_diario: 0,
    cooldown_hasta: hace(-360),
  });
  assert.equal(porQueNoInvita(rota, [], 0, CONFIG, true, A_LAS(3))?.freno, 'pausa_general');
  assert.equal(porQueNoInvita(rota, [], 0, CONFIG, false, A_LAS(3))?.freno, 'cooldown');
  assert.equal(
    porQueNoInvita({ ...rota, cooldown_hasta: null }, [], 0, CONFIG, false, A_LAS(3))?.freno,
    'fuera_de_horario',
  );
  assert.equal(
    porQueNoInvita({ ...rota, cooldown_hasta: null }, [], 0, CONFIG, false, AHORA)?.freno,
    'sin_vincular',
  );
});

// ---------------------------------------------------------------------------
// §13.6 · Un solo planificador por cuenta
// ---------------------------------------------------------------------------

test('§13.6 · le toca a UNA cuenta por vez, en el orden en que vienen', () => {
  const cuentas = [
    cuenta({ id: 'c1', ultima_senal_li: null }), // sin vincular
    cuenta({ id: 'c2' }),
    cuenta({ id: 'c3' }),
  ];
  const listas = new Map([
    ['c1', [lista({ id: 'a', cuenta: 'c1' })]],
    ['c2', [lista({ id: 'b', cuenta: 'c2' })]],
    ['c3', [lista({ id: 'c', cuenta: 'c3' })]],
  ]);
  const turnos = turnoDeInvitaciones(cuentas, listas, new Map(), CONFIG, false, AHORA);

  // Devuelve las tres, también la frenada: sin eso no hay forma de contestar
  // por qué una cuenta no salió.
  assert.equal(turnos.length, 3);
  assert.equal(turnos[0].impedimento?.freno, 'sin_vincular');
  assert.equal(turnos[0].cuantas, 0);

  const toca = aQuienLeToca(turnos);
  assert.equal(toca?.cuenta, 'c2');
  assert.equal(toca?.lista?.id, 'b');
});

test('§13.6 · si no le toca a nadie, se dice que no le toca a nadie', () => {
  const turnos = turnoDeInvitaciones([cuenta({ id: 'c1' })], new Map(), new Map(), CONFIG, false, AHORA);
  assert.equal(aQuienLeToca(turnos), null);
});

// ---------------------------------------------------------------------------
// §8.1 · El ritmo (mitigación 4: «intervalos irregulares, nunca en ráfaga»)
// ---------------------------------------------------------------------------

test('§8.1 · el tope por corrida corta, y corta antes que cualquier otra cosa', () => {
  const c = { ...CONFIG, tope_por_corrida: 40 };
  assert.equal(ritmoDespuesDe(39, c).cortar, false);
  const r = ritmoDespuesDe(40, c);
  assert.equal(r.cortar, true);
  // Con el tope alcanzado no se dice cuánto esperar para la siguiente: no hay
  // siguiente. 40 también es múltiplo de 40 (reinicio) y de 10 (pre-bloqueo).
  assert.deepEqual(r, { cortar: true, esperaMs: 0, pausas: [], resetNavegador: false, mirarPreBloqueo: false });
});

test('§8.1 · la espera entre una y otra sale del rango configurado', () => {
  const c = { ...CONFIG, espera_min_s: 3, espera_max_s: 9 };
  assert.equal(ritmoDespuesDe(1, c, { ...AZAR_MEDIO, espera: 0 }).esperaMs, 3000);
  assert.equal(ritmoDespuesDe(1, c, { ...AZAR_MEDIO, espera: 1 }).esperaMs, 9000);
  assert.equal(ritmoDespuesDe(1, c, AZAR_MEDIO).esperaMs, 6000);
  // Y cambiar la configuración cambia la espera: si no, los números de la
  // pantalla serían decorativos.
  assert.equal(ritmoDespuesDe(1, { ...c, espera_min_s: 20, espera_max_s: 20 }, AZAR_MEDIO).esperaMs, 20000);
});

test('§8.1 · pausa media cada 30, larga cada 50, y las dos juntas cuando caen juntas', () => {
  const c = CONFIG;
  assert.deepEqual(ritmoDespuesDe(29, c).pausas, []);
  assert.deepEqual(
    ritmoDespuesDe(30, c, AZAR_MEDIO).pausas.map((p) => p.tipo),
    ['media'],
  );
  assert.deepEqual(
    ritmoDespuesDe(50, { ...c, tope_por_corrida: 0 }, AZAR_MEDIO).pausas.map((p) => p.tipo),
    ['larga'],
  );
  // A las 150 caen las dos. Salen las dos: hacerlo más corto acá sería aflojar
  // una medida anti-detección sin ninguna razón nueva.
  assert.deepEqual(
    ritmoDespuesDe(150, { ...c, tope_por_corrida: 0 }, AZAR_MEDIO).pausas.map((p) => p.tipo),
    ['media', 'larga'],
  );
  // Y la pausa media del medio del rango 90–180 son 135 s.
  assert.equal(ritmoDespuesDe(30, c, AZAR_MEDIO).pausas[0].ms, 135_000);
});

test('§8.1 · en cero no hay pausa ni reinicio: todavía no pasó nada', () => {
  const r = ritmoDespuesDe(0, CONFIG);
  assert.deepEqual(r.pausas, []);
  assert.equal(r.resetNavegador, false);
  assert.equal(r.mirarPreBloqueo, false);
});

test('§8.1 · el navegador se reinicia cada 40 y el pre-bloqueo se mira cada 10', () => {
  const c = { ...CONFIG, tope_por_corrida: 0 }; // sin tope, para llegar a 40
  assert.equal(ritmoDespuesDe(40, c).resetNavegador, true);
  assert.equal(ritmoDespuesDe(80, c).resetNavegador, true);
  assert.equal(ritmoDespuesDe(41, c).resetNavegador, false);
  assert.equal(ritmoDespuesDe(10, c).mirarPreBloqueo, true);
  assert.equal(ritmoDespuesDe(11, c).mirarPreBloqueo, false);
  // Un cero en la configuración apaga la medida en vez de dividir por cero.
  assert.equal(ritmoDespuesDe(40, { ...c, reset_navegador_cada: 0 }).resetNavegador, false);
});

test('§8.1 · que LinkedIn conteste muy rápido es mala señal, y se espera MÁS', () => {
  assert.equal(factorDeEspera(null, 0.5), 1);
  assert.equal(factorDeEspera(0, 0.5), 1);
  assert.equal(factorDeEspera(300, 0), 1.5); // sospechosamente rápido
  assert.equal(factorDeEspera(300, 1), 2.0);
  assert.equal(factorDeEspera(1200, 0.5), 1); // normal
  assert.equal(factorDeEspera(3000, 0), 0.75); // lento natural: se aprovecha
  assert.equal(factorDeEspera(9000, 0), 2.0); // estrangulamiento: frenar mucho
  assert.equal(factorDeEspera(9000, 1), 3.0);

  // Y el factor llega hasta la espera de verdad, no se queda en una función suelta.
  const c = { ...CONFIG, espera_min_s: 4, espera_max_s: 4 };
  assert.equal(ritmoDespuesDe(1, c, { espera: 0.5, pausa: 0.5, latencia: 0 }, 9000).esperaMs, 8000);
  assert.equal(ritmoDespuesDe(1, c, AZAR_MEDIO, 1200).esperaMs, 4000);
});

test('§8.1 · el navegador se abre y no hace nada durante unos segundos', () => {
  assert.equal(esperaDeArranqueMs(CONFIG, { ...AZAR_MEDIO, espera: 0 }), 10_000);
  assert.equal(esperaDeArranqueMs(CONFIG, { ...AZAR_MEDIO, espera: 1 }), 20_000);
});

// ---------------------------------------------------------------------------
// §8.1 · Cuando LinkedIn avisa
// ---------------------------------------------------------------------------

test('§8.1 · el aviso de automatización frena 72 h y deja TODO en pausa', () => {
  const f = frenoPorAviso('automatizacion', CONFIG, 'FR', INSTANTE);
  assert.equal(f.cooldown_hasta, '2026-09-13T12:00:00.000Z');
  assert.equal(f.pausa_general, true);
  assert.match(f.motivo, /misma IP/);
});

test('§8.1 · la gravedad del aviso cambia el freno, no es un solo número', () => {
  assert.equal(frenoPorAviso('captcha', CONFIG, 'FR', INSTANTE).cooldown_hasta, '2026-09-11T12:00:00.000Z');
  assert.equal(frenoPorAviso('captcha', CONFIG, 'FR', INSTANTE).pausa_general, false);
  assert.equal(frenoPorAviso('actividad_inusual', CONFIG, 'FR', INSTANTE).pausa_general, false);
  // Una semana entera por cuenta restringida: es la que puede no volver.
  assert.equal(frenoPorAviso('restringida', CONFIG, 'FR', INSTANTE).cooldown_hasta, '2026-09-17T12:00:00.000Z');
  assert.equal(frenoPorAviso('restringida', CONFIG, 'FR', INSTANTE).pausa_general, true);
});

// ---------------------------------------------------------------------------
// §3.4 · La página es dato de la automatización
// ---------------------------------------------------------------------------

test('§3.4 · la página avanza con la corrida y nunca se pasa del total', () => {
  const l = lista({ id: 'a', pagina: 7, paginas: 10 });
  assert.equal(paginaAlTerminar(l, 2), 9);
  assert.equal(paginaAlTerminar(l, 0), 7);
  // «Página 41 de 40» se ve como un error de la base y manda a revisar la base.
  assert.equal(paginaAlTerminar(l, 99), 10);
  assert.equal(paginaAlTerminar(l, -3), 7);
});

// ---------------------------------------------------------------------------
// La semilla está escrita dos veces. Esto impide que se separen.
// ---------------------------------------------------------------------------

test('§8.1 · la semilla de la base y la de core son la misma', () => {
  // `CONFIG_INVITAR_INICIAL` vive en TypeScript y la migración que la siembra
  // en `configuracion` tiene que repetirla en JavaScript plano: el motor JS de
  // PocketBase no carga TypeScript y las migraciones no tienen paso de build.
  // Es el mismo caso que el espejo de `pb_hooks/google.js`.
  //
  // Sin esto, alguien sube el tope en core, la base sigue con el viejo, y el
  // que corre en producción es el de la base.
  const ruta = path.resolve(
    import.meta.dirname,
    '../../db/pb_migrations/1788608000_ritmo_de_invitaciones.js',
  );
  const fuente = fs.readFileSync(ruta, 'utf8');
  const desde = fuente.indexOf('const RITMO_INICIAL = ');
  assert.ok(desde >= 0, 'la migración ya no declara RITMO_INICIAL: el espejo cambió de nombre');
  const abre = fuente.indexOf('{', desde);
  const cierra = fuente.indexOf('\n};', abre);
  assert.ok(cierra > abre, 'no se pudo delimitar el bloque JSON de la migración');

  const semilla = JSON.parse(fuente.slice(abre, cierra + 2));
  assert.deepEqual(semilla, CONFIG_INVITAR_INICIAL);
});
