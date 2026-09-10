/**
 * La sesión de WhatsApp: cuándo está viva, y qué hacer cuando se cae (§8.2).
 *
 * DE DÓNDE SALE ESTO. `sesion.ts` ya decidía activa/caída/sin_vincular a partir
 * de `ultima_senal_wa`, y esa parte no se toca: se usa. Lo que faltaba es lo de
 * al lado, y es lo que hace que la pantalla sirva para algo:
 *
 *   1. Una sesión de WhatsApp **se cae sola**, todo el tiempo, y volver a
 *      conectarse es lo normal. Pero también la pueden **desvincular** desde el
 *      teléfono, y ahí la credencial guardada no vale más: reconectar con ella
 *      es golpear una puerta tapiada para siempre. Las dos cosas se ven igual
 *      desde afuera —«la conexión se cerró»— y lo que hay que hacer es
 *      opuesto: en una se espera, en la otra hay que escanear otro QR.
 *
 *   2. Un QR de WhatsApp **vence**. Mostrar uno viejo es peor que no mostrar
 *      ninguno: Augusto escanea, no pasa nada, y no hay forma de que sepa si
 *      falló el QR o falló él.
 *
 * POR QUÉ ESTÁ ACÁ Y NO EN EL WORKER. Porque son decisiones, no plomería.
 * «¿Reconecto o pido otro QR?» se puede contestar con un número y se puede
 * testear sin abrir un socket; el worker sólo tiene que traer el número.
 *
 * Y POR QUÉ LOS CÓDIGOS ESTÁN ESCRITOS ACÁ. `core` no importa nada de afuera
 * (regla 3 de CLAUDE.md), así que no puede importar el `DisconnectReason` de
 * Baileys. Están copiados abajo, con el nombre que les da Baileys al lado, y
 * verificados contra `@whiskeysockets/baileys` 7.0.0-rc14 el 10/09/2026 — no
 * de memoria, que es la familia de errores 7 del registro.
 */

import { estadoDeSesion, type EstadoSesion } from './sesion.ts';

/**
 * Los códigos con los que WhatsApp cierra una conexión.
 *
 * Son los de `DisconnectReason` de Baileys. Ojo con dos cosas que sorprenden:
 * `connectionLost` y `timedOut` son **el mismo número** (408), así que no se
 * pueden distinguir y no hace falta —los dos se reconectan igual—; y 401 no es
 * «no autorizado» en el sentido de siempre: es «te desvincularon del teléfono».
 */
export const CODIGO_WA = {
  /** 428 · `connectionClosed`. El socket se cerró. Pasa solo. */
  conexion_cerrada: 428,
  /** 408 · `connectionLost` y `timedOut`. La red. */
  conexion_perdida: 408,
  /** 440 · `connectionReplaced`. Otra sesión tomó el lugar de ésta. */
  sesion_reemplazada: 440,
  /** 401 · `loggedOut`. Lo desvincularon desde el teléfono. */
  desvinculado: 401,
  /** 500 · `badSession`. La credencial guardada quedó rota. */
  sesion_rota: 500,
  /** 515 · `restartRequired`. Normal justo después de escanear el QR. */
  hay_que_reiniciar: 515,
  /** 411 · `multideviceMismatch`. La vinculación no sirve como está. */
  version_no_coincide: 411,
  /** 403 · `forbidden`. WhatsApp bloqueó la cuenta. */
  prohibida: 403,
  /** 503 · `unavailableService`. Es de ellos, no nuestro. */
  servicio_caido: 503,
} as const;

/** Por qué la sesión no está viva. Lo que la pantalla tiene que poder decir. */
export type MotivoWa =
  | 'nunca_vinculada'
  | 'reconectando'
  | 'desvinculado'
  | 'sesion_rota'
  | 'reemplazada'
  | 'prohibida'
  | 'servicio_caido'
  | 'no_vuelve';

/** Qué hacer con una caída. Son tres, y no se parecen en nada. */
export type AccionTrasCaida =
  /** Se cayó sola. Se espera y se vuelve a intentar con la misma credencial. */
  | 'reconectar'
  /** La credencial murió. Hay que escanear un QR nuevo. */
  | 'volver_a_vincular'
  /** Ni una ni otra: que decida una persona. */
  | 'rendirse';

