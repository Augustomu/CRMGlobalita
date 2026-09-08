import { useEffect, useMemo, useState, type RefObject } from 'react';
import {
  DURACION_DEFECTO, descripcionEvento, enSuZona, finDe, tituloEvento,
  type EstadoReunion,
} from '@crm/core/reunion';
import { pb } from '../../lib/pocketbase';
import type { LeadRecord, ReunionRecord, UsuarioRecord } from '../../lib/types';

/** La zona del navegador. D23: se guarda con la reunión, no se asume. */
const ZONA = Intl.DateTimeFormat().resolvedOptions().timeZone;

const DOWS = ['LU', 'MA', 'MI', 'JU', 'VI', 'SA', 'DO'];
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const DURACIONES = [15, 30, 45, 60];

/** La franja en que se agenda. Fuera de eso no se ofrece un horario. */
const HORA_DESDE = 8;
const HORA_HASTA = 19;

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

interface Props {
  lead: LeadRecord;
  usuario: UsuarioRecord | null;
  editable: boolean;
  /** Vive en el lead, pero se edita acá: es la misma decisión que la reunión. */
  proximoContacto: string;
  onProximoContacto: (fecha: string) => void;
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
}: Props) {
  const [reuniones, setReuniones] = useState<ReunionRecord[]>([]);
  const [ocupadas, setOcupadas] = useState<ReunionRecord[]>([]);
  const [abierto, setAbierto] = useState(true);
  const [histAbierto, setHistAbierto] = useState(false);
  const [proxAbierto, setProxAbierto] = useState(false);
  const [dia, setDia] = useState<string | null>(null);
  const [hora, setHora] = useState<string | null>(null);
  const [duracion, setDuracion] = useState(DURACION_DEFECTO);
  const [recordatorios, setRecordatorios] = useState(true);
  const [agradecimiento, setAgradecimiento] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inicial = { anio: Number(hoyIso().slice(0, 4)), mes: Number(hoyIso().slice(5, 7)) - 1 };
  const [cal, setCal] = useState(inicial);
  const [calProx, setCalProx] = useState(inicial);

  const perfil = lead.expand?.perfil;

  async function recargar() {
    try {
      const [mias, todas] = await Promise.all([
        pb.collection('reunion').getFullList<ReunionRecord>({
          filter: `lead = "${lead.id}"`,
          sort: '-inicio',
        }),
        // Las de los demás leads son las que ocupan la agenda. Mientras Google
        // no esté conectado, esto es toda la disponibilidad que hay.
        pb.collection('reunion').getFullList<ReunionRecord>({
          filter: `lead != "${lead.id}" && estado != "cancelada"`,
          sort: 'inicio',
        }),
      ]);
      setReuniones(mias);
      setOcupadas(todas);
    } catch {
      setReuniones([]);
      setOcupadas([]);
    }
  }

  useEffect(() => {
    void recargar();
    setDia(null);
    setHora(null);
    setDuracion(DURACION_DEFECTO);
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

  /** Qué hay tomado cada día y a qué hora, en la zona de cada reunión. */
  const agenda = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const r of ocupadas) {
      const local = enSuZona(r.inicio, r.zona || ZONA);
      const d = local.slice(0, 10);
      m.set(d, [...(m.get(d) ?? []), local.slice(11, 16)]);
    }
    return m;
  }, [ocupadas]);

  const hoy = hoyIso();
  const celdas = celdasDelMes(cal.anio, cal.mes);

  const horas = useMemo(() => {
    const tomadas = new Set(dia ? (agenda.get(dia) ?? []) : []);
    const out: { hora: string; tomada: boolean }[] = [];
    for (let h = HORA_DESDE; h <= HORA_HASTA; h++) {
      for (const m of ['00', '30']) {
        const s = `${String(h).padStart(2, '0')}:${m}`;
        out.push({ hora: s, tomada: tomadas.has(s) });
      }
    }
    return out;
  }, [dia, agenda]);

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

  async function confirmar() {
    if (!dia || !hora || !editable) return;
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
        invitado_email: lead.email || '',
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
            onClick={() => void confirmar()}
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
                          {celdasDelMes(m.anio, m.mes).map((iso, i) =>
                            iso === null ? (
                              <span key={`v${i}`} className="reunion-dia-vacio" />
                            ) : (
                              <button
                                key={iso}
                                type="button"
                                className={`reunion-dia ${iso === proximoContacto ? 'reunion-dia-on' : ''} ${iso < hoy ? 'reunion-dia-pasado' : ''}`}
                                onClick={() => {
                                  onProximoContacto(iso);
                                  setProxAbierto(false);
                                }}
                              >
                                {Number(iso.slice(8, 10))}
                              </button>
                            ),
                          )}
                        </div>
                      </div>
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
                  const tomadas = agenda.get(iso) ?? [];
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
                      className={`reunion-dia ${iso === dia ? 'reunion-dia-on' : ''} ${tomadas.length ? 'reunion-dia-con-carga' : ''}`}
                      title={tomadas.length ? `ya hay ${tomadas.length}: ${tomadas.join(', ')}` : undefined}
                      onClick={() => {
                        setDia(iso);
                        setHora(null);
                      }}
                    >
                      {Number(iso.slice(8, 10))}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="reunion-derecha">
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

              {dia ? (
                <div className="reunion-horas">
                  {horas.map((h) => (
                    <button
                      key={h.hora}
                      type="button"
                      className={`reunion-hora ${hora === h.hora ? 'reunion-hora-on' : ''} ${h.tomada ? 'reunion-hora-tomada' : ''}`}
                      title={h.tomada ? 'ya hay una reunión a esa hora' : undefined}
                      onClick={() => setHora(h.hora)}
                    >
                      {h.hora}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="reunion-sin-dia">Elegí un día en el calendario</div>
              )}

              <span className="reunion-evento-ayuda">
                Los días ocupados salen de las reuniones ya cargadas. La disponibilidad real de
                Google Calendar llega cuando se conecte la cuenta.
              </span>
              {error && <span className="login-error">{error}</span>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
