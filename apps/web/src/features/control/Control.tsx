import { useMemo, useState } from 'react';
import { NOMBRE_LINEA, type LineaNegocio } from '@crm/core/permisos';
import type { UsuarioRecord } from '../../lib/types';
import { useControl, type ProyectoConDatos } from './useControl';
import { Proyectos } from './Proyectos';
import { Reuniones } from './Reuniones';
import { LeadsDelPartner } from './LeadsDelPartner';
import { PanelProyecto } from './PanelProyecto';

/**
 * El puente entre los dos vocabularios de la misma división.
 *
 * El alcance del usuario se guarda como `ia | inversiones` (`linea_control`) y
 * la casa del proyecto como `globalita | seng`. Se traducen acá y en
 * `useControl`, que son los únicos dos lugares donde se cruzan.
 */
const LINEA_DE_LA_CASA: Record<string, LineaNegocio> = {
  globalita: 'ia',
  seng: 'inversiones',
};

interface Props {
  usuario: UsuarioRecord;
}

/**
 * Sección Control (§7.11). Dos pestañas, Proyectos y Reuniones.
 *
 * **Toda la sección es de solo lectura para cualquier rol**, y el header lo
 * declara con la pastilla. Lo que se edita se edita en la ficha del lead o en
 * el proyecto; acá se mira. Es lo único que ve el Observador.
 */
export function Control({ usuario }: Props) {
  const { proyectos, reuniones, leads, lineas, cargando, error } = useControl(usuario);
  const [vista, setVista] = useState<'proyectos' | 'leads' | 'reuniones'>('proyectos');
  // Quien ve las dos lineas puede mirar una por vez. Quien ve una sola no elige
  // nada: el filtro ya se aplico al leer.
  const [linea, setLinea] = useState<LineaNegocio | null>(null);
  const [abierto, setAbierto] = useState<ProyectoConDatos | null>(null);

  const deLaLinea = useMemo(
    () => (linea ? proyectos.filter((p) => p.linea === linea) : proyectos),
    [proyectos, linea],
  );
  const leadsDeLaLinea = useMemo(
    () => (linea ? leads.filter((l) => LINEA_DE_LA_CASA[l.casa] === linea) : leads),
    [leads, linea],
  );
  const reunionesDeLaLinea = useMemo(
    () => (linea ? reuniones.filter((r) => r.linea === linea) : reuniones),
    [reuniones, linea],
  );

  // El panel muestra lo recién leído, no una copia congelada de cuando se abrió.
  const panel = abierto
    ? proyectos.find((p) => p.proyecto.id === abierto.proyecto.id) ?? abierto
    : null;

  return (
    <section className="control">
      <header className="ctrl-header">
        <span className="ctrl-titulo">Control de proyectos</span>
        <div className="ctrl-vistas">
          <button
            type="button"
            className={vista === 'proyectos' ? 'ctrl-vista-on' : 'ctrl-vista-off'}
            onClick={() => setVista('proyectos')}
          >
            Proyectos <span className="ctrl-vista-n tabular">{deLaLinea.length}</span>
          </button>
          <button
            type="button"
            className={vista === 'leads' ? 'ctrl-vista-on' : 'ctrl-vista-off'}
            onClick={() => setVista('leads')}
          >
            Leads <span className="ctrl-vista-n tabular">{leadsDeLaLinea.length}</span>
          </button>
          <button
            type="button"
            className={vista === 'reuniones' ? 'ctrl-vista-on' : 'ctrl-vista-off'}
            onClick={() => setVista('reuniones')}
          >
            Reuniones <span className="ctrl-vista-n tabular">{reunionesDeLaLinea.length}</span>
          </button>
        </div>
        {lineas.length > 1 ? (
          // Ve los dos negocios: puede mirar uno por vez.
          <div className="ctrl-lineas">
            <button
              type="button"
              className={linea === null ? 'ctrl-vista-on' : 'ctrl-vista-off'}
              onClick={() => setLinea(null)}
            >
              Los dos
            </button>
            {lineas.map((l) => (
              <button
                key={l}
                type="button"
                className={linea === l ? 'ctrl-vista-on' : 'ctrl-vista-off'}
                onClick={() => setLinea(l)}
              >
                {NOMBRE_LINEA[l]}
              </button>
            ))}
          </div>
        ) : (
          // Limitado a uno: no hay nada que elegir, pero tiene que quedar claro
          // cuál está viendo — si no, "3 proyectos" se lee como si fueran todos.
          lineas[0] && <span className="pastilla pastilla-suave">{NOMBRE_LINEA[lineas[0]]}</span>
        )}

        <span className="ctrl-solo-lectura">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          Solo lectura
        </span>
      </header>

      <div className="ctrl-cuerpo">
        {cargando && <p className="vacio">Cargando proyectos y reuniones…</p>}
        {error && (
          <div className="aviso-error">
            <strong>No se pudo leer la base.</strong>
            <p>{error}</p>
          </div>
        )}
        {!cargando && !error && vista === 'proyectos' && (
          <Proyectos
            proyectos={deLaLinea}
            onAbrir={setAbierto}
            seleccionado={panel?.proyecto.id ?? null}
          />
        )}
        {!cargando && !error && vista === 'leads' && <LeadsDelPartner leads={leadsDeLaLinea} />}
        {!cargando && !error && vista === 'reuniones' && (
          <Reuniones reuniones={reunionesDeLaLinea} />
        )}
      </div>

      {panel && <PanelProyecto p={panel} onCerrar={() => setAbierto(null)} />}
    </section>
  );
}
