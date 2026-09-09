/**
 * Los huecos libres de un día de agenda (§7.6).
 *
 * POR QUÉ. La agenda de prospección no se mira para saber qué se hizo: se mira
 * para saber DÓNDE ENTRA la próxima reunión. Hasta ahora eso había que medirlo
 * a ojo entre dos bloques, y a ojo un hueco de 40 minutos y uno de 25 se ven
 * igual —pero en uno entra una reunión y en el otro no—.
 *
 * QUÉ CUENTA COMO OCUPADO: todo. Las reuniones del CRM, el almuerzo, la clase,
 * y los bloques de los otros administradores. El manual ya lo dice para el
 * panel de fecha (§7.6): «el hueco que sirve es el que está libre en las dos
 * agendas». Un hueco que en realidad tiene el almuerzo encima no es un hueco,
 * es una trampa.
 *
 * EL MÍNIMO. Un hueco de quince minutos no es un hueco para nadie: la reunión
 * más corta que se agenda es de veinte y la típica de cuarenta y cinco.
 * Dibujar «15 min libre» entre dos bloques sería ruido en una grilla que ya
 * está apretada, así que por debajo del mínimo el hueco existe pero no se
 * anuncia.
 */

/** Un rato tomado, en minutos desde la medianoche. */
export interface Ocupado {
  desde: number;
  hasta: number;
}

/** Un rato libre, con su largo ya calculado. */
export interface Hueco {
  desde: number;
  hasta: number;
  minutos: number;
}

/**
 * Lo más corto que se anuncia.
 *
 * Media hora es la reunión corta de verdad. Por debajo, el hueco sigue estando
 * —el bloque siguiente empieza donde empieza— pero no se le pone cartel.
 */
export const HUECO_MINIMO = 30;

/**
 * Los ratos libres de un día, dentro de la ventana que se dibuja.
 *
 * Los ocupados pueden venir en cualquier orden, pisarse entre ellos y
 * asomarse fuera de la ventana: es lo normal en una agenda real, donde una
 * reunión de 7:30 a 8:30 entra media hora en la franja de trabajo. Se ordenan,
 * se funden los que se tocan y se recorta a la ventana antes de restar.
 */
export function huecosDelDia(
  ocupados: Ocupado[],
  ventanaDesde: number,
  ventanaHasta: number,
  minimo: number = HUECO_MINIMO,
): Hueco[] {
  if (ventanaHasta <= ventanaDesde) return [];

  // Recortado a la ventana. Lo que queda afuera no tapa nada de lo que se ve.
  const dentro = ocupados
    .map((o) => ({
      desde: Math.max(ventanaDesde, Math.min(o.desde, o.hasta)),
      hasta: Math.min(ventanaHasta, Math.max(o.desde, o.hasta)),
    }))
    .filter((o) => o.hasta > o.desde)
    .sort((a, b) => a.desde - b.desde);

  // Fundidos: dos reuniones encimadas tapan un solo rato, no dos.
  const juntos: Ocupado[] = [];
  for (const o of dentro) {
    const ultimo = juntos[juntos.length - 1];
    if (ultimo && o.desde <= ultimo.hasta) {
      if (o.hasta > ultimo.hasta) ultimo.hasta = o.hasta;
      continue;
    }
    juntos.push({ ...o });
  }

  const huecos: Hueco[] = [];
  let cursor = ventanaDesde;
  for (const o of juntos) {
    if (o.desde - cursor >= minimo) {
      huecos.push({ desde: cursor, hasta: o.desde, minutos: o.desde - cursor });
    }
    cursor = Math.max(cursor, o.hasta);
  }
  if (ventanaHasta - cursor >= minimo) {
    huecos.push({ desde: cursor, hasta: ventanaHasta, minutos: ventanaHasta - cursor });
  }
  return huecos;
}

/**
 * Cómo se lee un hueco.
 *
 * «2 h 30 libre», «1 h libre», «45 min libre». En horas cuando son horas,
 * porque «150 min libre» obliga a dividir mentalmente para saber si entra una
 * reunión y media o dos.
 */
export function comoSeDiceElHueco(minutos: number): string {
  if (minutos < 60) return `${minutos} min libre`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto ? `${horas} h ${resto} libre` : `${horas} h libre`;
}
