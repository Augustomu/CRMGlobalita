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

