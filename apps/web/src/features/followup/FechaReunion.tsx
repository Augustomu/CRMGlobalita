import { useEffect, useState } from 'react';
import {
  DURACION_DEFECTO, PASO_DURACION, descripcionEvento, finDe, tituloEvento,
  type EstadoReunion,
} from '@crm/core/reunion';
import { pb } from '../../lib/pocketbase';
import type { LeadRecord, ReunionRecord, UsuarioRecord } from '../../lib/types';

const ESTADOS: EstadoReunion[] = ['pendiente', 'asistio', 'no-asistio', 'cancelada'];

const NOMBRE_ESTADO: Record<string, string> = {
  pendiente: 'pendiente',
  asistio: 'asistió',
  'no-asistio': 'no asistió',
  cancelada: 'cancelada',
  reagendada: 'reagendada',
};

/** La zona del navegador. D23: se guarda con la reunión, no se asume. */
const ZONA = Intl.DateTimeFormat().resolvedOptions().timeZone;

/** De un <input type="datetime-local"> a un instante ISO. */
function aIso(local: string): string {
  return local ? new Date(local).toISOString() : '';
}

interface Props {
  lead: LeadRecord;
  usuario: UsuarioRecord | null;
  editable: boolean;
  onCambio: () => void;
}

/**
 * Reunión del lead (§3.2, §5.11). El objetivo de toda la cadencia es esto.
 *
 * El CRM todavía no escribe en Google Calendar por su cuenta — eso necesita
 * OAuth por usuario (§8.3) y llega con el worker. Mientras tanto arma el evento
 * exactamente como corresponde y te da el link para crearlo de un clic, que es
 * como venías trabajando.
 */
export function FechaReunion({ lead, usuario, editable, onCambio }: Props) {
  const [reuniones, setReuniones] = useState<ReunionRecord[]>([]);
  const [cuando, setCuando] = useState('');
  const [duracion, setDuracion] = useState(DURACION_DEFECTO);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const perfil = lead.expand?.perfil;

  async function recargar() {
    try {
      const r = await pb.collection('reunion').getFullList<ReunionRecord>({
        filter: `lead = "${lead.id}"`,
        sort: '-inicio',
      });
      setReuniones(r);
    } catch {
      setReuniones([]);
    }
  }

  useEffect(() => {
    void recargar();
    setCuando('');
    setDuracion(DURACION_DEFECTO);
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

  async function agendar() {
    if (!cuando || !editable) return;
    setGuardando(true);
    setError(null);
    try {
      const inicio = aIso(cuando);
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
      // Si el servidor lo escribio en Google, no hay nada que abrir. Si no
      // pudo, se abre el link armado como antes: la reunion nunca queda sin
      // forma de llegar al calendario.
      const conEstado = await pb.collection('reunion').getOne(creada.id).catch(() => null);
      if (conEstado?.sync !== 'ok') window.open(linkCalendar(inicio, duracion), '_blank');
      setCuando('');
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

  return (
    <div className="reunion">
      {proxima ? (
        <div className="reunion-proxima">
          <span className="campo-label">Próxima reunión</span>
          <div className="reunion-fila">
            <span className="venc-fecha">
              {new Date(proxima.inicio).toLocaleString('es-AR', {
                dateStyle: 'short',
                timeStyle: 'short',
              })}
            </span>
            <span className="pastilla">{proxima.duracion_min} min</span>
            <span className="pastilla" title="Zona en que se agendó (D23)">
              {proxima.zona || ZONA}
            </span>
            <a
              className="boton-secundario"
              href={linkCalendar(proxima.inicio, proxima.duracion_min)}
              target="_blank"
              rel="noreferrer"
            >
              ↗ Calendar
            </a>
          </div>
          {editable && (
            <div className="selector-idioma">
              {ESTADOS.map((e) => (
                <button
                  key={e}
                  type="button"
                  className={proxima.estado === e ? 'idioma-on' : 'idioma-off'}
                  onClick={() => void cambiarEstado(proxima, e)}
                  disabled={guardando}
                >
                  {NOMBRE_ESTADO[e]}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <span className="campo-ayuda">Sin reunión agendada.</span>
      )}

      {editable && (
        <div className="reunion-agendar">
          <label className="campo campo-chico">
            <span className="campo-label">Cuándo</span>
            <input
              type="datetime-local"
              value={cuando}
              onChange={(e) => setCuando(e.target.value)}
              step={PASO_DURACION * 60}
            />
          </label>
          <label className="campo campo-chico">
            <span className="campo-label">Duración</span>
            <select value={duracion} onChange={(e) => setDuracion(Number(e.target.value))}>
              {[15, 30, 45, 60, 90].map((m) => (
                <option key={m} value={m}>
                  {m} min
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="boton-principal"
            disabled={!cuando || guardando}
            onClick={() => void agendar()}
            title="Guarda la reunión y abre Google Calendar con el evento listo"
          >
            {guardando ? 'Agendando…' : 'Agendar'}
          </button>
        </div>
      )}

      {cuando && (
        <div className="reunion-vista">
          <span className="campo-label">Así va a quedar el evento</span>
          <div className="reunion-preview">
            <strong>{titulo}</strong>
            <pre>{descripcion}</pre>
          </div>
        </div>
      )}

      {pasadas.length > 0 && (
        <div className="campo">
          <span className="campo-label">Historial</span>
          {pasadas.map((r) => (
            <div key={r.id} className="reunion-fila">
              <span className="envio-fecha">
                {new Date(r.inicio).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
              </span>
              <span
                className={`pastilla ${
                  r.estado === 'asistio'
                    ? 'pastilla-ok'
                    : r.estado === 'no-asistio'
                      ? 'pastilla-error'
                      : ''
                }`}
              >
                {NOMBRE_ESTADO[r.estado] ?? r.estado}
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="nota-tecnica">
        El CRM guarda la reunión y te abre Google Calendar con el evento ya armado —
        título, link del perfil y el invitado. Escribirlo solo necesita el permiso de
        Calendar por usuario (§8.3), que llega con el worker.
      </p>

      {error && <div className="login-error">{error}</div>}
    </div>
  );
}
