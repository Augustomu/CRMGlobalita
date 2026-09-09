// El alta de un usuario (§6.7, §7.5).
//
// No hay auto-registro: a una persona la da de alta un administrador. Lo que
// define este módulo es qué pasa entre ese momento y el primer ingreso.
//
// **El correo no lleva la contraseña.** Lleva el usuario y un enlace de un solo
// uso donde la persona elige la suya. La diferencia no es de estilo: una clave
// escrita en un mail queda en esa bandeja para siempre, y quien entre a esa
// casilla dentro de dos años tiene una llave del CRM. El enlace, en cambio,
// deja de servir apenas se usa —o a los siete días, lo que pase antes.

/** Cuánto vale un enlace de invitación sin usar. */
export const DIAS_DE_INVITACION = 7;

/** Lo mínimo que puede medir una contraseña. Es también lo que exige PocketBase. */
export const LARGO_MINIMO_CLAVE = 8;

export type EstadoInvitacion = 'valida' | 'usada' | 'vencida' | 'inexistente';

export interface Invitacion {
  /** ISO con hora. */
  expira: string;
  /** ISO con hora, o vacío si nadie la usó todavía. */
  usada_en?: string | null;
}

/**
 * Si un enlace de invitación todavía sirve.
 *
 * Los tres «no» se distinguen a propósito. A quien abre un enlace vencido hay
 * que decirle que pida otro; a quien abre uno ya usado, que entre con su clave.
 * Un «este enlace no sirve» para los dos casos manda a la persona a escribirle
 * al administrador cuando en un caso no hacía falta.
 */
export function estadoDeInvitacion(inv: Invitacion | null | undefined, ahora: string): EstadoInvitacion {
  if (!inv) return 'inexistente';
  if (inv.usada_en) return 'usada';
  if (!inv.expira || inv.expira <= ahora) return 'vencida';
  return 'valida';
}

/** Cuándo vence una invitación emitida ahora. */
export function venceEn(ahora: string, dias: number = DIAS_DE_INVITACION): string {
  const t = Date.parse(ahora);
  if (Number.isNaN(t)) return ahora;
  return new Date(t + dias * 86_400_000).toISOString();
}

/**
 * Qué le falta a una contraseña para ser aceptable.
 *
 * Devuelve el motivo, o `null` si está bien. Se devuelve el motivo y no un
 * booleano porque el formulario tiene que poder decir **qué** falta: «no es
 * válida» obliga a adivinar.
 *
 * No se piden mayúsculas ni símbolos. Esas reglas empujan a `Password1!`, que
 * es peor que una frase larga, y el largo mínimo con una clave elegida por la
 * persona ya cubre el caso que importa acá: que no quede la que vino por mail.
 */
export function problemaDeClave(clave: string, repetida?: string): string | null {
  const c = String(clave ?? '');
  if (c.length < LARGO_MINIMO_CLAVE) {
    return `La contraseña tiene que tener al menos ${LARGO_MINIMO_CLAVE} caracteres.`;
  }
  if (repetida !== undefined && c !== repetida) return 'Las dos contraseñas no coinciden.';
  return null;
}

/**
 * El enlace que va en el correo.
 *
 * Se arma acá y no en el hook para que el mail y la pantalla que lo recibe no
 * puedan discrepar: si una arma `?invitacion=` y la otra lee `?token=`, el
 * enlace no falla — abre el CRM como si nada y la persona no entiende por qué
 * le pide usuario y contraseña.
 */
export const PARAMETRO_INVITACION = 'invitacion';

export function enlaceDeInvitacion(appUrl: string, token: string): string {
  const base = String(appUrl ?? '').replace(/\/+$/, '');
  return `${base}/?${PARAMETRO_INVITACION}=${encodeURIComponent(token)}`;
}

export interface Correo {
  asunto: string;
  /** Texto plano. El HTML lo arma el hook a partir de esto. */
  cuerpo: string;
}

/**
 * El correo de invitación.
 *
 * Dice tres cosas y nada más: quién lo invitó, con qué usuario entra, y el
 * botón. Un correo con instrucciones de más se lee en diagonal y la persona
 * termina escribiendo para preguntar lo que estaba escrito.
 *
 * El usuario se nombra explícitamente porque no es obvio: se entra con el
 * email, no con un nombre de usuario, y esa es la primera pregunta que hace
 * todo el mundo.
 */
export function correoDeInvitacion(opciones: {
  nombre: string;
  email: string;
  quienInvita: string;
  enlace: string;
  dias?: number;
}): Correo {
  const { nombre, email, quienInvita, enlace } = opciones;
  const dias = opciones.dias ?? DIAS_DE_INVITACION;
  const saludo = nombre.trim() ? `Hola ${nombre.trim().split(/\s+/)[0]},` : 'Hola,';
  return {
    asunto: 'Tu acceso al CRM de Globalita',
    cuerpo: [
      saludo,
      '',
      `${quienInvita} te dio acceso al CRM de prospección.`,
      '',
      `Vas a entrar con este usuario: ${email}`,
      '',
      'Para elegir tu contraseña, entrá acá:',
      enlace,
      '',
      `El enlace sirve una sola vez y vence en ${dias} días. Si se te vence, pedile otro a ${quienInvita}.`,
    ].join('\n'),
  };
}

/**
 * El correo de cuando el administrador reinicia una contraseña.
 *
 * Mismo mecanismo que el alta —enlace, no clave— por la misma razón. Cambia el
 * texto porque la situación es otra: acá la persona ya conocía el CRM y lo que
 * necesita saber es que su clave anterior dejó de servir.
 */
export function correoDeReinicio(opciones: {
  nombre: string;
  email: string;
  quienInvita: string;
  enlace: string;
  dias?: number;
}): Correo {
  const { nombre, email, quienInvita, enlace } = opciones;
  const dias = opciones.dias ?? DIAS_DE_INVITACION;
  const saludo = nombre.trim() ? `Hola ${nombre.trim().split(/\s+/)[0]},` : 'Hola,';
  return {
    asunto: 'Volvé a elegir tu contraseña del CRM',
    cuerpo: [
      saludo,
      '',
      `${quienInvita} reinició tu contraseña del CRM. La anterior ya no sirve.`,
      '',
      `Tu usuario sigue siendo: ${email}`,
      '',
      'Para elegir una nueva, entrá acá:',
      enlace,
      '',
      `El enlace sirve una sola vez y vence en ${dias} días.`,
      '',
      'Si no pediste esto, avisale a quien administra el CRM.',
    ].join('\n'),
  };
}
