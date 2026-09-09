import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  agrupar,
  alPie,
  delPeriodo,
  desdeDe,
  fechaLocal,
  horaLocal,
  porMes,
  tarjetas,
  type ReunionMedida,
} from '../src/metricas.ts';

const HOY = '2026-09-04';

const r = (x: Partial<ReunionMedida> & { inicio: string }): ReunionMedida => ({
  id: 'r' + x.inicio, zona: 'America/Sao_Paulo', duracion_min: 30, estado: 'asistio',
  nombre: 'Alguien', cargo: 'Gerente', empresa: 'Vale',
  pais: 'Brasil', ciudad: 'São Paulo', industria: 'Minería',
  cuenta: 'FR', genero: 'Francisco', nota: '', proyecto: '', linea: 'ia',
  ...x,
});

test('el período recorta por meses hacia atrás', () => {
  assert.equal(desdeDe('1m', HOY), '2026-08-04');
  assert.equal(desdeDe('3m', HOY), '2026-06-04');
  assert.equal(desdeDe('6m', HOY), '2026-03-04');
});

test('una reunión futura no cuenta: todavía no pasó', () => {
  // Contarla inflaría la conversión con algo que no ocurrió.
  const todas = [r({ inicio: '2026-08-20T10:00:00-03:00' }), r({ inicio: '2026-09-20T10:00:00-03:00' })];
  const dentro = delPeriodo(todas, '1m', HOY);
  assert.equal(dentro.length, 1);
  assert.equal(dentro[0]!.inicio.slice(0, 10), '2026-08-20');
});

test('§7.11.2 · las ocho tarjetas', () => {
  const rs = [
    r({ inicio: '2026-08-10T10:00:00-03:00', estado: 'asistio', proyecto: 'p1', empresa: 'Vale' }),
    r({ inicio: '2026-08-12T10:00:00-03:00', estado: 'asistio', empresa: 'Vale' }),
    r({ inicio: '2026-08-14T10:00:00-03:00', estado: 'no-asistio', empresa: 'Klume' }),
    r({ inicio: '2026-08-16T10:00:00-03:00', estado: 'reagendada', empresa: 'Ambar' }),
  ];
  const t = tarjetas(rs, '1m');

  assert.equal(t.total, 4);
  assert.equal(t.asistieron, 2);
  // Sobre las que CONSTAN (2 asistió + 1 no asistió), no sobre las 4: la
  // reagendada se movió de fecha, no es una reunión que ocurrió con un
  // resultado. Metida en el denominador bajaba la asistencia a 50%.
  assert.equal(t.constan, 3);
  assert.equal(t.pct_asistieron, 67);
  assert.equal(t.no_asistio, 1);
  assert.equal(t.sin_dato, 0);
  assert.equal(t.reagendadas, 1);
  assert.equal(t.con_proyecto, 1);
  // La conversión sí va sobre el total: la pregunta es cuántas de las que se
  // agendaron terminaron en trabajo.
  assert.equal(t.conversion, 25);
  assert.equal(t.empresas, 3); // Vale cuenta una vez
});

test('§7.11.2 · «sin dato» no se suma ni a asistió ni a no asistió', () => {
  // El caso del histórico recuperado: la reunión ocurrió y nadie registró el
  // resultado. Contarla de un lado o del otro es inventar.
  const rs = [
    r({ inicio: '2026-08-10T10:00:00-03:00', estado: 'asistio', empresa: 'Vale' }),
    r({ inicio: '2026-08-11T10:00:00-03:00', estado: 'sin_dato', empresa: 'Klume' }),
    r({ inicio: '2026-08-12T10:00:00-03:00', estado: 'sin_dato', empresa: 'Ambar' }),
    r({ inicio: '2026-08-13T10:00:00-03:00', estado: 'sin_dato', empresa: 'Ambar' }),
  ];
  const t = tarjetas(rs, '1m');

  assert.equal(t.total, 4);
  assert.equal(t.asistieron, 1);
  assert.equal(t.no_asistio, 0);
  assert.equal(t.sin_dato, 3);
  assert.equal(t.constan, 1);
  // 100% de la única que consta. Sobre el total daría 25%, que se leería como
  // «tres de cada cuatro faltaron» cuando de esas tres no se sabe nada.
  assert.equal(t.pct_asistieron, 100);
});

test('§7.11.2 · con todo sin dato, el porcentaje no inventa un cero', () => {
  const rs = [
    r({ inicio: '2026-08-10T10:00:00-03:00', estado: 'sin_dato', empresa: 'Vale' }),
    r({ inicio: '2026-08-11T10:00:00-03:00', estado: 'sin_dato', empresa: 'Klume' }),
  ];
  const t = tarjetas(rs, '1m');
  assert.equal(t.constan, 0);
  // Sin nada que medir el porcentaje es 0, y la pantalla lo dice mostrando
  // «0 de 0 que constan» en vez de un 0% suelto que parecería que nadie fue.
  assert.equal(t.pct_asistieron, 0);
  assert.equal(t.sin_dato, 2);
});

