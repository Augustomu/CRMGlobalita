import { useMemo, useState } from 'react';
import type { UsuarioRecord, LeadRecord } from '../../lib/types';
import { leadsConSeguimiento, useAgenda, type EventoAgenda } from './useAgenda';

/**
 * La franja de trabajo. Fuera de 8 a 20 no se agenda, así que dibujar el resto
 * del día sería scroll vacío.
 */
const HORA_DESDE = 8;
const HORA_HASTA = 20;

/** El arrastre se mueve de a quince minutos, no libre (§7.6). */
const PASO = 15;

const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const CORTOS = ['lu', 'ma', 'mi', 'ju', 'vi', 'sa'];
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

type Vista = 'Diaria' | 'Semanal' | 'Lista';

/** Hoy en la zona de quien mira. Nunca `toISOString`: eso es UTC. */
function hoyIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function sumarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function hhmm(minutos: number): string {
  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
}

function enMinutos(hora: string): number {
  return Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));
}

/**
 * El lunes de la semana de una fecha.
 *
 * La semana va de lunes a SÁBADO: el domingo no se muestra (§7.6). Nadie
 * agenda reuniones industriales en domingo, y sacarlo le da 16% más de ancho a
 * los días que sí se usan.
 */
function lunesDe(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  const corrimiento = (d.getUTCDay() + 6) % 7;
  return sumarDias(iso, -corrimiento);
}

