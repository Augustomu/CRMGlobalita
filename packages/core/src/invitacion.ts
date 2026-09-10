// Las listas de invitación y el cupo (§7.3 «Invitaciones», §8.1).
//
// Cada cuenta de LinkedIn tiene listas (de Sales Navigator o de un CSV) con un
// orden de prioridad. El script trabaja UNA a la vez: la de prioridad más alta
// que todavía tenga páginas. Cuando se agota, pasa a la siguiente.
//
// El cupo diario de la cuenta manda sobre cuántos perfiles saca por día, y
// existe para no gatillar los límites de la plataforma (§8.1). Es configurable
// porque el límite real cambia sin aviso.

import { estadoDeSesion } from './sesion.ts';

export type FuenteLista = 'sales_navigator' | 'csv' | 'manual';

export interface ListaInvitacion {
  id: string;
  cuenta: string;
  nombre: string;
  fuente: FuenteLista;
  /**
   * De dónde salen los perfiles (§3.4). En Sales Navigator es el
   * `savedSearchId`; en un CSV, el nombre del archivo importado.
   *
   * Sin esto la lista sabe cómo se llama, de quién es y por qué página va —
   * pero no dónde está, así que el worker no tiene a dónde ir. Se agregó el
   * 10/09 al cargar las 22 búsquedas reales: la familia 11 del registro, «no
   * había dónde guardarlo», encontrada esta vez ANTES de escribir el script.
   */
  origen_id?: string;
  /** Prioridad. 1 es la que trabaja primero. */
  orden: number;
  /** Hasta qué página llegó el script. Dato de la automatización: no se edita. */
  pagina: number;
  paginas: number;
  /** Cuántos perfiles trae una página de esa fuente. */
  por_pagina: number;
}

/**
 * La dirección de una lista, armada a partir de su origen.
 *
 * SE ARMA, NO SE GUARDA. La URL que uno copia del navegador viene con `lipi`
 * y `snfl` pegados atrás: son tracking de la sesión que la generó, cambian en
 * cada visita y no identifican la búsqueda. Guardar eso es guardar algo que
 * envejece mal — la de ayer apunta a una sesión que ya no existe. Con el id
 * sola sale siempre limpia.
 *
 * Un CSV no tiene dirección: devuelve vacío, y quien llame decide qué hacer.
 * Es a propósito que no invente una: un string que parece una URL y no lleva a
 * ningún lado es peor que no tener nada.
 */
export function urlDeLista(
  fuente: FuenteLista,
  origenId: string | null | undefined,
): string {
  const id = String(origenId ?? '').trim();
  if (fuente !== 'sales_navigator' || !id) return '';
  // Sólo dígitos: un savedSearchId es numérico, y cualquier otra cosa acá es
  // un pegado con la URL entera adentro. Armar la dirección con eso daría un
  // link roto que parece bueno.
  if (!/^[0-9]+$/.test(id)) return '';
  return `https://www.linkedin.com/sales/search/people?savedSearchId=${id}`;
}

export type EstadoLista = 'sin medir' | 'agotada' | 'en uso' | 'en espera';

export const NOMBRE_FUENTE: Record<FuenteLista, string> = {
  sales_navigator: 'Sales Navigator',
  csv: 'CSV importado',
  manual: 'Carga manual',
};

/** Los 10 slots de cuenta de §7.3. Es un tope del negocio, no de la base. */
export const SLOTS_DE_CUENTA = 10;

export function estaAgotada(l: ListaInvitacion): boolean {
  return l.pagina >= l.paginas;
}

/**
 * Las listas cuyo total todavía no midió nadie.
 *
 * `paginas` en 0 NO quiere decir «vacía»: quiere decir **«no se sabe»**. Para
 * `estaAgotada` las dos cosas se ven igual —`0 >= 0`— y por eso la lista no
 * entra en la cola, que es lo correcto: una lista cuyo tamaño nadie midió no
 * puede prometer invitaciones (§3.4).
 *
 * Lo que no es correcto es *decirle* «agotada» a la de arriba. El 10/09 las 22
 * búsquedas guardadas de verdad figuraban las 22 como agotadas y la única
 * lectura posible de esa pantalla era «se terminaron», cuando lo que pasaba era
 * «nunca se midieron». Distinguirlas es la diferencia entre ir a cargar listas
 * nuevas y ir a medir las que ya están.
 */
