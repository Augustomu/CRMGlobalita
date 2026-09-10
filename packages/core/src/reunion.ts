// Reunión. Implementa §5.11 del manual (§3.2, §5.11, §8.3)
// y las decisiones D10 (identidad del evento), D11 (demora) y D23 (zona horaria).

/**
 * En qué terminó una reunión.
 *
 * **Esta es la única definición.** Estaba escrita cuatro veces —acá, en
 * `metricas.ts`, en `proyecto.ts` y en los tipos de la web— y agregar un valor
 * obligaba a encontrar las cuatro. La primera vez que se agregó uno, tres
 * quedaron atrás y el typecheck lo encontró; la próxima podría no encontrarlo.
 *
 * `sin_dato` es del histórico recuperado: la reunión ocurrió y nadie registró
 * el resultado. No es `pendiente` —eso es una reunión futura— y sobre todo no
 * es inventar que la persona fue o no fue.
 */
export type EstadoReunion =
  | 'pendiente'
  | 'asistio'
  | 'no-asistio'
  | 'cancelada'
  | 'reagendada'
  | 'sin_dato';

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
 * Los límites de una reunión al estirarla en la agenda (§7.6).
 *
 * 15 minutos es el paso de la grilla; 180 es el techo porque una reunión de
 * más de tres horas no es una reunión, y dejarla crecer sin tope tapa el día
 * entero de la agenda con un solo bloque.
 */
export const DURACION_MINIMA = 15;
export const DURACION_MAXIMA = 180;

/**
 * Cuánto mide en pantalla un tramo de 15 minutos.
 *
 * ERA 22, que sale del prototipo, y de ahí salían **88 px por hora**: de 08:00
 * a 20:00 son 1.144 px de alto. No entra en una laptop de 14" —que es el
 * objetivo declarado del diseño— así que la semana obligaba a scrollear
 * siempre. Augusto, el 09/09: *«la parte semanal está horrible, está demasiado
 * grande, tendríamos que reducir un poco el tamaño»*.
 *
 * 14 da **56 px por hora**. Google Calendar usa ~48 y Outlook ~44; no se bajó
 * hasta ahí porque a 48 una reunión de quince minutos mide 12 px y no le entra
 * el nombre. A 56 mide 14, que con la fila de una sola línea alcanza.
 *
 * Esto CONTRADICE al prototipo, que es la fuente de verdad visual. Manda lo
 * que pidió Augusto, y el manual quedó actualizado en el mismo commit.
 */
export const ALTO_TRAMO = 14;

/**
 * La duración que resulta de estirar el bloque.
 *
 * Se cuenta por PASOS de 22 px y no por píxeles: sin eso la duración cambia
 * con cada movimiento del mouse y termina en 37 minutos, que no es un horario
 * que exista.
 */
export function duracionAlEstirar(base: number, deltaY: number): number {
  const pasos = Math.round(deltaY / ALTO_TRAMO);
  return Math.max(DURACION_MINIMA, Math.min(DURACION_MAXIMA, base + pasos * PASO_DURACION));
}

/**
 * El título del evento de Google Calendar.
 *
 * Formato pedido por Augusto y confirmado contra el histórico del Calendar:
 *
 *     "Marcelo Carneiro / Francisco / Augusto"
 *      lead      cuenta      vos
 *
 * El separador es " / ", el mismo de los eventos que ya están en el Calendar
 * de Augusto ("Jorge / Francisco / Augusto"). El prototipo mostraba un punto
 * medio y así se hizo primero, pero la barra no es una preferencia: el
 * importador parte el título por "/" para saber cuál es el lead y cuál la
 * cuenta, y con el punto medio los eventos que crea el CRM no se podrían
 * volver a leer con la misma herramienta que leyó los 288 viejos.
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
    .join(' / ');
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

/* ---------------------------------------------------------------------------
 * A quién se invita, y qué pasa cuando no hay a quién (§5.11)
 * ------------------------------------------------------------------------ */

/** Los tres correos que puede tener un lead (§3.2). Viven en el lead, no en el perfil. */
export interface CorreosDelLead {
  email?: string | null;
  email2?: string | null;
  email3?: string | null;
}