export interface QueHacer {
  accion: AccionTrasCaida;
  motivo: MotivoWa;
  /** Cuánto esperar antes de reintentar. Cero cuando hay que reintentar ya. */
  espera_ms: number;
  /**
   * Si este reintento gasta uno de los que hay.
   *
   * El 515 no gasta: es el reinicio que WhatsApp **pide** apenas se escanea el
   * QR, y contarlo como fracaso haría que la primera vinculación —la que más
   * importa— se quedara sin intentos justo cuando está saliendo bien.
   */
  cuenta_como_intento: boolean;
  /** Qué se le dice a la persona. Una frase, con lo que tiene que hacer. */
  detalle: string;
}

/**
 * Cuántas veces se reintenta antes de dejar de insistir.
 *
 * Cinco. Con la espera de abajo son unos dos minutos de intentos; si en dos
 * minutos no volvió, no es un parpadeo de la red y seguir reintentando solo
 * esconde el problema en vez de mostrarlo.
 */
export const TOPE_DE_REINTENTOS = 5;

/** La primera espera. Se duplica en cada intento. */
export const ESPERA_BASE_MS = 2000;
/** Y no pasa de acá, por más intentos que hayan salido mal. */
export const ESPERA_TOPE_MS = 60000;

/**
 * Cuánto esperar antes del reintento número `intento` (el primero es 1).
 *
 * Duplicando: 2 s, 4 s, 8 s, 16 s, 32 s. Reconectar al instante contra un
 * WhatsApp que está rechazando es la forma de que rechace más fuerte.
 */
export function esperaDeReintento(intento: number): number {
  // `Math.max(1, NaN)` es NaN, no 1: `Math.max` propaga NaN a propósito. Sin
  // esta línea, un contador que llega roto —o `undefined`— devuelve NaN, y un
  // `setTimeout(NaN)` dispara EN EL ACTO. O sea: reconectar sin pausa contra un
  // WhatsApp que está rechazando, que es exactamente lo que esta función existe
  // para impedir. Lo encontró el test de «un intento inválido no rompe nada».
  const crudo = Number(intento);
  const n = Number.isFinite(crudo) ? Math.max(1, Math.floor(crudo)) : 1;
  return Math.min(ESPERA_TOPE_MS, ESPERA_BASE_MS * 2 ** (n - 1));
}

/**
 * Qué hacer cuando la conexión se cerró.
 *
 * `codigo` es el número con el que cerró —`undefined` si no vino ninguno, que
 * pasa— e `intento` es cuántos reintentos seguidos ya se hicieron **sin haber
 * vuelto a conectar**; se pone en cero apenas la sesión abre.
 *
 * ANTE LA DUDA SE RECONECTA, no se manda a escanear. Es el error barato: un
 * reintento de más cuesta dos segundos, y mandar a escanear un QR cuando la
 * credencial servía hace que Augusto desvincule a mano una sesión que estaba
 * bien.
 */
export function queHacerConLaCaida(codigo: number | undefined, intento: number): QueHacer {
  // Lo primero: los que matan la credencial. Acá no hay reintento que sirva, y
  // reintentar es exactamente lo que hace que se tarde media hora en entender
  // que había que volver a escanear.
  if (codigo === CODIGO_WA.desvinculado) {
    return {
      accion: 'volver_a_vincular',
      motivo: 'desvinculado',
      espera_ms: 0,
      cuenta_como_intento: false,
      detalle:
        'Se desvinculó el dispositivo desde el teléfono. La credencial guardada ya no vale: ' +
        'hay que escanear un QR nuevo.',
    };
  }
  if (codigo === CODIGO_WA.sesion_rota || codigo === CODIGO_WA.version_no_coincide) {
    return {
      accion: 'volver_a_vincular',
      motivo: 'sesion_rota',
      espera_ms: 0,
      cuenta_como_intento: false,
      detalle:
        'La credencial guardada quedó rota y WhatsApp la rechaza. Se descarta y se escanea de nuevo.',
    };
  }
  if (codigo === CODIGO_WA.prohibida) {
    return {
      accion: 'rendirse',
      motivo: 'prohibida',
      espera_ms: 0,
      cuenta_como_intento: false,
      detalle:
        'WhatsApp bloqueó este número. No es un problema de conexión y no se arregla reintentando.',
    };
  }

  // El 515 no es una caída: es el reinicio que WhatsApp pide apenas se escanea
  // el QR. Se reconecta YA y no gasta intento.
  if (codigo === CODIGO_WA.hay_que_reiniciar) {
    return {
      accion: 'reconectar',
      motivo: 'reconectando',
      espera_ms: 0,
      cuenta_como_intento: false,
      detalle: 'WhatsApp pidió reiniciar la conexión. Es lo normal después de escanear.',
    };
  }

  // Otra sesión tomó el lugar de ésta. Reconectar acá es una pelea: cada lado
  // echa al otro y el teléfono queda tironeado. Se corta y se avisa.
  if (codigo === CODIGO_WA.sesion_reemplazada) {
    return {
      accion: 'rendirse',
      motivo: 'reemplazada',
      espera_ms: 0,
      cuenta_como_intento: false,
      detalle:
        'Otra sesión de WhatsApp Web tomó el lugar de ésta. Cerrá la otra y volvé a correr esto; ' +
        'reconectar ahora sería que las dos se echen entre sí.',
    };
  }

  if (intento >= TOPE_DE_REINTENTOS) {
    return {
      accion: 'rendirse',
      motivo: codigo === CODIGO_WA.servicio_caido ? 'servicio_caido' : 'no_vuelve',
      espera_ms: 0,
      cuenta_como_intento: false,
      detalle:
        `La conexión no volvió después de ${TOPE_DE_REINTENTOS} intentos` +
        (codigo === CODIGO_WA.servicio_caido
          ? '. WhatsApp está contestando que el servicio no está disponible: es de ellos.'
          : '. No es un parpadeo de la red; hace falta mirarlo.'),
    };
  }

  return {
    accion: 'reconectar',
    motivo: codigo === CODIGO_WA.servicio_caido ? 'servicio_caido' : 'reconectando',
    espera_ms: esperaDeReintento(intento + 1),
    cuenta_como_intento: true,
    detalle:
      codigo === CODIGO_WA.servicio_caido
        ? 'WhatsApp dice que el servicio no está disponible. Se espera y se reintenta.'
        : 'La conexión se cerró. Se reconecta con la misma credencial.',
  };
}