export function sinMedir(listas: ListaInvitacion[]): ListaInvitacion[] {
  return listas.filter((l) => !(l.paginas > 0));
}

// ---------------------------------------------------------------------------
// Medir: de «no se sabe» a un total (§3.4)
// ---------------------------------------------------------------------------
//
// La otra mitad de `sinMedir`. Distinguir «nunca se midió» de «se terminó»
// sirve para saber qué hay que ir a hacer; esto es lo que se va a hacer.
//
// EL TOTAL SE DESCUBRE, NO SE TIPEA. Sales Navigator escribe arriba de la lista
// cuántos resultados tiene la búsqueda («About 1,234 results»), y de ahí sale el
// total de páginas dividiendo por lo que rinde una página. Tipear 22 números a
// mano se hace mal una vez y además envejece solo: una búsqueda guardada crece
// sola, y el número escrito hace un mes sigue diciendo lo de hace un mes.
//
// ACÁ NO HAY NADA DE HTML. Estas funciones reciben un texto y devuelven un
// número. De qué elemento de la página salió ese texto lo sabe
// `apps/worker/src/salesnav.ts`, que es el único archivo con selectores — y
// cuando LinkedIn cambie el DOM se cambia ahí y esta regla no se toca.

/**
 * Hasta dónde pagina Sales Navigator, diga lo que diga el encabezado.
 *
 * ⚠️ **HIPÓTESIS, no verificada contra LinkedIn.** Nadie de este lado pudo
 * abrir Sales Navigator para contarlo. Lo que hay: la plataforma corta el
 * paginado de una búsqueda alrededor de las 100 páginas (2.500 resultados a 25
 * por página), y el repositorio viejo ya lo daba por cierto —
 * `scan-saved-searches.js` tiene `MAX_PAGES_SANO = 100` y capa ahí «por
 * seguridad»— pero eso es una precaución de ese script, no una medición.
 * **Hay que verificarlo contra el DOM real la primera vez que se corra
 * `medir`**, y si el tope resultara otro, se cambia este número y nada más.
 *
 * Se topea igual porque es el error barato. Si el tope real fuera más alto se
 * pierden páginas, y eso se recupera subiendo el número acá. Si no se topeara y
 * el tope existe, la lista promete invitaciones que la búsqueda no puede
 * entregar: la corrida se pasaría las últimas páginas navegando a resultados
 * vacíos, que es tráfico raro contra LinkedIn justo cuando no hace falta.
 * `medidaDelEncabezado` avisa con `topeado` cuando el recorte pasó, así que no
 * es un recorte silencioso.
 */
export const TOPE_DE_PAGINAS = 100;

/**
 * El número del encabezado, en los formatos que LinkedIn sirve de verdad.
 *
 * Los tres idiomas de las cuentas: «About 1,234 results», «Aproximadamente
 * 1.234 resultados», «Cerca de 1.234 resultados», «Más de 2.500 resultados»,
 * «1,234 results», «1 result».
 *
 * **EL SEPARADOR DE MILES ES LA TRAMPA.** En inglés es la coma y en castellano
 * y portugués es el punto, así que el MISMO texto —«1.234»— vale 1234 en una
 * cuenta y sería 1,234 en la otra. Leerlo con `parseFloat`, que es lo que sale
 * solo, convierte «1.234 resultados» en **1**: la lista queda con una página,
 * figura medida, y nadie tiene por qué sospechar. Eso es peor que no medir —
 * una lista sin medir se ve y se va a arreglar; una lista mal medida se cree.
 *
 * NO SE ADIVINA EL IDIOMA, se mira la forma del número. Un conteo de resultados
 * es entero, así que un separador seguido de exactamente tres dígitos, en
 * grupos parejos, es un separador de miles y da igual cuál de los dos sea:
 * «1.234» y «1,234» son los dos 1234. Lo que no tiene esa forma —«1.5», «12.34»,
 * o los dos separadores a la vez— no se interpreta: se devuelve `null`.
 */
