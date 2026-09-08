// Plantillas del repositorio. Implementa docs/02-modelo/plantilla.md (§3.5, §5.2)
// y la decisión docs/04-decisiones/D16-plantilla-por-paso.md.

import type { Idioma, Paso } from './tipos.ts';
import { NOMBRE_CASA, type Casa } from './proyecto.ts';

/** Una plantilla del repositorio. El `paso` la ata a la cadencia, no el nombre (D16). */
export interface Plantilla {
  id: string;
  /** Libre y editable. Renombrar no rompe nada. */
  nombre: string;
  /** Lo que la ata al paso de la cadencia. `null` = suelta, solo para usar a mano. */
  paso: Paso | 'agradecimiento' | null;
  /** La que usa la automatización y la que precarga Vencimientos (D16). */
  por_defecto: boolean;
  /** Textos por idioma. Pueden faltar (§3.5). */
  textos: Partial<Record<Idioma, string>>;
  orden: number;
}

/** Los datos del lead que se pueden meter en el texto (§3.5). */
export interface Contexto {
  nombre?: string;
  empresa?: string;
  industria?: string;
  ciudad?: string;
  tema?: string;
}

/**
 * Genéricos por idioma, para cuando el campo viene vacío (§3.5: "su planta" /
 * "sua planta"). Sin esto, un CSV con la empresa en blanco produce mensajes con
 * un hueco a la vista, que es peor que un genérico.
 */
const GENERICO: Record<Idioma, Required<Contexto>> = {
  es: {
    nombre: '',
    empresa: 'su planta',
    industria: 'su sector',
    ciudad: 'su zona',
    tema: 'el proceso',
  },
  pt: {
    nombre: '',
    empresa: 'sua planta',
    industria: 'seu setor',
    ciudad: 'sua região',
    tema: 'o processo',
  },
  en: {
    nombre: '',
    empresa: 'your plant',
    industria: 'your sector',
    ciudad: 'your area',
    tema: 'the process',
  },
};

/** El primer nombre, que es lo que `{nombre}` reemplaza (§3.5). */
export function primerNombre(nombreCompleto: string): string {
  const limpio = (nombreCompleto ?? '').trim();
  if (!limpio) return '';
  // Los nombres de LinkedIn traen el cargo adentro con separadores (§3.2):
  // "Maria Fernandez - Gerente de Compras" -> corta antes del separador.
  const sinCargo = limpio.split(/\s+[-–|·]\s+/)[0]!;
  return sinCargo.split(/\s+/)[0] ?? '';
}

/**
 * Reemplaza las variables de una plantilla con los datos del lead.
 * Una variable sin dato usa el genérico del idioma; `{nombre}` vacío no tiene
 * genérico razonable, así que se limpia el saludo en vez de dejar un hueco.
 */
export function resolverTexto(texto: string, ctx: Contexto, idioma: Idioma): string {
  const generico = GENERICO[idioma];
  const valores: Required<Contexto> = {
    nombre: primerNombre(ctx.nombre ?? ''),
    empresa: ctx.empresa?.trim() || generico.empresa,
    industria: ctx.industria?.trim() || generico.industria,
    ciudad: ctx.ciudad?.trim() || generico.ciudad,
    tema: ctx.tema?.trim() || generico.tema,
  };

  let salida = texto.replace(/\{(nombre|empresa|industria|ciudad|tema)\}/g, (_, k: string) => {
    return valores[k as keyof Contexto] ?? '';
  });

  // Sin nombre queda "Hola ," o "Olá ,": se limpia la coma y el espacio sobrante.
  if (!valores.nombre) {
    salida = salida.replace(/([ \t]+)([,!:])/g, '$2').replace(/[ \t]{2,}/g, ' ');
  }
  return salida;
}

export type ResultadoPlantilla =
  | { hay: true; plantilla: Plantilla; texto: string; idioma: Idioma }
  /**
   * §5.2: si el paso no tiene plantilla, o la plantilla no tiene ese idioma,
   * **hay que avisarlo, no inventarlo**. Por eso esto no cae a un texto vacío
   * ni a otro idioma sin decirlo.
   */
  | { hay: false; motivo: 'sin_plantilla' | 'sin_idioma'; plantilla?: Plantilla };

