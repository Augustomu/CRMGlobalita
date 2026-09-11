// El hilo de un chat: cómo se arma la lista de burbujas (§7.4, WA Personal).
//
// Es lo único de la conversación que tiene reglas. El resto —quién habla de qué
// lado, el color de la burbuja— es presentación pura.

/** Solo WhatsApp informa entrega y lectura (§3.2). */
export type Ack = 'enviado' | 'entregado' | 'leido';

export interface MensajeChat {
  quien: 'in' | 'out';
  texto: string;
  /** ISO con hora. Vacío = no se sabe cuándo (importado sin fecha). */
  en?: string | null;
  /**
   * Solo de los salientes de WhatsApp.
   *
   * Vacío NO es «no llegó»: es «no se sabe». LinkedIn no informa nada, así que
   * un tilde gris ahí sería un dato inventado. Por eso el tipo distingue
   * ausencia de estado en vez de tener un 'ninguno'.
   */
  ack?: Ack | null;
}

export type ItemHilo =
  | { tipo: 'dia'; etiqueta: string }
  | { tipo: 'mensaje'; quien: 'in' | 'out'; texto: string; hora: string; ack: Ack | null };

const HOY_AYER = ['hoy', 'ayer'];

function soloFecha(iso: string): string {
  return iso.slice(0, 10);
}

/** dd/mm, o «hoy» / «ayer» que es lo que uno lee sin traducir. */
export function etiquetaDeDia(iso: string, hoy: string): string {
  const dias = Math.round((Date.parse(soloFecha(hoy)) - Date.parse(soloFecha(iso))) / 86_400_000);
  if (dias >= 0 && dias < HOY_AYER.length) return HOY_AYER[dias];
  const f = soloFecha(iso);
  return `${f.slice(8, 10)}/${f.slice(5, 7)}`;
}

/**
 * El hilo con sus separadores de día.
 *
 * TRES COSAS QUE NO SON OBVIAS:
 *
 * 1. El separador se inserta cuando CAMBIA el día, no cada N mensajes ni al
 *    principio de cada bloque. Un chat de un solo día no lleva ninguno.
 *
 * 2. Los mensajes sin fecha no abren día ni lo cierran: se dibujan donde están
 *    y siguen perteneciendo al último día conocido. Un WhatsApp importado suele
 *    traer huecos, y meterlos todos bajo un separador «sin fecha» parte el hilo
 *    en dos por un problema de importación, no de la conversación.
 *
 * 3. NO se reordena. El orden en que llegaron es la conversación; ordenar por
 *    fecha con mensajes sin fecha los mandaría a todos al principio o al final.
 */
export function conDias(mensajes: MensajeChat[], hoy: string): ItemHilo[] {
  const salida: ItemHilo[] = [];
  let dia = '';
  for (const m of mensajes) {
    const iso = String(m.en ?? '');
    if (iso) {
      const d = soloFecha(iso);
      if (d !== dia) {
        salida.push({ tipo: 'dia', etiqueta: etiquetaDeDia(iso, hoy) });
        dia = d;
      }
    }
    salida.push({
      tipo: 'mensaje',
      quien: m.quien,
      texto: m.texto,
      hora: iso ? iso.slice(11, 16) : '',
      ack: m.ack ?? null,
    });
  }
  return salida;
}

/** El último mensaje, que es lo que se ve en la lista de chats. */
export function ultimoTexto(mensajes: MensajeChat[]): string {
  const m = mensajes[mensajes.length - 1];
  if (!m) return '';
  // El prefijo dice de un vistazo si la pelota está de tu lado.
  return m.quien === 'out' ? `vos: ${m.texto}` : m.texto;
}

/**
 * En qué está una conversación (§7.10).
 *
 * Tres estados, no dos, porque «leído» solo no dice nada útil: lo que hay que
 * poder ver es **si falta contestar**. Un hilo leído sin responder es trabajo
 * pendiente; uno respondido está esperando al otro, y no hay nada que hacer.
 *
 * Se mira el último mensaje y no un campo aparte a propósito: un booleano
 * `respondido` se desincroniza el día que alguien conteste desde el chat real
 * y el CRM no se entere. El último mensaje siempre dice la verdad.
 */
/**
 * Cuánto historial de WhatsApp se trae al vincular (§8.2).
 *
 * POR QUE HAY UN CORTE Y NO «TODO». WhatsApp manda el historial UNA SOLA VEZ,
 * en el momento de vincular, y manda lo que quiere: pueden ser años. Este es el
 * WhatsApp personal de Augusto, así que cada mes de más son conversaciones
 * privadas que entran al CRM, a los backups y a GitHub.
 *
 * Dos meses es lo que pidió el 11/09 —*«dame los chats de los 2 meses y el
 * historial por chat de los últimos 2 meses»*— y es configurable, porque
 * alguien puede necesitar otro número. Lo que no es negociable es que haya un
 * corte: «todo» no es una decisión, es la falta de una.
 */
export const DIAS_DE_HISTORIAL = 60;

/**
 * Si un mensaje del historial entra en la ventana que se decidió traer.
 *
 * Recibe el segundero de WhatsApp (segundos, no milisegundos — es la unidad de
 * `messageTimestamp` y confundirlas da fechas de 1970 que pasan cualquier
 * filtro «es viejo»).
 *
 * Un mensaje **sin fecha no entra**. No se puede saber si es de anteayer o de
 * hace cuatro años, y ante la duda lo caro es meter de más: sacarlo después
 * obliga a borrar, que en este proyecto no se hace solo.
 */
export function entraEnElHistorial(
  segundos: number | null | undefined,
  dias: number = DIAS_DE_HISTORIAL,
  ahora: Date = new Date(),
): boolean {
  const s = Number(segundos);
  if (!Number.isFinite(s) || s <= 0) return false;

  const cuando = s * 1000;
  // Una fecha en el futuro es un reloj mal puesto del otro lado, no un mensaje
  // de mañana. Entra: es reciente, que es lo que importa.
  const antiguedadEnDias = (ahora.getTime() - cuando) / 86400000;
  return antiguedadEnDias <= Math.max(0, dias);
}

export type EstadoConversacion = 'sin_leer' | 'sin_responder' | 'respondido' | 'sin_mensajes';

export function estadoDeConversacion(
  sinLeer: boolean,
  mensajes: Pick<MensajeChat, 'quien' | 'en'>[],
): EstadoConversacion {
  if (sinLeer) return 'sin_leer';
  if (!mensajes.length) return 'sin_mensajes';
  // Por fecha, no por posición: los mensajes pueden llegar desordenados de dos
  // fuentes (lo que registramos y lo que se lee del chat real).
  let ultimo = mensajes[0]!;
  for (const m of mensajes) {
    if (String(m.en ?? '') >= String(ultimo.en ?? '')) ultimo = m;
  }
  return ultimo.quien === 'in' ? 'sin_responder' : 'respondido';
}

/** Cómo se lee cada estado en pantalla. */
export const TEXTO_ESTADO: Record<EstadoConversacion, string> = {
  sin_leer: 'sin leer',
  sin_responder: 'leído, sin responder',
  respondido: 'respondido',
  sin_mensajes: 'sin mensajes',
};
