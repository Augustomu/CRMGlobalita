import { ddmmaa } from './fecha.ts';

// Identidad de un perfil y detección de duplicados.
// Implementa D02 (manual §14).

/** Los tres identificadores de un perfil (D02). */
export interface IdentidadPerfil {
  /** Tramo de /in/... normalizado. Vacío si el perfil llegó sin URL pública. */
  slug: string;
  /** Id de Sales Navigator (ACwAAA...). Vacío si no vino de ahí. */
  urn: string;
  /** nombre|empresa normalizados. Nunca es clave única: solo sugiere. */
  huella: string;
}

/**
 * Saca el slug de cualquier forma de URL de perfil.
 * Devuelve '' si la URL no es un perfil público (por ejemplo una de Sales Navigator).
 */
export function normalizarSlug(url: string): string {
  if (!url) return '';
  const m = url.match(/\/in\/([^/?#]+)/i);
  if (!m) return '';
  return decodeURIComponent(m[1]!).trim().toLowerCase().replace(/\/+$/, '');
}

/** Saca el URN de una URL de Sales Navigator. Devuelve '' si no hay. */
export function extraerUrn(url: string): string {
  if (!url) return '';
  const m = url.match(/\/sales\/(?:lead|people)\/([^,/?#]+)/i);
  return m ? m[1]!.trim() : '';
}

/** Quita acentos, puntuación y espacios de más. */
export function normalizarTexto(s: string): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Saca también los espacios. Es lo que hace que "Vale S.A." y "Vale SA" den lo
 * mismo, que es la variante de sufijo más común en los CSV de la región.
 */
function compactar(s: string): string {
  return normalizarTexto(s).replace(/\s+/g, '');
}

/**
 * Huella para sugerir duplicados: nombre + empresa compactados.
 *
 * Es deliberadamente laxa: como nunca fusiona sola (D02) sino que marca el perfil
 * como posible duplicado para que lo revise una persona, conviene que sugiera de
 * más antes que dejar pasar duplicados reales.
 */
export function huella(nombre: string, empresa: string): string {
  const n = compactar(nombre);
  const e = compactar(empresa);
  if (!n) return '';
  return `${n}|${e}`;
}

export function identidad(entrada: {
  url?: string;
  url_sales?: string;
  nombre: string;
  empresa?: string;
}): IdentidadPerfil {
  return {
    slug: normalizarSlug(entrada.url ?? '') || normalizarSlug(entrada.url_sales ?? ''),
    urn: extraerUrn(entrada.url_sales ?? '') || extraerUrn(entrada.url ?? ''),
    huella: huella(entrada.nombre, entrada.empresa ?? ''),
  };
}

export type Veredicto =
  | { accion: 'mismo'; perfil_id: string; completar: Partial<IdentidadPerfil> }
  | { accion: 'nuevo' }
  | { accion: 'nuevo_posible_duplicado'; candidatos: string[] };

interface PerfilConocido {
  id: string;
  slug: string;
  urn: string;
  huella: string;
}

/**
 * Decide qué hacer con un perfil que entra, contra los que ya existen (D02).
 *
 * 1. Coincide slug o urn -> es el mismo, y se completa el identificador que faltaba.
 *    Este paso es el que une el perfil scrapeado de Sales Navigator con el mismo
 *    perfil importado después por CSV.
 * 2. Coincide huella -> entra igual, marcado como posible duplicado.
 * 3. No coincide nada -> perfil nuevo.
 */
export function decidirAlta(entrante: IdentidadPerfil, conocidos: PerfilConocido[]): Veredicto {
  const porId = conocidos.find(
    (p) =>
      (entrante.slug && p.slug === entrante.slug) ||
      (entrante.urn && p.urn === entrante.urn),
  );

  if (porId) {
    const completar: Partial<IdentidadPerfil> = {};
    if (entrante.slug && !porId.slug) completar.slug = entrante.slug;
    if (entrante.urn && !porId.urn) completar.urn = entrante.urn;
    return { accion: 'mismo', perfil_id: porId.id, completar };
  }

  const candidatos = entrante.huella
    ? conocidos.filter((p) => p.huella === entrante.huella).map((p) => p.id)
    : [];

  return candidatos.length
    ? { accion: 'nuevo_posible_duplicado', candidatos }
    : { accion: 'nuevo' };
}


/* ---------------------------------------------------------------------------
 * Hasta dónde llega el detector (D02)
 * ------------------------------------------------------------------------ */

/**
 * Los datos con los que se puede CONFIRMAR que dos perfiles son la misma
 * persona.
 *
 * El detector (`packages/db/recuperacion/detectar-duplicados.mjs`) nunca marca
 * por nombre solo: empareja por teléfono repetido, por huella nombre+empresa, o
 * por un apellido que aparece en el slug de LinkedIn o en el correo del lead.
 * Los tres caminos necesitan alguno de estos cuatro campos, y es a propósito —
 * emparejar por nombre de pila daba 181 grupos y hay dos personas distintas
 * compartiendo un teléfono.
 *
 * La consecuencia, que es lo que esto sirve para poder decir: un perfil que no
 * tiene NINGUNO de los cuatro es invisible para el detector. No es que no tenga
 * duplicados: es que no hay forma de saberlo. La bandeja tiene que decirlo,
 * porque si no un cero se lee como «está todo limpio».
 */
export const DATOS_QUE_CONFIRMAN = ['slug', 'urn', 'telefono', 'empresa'] as const;

export type DatoQueConfirma = (typeof DATOS_QUE_CONFIRMAN)[number];

/** Un perfil que el detector no puede ver, porque no tiene con qué confirmarse. */
export function sinConQueConfirmar(
  p: Partial<Record<DatoQueConfirma, string | null | undefined>>,
): boolean {
  return DATOS_QUE_CONFIRMAN.every((campo) => !String(p[campo] ?? '').trim());
}

/** Lo que hay que contar para saber qué está mostrando la bandeja. */
export interface ConteoDeteccion {
  /** Perfiles no fusionados. */
  vivos: number;
  /** De ésos, los que tienen `posible_duplicado_de` puesto. */
  marcados: number;
  /** De ésos, los que `sinConQueConfirmar` deja fuera del alcance del detector. */
  invisibles: number;
  /**
   * Lo más reciente que se tocó un perfil marcado, en ISO, o '' si no hay
   * ninguno.
   *
   * Es el `updated` del perfil, no una fecha de marcado: no existe esa columna.
   * O sea que es un TECHO —el perfil pudo editarse después de que se lo marcó—
   * y por eso el texto dice «hasta el» y no «marcado el».
   */
  ultima_marca: string;
}

export interface AvisoDeteccion {
  /** El titular: qué es exactamente lo que la bandeja está mostrando. */
  titulo: string;
  /** Los números detrás, para que el cero no se lea como «no hay duplicados». */
  detalle: string;
  /** Hay perfiles que el detector no puede ver. Se pinta como advertencia. */
  ciego: boolean;
}

/**
 * Qué tiene que decir la bandeja de Duplicados sobre sí misma (D02, §7.10).
 *
 * POR QUÉ EXISTE. La pantalla lee los perfiles con `posible_duplicado_de`
 * puesto y no busca nada por su cuenta, así que «0 duplicados» quiere decir
 * «nadie marcó ninguno», que no es lo mismo. El 09/09 los tres perfiles de
 * Herik existían hacía días y la bandeja decía cero.
 *
 * Se eligió decirlo en vez de volver a correr el detector: medido contra la
 * base del 10/09, una corrida nueva encuentra **0 grupos** y además BORRA las
 * marcas que no vuelve a proponer — o sea que se llevaría puesto el único
 * grupo pendiente, que lo marcó una persona a mano.
 */
export function avisoDeDeteccion(c: ConteoDeteccion): AvisoDeteccion {
  const alcance =
    c.invisibles > 0
      ? ` De los ${c.vivos} perfiles vivos, ${c.invisibles} no tienen con qué confirmarse` +
        ' —ni LinkedIn, ni empresa, ni teléfono—, así que el detector no puede verlos.'
      : '';

  if (c.marcados === 0) {
    return {
      titulo: 'Nadie marcó ningún perfil como posible duplicado',
      detalle:
        'Esta bandeja muestra lo marcado; no busca por su cuenta.' +
        alcance +
        ' Cero acá no quiere decir que no haya duplicados.',
      ciego: c.invisibles > 0,
    };
  }

  const cuando = c.ultima_marca ? `, hasta el ${ddmmaa(c.ultima_marca)}` : '';
  return {
    titulo: `${c.marcados} ${c.marcados === 1 ? 'perfil marcado' : 'perfiles marcados'}${cuando}`,
    detalle: 'Es lo marcado; la bandeja no busca por su cuenta.' + alcance,
    ciego: c.invisibles > 0,
  };
}