/** Las plantillas de un paso, la de por defecto primero (D16). */
export function plantillasDe(
  plantillas: Plantilla[],
  paso: Paso | 'agradecimiento',
): Plantilla[] {
  return plantillas
    .filter((p) => p.paso === paso)
    .sort((a, b) => Number(b.por_defecto) - Number(a.por_defecto) || a.orden - b.orden);
}

/**
 * Resuelve qué texto mandar para un paso, en un idioma, con los datos del lead.
 * Si se pasa `plantillaId`, usa esa; si no, la de por defecto del paso.
 */
export function resolverParaPaso(
  plantillas: Plantilla[],
  paso: Paso | 'agradecimiento',
  idioma: Idioma,
  ctx: Contexto,
  plantillaId?: string,
): ResultadoPlantilla {
  const candidatas = plantillasDe(plantillas, paso);
  const elegida = plantillaId
    ? plantillas.find((p) => p.id === plantillaId)
    : candidatas[0];

  if (!elegida) return { hay: false, motivo: 'sin_plantilla' };

  const bruto = elegida.textos[idioma];
  if (!bruto) return { hay: false, motivo: 'sin_idioma', plantilla: elegida };

  return { hay: true, plantilla: elegida, idioma, texto: resolverTexto(bruto, ctx, idioma) };
}

// ---------------------------------------------------------------- destacados
//
// Un mensaje destacado aparece como chip en «Enviar mensaje» y reemplaza el
// texto de un clic. El ALCANCE dice para qué cuentas: no todas mandan lo mismo
// —AL trabaja directores financieros y ED maquinaria— y un chip que aparece en
// la cuenta equivocada se usa una vez, sale mal, y después nadie usa los chips.

/**
 * Dónde se destaca un mensaje.
 *
 * `casa` se agregó el 08/09/2026 y es la que resuelve el problema real: sin
 * ella, «los mensajes de Globalita» había que escribirlos listando sus cinco
 * cuentas, y **la cuenta que se sumara después empezaba sin ningún destacado**.
 * Nadie se entera de eso: no hay error, simplemente a esa persona le faltan
 * chips. Con `casa`, la cuenta nueva los hereda sola.
 */
export type Alcance =
  | { tipo: 'ninguno' }
  | { tipo: 'todas' }
  | { tipo: 'casa'; casa: Casa }
  | { tipo: 'cuentas'; cuentas: string[] };

export const SIN_ALCANCE: Alcance = { tipo: 'ninguno' };

/** El texto que se guarda en `plantilla.destacado`. */
export function escribirAlcance(a: Alcance): string {
  if (a.tipo === 'ninguno') return '';
  if (a.tipo === 'todas') return 'todas';
  // El prefijo distingue la casa de una abreviatura de cuenta: sin él,
  // «seng» y una cuenta llamada SENG se guardarían igual.
  if (a.tipo === 'casa') return `casa:${a.casa}`;
  return a.cuentas.join(',');
}

/**
 * Lee el alcance guardado.
 *
 * Tolera lo escrito a mano y lo viejo: «todas las cuentas», «TODAS», «AL, DL»
 * con o sin espacios. Un dato de configuración que se rompe porque alguien
 * puso una mayúscula es un dato que va a estar roto.
 */
export function leerAlcance(texto: string | null | undefined): Alcance {
  const t = String(texto ?? '').trim();
  if (!t) return SIN_ALCANCE;
  if (/^todas/i.test(t)) return { tipo: 'todas' };
  const casa = /^casa:\s*(globalita|seng)$/i.exec(t);
  if (casa) return { tipo: 'casa', casa: casa[1]!.toLowerCase() as Casa };
  const cuentas = t
    .split(',')
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
  return cuentas.length ? { tipo: 'cuentas', cuentas } : SIN_ALCANCE;
}

/** Cómo se lee el alcance en la pantalla. */
export function nombreDeAlcance(a: Alcance): string {
  if (a.tipo === 'ninguno') return '';
  if (a.tipo === 'todas') return 'todas las cuentas';
  if (a.tipo === 'casa') return `todo ${NOMBRE_CASA[a.casa]}`;
  return a.cuentas.join(', ');
}