/**
 * Si para volver a vincular hay que descartar la credencial que está guardada.
 *
 * Importa y no es obvio: con una credencial muerta en la carpeta, Baileys
 * intenta usarla y **el QR no aparece nunca**. Se queda reintentando contra una
 * sesión que ya no existe y la pantalla no muestra nada que escanear.
 *
 * Quién la borra es otra cosa, y no es este archivo ni ningún script solo: es
 * la primera regla de CLAUDE.md. Acá se dice que hace falta.
 */
export function hayQueDescartarLaCredencial(motivo: MotivoWa): boolean {
  return motivo === 'desvinculado' || motivo === 'sesion_rota';
}

/**
 * Cuántos segundos vale un QR antes de que mostrarlo sea mentir.
 *
 * WhatsApp le da 60 segundos al primero y 20 a los siguientes, y Baileys emite
 * uno nuevo cada vez que el anterior vence. O sea que mientras el comando esté
 * corriendo, el de la pantalla se refresca solo cada 20 segundos.
 *
 * Se toma el más largo de los dos —60— a propósito: pasado ese minuto sin un
 * QR nuevo, lo que venció no es el código, es el comando. Ya no hay nadie
 * emitiendo, y eso es lo que hay que decirle a quien está mirando.
 */
export const SEGUNDOS_QR_VIGENTE = 60;

export interface SesionWaEnLaBase {
  /** La última vez que la conexión contestó. La escribe el worker. */
  ultima_senal_wa?: string | null;
  /** El QR para escanear, si hay uno. Vacío cuando no hay nada que mostrar. */
  qr_wa?: string | null;
  /** Cuándo se emitió ese QR. */
  qr_wa_desde?: string | null;
  /** Por qué no está viva, si no lo está. */
  wa_motivo?: string | null;
  /** El número vinculado, sin `+`. Vacío si nunca se vinculó ninguno. */
  wa_numero?: string | null;
}

export interface LecturaWa {
  estado: EstadoSesion;
  /** Si hay un QR y todavía sirve escanearlo. */
  qr_vigente: boolean;
  /** El renglón de estado. Corto: entra en la fila de la tabla. */
  titular: string;
  /** Qué tiene que hacer la persona. Vacío cuando no hay nada que hacer. */
  que_hacer: string;
}

/** Cómo se lee cada motivo en pantalla. */
export const NOMBRE_MOTIVO_WA: Record<MotivoWa, string> = {
  nunca_vinculada: 'sin vincular',
  reconectando: 'reconectando',
  desvinculado: 'desvinculado desde el teléfono',
  sesion_rota: 'la credencial no sirve',
  reemplazada: 'otra sesión tomó el lugar',
  prohibida: 'WhatsApp bloqueó el número',
  servicio_caido: 'WhatsApp no está disponible',
  no_vuelve: 'no vuelve sola',
};

const esMotivo = (v: unknown): v is MotivoWa => typeof v === 'string' && v in NOMBRE_MOTIVO_WA;