function comoEntero(token: string): number | null {
  // `\s` de JavaScript ya cubre los espacios duros y finos (U+00A0, U+202F)
  // que LinkedIn mete adentro de los números. Y un separador colgando al final
  // viene de un «1.234, resultados».
  const limpio = token.replace(/\s/g, '').replace(/[.,]+$/, '');
  if (!limpio) return null;
  if (/^[0-9]+$/.test(limpio)) return Number(limpio);

  const conPunto = limpio.includes('.');
  const conComa = limpio.includes(',');
  // Los dos a la vez: uno es de miles y el otro es decimal. Cuál es cuál
  // depende del idioma de la sesión, que este texto no dice. Un conteo no tiene
  // decimales, así que esto no debería llegar nunca — y si llega, se contesta
  // «no se sabe» en vez de tirar una moneda.
  if (conPunto && conComa) return null;

  // Miles de verdad: grupos de EXACTAMENTE tres. «1.234» sí, «1.5» no.
  const patron = conPunto ? /^[0-9]{1,3}(?:\.[0-9]{3})+$/ : /^[0-9]{1,3}(?:,[0-9]{3})+$/;
  if (!patron.test(limpio)) return null;
  return Number(limpio.replace(/[.,]/g, ''));
}

/**
 * El número pegado a la palabra «resultados», en cualquiera de los tres
 * idiomas. El `+?` del medio come el «1,000+ results» de las búsquedas grandes.
 *
 * **La palabra es obligatoria.** Sin ella cualquier número suelto de la página
 * —el de una página, el de un filtro, el de un badge— pasaría por total.
 */
const ENCABEZADO_DE_RESULTADOS = /([0-9][0-9.,\u00a0\u202f]*)\s*\+?\s*(?:resultados?|results?)\b/i;

/**
 * Cuántos resultados dice un encabezado. `null` = **NO SE SABE**.
 *
 * `null` y no 0, y la diferencia es toda la función. `0` ya significa otra
 * cosa: es lo que hay hoy en las 22 listas y quiere decir «sin medir», que
 * encima se ve igual que «agotada» (ver `sinMedir`). Y un número inventado es
 * peor todavía: hace prometer invitaciones que no existen.
 *
 * `0` sí se devuelve cuando el encabezado dice 0 **con el número escrito**
 * («0 resultados», «0 results»). Eso no es un fracaso de la lectura: es una
 * búsqueda vacía, y quien llama tiene que poder distinguirla de un encabezado
 * que no se entendió. Un «No results» sin dígito, en cambio, es `null`: puede
 * ser una búsqueda vacía o una página que ni siquiera cargó, y no se adivina.
 */
export function resultadosDelEncabezado(texto: string | null | undefined): number | null {
  const encontrado = ENCABEZADO_DE_RESULTADOS.exec(String(texto ?? ''));
  if (!encontrado) return null;
  return comoEntero(encontrado[1]);
}

/**
 * De los resultados al total de páginas.
 *
 * `null` cuando no se puede: sin saber cuánto rinde una página no hay división
 * posible, y devolver 0 sería decir «medida y vacía» de algo que nadie midió.
 */
export function paginasParaResultados(resultados: number, porPagina: number): number | null {
  if (!Number.isFinite(resultados) || resultados < 0) return null;
  const rinde = Math.floor(porPagina);
  if (!Number.isFinite(rinde) || rinde <= 0) return null;
  // La última página va incompleta y cuenta igual: 26 resultados son 2 páginas.
  return Math.min(TOPE_DE_PAGINAS, Math.ceil(resultados / rinde));
}

export interface MedidaDeLista {
  /** Lo que decía el encabezado. */
  resultados: number;
  /** El total que se guarda en `paginas`, ya topeado. */
  paginas: number;
  /**
   * El tope de `TOPE_DE_PAGINAS` recortó: la búsqueda tiene más resultados de
   * los que Sales Navigator deja paginar. Se dice en voz alta porque es la
   * diferencia entre «la lista se agotó» y «la lista sigue teniendo gente que
   * la plataforma no muestra», y lo segundo se arregla afinando los filtros de
   * la búsqueda, no cargando otra lista.
   */
  topeado: boolean;
}

