/**
 * Si una sesión de LinkedIn o de WhatsApp está viva (§8.1, §8.2).
 *
 * EL PROBLEMA QUE RESUELVE. Hasta el 09/09/2026 el estado era un campo que
 * alguien había escrito una vez: `cuenta.estado_sesion` decía «activa» en cinco
 * cuentas y `sesion_wa` decía «conectada» en cinco, y **no había ni una sesión
 * de verdad detrás** — eran valores del seed de demo. La pantalla de Cuentas
 * conectadas mostraba «5 LinkedIn · 5/7 WhatsApp» con total aplomo.
 *
 * Una pantalla de estado que afirma algo que nadie verificó es peor que no
 * tenerla: se confía en ella justo cuando importa, que es cuando la cola dejó
 * de salir y hay que saber por qué.
 *
 * CÓMO SE ARREGLA DE VERDAD. El estado no se declara, se deduce de una señal
 * con fecha. El worker toca `ultima_senal_li` / `ultima_senal_wa` cada vez que
 * la sesión responde; acá se mira cuán vieja es. Mientras el worker no exista
 * la señal está vacía y todo dice «sin vincular», que es exactamente la verdad.
 * El día que el worker aparezca, esta pantalla empieza a decir cosas ciertas
 * sin que haya que tocarla.
 */

export type EstadoSesion = 'activa' | 'caida' | 'sin_vincular';

/**
 * Cuánto puede pasar sin señal antes de dar la sesión por caída.
 *
 * El worker avisa cada pocos minutos. Quince da margen para un reintento y una
 * pausa larga sin llenar la pantalla de falsas alarmas, y es lo bastante corto
 * como para que una sesión caída no pase la mañana entera diciendo «activa».
 */
export const MINUTOS_SIN_SENAL = 15;

/**
 * El estado de una sesión a partir de su última señal.
 *
 * `sin_vincular` y `caida` son distintos y no da lo mismo: la primera nunca
 * estuvo conectada —hay que vincularla— y la segunda se cayó, o sea que había
 * algo andando y dejó de andar. Lo que hay que hacer es distinto en cada caso.
 */
export function estadoDeSesion(
  ultimaSenal: string | null | undefined,
  ahora: Date = new Date(),
): EstadoSesion {
  const texto = String(ultimaSenal ?? '').trim();
  if (!texto) return 'sin_vincular';

  const cuando = new Date(texto.replace(' ', 'T')).getTime();
  // Una fecha ilegible no es una sesión viva. Antes que asumir que sí —que es
  // el error caro— se trata como si nunca hubiera habido señal.
  if (!Number.isFinite(cuando)) return 'sin_vincular';

  const minutos = (ahora.getTime() - cuando) / 60000;
  return minutos <= MINUTOS_SIN_SENAL ? 'activa' : 'caida';
}

/** Cómo se lee cada estado en pantalla. */
export const NOMBRE_ESTADO_SESION: Record<EstadoSesion, string> = {
  activa: 'activa',
  caida: 'caída',
  sin_vincular: 'sin vincular',
};

/**
 * Por qué no hay ninguna sesión viva, cuando no la hay.
 *
 * Sin esto, siete filas diciendo «sin vincular» se leen como siete cosas rotas
 * que hay que ir a arreglar de a una. La causa es una sola y no está en las
 * cuentas: el proceso que sostiene las sesiones todavía no existe.
 */
export function porQueNingunaSesion(hayWorker: boolean, cuantas: number): string | null {
  if (hayWorker || cuantas === 0) return null;
  return (
    'Ninguna sesión está vinculada porque el proceso que las mantiene todavía ' +
    'no existe. No es que se hayan caído: nunca se levantaron. Hasta entonces ' +
    'los envíos salen a mano.'
  );
}
