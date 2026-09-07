// Ruteo de WhatsApp entrante. Implementa docs/01-negocio/ruteo-whatsapp.md y
// la decisión docs/04-decisiones/D08-telefono-como-clave.md.
//
// Depende de que el teléfono viva en `perfil`, no en `lead` (ver telefono.ts):
// un WhatsApp entrante se busca UNA vez, contra la identidad de la persona,
// no contra cada relación de trabajo por separado.

/** Un lead de un perfil, visto desde el ángulo que importa acá: a qué cuenta pertenece. */
export interface LeadDeCuenta {
  lead_id: string;
  cuenta_id: string;
}

/** Lo que hace falta saber de un perfil candidato para decidir el ruteo. */
export interface PerfilConTelefono {
  perfil_id: string;
  telefono: string;
  /** Los leads de este perfil, en cualquier cuenta. Puede tener más de uno (D27). */
  leads: LeadDeCuenta[];
}

export type ResultadoRuteo =
  /** No coincide ningún perfil: queda como entrante nuevo, con las tres salidas de §5.8. */
  | { accion: 'desconocido' }
  /**
   * Coincide un único perfil y ya tiene un lead en la cuenta que recibió el mensaje.
   * Regla original de §5.8: el mensaje entra solo al follow-up, no se crea nada nuevo.
   */
  | { accion: 'conocido_en_esta_cuenta'; perfil_id: string; lead_id: string }
  /**
   * Coincide un único perfil, pero no tiene lead bajo ESTA cuenta (lo trabaja otra,
   * o no tiene ningún lead todavía). No se auto-asigna: la persona que atiende el
   * entrante ve quién es y decide — "Mover a FU" acá crea un lead nuevo bajo esta
   * cuenta enlazado al MISMO perfil, nunca un perfil duplicado.
   */
  | { accion: 'conocido_otra_cuenta'; perfil_id: string; leads_otras_cuentas: LeadDeCuenta[] }
  /**
   * El teléfono coincide con más de un perfil (dato sucio: línea compartida,
   * error de carga). Nunca se le cuelga el mensaje al lead equivocado: queda
   * para elegir a mano, con la lista de candidatos.
   */
  | { accion: 'ambiguo'; candidatos: string[] };

/**
 * Decide qué hacer con un WhatsApp entrante, ya con el teléfono normalizado
 * (ver telefono.ts) y sabiendo en qué cuenta llegó.
 *
 * No hace I/O: `candidatos` ya viene resuelto por quien llama (los perfiles
 * cuyo `telefono` coincide). El "últimos 8 dígitos" del manual original queda
 * como responsabilidad de quien arma `candidatos` para el caso de un teléfono
 * mal normalizado (D29: "revisar teléfono") — acá la decisión ya asume que el
 * candidato es correcto.
 */
export function decidirRuteoEntrante(
  cuentaReceptoraId: string,
  candidatos: PerfilConTelefono[],
): ResultadoRuteo {
  if (candidatos.length === 0) return { accion: 'desconocido' };

  if (candidatos.length > 1) {
    return { accion: 'ambiguo', candidatos: candidatos.map((c) => c.perfil_id) };
  }

  const perfil = candidatos[0]!;
  const leadEnEstaCuenta = perfil.leads.find((l) => l.cuenta_id === cuentaReceptoraId);

  if (leadEnEstaCuenta) {
    return {
      accion: 'conocido_en_esta_cuenta',
      perfil_id: perfil.perfil_id,
      lead_id: leadEnEstaCuenta.lead_id,
    };
  }

  return {
    accion: 'conocido_otra_cuenta',
    perfil_id: perfil.perfil_id,
    leads_otras_cuentas: perfil.leads,
  };
}