/**
 * La medición entera: de un encabezado a lo que hay que guardar.
 *
 * `null` = no se pudo leer, y entonces **no se toca nada**. Una lista que sigue
 * sin medir es un problema que se ve; una lista con un total inventado es un
 * problema que se cree.
 */
export function medidaDelEncabezado(
  texto: string | null | undefined,
  porPagina: number,
): MedidaDeLista | null {
  const resultados = resultadosDelEncabezado(texto);
  if (resultados === null) return null;
  const paginas = paginasParaResultados(resultados, porPagina);
  if (paginas === null) return null;
  return {
    resultados,
    paginas,
    topeado: Math.ceil(resultados / Math.floor(porPagina)) > TOPE_DE_PAGINAS,
  };
}

/**
 * Si a esta lista se le puede ir a mirar el total sola.
 *
 * Es tener a dónde ir: la misma dirección que usa la corrida. Un CSV importado
 * no tiene encabezado que leer —el total lo sabe el archivo— y una lista de
 * Sales Navigator sin `origen_id` tampoco: no hay búsqueda a la que entrar.
 * Ésas se cargan a mano desde Automatizaciones, que es el camino que tiene que
 * existir igual para cuando LinkedIn cambie el DOM.
 */
export function sePuedeMedirSola(l: ListaInvitacion): boolean {
  return Boolean(urlDeLista(l.fuente, l.origen_id));
}

/**
 * Las listas que le tocan a una corrida de medición, en orden de prioridad.
 *
 * En orden y no como vengan: una corrida se puede cortar en la mitad —por un
 * aviso de LinkedIn, por la franja horaria— y lo que tiene que estar medido
 * primero es lo que se va a trabajar primero.
 */
export function paraMedir(listas: ListaInvitacion[]): ListaInvitacion[] {
  return enPrioridad(sinMedir(listas).filter(sePuedeMedirSola));
}

/**
 * Cuántos perfiles quedan por sacar de una lista.
 *
 * Es una ESTIMACIÓN: son las páginas que faltan por lo que rinde una página.
 * La última suele venir incompleta, así que el número real es algo menor. Se
 * muestra igual porque la pregunta que contesta —«¿me alcanza para la
 * semana?»— no necesita precisión al perfil.
 */
export function restantes(l: ListaInvitacion): number {
  return estaAgotada(l) ? 0 : (l.paginas - l.pagina) * l.por_pagina;
}

/** Las listas de una cuenta, en orden de prioridad. */
export function enPrioridad(listas: ListaInvitacion[]): ListaInvitacion[] {
  return listas.slice().sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre));
}

/**
 * La que el script está trabajando: la primera con páginas.
 * `null` = la cuenta se quedó sin material.
 */
export function laQueTrabaja(listas: ListaInvitacion[]): ListaInvitacion | null {
  return enPrioridad(listas).find((l) => !estaAgotada(l)) ?? null;
}

export function estadoDeLista(l: ListaInvitacion, listas: ListaInvitacion[]): EstadoLista {
  // «Sin medir» va PRIMERO y antes que «agotada», porque las dos salen del
  // mismo `0 >= 0` y no significan lo mismo: una se terminó, la otra nunca se
  // midió. Ver `sinMedir`.
  if (!(l.paginas > 0)) return 'sin medir';
  if (estaAgotada(l)) return 'agotada';
  return laQueTrabaja(listas)?.id === l.id ? 'en uso' : 'en espera';
}

/**
 * Subir o bajar una lista en la prioridad.
 *
 * Devuelve los nuevos `orden` de TODAS las listas, no solo las dos que se
 * cruzan: si se guardara solo el par, dos reordenamientos seguidos dejarían
 * números repetidos y el desempate pasaría a ser el nombre, que no es lo que
 * nadie eligió.
 */