function fechaLarga(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`;
}

interface Props {
  leads: LeadRecord[];
  /** Quién mira: decide qué reuniones ve con detalle y cuáles como «Ocupado». */
  usuario: UsuarioRecord | null;
  onCerrar: () => void;
  onIrAlLead: (id: string) => void;
}

/**
 * Agenda (§7.6). Portada de `docs/prototipo/Agenda.dc.html`.
 *
 * Es un sidebar de Follow-up, no una sección: se abre al lado de la lista para
 * poder mirar la semana sin perder de vista en qué lead se estaba.
 */
export function Agenda({ leads, usuario, onCerrar, onIrAlLead }: Props) {
  const { eventos, cargando, error, mover, cambiarEstado, calendarios, calendario, setCalendario } =
    useAgenda(true, usuario);
  const [vista, setVista] = useState<Vista>('Semanal');
  const [offset, setOffset] = useState(0);
  const [arrastrando, setArrastrando] = useState<EventoAgenda | null>(null);
  const [destino, setDestino] = useState<{ fecha: string; hora: string } | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  /** Tres estados, sin texto: todos → con check → sin check (§7.6). */
  const [fCheck, setFCheck] = useState<'todos' | 'con' | 'sin'>('todos');
  const [chequeados, setChequeados] = useState<Set<string>>(new Set());

  const hoy = hoyIso();
  const referencia = sumarDias(hoy, vista === 'Semanal' ? offset * 7 : offset);
  const diasVisibles = useMemo(() => {
    if (vista !== 'Semanal') return [referencia];
    const lunes = lunesDe(referencia);
    return Array.from({ length: 6 }, (_, i) => sumarDias(lunes, i));
  }, [vista, referencia]);

  const porDia = useMemo(() => {
    const m = new Map<string, EventoAgenda[]>();
    for (const e of eventos) m.set(e.fecha, [...(m.get(e.fecha) ?? []), e]);
    return m;
  }, [eventos]);

  const titulo =
    vista === 'Semanal'
      ? `${fechaLarga(diasVisibles[0]!)} — ${fechaLarga(diasVisibles[5]!)}`
      : vista === 'Diaria'
        ? `${DIAS[(new Date(`${referencia}T12:00:00Z`).getUTCDay() + 6) % 7] ?? ''} ${fechaLarga(referencia)}`
        : `${eventos.length} reuniones`;

  /** Dónde cae el puntero dentro de la celda, en cuartos de hora. */
  function cuartoDe(ev: React.DragEvent, hora: number): string {
    const caja = ev.currentTarget.getBoundingClientRect();
    const frac = caja.height ? (ev.clientY - caja.top) / caja.height : 0;
    const q = Math.max(0, Math.min(3, Math.floor(frac * 4)));
    return hhmm(hora * 60 + q * PASO);
  }

  async function soltar(fecha: string, hora: string) {
    if (!arrastrando) return;
    const e = arrastrando;
    setArrastrando(null);
    setDestino(null);
    await mover(e.id, fecha, hora);
  }

  /** Si una celda cae dentro del rango que ocuparía el evento arrastrado. */
  function enElRango(fecha: string, desdeMin: number, hastaMin: number): boolean {
    if (!arrastrando || !destino || destino.fecha !== fecha) return false;
    const ini = enMinutos(destino.hora);
    return desdeMin < ini + arrastrando.duracion && hastaMin > ini;
  }

  const filas = useMemo(() => {
    const conSeguimiento = leadsConSeguimiento(leads);
    if (fCheck === 'todos') return conSeguimiento;
    return conSeguimiento.filter((l) => (fCheck === 'con' ? chequeados.has(l.id) : !chequeados.has(l.id)));
  }, [leads, fCheck, chequeados]);

  return (
    <aside className="agenda">
      <div className="agenda-cabecera">
        <span className="colapsable-titulo">Agenda</span>
        <div className="reunion-segmentado">
          {(['Diaria', 'Semanal', 'Lista'] as const).map((v) => (
            <button
              key={v}
              type="button"
              className={vista === v ? 'reunion-seg-on' : ''}
              onClick={() => {
                setVista(v);
                setOffset(0);
              }}
            >
              {v}
            </button>
          ))}
        </div>

        {/* §6.3: un ítem por administrador, más el propio. Solo aparece si
            hay otro calendario que mirar — con un solo usuario sería un
            control de una opción. */}
        {calendarios.length > 1 && (
          <div className="reunion-segmentado agenda-calendarios">
            {calendarios.map((c) => (
              <button
                key={c.id}
                type="button"
                className={(calendario ?? usuario?.id) === c.id ? 'reunion-seg-on' : ''}
                title={
                  c.propio
                    ? 'Tus reuniones, con todo el detalle'
                    : 'Solo los horarios tomados: sin nombre ni empresa'
                }
                onClick={() => setCalendario(c.propio ? null : c.id)}
              >
                {c.propio ? 'Mío' : c.nombre.replace('Calendario de ', '')}
              </button>
            ))}
          </div>
        )}

        {vista === 'Lista' ? (
          // El filtro de check es una caja SIN TEXTO en tres estados. El title
          // dice qué pasa al tocarla, que es lo que el prototipo resolvió así.
          <button
            type="button"
            className={`agenda-check-filtro ${fCheck !== 'todos' ? 'agenda-check-on' : ''}`}
            title={
              fCheck === 'todos'
                ? 'Mostrando todos · tocá para ver solo los que tienen check'
                : fCheck === 'con'
                  ? 'Solo con check · tocá para ver los que no tienen'
                  : 'Solo sin check · tocá para ver todos'
            }
            onClick={() => setFCheck(fCheck === 'todos' ? 'con' : fCheck === 'con' ? 'sin' : 'todos')}
          >
            {fCheck === 'con' ? '✓' : fCheck === 'sin' ? '✕' : ''}
          </button>
        ) : (
          <>
            <button type="button" className="boton-icono-24" title="Anterior" onClick={() => setOffset((o) => o - 1)}>
              ‹
            </button>
            <button type="button" className="boton-mini" onClick={() => setOffset(0)}>
              hoy
            </button>
            <button type="button" className="boton-icono-24" title="Siguiente" onClick={() => setOffset((o) => o + 1)}>
              ›
            </button>
          </>
        )}

        <span className="agenda-titulo al-final">{titulo}</span>
        <button type="button" className="boton-icono-24" title="Cerrar" onClick={onCerrar}>
          ×
        </button>
      </div>

      {arrastrando && (
        <div className="agenda-arrastre">
          {destino ? `soltar en ${destino.hora}` : 'soltá en un bloque de 15 min'}
        </div>
      )}
      {error && <div className="login-error">{error}</div>}
      {cargando && <p className="vacio">Cargando la agenda…</p>}

      {/* ------------------------------------------------------- semanal */}
      {vista === 'Semanal' && (
        <div className="agenda-semana">
          <div className="agenda-fila-cabeza">
            <span className="agenda-hora-col" />
            {diasVisibles.map((iso, k) => (
              <span
                key={iso}
                className={`agenda-cabeza ${iso === hoy ? 'agenda-cabeza-hoy' : ''} ${k === 5 ? 'agenda-cabeza-finde' : ''}`}
              >
                <span className="agenda-cabeza-dia">{CORTOS[k]}</span>
                <span className="agenda-cabeza-n tabular">{Number(iso.slice(8, 10))}</span>
              </span>
            ))}
          </div>

          <div className="agenda-grilla">
            {Array.from({ length: HORA_HASTA - HORA_DESDE + 1 }, (_, i) => HORA_DESDE + i).map((h) => (
              <div key={h} className="agenda-fila">
                <span className="agenda-hora-col tabular">{String(h).padStart(2, '0')}:00</span>
                {diasVisibles.map((iso, k) => {
                  const delDia = (porDia.get(iso) ?? []).filter((e) => Number(e.hora.slice(0, 2)) === h);
                  return (
                    <div
                      key={iso}
                      className={`agenda-celda ${iso === hoy ? 'agenda-celda-hoy' : ''} ${k === 5 ? 'agenda-celda-finde' : ''} ${enElRango(iso, h * 60, h * 60 + 60) ? 'agenda-celda-destino' : ''}`}
                      onDragOver={(ev) => {
                        if (!arrastrando) return;
                        ev.preventDefault();
                        setDestino({ fecha: iso, hora: cuartoDe(ev, h) });
                      }}
                      onDrop={(ev) => {
                        if (!arrastrando) return;
                        ev.preventDefault();
                        void soltar(iso, cuartoDe(ev, h));
                      }}
                    >
                      {delDia.map((e) => (
                        <Evento
                          key={e.id}
                          e={e}
                          // Dentro de la celda el evento se corre según los
                          // minutos: sin esto un movimiento a :15 o :30 no se
                          // vería y el arrastre parecería no haber hecho nada.
                          desplazado={(Number(e.hora.slice(3, 5)) / 60) * 100}
                          abierto={hover === e.id}
                          onHover={setHover}
                          onArrastrar={setArrastrando}
                          onEstado={cambiarEstado}
                          onIrAlLead={onIrAlLead}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* -------------------------------------------------------- diaria */}
      {vista === 'Diaria' && (
        <div className="agenda-dia">
          {Array.from(
            { length: ((HORA_HASTA - HORA_DESDE) * 60) / PASO + 1 },
            (_, i) => HORA_DESDE * 60 + i * PASO,
          ).map((t) => {
            const label = hhmm(t);
            const enPunto = t % 60 === 0;
            const delSlot = (porDia.get(referencia) ?? []).filter((e) => e.hora === label);
            return (
              <div
                key={t}
                className={`agenda-slot ${enPunto ? 'agenda-slot-hora' : ''} ${enElRango(referencia, t, t + PASO) ? 'agenda-celda-destino' : ''}`}
                onDragOver={(ev) => {
                  if (!arrastrando) return;
                  ev.preventDefault();
                  setDestino({ fecha: referencia, hora: label });
                }}
                onDrop={(ev) => {
                  if (!arrastrando) return;
                  ev.preventDefault();
                  void soltar(referencia, label);
                }}
              >
                <span className="agenda-hora-col tabular">{enPunto ? label : ''}</span>
                <div className="agenda-slot-cuerpo">
                  {delSlot.map((e) => (
                    <Evento
                      key={e.id}
                      e={e}
                      desplazado={0}
                      abierto={hover === e.id}
                      onHover={setHover}
                      onArrastrar={setArrastrando}
                      onEstado={cambiarEstado}
                      onIrAlLead={onIrAlLead}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* --------------------------------------------------------- lista */}
      {vista === 'Lista' && (
        <div className="agenda-lista">
          <div className="agenda-lista-cabeza">
            <span />
            <span>Última</span>
            <span>Próx.</span>
            <span>Lead</span>
            <span>Etiquetas</span>
          </div>
          {filas.length === 0 && <p className="vacio">Ningún lead con seguimiento.</p>}
          {filas.map((l) => {
            const suyas = eventos.filter((e) => e.lead === l.id);
            const pasadas = suyas.filter((e) => e.fecha <= hoy);
            const ultima = pasadas[pasadas.length - 1] ?? null;
            return (
              <div key={l.id} className="agenda-lista-fila">
                <button
                  type="button"
                  className={`agenda-check ${chequeados.has(l.id) ? 'agenda-check-on' : ''}`}
                  title="Marcar como controlado"
                  onClick={() =>
                    setChequeados((s) => {
                      const n = new Set(s);
                      if (n.has(l.id)) n.delete(l.id);
                      else n.add(l.id);
                      return n;
                    })
                  }
                >
                  {chequeados.has(l.id) ? '✓' : ''}
                </button>
                <span className={`agenda-lista-fecha tabular ${ultima?.estado === 'no-asistio' ? 'agenda-no-asistio' : ultima?.estado === 'asistio' ? 'agenda-asistio' : ''}`}>
                  {ultima ? `${ultima.fecha.slice(8, 10)}/${ultima.fecha.slice(5, 7)}` : '—'}
                </span>
                <span className="agenda-lista-fecha tabular">
                  {l.proximo_contacto
                    ? `${l.proximo_contacto.slice(8, 10)}/${l.proximo_contacto.slice(5, 7)}`
                    : '—'}
                </span>
                <button type="button" className="agenda-lista-lead" onClick={() => onIrAlLead(l.id)}>
                  <span className="pastilla">{l.expand?.cuenta?.abrev}</span>
                  <span className="agenda-lista-nombre">{l.expand?.perfil?.nombre}</span>
                </button>
                <div className="chips">
                  {(l.expand?.etiquetas ?? []).map((e) => (
                    <span key={e.id} className="chip-etiqueta">
                      {e.nombre}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}

/**
 * Un evento en la grilla, con su ficha al pasar por encima.
 *
 * No hay popup: §7.6 dice que todo vive en el hover y que el clic abre la
 * ficha del lead. Un popup más obligaba a cerrarlo para seguir mirando la
 * semana.
 */
function Evento({
  e,
  desplazado,
  abierto,
  onHover,
  onArrastrar,
  onEstado,
  onIrAlLead,
}: {
  e: EventoAgenda;
  desplazado: number;
  abierto: boolean;
  onHover: (id: string | null) => void;
  onArrastrar: (e: EventoAgenda | null) => void;
  onEstado: (id: string, estado: string) => Promise<void>;
  onIrAlLead: (id: string) => void;
}) {
  // §6.3: el bloque de otro calendario dice CUÁNDO y nada más. No se arrastra
  // —no es tuyo—, no abre ficha —no hay lead que abrir— y no tiene tarjeta de
  // hover, porque no hay nada que mostrar ahí.
  if (e.ajeno) {
    return (
      <div
        className="agenda-evento agenda-evento-ajeno"
        style={{ marginTop: `${desplazado}%` }}
        title="Ocupado en ese calendario"
      >
        <span className="agenda-evento-hora tabular">{e.hora}</span>
        <span className="agenda-evento-nombre">Ocupado</span>
      </div>
    );
  }

  return (
    <div
      className={`agenda-evento agenda-evento-${e.estado}`}
      style={{ marginTop: `${desplazado}%` }}
      draggable
      onDragStart={(ev) => {
        // Firefox no arranca el arrastre sin datos en el dataTransfer.
        ev.dataTransfer.setData('text/plain', e.id);
        onArrastrar(e);
      }}
      onDragEnd={() => onArrastrar(null)}
      onMouseEnter={() => onHover(e.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onIrAlLead(e.lead)}
    >
      <span className="agenda-evento-hora tabular">{e.hora}</span>
      <span className="agenda-evento-nombre">{e.nombre}</span>

      {abierto && (
        <div className="agenda-hover" onClick={(ev) => ev.stopPropagation()}>
          <span className="agenda-hover-nombre">{e.nombre}</span>
          <span className="campo-ayuda">
            {[e.empresa, e.cargo].filter(Boolean).join(' · ') || 'sin empresa cargada'}
          </span>
          <div className="agenda-hover-datos">
            <span className="pastilla">{e.cuenta}</span>
            <span className="pastilla tabular">
              {e.hora} · {e.duracion}′
            </span>
            {e.duenio && <span className="pastilla pastilla-suave">{e.duenio}</span>}
          </div>

          <div className="reunion-estados">
            {(
              [
                ['asistio', 'Asistió', 'on-ok'],
                ['no-asistio', 'No asistió', 'on-error'],
                ['cancelada', 'Cancelada', 'on-warning'],
              ] as const
            ).map(([estado, texto, clase]) => (
              <button
                key={estado}
                type="button"
                className={`reunion-estado ${e.estado === estado ? clase : ''}`}
                title={texto}
                onClick={() => void onEstado(e.id, estado)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="12" cy="12" r="9" />
                  {estado === 'asistio' && <path d="M8 12.5l2.5 2.5L16 9.5" />}
                  {estado === 'no-asistio' && <path d="M9 9l6 6M15 9l-6 6" />}
                  {estado === 'cancelada' && <path d="M6 18L18 6" />}
                </svg>
              </button>
            ))}
          </div>

          {e.notas && <span className="agenda-hover-notas">{e.notas}</span>}

          <div className="agenda-hover-links">
            {e.slug && (
              <a href={`https://www.linkedin.com/in/${e.slug}`} target="_blank" rel="noreferrer" className="boton-mini">
                LinkedIn
              </a>
            )}
            {e.telefono && (
              <a href={`https://wa.me/${e.telefono.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="boton-mini">
                WhatsApp
              </a>
            )}
          </div>
          <span className="campo-ayuda">Arrastrá el evento para moverlo. Clic abre la ficha.</span>
        </div>
      )}
    </div>
  );
}
