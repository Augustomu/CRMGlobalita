/**
 * «Sin leer»: qué puede escribir un escaneo y qué no (§3.2, §7.6).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LA REGLA, Y ES UNA SOLA. **El escaneo prende la marca. Sólo una persona la
 * apaga.** Pedido por Augusto el 11/09, después de leer la auditoría del
 * escáner viejo: *«mientras lo deje guardado en la parte de sin leer es
 * suficiente; lo que no quiero es que luego de hacer otro scan, como no
 * encontró ese lead en sin leer, lo borre de sin leer»*.
 *
 * POR QUE NO ES UNA PREFERENCIA SINO UNA CORRECCION. El escáner de
 * `globalita-automation` hace hoy exactamente lo contrario, y por diseño: cada
 * corrida REEMPLAZA la lista entera de la cuenta, así que sólo sobrevive lo que
 * tiene la insignia en ESA pasada. Y al que se cayó lo promueve solo a
 * «respondido». Nadie decidió eso; el código lo hace y sigue.
 *
 * UN ESCANEO ES UNA OBSERVACION PARCIAL, NO LA VERDAD. Que un lead no aparezca
 * en la lista de no leídos NO quiere decir que se haya atendido. Puede ser:
 *
 *   · alguien abrió el chat desde el teléfono y LinkedIn lo dio por leído —
 *     pero nadie contestó;
 *   · la conversación se archivó;
 *   · quedó fuera de las páginas que el escaneo alcanzó a recorrer;
 *   · LinkedIn cambió su HTML y el escaneo vio **cero** filas. Este es el peor,
 *     porque «cero» y «ninguno tiene mensajes sin leer» son indistinguibles
 *     desde afuera, y el de antes vaciaba la lista entera y marcaba todo como
 *     respondido con un WARN en un log que nadie mira.
 *
 * En los cuatro casos el trabajo **sigue pendiente**. Un dato que se borra solo
 * es un lead que nadie vuelve a mirar.
 *
 * LA ASIMETRIA ES A PROPOSITO. Prender de más cuesta una fila en una lista, que
 * se saca con un clic. Apagar de más cuesta un prospecto que escribió y nadie
 * le contestó nunca. No son el mismo error y no se tratan igual.
 */

export type CanalSinLeer = 'linkedin' | 'whatsapp';

/** El campo de `lead` que le toca a cada canal. Son dos y no uno (§D05). */
export const CAMPO_SIN_LEER = {
  linkedin: 'sin_leer_li',
  whatsapp: 'sin_leer_wa',
} as const;

export type CampoSinLeer = (typeof CAMPO_SIN_LEER)[CanalSinLeer];

export interface LeadSinLeer {
  id: string;
  sin_leer_li?: boolean | null;
  sin_leer_wa?: boolean | null;
}

/** Una conversación sin leer que el escaneo encontró. */
export interface VistoSinLeer {
  lead_id: string;
  canal: CanalSinLeer;
}

export interface MarcaSinLeer {
  lead_id: string;
  campo: CampoSinLeer;
  /**
   * Siempre `true`. Está en el tipo —y no implícito— para que se vea que este
   * módulo no puede producir un apagado ni por accidente.
   */
  valor: true;
}

/**
 * Lo que un escaneo tiene permitido escribir.
 *
 * Devuelve **sólo altas**: los leads que el escaneo vio sin leer y que todavía
 * no estaban marcados. Nunca devuelve un apagado, y por eso no recibe ninguna
 * forma de pedirlo.
 *
 * Los que ya estaban marcados no vuelven: escribir `true` sobre `true` es una
 * escritura de más que además mueve el `updated` de la fila, y con eso el lead
 * sube en cualquier lista ordenada por fecha sin que haya pasado nada.
 */
export function marcasDelEscaneo(leads: LeadSinLeer[], visto: VistoSinLeer[]): MarcaSinLeer[] {
  const porId = new Map(leads.map((l) => [l.id, l]));
  const salida: MarcaSinLeer[] = [];
  const yaPuesto = new Set<string>();

  for (const v of visto) {
    const lead = porId.get(v.lead_id);
    if (!lead) continue;

    const campo = CAMPO_SIN_LEER[v.canal];
    if (!campo) continue;

    // Ya estaba marcado: no hay nada que escribir.
    if (lead[campo]) continue;

    // El mismo lead puede venir dos veces en una corrida —dos conversaciones
    // del mismo canal, o la lista repetida por un scroll que volvió a pasar—.
    const llave = v.lead_id + '·' + campo;
    if (yaPuesto.has(llave)) continue;
    yaPuesto.add(llave);

    salida.push({ lead_id: v.lead_id, campo, valor: true });
  }

  return salida;
}

/** Quién pide sacar un lead de «sin leer». */
export type QuienSaca = 'escaneo' | 'persona';

/**
 * Si se puede sacar un lead de «sin leer».
 *
 * Existe como función y no como un `if` suelto para que haya UN lugar donde
 * está escrito, y para que el día que alguien quiera agregar una excepción
 * —«sacarlo si hace más de 90 días»— tenga que venir acá y romper un test.
 */
export function puedeSacarDeSinLeer(quien: QuienSaca): boolean {
  return quien === 'persona';
}

/**
 * Lo que el escaneo dejó de ver desde la corrida anterior.
 *
 * NO ES UNA LISTA PARA BORRAR. Es para mostrar: «estos 12 ya no figuran sin
 * leer en LinkedIn». Sirve para que una persona los repase y decida, que es
 * justamente la decisión que el escáner viejo tomaba solo.
 *
 * Se devuelve aparte de `marcasDelEscaneo` a propósito: si fuera el mismo
 * valor de vuelta, alguien lo iba a pasar a un `update` sin mirar.
 */
export function losQueYaNoAparecen(leads: LeadSinLeer[], visto: VistoSinLeer[]): string[] {
  const vistos = new Set(visto.map((v) => v.lead_id));
  return leads.filter((l) => (l.sin_leer_li || l.sin_leer_wa) && !vistos.has(l.id)).map((l) => l.id);
}

/**
 * Cuántas filas tiene que traer un escaneo para que se le crea algo.
 *
 * CERO NUNCA ES UNA RESPUESTA VALIDA. Un escaneo que no encontró ninguna fila
 * —ni leída ni sin leer— no descubrió que la bandeja está vacía: no pudo leer
 * la página. Es el caso del cambio de HTML, del logout y del captcha, y los
 * tres se ven igual.
 *
 * Esto no decide qué escribir —`marcasDelEscaneo` ya no puede borrar nada— sino
 * si la corrida vale como observación: con `false`, lo que no apareció no se
 * anota ni siquiera como «ya no figura».
 */
export function laCorridaEsCreible(filasVistas: number): boolean {
  return Number.isFinite(filasVistas) && filasVistas > 0;
}
