import { useEffect, useMemo, useState } from 'react';
import { pb } from '../../lib/pocketbase';
import { abrirConPerfil } from '../../lib/abrir';
import { IconoNotas } from '../../ui/iconos';
import { PANEL_AGENDA } from '@crm/core/anchos';
import { diaLocal } from '@crm/core/fecha';
import { useAncho } from '../../lib/useAncho';
import {
  ALTO_HORA, bloqueDelEvento, carriles, duracionAlEstirar, enMinutos, horaEnLaColumna,
  porUltimaReunion,
} from '@crm/core/reunion';
import type { UsuarioRecord, LeadRecord } from '../../lib/types';
import { leadsConSeguimiento, useAgenda, type EventoAgenda } from './useAgenda';
import { personasSinLead, type PersonaDelCalendario } from '@crm/core/vincular';
import { ConectarEvento } from './ConectarEvento';
import { CampoDia } from '../../ui/CampoDia';

/**
 * La franja de trabajo. Fuera de 8 a 20 no se agenda, así que dibujar el resto
 * del día sería scroll vacío.
 */
const HORA_DESDE = 8;
const HORA_HASTA = 20;
/** Cuántas filas de hora tiene la grilla. La última se dibuja entera. */
const HORAS = HORA_HASTA - HORA_DESDE + 1;

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
  /** Qué lead está abierto en la ficha, para iluminar su fila en la Lista. */
  seleccionado: string | null;
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
export function Agenda({ leads, usuario, seleccionado, onCerrar, onIrAlLead }: Props) {
  const {
    eventos,
    cargando,
    error,
    mover,
    cambiarEstado,
    archivarConfirmacion,
    cambiarDuracion,
    cambiarProximo,
    cambiarNota,
    pegarFoto,
    nuevaReunion,
    guardarNotas,
    externos,
    vincularEventos,
  } = useAgenda(true, usuario);
  const [vista, setVista] = useState<Vista>('Semanal');
  const [offset, setOffset] = useState(0);
  /**
   * De qué persona del calendario es cada evento sin lead (§7.6).
   *
   * Se calcula sobre TODOS los eventos y no sobre los de la semana que se está
   * mirando: al hacer clic en «Brenno» del martes hay que conectar los 38 que
   * tiene repartidos en el año, no los dos que se ven en pantalla.
   */
  const personaPorEvento = useMemo(() => {
    const mapa = new Map<string, PersonaDelCalendario>();
    for (const persona of personasSinLead(externos)) {
      for (const id of persona.eventos) mapa.set(id, persona);
    }
    return mapa;
  }, [externos]);

  const [arrastrando, setArrastrando] = useState<EventoAgenda | null>(null);
  const [destino, setDestino] = useState<{ fecha: string; hora: string } | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  /** La persona del calendario que se está por conectar con un lead (§7.6). */
  const [conectando, setConectando] = useState<PersonaDelCalendario | null>(null);
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
  const [estirando, setEstirando] = useState<{
    id: string;
    y0: number;
    base: number;
    dur: number;
    /** De qué colección es: una reunión del CRM o un evento de Google. */
    origen: EventoAgenda['origen'];
  } | null>(null);
  /**
   * 7.7 · Con qué perfil de Chrome se abren los links de esta pantalla.
   *
   * En la agenda es SIEMPRE el mismo, sin importar de qué cuenta venga el lead:
   * acá uno está mirando su semana, no actuando desde una cuenta. Sale de
   * la configuracion «navegador», asi que se cambia sin tocar codigo.
   */
  const [perfilChrome, setPerfilChrome] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    pb.collection('configuracion')
      .getFirstListItem<{ valor: string }>('clave = "navegador"')
      .then((r) => {
        if (!vivo) return;
        try {
          setPerfilChrome(JSON.parse(r.valor)?.lista ?? null);
        } catch {
          setPerfilChrome(null);
        }
      })
      .catch(() => {
        // Sin configuración se abre como siempre.
      });
    return () => {
      vivo = false;
    };
  }, []);

  /** Qué fila tiene abiertas las notas, en la vista Lista. */
  const [notasDe, setNotasDe] = useState<string | null>(null);
  /**
   * Qué reunión tiene la fecha abierta para corregir, en la vista Lista.
   *
   * Es CORREGIR y no reagendar: la que muestra la columna «Última» ya pasó.
   * Por eso el hook de Google no le avisa a nadie cuando la fecha que se
   * cambia es de una reunión pasada — «tu reunión se movió» por algo de hace
   * ocho meses no es un aviso, es ruido.
   */
  const [fechaDe, setFechaDe] = useState<string | null>(null);
  /** Lo escrito sin guardar todavía, para no pedir un PATCH por tecla. */
  const [borradorNota, setBorradorNota] = useState('');
  const [avisoLista, setAvisoLista] = useState<string | null>(null);

  /**
   * La confirmación de lo que se acaba de hacer (§8.3).
   *
   * *«Cambiar hora, fecha o duración desde la agenda actualiza el evento (la
   * interfaz confirma con "Calendar actualizado")»*. Vive acá y no en la
   * tarjeta del evento porque la tarjeta se desmonta cuando los eventos se
   * recargan — o sea, justo cuando hay algo que confirmar.
   */
  const [aviso, setAviso] = useState('');
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(''), 3000);
    return () => clearTimeout(t);
  }, [aviso]);
  const [chequeados, setChequeados] = useState<Set<string>>(new Set());

  /**
   * La hora de ahora, para la línea roja de la grilla (§7.6).
   *
   * Se actualiza cada minuto y no cada segundo: la línea se corre un píxel
   * cada tres minutos, así que un tick por segundo serían 59 renders de más
   * por cada uno que cambia algo.
   */
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const relojDeAhora =
    String(ahora.getHours()).padStart(2, '0') + ':' + String(ahora.getMinutes()).padStart(2, '0');
  /** Dónde cae en la columna, en %. Fuera de la franja de trabajo no se dibuja. */
  const dondeEstaAhora = (() => {
    const m = ahora.getHours() * 60 + ahora.getMinutes();
    if (m < HORA_DESDE * 60 || m > (HORA_DESDE + HORAS) * 60) return null;
    return ((m - HORA_DESDE * 60) / (HORAS * 60)) * 100;
  })();

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
        if (s && s.dur !== s.base) {
          void cambiarDuracion(s.id, s.dur, s.origen);
          setAviso(`${s.dur} min · Calendar actualizado`);
        }
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

