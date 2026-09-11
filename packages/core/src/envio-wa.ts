/**
 * Cuándo se puede mandar un WhatsApp, y cuándo no (§8.5b).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DE QUÉ NOS CUIDAMOS, exactamente. Baileys no es una API oficial: es un
 * cliente del protocolo de WhatsApp Web. WhatsApp no publica sus reglas, pero
 * lo que hace que bloqueen un número está bastante claro y NO es «usar un
 * programa»:
 *
 *   · **Volumen.** Muchos mensajes en poco tiempo desde un número que antes
 *     mandaba diez por día.
 *   · **Empezar conversaciones con desconocidos.** Escribirle primero a alguien
 *     que nunca escribió es la señal más fuerte de todas.
 *   · **Repetir el mismo texto.** El mismo mensaje a veinte personas.
 *   · **Ritmo de máquina.** Un mensaje cada exactamente treinta segundos.
 *   · **Que alguien reporte el número.** Es la única que no se puede prevenir
 *     desde acá, y por eso todo lo demás importa.
 *
 * LO QUE AUGUSTO PIDIÓ ESTÁ EN EL LADO SEGURO. *«Resolvelo para mandar
 * mensajes puntuales, no es nada masivo»*: contestarle a alguien que escribió
 * primero, desde el número que siempre usa, unas pocas veces por día. Eso es
 * exactamente lo que hace una persona — porque ES una persona; lo único que
 * cambia es desde qué pantalla escribe.
 *
 * MANDAR UN ARCHIVO NO ES MÁS RIESGOSO QUE MANDAR TEXTO. Lo que mira WhatsApp
 * es el patrón, no el tipo de contenido. Un audio a alguien con quien venís
 * hablando es tan normal como un «dale». Cien audios a cien desconocidos no lo
 * es, y tampoco lo sería con texto.
 *
 * LAS SEIS REGLAS de acá abajo son las que separan una cosa de la otra. La
 * primera es la que más pesa.
 */

export type MotivoNoEnviar =
  /** Nunca escribió. Empezar una conversación es la señal más fuerte (§regla 1). */
  | 'nunca_escribio'
  /** Se cumplió el cupo del día. */
  | 'cupo_del_dia'
  /** Todavía no pasó el tiempo mínimo desde el anterior. */
  | 'muy_seguido'
  /** Fuera de la franja horaria. */
  | 'fuera_de_hora'
  /** El mismo texto, a la misma persona, hace un rato. */
  | 'repetido'
  /** La sesión no está viva. */
  | 'sin_sesion'
  /** La automatización está en pausa. */
  | 'pausado';

export interface ConfigEnvioWa {
  /** Cuántos mensajes salen por día desde una cuenta. */
  tope_diario: number;
  /** Cuántos segundos como mínimo entre uno y otro. */
  espera_min_s: number;
  /** Y cuántos como máximo: la espera se sortea entre los dos. */
  espera_max_s: number;
  /** Desde qué hora y hasta qué hora se puede mandar. */
  hora_desde: number;
  hora_hasta: number;
}

/**
 * Los valores con los que arranca. Todos configurables (regla 2 de CLAUDE.md).
 *
 * TREINTA POR DÍA no es un número redondo elegido al azar: es más o menos lo
 * que manda una persona que trabaja con WhatsApp, y bastante menos de lo que
 * llama la atención. El día que haga falta más, se sube de a poco y se mira.
 */
export const CONFIG_ENVIO_WA_INICIAL: ConfigEnvioWa = {
  tope_diario: 30,
  espera_min_s: 8,
  espera_max_s: 25,
  hora_desde: 8,
  hora_hasta: 22,
};

export interface QuienRecibe {
  /** Si esta persona escribió alguna vez. La regla 1. */
  escribio_alguna_vez: boolean;
  /** Cuándo salió el último mensaje NUESTRO a esta persona, en ISO. */
  ultimo_nuestro?: string | null;
  /** El texto del último que le mandamos, para no repetirlo. */
  ultimo_texto?: string | null;
}

export interface EstadoDelEnvio {
  /** Cuántos salieron hoy desde esta cuenta. */
  salieron_hoy: number;
  /** Cuándo salió el último, de cualquier conversación. */
  ultimo_envio?: string | null;
  /** Si la sesión de WhatsApp está viva. */
  sesion_viva: boolean;
  /** Si la automatización está pausada. */
  pausado: boolean;
}

