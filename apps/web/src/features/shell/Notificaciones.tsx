import { useEffect, useState } from 'react';
import { TEXTO_ESTADO, estadoDeConversacion, type EstadoConversacion } from '@crm/core/chat';
import { nombreDePersona } from '@crm/core/linkedin';
import { pb } from '../../lib/pocketbase';
import type { LeadRecord } from '../../lib/types';

/**
 * Las notificaciones (§7.1, §7.10).
 *
 * *«Total sin leer entre Follow-up y WA Personal; al abrirlo lista cada uno con
 * su canal (LI/WA) y salta a la ficha o a la pestaña.»*
 *
 * Había campana con badge, y el clic llevaba a la subtab «Sin leer» — que es
 * una lista de leads, no de mensajes. La diferencia importa: con veinte sin
 * leer, la subtab dice cuáles son pero no por dónde entró cada uno, y entrar a
 * responder por LinkedIn algo que llegó por WhatsApp es un viaje al pedo.
 *
 * Tocar una fila hace tres cosas: la marca leída, abre esa conversación en la
 * columna 1 y deja la fila con su estado nuevo. **No la saca de la lista**: si
 * desapareciera al tocarla, uno pierde el lugar y no puede volver a la que
 * acaba de mirar. Se van cuando se cierra el popover.
 */
interface Fila {
  id: string;
  nombre: string;
  cuenta: string;
  canal: 'linkedin' | 'whatsapp';
  estado: EstadoConversacion;
}

interface Props {
  leads: LeadRecord[];
  /** Los entrantes de WA Personal que todavía no se pasaron a Follow-up. */
  waPersonal: number;
  onIrAlLead: (id: string, canal: 'linkedin' | 'whatsapp') => void;
  onIrAWaPersonal: () => void;
  onCerrar: () => void;
  /** Para que el badge del header y la lista bajen cuando se marca leída. */
  onCambio?: () => void;
}

interface MensajeMinimo {
  quien: 'in' | 'out';
  enviado_en: string;
}

