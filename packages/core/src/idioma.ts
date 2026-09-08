// Idioma sugerido. Implementa §5.6 del manual y las
// decisiones D09 (campo idioma en el lead) y D28 (países que faltaban).

import type { Idioma } from './tipos.ts';

/**
 * País → idioma (§5.6, corregido por D28). Portugal y Angola entran a `pt`
 * junto con Brasil y Mozambique. El resto de América Latina hispanohablante
 * y España quedan en `es`, agregando lo que el manual original dejaba afuera:
 * Ecuador, Venezuela y toda Centroamérica. `en` es el default fuera de la región,
 * no una lista aparte: así ningún país nuevo cae en inglés por omisión.
 */
const PAISES_PT = ['brasil', 'mozambique', 'portugal', 'angola'];

const PAISES_ES = [
  'argentina', 'mexico', 'uruguay', 'chile', 'colombia', 'peru', 'paraguay',
  'bolivia', 'espana', 'ecuador', 'venezuela', 'costa rica', 'panama',
  'guatemala', 'honduras', 'el salvador', 'nicaragua', 'republica dominicana',
  'cuba', 'puerto rico',
];

const ISO2: Record<string, string> = {
  br: 'brasil', mz: 'mozambique', pt: 'portugal', ao: 'angola',
  ar: 'argentina', mx: 'mexico', uy: 'uruguay', cl: 'chile', co: 'colombia',
  pe: 'peru', py: 'paraguay', bo: 'bolivia', es: 'espana', ec: 'ecuador',
  ve: 'venezuela', cr: 'costa rica', pa: 'panama', gt: 'guatemala',
  hn: 'honduras', sv: 'el salvador', ni: 'nicaragua', do: 'republica dominicana',
  cu: 'cuba', pr: 'puerto rico',
};

function normalizar(pais: string): string {
  const p = (pais ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
  return ISO2[p] ?? p;
}

/**
 * El idioma que se sugiere por país. Acepta ISO-2 y nombre completo (§5.6),
 * porque los CSV llegan de las dos formas. Es una sugerencia: D09 permite
 * que el usuario la pise, y esa elección se guarda aparte.
 */
export function idiomaSugerido(pais: string): Idioma {
  const p = normalizar(pais);
  if (PAISES_PT.includes(p)) return 'pt';
  if (PAISES_ES.includes(p)) return 'es';
  return 'en';
}

/**
 * D09: el idioma efectivo de un lead. Si hay override guardado, ese manda;
 * si no, se infiere del país. Resuelve el caso del brasileño radicado en
 * México, que con la sola inferencia por país se sugería mal para siempre.
 */
export function idiomaEfectivo(lead: { idioma?: Idioma | null; pais: string }): Idioma {
  return lead.idioma ?? idiomaSugerido(lead.pais);
}