/**
   * Dónde cae el puntero dentro de la columna del día, en cuartos de hora.
   *
   * Se mide contra la columna entera y no contra una celda: en la grilla nueva
   * no hay celdas, la columna es una sola pieza de HORAS × ALTO_HORA.
   */
  function cuartoDe(ev: React.DragEvent): string {
    const caja = ev.currentTarget.getBoundingClientRect();
    return horaEnLaColumna(caja.height ? (ev.clientY - caja.top) / caja.height : 0, HORA_DESDE, HORAS);
  }

  async function soltar(fecha: string, hora: string) {
    if (!arrastrando) return;
    const e = arrastrando;
    setArrastrando(null);
    setDestino(null);
    // §7.6 · El origen decide a qué colección se escribe. Desde el 09/09 los
    // eventos de Google también se mueven: son 1769 contra 288 reuniones, así
    // que bloquearlos era bloquear casi toda la pantalla.
    await mover(e.id, fecha, hora, e.origen);
    // Lo que se avisa depende de si ya pasó, igual que en el servidor: decirle
    // «avisado» cuando el hook no avisó a nadie sería mentirle a la pantalla.
    const paso = fecha < hoy;
    setAviso(paso ? `${hora} · corregido, sin avisar` : `${hora} · Calendar actualizado`);
  }

