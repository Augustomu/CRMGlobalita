// Qué rinde cada paso y cada cuenta (§7.3 «Seguimiento» y columna derecha).
//
// Todo se calcula contra los envíos y los leads que ya existen. No hay ningún
// contador propio que haya que mantener al día: un contador que se actualiza
// por su cuenta se desincroniza, y después nadie sabe cuál de los dos números
// es el bueno.

import type { Paso } from './tipos.ts';

export const PASOS_TABLA: (Paso | 'R0')[] = ['R0', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8'];

export interface EnvioMedido {
  lead: string;
  paso: string;
  enviado_en: string;
}

export interface LeadMedido {
  id: string;
  cuenta: string;
  etapa: string;
  situacion: string;
  proximo_contacto?: string | null;
  f_invitacion?: string | null;
  f_aceptacion?: string | null;
  f_respuesta?: string | null;
}

export interface FilaRendimiento {
  paso: string;
  /** Cuántos leads están parados en ese paso y ya les toca. */
  toca: number;
  enviados: number;
  respuestas: number;
  /** 0 a 100. */
  tasa: number;
  /** R0 mide aceptación de la invitación, no respuesta a un mensaje. */
  esAceptacion: boolean;
}

/**
 * La tabla de rendimiento por R.
 *
 * R0 ES OTRA COSA Y POR ESO SE MARCA. En R0 no hay mensaje: se manda una
 * invitación y lo que se mide es si la aceptaron. Meterlo en el promedio de
 * seguimiento mezcla dos tasas que no se comparan —la aceptación siempre es
 * mucho más alta— y hace parecer que la cadencia rinde mejor de lo que rinde.
 *
 * «Respuestas» de un paso son los envíos de ese paso cuyo lead contestó DESPUÉS
 * de ese envío. Contar «leads que contestaron y pasaron por ese paso» le daría
 * el mérito a todos los pasos anteriores por igual.
 */
export function rendimientoPorPaso(leads: LeadMedido[], envios: EnvioMedido[], hoy: string): FilaRendimiento[] {
  const respuestaDe = new Map<string, string>();
  for (const l of leads) if (l.f_respuesta) respuestaDe.set(l.id, l.f_respuesta.slice(0, 10));

  return PASOS_TABLA.map((paso) => {
    const toca = leads.filter(
      (l) => l.etapa === paso && l.situacion === 'en_curso' && (l.proximo_contacto ?? '') && l.proximo_contacto! <= hoy,
    ).length;

    if (paso === 'R0') {
      const enviados = leads.filter((l) => l.f_invitacion).length;
      const respuestas = leads.filter((l) => l.f_aceptacion).length;
      return { paso, toca, enviados, respuestas, tasa: porcentaje(respuestas, enviados), esAceptacion: true };
    }

    const delPaso = envios.filter((e) => e.paso === paso);
    const respuestas = delPaso.filter((e) => {
      const r = respuestaDe.get(e.lead);
      return Boolean(r && r >= e.enviado_en.slice(0, 10));
    }).length;

    return {
      paso,
      toca,
      enviados: delPaso.length,
      respuestas,
      tasa: porcentaje(respuestas, delPaso.length),
      esAceptacion: false,
    };
  });
}

/** Sin denominador la tasa no es 0: no existe. Se devuelve 0 y quien muestra decide. */
export function porcentaje(parte: number, total: number): number {
  return total > 0 ? Math.round((parte / total) * 100) : 0;
}

/** El color de una tasa de seguimiento. Los cortes son del prototipo. */
export function colorDeTasa(tasa: number): 'bien' | 'normal' | 'flojo' {
  if (tasa >= 30) return 'bien';
  return tasa >= 20 ? 'normal' : 'flojo';
}

/** El ancho de la barrita: x2.5 para que un 40% ya llegue al tope. */
export function anchoDeTasa(tasa: number): number {
  return Math.max(4, Math.min(100, tasa * 2.5));
}

/** El lunes de la semana de `iso`, que es cuando resetea el objetivo semanal. */
export function lunesDe(iso: string): string {
  const d = new Date(Date.parse(iso.slice(0, 10)));
  // getUTCDay: 0 es domingo. El lunes es el día 1, y el domingo cierra la
  // semana anterior (por eso el -6 y no el +1).
  const dia = d.getUTCDay();
  const atras = dia === 0 ? 6 : dia - 1;
  return new Date(d.getTime() - atras * 86400000).toISOString().slice(0, 10);
}

export interface MetricaSemanal {
  cuenta: string;
  enviadas: number;
  aceptadas: number;
  /** Conversión de la semana YA CERRADA, en porcentaje. */
  conversionAnterior: number;
  objetivo: number;
}

/**
 * Las métricas de la semana por cuenta.
 *
 * «Aceptadas» se cuenta por FECHA DE ACEPTACIÓN, no por fecha de envío: una
 * invitación mandada hace tres semanas que aceptan hoy es actividad de hoy. Por
 * eso aceptadas puede superar a enviadas en una semana floja, y no es un error.
 *
 * La conversión que se muestra es la de la semana ANTERIOR, ya cerrada. La de
 * la semana en curso todavía se está llenando: mostrarla el lunes a la mañana
 * daría 0% y el martes 200%, y nadie podría usarla para decidir nada.
 */
export function metricasSemanales(
  cuentas: { id: string; abrev: string; objetivo_semanal: number }[],
  leads: LeadMedido[],
  hoy: string,
): MetricaSemanal[] {
  const lunes = lunesDe(hoy);
  const lunesAnterior = new Date(Date.parse(lunes) - 7 * 86400000).toISOString().slice(0, 10);
  const en = (f: string | null | undefined, desde: string, hasta: string) => {
    const d = String(f ?? '').slice(0, 10);
    return Boolean(d && d >= desde && d < hasta);
  };
  const finDeSemana = new Date(Date.parse(lunes) + 7 * 86400000).toISOString().slice(0, 10);

  return cuentas.map((c) => {
    const mios = leads.filter((l) => l.cuenta === c.id);
    const enviadasAnt = mios.filter((l) => en(l.f_invitacion, lunesAnterior, lunes)).length;
    const aceptadasAnt = mios.filter((l) => en(l.f_aceptacion, lunesAnterior, lunes)).length;
    return {
      cuenta: c.abrev,
      enviadas: mios.filter((l) => en(l.f_invitacion, lunes, finDeSemana)).length,
      aceptadas: mios.filter((l) => en(l.f_aceptacion, lunes, finDeSemana)).length,
      conversionAnterior: porcentaje(aceptadasAnt, enviadasAnt),
      objetivo: c.objetivo_semanal,
    };
  });
}

export interface FilaAnalisis {
  que: string;
  valor: string;
  /** 0 a 100, relativo al primero. */
  ancho: number;
}

/** Ordena, corta y escala las barras contra la mayor. */
function ranking(cuenta: Map<string, number>, cuantas: number, formato: (n: number) => string): FilaAnalisis[] {
  const filas = [...cuenta.entries()].sort((a, b) => b[1] - a[1]).slice(0, cuantas);
  const tope = filas[0]?.[1] ?? 0;
  return filas.map(([que, n]) => ({
    que,
    valor: formato(n),
    ancho: tope > 0 ? Math.max(4, Math.round((n / tope) * 100)) : 4,
  }));
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/**
 * Qué día contestan.
 *
 * Es el corte grueso, por día nada más. El fino —día + franja horaria, que es
 * lo que pide §5.5— está en `cuandoRespondenDetallado`, y necesita que la
 * respuesta tenga hora de verdad.
 *
 * Los dos conviven porque no siempre hay hora: lo importado y lo cargado a
 * mano no la tienen, y ahí este corte sigue diciendo algo cierto.
 */
export function cuandoResponden(leads: LeadMedido[]): FilaAnalisis[] {
  const cuenta = new Map<string, number>();
  let total = 0;
  for (const l of leads) {
    if (!l.f_respuesta) continue;
    const d = new Date(Date.parse(l.f_respuesta.slice(0, 10)));
    const nombre = DIAS[d.getUTCDay()];
    cuenta.set(nombre, (cuenta.get(nombre) ?? 0) + 1);
    total++;
  }
  return ranking(cuenta, 5, (n) => `${porcentaje(n, total)}%`);
}

export interface ReunionMedidaPerfil {
  cargo?: string;
  industria?: string;
  estado: string;
}

/** Qué cargos concretan más reuniones. */
export function perfilesConMasReuniones(reuniones: ReunionMedidaPerfil[]): FilaAnalisis[] {
  const cuenta = new Map<string, number>();
  for (const r of reuniones) {
    if (r.estado === 'cancelada') continue;
    const cargo = r.cargo?.trim() || 'sin cargo';
    cuenta.set(cargo, (cuenta.get(cargo) ?? 0) + 1);
  }
  return ranking(cuenta, 4, (n) => String(n));
}

/**
 * Qué industrias convierten: de los leads aceptados, cuántos llegaron a tener
 * al menos una reunión.
 *
 * Sobre aceptados y no sobre invitados, porque hasta que no aceptan no se puede
 * hablar con nadie: mezclar las dos cosas mide el filtro de la lista, no el
 * poder de convencimiento.
 *
 * Y se cuentan LEADS con reunión, no reuniones. Contando reuniones el número
 * pasa de 100% en cuanto alguien reagenda o tiene una segunda — y una "tasa de
 * conversión" del 200% no es un dato optimista, es un dato roto: quien lo lee
 * deja de creerle a la tarjeta entera.
 */
export function industriasQueConvierten(
  aceptadosPorIndustria: Map<string, number>,
  aceptadosConReunionPorIndustria: Map<string, number>,
): FilaAnalisis[] {
  const tasas = new Map<string, number>();
  for (const [industria, aceptados] of aceptadosPorIndustria) {
    if (aceptados < MINIMO_PARA_TASA) continue;
    tasas.set(industria, porcentaje(aceptadosConReunionPorIndustria.get(industria) ?? 0, aceptados));
  }
  return ranking(tasas, 4, (n) => `${n}%`);
}

/**
 * Cuántos casos hacen falta para que un porcentaje signifique algo.
 *
 * Con un solo lead aceptado, una reunión da «100% de conversión» y ninguna da
 * «0%». Las dos cifras ocupan el primer y el último puesto del ranking sin
 * decir nada, y empujan hacia abajo a la industria que sí tiene volumen. Tres
 * es poco, pero es la diferencia entre una tasa y una anécdota.
 */
export const MINIMO_PARA_TASA = 3;

/**
 * Las cuatro franjas horarias del manual (§7.11.2).
 *
 * No son cuartos iguales del día: salen de cómo trabaja la gente a la que se
 * le escribe. «Última hora» es corta a propósito — lo que llega a las 19:30 se
 * comporta distinto de lo que llega a las 15.
 */
export const FRANJAS: { nombre: string; desde: number; hasta: number }[] = [
  { nombre: 'mañana', desde: 8, hasta: 11 },
  { nombre: 'mediodía', desde: 11, hasta: 14 },
  { nombre: 'tarde', desde: 14, hasta: 17 },
  { nombre: 'última hora', desde: 17, hasta: 20 },
];

/** En qué franja cae una hora, o `null` si está fuera del horario de trabajo. */
export function franjaDe(iso: string): string | null {
  const s = String(iso ?? '');
  if (s.length < 13) return null;
  const h = Number(s.slice(11, 13));
  if (!Number.isFinite(h)) return null;
  return FRANJAS.find((f) => h >= f.desde && h < f.hasta)?.nombre ?? null;
}

/**
 * Si un timestamp trae hora de verdad o es una fecha con medianoche puesta.
 *
 * Importa porque los dos se guardan igual. Con datos importados —o con los que
 * quedaron de antes de guardar la hora— TODO caería en la franja de las 00:00,
 * y el gráfico diría con total seguridad algo que nadie midió. Es preferible
 * decir que no se sabe.
 */
export function tieneHora(iso: string): boolean {
  const s = String(iso ?? '');
  // Un texto sin parte horaria no es «tiene hora»: el slice devuelve vacío y
  // vacío !== '00:00:00' daba true. Lo agarró el test antes que la pantalla.
  if (s.length < 19) return false;
  return s.slice(11, 19) !== '00:00:00';
}

/**
 * Cuándo responden: día de la semana y franja horaria (§5.5).
 *
 * Solo cuenta los que tienen hora. Los de medianoche se informan aparte, en
 * `sinHora`, para que el que mira sepa sobre cuántos se calculó.
 */
export function cuandoRespondenDetallado(leads: LeadMedido[]): {
  filas: FilaAnalisis[];
  sinHora: number;
} {
  const cuenta = new Map<string, number>();
  let total = 0;
  let sinHora = 0;
  for (const l of leads) {
    if (!l.f_respuesta) continue;
    if (!tieneHora(l.f_respuesta)) {
      sinHora++;
      continue;
    }
    const d = new Date(Date.parse(l.f_respuesta.slice(0, 10)));
    const franja = franjaDe(l.f_respuesta);
    if (!franja) continue;
    const clave = `${DIAS[d.getUTCDay()]} ${franja}`;
    cuenta.set(clave, (cuenta.get(clave) ?? 0) + 1);
    total++;
  }
  return { filas: ranking(cuenta, 5, (n) => `${porcentaje(n, total)}%`), sinHora };
}

/**
 * Una demora en lenguaje natural: «8 h», «3 días», «2 meses» (§3.2).
 *
 * Cambia de unidad según el tamaño porque «312 h» no le dice nada a nadie, y
 * «0 días» —que es lo que da una respuesta de la misma tarde contada en días—
 * dice algo falso: que fue instantánea.
 */
export function duracionNatural(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  // Las horas se truncan, no se redondean: 8 h 38 es «8 h». Sale del
  // prototipo, que trae los cuatro casos escritos —«10 min», «5 h», «8 h»,
  // «18 días»— y el de Alexandre son 8 h 38 dichas como 8 h. Los días sí
  // redondean: los suyos son «18 días» sobre 17 d 20 h.
  const horas = Math.floor(minutos / 60);
  if (horas < 48) return `${horas} h`;
  const dias = Math.round(horas / 24);
  if (dias < 60) return `${dias} días`;
  return `${Math.round(dias / 30)} meses`;
}

/** Los minutos entre dos timestamps, o null si alguno falta o van al revés. */
export function minutosEntre(
  desde: string | null | undefined,
  hasta: string | null | undefined,
): number | null {
  const a = Date.parse(String(desde ?? ''));
  const b = Date.parse(String(hasta ?? ''));
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return Math.round((b - a) / 60_000);
}

export function demoraNatural(desde: string | null | undefined, hasta: string | null | undefined): string | null {
  const m = minutosEntre(desde, hasta);
  return m === null ? null : duracionNatural(m);
}