/**
 * Lo que la pantalla de Cuentas conectadas tiene que mostrar de una sesión.
 *
 * El estado sigue saliendo de la señal (`sesion.ts`) y eso no cambia. Lo que se
 * agrega es el POR QUÉ y el QUÉ HACER, que es lo único que convierte una fila
 * roja en algo accionable. Sin eso, siete filas en rojo se leen como siete
 * cosas rotas y ninguna dice por dónde empezar.
 */
export function comoSeVeLaSesionWa(
  fila: SesionWaEnLaBase,
  ahora: Date = new Date(),
): LecturaWa {
  const estado = estadoDeSesion(fila.ultima_senal_wa, ahora);
  const motivo = esMotivo(fila.wa_motivo) ? fila.wa_motivo : null;

  const desde = String(fila.qr_wa_desde ?? '').trim();
  const emitido = desde ? new Date(desde.replace(' ', 'T')).getTime() : NaN;
  const qr_vigente =
    Boolean(String(fila.qr_wa ?? '').trim()) &&
    Number.isFinite(emitido) &&
    (ahora.getTime() - emitido) / 1000 <= SEGUNDOS_QR_VIGENTE;

  if (estado === 'activa') {
    const numero = String(fila.wa_numero ?? '').trim();
    return {
      estado,
      qr_vigente: false,
      titular: numero ? `conectada · ${numero}` : 'conectada',
      que_hacer: '',
    };
  }

  if (qr_vigente) {
    return {
      estado,
      qr_vigente: true,
      titular: 'esperando el QR',
      que_hacer:
        'Escaneá el código desde WhatsApp > Dispositivos vinculados > Vincular un dispositivo.',
    };
  }

  // Sin QR vigente, manda el motivo: es la diferencia entre «esperá» y «andá a
  // buscar el teléfono», que es todo lo que hay que saber acá.
  if (motivo) {
    const rehacer = hayQueDescartarLaCredencial(motivo);
    return {
      estado,
      qr_vigente: false,
      titular: NOMBRE_MOTIVO_WA[motivo],
      que_hacer:
        motivo === 'reconectando'
          ? 'Se está reconectando sola. Si no vuelve en un par de minutos, volvé a vincular.'
          : motivo === 'prohibida'
            ? 'No se arregla desde acá.'
            : rehacer
              ? 'Hay que escanear un QR nuevo: la credencial guardada ya no vale.'
              : 'Volvé a correr el comando de vincular.',
    };
  }

  return {
    estado,
    qr_vigente: false,
    titular: estado === 'caida' ? 'caída' : 'sin vincular',
    que_hacer:
      estado === 'caida'
        ? 'Dio señal y dejó de darla. Volvé a correr el comando de vincular.'
        : 'Nunca se vinculó. Se vincula escaneando un QR.',
  };
}

/**
 * Si el número que se vinculó es el que se esperaba.
 *
 * Existe porque el QR lo escanea una persona con un teléfono en la mano, y
 * nada le impide escanearlo con el teléfono equivocado. Si eso pasa y nadie
 * mira, la cuenta queda vinculada al número de otro y se descubre el día que
 * sale un mensaje — que es el peor día para descubrirlo.
 *
 * Compara sólo dígitos: uno puede venir con `+`, con espacios o con el `9` de
 * Argentina puesto por WhatsApp y el otro no.
 */
export function esElNumeroEsperado(vinculado: string, esperado: string): boolean {
  const soloDigitos = (s: string) => String(s ?? '').replace(/\D+/g, '');
  const a = soloDigitos(vinculado);
  const b = soloDigitos(esperado);
  if (!a || !b) return false;
  if (a === b) return true;
  // Uno puede traer el prefijo largo y el otro el corto: alcanza con que el
  // final coincida en la parte que identifica al abonado.
  const largo = a.length >= b.length ? a : b;
  const corto = a.length >= b.length ? b : a;
  return corto.length >= 8 && largo.endsWith(corto.slice(-8));
}

/**
 * El número, tapado, para poder escribirlo en pantalla y en la terminal.
 *
 * `CRMGlobalita` es un repositorio público y las salidas de la terminal se
 * pegan en mensajes. Un número entero en un log es un número entero en
 * cualquier lado; los últimos cuatro dígitos alcanzan para reconocerlo.
 */
export function numeroTapado(numero: string): string {
  const d = String(numero ?? '').replace(/\D+/g, '');
  if (!d) return '';
  return d.length <= 4 ? '·'.repeat(d.length) : `···${d.slice(-4)}`;
}