/**
 * Un correo sirve si tiene arroba y algo de cada lado. No se valida más que eso.
 *
 * Validar de más rechaza direcciones que existen —los TLD nuevos, los `+` de
 * Gmail, los dominios de un solo carácter— y el costo de dejar pasar una mal
 * escrita es que Google no la encuentre, que se ve enseguida. Estaba escrita
 * dentro de `ConfirmarReunion.tsx`; vive acá porque ahora la usan dos pantallas.
 */
export function esCorreo(v: string): boolean {
  const t = String(v ?? '').trim();
  const i = t.indexOf('@');
  return i > 0 && i < t.length - 1 && !t.includes(' ');
}

/** Los correos cargados, sin vacíos y sin repetidos, en el orden de la ficha. */
export function correosDelLead(l: CorreosDelLead): string[] {
  const vistos = new Set<string>();
  const salida: string[] = [];
  for (const c of [l.email, l.email2, l.email3]) {
    const t = String(c ?? '').trim();
    if (!t || vistos.has(t.toLowerCase())) continue;
    vistos.add(t.toLowerCase());
    salida.push(t);
  }
  return salida;
}

/**
 * A quién se invita al evento de Google Calendar.
 *
 * Los `elegidos` son los que se tildaron al confirmar esa reunión y MANDAN: la
 * reunión suele sumar gente que no es el lead, y el que se escribe ahí puede
 * ser el primer correo que esa persona tiene en el CRM. Los de la ficha son el
 * respaldo, para cuando se vuelve a abrir el evento sin pasar por el cuadro.
 *
 * POR QUÉ ES UNA FUNCIÓN Y NO UN `||` EN LA PANTALLA. El link de «crear evento»
 * de Calendar leía `lead.email` directo, y ese valor es el que tenía la ficha
 * ANTES de confirmar. Para los 11 leads sin correo eso significaba: escribís el
 * correo en el cuadro, se guarda en la ficha, se guarda en la reunión — y el
 * link que efectivamente crea el evento en Google se abre **sin invitado**. La
 * reunión aparece en el calendario propio y la persona nunca se entera. No
 * fallaba: no invitaba, y no lo decía.
 */
export function invitadosDelEvento(elegidos: string[], lead: CorreosDelLead): string[] {
  const limpios = elegidos.map((e) => String(e ?? '').trim()).filter(Boolean);
  return limpios.length ? limpios : correosDelLead(lead);
}

/**
 * Qué decir cuando no hay a quién invitar, o `null` si sí lo hay.
 *
 * El caso no es raro y no se arregla solo: los teléfonos entraron por dos
 * exportaciones de Google Contacts de 19 columnas y **ninguna es de correo**
 * (§10). Un lead que nació de un contacto de WhatsApp no tiene correo en ningún
 * lado, así que la pantalla tiene que pedirlo, no asumirlo.
 */
