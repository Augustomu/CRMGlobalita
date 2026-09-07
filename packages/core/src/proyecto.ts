// Proyectos (anexo Control §2 y §3). La capa de arriba del lead: el trabajo
// que se abre cuando la prospección ya avanzó.
//
// Todo acá es puro. La sección Control es de solo lectura, así que estas
// funciones se usan para MOSTRAR; lo único que escribe es abrir un proyecto
// desde la ficha del lead.

import { enSuZona } from './reunion.ts';

export type TipoProyecto = 'fabript_piv' | 'parceria' | 'prototipo' | 'inversion';

export type EstadoProyecto =
  | 'sin_hablar'
  | 'en_conversacion'
  | 'propuesta_enviada'
  | 'nuestra_pelota'
  | 'congelado'
  | 'cerrado_ganado'
  | 'cerrado_perdido';

/** Los cuatro que cuentan en la tarjeta "Activos" (§3, regla 3). */
export const ESTADOS_ACTIVOS: EstadoProyecto[] = [
  'sin_hablar',
  'en_conversacion',
  'propuesta_enviada',
  'nuestra_pelota',
];

/** Terminales: solo un usuario los cambia a mano (§3, regla 2). */
export const ESTADOS_CERRADOS: EstadoProyecto[] = ['cerrado_ganado', 'cerrado_perdido'];

/** Días sin movimiento después de los cuales un proyecto se congela. */
export const DIAS_PARA_CONGELAR = 30;

export const NOMBRE_ESTADO: Record<EstadoProyecto, string> = {
  sin_hablar: 'Sin hablar',
  en_conversacion: 'En conversación',
  propuesta_enviada: 'Propuesta enviada',
  nuestra_pelota: 'Nuestra pelota',
  congelado: 'Congelado',
  cerrado_ganado: 'Cerrado ganado',
  cerrado_perdido: 'Cerrado perdido',
};

/** La regla de cada estado. Va al pie de la pantalla, no en un documento aparte (§3, regla 4). */
export const REGLA_ESTADO: Record<EstadoProyecto, string> = {
  sin_hablar: 'El proyecto existe pero todavía no hubo una conversación sobre él.',
  en_conversacion: 'Hay ida y vuelta activo, sin propuesta formal enviada.',
  propuesta_enviada: 'La pelota está del otro lado: mandamos algo y esperamos respuesta.',
  nuestra_pelota: 'Nos falta hacer algo: armar la propuesta, mandar material, definir precio.',
  congelado: `Más de ${DIAS_PARA_CONGELAR} días sin movimiento. No se descarta, pero no avanza.`,
  cerrado_ganado: 'Se cerró y arrancó el trabajo.',
  cerrado_perdido: 'Se cerró sin avanzar. Queda en el historial con el motivo.',
};

export const NOMBRE_TIPO: Record<TipoProyecto, string> = {
  fabript_piv: 'Fabript/PIV',
  parceria: 'Parcería',
  prototipo: 'Prototipo',
  inversion: 'Inversión',
};

export interface Registro {
  fecha: string;
  texto: string;
  autor?: string;
  /** Solo en acciones. */
  hecha?: boolean;
}

export interface ReunionDelProyecto {
  id: string;
  /** Instante UTC, como lo guarda la base. Se lee siempre por fechaDe (D23). */
  inicio: string;
  zona: string;
  estado: 'pendiente' | 'asistio' | 'no-asistio' | 'cancelada' | 'reagendada';
}

export interface Proyecto {
  id: string;
  lead: string;
  nombre: string;
  empresa: string;
  tipo: TipoProyecto | '';
  estado: EstadoProyecto | '';
  pais: string;
  ciudad: string;
  industria: string;
  rol_contacto: string;
  contacto: string;
  abierto: string;
  nota_lead: string;
  notas: Registro[];
  updates: Registro[];
  acciones: Registro[];
}

const DIA = 86_400_000;

function soloFecha(iso: string): string {
  return String(iso ?? '').slice(0, 10);
}

/**
 * El dia en que ocurrio la reunion para quien la tuvo (D23).
 *
 * La base guarda en UTC: una reunion de las 18:00 en Mexico vuelve como las
 * 00:00 del dia siguiente, y sin esto figuraria un dia despues — o peor, como
 * futura cuando ya paso.
 */
function fechaDe(r: ReunionDelProyecto): string {
  return enSuZona(r.inicio, r.zona).slice(0, 10);
}

function diasEntre(desde: string, hasta: string): number {
  const a = Date.parse(soloFecha(desde));
  const b = Date.parse(soloFecha(hasta));
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / DIA);
}

/**
 * La fecha más alta entre actualizaciones, notas y reuniones.
 *
 * Es lo que define si un proyecto está vivo. Las acciones NO cuentan: son algo
 * que todavía no pasó, y un proyecto lleno de intenciones sin ejecutar es
 * exactamente el que hay que congelar.
 */
export function ultimoMovimiento(p: Proyecto, reuniones: ReunionDelProyecto[]): string {
  const fechas = [
    ...(p.updates ?? []).map((r) => soloFecha(r.fecha)),
    ...(p.notas ?? []).map((r) => soloFecha(r.fecha)),
    ...reuniones.map(fechaDe),
    soloFecha(p.abierto),
  ].filter(Boolean);

  return fechas.sort().at(-1) ?? '';
}

/**
 * El estado que se muestra (§3, regla 1).
 *
 * Congelado NO se guarda: se calcula. Si se guardara habría que recordar cuál
 * era el estado anterior para poder volver, y bastaría con que nadie corriera
 * el proceso un día para que la pantalla mintiera. Derivándolo, cargar una
 * actualización descongela solo — porque mueve `ultimo_movimiento` — y el
 * estado real nunca se pierde.
 */
