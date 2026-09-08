// Etiquetas: cuáles se ofrecen a mano y cuáles se pueden sacar.
//
// Cambios 8 y 9 del documento de diseño: mostrar las seis usadas más
// recientemente, clickeables para aplicar rápido, y una × en cada aplicada.
//
// POR QUE SEIS Y NO EL CATALOGO ENTERO. El catálogo crece sin techo —es libre
// (D04)— y con veinte etiquetas la fila ocupa media pantalla y deja de ser un
// atajo. Seis entran en un renglón y cubren el uso real: en una tanda de
// prospección se repiten las mismas tres o cuatro.

export interface Etiqueta {
  id: string;
  nombre: string;
  /** Las pone el sistema (D04): no se ofrecen para aplicar a mano. */
  del_sistema?: boolean;
  /** Cuándo se aplicó por última vez a algún lead. Vacío = nunca. */
  usada_en?: string | null;
}

/** Cuántas se ofrecen. Es del documento de diseño, no una elección técnica. */
export const CUANTAS_RECIENTES = 6;

/**
 * Las que se ofrecen para aplicar de un clic.
 *
 * Se excluyen tres grupos, cada uno por una razón distinta:
 *
 *   · las YA APLICADAS, porque el atajo es para poner, no para repetir;
 *   · las DEL SISTEMA, porque las pone la cadencia y ponerlas a mano deja el
 *     lead diciendo algo que no pasó (D04);
 *   · las NUNCA USADAS, porque sin fecha no hay forma de ordenarlas y
 *     llenarían la fila con lo que nadie eligió.
 *
 * El orden es por uso más reciente; a igualdad de fecha, alfabético, para que
 * la fila no baile entre renders.
 */
export function recientes(
  catalogo: Etiqueta[],
  aplicadas: string[],
  cuantas: number = CUANTAS_RECIENTES,
): Etiqueta[] {
  const puestas = new Set(aplicadas);
  return catalogo
    .filter((e) => !puestas.has(e.id) && !e.del_sistema && Boolean(e.usada_en))
    .sort((a, b) => {
      const fecha = String(b.usada_en).localeCompare(String(a.usada_en));
      return fecha !== 0 ? fecha : a.nombre.localeCompare(b.nombre);
    })
    .slice(0, cuantas);
}

/**
 * Si esta etiqueta se puede sacar a mano.
 *
 * Las del sistema no: las pone la cadencia y las vuelve a poner en el próximo
 * envío, así que la × sería un botón que no hace nada. La ×, entonces, no se
 * dibuja — es la única forma de que el botón no mienta.
 */
export function sePuedeSacar(etiqueta: Etiqueta): boolean {
  return !etiqueta.del_sistema;
}