/**
 * Si esta plantilla se destaca en esa cuenta.
 *
 * Sin cuenta activa se muestran solo las de alcance «todas»: mostrar las de
 * una cuenta cualquiera sería mostrar el chip de otro.
 */
export function estaDestacadaPara(
  destacado: string | null | undefined,
  cuentaAbrev: string,
  casaDeLaCuenta?: Casa | null,
): boolean {
  const a = leerAlcance(destacado);
  if (a.tipo === 'ninguno') return false;
  if (a.tipo === 'todas') return true;
  // Sin saber de qué casa es la cuenta no se puede decidir, y adivinar sería
  // mostrarle a alguien los chips de la otra empresa.
  if (a.tipo === 'casa') return Boolean(casaDeLaCuenta) && a.casa === casaDeLaCuenta;
  return Boolean(cuentaAbrev) && a.cuentas.includes(cuentaAbrev.trim().toUpperCase());
}

/**
 * Mover un mensaje a la posición de otro.
 *
 * Devuelve el `orden` de TODOS, igual que las listas de invitación: guardando
 * solo el par que se cruza, dos arrastres seguidos dejan números repetidos y
 * el orden pasa a decidirlo el desempate, que no es lo que nadie eligió.
 */
export function reordenar(
  lista: { id: string; orden?: number }[],
  origenId: string,
  destinoId: string,
): { id: string; orden: number }[] {
  if (origenId === destinoId) return [];
  const orden = lista.slice().sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  const i = orden.findIndex((m) => m.id === origenId);
  const j = orden.findIndex((m) => m.id === destinoId);
  if (i < 0 || j < 0) return [];
  const [item] = orden.splice(i, 1);
  orden.splice(j, 0, item);
  return orden.map((m, k) => ({ id: m.id, orden: k + 1 }));
}

/**
 * Agrega una cuenta al alcance de un destacado.
 *
 * Si ya era «todas», se queda en «todas»: agregar una cuenta a un destacado
 * global no lo hace más chico. Es el error que se comete al tocar la estrella
 * desde la ficha sin mirar que ya estaba destacado en todas.
 */
export function conCuenta(a: Alcance, cuenta: string): Alcance {
  const c = cuenta.trim().toUpperCase();
  if (!c) return a;
  // «Todas» y «toda una casa» ya la incluyen o la deciden en bloque: agregarle
  // una cuenta suelta no lo hace más grande, lo rompe.
  if (a.tipo === 'todas' || a.tipo === 'casa') return a;
  const cuentas = a.tipo === 'cuentas' ? a.cuentas : [];
  return cuentas.includes(c) ? { tipo: 'cuentas', cuentas } : { tipo: 'cuentas', cuentas: [...cuentas, c] };
}

/**
 * Saca una cuenta del alcance.
 *
 * Sacar la única que quedaba deja el mensaje SIN destacar, no con una lista
 * vacía: una lista vacía y «ninguno» se ven igual en la pantalla, pero se
 * guardan distinto, y después el filtro por alcance no coincide con nada.
 *
 * Sobre «todas»: se convierte en la lista de las demás. Quitar el chip de una
 * cuenta no puede apagarlo para el resto del equipo sin avisar — quien lo
 * quiera apagar para todos lo hace desde el Repositorio, que es donde se ve el
 * alcance completo.
 */
export function sinCuenta(a: Alcance, cuenta: string, todasLasCuentas: string[] = []): Alcance {
  const c = cuenta.trim().toUpperCase();
  if (!c || a.tipo === 'ninguno') return a;
  // Sacar una cuenta de un alcance por casa lo desarmaría en una lista y le
  // haría perder justamente lo que lo hace útil: que las cuentas nuevas lo
  // hereden. Se cambia desde el Repositorio, donde se ve el alcance entero.
  if (a.tipo === 'casa') return a;
  if (a.tipo === 'todas') {
    const resto = todasLasCuentas.map((x) => x.trim().toUpperCase()).filter((x) => x && x !== c);
    return resto.length ? { tipo: 'cuentas', cuentas: resto } : SIN_ALCANCE;
  }
  const cuentas = a.cuentas.filter((x) => x !== c);
  return cuentas.length ? { tipo: 'cuentas', cuentas } : SIN_ALCANCE;
}