export interface Permiso {
  puede: boolean;
  motivo?: MotivoNoEnviar;
  /** Qué decirle a la persona. Vacío cuando se puede. */
  detalle: string;
}

const DICE: Record<MotivoNoEnviar, string> = {
  nunca_escribio:
    'Esta persona nunca escribió a este número. Escribirle primero desde el CRM es lo que más ' +
    'rápido hace que WhatsApp bloquee una cuenta: abrí el chat en WhatsApp y mandale vos el primero.',
  cupo_del_dia: 'Se cumplió el cupo de mensajes de hoy. Sigue mañana.',
  muy_seguido: 'Muy seguido del anterior. Esperá unos segundos.',
  fuera_de_hora: 'Fuera de la franja horaria configurada.',
  repetido: 'Ese mismo texto ya salió a esta persona hace poco.',
  sin_sesion: 'La sesión de WhatsApp no está conectada.',
  pausado: 'La automatización está en pausa.',
};

const no = (motivo: MotivoNoEnviar): Permiso => ({ puede: false, motivo, detalle: DICE[motivo] });

/**
 * Si se puede mandar este mensaje, ahora, a esta persona.
 *
 * EL ORDEN DE LOS CHEQUEOS IMPORTA. Primero lo que no cambia con esperar —la
 * pausa, la sesión, y sobre todo que la persona haya escrito— y después lo que
 * sí. Así el motivo que se muestra es el que hay que resolver, y no «esperá 8
 * segundos» sobre un envío que nunca va a poder salir.
 */
export function sePuedeEnviarWa(
  quien: QuienRecibe,
  estado: EstadoDelEnvio,
  config: ConfigEnvioWa,
  texto: string,
  ahora: Date = new Date(),
): Permiso {
  if (estado.pausado) return no('pausado');
  if (!estado.sesion_viva) return no('sin_sesion');

  /*
   * LA REGLA 1, y la que más pesa.
   *
   * Contestarle a alguien que escribió es lo que hace una persona todos los
   * días. Escribirle primero a alguien que nunca escribió, desde un programa,
   * es la señal que WhatsApp busca — y la que hace que un bloqueo sea
   * permanente en vez de temporal.
   *
   * No se puede saltear con configuración a propósito: una perilla para
   * apagarla existiría justo para el día en que alguien tiene apuro.
   */
  if (!quien.escribio_alguna_vez) return no('nunca_escribio');

  const hora = ahora.getHours();
  if (hora < config.hora_desde || hora >= config.hora_hasta) return no('fuera_de_hora');

  if (estado.salieron_hoy >= Math.max(0, config.tope_diario)) return no('cupo_del_dia');

  const segundosDesde = (v: string | null | undefined): number => {
    const s = String(v ?? '').trim();
    if (!s) return Infinity;
    const t = new Date(s.replace(' ', 'T')).getTime();
    return Number.isFinite(t) ? (ahora.getTime() - t) / 1000 : Infinity;
  };

  if (segundosDesde(estado.ultimo_envio) < Math.max(0, config.espera_min_s)) return no('muy_seguido');

  // El mismo texto a la misma persona dentro de la hora. Repetir es de robot, y
  // además casi siempre es un doble clic sin querer.
  const mismo = String(quien.ultimo_texto ?? '').trim() === String(texto ?? '').trim();
  if (mismo && texto.trim() && segundosDesde(quien.ultimo_nuestro) < 3600) return no('repetido');

  return { puede: true, detalle: '' };
}

/**
 * Cuánto esperar antes de mandar, para no tener ritmo de máquina.
 *
 * SE SORTEA, y además crece con el largo del texto: un mensaje de cuatro
 * renglones tarda más en escribirse que un «dale», y WhatsApp ve el
 * «escribiendo…». Mandar cuatro renglones un segundo después de recibir es la
 * clase de detalle que separa a una persona de un programa.
 *
 * `sorteo` entra como argumento para poder testearlo: sin eso el test
 * dependería del azar.
 */
export function esperaAntesDeMandar(
  texto: string,
  config: ConfigEnvioWa,
  sorteo: number = Math.random(),
): number {
  const min = Math.max(0, config.espera_min_s);
  const max = Math.max(min, config.espera_max_s);
  const base = min + (max - min) * Math.min(1, Math.max(0, sorteo));

  // Unos 25 caracteres por segundo, que es escribir rápido en un teléfono.
  const porEscribir = Math.min(20, String(texto ?? '').length / 25);

  return Math.round((base + porEscribir) * 1000);
}