/**
   * El hueco que ocuparía el evento si se lo soltara acá.
   *
   * Antes se pintaban las celdas que tocaba; ahora se dibuja un solo rectángulo
   * del alto exacto de la reunión, que es lo que se está por hacer.
   */
  function huecoDestino(fecha: string) {
    if (!arrastrando || !destino || destino.fecha !== fecha) return null;
    return bloqueDelEvento(destino.hora, arrastrando.duracion, HORA_DESDE, HORAS);
  }

  /** La última reunión YA OCURRIDA de cada lead: la fecha de la columna «Última». */
  const ultimaDe = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of eventos) {
      if (!e.lead || e.fecha > hoy) continue;
      const previa = m.get(e.lead);
      if (!previa || e.fecha > previa) m.set(e.lead, e.fecha);
    }
    return m;
  }, [eventos, hoy]);

  const filas = useMemo(() => {
    const conSeguimiento = leadsConSeguimiento(leads);
    const filtradas =
      fCheck === 'todos'
        ? conSeguimiento
        : conSeguimiento.filter((l) =>
            fCheck === 'con' ? chequeados.has(l.id) : !chequeados.has(l.id),
          );
    // §7.6: la reunión más nueva arriba, siempre. Antes salían en el orden en
    // que los devolvía la base, que es por fecha de creación del lead: la
    // columna de fechas se veía salteada y no se podía recorrer.
    return porUltimaReunion(filtradas, (l) => ultimaDe.get(l.id));
  }, [leads, fCheck, chequeados, ultimaDe]);

  return (
    <aside className="agenda" style={anchoAgenda.estilo}>
      <div
        className="divisor divisor-izq"
        title="Arrastra para cambiar el ancho de la agenda - doble clic para volver al ancho normal"
        {...anchoAgenda.divisor}
      />
      {aviso && (
        <div className="agenda-aviso-flotante">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M5 13l4 4L19 7" />
          </svg>
          {aviso}
        </div>
      )}

      {/* §7.6 · Conectar los eventos de una persona del calendario con un
          lead. Se abre desde cualquier bloque de Google que sea de prospección
          y todavía no tenga lead. */}
      {conectando && (
        <ConectarEvento
          persona={conectando}
          onVincular={vincularEventos}
          onCerrar={() => setConectando(null)}
          onConectado={() =>
            setAviso(
              conectando.cuantos === 1
                ? `«${conectando.nombre}» quedó conectado.`
                : `Los ${conectando.cuantos} eventos de «${conectando.nombre}» quedaron conectados.`,
            )
          }
        />
      )}

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

        {/* Acá estaban los chips «Mío / Alberto». Se fueron: el calendario es
            uno solo y ya trae los horarios de los otros administradores como
            bloques ocupados. Elegir de a uno era mirar dos veces la misma
            semana para responder una sola pregunta. */}

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

      {/* ------------------------------------------------ semanal y diaria */}
      {/*
        La misma grilla para las dos: cambia cuántos días entran, no cómo se
        dibujan. Tenerlas separadas costaba que la diaria no dejara estirar
        —el `onEstirar` estaba puesto en una sola de las dos— y que cualquier
        arreglo de la agenda hubiera que hacerlo dos veces.
      */}
      {(vista === 'Semanal' || vista === 'Diaria') && (
        <div className="agenda-semana">
          <div className={`agenda-fila-cabeza ${vista === 'Diaria' ? 'agenda-un-dia' : ''}`}>
            <span className="agenda-hora-col" />
            {(vista === 'Semanal' ? diasVisibles : [referencia]).map((iso, k) => (
              <span
                key={iso}
                className={`agenda-cabeza ${iso === hoy ? 'agenda-cabeza-hoy' : ''} ${vista === 'Semanal' && k === 5 ? 'agenda-cabeza-finde' : ''}`}
              >
                <span className="agenda-cabeza-dia">
                  {vista === 'Semanal'
                    ? CORTOS[k]
                    : DIAS[(new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7]}
                </span>
                <span className="agenda-cabeza-n tabular">{Number(iso.slice(8, 10))}</span>
                {/*
                  Cuántas REUNIONES hay ese día (§7.6). No cuenta el almuerzo
                  ni los bloques ajenos: la pregunta que contesta el número es
                  «¿cuánta gente veo el jueves?», y para eso un bloqueo de
                  Google no es una respuesta. Las canceladas tampoco: siguen
                  dibujadas, pero no son una reunión que va a pasar.
                */}
                {(() => {
                  const n = (porDia.get(iso) ?? []).filter(
                    (e) => (e.delCrm || e.vinculado) && e.estado !== 'cancelada',
                  ).length;
                  if (!n) return null;
                  return (
                    <span
                      className="agenda-cabeza-cuantas tabular"
                      title={n === 1 ? '1 reunión' : `${n} reuniones`}
                    >
                      {n}
                    </span>
                  );
                })()}
              </span>
            ))}
          </div>

          <div
            className={`agenda-cuerpo ${vista === 'Diaria' ? 'agenda-un-dia' : ''}`}
            style={
              {
                '--alto-hora': `calc(${ALTO_HORA}px * var(--escala-texto))`,
                '--horas': HORAS,
              } as React.CSSProperties
            }
          >
            {/* La regla de horas. Cada etiqueta se apoya en su línea. */}
            <div className="agenda-regla">
              {Array.from({ length: HORAS }, (_, i) => HORA_DESDE + i).map((h) => (
                <span key={h} className="agenda-hora-col tabular">
                  {String(h).padStart(2, '0')}:00
                </span>
              ))}
            </div>

            {(vista === 'Semanal' ? diasVisibles : [referencia]).map((iso, k) => {
              const delDia = porDia.get(iso) ?? [];
              // Los que se pisan se reparten el ancho: uno encima de otro
              // haría desaparecer al de atrás sin ninguna señal.
              const reparto = carriles(
                delDia.map((e) => ({ a: enMinutos(e.hora), b: enMinutos(e.hora) + e.duracion })),
              );
              const hueco = huecoDestino(iso);
              return (
                <div
                  key={iso}
                  className={`agenda-col ${iso === hoy ? 'agenda-col-hoy' : ''} ${vista === 'Semanal' && k === 5 ? 'agenda-col-finde' : ''}`}
                  onDragOver={(ev) => {
                    if (!arrastrando) return;
                    ev.preventDefault();
                    setDestino({ fecha: iso, hora: cuartoDe(ev) });
                  }}
                  onDrop={(ev) => {
                    if (!arrastrando) return;
                    ev.preventDefault();
                    void soltar(iso, cuartoDe(ev));
                  }}
                >
                  {hueco && (
                    <div
                      className="agenda-hueco"
                      style={{ top: `${hueco.arriba}%`, height: `${hueco.alto}%` }}
                    />
                  )}

                  {/* Acá iban los carteles de rato libre. Se fueron el 09/09:
                      «no me sirve y no quiero». En texto sonaban útiles; en
                      pantalla eran catorce carteles por semana peleándole
                      atención a las reuniones. La regla sigue viva en
                      core/huecos.ts por si algún día tiene otro lugar. */}

                  {/* La línea de ahora, sólo en la columna de hoy (§7.6). */}
                  {iso === hoy && dondeEstaAhora !== null && (
                    <div className="agenda-ahora" style={{ top: `${dondeEstaAhora}%` }}>
                      <span className="agenda-ahora-reloj tabular">{relojDeAhora}</span>
                    </div>
                  )}
                  {delDia.map((e, i) => {
                    const dur = estirando?.id === e.id ? estirando.dur : e.duracion;
                    const b = bloqueDelEvento(e.hora, dur, HORA_DESDE, HORAS);
                    const c = reparto[i] ?? { carril: 0, carriles: 1 };
                    return (
                      <Evento
                        perfilChrome={perfilChrome}
                        key={e.id}
                        e={e}
                        caja={{
                          top: `${b.arriba}%`,
                          height: `${b.alto}%`,
                          left: `${(c.carril / c.carriles) * 100}%`,
                          width: `${(1 / c.carriles) * 100}%`,
                        }}
                        duracion={dur}
                        abierto={hover === e.id}
                        onHover={setHover}
                        onArrastrar={setArrastrando}
                        onEstado={cambiarEstado}
                        onEstirar={(x, y) =>
                          setEstirando({ id: x.id, y0: y, base: x.duracion, dur: x.duracion, origen: x.origen })
                        }
                        onIrAlLead={onIrAlLead}
                        onNotas={guardarNotas}
                        onFoto={pegarFoto}
                        onMover={mover}
                        onAviso={setAviso}
                        onConectar={setConectando}
                        persona={personaPorEvento.get(e.id) ?? null}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/*
            La leyenda de la grilla (§7.6).

            La grilla dibuja seis clases de bloque y hasta hoy nada decía cuál
            era cuál: había que deducirlo del color.

            Nota del 09/09, tarde: acá decía que el resto del mockup «bajaba el
            contraste, que es lo contrario de lo que hacía falta». Estaba mal y
            Augusto tenía razón. La paleta clara del mockup era la dirección
            correcta —es la que usa el resto del dashboard—; lo que faltaba no
            era subir el tono sino MEDIR los pares. Medidos dan entre 5.30 y
            6.59, o sea más que los bloques sólidos que habían reemplazado al
            mockup. La lección quedó en APRENDIZAJES: 4.5:1 es el piso, no el
            criterio.
          */}
          <div className="agenda-leyenda">
            {(
              [
                ['programada', 'Programada'],
                ['asistio', 'Asistió'],
                ['no-asistio', 'No asistió'],
                ['cancelada', 'Canceló'],
                ['vinculado', 'De Google, con lead'],
                ['conectable', 'De Google, sin lead'],
                ['google', 'Bloqueo de Google'],
                ['ajeno', 'Ocupado (otra agenda)'],
              ] as const
            ).map(([clave, texto]) => (
              <span key={clave} className="agenda-leyenda-item">
                <span className={`agenda-leyenda-muestra agenda-leyenda-${clave}`} />
                {texto}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- lista */}
      {vista === 'Lista' && (
        <div className="agenda-lista">
          <div className="agenda-lista-cabeza">
            <span />
            <span>Última</span>
            <span />
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
              <div
                key={l.id}
                className={`agenda-lista-envoltorio ${seleccionado === l.id ? 'agenda-lista-on' : ''}`}
              >
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
                {/* 7.6 · La última reunión, y si todavía nadie dijo qué pasó,
                    las dos formas de decirlo. De las 288 importadas, 173 están
                    en «sin dato»: la reunión consta y el resultado no. Se
                    confirma acá, sin abrir nada, porque es lo que uno recuerda
                    mientras recorre la lista. */}
                {ultima && fechaDe === ultima.id ? (
                  // Abierta para corregir. El input se va solo al perder el
                  // foco: no hace falta un botón de cancelar para un campo.
                  <input
                    type="date"
                    className="agenda-lista-fecha-editar tabular"
                    defaultValue={ultima.fecha}
                    autoFocus
                    onBlur={() => setFechaDe(null)}
                    onKeyDown={(ev) => {
                      if (ev.key === 'Escape') setFechaDe(null);
                    }}
                    onChange={(ev) => {
                      const nueva = ev.target.value;
                      if (!nueva || nueva === ultima.fecha) return setFechaDe(null);
                      setFechaDe(null);
                      void mover(ultima.id, nueva, ultima.hora).then(
                        () => setAvisoLista(`La reunión pasó al ${nueva}.`),
                        (e: unknown) =>
                          setAvisoLista(e instanceof Error ? e.message : String(e)),
                      );
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className={`agenda-lista-fecha tabular ${ultima?.estado === 'no-asistio' ? 'agenda-no-asistio' : ultima?.estado === 'asistio' ? 'agenda-asistio' : ''}`}
                    disabled={!ultima}
                    title={
                      ultima
                        ? (ultima.estado === 'asistio'
                            ? `Reunión del ${ultima.fecha}: asistió`
                            : ultima.estado === 'no-asistio'
                              ? `Reunión del ${ultima.fecha}: no asistió`
                              : `Reunión del ${ultima.fecha}: falta confirmar si asistió`) +
                          ' · tocá para corregir la fecha. Ya pasó, así que no se le avisa a nadie.'
                        : 'Todavía no hubo ninguna reunión'
                    }
                    onClick={() => ultima && setFechaDe(ultima.id)}
                  >
                    {ultima ? `${ultima.fecha.slice(8, 10)}/${ultima.fecha.slice(5, 7)}` : '—'}
                  </button>
                )}

                {/* 7.6 · Confirmar si fue o no fue, sin abrir nada. Sólo
                    aparece cuando falta el dato: una reunión ya confirmada no
                    necesita dos botones al lado pidiendo que se la confirme. */}
                {ultima &&
                ultima.estado !== 'asistio' &&
                ultima.estado !== 'no-asistio' &&
                !ultima.confirmacionArchivada ? (
                  <span className="agenda-lista-confirmar">
                    <button
                      type="button"
                      title="Sí asistió"
                      onClick={() => void cambiarEstado(ultima.id, 'asistio')}
                    >
                      ✓
                    </button>
                    <button
                      type="button"
                      title="No asistió"
                      onClick={() => void cambiarEstado(ultima.id, 'no-asistio')}
                    >
                      ✕
                    </button>
                    {/* «No me acuerdo». De una reunión de hace ocho meses nadie
                        se acuerda, y sin esta opción las 173 sin confirmar
                        piden para siempre un dato que no existe. La fecha sigue
                        en la columna y la reunión sigue en el histórico: lo
                        único que desaparece son estos botones. */}
                    <button
                      type="button"
                      className="agenda-lista-nose"
                      title="No me acuerdo: archivar la confirmación. La reunión queda en el histórico."
                      onClick={() => void archivarConfirmacion(ultima.id)}
                    >
                      –
                    </button>
                  </span>
                ) : (
                  <span className="agenda-lista-confirmar" />
                )}
                {/* §7.6: el próximo contacto se EDITA acá. Es la mitad del
                    sentido de esta vista: se recorre el seguimiento y se
                    corrigen fechas sin abrir ficha por ficha. */}
                {/* Día y mes, sin año y sin el icono del navegador (§7.6).
                    El año lo deduce `core/fecha.ts`: hacia adelante, porque
                    un próximo contacto es algo que todavía no pasó. */}
                <CampoDia
                  valor={l.proximo_contacto ? String(l.proximo_contacto).slice(0, 10) : ''}
                  titulo="Fecha del próximo contacto"
                  preferir="futuro"
                  onCambiar={(iso) => {
                    if (iso) void cambiarProximo(l.id, iso);
                  }}
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

                <CampoDia
                  valor=""
                  vacio="nueva"
                  titulo="Agendar una reunión nueva ese día, a las 10"
                  preferir="futuro"
                  onCambiar={(iso) => {
                    if (iso) void nuevaReunion(l.id, iso);
                  }}
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
                  <IconoNotas />
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
                    title={
                      perfilChrome
                        ? `Perfil de LinkedIn — se abre en el Chrome «${perfilChrome}»`
                        : 'Perfil de LinkedIn'
                    }
                    onClick={(ev) => {
                      const slug = l.expand?.perfil?.slug;
                      if (!slug || !perfilChrome) return;
                      ev.preventDefault();
                      void abrirConPerfil(`https://www.linkedin.com/in/${slug}`, perfilChrome);
                    }}
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
  caja,
  duracion,
  abierto,
  onHover,
  onArrastrar,
  onEstado,
  onEstirar,
  onIrAlLead,
  onNotas,
  onFoto,
  onMover,
  onAviso,
  perfilChrome,
  onConectar,
  persona,
}: {
  e: EventoAgenda;
  /** Dónde va dentro de la columna del día: hora, duración y carril. */
  caja: React.CSSProperties;
  /** La de la reunión, o la que está tomando mientras se la estira. */
  duracion: number;
  abierto: boolean;
  onHover: (id: string | null) => void;
  onArrastrar: (e: EventoAgenda | null) => void;
  onEstado: (id: string, estado: string) => Promise<void>;
  onEstirar?: (e: EventoAgenda, y: number) => void;
  onIrAlLead: (id: string) => void;
  /** §7.6: la tarjeta edita notas, foto y la fecha/hora de la reunión. */
  onNotas: (id: string, notas: string) => Promise<void>;
  onFoto: (perfilId: string) => Promise<boolean>;
  /** 7.7 · Con que perfil de Chrome se abre el LinkedIn desde la tarjeta. */
  perfilChrome: string | null;
  onMover: (id: string, fecha: string, hora: string) => Promise<void>;
  /** El cartel vive en la agenda: la tarjeta se desmonta al recargar. */
  onAviso: (texto: string) => void;
  /**
   * §7.6 · Conectar este evento del calendario con un lead.
   *
   * Sólo tiene sentido en los bloques que vinieron de Google y todavía no
   * tienen lead. `persona` es null cuando el evento no es de prospección —el
   * almuerzo, la clase— y entonces no se ofrece nada: no hay lead que ponerle
   * a un almuerzo.
   */
  onConectar: (p: PersonaDelCalendario) => void;
  persona: PersonaDelCalendario | null;
}) {
  // Lo que se está escribiendo, sin guardar todavía.
  const [notas, setNotas] = useState(e.notas);
  const [fecha, setFecha] = useState(e.fecha);
  const [hora, setHora] = useState(e.hora);
  /** Sólo el de la foto: el de mover lo muestra la agenda. */
  const [avisoFoto, setAvisoFoto] = useState<string | null>(null);
  const cambio = fecha !== e.fecha || hora !== e.hora;
  // §6.3: el bloque de otro calendario dice CUÁNDO y nada más. No se arrastra
  // —no es tuyo—, no abre ficha —no hay lead que abrir— y no tiene tarjeta de
  // hover, porque no hay nada que mostrar ahí.
  // §7.6 · Lo demás del propio Google Calendar: el almuerzo, la clase, la
  // reunión interna. Se dibuja con su título —es de uno— pero no se arrastra
  // ni se abre: acá no hay lead, y moverlo desde el CRM daría a entender que
  // el CRM lo controla, cuando el dueño de ese evento es Google.
  if (e.origen === 'calendario') {
    /*
      §7.6 · LOS BLOQUES DE GOOGLE, QUE DESDE EL 09/09 SE MUEVEN.

      Hasta ese día no se arrastraban a propósito, y el comentario que estaba
      acá lo justificaba: «moverlo desde acá daría a entender que el CRM lo
      controla, cuando el dueño de ese evento es Google». El argumento era
      cierto y la decisión no era mía. Augusto: «mantengo apretado y quiero
      mover hacia abajo, no me deja; eso debería ser una funcionalidad, y
      tiene que mandar una notificación a la persona».

      Y el costo era peor de lo que parecía: son 1769 eventos de Google contra
      288 reuniones del CRM. El arrastre estaba habilitado en la porción chica
      de la pantalla y bloqueado en toda la otra.

      Las tres clases comparten envoltorio en vez de tener tres returns con su
      propio `draggable`: escribir el arrastre tres veces es la forma segura de
      que dentro de un mes funcione en dos de las tres.
    */
    const conectable = !e.vinculado && persona;
    const clase = e.vinculado && e.lead
      ? 'agenda-evento agenda-evento-vinculado'
      : conectable
        ? 'agenda-evento agenda-evento-calendario agenda-evento-conectable'
        : 'agenda-evento agenda-evento-calendario';

    const titulo = e.vinculado && e.lead
      ? `${e.nombre} · conectado con un lead · arrastralo para moverlo en Google`
      : conectable
        ? persona!.cuantos === 1
          ? `${e.nombre} · sin lead. Tocá para conectarlo, arrastrá para moverlo.`
          : `${e.nombre} · sin lead. Tocá para conectar los ${persona!.cuantos} eventos de esta persona.`
        : `${e.nombre} · de tu Google Calendar. Arrastralo para moverlo.`;

    return (
      <div className="agenda-bloque" style={caja}>
        <div
          className={clase}
          title={titulo}
          draggable
          onDragStart={(ev) => {
            // Firefox no arranca el arrastre sin datos en el dataTransfer.
            ev.dataTransfer.setData('text/plain', e.id);
            onArrastrar(e);
          }}
          onDragEnd={() => onArrastrar(null)}
          onClick={() => {
            if (e.vinculado && e.lead) return onIrAlLead(e.lead);
            if (conectable) return onConectar(persona!);
          }}
        >
          <span className="agenda-evento-hora tabular">{e.hora}</span>
          <span className="agenda-evento-nombre">{e.nombre}</span>
          {conectable && <span className="agenda-evento-conectar">conectar</span>}
        </div>

        {/* La manija de estirar, también para los de Google. De a 15 minutos,
            igual que las reuniones del CRM: es el paso de la grilla. */}
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
      </div>
    );
  }

  if (e.ajeno) {
    return (
      <div className="agenda-bloque" style={caja}>
        <div
          className="agenda-evento agenda-evento-ajeno"
          title={`${e.nombre} tiene ese horario tomado`}
        >
          <span className="agenda-evento-hora tabular">{e.hora}</span>
          <span className="agenda-evento-nombre">{e.nombre}</span>
        </div>
      </div>
    );
  }

  return (
    // El envoltorio es el que ocupa el lugar en la columna. El bloque de
    // adentro recorta su texto, y la tarjeta y la manija cuelgan de acá: si
    // vivieran dentro del bloque las cortaría su `overflow: hidden`, y un
    // bloque de quince minutos no tiene alto para mostrar ninguna de las dos.
    <div
      className={`agenda-bloque ${abierto ? 'agenda-bloque-abierto' : ''}`}
      style={caja}
      onMouseEnter={() => onHover(e.id)}
      onMouseLeave={() => onHover(null)}
    >
      <div
        className={`agenda-evento agenda-evento-${e.estado}`}
        // §7.6: el bloque MIDE lo que dura, y por eso está posicionado sobre la
        // columna en vez de metido en la celda de su hora. Encerrado en la
        // celda, una reunión de 12:00 a 14:00 estiraba la fila de las 12 en
        // lugar de bajar hasta las 14.
        draggable
        onDragStart={(ev) => {
          // Firefox no arranca el arrastre sin datos en el dataTransfer.
          ev.dataTransfer.setData('text/plain', e.id);
          onArrastrar(e);
        }}
        onDragEnd={() => onArrastrar(null)}
        onClick={() => onIrAlLead(e.lead)}
      >
        <span className="agenda-evento-hora tabular">
          {e.hora}
          {/* La duración, al lado de la hora: es el dato que faltaba para
              saber hasta cuándo va la reunión sin tener que medirla a ojo. */}
          <span className="agenda-evento-dura"> · {duracion} min</span>
        </span>
        <span className="agenda-evento-nombre">{e.nombre}</span>
      </div>

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
          <div className="agenda-hover-cabeza">
            {/* La foto se pega del portapapeles (§7.6), igual que en la vista
                Lista: de LinkedIn se copia, no se descarga. */}
            <button
              type="button"
              className="agenda-lista-foto"
              title={e.foto ? 'Pegar otra imagen del portapapeles' : 'Pegar una foto del portapapeles'}
              onClick={async () => {
                try {
                  setAvisoFoto((await onFoto(e.perfil)) ? null : 'No hay ninguna imagen en el portapapeles.');
                } catch {
                  setAvisoFoto('El navegador no dejó leer el portapapeles.');
                }
              }}
            >
              {e.foto ? <img src={e.foto} alt="" /> : (e.nombre || '?').slice(0, 1).toUpperCase()}
            </button>
            <div className="agenda-hover-quien">
              <span className="agenda-hover-nombre">{e.nombre}</span>
              <span className="campo-ayuda">
                {[e.empresa, e.cargo].filter(Boolean).join(' · ') || 'sin empresa cargada'}
              </span>
            </div>
          </div>
          <div className="agenda-hover-datos">
            <span className="pastilla">{e.cuenta}</span>
            <span className="pastilla tabular">
              {e.hora} · {duracion}′
            </span>
            {e.ciudad && <span className="pastilla pastilla-suave">{e.ciudad}</span>}
            {e.duenio && <span className="pastilla pastilla-suave">{e.duenio}</span>}
          </div>
          {/* De dónde salió. La del CRM se reagenda desde acá; una de Google es
              un bloque que alguien puso en otro lado. */}
          <span className="campo-ayuda">
            {e.delCrm ? 'agendada desde el CRM' : 'evento de Google Calendar'}
          </span>

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

          {/* §7.6: las notas se ESCRIBEN acá. Antes se mostraban y para
              cambiarlas había que abrir la ficha, que es justo lo que la
              tarjeta existe para evitar. Se guardan al salir del campo. */}
          <textarea
            className="agenda-hover-notas"
            value={notas}
            placeholder="Notas de la reunión…"
            onChange={(ev) => setNotas(ev.target.value)}
            onBlur={() => notas !== e.notas && void onNotas(e.id, notas)}
          />

          {/* §7.6: «dos campos para cambiar hora y fecha». Reagendar sin abrir
              la ficha es la mitad de para qué sirve mirar la semana. */}
          <div className="agenda-hover-mover">
            <input
              type="date"
              className="agenda-lista-fechainput tabular"
              value={fecha}
              onChange={(ev) => setFecha(ev.target.value)}
            />
            <input
              type="time"
              step={900}
              className="agenda-lista-fechainput tabular"
              value={hora}
              onChange={(ev) => setHora(ev.target.value)}
            />
            <button
              type="button"
              className="boton-mini al-final"
              disabled={!cambio}
              title={cambio ? 'Mover la reunión y avisar' : 'Cambiá la fecha o la hora para poder mover'}
              onClick={async () => {
                // D10: el evento se actualiza, no se crea uno nuevo. El aviso
                // es el que confirma que Calendar quedó al día (§8.3).
                onAviso(`${hora} · Calendar actualizado`);
                await onMover(e.id, fecha, hora);
              }}
            >
              Guardar y notificar
            </button>
          </div>
          {avisoFoto && <span className="agenda-hover-aviso">{avisoFoto}</span>}

          {/* §9.7: «preferir deshabilitado con motivo antes que oculto». Un
              link que desaparece deja pensando si el lead no tiene LinkedIn o
              si la pantalla se rompió. */}
          <div className="agenda-hover-links">
            {e.slug ? (
              <a
                href={`https://www.linkedin.com/in/${e.slug}`}
                target="_blank"
                rel="noreferrer"
                className="boton-mini"
                title={perfilChrome ? `Se abre en el Chrome «${perfilChrome}»` : undefined}
                onClick={(ev) => {
                  if (!perfilChrome) return;
                  ev.preventDefault();
                  void abrirConPerfil(`https://www.linkedin.com/in/${e.slug}`, perfilChrome);
                }}
              >
                LinkedIn
              </a>
            ) : (
              <span className="boton-mini boton-mini-off" title="Sin perfil de LinkedIn cargado">
                LinkedIn
              </span>
            )}
            {e.telefono ? (
              <a
                href={`https://wa.me/${e.telefono.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="boton-mini"
              >
                WhatsApp
              </a>
            ) : (
              <span className="boton-mini boton-mini-off" title="Sin teléfono cargado">
                WhatsApp
              </span>
            )}
          </div>
          <span className="campo-ayuda">Arrastrá el evento para moverlo. Clic abre la ficha.</span>
        </div>
      )}
    </div>
  );
}