export function estadoEfectivo(
  p: Proyecto,
  reuniones: ReunionDelProyecto[],
  hoy: string,
): EstadoProyecto {
  const estado = (p.estado || 'sin_hablar') as EstadoProyecto;
  if (ESTADOS_CERRADOS.includes(estado)) return estado;

  const mov = ultimoMovimiento(p, reuniones);
  if (mov && diasEntre(mov, hoy) > DIAS_PARA_CONGELAR) return 'congelado';

  // Un `congelado` guardado a mano que ya tuvo movimiento vuelve a estar vivo.
  return estado === 'congelado' ? 'en_conversacion' : estado;
}

export interface UltimaReunion {
  /** Fecha de la última reunión PASADA, o '' si no hubo. */
  fecha: string;
  /** Lo que va debajo: el estado, o "programada DD/MM". */
  detalle: string;
  total: number;
}

/**
 * La columna "Últ. reunión" (§2, campos derivados).
 *
 * Criterio de aceptación 3: nunca puede leerse "sin reuniones" al lado de un
 * conteo mayor a cero. Con solo reuniones futuras se muestra `programada DD/MM`.
 */
export function ultimaReunion(reuniones: ReunionDelProyecto[], hoy: string): UltimaReunion {
  const total = reuniones.length;
  if (!total) return { fecha: '', detalle: 'sin reuniones', total: 0 };

  const ordenadas = [...reuniones].sort((a, b) => fechaDe(a).localeCompare(fechaDe(b)));
  const pasadas = ordenadas.filter((r) => fechaDe(r) <= soloFecha(hoy));

  if (pasadas.length) {
    const ultima = pasadas.at(-1)!;
    return { fecha: fechaDe(ultima), detalle: ultima.estado, total };
  }

  // Hay reuniones, pero todavía no ocurrió ninguna.
  const proxima = ordenadas[0]!;
  const [, mes, dia] = fechaDe(proxima).split('-');
  return { fecha: '—', detalle: `programada ${dia}/${mes}`, total };
}

/** El primer paso pendiente. Es lo que se muestra en la columna del mismo nombre. */
export function proximaAccion(p: Proyecto): Registro | null {
  const pendientes = (p.acciones ?? [])
    .filter((a) => !a.hecha)
    .sort((a, b) => soloFecha(a.fecha).localeCompare(soloFecha(b.fecha)));
  return pendientes[0] ?? null;
}

export type TipoAvance = 'accion' | 'update' | 'nota';

export interface ItemAvance {
  tipo: TipoAvance;
  fecha: string;
  texto: string;
}

/**
 * La tira de avance de la fila (§4.1 y criterio de aceptación 4).
 *
 * Orden fijo: primero las próximas acciones, después las actualizaciones de la
 * más nueva a la más vieja, después las notas. Lo primero que se ve es lo que
 * falta hacer, no lo que ya pasó.
 */
export function tiraDeAvance(p: Proyecto): ItemAvance[] {
  const porFecha = (a: Registro, b: Registro) => soloFecha(b.fecha).localeCompare(soloFecha(a.fecha));

  return [
    ...(p.acciones ?? [])
      .filter((a) => !a.hecha)
      .sort((a, b) => soloFecha(a.fecha).localeCompare(soloFecha(b.fecha)))
      .map((r) => ({ tipo: 'accion' as const, fecha: r.fecha, texto: r.texto })),
    ...(p.updates ?? [])
      .slice()
      .sort(porFecha)
      .map((r) => ({ tipo: 'update' as const, fecha: r.fecha, texto: r.texto })),
    ...(p.notas ?? [])
      .slice()
      .sort(porFecha)
      .map((r) => ({ tipo: 'nota' as const, fecha: r.fecha, texto: r.texto })),
  ];
}

// ------------------------------------------------------ abrir desde el lead

export interface LeadParaProyecto {
  id: string;
  contacto: string;
  empresa: string;
  pais: string;
  ciudad: string;
  industria: string;
  rol_contacto: string;
  cuenta: string;
  responsable: string;
  nota: string;
}

/**
 * Lo que se guarda al abrir un proyecto desde la ficha (§6).
 *
 * Es manual y explícito a propósito: un lead que acepta y responde todavía no
 * es un proyecto. Si se creara solo al agendar una reunión, Control se
 * llenaría de proyectos vacíos y "Activos" dejaría de significar algo.
 */
export function proyectoDesdeLead(
  lead: LeadParaProyecto,
  tipo: TipoProyecto,
  hoy: string,
): Record<string, unknown> {
  const empresa = lead.empresa || lead.contacto || 'sin empresa';
  const nombre =
    tipo === 'parceria' ? `Parcería con ${empresa}` : `${NOMBRE_TIPO[tipo]} para ${empresa}`;

  const inicial = { fecha: hoy, texto: 'Proyecto abierto desde la ficha del lead' };

  return {
    lead: lead.id,
    nombre,
    empresa: lead.empresa,
    tipo,
    // Abrirlo ya es haber hablado: por eso no arranca en "sin hablar".
    estado: 'en_conversacion' satisfies EstadoProyecto,
    pais: lead.pais,
    ciudad: lead.ciudad,
    industria: lead.industria,
    rol_contacto: lead.rol_contacto,
    contacto: lead.contacto,
    cuenta: lead.cuenta,
    responsable: lead.responsable,
    abierto: hoy,
    nota_lead: lead.nota,
    notas: [inicial],
    updates: [inicial],
    acciones: [],
    ultimo_movimiento: hoy,
  };
}
