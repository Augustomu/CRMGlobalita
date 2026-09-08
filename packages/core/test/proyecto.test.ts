import test from 'node:test';
import assert from 'node:assert/strict';
import {
  casaDeLinea,
  casaSugerida,
  estadoEfectivo,
  NOMBRE_TIPO,
  proximaAccion,
  proyectoDesdeLead,
  tiraDeAvance,
  TIPOS_VIGENTES,
  ultimaActualizacion,
  ultimaReunion,
  ultimoMovimiento,
  type Proyecto,
  type ReunionDelProyecto,
} from '../src/proyecto.ts';

const HOY = '2026-09-04'; // fecha de referencia del prototipo

const p = (x: Partial<Proyecto> = {}): Proyecto => ({
  id: 'p1', lead: 'l1', nombre: 'Fabript/PIV para Vale', empresa: 'Vale',
  tipo: 'fabript_piv', casa: 'globalita', estado: 'en_conversacion',
  pais: 'Brasil', ciudad: 'Belo Horizonte', industria: 'Minería',
  rol_contacto: 'Gerente', contacto: 'Marcelo Carneiro',
  abierto: '2026-08-01', nota_lead: '',
  notas: [], updates: [], acciones: [],
  ...x,
});

/**
 * Una reunion como la devuelve la base: instante UTC + zona. Se le pone hora
 * de media manana para que la conversion no la corra de dia — que es lo que
 * pasa de verdad y tiene su propio test al final.
 */
const r = (dia: string, estado: ReunionDelProyecto['estado'] = 'asistio'): ReunionDelProyecto => ({
  id: 'r' + dia,
  inicio: dia.includes(':') ? dia : `${dia} 16:00:00.000Z`,
  zona: 'America/Mexico_City',
  estado,
});

// --------------------------------------------------------------- congelado

test('§3.1 · más de 30 días sin movimiento congela sin que nadie lo toque', () => {
  const viejo = p({ abierto: '2026-06-01', updates: [{ fecha: '2026-07-01', texto: 'x' }] });
  assert.equal(estadoEfectivo(viejo, [], HOY), 'congelado');
});

test('§3.1 · cargar una actualización lo saca de Congelado', () => {
  // No hace falta recordar el estado anterior: al derivar Congelado del último
  // movimiento, la actualización descongela sola y el estado real sigue ahí.
  const antes = p({ estado: 'nuestra_pelota', updates: [{ fecha: '2026-07-01', texto: 'x' }] });
  assert.equal(estadoEfectivo(antes, [], HOY), 'congelado');

  const despues = { ...antes, updates: [...antes.updates, { fecha: HOY, texto: 'llamamos' }] };
  assert.equal(estadoEfectivo(despues, [], HOY), 'nuestra_pelota');
});

test('§3.2 · los cerrados son terminales: no se congelan solos', () => {
  const ganado = p({ estado: 'cerrado_ganado', abierto: '2026-01-01' });
  assert.equal(estadoEfectivo(ganado, [], HOY), 'cerrado_ganado');
  const perdido = p({ estado: 'cerrado_perdido', abierto: '2026-01-01' });
  assert.equal(estadoEfectivo(perdido, [], HOY), 'cerrado_perdido');
});

test('§3.1 · una reunión también es movimiento', () => {
  const sinNotas = p({ abierto: '2026-06-01' });
  assert.equal(estadoEfectivo(sinNotas, [], HOY), 'congelado');
  assert.equal(estadoEfectivo(sinNotas, [r('2026-09-01')], HOY), 'en_conversacion');
});

test('una acción pendiente NO descongela: es algo que todavía no pasó', () => {
  const conIntencion = p({
    abierto: '2026-06-01',
    acciones: [{ fecha: '2026-09-30', texto: 'mandar propuesta' }],
  });
  assert.equal(estadoEfectivo(conIntencion, [], HOY), 'congelado');
});

