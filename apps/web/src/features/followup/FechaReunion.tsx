import { useEffect, useMemo, useState, type RefObject } from 'react';
import {
  DURACION_DEFECTO, descripcionEvento, enMinutos, enSuZona, filasPorHora, finDe, hhmm,
  mensajeDeHorarios, tituloEvento, tramoDeLaHora, tramosDelDia,
  type EstadoReunion, type EventoDelDia,
} from '@crm/core/reunion';
import { cargaPorDia, estadoDelDia, fechaConCupo } from '@crm/core/carga';
import { pb } from '../../lib/pocketbase';
import { ConfirmarReunion } from './ConfirmarReunion';
import type { LeadRecord, ReunionRecord, UsuarioRecord } from '../../lib/types';

/** La zona del navegador. D23: se guarda con la reunión, no se asume. */
const ZONA = Intl.DateTimeFormat().resolvedOptions().timeZone;

const DOWS = ['LU', 'MA', 'MI', 'JU', 'VI', 'SA', 'DO'];
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const DURACIONES = [15, 30, 45, 60];

/**
 * Cuantos leads entran en un dia de trabajo.
 *
 * Deberia salir de la coleccion `configuracion`, como la cadencia y los cupos
 * (regla 2 del CLAUDE.md). Queda como constante hasta que exista la pantalla
 * que la edita, y con este comentario para que no se pierda.
 */
const TOPE_DIARIO = 40;

/**
 * Hoy en la zona de QUIEN MIRA, no en UTC.
 *
 * Con toISOString() el 7 de septiembre a las 18:00 en México ya es el 8 en UTC,
 * y el calendario tachaba el día de hoy como si hubiera pasado.
 */
const hoyIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function ddmm(iso: string): string {
  return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '';
}

