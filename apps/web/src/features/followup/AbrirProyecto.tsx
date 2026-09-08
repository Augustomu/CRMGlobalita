import { useEffect, useState } from 'react';
import { NOMBRE_TIPO, proyectoDesdeLead, type TipoProyecto } from '@crm/core/proyecto';
import { diaLocal } from '@crm/core/fecha';
import { pb } from '../../lib/pocketbase';
import { ProyectosDelLead } from './ProyectosDelLead';
import type { LeadRecord } from '../../lib/types';

const HOY = diaLocal();

/** Los dos que se abren desde la ficha (§6). Los otros tipos se cargan a mano. */
const DESDE_LA_FICHA: TipoProyecto[] = ['fabript_piv', 'parceria'];

interface Props {
  lead: LeadRecord;
  puedeEditar: boolean;
}

/**
 * "Control de proyectos" en las acciones rápidas de la ficha (§6).
 *
 * Es manual y explícito a propósito: un lead que acepta y responde todavía no
 * es un proyecto. Si se creara solo al agendar una reunión, Control se llenaría
 * de proyectos vacíos y el conteo de Activos dejaría de significar algo.
 */
export function AbrirProyecto({ lead, puedeEditar }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [existentes, setExistentes] = useState<{ id: string; tipo: string; nombre: string }[]>([]);
  const [trabajando, setTrabajando] = useState<TipoProyecto | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    try {
      const r = await pb.collection('proyecto').getFullList({
        filter: `lead = "${lead.id}"`,
        fields: 'id,tipo,nombre',
      });
      setExistentes(r as unknown as typeof existentes);
    } catch {
      setExistentes([]);
    }
  }

  useEffect(() => {
    setExistentes([]);
    setError(null);
    if (abierto) void cargar();
  }, [lead.id, abierto]);

  async function abrir(tipo: TipoProyecto) {
    if (trabajando) return;
    setTrabajando(tipo);
    setError(null);
    try {
      const perfil = lead.expand?.perfil;
      const datos = proyectoDesdeLead(
        {
          id: lead.id,
          contacto: perfil?.nombre ?? '',
          empresa: perfil?.empresa ?? '',
          pais: perfil?.pais ?? '',
          ciudad: perfil?.ciudad ?? '',
          industria: perfil?.industria ?? '',
          rol_contacto: perfil?.cargo ?? '',
          cuenta: lead.cuenta,
          responsable: lead.asignado,
          // La nota es un editor: se guarda el texto plano para poder leerla en
          // Control sin arrastrar el HTML de la ficha.
          nota: (lead.nota ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
        },
        tipo,
        HOY,
      );

      // §6: abrir dos veces el mismo tipo sobre el mismo lead no duplica.
      const ya = existentes.find((p) => p.tipo === tipo);
      if (ya) await pb.collection('proyecto').update(ya.id, datos);
      else await pb.collection('proyecto').create(datos);

      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setTrabajando(null);
    }
  }

  return (
    <div className="relativo">
      <button
        type="button"
        className="boton-chico"
        title="Control de proyectos"
        onClick={() => setAbierto((a) => !a)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="M3 6h18M3 12h12M3 18h7" />
        </svg>
      </button>

      {abierto && (
        <>
          <div className="popover-fondo" onClick={() => setAbierto(false)} />
          <div className="popover popover-anclado">
            <span className="campo-label">Control de proyectos</span>

            {existentes.length > 0 && (
              <div className="chips">
                {existentes.map((p) => (
                  <span key={p.id} className="chip chip-sistema" title={p.nombre}>
                    ya tiene: {NOMBRE_TIPO[p.tipo as TipoProyecto] ?? p.tipo}
                  </span>
                ))}
              </div>
            )}

            {DESDE_LA_FICHA.map((t) => (
              <button
                key={t}
                type="button"
                className="boton-mini"
                disabled={!puedeEditar || trabajando !== null}
                onClick={() => void abrir(t)}
              >
                {trabajando === t
                  ? 'Abriendo…'
                  : t === 'parceria'
                    ? 'Abrir proyecto de parcería'
                    : 'Abrir proyecto Fabript/PIV'}
              </button>
            ))}

            {!puedeEditar && (
              <span className="campo-ayuda">
                No podés abrir proyectos sobre este lead: no está asignado a vos en modo
                seguimiento.
              </span>
            )}
            {error && <div className="login-error">{error}</div>}
            <span className="campo-ayuda">
              Queda visible en Control al instante, en estado En conversación.
            </span>

            {/* Los proyectos se EDITAN acá, no en la columna. El prototipo no
                tiene una sección «Proyectos» en la ficha —dejó solo «Abrir
                proyecto» en las acciones— pero Control es de solo lectura, así
                que sin este panel un proyecto no se podría actualizar desde
                ningún lado. */}
            {existentes.length > 0 && (
              <ProyectosDelLead lead={lead} editable={puedeEditar} onCambio={() => void cargar()} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