export function mover(
  listas: ListaInvitacion[],
  id: string,
  direccion: -1 | 1,
): { id: string; orden: number }[] {
  const orden = enPrioridad(listas);
  const i = orden.findIndex((l) => l.id === id);
  const j = i + direccion;
  if (i < 0 || j < 0 || j >= orden.length) return [];
  const tmp = orden[i];
  orden[i] = orden[j];
  orden[j] = tmp;
  return orden.map((l, k) => ({ id: l.id, orden: k + 1 }));
}

/**
 * «2 listas · 1 con páginas» — el estado de la cuenta en una línea.
 *
 * Las que nadie midió se cuentan aparte («· 3 sin medir») y sólo aparecen si
 * las hay: no son listas que se acabaron, son listas a las que les falta un
 * paso.
 *
 * Ese paso YA SE PUEDE DAR, y son dos caminos a propósito:
 *
 *   · `node apps/worker/src/medir.ts <ABREV>` abre la primera página de cada
 *     lista sin medir y lee el total del encabezado (`medidaDelEncabezado`).
 *   · Y el número se puede escribir a mano desde Automatizaciones, porque el
 *     DOM de LinkedIn cambia sin avisar y un descubrimiento automático sin
 *     salida manual es un punto único de falla.
 */
export function resumenDeListas(listas: ListaInvitacion[]): string {
  if (!listas.length) return 'sin listas asignadas';
  const vivas = listas.filter((l) => !estaAgotada(l)).length;
  const faltan = sinMedir(listas).length;
  return (
    `${listas.length} ${listas.length === 1 ? 'lista' : 'listas'} · ${vivas} con páginas` +
    (faltan ? ` · ${faltan} sin medir` : '')
  );
}

export interface CuentaInvitacion {
  id: string;
  abrev: string;
  /**
   * Cuándo respondió por última vez la sesión de LinkedIn. **La señal, no el
   * estado.**
   *
   * Acá había un `estado_sesion` que se leía tal cual del registro, y ese campo
   * viene del seed de demo: dice «activa» en cinco cuentas que no tienen ni una
   * sesión detrás. `core/sesion.ts` se escribió el 09/09 justamente por eso y
   * la pantalla de Cuentas conectadas se pasó a la señal — pero este módulo no,
   * así que la cola de envíos y el panel de Automatizaciones siguieron creyendo
   * el campo viejo. Familia 7: se arregló en un lugar y no en el otro.
   *
   * El tipo `EstadoSesion` también estaba declarado acá, igual que en
   * `sesion.ts`. Queda uno solo, el de `sesion.ts`.
   */
  ultima_senal_li: string | null;
  cupo_diario: number;
  objetivo_semanal: number;
}

/** «6 vinculadas de 10 · 5 activas» */
export function resumenDeCuentas(
  cuentas: CuentaInvitacion[],
  ahora: Date = new Date(),
): string {
  const estados = cuentas.map((c) => estadoDeSesion(c.ultima_senal_li, ahora));
  const vinculadas = estados.filter((e) => e !== 'sin_vincular').length;
  const activas = estados.filter((e) => e === 'activa').length;
  return `${vinculadas} vinculadas de ${SLOTS_DE_CUENTA} · ${activas} activas`;
}

export interface LeadDeCuenta {
  cuenta: string;
  situacion: string;
  proximo_contacto?: string | null;
  f_invitacion?: string | null;
  f_aceptacion?: string | null;
  f_cancelada?: string | null;
}

export interface SalidasDelDia {
  cuenta: string;
  invitaciones: number;
  seguimiento: number;
  cancelaciones: number;
  /** true = la cuenta está frenada y por eso va en cero. */
  frenada: boolean;
}

export interface ConfigCancelacion {
  dias_sin_aceptar: number;
  espera_recontacto_dias: number;
  tope_diario_por_cuenta: number;
}

function menosDias(hoy: string, dias: number): string {
  return new Date(Date.parse(hoy.slice(0, 10)) - dias * 86400000).toISOString().slice(0, 10);
}

