// La cola de envíos (§7.2 «al pie: cola de envíos, con cuenta regresiva», §8.1).
//
// Es lo único de la pantalla que no describe algo que ya pasó: describe algo
// que está por pasar. Por eso las reglas de acá tienen que ser LAS MISMAS que
// las del worker. Si la UI inventara su propio espaciado, la cuenta regresiva
// sería una animación bonita que no coincide con el envío real, y el usuario
// aprendería a no creerle.
//
// §8.1: los envíos corren del lado del servidor. Esto no manda nada — calcula
// qué se ve y cuándo, a partir de la cola que el worker consume.

/** Los tres tipos de cosas que salen solas (§3, tabla de la cola). */
export type TipoCola = 'mensaje' | 'recordatorio' | 'gracias';

export type EstadoCola = 'pendiente' | 'enviado' | 'error' | 'cancelado';

export interface ItemCola {
  id: string;
  tipo: TipoCola;
  /** Abreviatura de la cuenta que envía (AL, DL, …). Vacío = sin cuenta. */
  cuenta: string;
  quien: string;
  detalle: string;
  /** Cuándo está programado. ISO con hora. */
  cuando: string;
  estado: EstadoCola;
  /** Cuándo salió de verdad. Solo en las enviadas. */
  enviado_en?: string | null;
}

/**
 * Cuánto adelante se arma el lote. Más allá de esto un mensaje es "programado",
 * no "por salir": no tiene sentido calcularle un turno dentro de un lote que
 * todavía puede cambiar (alguien contesta, alguien cancela, cae la sesión).
 */
export const UMBRAL_LOTE_MS = 15 * 60_000;

/** Cuántos mensajes salen juntos por cuenta antes de cortar (§8.1, cupos). */
export const TAMANO_LOTE = 5;

/**
 * Los 8 segundos de gracia del que ya venció.
 *
 * Un mensaje cuya hora ya pasó NO sale en el instante en que se lo mira: si
 * cinco vencieron mientras la sesión estaba caída, largarlos de una es
 * exactamente el patrón que LinkedIn detecta. Arrancan la cadena desde ahora,
 * no desde su hora vieja.
 */
export const GRACIA_MS = 8_000;

/** La ventana de la barra de avance del que está por salir. */
export const VENTANA_AVANCE_MS = 45_000;

/**
 * Segundos entre dos mensajes de la misma cuenta: 30 a 40, sin ser siempre el
 * mismo número.
 *
 * Es determinístico a propósito, no aleatorio: el worker y la pantalla tienen
 * que calcular el MISMO turno o la cuenta regresiva miente. Que no sea un
 * intervalo fijo importa igual — treinta segundos clavados es una firma.
 */
export function espaciado(posicion: number): number {
  return 30 + ((posicion * 13) % 11);
}

/**
 * Un tiempo restante, en la unidad que se entiende de un vistazo: segundos
 * cuando falta poco, mm:ss cuando falta un rato, horas y días cuando falta
 * mucho. «847 s» no le dice nada a nadie.
 */
export function reloj(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s`;
  const min = Math.floor(s / 60);
  if (min < 60) return `${min}:${String(s % 60).padStart(2, '0')}`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ${min % 60} m`;
  return `${Math.floor(h / 24)} d ${h % 24} h`;
}