test('sin reuniones nada explota ni divide por cero', () => {
  const t = tarjetas([], '3m');
  assert.equal(t.total, 0);
  assert.equal(t.conversion, 0);
  assert.equal(t.pct_asistieron, 0);
  assert.equal(t.por_semana, 0);
});

test('el gráfico incluye los meses vacíos', () => {
  // Saltearlos haría ver una racha continua donde hubo un parate.
  const rs = [r({ inicio: '2026-07-10T10:00:00-03:00' })];
  const barras = porMes(rs, '3m', HOY);
  assert.deepEqual(barras.map((b) => b.mes), ['2026-06', '2026-07', '2026-08', '2026-09']);
  assert.deepEqual(barras.map((b) => b.total), [0, 1, 0, 0]);
});

test('la banda oscura son las que derivaron en proyecto', () => {
  const rs = [
    r({ inicio: '2026-08-10T10:00:00-03:00', proyecto: 'p1' }),
    r({ inicio: '2026-08-11T10:00:00-03:00' }),
  ];
  const agosto = porMes(rs, '1m', HOY).find((b) => b.mes === '2026-08')!;
  assert.equal(agosto.total, 2);
  assert.equal(agosto.con_proyecto, 1);
});

test('criterio 6 · agrupar por día de la semana suma el total', () => {
  const rs = [
    r({ inicio: '2026-08-10T10:00:00-03:00' }), // lunes
    r({ inicio: '2026-08-11T10:00:00-03:00' }), // martes
    r({ inicio: '2026-08-17T10:00:00-03:00' }), // lunes
  ];
  const g = agrupar(rs, 'dia_semana');
  assert.equal(g.reduce((s, x) => s + x.n, 0), 3);
  assert.equal(g[0]!.label, 'lunes');
  assert.equal(g[0]!.n, 2);
});

test('criterio 6 · agrupar por franja horaria suma el total', () => {
  const rs = [
    r({ inicio: '2026-08-10T09:00:00-03:00' }),
    r({ inicio: '2026-08-11T12:30:00-03:00' }),
    r({ inicio: '2026-08-12T15:00:00-03:00' }),
    r({ inicio: '2026-08-13T18:00:00-03:00' }),
  ];
  const g = agrupar(rs, 'franja');
  assert.equal(g.reduce((s, x) => s + x.n, 0), 4);
  assert.deepEqual(
    g.map((x) => x.label).sort(),
    ['mañana (8–11)', 'mediodía (11–14)', 'tarde (14–17)', 'última hora (17–20)'],
  );
});

test('D23 · la franja usa la hora de la zona, no la UTC que guarda la base', () => {
  // La base devuelve 13:00Z para una reunión de las 10:00 en Brasil. Leer el
  // texto crudo la mandaría a mediodía.
  const g = agrupar([r({ inicio: '2026-08-10 13:00:00.000Z' })], 'franja');
  assert.equal(g[0]!.label, 'mañana (8–11)');
});

test('D23 · una reunión de la tarde no se corre de día', () => {
  // 00:00Z del 15 es todavía el 14 a las 21:00 en Brasil: contarla en el 15
  // la pondría en el mes equivocado si cae en un fin de mes.
  const uno = r({ inicio: '2026-08-15 00:00:00.000Z' });
  assert.equal(fechaLocal(uno), '2026-08-14');
  assert.equal(horaLocal(uno), '21:00');
});

test('criterio 6 · lo que no tiene dato entra como "sin dato", no se cae', () => {
  const rs = [r({ inicio: '2026-08-10T10:00:00-03:00', pais: '' }), r({ inicio: '2026-08-11T10:00:00-03:00' })];
  const g = agrupar(rs, 'pais');
  assert.equal(g.reduce((s, x) => s + x.n, 0), 2);
  assert.ok(g.find((x) => x.label === 'sin dato'));
});

test('el pie del gráfico', () => {
  const rs = [
    r({ inicio: '2026-08-10T10:00:00-03:00', duracion_min: 30 }),
    r({ inicio: '2026-08-11T10:00:00-03:00', duracion_min: 60 }),
    r({ inicio: '2026-07-11T10:00:00-03:00', duracion_min: 45 }),
  ];
  const p = alPie(rs, porMes(rs, '3m', HOY));
  assert.equal(p.mejor_mes, 'ago (2)');
  assert.equal(p.duracion_promedio, 45);
});
