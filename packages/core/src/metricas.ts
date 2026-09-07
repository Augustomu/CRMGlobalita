// El dashboard de reuniones (anexo Control §4.2). Todo puro: recibe las
// reuniones ya leídas y devuelve lo que se dibuja.
//
// Es lo único del CRM que mira hacia atrás en vez de hacia adelante, y es lo
// que ve el Observador: no le interesa la prospección, le interesa cuántas
// reuniones salieron, con quién, y cuántas derivaron en un proyecto.

import { enSuZona } from './reunion.ts';

export type EstadoReunion = 'pendiente' | 'asistio' | 'no-asistio' | 'cancelada' | 'reagendada';

export interface ReunionMedida {
  id: string;
  /**
   * Instante como lo devuelve la base, que es UTC. La hora y la fecha que
   * valen son las de `zona`: por eso nada lee este campo directamente, todo
   * pasa por `fechaLocal` y `horaLocal`.
   */
  inicio: string;
  /** Zona en la que ocurrio la reunion (D23). */
  zona: string;
  duracion_min: number;
  estado: EstadoReunion;
  /** Con quién. */
  nombre: string;
  cargo: string;
  empresa: string;
  pais: string;
  ciudad: string;
  industria: string;
  /** Cuenta de invitación que la generó (AL, DL…). */
  cuenta: string;
  /** Quién la agendó. */
  genero: string;
  nota: string;
  /** Id del proyecto al que derivó, si derivó. */
  proyecto: string;
}


/**
 * El reloj de pared de la reunion. TODO lo que se agrupa o se corta por fecha
 * pasa por aca: la base guarda en UTC y una reunion de la tarde en America
 * aparece al dia siguiente si se lee el texto crudo.
 */
function local(r: ReunionMedida): string {
  return enSuZona(r.inicio, r.zona);
}

/** La fecha en que ocurrio, para quien la tuvo. */
export function fechaLocal(r: ReunionMedida): string {
  return local(r).slice(0, 10);
}

/** La hora en que ocurrio, para quien la tuvo. */
export function horaLocal(r: ReunionMedida): string {
  return local(r).slice(11, 16);
}

export type Rango = '1m' | '3m' | '6m';

export const MESES_DE: Record<Rango, number> = { '1m': 1, '3m': 3, '6m': 6 };

export const NOMBRE_RANGO: Record<Rango, string> = {
  '1m': 'Último mes',
  '3m': '3 meses',
  '6m': '6 meses',
};

