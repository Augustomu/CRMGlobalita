// Los links de LinkedIn.
//
// El perfil se guarda como SLUG, no como URL (`perfil.slug`). El slug es la
// identidad —lo que permite reconocer que dos filas son la misma persona— y la
// URL es una de las muchas formas de escribirlo: con `www` o sin, con
// `/in/`, con barra al final, con `?originalSubdomain=br`, con `utm_*`
// pegados por quien la compartió. Guardando la URL entera, la misma persona
// entra dos veces.

const BASE = 'https://www.linkedin.com/in/';

/**
 * El slug que hay adentro de lo que sea que hayan pegado.
 *
 * Acepta la URL completa, la URL sin protocolo, o el slug pelado. Devuelve ''
 * si no hay nada reconocible, para que quien llama decida — no inventa un slug
 * a partir de un texto cualquiera.
 */
export function slugDeLinkedIn(entrada: string): string {
  const t = String(entrada ?? '').trim();
  if (!t) return '';

  // Corta la query y el fragmento: `?originalSubdomain=br` y `#main` no son
  // parte de la identidad y varían según quién copió el link.
  const sinCola = t.split('?')[0].split('#')[0];

  const m = sinCola.match(/linkedin\.com\/in\/([^/]+)/i);
  const crudo = m ? m[1] : sinCola.includes('/') || sinCola.includes('.') ? '' : sinCola;

  return decodeURIComponent(crudo.replace(/\/+$/, '')).trim();
}

/** La URL pública del perfil. Vacío si no hay slug: mejor nada que un link roto. */
export function urlDePerfil(slug: string): string {
  const s = String(slug ?? '').trim();
  return s ? BASE + s : '';
}

/**
 * Si el link del chat parece un hilo de mensajería de LinkedIn.
 *
 * No se puede deducir del perfil —LinkedIn lo arma con un id de conversación
 * que solo existe una vez que alguien abrió el hilo— así que lo único que se
 * puede hacer es avisar cuando lo pegado claramente no es eso.
 */
export function pareceHiloDeChat(url: string): boolean {
  const t = String(url ?? '').trim();
  if (!t) return true; // vacío es válido: todavía no lo cargaron
  return /linkedin\.com\/messaging\//i.test(t) || /wa\.me\//i.test(t) || /web\.whatsapp\.com/i.test(t);
}
