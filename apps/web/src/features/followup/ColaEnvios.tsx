import { useEffect, useMemo, useState } from 'react';
import { vistaDeCola, type ItemCola, type TipoCola } from '@crm/core/cola';
import { pb } from '../../lib/pocketbase';

interface ColaRecord {
  id: string;
  tipo: TipoCola;
  cuando: string;
  estado: ItemCola['estado'];
  enviado_en?: string;
  paso?: string;
  canal?: string;
  lead: string;
  expand?: {
    cuenta?: { abrev?: string };
    lead?: { expand?: { perfil?: { nombre?: string } } };
  };
}

/** El icono dice QUÉ es sin leer: no todo lo de la cola es un mensaje. */
function Icono({ tipo }: { tipo: TipoCola }) {
  if (tipo === 'recordatorio') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M6 16V11a6 6 0 1112 0v5l2 3H4z" />
        <path d="M10 22h4" />
      </svg>
    );
  }
  if (tipo === 'gracias') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M12 20l-7-7a4.5 4.5 0 016.4-6.4L12 7l.6-.4A4.5 4.5 0 0119 13z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M4 12l16-8-6 16-2-6-8-2z" />
    </svg>
  );
}

const NOMBRE_TIPO: Record<TipoCola, string> = {
  mensaje: 'Mensaje de la cadencia',
  recordatorio: 'Recordatorio de reunión',
  gracias: 'Agradecimiento post reunión',
};

interface Props {
  onIrAlLead: (id: string) => void;
}

/**
 * Cola de envíos (§7.2 «al pie: cola de envíos, con cuenta regresiva»).
 * Portada de `docs/prototipo/ColaEnvios.dc.html`.
 *
 * Se abre HACIA ARRIBA (`bottom: 100%`) porque vive pegada al borde de abajo de
 * la columna: un panel que se abriera hacia abajo se saldría de la pantalla.
 *
 * El tick de un segundo es de la pantalla, no de los datos: recalcula el reloj
 * contra la misma lista, sin volver a pedir nada. La cola se relee cada 30 s.
 */
export function ColaEnvios({ onIrAlLead }: Props) {
  const [filas, setFilas] = useState<ColaRecord[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    let vivo = true;
    const traer = async () => {
      try {
        const r = await pb.collection('cola').getFullList<ColaRecord>({
          expand: 'cuenta,lead.perfil',
          sort: 'cuando',
        });
        if (vivo) setFilas(r);
      } catch {
        // La cola es informativa: si no se puede leer, la barra queda vacía y
        // el resto de Follow-up sigue funcionando. No es un error que valga
        // interrumpir el trabajo.
        if (vivo) setFilas([]);
      }
    };
    void traer();
    const t = setInterval(() => void traer(), 30_000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const items: ItemCola[] = useMemo(
    () =>
      filas.map((f) => ({
        id: f.id,
        tipo: f.tipo,
        cuenta: f.expand?.cuenta?.abrev ?? '',
        quien: f.expand?.lead?.expand?.perfil?.nombre ?? 'sin nombre',
        detalle: [f.paso, f.canal].filter(Boolean).join(' · '),
        cuando: f.cuando,
        estado: f.estado,
        enviado_en: f.enviado_en,
      })),
    [filas],
  );

  const vista = useMemo(() => vistaDeCola(items, ahora), [items, ahora]);
  const porId = useMemo(() => new Map(filas.map((f) => [f.id, f.lead])), [filas]);
  const ir = (id: string) => {
    const lead = porId.get(id);
    if (lead) onIrAlLead(lead);
  };

  return (
    <div className="cola">
      <button type="button" className="cola-barra" onClick={() => setAbierto((a) => !a)}>
        <span className="cola-caret">{abierto ? '▾' : '▸'}</span>
        <span className="cola-rotulo">En cola</span>
        <span className="cola-n tabular">{vista.n}</span>
        {vista.enCamino ? (
          <span className="cola-vivo tabular">
            <span className="cola-punto" />
            {vista.resumen}
          </span>
        ) : (
          <span className="cola-proximo tabular">{vista.resumen}</span>
        )}
      </button>

      {abierto && (
        <div className="cola-panel">
          {vista.enCamino && (
            <div className="cola-lote">
              <div className="cola-lote-header">
                <span className="cola-punto" />
                <span className="cola-lote-cuenta">{vista.enCamino.cuenta}</span>
                <span className="cola-lote-rotulo">en envío</span>
                <span className="cola-lote-meta tabular">{vista.enCamino.meta}</span>
              </div>
              <div className="cola-lote-item" onClick={() => ir(vista.enCamino!.id)}>
                <div className="cola-lote-fila">
                  <span className="cola-quien">{vista.enCamino.quien}</span>
                  <span className="cola-lote-countdown tabular">{vista.enCamino.countdown}</span>
                </div>
                <div className="cola-lote-fila">
                  <span className="cola-lote-detalle">{vista.enCamino.detalle}</span>
                  <span className="cola-lote-detalle tabular">{vista.enCamino.espera}</span>
                </div>
                {/* La barra no es decoración: dice cuánto falta sin tener que
                    leer el número, que es lo que se mira de reojo. */}
                <div className="cola-avance">
                  <div className="cola-avance-relleno" style={{ width: `${vista.enCamino.avance}%` }} />
                </div>
              </div>
            </div>
          )}

          {vista.programados.length > 0 && <div className="cola-titulo">Programados</div>}
          {vista.programados.map((p) => (
            <div key={p.id} className="cola-fila" onClick={() => ir(p.id)}>
              <span className="cola-icono" title={NOMBRE_TIPO[p.tipo]}>
                <Icono tipo={p.tipo} />
              </span>
              <span className="cola-cuenta">{p.cuenta}</span>
              <div className="cola-fila-medio">
                <span className="cola-quien">{p.quien}</span>
                <span className="cola-detalle">{p.detalle}</span>
              </div>
              <div className="cola-fila-derecha">
                <span
                  className={`cola-countdown tabular ${p.countdown === 'demorado' ? 'cola-demorado' : ''}`}
                >
                  {p.countdown}
                </span>
                <span className="cola-cuando tabular">{p.cuandoLabel}</span>
              </div>
            </div>
          ))}

          {vista.enviados.length > 0 && <div className="cola-titulo">Enviados</div>}
          {vista.enviados.map((e) => (
            <div key={e.id} className="cola-fila" onClick={() => ir(e.id)}>
              <span className="cola-icono cola-icono-plano">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </span>
              <div className="cola-fila-medio">
                <span className="cola-quien cola-quien-ido">{e.quien}</span>
                <span className="cola-detalle">{e.detalle}</span>
              </div>
              <span className="cola-cuando tabular">{e.cuandoLabel}</span>
            </div>
          ))}

          {vista.vacio && <div className="cola-vacio">nada en cola</div>}
        </div>
      )}
    </div>
  );
}