/** Las celdas de un mes, empezando en lunes. `null` es relleno. */
function celdasDelMes(anio: number, mes: number): (string | null)[] {
  const primero = new Date(Date.UTC(anio, mes, 1));
  // getUTCDay: 0 es domingo. La grilla arranca en lunes.
  const corrimiento = (primero.getUTCDay() + 6) % 7;
  const dias = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  const celdas: (string | null)[] = Array(corrimiento).fill(null);
  for (let d = 1; d <= dias; d++) {
    celdas.push(`${anio}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return celdas;
}

function sumarMeses(anio: number, mes: number, n: number) {
  const d = new Date(Date.UTC(anio, mes + n, 1));
  return { anio: d.getUTCFullYear(), mes: d.getUTCMonth() };
}

/** Una reunión que quien mira tiene permitido ver con nombre (§6.3). */
interface ConNombre {
  id: string;
  inicio: string;
  zona: string;
  duracion_min: number;
  estado: string;
  expand?: { lead?: { expand?: { perfil?: { nombre?: string } } } };
}

interface Props {
  lead: LeadRecord;
  usuario: UsuarioRecord | null;
  editable: boolean;
  /** Vive en el lead, pero se edita acá: es la misma decisión que la reunión. */
  proximoContacto: string;
  onProximoContacto: (fecha: string) => void;
  /** Todos los leads, para saber cuantos caen cada dia. */
  leads?: { proximo_contacto?: string | null }[];
  refProximo?: RefObject<HTMLButtonElement>;
  onCambio: () => void;
}

/**
 * Reunión del lead. Portado de `docs/prototipo/FechaReunion.dc.html`.
 *
 * Es una sección hermana de Datos y Contacto, no un bloque adentro de ellas
 * (cambio 2 del documento de diseño): el objetivo de toda la cadencia es la
 * reunión, así que se ve sin abrir nada y sin hacer scroll.
 *
 * El día se elige en un CALENDARIO, no en un `<input type="date">`. La
 * diferencia no es estética: en el calendario se ven de un vistazo los días que
 * ya están ocupados, que es lo que decide cuándo se agenda.
 */
export function FechaReunion({
  lead, usuario, editable, proximoContacto, onProximoContacto, refProximo, onCambio,
  leads = [],
}: Props) {
  const [reuniones, setReuniones] = useState<ReunionRecord[]>([]);
  /**
   * Los calendarios que se pueden mirar y cuál se está mirando (§6.3).
   *
   * Sirve para agendar contra la agenda de otro: si la reunión la va a tomar
   * el administrador, los huecos que importan son los suyos. Lo ajeno se suma
   * a lo propio en vez de reemplazarlo — la reunión tiene que entrar en las
   * dos agendas, no en una.
   */
  const [calendarios, setCalendarios] = useState<{ id: string; nombre: string }[]>([]);
  const [calendario, setCalendario] = useState<string | null>(null);
  const [ajenas, setAjenas] = useState<{ id: string; inicio: string; zona: string; duracion_min: number }[]>([]);
  /** Las que quien mira tiene permitido ver con nombre. */
  const [conNombre, setConNombre] = useState<
    { id: string; inicio: string; zona: string; duracion_min: number; nombre: string }[]
  >([]);
  const [abierto, setAbierto] = useState(true);
  const [histAbierto, setHistAbierto] = useState(false);
  const [proxAbierto, setProxAbierto] = useState(false);
  const [dia, setDia] = useState<string | null>(null);
  const [hora, setHora] = useState<string | null>(null);
  const [duracion, setDuracion] = useState(DURACION_DEFECTO);
  /** Qué hora está desplegada en tramos de 15. Una sola a la vez. */
  const [horaAbierta, setHoraAbierta] = useState<string | null>(null);
  const [recordatorios, setRecordatorios] = useState(true);
  const [agradecimiento, setAgradecimiento] = useState(false);
  const [guardando, setGuardando] = useState(false);
  /** Los destinatarios se piden al confirmar, no antes. */
  const [pidiendoMails, setPidiendoMails] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inicial = { anio: Number(hoyIso().slice(0, 4)), mes: Number(hoyIso().slice(5, 7)) - 1 };
  const [cal, setCal] = useState(inicial);
  const [calProx, setCalProx] = useState(inicial);

  const perfil = lead.expand?.perfil;

  async function recargar() {
    try {
      // §6.3: el administrador ve todo; el colaborador, lo suyo. Es el mismo
      // filtro que usa la agenda, y por la misma razón: el detalle ajeno no se
      // esconde al dibujar, no se pide.
      const filtroPropio =
        usuario?.rol === 'administrador'
          ? ''
          : `calendario = "${usuario?.id ?? ''}" || lead.asignado = "${usuario?.id ?? ''}"`;

      const [mias, visibles] = await Promise.all([
        pb.collection('reunion').getFullList<ReunionRecord>({
          filter: `lead = "${lead.id}"`,
          sort: '-inicio',
        }),
        pb
          .collection('reunion')
          .getFullList<ConNombre>({
            expand: 'lead.perfil',
            fields: 'id,inicio,zona,duracion_min,estado,expand.lead.expand.perfil.nombre',
            sort: 'inicio',
            ...(filtroPropio ? { filter: filtroPropio } : {}),
          })
          .catch(() => [] as ConNombre[]),
      ]);
      // Un calendario por administrador, más el propio. §8.6 pide no asumir
      // que hay uno solo.
      const admins = await pb
        .collection('users')
        .getFullList<{ id: string; name: string }>({
          filter: 'rol = "administrador" && estado = "activo"',
          fields: 'id,name',
          sort: 'name',
        })
        .catch(() => []);
      setCalendarios([
        ...(usuario ? [{ id: usuario.id, nombre: 'Mi calendario' }] : []),
        ...admins
          .filter((x) => x.id !== usuario?.id)
          .map((x) => ({ id: x.id, nombre: `Calendario de ${x.name.split(' ')[0]}` })),
      ]);

      setReuniones(mias);
      setConNombre(
        visibles
          .filter((r) => r.estado !== 'cancelada')
          .map((r) => ({
            id: r.id,
            inicio: r.inicio,
            zona: r.zona,
            duracion_min: r.duracion_min,
            nombre: r.expand?.lead?.expand?.perfil?.nombre ?? '',
          })),
      );
    } catch {
      setReuniones([]);
      setConNombre([]);
    }
  }

  /**
   * Lo tomado del calendario ajeno, sin decir de qué.
   *
   * Sale de la vista `ocupado`, que expone horario y calendario y nada más: ni
   * el título del evento, ni el lead, ni los invitados.
   */
  useEffect(() => {
    let vivo = true;
    if (!calendario || calendario === usuario?.id) {
      setAjenas([]);
      return;
    }
    pb.collection('ocupado')
      .getFullList<{ id: string; inicio: string; zona: string; duracion_min: number }>({
        filter: `calendario = "${calendario}"`,
        sort: 'inicio',
      })
      .then((r) => vivo && setAjenas(r))
      .catch(() => vivo && setAjenas([]));
    return () => {
      vivo = false;
    };
  }, [calendario, usuario?.id]);

  useEffect(() => {
    void recargar();
    setDia(null);
    setHora(null);
    setDuracion(DURACION_DEFECTO);
    setHoraAbierta(null);
    setHistAbierto(false);
    setProxAbierto(false);
    setError(null);
  }, [lead.id]);

  const proxima = reuniones.find((r) => r.estado === 'pendiente') ?? null;
  const pasadas = reuniones.filter((r) => r !== proxima);

  const titulo = tituloEvento(
    perfil?.nombre ?? '',
    lead.expand?.cuenta?.nombre_perfil ?? lead.expand?.cuenta?.abrev ?? '',
    usuario?.name ?? '',
  );
  const descripcion = descripcionEvento(perfil?.slug ?? '', lead.id);
  const linkPerfil = perfil?.slug ? `https://www.linkedin.com/in/${perfil.slug}` : '';

  /**
   * Qué hay tomado cada día, como BLOQUES con principio y fin.
   *
   * Antes era una lista de horas de arranque, y con eso «ocupado» sólo podía
   * significar «empieza a la misma hora». Una reunión de 14:00 a 15:30 no
   * tapaba las 14:30 ni las 15:00, así que el panel las ofrecía.
   */
  const agenda = useMemo(() => {
    const m = new Map<string, EventoDelDia[]>();
    const nombres = new Map(conNombre.map((r) => [r.id, r.nombre]));
    const poner = (r: { id: string; inicio: string; zona?: string; duracion_min: number }) => {
      const local = enSuZona(r.inicio, r.zona || ZONA);
      const dia = local.slice(0, 10);
      const a = enMinutos(local.slice(11, 16));
      const quien = nombres.get(r.id);
      m.set(dia, [
        ...(m.get(dia) ?? []),
        // Sin nombre no se inventa uno: «Ocupado» es exactamente lo que se
        // sabe de la reunión de otro (§6.3).
        { a, b: a + (r.duracion_min || DURACION_DEFECTO), titulo: quien || 'Ocupado' },
      ]);
    };
    // Las de este lead no bloquean: si estás reagendando, el horario que
    // querés liberar es justamente el que tiene.
    const suyas = new Set(reuniones.map((r) => r.id));
    for (const r of conNombre) if (!suyas.has(r.id)) poner(r);
    // El calendario ajeno SUMA: la reunión tiene que entrar en las dos agendas.
    for (const r of ajenas) if (!suyas.has(r.id) && !conNombre.some((c) => c.id === r.id)) poner(r);
    for (const [, evs] of m) evs.sort((x, y) => x.a - y.a);
    return m;
  }, [reuniones, conNombre, ajenas]);

  const hoy = hoyIso();
  const celdas = celdasDelMes(cal.anio, cal.mes);

  /**
   * Cuántos leads caen cada día. Pinta el calendario de próximo contacto y
   * corre los atajos cuando el día elegido ya está lleno.
   */
  const carga = useMemo(() => cargaPorDia(leads), [leads]);

  const eventosDelDia = useMemo(() => (dia ? (agenda.get(dia) ?? []) : []), [dia, agenda]);
  const filas = useMemo(
    () => (dia ? filasPorHora(eventosDelDia, duracion) : []),
    [dia, eventosDelDia, duracion],
  );
  /**
   * Por qué no hay horarios, si no los hay.
   *
   * Un día «sin disponibilidad» es distinto de un día lleno: en el primero hay
   * que elegir otro día, en el segundo alcanza con achicar la reunión.
   */
  const tramos = useMemo(
    () => (dia ? tramosDelDia(eventosDelDia, duracion) : []),
    [dia, eventosDelDia, duracion],
  );
  const sinHorarios = useMemo(
    // El segundo argumento es «el día está bloqueado entero en Google
    // Calendar». Todavía no hay de dónde saberlo —la cuenta no está
    // conectada—, así que va en false y el mensaje queda inalcanzable hasta
    // que llegue la integración. Está escrito porque el hueco se dice.
    () => mensajeDeHorarios(dia, false, tramos, duracion),
    [dia, tramos, duracion],
  );

  /**
   * Cambiar la duración puede invalidar la hora ya elegida.
   *
   * Elegís 14:30 para media hora, lo pasás a una hora y a las 15:00 hay otra
   * reunión: 14:30 dejó de entrar. Sin esto, el horario seguía marcado y el
   * botón de confirmar seguía habilitado, o sea que el panel te dejaba agendar
   * encima de algo que él mismo estaba mostrando.
   */
  useEffect(() => {
    if (!hora) return;
    if (!tramos.some((t) => t.label === hora && t.libre)) setHora(null);
  }, [tramos, hora]);

  /** Link de "crear evento" de Google Calendar, ya armado. */
  function linkCalendar(inicioIso: string, min: number): string {
    const fmt = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: titulo,
      details: descripcion,
      dates: `${fmt(inicioIso)}/${fmt(finDe(inicioIso, min))}`,
      ctz: ZONA,
    });
    if (lead.email) params.set('add', lead.email);
    return `https://calendar.google.com/calendar/render?${params}`;
  }

  async function confirmar(destinatarios: string[]) {
    if (!dia || !hora || !editable) return;
    setPidiendoMails(false);
    setGuardando(true);
    setError(null);
    try {
      const inicio = new Date(`${dia}T${hora}:00`).toISOString();
      // El titulo y la descripcion se calculan ACA, con core/reunion.ts, y se
      // guardan con la reunion: el hook del servidor que escribe en Google solo
      // manda lo que ya esta resuelto, y la regla queda en un solo lugar.
      const creada = await pb.collection('reunion').create({
        lead: lead.id,
        inicio,
        zona: ZONA,
        duracion_min: duracion,
        estado: 'pendiente',
        calendario: usuario?.id ?? '',
        titulo_evento: titulo,
        descripcion_evento: descripcion,
        // Los destinatarios se eligen al confirmar y valen SOLO para esta
        // reunion: el primero es el invitado principal y el resto van en copia.
        // No se guardan en la ficha porque la reunion suele sumar gente que no
        // es el lead —el jefe, el tecnico— y meterlos ahi ensuciaria el
        // contacto con direcciones que no son suyas.
        invitado_email: destinatarios[0] ?? lead.email ?? '',
        invitados_copia: destinatarios.slice(1),
      });
      // Una reunión agendada es una respuesta: el lead sale de la cadencia
      // automática (§5.1) y su próximo contacto lo maneja la reunión.
      await pb.collection('lead').update(lead.id, { situacion: 'contesto' });
      // Si el servidor lo escribió en Google, no hay nada que abrir. Si no
      // pudo, se abre el link armado: la reunión nunca queda sin forma de
      // llegar al calendario.
      const conEstado = await pb.collection('reunion').getOne(creada.id).catch(() => null);
      if (conEstado?.sync !== 'ok') window.open(linkCalendar(inicio, duracion), '_blank');
      setDia(null);
      setHora(null);
      await recargar();
      onCambio();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarEstado(r: ReunionRecord, estado: EstadoReunion) {
    setGuardando(true);
    try {
      await pb.collection('reunion').update(r.id, { estado });

      // Cambio 12: marcar asistió o no asistió ARCHIVA la ficha. Cancelada no,
      // porque una cancelada se reagenda y el lead sigue vivo.
      //
      // Se archiva, no se descarta: la situación del lead queda como estaba
      // —contestó, agotado— y la archivada dice otra cosa, que ya no hay nada
      // que hacer con él en la columna de trabajo. Mezclarlas perdería el
      // motivo por el que el lead terminó donde terminó.
      if (estado === 'asistio' || estado === 'no-asistio') {
        await pb.collection('lead').update(lead.id, {
          archivada: true,
          archivada_motivo:
            estado === 'asistio'
              ? `Reunión del ${ddmm(enSuZona(r.inicio, r.zona || ZONA))}: asistió`
              : `Reunión del ${ddmm(enSuZona(r.inicio, r.zona || ZONA))}: no asistió`,
        });
      }

      await recargar();
      onCambio();
    } finally {
      setGuardando(false);
    }
  }

  const etiqueta = proxima
    ? `${ddmm(enSuZona(proxima.inicio, proxima.zona || ZONA))} ${enSuZona(proxima.inicio, proxima.zona || ZONA).slice(11, 16)}`
    : dia && hora
      ? `${ddmm(dia)} ${hora} · sin confirmar`
      : 'sin confirmar';

  return (
    <div className="reunion-caja">
      <div className="reunion-cabecera">
        <button type="button" className="reunion-toggle" onClick={() => setAbierto((a) => !a)}>
          <span className="colapsable-flecha">{abierto ? '▾' : '▸'}</span>
          <span className="colapsable-titulo">Reunión</span>
          {proxima ? (
            <span className="reunion-badge tabular">{etiqueta}</span>
          ) : (
            <span className="reunion-pendiente tabular">{etiqueta}</span>
          )}
        </button>

        <div className="reunion-acciones">
          <button
            type="button"
            className="boton-icono-28 boton-icono-ok"
            title={dia && hora ? 'Confirmar reunión' : 'Elegí día y horario para confirmar'}
            disabled={!dia || !hora || !editable || guardando}
            onClick={() => setPidiendoMails(true)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 13l4 4L19 7" />
            </svg>
          </button>

          {/* Marcar asistió o no asistió es lo que archiva la ficha (cambio 12). */}
          <div className="reunion-estados">
            {(
              [
                ['asistio', 'Asistió', 'on-ok'],
                ['no-asistio', 'No asistió', 'on-error'],
                ['cancelada', 'Cancelada', 'on-warning'],
              ] as const
            ).map(([estado, texto, clase]) => {
              const puesto = proxima?.estado === estado || pasadas[0]?.estado === estado;
              return (
                <button
                  key={estado}
                  type="button"
                  className={`reunion-estado ${puesto ? clase : ''}`}
                  title={texto}
                  disabled={!proxima || !editable || guardando}
                  onClick={() => proxima && void cambiarEstado(proxima, estado)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="12" r="9" />
                    {estado === 'asistio' && <path d="M8 12.5l2.5 2.5L16 9.5" />}
                    {estado === 'no-asistio' && <path d="M9 9l6 6M15 9l-6 6" />}
                    {estado === 'cancelada' && <path d="M6 18L18 6" />}
                  </svg>
                </button>
              );
            })}
          </div>

          <div className="relativo">
            <button
              type="button"
              className="boton-chico"
              title="Reuniones registradas"
              onClick={() => setHistAbierto((a) => !a)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M4 7h16M4 12h16M4 17h10" />
              </svg>
              <span className="tabular">{reuniones.length}</span>
            </button>
            {histAbierto && (
              <>
                <div className="popover-fondo" onClick={() => setHistAbierto(false)} />
                <div className="popover popover-anclado reunion-historial">
                  {reuniones.length === 0 && (
                    <div className="reunion-hist-vacio">sin reuniones registradas</div>
                  )}
                  {reuniones.map((r) => {
                    const local = enSuZona(r.inicio, r.zona || ZONA);
                    return (
                      <div key={r.id} className="reunion-hist-fila">
                        <span className="envio-fecha tabular">
                          {ddmm(local)} {local.slice(11, 16)}
                        </span>
                        <span className="pastilla">{r.duracion_min}′</span>
                        <span
                          className={`pastilla ${
                            r.estado === 'asistio'
                              ? 'pastilla-ok'
                              : r.estado === 'no-asistio'
                                ? 'pastilla-error'
                                : ''
                          }`}
                        >
                          {r.estado}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <a
            className="boton-icono-28"
            href={proxima ? linkCalendar(proxima.inicio, proxima.duracion_min) : linkCalendar(new Date().toISOString(), duracion)}
            target="_blank"
            rel="noreferrer"
            title="Volver a abrir el evento en Google Calendar"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <rect x="5" y="2.5" width="12" height="9" rx="1.6" />
              <path d="M5 6h12M9 2.5v2.5M13 2.5v2.5" />
              <path d="M3 18h14" />
              <path d="M13 14l4.5 4-4.5 4" />
            </svg>
          </a>
        </div>
      </div>

      <div className="reunion-proximo">
        <span className="campo-label">Próx. contacto</span>
        <div className="relativo">
          <button
            ref={refProximo}
            type="button"
            className="reunion-proximo-boton tabular"
            title="Fecha del próximo contacto (D)"
            onClick={() => setProxAbierto((a) => !a)}
          >
            {proximoContacto ? ddmm(proximoContacto) : 'sin fecha'}
            <span className="reunion-caret">▾</span>
          </button>
          {proxAbierto && (
            <>
              <div className="popover-fondo" onClick={() => setProxAbierto(false)} />
              <div className="popover popover-anclado reunion-prox-panel">
                <div className="reunion-prox-cabecera">
                  <span className="colapsable-titulo">Próximo contacto</span>
                  <span className="campo-ayuda">tope {TOPE_DIARIO} leads por día</span>
                  <button
                    type="button"
                    className="boton-icono-22"
                    title="Meses anteriores"
                    onClick={() => setCalProx((c) => sumarMeses(c.anio, c.mes, -1))}
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className="boton-icono-22"
                    title="Meses siguientes"
                    onClick={() => setCalProx((c) => sumarMeses(c.anio, c.mes, 1))}
                  >
                    ›
                  </button>
                </div>
                {/* Dos meses lado a lado: elegir «dentro de tres semanas» sin
                    tener que pasar de mes es la mitad del uso. */}
                <div className="reunion-prox-meses">
                  {[0, 1].map((n) => {
                    const m = sumarMeses(calProx.anio, calProx.mes, n);
                    return (
                      <div key={n} className="reunion-mes">
                        <span className="reunion-mes-titulo">
                          {MESES[m.mes]} {m.anio}
                        </span>
                        <div className="reunion-grilla">
                          {DOWS.map((d) => (
                            <span key={d} className="reunion-dow">{d}</span>
                          ))}
                          {celdasDelMes(m.anio, m.mes).map((iso, i) => {
                            if (iso === null) {
                              return <span key={`v${i}`} className="reunion-dia-vacio" />;
                            }
                            // El día se pinta por CARGA, no por disponibilidad:
                            // acá no se agenda una reunión, se reparte trabajo.
                            const cuantos = carga[iso] ?? 0;
                            const estado = estadoDelDia(cuantos, TOPE_DIARIO);
                            return (
                              <button
                                key={iso}
                                type="button"
                                className={`reunion-dia reunion-dia-${estado} ${iso === proximoContacto ? 'reunion-dia-on' : ''} ${iso < hoy ? 'reunion-dia-pasado' : ''}`}
                                title={`${cuantos} de ${TOPE_DIARIO} leads ese día`}
                                onClick={() => {
                                  onProximoContacto(iso);
                                  setProxAbierto(false);
                                }}
                              >
                                {Number(iso.slice(8, 10))}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Los cuatro atajos de 1 a 4 semanas. Muestran la fecha que
                    queda y, si el día ideal estaba lleno, cuántos días se
                    corrió: sin eso el atajo pondría una fecha distinta de la
                    que dice su etiqueta y nadie se enteraría. */}
                <div className="reunion-atajos">
                  {([['A', 1], ['S', 2], ['D', 3], ['F', 4]] as const).map(([tecla, semanas]) => {
                    const r = fechaConCupo(hoy, semanas, carga, TOPE_DIARIO);
                    return (
                      <button
                        key={tecla}
                        type="button"
                        className="reunion-atajo"
                        title={
                          r.sinLugar
                            ? 'No hay ningún día con lugar en las próximas dos semanas'
                            : r.corrimiento
                              ? `El día original estaba lleno: corre ${r.corrimiento} días`
                              : 'Libre'
                        }
                        onClick={() => {
                          onProximoContacto(r.fecha);
                          setProxAbierto(false);
                        }}
                      >
                        <span className="reunion-atajo-tecla">{tecla}</span>
                        <span>{semanas === 1 ? '1 semana' : `${semanas} semanas`}</span>
                        <span className="reunion-atajo-fecha tabular">
                          {ddmm(r.fecha)}
                          {r.corrimiento ? ` +${r.corrimiento}d` : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        <button
          type="button"
          className={`reunion-check ${recordatorios ? 'reunion-check-on' : ''}`}
          onClick={() => setRecordatorios((r) => !r)}
        >
          <span className="reunion-check-caja" />
          <span>Recordatorios</span>
        </button>
        <button
          type="button"
          className={`reunion-check ${agradecimiento ? 'reunion-check-on' : ''}`}
          onClick={() => setAgradecimiento((a) => !a)}
        >
          <span className="reunion-check-caja" />
          <span>Agradecimiento</span>
        </button>

        <span className="reunion-nota">
          {proxima ? `agendada ${etiqueta}` : 'sin reunión agendada'}
        </span>
      </div>

      {abierto && (
        <>
          <div className="reunion-evento">
            <span className="campo-label">Evento que se crea en Google Calendar</span>
            <span className="reunion-evento-titulo">{titulo}</span>
            {linkPerfil ? (
              <a className="reunion-evento-link" href={linkPerfil} target="_blank" rel="noreferrer">
                {linkPerfil}
              </a>
            ) : (
              <span className="reunion-evento-falta">
                Falta el link del perfil de LinkedIn en la ficha: el evento sale sin perfil.
              </span>
            )}
            <span className="reunion-evento-ayuda">
              Nombre completo del lead · primer nombre de la cuenta de origen · tu nombre. El link
              es el del perfil, no el de Sales Navigator.
            </span>
          </div>

          <div className="reunion-cuerpo">
            <div className="reunion-mes">
              <div className="reunion-mes-nav">
                <button
                  type="button"
                  className="boton-icono-24"
                  title="Mes anterior"
                  onClick={() => setCal((c) => sumarMeses(c.anio, c.mes, -1))}
                >
                  ‹
                </button>
                <span className="reunion-mes-titulo">
                  {MESES[cal.mes]} {cal.anio}
                </span>
                <button
                  type="button"
                  className="boton-icono-24"
                  title="Mes siguiente"
                  onClick={() => setCal((c) => sumarMeses(c.anio, c.mes, 1))}
                >
                  ›
                </button>
              </div>
              <div className="reunion-grilla">
                {DOWS.map((d) => (
                  <span key={d} className="reunion-dow">{d}</span>
                ))}
                {celdas.map((iso, i) => {
                  if (iso === null) return <span key={`v${i}`} className="reunion-dia-vacio" />;
                  const evs = agenda.get(iso) ?? [];
                  // El día lleva título con lo que hay ese día, no solo un
                  // color: «3 bloques: 10:00–11:00, 14:00–15:30…» dice si vale
                  // la pena entrar.
                  const tituloDia = evs.length
                    ? `${evs.length} ${evs.length === 1 ? 'bloque' : 'bloques'}: ${evs
                        .map((e) => `${hhmm(e.a)}–${hhmm(e.b)}`)
                        .join(', ')}`
                    : 'Día libre';
                  const pasado = iso < hoy;
                  if (pasado) {
                    return (
                      <span key={iso} className="reunion-dia reunion-dia-ocupado" title="ya pasó">
                        {Number(iso.slice(8, 10))}
                      </span>
                    );
                  }
                  return (
                    <button
                      key={iso}
                      type="button"
                      className={`reunion-dia ${iso === dia ? 'reunion-dia-on' : ''} ${evs.length ? 'reunion-dia-con-carga' : ''}`}
                      title={tituloDia}
                      onClick={() => {
                        setDia(iso);
                        setHora(null);
                        setHoraAbierta(null);
                      }}
                    >
                      {Number(iso.slice(8, 10))}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="reunion-derecha">
              {calendarios.length > 1 && (
                <div className="reunion-fila-control">
                  <span className="campo-label">Calendario</span>
                  <div className="reunion-segmentado">
                    {calendarios.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className={(calendario ?? usuario?.id) === c.id ? 'reunion-seg-on' : ''}
                        title={
                          c.id === usuario?.id
                            ? 'Sólo tus horarios'
                            : 'Suma los horarios de ese calendario, sin decir de qué son'
                        }
                        onClick={() => {
                          setCalendario(c.id);
                          setHora(null);
                          setHoraAbierta(null);
                        }}
                      >
                        {c.nombre}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="reunion-fila-control">
                <span className="campo-label">Duración (min)</span>
                <div className="reunion-segmentado">
                  {DURACIONES.map((d) => (
                    <button
                      key={d}
                      type="button"
                      className={duracion === d ? 'reunion-seg-on' : ''}
                      onClick={() => setDuracion(d)}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Una fila POR HORA, con lo que ya hay agendado a la vista. La
                  grilla plana de :00 y :30 mostraba huecos sin decir contra qué
                  competían, y encima mentía: con la duración sin mirar, un hueco
                  de media hora se ofrecía para una reunión de una hora. */}
              {sinHorarios ? (
                <div className="reunion-sin-dia">{sinHorarios}</div>
              ) : (
                <div className="reunion-horas">
                  {filas.map((f) => {
                    const abierta = horaAbierta === f.label;
                    const elegido = tramoDeLaHora(f, hora);
                    const enEstaHora = Boolean(hora && hora.slice(0, 2) === f.label.slice(0, 2));
                    return (
                      <div key={f.label} className="reunion-hora-fila">
                        <div className="reunion-hora-cab">
                          {f.hayLibres ? (
                            <button
                              type="button"
                              className={`reunion-hora ${enEstaHora ? 'reunion-hora-on' : ''}`}
                              title={`Elegir ${elegido?.label ?? f.label}`}
                              onClick={() => elegido && setHora(elegido.label)}
                            >
                              {f.label}
                            </button>
                          ) : (
                            /* Sin huecos deja de ser botón: tachada y quieta.
                               Un botón que no hace nada es peor que ninguno. */
                            <span className="reunion-hora reunion-hora-tomada" title="sin huecos en esta hora">
                              {f.label}
                            </span>
                          )}

                          {f.puedeAbrir && (
                            <button
                              type="button"
                              className="reunion-hora-chevron"
                              title={abierta ? 'Cerrar los tramos' : 'Ver tramos de 15 min'}
                              onClick={() => setHoraAbierta(abierta ? null : f.label)}
                            >
                              {abierta ? '▴' : '▾'}
                            </button>
                          )}

                          {f.eventos.map((e) => (
                            <span key={e.rango} className="reunion-hora-chip">
                              <span className="reunion-hora-chip-rango tabular">{e.rango}</span>
                              <span className="reunion-hora-chip-tit">{e.titulo}</span>
                            </span>
                          ))}
                        </div>

                        {abierta && (
                          <div className="reunion-cuartos">
                            {f.tramos.map((q) =>
                              q.libre ? (
                                <button
                                  key={q.label}
                                  type="button"
                                  className={`reunion-cuarto ${hora === q.label ? 'reunion-cuarto-on' : ''}`}
                                  onClick={() => setHora(q.label)}
                                >
                                  {q.label}
                                </button>
                              ) : (
                                <span
                                  key={q.label}
                                  className="reunion-cuarto reunion-cuarto-tomado"
                                  title={q.choca?.titulo ?? 'ocupado'}
                                >
                                  {q.label}
                                </span>
                              ),
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <span className="reunion-evento-ayuda">
                Los bloques ocupados salen de las reuniones ya cargadas; las de otros calendarios
                se ven como «Ocupado», sin de quién son (§6.3). La disponibilidad real de Google
                Calendar llega cuando se conecte la cuenta.
              </span>
              {error && <span className="login-error">{error}</span>}
            </div>
          </div>
        </>
      )}

      {pidiendoMails && dia && hora && (
        <ConfirmarReunion
          emails={[lead.email, lead.email2, lead.email3].filter(Boolean) as string[]}
          fecha={dia}
          hora={hora}
          duracion={duracion}
          onCerrar={() => setPidiendoMails(false)}
          onEnviar={(destinatarios) => void confirmar(destinatarios)}
        />
      )}
    </div>
  );
}
