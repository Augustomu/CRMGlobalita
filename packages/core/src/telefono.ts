// Normalización de teléfono. Implementa §5.7 del manual
// y la decisión D29 (manual §14).
//
// D08 depende de esto: el teléfono
// vive en `perfil` (identidad), no en `lead`, y el ruteo de WhatsApp entrante
// busca por el valor que esta normalización produce.

/**
 * Código de país por nombre de país (§5.7). No es "configuración" en el sentido
 * de CLAUDE.md regla 2 — son códigos asignados por la UIT, no una política que
 * el negocio ajuste. Las claves están en minúsculas y sin acentos para que
 * `paisNormalizado()` pueda buscar directo.
 */
const CODIGO_PAIS: Record<string, string> = {
  brasil: '55',
  mexico: '52',
  argentina: '54',
  uruguay: '598',
  chile: '56',
  colombia: '57',
  peru: '51',
  paraguay: '595',
  bolivia: '591',
  mozambique: '258',
  portugal: '351',
  espana: '34',
};

/** ISO-2 → mismo código. Los CSV llegan de las dos formas (§5.6). */
const ISO2_A_PAIS: Record<string, string> = {
  br: 'brasil',
  mx: 'mexico',
  ar: 'argentina',
  uy: 'uruguay',
  cl: 'chile',
  co: 'colombia',
  pe: 'peru',
  py: 'paraguay',
  bo: 'bolivia',
  mz: 'mozambique',
  pt: 'portugal',
  es: 'espana',
};

function paisNormalizado(pais: string): string {
  const p = (pais ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
  return ISO2_A_PAIS[p] ?? p;
}

export function codigoDePais(pais: string): string | undefined {
  return CODIGO_PAIS[paisNormalizado(pais)];
}

export interface ResultadoTelefono {
  /** E.164 sin el '+', mejor esfuerzo. Vacío si no se pudo armar nada usable. */
  valor: string;
  /** Tal como vino, sin tocar. Nunca se pierde (D29). */
  raw: string;
  /**
   * false = "revisar teléfono" (D29): el lead se crea igual, el botón de
   * WhatsApp queda deshabilitado con el motivo a la vista.
   */
  valido: boolean;
  motivo?: string;
}

/**
 * Normaliza un teléfono a E.164 (sin '+'), usando el país del lead como región
 * por defecto (§5.7). Cubre las rarezas de la región documentadas en D29:
 * el 0 de larga distancia, el 15 argentino, y números que ya vienen con código.
 *
 * No usa una librería de terceros: el alcance son los 12 países de la tabla
 * §5.7, con reglas fijas y conocidas — una librería genérica de e.164 mundial
 * sería una dependencia pesada para un problema acotado.
 */
export function normalizarTelefono(crudo: string, pais: string): ResultadoTelefono {
  const raw = crudo ?? '';
  const digitos = raw.replace(/[^\d]/g, '');
  const codigo = codigoDePais(pais);

  if (!digitos) {
    return { valor: '', raw, valido: false, motivo: 'sin número' };
  }
  if (!codigo) {
    return { valor: digitos, raw, valido: false, motivo: `país sin código conocido: "${pais}"` };
  }

  // Ya viene con el código del país adelante.
  if (digitos.startsWith(codigo)) {
    return finalizar(digitos, codigo, raw);
  }

  // 0 de larga distancia (Argentina, Uruguay, Brasil en formato antiguo, etc).
  const sinCero = digitos.replace(/^0+/, '');

  // Argentina: "011 15-1234-5678" -> el 15 va después del código de área, no
  // al principio. Lo sacamos solo para Argentina, donde es una convención fija.
  if (codigo === '54') {
    const sinQuince = sinCero.replace(/^(\d{2,4})15(\d{6,8})$/, '$1$2');
    return finalizar(codigo + sinQuince, codigo, raw);
  }

  return finalizar(codigo + sinCero, codigo, raw);
}

/** Un E.164 razonable mide entre 8 y 15 dígitos totales (código + número). */
function finalizar(candidato: string, codigo: string, raw: string): ResultadoTelefono {
  const total = candidato.length;
  const resto = candidato.slice(codigo.length);
  if (total < 9 || total > 15 || resto.length < 6) {
    return { valor: candidato, raw, valido: false, motivo: 'no da un número válido' };
  }
  return { valor: candidato, raw, valido: true };
}

/**
 * Transforma un E.164 (sin '+') al formato que necesita wa.me, aplicando las
 * dos rarezas de la región que el manual pide explícitamente (§5.7):
 *
 *  - Argentina necesita el 9 después del 54, o el link de WhatsApp no abre.
 *  - Brasil: los celulares llevan un 9° dígito antes del número de 8 cifras;
 *    los que vienen en formato viejo (sin ese 9) se completan.
 *
 * Recibe el mismo E.164 que ya se guardó — no vuelve a adivinar el país.
 */
export function paraWhatsApp(e164: string): string {
  if (e164.startsWith('54') && !e164.startsWith('549')) {
    return `549${e164.slice(2)}`;
  }
  if (e164.startsWith('55')) {
    const resto = e164.slice(2); // area (2) + número
    const area = resto.slice(0, 2);
    const numero = resto.slice(2);
    // Celular sin el 9°: 8 dígitos empezando en 6-9 (rango de las líneas móviles).
    if (numero.length === 8 && /^[6-9]/.test(numero)) {
      return `55${area}9${numero}`;
    }
  }
  return e164;
}

/** Link directo de WhatsApp (§5.7). `undefined` si el teléfono no es válido. */
export function linkWhatsApp(tel: Pick<ResultadoTelefono, 'valor' | 'valido'>): string | undefined {
  if (!tel.valido || !tel.valor) return undefined;
  return `https://wa.me/${paraWhatsApp(tel.valor)}`;
}
