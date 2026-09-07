// Plantillas del repositorio. Implementa docs/02-modelo/plantilla.md (§3.5, §5.2)
// y la decisión docs/04-decisiones/D16-plantilla-por-paso.md.

import type { Idioma, Paso } from './tipos.ts';

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
