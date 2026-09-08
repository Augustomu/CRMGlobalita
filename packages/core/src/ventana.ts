// Cuántas filas se dibujan de una lista larga (§7.2; §11 lo pone entre las
// cuatro cosas transversales «desde el día uno», con el aviso de que meterlas
// al final cuesta el triple).
//
// La base real tiene miles de leads. Dibujarlos todos hace que cada tecla del
// buscador vuelva a montar miles de filas, y eso se siente: el cursor va atrás
// de lo que se escribe. La ventana no es una optimización prematura, es la
// diferencia entre que el buscador se use y que no.

/** Cuántas filas arrancan visibles, y de a cuántas crece. */
export const LOTE = 80;

/** A qué distancia del fondo se pide el lote siguiente, en píxeles. */
export const ANTICIPO = 400;

/** El alto de una fila. Se usa para saber a dónde hay que hacer scroll. */
export const ALTO_FILA = 46;

/**
 * Si el scroll llegó lo bastante cerca del fondo como para sumar otro lote.
 *
 * Se anticipa 400 px en vez de esperar al final: cargar cuando el usuario YA
 * llegó abajo le muestra el fondo vacío mientras se dibuja.
 */
export function hayQueCrecer(scrollTop: number, alto: number, total: number): boolean {
  return scrollTop + alto >= total - ANTICIPO;
}

/**
 * La ventana que hace falta para que el índice `i` esté dibujado.
 *
 * Seleccionar un lead desde afuera de la lista —un atajo, el panel de últimos,
 * un enlace— puede caer en la fila 900. Si la ventana no se estira, la ficha se
 * abre pero la fila no existe y el scroll no tiene a dónde ir.
 *
 * Se estira hasta `i + LOTE` y no hasta `i`: dejar la fila elegida pegada al
 * borde de lo dibujado hace que el primer scroll siguiente cargue de nuevo.
 */
export function ventanaPara(i: number, actual: number): number {
  return i >= 0 && i >= actual ? i + LOTE : actual;
}

/**
 * A qué altura dejar el scroll para que la fila `i` quede a la vista.
 *
 * A un tercio del alto y no arriba de todo: la fila elegida se lee con lo que
 * viene antes y después, que es lo que dice si el orden tiene sentido.
 */
export function scrollHasta(i: number, alto: number): number {
  return Math.max(0, i * ALTO_FILA - alto / 3);
}