/** DD/MM HH:MM en la zona del que mira. */
export function fechaCorta(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export interface EnCamino {
  cuenta: string;
  /** «lote de 5 · cada 30-40 s» */
  meta: string;
  id: string;
  quien: string;
  detalle: string;
  countdown: string;
  /** «primero del lote» / «posición 3 del lote» */
  espera: string;
  /** 0 a 100. Empieza a llenarse cuando faltan 45 s. */
  avance: number;
}

export interface FilaProgramada {
  id: string;
  tipo: TipoCola;
  cuenta: string;
  quien: string;
  detalle: string;
  countdown: string;
  cuandoLabel: string;
}

export interface FilaEnviada {
  id: string;
  quien: string;
  detalle: string;
  cuandoLabel: string;
}

export interface VistaCola {
  /**
   * El único que está por salir, en toda la cola.
   *
   * No es una lista: en un segundo dado sale UNO. Mostrar cinco «en envío»
   * cuando cuatro están esperando su turno de 30 s es decir algo falso sobre
   * lo que la máquina está haciendo.
   */
  enCamino: EnCamino | null;
  programados: FilaProgramada[];
  enviados: FilaEnviada[];
  /** Lo que va en la pastilla del encabezado: lo que falta, no lo hecho. */
  n: number;
  /** El texto de la barra cerrada. */
  resumen: string;
  vacio: boolean;
}

interface Calculado extends ItemCola {
  t: number;
  /** Cuándo sale de verdad, con el turno del lote. Solo los del lote. */
  sale?: number;
  posicion?: number;
  tamLote?: number;
}

/**
 * Todo lo que la cola muestra, a una hora dada.
 *
 * El armado del lote es la parte con reglas:
 *
 * 1. Solo los `mensaje` hacen lote. El recordatorio y el agradecimiento salen a
 *    su hora: no compiten por el cupo de la cuenta ni se espacian entre sí.
 * 2. El lote se arma POR CUENTA. El límite es de la cuenta que envía, así que
 *    dos cuentas distintas pueden estar mandando a la vez sin acumular riesgo.
 * 3. Del sexto en adelante no hay turno calculado: vuelve a «programado» y
 *    espera a que el lote de adelante termine. Prometerle una hora sería
 *    inventarla.
 */
export function vistaDeCola(items: ItemCola[], ahora: number): VistaCola {
  const base: Calculado[] = items
    .filter((i) => i.estado !== 'cancelado')
    .map((i) => ({ ...i, t: Date.parse(i.cuando) }))
    .sort((a, b) => a.t - b.t);

  // Ya salió porque LO DICE el registro, no porque le pasó la hora. El
  // prototipo lo deducía del reloj porque no tenía estado; acá sí lo hay, y un
  // envío que falló no puede contarse como hecho.
  const enviados: FilaEnviada[] = base
    .filter((i) => i.estado === 'enviado')
    .map((i) => ({
      id: i.id,
      quien: i.quien,
      detalle: i.detalle,
      cuandoLabel: fechaCorta(new Date(Date.parse(i.enviado_en || i.cuando))),
    }));

  const pendientes = base.filter((i) => i.estado === 'pendiente' || i.estado === 'error');

  const porCuenta = new Map<string, Calculado[]>();
  for (const m of pendientes) {
    if (m.tipo !== 'mensaje' || m.t > ahora + UMBRAL_LOTE_MS) continue;
    const clave = m.cuenta || '—';
    const lista = porCuenta.get(clave) ?? [];
    lista.push(m);
    porCuenta.set(clave, lista);
  }

  for (const cuenta of [...porCuenta.keys()].sort()) {
    const lote = (porCuenta.get(cuenta) as Calculado[]).slice(0, TAMANO_LOTE);
    let acum = 0;
    lote.forEach((m, idx) => {
      if (idx > 0) acum += espaciado(idx);
      m.sale = Math.max(m.t, ahora + GRACIA_MS) + acum * 1000;
      m.cuenta = cuenta === '—' ? '' : cuenta;
      m.posicion = idx;
      m.tamLote = lote.length;
    });
  }

  const conTurno = pendientes.filter((m) => m.sale !== undefined).sort((a, b) => a.sale! - b.sale!);
  const siguiente = conTurno[0];

  let enCamino: EnCamino | null = null;
  if (siguiente) {
    const resta = siguiente.sale! - ahora;
    enCamino = {
      cuenta: siguiente.cuenta || '—',
      meta: `lote de ${siguiente.tamLote} · cada 30-40 s`,
      id: siguiente.id,
      quien: siguiente.quien,
      detalle: siguiente.detalle,
      countdown: reloj(resta),
      espera:
        siguiente.posicion === 0
          ? 'primero del lote'
          : `posición ${(siguiente.posicion ?? 0) + 1} del lote`,
      avance: Math.max(2, Math.min(100, 100 - (resta / VENTANA_AVANCE_MS) * 100)),
    };
  }

  const programados: FilaProgramada[] = pendientes
    .filter((i) => i !== siguiente)
    .sort((a, b) => (a.sale ?? a.t) - (b.sale ?? b.t))
    .map((i) => {
      const falta = (i.sale ?? i.t) - ahora;
      return {
        id: i.id,
        tipo: i.tipo,
        cuenta: i.cuenta || '—',
        quien: i.quien,
        detalle: i.detalle,
        // Un pendiente cuya hora ya pasó está DEMORADO, no «en 0 s». Pasa cada
        // vez que se cae una sesión, y es justo lo que hay que poder ver.
        countdown: falta <= 0 ? 'demorado' : reloj(falta),
        cuandoLabel: fechaCorta(new Date(i.sale ?? i.t)),
      };
    });

  return {
    enCamino,
    programados,
    enviados,
    n: (enCamino ? 1 : 0) + programados.length,
    resumen: enCamino
      ? `sale en ${enCamino.countdown}`
      : programados.length
        ? `próximo en ${programados[0].countdown}`
        : 'sin envíos pendientes',
    vacio: !enCamino && programados.length === 0 && enviados.length === 0,
  };
}