test('justo en el día 30 todavía no está congelado', () => {
  const limite = p({ updates: [{ fecha: '2026-08-05', texto: 'x' }] });
  assert.equal(ultimoMovimiento(limite, []), '2026-08-05');
  assert.equal(estadoEfectivo(limite, [], '2026-09-04'), 'en_conversacion'); // 30 días
  assert.equal(estadoEfectivo(limite, [], '2026-09-05'), 'congelado'); // 31
});

// ----------------------------------------------------------- última reunión

test('criterio 3 · nunca dice "sin reuniones" si el conteo es mayor a cero', () => {
  const futura = ultimaReunion([r('2026-09-20', 'pendiente')], HOY);
  assert.equal(futura.total, 1);
  assert.notEqual(futura.detalle, 'sin reuniones');
  assert.equal(futura.detalle, 'programada 20/09');
  assert.equal(futura.fecha, '—');
});

test('con reuniones pasadas se muestra la más reciente y su estado', () => {
  const u = ultimaReunion([r('2026-08-10'), r('2026-08-28', 'no-asistio'), r('2026-09-20', 'pendiente')], HOY);
  assert.equal(u.fecha, '2026-08-28');
  assert.equal(u.detalle, 'no-asistio');
  assert.equal(u.total, 3);
});

test('sin ninguna reunión sí dice "sin reuniones"', () => {
  assert.deepEqual(ultimaReunion([], HOY), { fecha: '', detalle: 'sin reuniones', total: 0 });
});

// -------------------------------------------------------- tira de avance

test('criterio 4 · primero las acciones, después updates y notas, más nuevo primero', () => {
  const con = p({
    notas: [{ fecha: '2026-08-02', texto: 'nota vieja' }],
    updates: [
      { fecha: '2026-08-10', texto: 'update viejo' },
      { fecha: '2026-09-01', texto: 'update nuevo' },
    ],
    acciones: [
      { fecha: '2026-09-10', texto: 'accion b' },
      { fecha: '2026-09-06', texto: 'accion a' },
      { fecha: '2026-08-01', texto: 'ya hecha', hecha: true },
    ],
  });

  assert.deepEqual(
    tiraDeAvance(con).map((i) => [i.tipo, i.texto]),
    [
      ['accion', 'accion a'],
      ['accion', 'accion b'],
      ['update', 'update nuevo'],
      ['update', 'update viejo'],
      ['nota', 'nota vieja'],
    ],
  );
});

test('la próxima acción es la primera pendiente por fecha', () => {
  const con = p({
    acciones: [
      { fecha: '2026-09-10', texto: 'segunda' },
      { fecha: '2026-09-01', texto: 'ya está', hecha: true },
      { fecha: '2026-09-05', texto: 'primera' },
    ],
  });
  assert.equal(proximaAccion(con)?.texto, 'primera');
  assert.equal(proximaAccion(p()), null);
});

// --------------------------------------------------- abrir desde el lead

test('§6 · abrir desde la ficha copia los datos y arranca En conversación', () => {
  const nuevo = proyectoDesdeLead(
    {
      id: 'l9', contacto: 'Marcelo Carneiro', empresa: 'Vale', pais: 'Brasil',
      ciudad: 'Belo Horizonte', industria: 'Minería', rol_contacto: 'Gerente',
      cuenta: 'c1', responsable: 'u1', nota: 'Pidió la propuesta por mail.',
    },
    'fabript_piv',
    HOY,
  );

  assert.equal(nuevo.nombre, 'Fabript/PIV para Vale');
  assert.equal(nuevo.estado, 'en_conversacion');
  assert.equal(nuevo.lead, 'l9');
  assert.equal(nuevo.nota_lead, 'Pidió la propuesta por mail.');
  assert.equal(nuevo.abierto, HOY);
  // Criterio 7: nace con su primer registro de actualización.
  assert.equal((nuevo.updates as unknown[]).length, 1);
});

test('§6 · la parcería se nombra distinto', () => {
  const nuevo = proyectoDesdeLead(
    {
      id: 'l9', contacto: 'Ana', empresa: 'Klume', pais: '', ciudad: '',
      industria: '', rol_contacto: '', cuenta: '', responsable: '', nota: '',
    },
    'parceria',
    HOY,
  );
  assert.equal(nuevo.nombre, 'Parcería con Klume');
});

