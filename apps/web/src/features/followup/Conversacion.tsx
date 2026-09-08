import { useEffect, useMemo, useState } from 'react';
import { conDias, type Ack, type MensajeChat } from '@crm/core/chat';
import { diaLocal } from '@crm/core/fecha';
import { pb } from '../../lib/pocketbase';
import type { LeadRecord } from '../../lib/types';

/**
 * El hilo de la conversación del lead (§3.2, §7.2, decisión cerrada #2).
 *
 * Portado de `docs/prototipo/Conversaciones.dc.html`.
 *
 * Los mensajes salen de la colección `mensaje`, filtrados por canal. El manual
 * los define como dos arrays embebidos (`mensajes_li[]`, `mensajes_wa[]`); acá
 * son filas con un campo `canal`, que da lo mismo en pantalla y evita
 * reescribir el hilo entero cada vez que alguien toca una etiqueta.
 *
 * LO QUE TODAVÍA NO PASA: nadie los escribe. El worker que lee LinkedIn y
 * WhatsApp llega en la Etapa 5. Hasta entonces el hilo tiene lo que se sembró y
 * lo que se registra al mandar. Por eso el pie sigue ofreciendo el chat real:
 * es donde está la conversación completa.
 */
interface MensajeRecord {
  id: string;
  canal: 'linkedin' | 'whatsapp';
  quien: 'in' | 'out';
  texto: string;
  enviado_en: string;
  ack: Ack | '';
}

const MARCA: Record<Ack, string> = {
  enviado: '✓',
  entregado: '✓✓',
  leido: '✓✓',
};

interface Props {
  lead: LeadRecord;
  canal: 'linkedin' | 'whatsapp';
  onCerrar: () => void;
}

export function Conversacion({ lead, canal, onCerrar }: Props) {
  const [mensajes, setMensajes] = useState<MensajeRecord[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    pb.collection('mensaje')
      .getFullList<MensajeRecord>({ filter: `lead = "${lead.id}"`, sort: 'enviado_en' })
      .then((r) => {
        if (!vivo) return;
        setMensajes(r);
        setCargando(false);
      })
      .catch(() => {
        if (!vivo) return;
        setMensajes([]);
        setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, [lead.id]);

  const delCanal = useMemo(() => mensajes.filter((m) => m.canal === canal), [mensajes, canal]);

  const hilo = useMemo(
    () =>
      conDias(
        delCanal.map<MensajeChat>((m) => ({
          quien: m.quien,
          texto: m.texto,
          en: m.enviado_en,
          ack: m.ack || null,
        })),
        diaLocal(),
      ),
    [delCanal],
  );

  const tel = String(lead.expand?.perfil?.telefono ?? '').replace(/\D/g, '');
  const chat =
    canal === 'whatsapp'
      ? tel
        ? `https://wa.me/${tel}`
        : ''
      : lead.link_chat ||
        (lead.expand?.perfil?.slug ? `https://www.linkedin.com/in/${lead.expand.perfil.slug}` : '');

  return (
    <>
      <div className="conv-cabecera">
        <span className="colapsable-flecha">▾</span>
        <span className="colapsable-titulo">Conversación</span>
        <span className={`pastilla ${canal === 'whatsapp' ? 'pastilla-wa' : 'pastilla-li'}`}>
          {canal === 'whatsapp' ? 'WhatsApp' : 'LinkedIn'}
        </span>
        <span className="conv-fecha al-final tabular">
          {delCanal.length
            ? `${delCanal.length} ${delCanal.length === 1 ? 'mensaje' : 'mensajes'}`
            : 'sin mensajes'}
        </span>
        <button type="button" className="boton-icono-22" title="Cerrar" onClick={onCerrar}>
          ×
        </button>
      </div>

      {cargando ? (
        <div className="conv-vacio">
          <span>Leyendo el hilo…</span>
        </div>
      ) : hilo.length ? (
        <div className="conv-hilo">
          {hilo.map((it, i) =>
            it.tipo === 'dia' ? (
              <div key={`d${i}`} className="conv-dia">
                <span>{it.etiqueta}</span>
              </div>
            ) : (
              <div
                key={`m${i}`}
                className={[
                  'conv-burbuja',
                  it.quien === 'in' ? 'conv-in' : canal === 'whatsapp' ? 'conv-out-wa' : 'conv-out-li',
                ].join(' ')}
              >
                <span className="conv-texto">{it.texto}</span>
                <span className="conv-meta tabular">
                  {it.hora}
                  {/* El ack sólo si lo hay. LinkedIn no informa nada, y un
                      tilde gris ahí diría «no llegó», que es otra cosa. */}
                  {it.ack && (
                    <span
                      className={it.ack === 'leido' ? 'conv-ack conv-ack-leido' : 'conv-ack'}
                      title={it.ack}
                    >
                      {MARCA[it.ack]}
                    </span>
                  )}
                </span>
              </div>
            ),
          )}
        </div>
      ) : (
        <div className="conv-vacio">
          <span>
            {canal === 'whatsapp'
              ? tel
                ? 'Todavía no hay WhatsApp con este lead.'
                : 'Sin teléfono cargado: no hay WhatsApp posible.'
              : 'Sin conversación en LinkedIn todavía.'}
          </span>
        </div>
      )}

      {/* El hilo del CRM tiene lo registrado; el completo está en el chat real
          hasta que el worker lo traiga (Etapa 5).

          Sin ningún mensaje, el botón NO dice «abrir el chat»: no hay chat que
          abrir todavía, hay uno que empezar. Es la distinción del prototipo y
          cambia lo que uno espera al tocarlo. */}
      <div className="conv-pie">
        <span className="campo-ayuda">
          {cargando
            ? ''
            : 'El hilo se completa cuando el worker lea los chats. Lo de acá es lo registrado.'}
        </span>
        {chat && (
          <a className="boton-mini al-final" href={chat} target="_blank" rel="noreferrer">
            {delCanal.length ? 'Abrir el chat' : 'Escribir el primer mensaje'}
          </a>
        )}
      </div>
    </>
  );
}
