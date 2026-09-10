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

export type EstadoLista = 'agotada' | 'en uso' | 'en espera';

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

/** «2 listas · 1 con páginas» — el estado de la cuenta en una línea. */
export function resumenDeListas(listas: ListaInvitacion[]): string {
  if (!listas.length) return 'sin listas asignadas';
  const vivas = listas.filter((l) => !estaAgotada(l)).length;
  return `${listas.length} ${listas.length === 1 ? 'lista' : 'listas'} · ${vivas} con páginas`;
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