/**
 * Lo que sale hoy, por cuenta (§7.3, columna derecha).
 *
 * TRES REGLAS QUE HACEN QUE EL NÚMERO SEA HONESTO:
 *
 * 1. Con la automatización en pausa, todo va en cero. No es un detalle
 *    cosmético: el panel contesta «¿qué va a pasar hoy?», y en pausa la
 *    respuesta es «nada».
 * 2. Una cuenta cuya sesión no está activa también va en cero, y se marca
 *    `frenada`. Mostrar su cupo lleno sería prometer envíos que no van a
 *    ocurrir — que es exactamente cómo alguien se entera tarde de que la
 *    sesión se cayó.
 * 3. Las invitaciones son el mínimo entre el cupo y lo que queda en las
 *    listas. Sin material no hay invitación por más cupo que sobre.
 */
export function salidasDeHoy(
  cuentas: CuentaInvitacion[],
  listasPorCuenta: Map<string, ListaInvitacion[]>,
  leads: LeadDeCuenta[],
  cancelacion: ConfigCancelacion,
  hoy: string,
  pausado: boolean,
  ahora: Date = new Date(),
): SalidasDelDia[] {
  const corte = menosDias(hoy, cancelacion.dias_sin_aceptar);

  return cuentas.map((c) => {
    // Frenada se DEDUCE de la última señal. Antes se leía de un campo, y ese
    // campo venía del seed: la cola daba por listas para enviar a cinco cuentas
    // sin ninguna sesión detrás, que es exactamente lo que el punto 2 de arriba
    // dice que no puede pasar.
    const frenada = estadoDeSesion(c.ultima_senal_li, ahora) !== 'activa';
    if (pausado || frenada) {
      return { cuenta: c.abrev, invitaciones: 0, seguimiento: 0, cancelaciones: 0, frenada };
    }

    const material = (listasPorCuenta.get(c.id) ?? []).reduce((a, l) => a + restantes(l), 0);
    const mios = leads.filter((l) => l.cuenta === c.id);

    const seguimiento = mios.filter(
      (l) => l.situacion === 'en_curso' && (l.proximo_contacto ?? '') && l.proximo_contacto! <= hoy,
    ).length;

    // Se cancela la invitación que nadie aceptó y que ya pasó el plazo. La que
    // ya se canceló no se vuelve a contar.
    const vencidas = mios.filter(
      (l) => l.f_invitacion && l.f_invitacion <= corte && !l.f_aceptacion && !l.f_cancelada,
    ).length;

    return {
      cuenta: c.abrev,
      invitaciones: Math.min(c.cupo_diario, material),
      seguimiento,
      cancelaciones: Math.min(cancelacion.tope_diario_por_cuenta, vencidas),
      frenada: false,
    };
  });
}

export interface VuelveALaCola {
  cuenta: string;
  /** «hoy» · «esta semana» · «próxima semana» */
  cuando: string;
  n: number;
}

/**
 * Los cancelados que ya cumplieron la espera y vuelven como Recontacto (§5.x).
 *
 * Se agrupa por CUÁNDO vuelven y no por cuántos hay en total, porque la
 * pregunta del panel es de planificación: si vuelven 200 el mismo día no entran
 * en el cupo de nadie.
 */
export function vuelvenALaCola(
  cuentas: CuentaInvitacion[],
  leads: LeadDeCuenta[],
  cancelacion: ConfigCancelacion,
  hoy: string,
): VuelveALaCola[] {
  const dia = 86400000;
  const base = Date.parse(hoy.slice(0, 10));
  const salida: VuelveALaCola[] = [];

  for (const c of cuentas) {
    const grupos: Record<string, number> = { hoy: 0, 'esta semana': 0, 'próxima semana': 0 };
    for (const l of leads) {
      if (l.cuenta !== c.id || !l.f_cancelada || l.f_aceptacion) continue;
      const vuelve = Date.parse(l.f_cancelada.slice(0, 10)) + cancelacion.espera_recontacto_dias * dia;
      const faltan = Math.round((vuelve - base) / dia);
      if (faltan <= 0) grupos['hoy']++;
      else if (faltan <= 7) grupos['esta semana']++;
      else if (faltan <= 14) grupos['próxima semana']++;
    }
    for (const cuando of ['hoy', 'esta semana', 'próxima semana']) {
      if (grupos[cuando] > 0) salida.push({ cuenta: c.abrev, cuando, n: grupos[cuando] });
    }
  }
  return salida;
}
