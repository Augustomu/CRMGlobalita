// Cuántos leads caen cada día, y cómo repartirlos.
//
// El próximo contacto de un lead no es una fecha cualquiera: es un día de
// trabajo. Si la cadencia empuja cuarenta leads al mismo martes, ese martes no
// se hace. Por eso el calendario de próximo contacto pinta la carga y los
// atajos corren la fecha cuando el día elegido ya está lleno.
//
// El tope se recibe como argumento y no vive acá: es configuración, no una
// constante (regla 2 del CLAUDE.md). El límite real depende de cuánta gente
// esté trabajando esa semana.

/** Lo que se muestra en el calendario. */
export type EstadoDelDia = 'libre' | 'cargado' | 'lleno';

/**
 * A partir de qué proporción del tope un día se marca «cargado».
 *
 * Es 0.6 y no 1 porque avisar recién cuando el día ya está lleno llega tarde:
 * para entonces la decisión de repartir ya se tomó mal. El ámbar existe para
 * que se elija otro día ANTES de llenarlo.
 */
export const UMBRAL_CARGADO = 0.6;

/** Cuántos días como máximo se corre un atajo buscando lugar. */
export const MAXIMO_CORRIMIENTO = 14;

export interface LeadConProximo {
  proximo_contacto?: string | null;
}

/**
 * Cuántos leads tienen su próximo contacto cada día.
 *
 * Los que no tienen fecha no cuentan: no son trabajo agendado para ningún día.
 */
export function cargaPorDia(leads: LeadConProximo[]): Record<string, number> {
  const carga: Record<string, number> = {};
  for (const l of leads) {
    const dia = String(l.proximo_contacto ?? '').slice(0, 10);
    if (!dia) continue;
    carga[dia] = (carga[dia] ?? 0) + 1;
  }
  return carga;
}

/** Cómo se pinta un día: verde, ámbar o rojo. */
export function estadoDelDia(cuantos: number, tope: number): EstadoDelDia {
  if (tope <= 0) return 'libre';
  if (cuantos >= tope) return 'lleno';
  return cuantos >= tope * UMBRAL_CARGADO ? 'cargado' : 'libre';
}

export interface FechaSugerida {
  /** El día que queda, ya corrido si hizo falta. */
  fecha: string;
  /** Cuántos días se tuvo que correr. 0 si el día ideal estaba libre. */
  corrimiento: number;
  /** True si se agotó la búsqueda y la fecha devuelta sigue llena. */
  sinLugar: boolean;
}

function sumarDias(iso: string, dias: number): string {
  // Mediodía para que ningún huso corra el día al convertir.
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/**
 * El día que proponen los atajos de 1 a 4 semanas.
 *
 * Busca el día exacto —hoy más N semanas— y, si está lleno, avanza de a un día
 * hasta encontrar lugar. Avanza hacia ADELANTE y nunca hacia atrás: adelantar
 * un contacto contra la cadencia es peor que demorarlo un par de días.
 *
 * Si en dos semanas de búsqueda no hay ningún día con lugar, devuelve el
 * último probado y lo marca: es preferible una fecha mala y visible a
 * quedarse sin fecha, y que esté lleno todo un mes es un problema de carga
 * que el sistema no puede resolver moviendo una fila.
 */
export function fechaConCupo(
  hoy: string,
  semanas: number,
  carga: Record<string, number>,
  tope: number,
): FechaSugerida {
  const ideal = sumarDias(hoy, semanas * 7);
  if (tope <= 0) return { fecha: ideal, corrimiento: 0, sinLugar: false };

  let corrimiento = 0;
  let fecha = ideal;
  while ((carga[fecha] ?? 0) >= tope && corrimiento < MAXIMO_CORRIMIENTO) {
    corrimiento++;
    fecha = sumarDias(hoy, semanas * 7 + corrimiento);
  }

  return {
    fecha,
    corrimiento,
    sinLugar: (carga[fecha] ?? 0) >= tope,
  };
}
