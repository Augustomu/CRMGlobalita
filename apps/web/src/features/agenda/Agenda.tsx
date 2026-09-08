import { useEffect, useMemo, useState } from 'react';
import { pb } from '../../lib/pocketbase';
import { PANEL_AGENDA } from '@crm/core/anchos';
import { diaLocal } from '@crm/core/fecha';
import { useAncho } from '../../lib/useAncho';
import { duracionAlEstirar, enMinutos, hhmm } from '@crm/core/reunion';
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

/**
 * Correr una fecha N días.
 *
 * El ancla es mediodía UTC a propósito: sumando desde medianoche, un cambio de
 * horario de verano corre el resultado un día.
 */
function sumarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
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
  const {
    eventos,
    cargando,
    error,
    mover,
    cambiarEstado,
    cambiarDuracion,
    cambiarProximo,
    cambiarNota,
    pegarFoto,
    nuevaReunion,
    calendarios,
    calendario,
    setCalendario,
  } =
    useAgenda(true, usuario);
  const [vista, setVista] = useState<Vista>('Semanal');
  const [offset, setOffset] = useState(0);
  const [arrastrando, setArrastrando] = useState<EventoAgenda | null>(null);
  const [destino, setDestino] = useState<{ fecha: string; hora: string } | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  /** Tres estados, sin texto: todos → con check → sin check (§7.6). */
  const [fCheck, setFCheck] = useState<'todos' | 'con' | 'sin'>('todos');
  /** §7.6: filtro por cuenta. Con seis cuentas, la semana es ilegible sin él. */
  const [fCuenta, setFCuenta] = useState<string>('todas');
  /**
   * La reunión que se está estirando, con su duración en vivo.
   *
   * Se dibuja desde acá mientras dura el arrastre y recién al soltar se
   * guarda: un PATCH por cada píxel serían cientos de escrituras.
   */
  const [estirando, setEstirando] = useState<{ id: string; y0: number; base: number; dur: number } | null>(null);
  /** Qué fila tiene abiertas las notas, en la vista Lista. */
  const [notasDe, setNotasDe] = useState<string | null>(null);
  /** Lo escrito sin guardar todavía, para no pedir un PATCH por tecla. */
  const [borradorNota, setBorradorNota] = useState('');
  const [avisoLista, setAvisoLista] = useState<string | null>(null);
  const [chequeados, setChequeados] = useState<Set<string>>(new Set());

  const hoy = diaLocal();
  // §9.4: 340–900, doble clic vuelve a 560, persistido.
  const anchoAgenda = useAncho(PANEL_AGENDA);
  const referencia = sumarDias(hoy, vista === 'Semanal' ? offset * 7 : offset);
  const diasVisibles = useMemo(() => {
    if (vista !== 'Semanal') return [referencia];
    const lunes = lunesDe(referencia);
    return Array.from({ length: 6 }, (_, i) => sumarDias(lunes, i));
  }, [vista, referencia]);

  /** Las cuentas que aparecen de verdad. Un filtro que siempre da cero es ruido. */
  const cuentas = useMemo(
    () => [...new Set(eventos.map((e) => e.cuenta).filter(Boolean))].sort(),
    [eventos],
  );

  const visibles = useMemo(
    () =>
      fCuenta === 'todas'
        ? eventos
        : // Los bloques ajenos no tienen cuenta y no se filtran: son huecos
          // ocupados, no reuniones de nadie.
          eventos.filter((e) => e.ajeno || e.cuenta === fCuenta),
    [eventos, fCuenta],
  );

  const porDia = useMemo(() => {
    const m = new Map<string, EventoAgenda[]>();
    for (const e of visibles) m.set(e.fecha, [...(m.get(e.fecha) ?? []), e]);
    return m;
  }, [visibles]);

  /**
   * El estirado, escuchado en `document`.
   *
   * Igual que los divisores: la manija mide 9 px y el mouse se le sale en
   * cuanto uno se mueve en serio.
   */
  useEffect(() => {
    if (!estirando) return;
    const mover = (ev: MouseEvent) =>
      setEstirando((s) =>
        s ? { ...s, dur: duracionAlEstirar(s.base, ev.clientY - s.y0) } : s,
      );
    const soltar = () => {
      setEstirando((s) => {
        // Sólo se guarda si cambió: soltar sin mover no tiene que escribir.
        if (s && s.dur !== s.base) void cambiarDuracion(s.id, s.dur);
        return null;
      });
    };
    document.addEventListener('mousemove', mover);
    document.addEventListener('mouseup', soltar);
    const antes = document.body.style.cursor;
    document.body.style.cursor = 'ns-resize';
    return () => {
      document.removeEventListener('mousemove', mover);
      document.removeEventListener('mouseup', soltar);
      document.body.style.cursor = antes;
    };
  }, [estirando?.id, cambiarDuracion]);

  const titulo =
    vista === 'Semanal'
      ? `${fechaLarga(diasVisibles[0]!)} — ${fechaLarga(diasVisibles[5]!)}`
      : vista === 'Diaria'
        ? `${DIAS[(new Date(`${referencia}T12:00:00Z`).getUTCDay() + 6) % 7] ?? ''} ${fechaLarga(referencia)}`
        : `${visibles.length} reuniones`;

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
    <aside className="agenda" style={anchoAgenda.estilo}>
      <div
        className="divisor divisor-izq"
        title="Arrastra para cambiar el ancho de la agenda - doble clic para volver al ancho normal"
        {...anchoAgenda.divisor}
      />
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

        {/* §7.6: filtro por cuenta. Con seis cuentas trabajando, la semana es
            una pared de bloques y no se puede leer la de una sola. */}
        {cuentas.length > 1 && (
          <div className="reunion-segmentado agenda-cuentas">
            <button
              type="button"
              className={fCuenta === 'todas' ? 'reunion-seg-on' : ''}
              onClick={() => setFCuenta('todas')}
            >
              todas
            </button>
            {cuentas.map((c) => (
              <button
                key={c}
                type="button"
                className={fCuenta === c ? 'reunion-seg-on' : ''}
                title={`Solo las reuniones de ${c}`}
                onClick={() => setFCuenta(fCuenta === c ? 'todas' : c)}
              >
                {c}
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
                          duracion={estirando?.id === e.id ? estirando.dur : e.duracion}
                          abierto={hover === e.id}
                          onHover={setHover}
                          onArrastrar={setArrastrando}
                          onEstado={cambiarEstado}
                          onEstirar={(x, y) => setEstirando({ id: x.id, y0: y, base: x.duracion, dur: x.duracion })}
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
                      duracion={estirando?.id === e.id ? estirando.dur : e.duracion}
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
            <span />
            <span>Lead</span>
            <span>Nueva</span>
            <span />
            <span />
            <span>Etiquetas</span>
          </div>
          {avisoLista && <div className="agenda-aviso">{avisoLista}</div>}
          {filas.length === 0 && <p className="vacio">Ningún lead con seguimiento.</p>}
          {filas.map((l) => {
            const suyas = eventos.filter((e) => e.lead === l.id);
            const pasadas = suyas.filter((e) => e.fecha <= hoy);
            const ultima = pasadas[pasadas.length - 1] ?? null;
            const p = l.expand?.perfil;
            const foto = p?.foto ? pb.files.getURL(p, p.foto, { thumb: '48x48' }) : '';
            const iniciales = (p?.nombre ?? '?')
              .split(' ')
              .filter(Boolean)
              .slice(0, 2)
              .map((x) => x[0])
              .join('')
              .toUpperCase();
            return (
              <div key={l.id} className="agenda-lista-envoltorio">
              <div className="agenda-lista-fila">
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
                {/* §7.6: el próximo contacto se EDITA acá. Es la mitad del
                    sentido de esta vista: se recorre el seguimiento y se
                    corrigen fechas sin abrir ficha por ficha. */}
                <input
                  type="date"
                  className="agenda-lista-fechainput tabular"
                  title="Fecha del próximo contacto"
                  defaultValue={l.proximo_contacto ? String(l.proximo_contacto).slice(0, 10) : ''}
                  onChange={(ev) => void cambiarProximo(l.id, ev.target.value)}
                />

                {/* La foto se PEGA del portapapeles: de LinkedIn se copia, no
                    se descarga. Sin esto habría que abrir la imagen en otra
                    pestaña, guardarla y después buscarla. */}
                <button
                  type="button"
                  className="agenda-lista-foto"
                  title={foto ? 'Pegar otra imagen del portapapeles' : 'Pegar una foto del portapapeles'}
                  onClick={async () => {
                    try {
                      const ok = await pegarFoto(l.perfil);
                      setAvisoLista(ok ? null : 'No hay ninguna imagen en el portapapeles.');
                    } catch {
                      setAvisoLista('El navegador no dejó leer el portapapeles.');
                    }
                  }}
                >
                  {foto ? <img src={foto} alt="" /> : iniciales}
                </button>

                <button type="button" className="agenda-lista-lead" onClick={() => onIrAlLead(l.id)}>
                  <span className="pastilla">{l.expand?.cuenta?.abrev}</span>
                  <span className="agenda-lista-nombre">{l.expand?.perfil?.nombre}</span>
                </button>

                <input
                  type="date"
                  className="agenda-lista-fechainput tabular"
                  title="Agendar una reunión nueva ese día, a las 10"
                  value=""
                  onChange={(ev) => void nuevaReunion(l.id, ev.target.value)}
                />

                <button
                  type="button"
                  className={`agenda-lista-icono ${notasDe === l.id ? 'agenda-lista-icono-on' : ''}`}
                  title="Notas"
                  onClick={() => {
                    setNotasDe(notasDe === l.id ? null : l.id);
                    setBorradorNota(l.nota ?? '');
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                    <path d="M5 4h14v12l-4 4H5z" />
                    <path d="M8 9h8M8 13h5" />
                  </svg>
                </button>

                <div className="agenda-lista-links">
                  <a
                    className="agenda-lista-icono"
                    href={
                      l.expand?.perfil?.slug
                        ? `https://www.linkedin.com/in/${l.expand.perfil.slug}`
                        : '#'
                    }
                    target="_blank"
                    rel="noreferrer"
                    title="Perfil de LinkedIn"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M7 17L17 7M17 7h-7M17 7v7" />
                    </svg>
                  </a>
                  {/* Sin teléfono el icono queda apagado con el motivo, nunca
                      oculto (§9.7): que falte un dato se dice. */}
                  {l.expand?.perfil?.telefono_valido ? (
                    <a
                      className="agenda-lista-icono agenda-lista-wa"
                      href={`https://wa.me/${String(l.expand?.perfil?.telefono ?? '').replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      title="Abrir el WhatsApp del lead"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M20 15a3 3 0 01-3 3H8l-4 3V6a3 3 0 013-3h10a3 3 0 013 3z" />
                      </svg>
                    </a>
                  ) : (
                    <span className="agenda-lista-icono agenda-lista-apagado" title="Sin teléfono cargado">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M20 15a3 3 0 01-3 3H8l-4 3V6a3 3 0 013-3h10a3 3 0 013 3z" />
                        <path d="M4 4l16 16" />
                      </svg>
                    </span>
                  )}
                </div>

                <div className="chips">
                  {(l.expand?.etiquetas ?? []).map((e) => (
                    <span key={e.id} className="chip-etiqueta">
                      {e.nombre}
                    </span>
                  ))}
                  {!(l.expand?.etiquetas ?? []).length && (
                    <span className="campo-ayuda">sin etiquetas</span>
                  )}
                </div>
              </div>

              {notasDe === l.id && (
                <div className="agenda-lista-notas">
                  <textarea
                    value={borradorNota}
                    placeholder="Notas de la reunión…"
                    onChange={(ev) => setBorradorNota(ev.target.value)}
                    // Al salir, no a cada tecla: escribir la nota entera serían
                    // decenas de PATCH.
                    onBlur={() => void cambiarNota(l.id, borradorNota)}
                  />
                </div>
              )}
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
  duracion,
  abierto,
  onHover,
  onArrastrar,
  onEstado,
  onEstirar,
  onIrAlLead,
}: {
  e: EventoAgenda;
  desplazado: number;
  /** La de la reunión, o la que está tomando mientras se la estira. */
  duracion: number;
  abierto: boolean;
  onHover: (id: string | null) => void;
  onArrastrar: (e: EventoAgenda | null) => void;
  onEstado: (id: string, estado: string) => Promise<void>;
  /** Falta en la vista diaria, donde el alto lo pone la fila. */
  onEstirar?: (e: EventoAgenda, y: number) => void;
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
      // §7.6: el bloque MIDE lo que dura. Con todos del mismo alto, una
      // reunión de dos horas y una de quince minutos se ven igual y la agenda
      // no dice cuánto ocupa el día.
      style={{ marginTop: `${desplazado}%`, height: `${Math.max(20, (duracion / 15) * 22 - 4)}px` }}
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

      {/* La manija de estirar. Va fuera del borde de abajo para poder
          agarrarla sin tapar el texto del bloque. */}
      {onEstirar && (
        <span
          className="agenda-estirar"
          title="Estirar para cambiar la duración"
          onMouseDown={(ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            onEstirar(e, ev.clientY);
          }}
        >
          <span className="agenda-estirar-linea" />
        </span>
      )}

      {abierto && (
        <div className="agenda-hover" onClick={(ev) => ev.stopPropagation()}>
          <span className="agenda-hover-nombre">{e.nombre}</span>
          <span className="campo-ayuda">
            {[e.empresa, e.cargo].filter(Boolean).join(' · ') || 'sin empresa cargada'}
          </span>
          <div className="agenda-hover-datos">
            <span className="pastilla">{e.cuenta}</span>
            <span className="pastilla tabular">
              {e.hora} · {duracion}′
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