export function Notificaciones({
  leads,
  waPersonal,
  onIrAlLead,
  onIrAWaPersonal,
  onCerrar,
  onCambio,
}: Props) {
  /**
   * Lo que se marcó leído sin cerrar el popover.
   *
   * Vive acá y no en el lead porque la lista de arriba se recarga y la fila
   * desaparecería a mitad de camino. Al cerrar se pierde, que es lo correcto:
   * la próxima vez el dato sale de la base.
   */
  const [leidas, setLeidas] = useState<Record<string, boolean>>({});
  /** El último mensaje de cada hilo, para saber si falta contestar. */
  const [hilos, setHilos] = useState<Record<string, MensajeMinimo[]>>({});
  /**
   * Los leads con los que se abrió el popover, congelados.
   *
   * Quien lo monta le pasa `leads.filter(sin_leer)`, así que al marcar una
   * leída el lead sale del filtro y la fila se evaporaba antes de poder verla
   * en su estado nuevo. Congelarla acá es lo que hace que se apague en vez de
   * desaparecer. Al cerrar y volver a abrir, la lista sale de la base otra vez.
   */
  const [iniciales] = useState(leads);

  // Sólo los mensajes de los leads que se están mostrando, y sólo `quien` y la
  // fecha: alcanza para el estado y no baja el texto de conversaciones que
  // nadie va a leer desde acá.
  useEffect(() => {
    if (!iniciales.length) return;
    let vivo = true;
    const filtro = iniciales.map((l) => `lead="${l.id}"`).join(' || ');
    pb.collection('mensaje')
      .getFullList<{ lead: string; canal: string; quien: 'in' | 'out'; enviado_en: string }>({
        filter: filtro,
        fields: 'lead,canal,quien,enviado_en',
      })
      .then((ms) => {
        if (!vivo) return;
        const m: Record<string, MensajeMinimo[]> = {};
        for (const x of ms) {
          const k = `${x.lead}-${x.canal}`;
          (m[k] ??= []).push({ quien: x.quien, enviado_en: x.enviado_en });
        }
        setHilos(m);
      })
      .catch(() => setHilos({}));
    return () => {
      vivo = false;
    };
  }, [iniciales]);

  // Un lead con los dos canales sin leer aparece DOS veces, una por canal: son
  // dos conversaciones distintas y se contestan en lugares distintos.
  const filas: Fila[] = iniciales.flatMap((l) => {
    const p = l.expand?.perfil;
    const base = {
      id: l.id,
      nombre: nombreDePersona(p?.nombre ?? '') || 'sin nombre',
      cuenta: l.expand?.cuenta?.abrev ?? '',
    };
    const armar = (canal: 'linkedin' | 'whatsapp', sinLeerEnLaBase: boolean): Fila[] => {
      if (!sinLeerEnLaBase) return [];
      const clave = `${l.id}-${canal}`;
      const sinLeer = !leidas[clave];
      const ms = (hilos[clave] ?? []).map((m) => ({ quien: m.quien, en: m.enviado_en }));
      return [{ ...base, canal, estado: estadoDeConversacion(sinLeer, ms) }];
    };
    return [...armar('linkedin', l.sin_leer_li), ...armar('whatsapp', l.sin_leer_wa)];
  });

  const pendientes = filas.filter((f) => f.estado === 'sin_leer').length;

  async function abrir(f: Fila) {
    const clave = `${f.id}-${f.canal}`;
    setLeidas((v) => ({ ...v, [clave]: true }));
    onIrAlLead(f.id, f.canal);
    // Marcar leído es del lead, no de la vista: si sólo se apagara acá, el
    // badge del header seguiría contando y al recargar volvería a aparecer.
    try {
      await pb
        .collection('lead')
        .update(f.id, f.canal === 'whatsapp' ? { sin_leer_wa: false } : { sin_leer_li: false });
      onCambio?.();
    } catch {
      // Si el guardado falla, la fila vuelve a quedar sin leer: mejor que
      // decir que se leyó algo que el servidor no registró.
      setLeidas((v) => ({ ...v, [clave]: false }));
    }
  }

  return (
    <>
      <div className="popover-fondo" onClick={onCerrar} />
      <div className="popover popover-anclado notif">
        <div className="notif-cabeza">
          <span className="campo-label">Sin leer</span>
          <span className="campo-ayuda al-final tabular">
            {pendientes + waPersonal} en total
          </span>
        </div>

        <div className="notif-lista">
          {filas.map((f) => (
            <button
              key={`${f.id}-${f.canal}`}
              type="button"
              className={`notif-fila ${f.estado === 'sin_leer' ? '' : 'notif-fila-leida'}`}
              onClick={() => void abrir(f)}
            >
              <span className={`pastilla ${f.canal === 'whatsapp' ? 'pastilla-wa' : 'pastilla-li'}`}>
                {f.canal === 'whatsapp' ? 'WA' : 'LI'}
              </span>
              <span className="notif-nombre">{f.nombre}</span>

              {/* El estado sólo cuando ya se leyó: en las sin leer sería
                  repetir lo que dice el resto de la fila. */}
              {f.estado !== 'sin_leer' && (
                <span
                  className={`notif-estado ${f.estado === 'sin_responder' ? 'notif-estado-falta' : ''}`}
                >
                  {TEXTO_ESTADO[f.estado]}
                </span>
              )}
              <span className="campo-ayuda al-final">{f.cuenta}</span>
            </button>
          ))}

          {/* WA Personal no son leads todavía: son entrantes de un número que
              nadie sumó al CRM. Por eso llevan a la pestaña y no a una ficha
              que no existe. */}
          {waPersonal > 0 && (
            <button
              type="button"
              className="notif-fila"
              onClick={() => {
                onIrAWaPersonal();
                onCerrar();
              }}
            >
              <span className="pastilla pastilla-wa">WA</span>
              <span className="notif-nombre">
                {waPersonal} {waPersonal === 1 ? 'entrante' : 'entrantes'} en WA Personal
              </span>
              <span className="campo-ayuda al-final">sin sumar</span>
            </button>
          )}

          {!filas.length && !waPersonal && (
            <div className="notif-vacio">Nada sin leer.</div>
          )}
        </div>
      </div>
    </>
  );
}
