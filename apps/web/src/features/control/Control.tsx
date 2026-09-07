import { useState } from 'react';
import type { UsuarioRecord } from '../../lib/types';
import { useControl, type ProyectoConDatos } from './useControl';
import { Proyectos } from './Proyectos';
import { Reuniones } from './Reuniones';
import { PanelProyecto } from './PanelProyecto';

interface Props {
  usuario: UsuarioRecord;
}

/**
 * Sección Control (anexo §4). Dos pestañas, Proyectos y Reuniones.
 *
 * **Toda la sección es de solo lectura para cualquier rol**, y el header lo
 * declara con la pastilla. Lo que se edita se edita en la ficha del lead o en
 * el proyecto; acá se mira. Es lo único que ve el Observador.
 */
export function Control({ usuario }: Props) {
  const { proyectos, reuniones, cargando, error } = useControl(usuario);
  const [vista, setVista] = useState<'proyectos' | 'reuniones'>('proyectos');
  const [abierto, setAbierto] = useState<ProyectoConDatos | null>(null);

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
            Proyectos <span className="ctrl-vista-n tabular">{proyectos.length}</span>
          </button>
          <button
            type="button"
            className={vista === 'reuniones' ? 'ctrl-vista-on' : 'ctrl-vista-off'}
            onClick={() => setVista('reuniones')}
          >
            Reuniones <span className="ctrl-vista-n tabular">{reuniones.length}</span>
          </button>
        </div>
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
            proyectos={proyectos}
            onAbrir={setAbierto}
            seleccionado={panel?.proyecto.id ?? null}
          />
        )}
        {!cargando && !error && vista === 'reuniones' && <Reuniones reuniones={reuniones} />}
      </div>

      {panel && <PanelProyecto p={panel} onCerrar={() => setAbierto(null)} />}
    </section>
  );
}