export function avisoSinInvitado(lead: CorreosDelLead): string | null {
  return correosDelLead(lead).length
    ? null
    : 'Sin correo, el evento se crea sólo en tu calendario y la persona no recibe nada. Cargalo al confirmar.';
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

// ---------------------------------------------------------------------------
// El panel de horarios (§3.2, prototipo `FechaReunion.dc.html`)
//
// Antes esto era una grilla plana de :00 y :30 en la que «ocupado» significaba
// coincidir EXACTAMENTE con el arranque de otra reunión. Con eso, cambiar la
// duración de 30 a 60 minutos no cambiaba ni un horario, y el panel ofrecía las
// 14:30 para una reunión de una hora aunque a las 15:00 hubiera otra cosa.
//
// El prototipo hace lo correcto y es lo que va acá: el hueco se prueba contra
// el SOLAPAMIENTO del bloque completo, y las filas son por hora, con los
// eventos de esa hora a la vista.

/** La jornada del panel: 09:00 a 18:00, en tramos de 15 minutos. */
export const JORNADA_DESDE = 9 * 60;
export const JORNADA_HASTA = 18 * 60;
export const PASO_TRAMO = 15;

export interface EventoDelDia {
  /** Minutos desde medianoche. */
  a: number;
  b: number;
  titulo: string;
}

export interface Tramo {
  /** «09:15». */
  label: string;
  minuto: number;
  libre: boolean;
  /** El evento que lo tapa, para poder decir cuál en el title. */
  choca: EventoDelDia | null;
}

export function hhmm(minutos: number): string {
  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
}

export function enMinutos(hhmmTexto: string): number {
  return Number(hhmmTexto.slice(0, 2)) * 60 + Number(hhmmTexto.slice(3, 5));
}

/**
 * Los tramos de 15 minutos del día y cuáles entran.
 *
 * Un tramo sirve si la reunión ENTERA cabe sin pisar nada: `t < e.b && t + dur >
 * e.a`. Y el último tramo posible es el que termina a las 18:00, no el que
 * empieza: una reunión de una hora no puede arrancar 17:30.
 */
export function tramosDelDia(eventos: EventoDelDia[], duracion: number): Tramo[] {
  const tramos: Tramo[] = [];
  for (let t = JORNADA_DESDE; t + duracion <= JORNADA_HASTA; t += PASO_TRAMO) {
    const choca = eventos.find((e) => t < e.b && t + duracion > e.a) ?? null;
    tramos.push({ label: hhmm(t), minuto: t, libre: !choca, choca });
  }
  return tramos;
}

export interface FilaDeHora {
  /** «09:00». */
  label: string;
  hora: number;
  /** Los cuatro tramos de esa hora que existen (los del final del día pueden faltar). */
  tramos: Tramo[];
  /** Si alguno entra. Si no, la hora va tachada y deja de ser botón. */
  hayLibres: boolean;
  /** Lo que ya hay agendado en esa hora, para mostrarlo como chips. */
  eventos: { rango: string; titulo: string }[];
  /** El chevron sólo tiene sentido si hay más de un tramo que abrir. */
  puedeAbrir: boolean;
}

/**
 * Una fila por hora, de 09 a 17, con sus tramos y sus eventos.
 *
 * Las horas sin ningún tramo no aparecen: al final del día, una reunión larga
 * deja horas donde no arranca nada, y una fila vacía no dice nada.
 *
 * El título del evento se corta en el primer salto de línea: el resto es el
 * lead y el rango, que ya se muestran aparte.
 */
export function filasPorHora(eventos: EventoDelDia[], duracion: number): FilaDeHora[] {
  const tramos = tramosDelDia(eventos, duracion);
  const filas: FilaDeHora[] = [];
  for (let h = 9; h <= 17; h++) {
    const suyos = tramos.filter((q) => Math.floor(q.minuto / 60) === h);
    if (!suyos.length) continue;
    filas.push({
      label: hhmm(h * 60),
      hora: h,
      tramos: suyos,
      hayLibres: suyos.some((q) => q.libre),
      eventos: eventos
        .filter((e) => e.a < (h + 1) * 60 && e.b > h * 60)
        .map((e) => ({ rango: `${hhmm(e.a)}–${hhmm(e.b)}`, titulo: e.titulo.split('\n')[0] ?? '' })),
      puedeAbrir: suyos.length > 1,
    });
  }
  return filas;
}

/**
 * Cuál tramo elige el click en la hora en punto.
 *
 * Si el `hh:00` entra, ése. Si no, el primero de esa hora que entre — hacer
 * click en «10» con las 10:00 ocupadas y las 10:30 libres tiene que dar las
 * 10:30, no nada.
 */
export function tramoDeLaHora(fila: FilaDeHora, elegido: string | null): Tramo | null {
  const enPunto = fila.tramos.find((q) => q.label === fila.label);
  if (enPunto && (enPunto.libre || enPunto.label === elegido)) return enPunto;
  return fila.tramos.find((q) => q.libre) ?? null;
}

/**
 * Qué decir cuando no hay horarios que ofrecer.
 *
 * Son tres mensajes distintos porque son tres situaciones distintas, y decir
 * «no hay horarios» en las tres esconde justo lo que hay que hacer: elegir un
 * día, elegir otro día, o achicar la reunión.
 */
export function mensajeDeHorarios(
  dia: string | null,
  diaSinDisponibilidad: boolean,
  tramos: Tramo[],
  duracion: number,
): string | null {
  if (!dia) return 'Elegí un día en el calendario';
  if (diaSinDisponibilidad) return 'Sin disponibilidad ese día';
  if (!tramos.some((q) => q.libre)) return `Sin huecos de ${duracion} min ese día`;
  return null;
}

/* ---------------------------------------------------------------------------
 * La grilla de la agenda (§7.6)
 * ------------------------------------------------------------------------ */

/**
 * Cuánto mide una hora de la grilla: los cuatro tramos de quince minutos.
 *
 * Es la medida que hace que el bloque DIGA cuánto dura. La grilla anterior
 * tenía una celda por hora y el bloque metido adentro, así que una reunión de
 * 12:00 a 14:00 estiraba la fila de las 12 en lugar de bajar hasta las 14: el
 * día entero se deformaba y la duración no se leía en ningún lado.
 */
export const ALTO_HORA = 4 * ALTO_TRAMO;

export interface Bloque {
  /** Desde dónde arranca, en porcentaje de la columna. */
  arriba: number;
  /** Cuánto ocupa, en porcentaje de la columna. */
  alto: number;
}

/**
 * Dónde va el bloque de una reunión dentro de la columna de su día.
 *
 * En porcentaje y no en píxeles a propósito: la columna mide `ALTO_HORA × horas`
 * escalado por el tamaño de letra, y en porcentaje el bloque acompaña ese
 * escalado solo. Con píxeles fijos, agrandar la letra dejaba todos los bloques
 * corridos de su hora.
 *
 * Lo que se pasa del final de la franja se recorta: una reunión de 19:30 que
 * dura dos horas llega hasta el borde de abajo, no estira la grilla.
 */
export function bloqueDelEvento(
  hora: string,
  duracion: number,
  desdeHora: number,
  horas: number,
): Bloque {
  const total = horas * 60;
  const inicio = Math.max(0, Math.min(total, enMinutos(hora) - desdeHora * 60));
  const dura = Math.max(0, Math.min(duracion, total - inicio));
  return { arriba: (inicio / total) * 100, alto: (dura / total) * 100 };
}

/**
 * A qué cuarto de hora apunta un punto de la columna.
 *
 * `fraccion` va de 0 a 1 desde el borde de arriba. Se redondea hacia abajo al
 * tramo de 15 porque el arrastre se mueve de a cuartos (§7.6): soltar en
 * cualquier píxel daría las 11:07.
 */
export function horaEnLaColumna(fraccion: number, desdeHora: number, horas: number): string {
  const total = horas * 60;
  const crudo = Math.max(0, Math.min(total - PASO_TRAMO, fraccion * total));
  return hhmm(desdeHora * 60 + Math.floor(crudo / PASO_TRAMO) * PASO_TRAMO);
}

export interface Franja {
  /** Minutos desde medianoche. */
  a: number;
  b: number;
}

export interface EnCarril {
  /** En cuál de los carriles va, desde 0. */
  carril: number;
  /** Cuántos carriles tiene el grupo, para saber cuánto ancho le toca. */
  carriles: number;
}

/**
 * Cómo se reparten a lo ancho los bloques que se pisan.
 *
 * Con los bloques posicionados por hora, dos reuniones a las 11:00 quedan una
 * exactamente encima de la otra y la de atrás desaparece — que es peor que
 * verlas apretadas, porque no hay ninguna señal de que falte algo.
 *
 * El reparto es por GRUPO de bloques encadenados, no por par: si A pisa a B y
 * B pisa a C, los tres comparten el ancho aunque A y C no se toquen. Repartir
 * de a pares dejaría a A y C del mismo ancho que B y superpuestos entre sí.
 *
 * Devuelve un resultado por bloque, en el mismo orden en que se los pasó.
 */
export function carriles(franjas: Franja[]): EnCarril[] {
  const orden = franjas
    .map((f, i) => ({ f, i }))
    .sort((x, y) => x.f.a - y.f.a || x.f.b - y.f.b);
  const salida: EnCarril[] = franjas.map(() => ({ carril: 0, carriles: 1 }));

  // Un grupo se corta cuando aparece un bloque que empieza después de que
  // terminaron TODOS los anteriores: ahí ya no hay nada que compartir.
  let grupo: { i: number; carril: number }[] = [];
  let finDelGrupo = -Infinity;
  const cerrar = () => {
    const ancho = grupo.reduce((n, g) => Math.max(n, g.carril + 1), 1);
    for (const g of grupo) salida[g.i] = { carril: g.carril, carriles: ancho };
    grupo = [];
    finDelGrupo = -Infinity;
  };

  /** Hasta cuándo está ocupado cada carril dentro del grupo. */
  let libres: number[] = [];
  for (const { f, i } of orden) {
    if (f.a >= finDelGrupo) {
      cerrar();
      libres = [];
    }
    let c = libres.findIndex((hasta) => hasta <= f.a);
    if (c < 0) c = libres.length;
    libres[c] = f.b;
    grupo.push({ i, carril: c });
    finDelGrupo = Math.max(finDelGrupo, f.b);
  }
  cerrar();
  return salida;
}

/**
 * Cómo se lee la última reunión en la lista de contactos (§7.2).
 *
 * Tres tonos, y cada uno responde una pregunta distinta que se hace de un
 * vistazo mientras se recorre la columna:
 *
 *   verde  la reunión pasó y la persona vino
 *   rojo   la reunión pasó y la persona NO vino
 *   gris   todavía no pasó, o pasó y nadie registró qué ocurrió
 *
 * El gris junta dos cosas a propósito. «Todavía no sé» y «todavía no pasó» se
 * parecen en lo único que importa acá: no hay nada que celebrar ni que
 * lamentar. Pintar de verde una reunión sin confirmar sería inventar 173
 * asistencias, que es exactamente lo que `sin_dato` existe para no hacer.
 */
export type TonoDeReunion = 'asistio' | 'no-asistio' | 'neutro';

export function tonoDeUltimaReunion(estado: string): TonoDeReunion {
  if (estado === 'asistio') return 'asistio';
  if (estado === 'no-asistio') return 'no-asistio';
  return 'neutro';
}

/**
 * El orden de la vista Lista (§7.6): la reunión más nueva arriba.
 *
 * La clave es la MISMA fecha que muestra la columna «Última», no la de
 * creación ni la del próximo contacto. Si se ordenara por otra cosa, la
 * columna de fechas se vería salteada y habría que leer fila por fila para
 * encontrar a quién se vio la semana pasada.
 *
 * **Los que todavía no tuvieron reunión van al final**, no al principio: la
 * lista es un recorrido por lo que ya pasó, y una fila sin fecha arriba de
 * todo se lee como si fuera lo más reciente.
 *
 * Las fechas son ISO (`2026-09-09`), así que alcanza con compararlas como
 * texto: no hace falta construir un Date por comparación, que en una lista de
 * doscientas filas son varios miles de objetos por render.
 */
export function porUltimaReunion<T>(
  filas: readonly T[],
  ultimaDe: (fila: T) => string | null | undefined,
): T[] {
  return [...filas].sort((a, b) => {
    const ua = ultimaDe(a) || '';
    const ub = ultimaDe(b) || '';
    if (ua === ub) return 0;
    if (!ua) return 1;
    if (!ub) return -1;
    return ua < ub ? 1 : -1;
  });
}

/**
 * Cómo se lee cada estado en pantalla.
 *
 * `sin_dato` con el guión bajo a la vista es el nombre interno asomándose: en
 * una tabla que lee gente que no escribió el código, hay que decirlo en
 * castellano.
 */
export const NOMBRE_ESTADO_REUNION: Record<EstadoReunion, string> = {
  pendiente: 'pendiente',
  asistio: 'asistió',
  'no-asistio': 'no asistió',
  cancelada: 'cancelada',
  reagendada: 'reagendada',
  sin_dato: 'sin información',
};
