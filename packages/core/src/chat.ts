// El hilo de un chat: cómo se arma la lista de burbujas (§7.4, WA Personal).
//
// Es lo único de la conversación que tiene reglas. El resto —quién habla de qué
// lado, el color de la burbuja— es presentación pura.

export interface MensajeChat {
  quien: 'in' | 'out';
  texto: string;
  /** ISO con hora. Vacío = no se sabe cuándo (importado sin fecha). */
  en?: string | null;
}

export type ItemHilo =
  | { tipo: 'dia'; etiqueta: string }
  | { tipo: 'mensaje'; quien: 'in' | 'out'; texto: string; hora: string };

const HOY_AYER = ['hoy', 'ayer'];

function soloFecha(iso: string): string {
  return iso.slice(0, 10);
}

/** dd/mm, o «hoy» / «ayer» que es lo que uno lee sin traducir. */
export function etiquetaDeDia(iso: string, hoy: string): string {
  const dias = Math.round((Date.parse(soloFecha(hoy)) - Date.parse(soloFecha(iso))) / 86_400_000);
  if (dias >= 0 && dias < HOY_AYER.length) return HOY_AYER[dias];
  const f = soloFecha(iso);
  return `${f.slice(8, 10)}/${f.slice(5, 7)}`;
}

/**
 * El hilo con sus separadores de día.
 *
 * TRES COSAS QUE NO SON OBVIAS:
 *
 * 1. El separador se inserta cuando CAMBIA el día, no cada N mensajes ni al
 *    principio de cada bloque. Un chat de un solo día no lleva ninguno.
 *
 * 2. Los mensajes sin fecha no abren día ni lo cierran: se dibujan donde están
 *    y siguen perteneciendo al último día conocido. Un WhatsApp importado suele
 *    traer huecos, y meterlos todos bajo un separador «sin fecha» parte el hilo
 *    en dos por un problema de importación, no de la conversación.
 *
 * 3. NO se reordena. El orden en que llegaron es la conversación; ordenar por
 *    fecha con mensajes sin fecha los mandaría a todos al principio o al final.
 */
export function conDias(mensajes: MensajeChat[], hoy: string): ItemHilo[] {
  const salida: ItemHilo[] = [];
  let dia = '';
  for (const m of mensajes) {
    const iso = String(m.en ?? '');
    if (iso) {
      const d = soloFecha(iso);
      if (d !== dia) {
        salida.push({ tipo: 'dia', etiqueta: etiquetaDeDia(iso, hoy) });
        dia = d;
      }
    }
    salida.push({
      tipo: 'mensaje',
      quien: m.quien,
      texto: m.texto,
      hora: iso ? iso.slice(11, 16) : '',
    });
  }
  return salida;
}

/** El último mensaje, que es lo que se ve en la lista de chats. */
export function ultimoTexto(mensajes: MensajeChat[]): string {
  const m = mensajes[mensajes.length - 1];
  if (!m) return '';
  // El prefijo dice de un vistazo si la pelota está de tu lado.
  return m.quien === 'out' ? `vos: ${m.texto}` : m.texto;
}