/** El primer día del período. `hoy` es ISO corto. */
export function desdeDe(rango: Rango, hoy: string): string {
  const d = new Date(`${hoy}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - MESES_DE[rango]);
  return d.toISOString().slice(0, 10);
}

/**
 * Las reuniones del período.
 *
 * El corte de arriba es hoy: una reunión futura ya agendada no cuenta en las
 * métricas del período, porque todavía no pasó y contarla inflaría la
 * conversión con algo que no ocurrió.
 */
export function delPeriodo(reuniones: ReunionMedida[], rango: Rango, hoy: string): ReunionMedida[] {
  const desde = desdeDe(rango, hoy);
  return reuniones
    .filter((r) => {
      const f = fechaLocal(r);
      return f >= desde && f <= hoy;
    })
    .sort((a, b) => local(a).localeCompare(local(b)));
}

export interface Tarjetas {
  total: number;
  asistieron: number;
  /** % sobre el total, entero. */
  pct_asistieron: number;
  no_asistio: number;
  reagendadas: number;
  con_proyecto: number;
  /** % de reuniones que terminaron en proyecto. */
  conversion: number;
  empresas: number;
  /** Promedio por semana, con un decimal. */
  por_semana: number;
}

function pct(parte: number, total: number): number {
  return total ? Math.round((parte / total) * 100) : 0;
}

/** Las ocho tarjetas de §4.2. */
export function tarjetas(reuniones: ReunionMedida[], rango: Rango): Tarjetas {
  const total = reuniones.length;
  const asistieron = reuniones.filter((r) => r.estado === 'asistio').length;
  const con_proyecto = reuniones.filter((r) => r.proyecto).length;
  const semanas = (MESES_DE[rango] * 30.44) / 7;

  return {
    total,
    asistieron,
    pct_asistieron: pct(asistieron, total),
    no_asistio: reuniones.filter((r) => r.estado === 'no-asistio').length,
    reagendadas: reuniones.filter((r) => r.estado === 'reagendada').length,
    con_proyecto,
    conversion: pct(con_proyecto, total),
    empresas: new Set(reuniones.map((r) => r.empresa.trim().toLowerCase()).filter(Boolean)).size,
    por_semana: Math.round((total / semanas) * 10) / 10,
  };
}

export interface BarraMes {
  /** `2026-08` */
  mes: string;
  /** `ago` */
  label: string;
  total: number;
  con_proyecto: number;
}

const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * Una barra por mes del período, incluidos los meses sin reuniones.
 *
 * Saltearse los meses vacíos haría ver una racha continua donde hubo un
 * parate, que es justo lo que el gráfico tiene que mostrar.
 */
export function porMes(reuniones: ReunionMedida[], rango: Rango, hoy: string): BarraMes[] {
  const cuenta = new Map<string, { total: number; con_proyecto: number }>();

  const desde = new Date(`${desdeDe(rango, hoy)}T00:00:00Z`);
  const hasta = new Date(`${hoy}T00:00:00Z`);
  for (let d = new Date(desde); d <= hasta; d.setUTCMonth(d.getUTCMonth() + 1)) {
    cuenta.set(d.toISOString().slice(0, 7), { total: 0, con_proyecto: 0 });
  }
  cuenta.set(hoy.slice(0, 7), cuenta.get(hoy.slice(0, 7)) ?? { total: 0, con_proyecto: 0 });

  for (const r of reuniones) {
    const mes = fechaLocal(r).slice(0, 7);
    const c = cuenta.get(mes) ?? { total: 0, con_proyecto: 0 };
    c.total++;
    if (r.proyecto) c.con_proyecto++;
    cuenta.set(mes, c);
  }

  return [...cuenta.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([mes, c]) => ({
      mes,
      label: MES_CORTO[Number(mes.slice(5, 7)) - 1] ?? mes,
      ...c,
    }));
}

export type Agrupador =
  | 'pais' | 'ciudad' | 'industria' | 'cargo' | 'empresa'
  | 'cuenta' | 'genero' | 'estado' | 'dia_semana' | 'franja';

export const NOMBRE_AGRUPADOR: Record<Agrupador, string> = {
  pais: 'País',
  ciudad: 'Ciudad',
  industria: 'Industria',
  cargo: 'Rol',
  empresa: 'Empresa',
  cuenta: 'Cuenta',
  genero: 'Quién la generó',
  estado: 'Estado',
  dia_semana: 'Día de la semana',
  franja: 'Franja horaria',
};

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/**
 * Franjas de §4.2. Reciben el reloj de pared, no el instante: la reunión fue a
 * media mañana para quien la tuvo, y la hora UTC la mandaría a otra franja.
 */
function franjaDe(relojDePared: string): string {
  const h = Number(relojDePared.slice(11, 13));
  if (Number.isNaN(h)) return 'sin hora';
  if (h >= 8 && h < 11) return 'mañana (8–11)';
  if (h >= 11 && h < 14) return 'mediodía (11–14)';
  if (h >= 14 && h < 17) return 'tarde (14–17)';
  if (h >= 17 && h < 20) return 'última hora (17–20)';
  return 'fuera de horario';
}

function valorDe(r: ReunionMedida, por: Agrupador): string {
  if (por === 'dia_semana') {
    const d = new Date(fechaLocal(r) + 'T12:00:00Z');
    return DIAS[d.getUTCDay()] ?? 'sin fecha';
  }
  if (por === 'franja') return franjaDe(local(r));
  return (r[por] || '').trim();
}

export interface Grupo {
  label: string;
  n: number;
  pct: number;
}

/**
 * Barras horizontales del agrupador (§4.2).
 *
 * Criterio de aceptación 6: los conteos suman el total del período. Por eso las
 * reuniones sin dato entran como "sin dato" en vez de descartarse — si se
 * cayeran, la suma no cerraría y no habría forma de notarlo mirando.
 */
export function agrupar(reuniones: ReunionMedida[], por: Agrupador): Grupo[] {
  const cuenta = new Map<string, number>();
  for (const r of reuniones) {
    const v = valorDe(r, por) || 'sin dato';
    cuenta.set(v, (cuenta.get(v) ?? 0) + 1);
  }

  return [...cuenta.entries()]
    .map(([label, n]) => ({ label, n, pct: pct(n, reuniones.length) }))
    .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label));
}

export interface AlPie {
  promedio_mes: number;
  mejor_mes: string;
  duracion_promedio: number;
}

/** Lo que va al pie del gráfico. */
export function alPie(reuniones: ReunionMedida[], barras: BarraMes[]): AlPie {
  const mejor = [...barras].sort((a, b) => b.total - a.total)[0];
  const conDuracion = reuniones.filter((r) => r.duracion_min > 0);

  return {
    promedio_mes: barras.length
      ? Math.round((reuniones.length / barras.length) * 10) / 10
      : 0,
    mejor_mes: mejor && mejor.total ? `${mejor.label} (${mejor.total})` : '—',
    duracion_promedio: conDuracion.length
      ? Math.round(conDuracion.reduce((s, r) => s + r.duracion_min, 0) / conDuracion.length)
      : 0,
  };
}
