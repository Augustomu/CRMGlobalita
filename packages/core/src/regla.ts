// Reglas y acciones rápidas (§7.9): «si pasa esto, y se cumple aquello,
// entonces hacé esto».
//
// Este módulo DEFINE las reglas; no las corre. Ejecutarlas es del worker
// (bloque de integraciones), y tiene que ser el mismo modelo de datos para que
// lo que se ve acá sea lo que efectivamente pasa.

export type Disparador =
  | 'se agrega una etiqueta'
  | 'el lead responde'
  | 'la reunión queda en no asistió'
  | 'N días sin actividad'
  | 'entra un lead nuevo';

export type Condicion = 'sin condición' | 'de una cuenta' | 'de un país' | 'en una etapa';

export type Accion =
  | 'fijar próximo contacto'
  | 'cambiar la etapa'
  | 'asignar a un colaborador'
  | 'cargar mensaje a la cola'
  | 'crear una tarea';

export const DISPARADORES: Disparador[] = [
  'se agrega una etiqueta',
  'el lead responde',
  'la reunión queda en no asistió',
  'N días sin actividad',
  'entra un lead nuevo',
];

export const CONDICIONES: Condicion[] = ['sin condición', 'de una cuenta', 'de un país', 'en una etapa'];

export const ACCIONES: Accion[] = [
  'fijar próximo contacto',
  'cambiar la etapa',
  'asignar a un colaborador',
  'cargar mensaje a la cola',
  'crear una tarea',
];

export interface Regla {
  id: string;
  nombre: string;
  disparador: string;
  /** Vacío = sin condición. */
  condicion: string;
  accion: string;
  activa: boolean;
  /**
   * De fábrica: describe algo que el sistema YA hace y que está implementado en
   * el código, no en el motor de reglas.
   */
  de_fabrica: boolean;
  /** Cuántas veces corrió. Lo escribe el worker. */
  /**
   * Cuántas veces corrió ESTA SEMANA (§3.8: `corridas_semana`).
   *
   * El total acumulado no dice nada: una regla que corrió 4.000 veces desde
   * marzo y ninguna desde el lunes se ve igual de viva que una que corre todos
   * los días. Lo que se quiere saber es si está funcionando ahora.
   */
  corridas_semana?: number;
}

/**
 * Las dos reglas que el sistema ya cumple hoy, escritas como reglas.
 *
 * NO son configuración disfrazada: están en `cadencia.ts` y en `envio.ts` con
 * sus tests. Aparecen acá porque el usuario no tiene por qué saber cuáles
 * están cableadas y cuáles no — desde el panel se ven todas las
 * automatizaciones que existen, y ésas dos además se pueden apagar.
 */
export const DE_FABRICA: Omit<Regla, 'activa' | 'corridas_semana'>[] = [
  {
    id: 'sugerir-proximo-r',
    nombre: 'Etiqueta «Contacto» sugiere el próximo R',
    disparador: 'el lead tiene la etiqueta Contacto',
    condicion: 'sin Reunión, Esperando confirmación ni Aprobación del equipo',
    accion: 'muestra en el chat el próximo R que toca enviar (todas las cuentas)',
    de_fabrica: true,
  },
  {
    id: 'etiqueta-recordatorio',
    nombre: 'Enviar un R agrega «Recordatorio»',
    disparador: 'se envía cualquiera de los R0–R8',
    condicion: '',
    accion: 'agrega la etiqueta Recordatorio si todavía no la tiene',
    de_fabrica: true,
  },
];

/**
 * Una regla de fábrica se puede APAGAR pero no borrar.
 *
 * Borrarla dejaría un sistema que sigue haciendo algo que ya no figura en
 * ningún lado: el comportamiento vive en el código, y la fila es la única
 * forma de enterarse de que existe.
 */
export function sePuedeBorrar(r: Regla): boolean {
  return !r.de_fabrica;
}

/** Lo que falta para poder crear la regla. Vacío = está lista. */
export function queFalta(borrador: { nombre: string; disparador: string | null; accion: string | null }): string[] {
  const faltan: string[] = [];
  if (!borrador.nombre.trim()) faltan.push('el nombre');
  if (!borrador.disparador) faltan.push('el disparador');
  if (!borrador.accion) faltan.push('la acción');
  return faltan;
}

/** «Si se agrega una etiqueta y el lead es de una cuenta, entonces crear una tarea.» */
export function describir(r: Pick<Regla, 'disparador' | 'condicion' | 'accion'>): string {
  const cond = r.condicion && r.condicion !== 'sin condición' ? ` y ${r.condicion}` : '';
  return `Si ${r.disparador}${cond}, entonces ${r.accion}.`;
}

/** Las tres automatizaciones alrededor de la reunión (§5.11). */
export interface ReglasDeReunion {
  confirmacion_24h: boolean;
  aviso_90min: boolean;
  agradecimiento: boolean;
  /**
   * Horas antes para el recordatorio extra. 0 = ninguno.
   *
   * Es UN valor y no una lista de avisos: dos recordatorios el mismo día para
   * la misma reunión se leen como un error del sistema, no como atención.
   */
  recordatorio_extra_h: number;
}

export const REUNION_POR_DEFECTO: ReglasDeReunion = {
  confirmacion_24h: true,
  aviso_90min: true,
  agradecimiento: true,
  recordatorio_extra_h: 3,
};

export const HORAS_RECORDATORIO = [0, 2, 3, 4];

/** «2 de 3 activas» */
export function resumen(reglas: Regla[]): string {
  return `${reglas.filter((r) => r.activa).length} de ${reglas.length} activas`;
}
