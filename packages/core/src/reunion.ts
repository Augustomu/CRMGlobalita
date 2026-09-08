// Reunión. Implementa docs/01-negocio/reunion-y-avisos.md (§3.2, §5.11, §8.3)
// y las decisiones D10 (identidad del evento), D11 (demora) y D23 (zona horaria).

export type EstadoReunion = 'pendiente' | 'asistio' | 'no-asistio' | 'cancelada' | 'reagendada';

export interface Reunion {
  id?: string;
  lead: string;
  /** Instante con zona. D23: sin esto la reunión se agenda mal fuera de tu huso. */
  inicio: string;
  zona: string;
  duracion_min: number;
  estado: EstadoReunion;
  google_event_id?: string;
  reagendada_de?: string;
}

/** Duración por defecto y paso de edición (§3.2). */
export const DURACION_DEFECTO = 30;
export const PASO_DURACION = 15;

/**
 * El título del evento de Google Calendar.
 *
 * Formato pedido por Augusto y confirmado contra el histórico del Calendar:
 *
 *     "Marcelo · Francisco · Augusto"
 *      lead      cuenta      vos
 *
 * El separador es un punto medio, no una barra: es lo que dice el prototipo
 * nuevo (FechaReunion.dc.html) y lo que se muestra en la ficha antes de crear
 * el evento. Los eventos historicos del Calendar usan " / ": los viejos quedan
 * como estan, los nuevos salen asi.
 *
 * Del lead va el nombre completo; de la cuenta de origen, solo el primer
 * nombre. Es lo que permitió recuperar 28 personas del histórico: el título
 * dice de qué cuenta salió cada reunión.
 */
export function tituloEvento(
  nombreLead: string,
  nombreCuenta: string,
  nombrePropio: string,
): string {
  const primerNombre = (s: string) => (s || '').trim().split(/\s+/)[0] ?? '';
  return [
    (nombreLead || '').trim(),
    primerNombre(nombreCuenta),
    primerNombre(nombrePropio),
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * La descripción del evento.
 *
 * Va el link del PERFIL de LinkedIn, no el de Sales Navigator: el de Sales
 * Navigator solo abre desde la cuenta que hizo la búsqueda, así que fuera de
 * ese contexto no sirve. En el histórico aparecieron varios eventos con links
 * de Sales Navigator rotos, y esos son justamente los que no se pudieron
 * recuperar.
 *
 * El id del lead se guarda también acá: es lo que permitió cruzar el histórico
 * con la base vieja, y lo que va a permitir recuperar de nuevo si hace falta.
 */
export function descripcionEvento(slugLinkedIn: string, leadId: string): string {
  const lineas: string[] = [];
  if (slugLinkedIn) lineas.push(`LinkedIn: https://www.linkedin.com/in/${slugLinkedIn}`);
  lineas.push(`PB_ID: ${leadId}`);
  return lineas.join('\n');
}

/** Fin de la reunión, a partir del inicio y la duración. */
export function finDe(inicioIso: string, duracionMin: number): string {
  return new Date(Date.parse(inicioIso) + duracionMin * 60_000).toISOString();
}

/**
 * D11: `demora_reunion` se mide contra la PRIMERA reunión agendada, no la
 * última. Si se reagenda dos veces, lo que interesa es cuánto tardó la
 * conversación en convertir, no cuántas veces se movió después.
 */
export function primeraReunion(reuniones: Pick<Reunion, 'inicio'>[]): string | null {
  if (reuniones.length === 0) return null;
  return reuniones.map((r) => r.inicio).sort()[0]!;
}

/**
 * D18: qué se le muestra a un usuario de una reunión que no es suya.
 *
 * En el calendario propio se ve todo; en el de otro, solo un bloque "Ocupado"
 * sin nombre ni detalle (§6.3). Se resuelve acá, del lado de las reglas, y no
 * en la pantalla: si se filtrara al dibujar, el dato igual habría viajado.
 */
export interface BloqueAgenda {
  inicio: string;
  duracion_min: number;
  titulo: string;
  propio: boolean;
  lead_id?: string;
}

export function verBloque(
  reunion: Pick<Reunion, 'inicio' | 'duracion_min' | 'lead'> & { calendario?: string },
  nombreLead: string,
  usuarioId: string,
): BloqueAgenda {
  const propio = reunion.calendario === usuarioId;
  return {
    inicio: reunion.inicio,
    duracion_min: reunion.duracion_min,
    titulo: propio ? nombreLead : 'Ocupado',
    propio,
    // El id del lead solo viaja si es tu reunión: si no, sería una forma
    // indirecta de saber con quién se reunió otro.
    ...(propio ? { lead_id: reunion.lead } : {}),
  };
}

/** Los avisos alrededor de la reunión (§5.11). */
export interface AvisosReunion {
  /** ninguno / 2 / 3 / 4 horas antes. */
  recordatorio_horas: 0 | 2 | 3 | 4;
  confirmacion_24h: boolean;
  aviso_90min: boolean;
  agradecimiento: boolean;
}

export const AVISOS_POR_DEFECTO: AvisosReunion = {
  recordatorio_horas: 2,
  confirmacion_24h: true,
  aviso_90min: true,
  agradecimiento: true,
};

/** Cuándo sale cada aviso de una reunión. Devuelve instantes ISO. */
export function momentosDeAviso(inicioIso: string, avisos: AvisosReunion): { que: string; cuando: string }[] {
  const t = Date.parse(inicioIso);
  const salida: { que: string; cuando: string }[] = [];
  if (avisos.confirmacion_24h) {
    salida.push({ que: 'confirmacion', cuando: new Date(t - 24 * 3600_000).toISOString() });
  }
  if (avisos.recordatorio_horas > 0) {
    salida.push({
      que: 'recordatorio',
      cuando: new Date(t - avisos.recordatorio_horas * 3600_000).toISOString(),
    });
  }
  if (avisos.aviso_90min) {
    salida.push({ que: 'aviso', cuando: new Date(t - 90 * 60_000).toISOString() });
  }
  // El agradecimiento no es un aviso programado: sale cuando el estado pasa a
  // "asistió" (§5.11), y eso lo decide una persona.
  return salida.sort((a, b) => a.cuando.localeCompare(b.cuando));
}

/**
 * El reloj de pared de un instante, en la zona en que ocurrió: `2026-04-24T17:00`.
 *
 * Hace falta porque la base guarda todo en UTC. Una reunión de las 17:00 en
 * México vuelve como `2026-04-24 23:00:00Z`, y leer la hora del texto la manda
 * a la franja equivocada; peor todavía, para las de la tarde la FECHA se corre
 * un día. Es exactamente lo que D23 quería evitar, y solo se nota mirando los
 * datos.
 */
export function enSuZona(instanteIso: string, zona: string): string {
  const d = new Date(instanteIso.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return String(instanteIso).slice(0, 16);

  try {
    const partes = new Intl.DateTimeFormat('en-CA', {
      timeZone: zona || 'UTC',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(d);

    const v = (t: string) => partes.find((p) => p.type === t)?.value ?? '';
    // `hour: '2-digit'` con hour12 falso devuelve 24 a medianoche en algunos
    // motores; se normaliza para que la franja no caiga fuera de rango.
    const hora = v('hour') === '24' ? '00' : v('hour');
    return `${v('year')}-${v('month')}-${v('day')}T${hora}:${v('minute')}`;
  } catch {
    // Zona inválida: mejor el instante crudo que romper la pantalla.
    return d.toISOString().slice(0, 16);
  }
}