test('sin empresa el nombre no queda colgado', () => {
  const nuevo = proyectoDesdeLead(
    {
      id: 'l9', contacto: 'Ana Pérez', empresa: '', pais: '', ciudad: '',
      industria: '', rol_contacto: '', cuenta: '', responsable: '', nota: '',
    },
    'fabript_piv',
    HOY,
  );
  assert.equal(nuevo.nombre, 'Fabript/PIV para Ana Pérez');
});

test('D23 · una reunión de la tarde no figura al día siguiente', () => {
  // La base devuelve 00:00Z del 5 para una reunión de las 18:00 del 4 en
  // México. Sin convertir, la columna diría 05/09 y con `hoy` = 04/09 la
  // contaría como futura: programada al lado de una reunión que ya pasó.
  const u = ultimaReunion([r('2026-09-05 00:00:00.000Z')], HOY);
  assert.equal(u.fecha, '2026-09-04');
  assert.equal(u.detalle, 'asistio');
});

// ------------------------------------------------ la casa y la actualización
// Puesta al día contra el bundle del 07/09: la casa pasó al proyecto y la tira
// de avance se reemplazó por una columna con la última novedad.

test('la casa de un proyecto de inversión es Seng, venga de la cuenta que venga', () => {
  assert.equal(casaSugerida('inversion', 'ia'), 'seng');
  assert.equal(casaSugerida('inversion', null), 'seng');
});

test('para los otros tipos manda la cuenta por la que entró el lead', () => {
  assert.equal(casaSugerida('fabript_piv', 'inversiones'), 'seng');
  assert.equal(casaSugerida('parceria', 'ia'), 'globalita');
});

test('un proyecto sin cuenta —feria, referido— cae en Globalita, que es el de volumen', () => {
  assert.equal(casaSugerida('parceria', null), 'globalita');
  assert.equal(casaSugerida('', undefined), 'globalita');
});

test('«prototipo» ya no se ofrece, pero sigue teniendo nombre para las filas viejas', () => {
  assert.ok(!TIPOS_VIGENTES.includes('prototipo'));
  assert.equal(NOMBRE_TIPO.prototipo, 'Prototipo');
});

test('la columna Actualización muestra la novedad más nueva', () => {
  const proy = p({
    updates: [
      { fecha: '2026-08-01', texto: 'Primera charla' },
      { fecha: '2026-09-02', texto: 'Mandaron el pliego' },
      { fecha: '2026-08-20', texto: 'Pidieron material' },
    ],
  });
  assert.equal(ultimaActualizacion(proy)?.texto, 'Mandaron el pliego');
});

test('las notas NO son novedades del proyecto: son contexto sobre la persona', () => {
  const proy = p({
    updates: [{ fecha: '2026-08-01', texto: 'Primera charla' }],
    notas: [{ fecha: '2026-09-05', texto: 'Responde de noche' }],
  });
  assert.equal(ultimaActualizacion(proy)?.texto, 'Primera charla');
});

test('un proyecto recién abierto no tiene actualización, y eso no es un error', () => {
  assert.equal(ultimaActualizacion(p({ updates: [] })), null);
});

// §3.13 — los dos vocabularios de los mismos dos negocios.
test('la casa se traduce desde la linea de negocio de la cuenta', () => {
  assert.equal(casaDeLinea('ia'), 'globalita');
  assert.equal(casaDeLinea('inversiones'), 'seng');
  // Tolera lo que venga de la base: mayusculas, espacios.
  assert.equal(casaDeLinea(' IA '), 'globalita');
  // Y lo que no es ninguna de las dos no se adivina: sin casa, un destacado
  // por casa no se muestra, que es mejor que mostrar el de la otra empresa.
  assert.equal(casaDeLinea(''), null);
  assert.equal(casaDeLinea(null), null);
  assert.equal(casaDeLinea('otra'), null);
});
