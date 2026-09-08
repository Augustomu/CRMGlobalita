import { useEffect } from 'react';
import { enSuZona } from '@crm/core/reunion';
import {
  NOMBRE_ESTADO,
  NOMBRE_TIPO,
  estadoEfectivo,
  ultimaReunion,
  type EstadoProyecto,
  type Registro,
  type TipoProyecto,
} from '@crm/core/proyecto';
import { diaLocal } from '@crm/core/fecha';
import type { ProyectoConDatos } from './useControl';

const HOY = diaLocal();

function fechaCorta(iso: string): string {
  const f = String(iso).slice(0, 10);
  if (!f) return '';
  const [a, m, d] = f.split('-');
  return `${d}/${m}/${a.slice(2)}`;
}

const nuevoPrimero = (a: Registro, b: Registro) =>
  String(b.fecha).slice(0, 10).localeCompare(String(a.fecha).slice(0, 10));
const porFecha = (a: Registro, b: Registro) =>
  String(a.fecha).slice(0, 10).localeCompare(String(b.fecha).slice(0, 10));

interface Props {
  p: ProyectoConDatos;
  onCerrar: () => void;
}

/**
 * El panel del proyecto (anexo §4.1 y diseño §2). Se abre desde cualquier fila,
 * anclado a la derecha, 720 px.
 *
 * Es de lectura: notas, actualizaciones y próximas acciones en tres columnas,
 * las reuniones numeradas, y al final la nota "Acerca de" de la ficha del lead
 * textual — que es el vínculo entre el proyecto y la prospección.
 */
export function PanelProyecto({ p, onCerrar }: Props) {
  const { proyecto, reuniones, cuenta_abrev, responsable } = p;
  const efectivo = estadoEfectivo(proyecto, reuniones, HOY);
  const ult = ultimaReunion(reuniones, HOY);

  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    document.addEventListener('keydown', f);
    return () => document.removeEventListener('keydown', f);
  }, [onCerrar]);

  const datos: [string, string][] = [
    ['Contacto', proyecto.contacto || '—'],
    ['Rol', proyecto.rol_contacto || '—'],
    ['Empresa', proyecto.empresa || '—'],
    ['Industria', proyecto.industria || '—'],
    ['País y ciudad', [proyecto.pais, proyecto.ciudad].filter(Boolean).join(' · ') || '—'],
    ['Cuenta', cuenta_abrev || '—'],
    ['Responsable', responsable || 'sin asignar'],
    ['Abierto', fechaCorta(proyecto.abierto) || '—'],
    [
      'Reuniones',
      ult.total === 0
        ? 'sin reuniones'
        : `${ult.total} · última ${ult.fecha === '—' ? ult.detalle : fechaCorta(ult.fecha)}`,
    ],
    ['Ficha del lead', proyecto.lead ? 'sí, en el CRM' : 'no vino de la prospección'],
  ];

  const columnas = [
    { label: 'Notas', punto: 'var(--info)', items: [...(proyecto.notas ?? [])].sort(nuevoPrimero) },
    {
      label: 'Actualización del proyecto',
      punto: 'var(--accent)',
      items: [...(proyecto.updates ?? [])].sort(nuevoPrimero),
    },
    {
      label: 'Próximas acciones',
      punto: 'var(--warning)',
      items: [...(proyecto.acciones ?? [])].sort(porFecha),
    },
  ];

  const ordenadas = [...reuniones].sort((a, b) => a.inicio.localeCompare(b.inicio));

  return (
    <div className="panel-fondo" onClick={onCerrar}>
      <div className="panel-caja" onClick={(e) => e.stopPropagation()}>
        <header className="panel-header">
          <div className="panel-titulo">
            <span className="panel-nombre">{proyecto.nombre}</span>
            <span className="panel-sub">
              {[proyecto.empresa, proyecto.contacto].filter(Boolean).join(' · ')}
            </span>
            <div className="panel-pastillas">
              <span className={`ctrl-pastilla ctrl-tipo-${proyecto.tipo}`}>
                {NOMBRE_TIPO[proyecto.tipo as TipoProyecto] ?? '—'}
              </span>
              <span className={`ctrl-pastilla ctrl-estado-${efectivo}`}>
                {NOMBRE_ESTADO[efectivo as EstadoProyecto]}
              </span>
            </div>
          </div>
          <button type="button" className="boton-icono-26" onClick={onCerrar} title="Cerrar (Esc)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="panel-cuerpo">
          <div className="panel-datos">
            {datos.map(([k, v]) => (
              <div key={k} className="panel-dato">
                <span className="panel-dato-k">{k}</span>
                <span className="panel-dato-v">{v}</span>
              </div>
            ))}
          </div>

          <div className="panel-columnas">
            {columnas.map((c) => (
              <div key={c.label} className="panel-columna">
                <div className="panel-columna-cabecera">
                  <span className="panel-punto" style={{ background: c.punto }} />
                  <span className="ctrl-filtro-label">{c.label}</span>
                  <span className="panel-columna-n tabular">{c.items.length}</span>
                </div>
                {c.items.length === 0 && <span className="campo-ayuda">Sin registros.</span>}
                {c.items.map((i, n) => (
                  <div key={n} className="panel-item">
                    <span className="panel-item-fecha tabular">{fechaCorta(i.fecha)}</span>
                    <span className="panel-item-texto">{i.texto}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="panel-seccion">
            <span className="ctrl-filtro-label">Reuniones de este proyecto</span>
            {ordenadas.length === 0 && (
              <span className="campo-ayuda">Todavía no hubo reuniones.</span>
            )}
            {ordenadas.map((r, i) => (
              <div key={r.id} className="panel-reunion">
                <span className="panel-reunion-i tabular">{i + 1}</span>
                <span className="panel-reunion-fecha tabular">
                  {/* D23: la hora que vale es la de la zona, no la UTC de la base. */}
                  {fechaCorta(enSuZona(r.inicio, r.zona))} {enSuZona(r.inicio, r.zona).slice(11, 16)}
                </span>
                <span className={`ctrl-pastilla ctrl-reunion-${r.estado}`}>{r.estado}</span>
              </div>
            ))}
          </div>

          {proyecto.nota_lead && (
            <div className="panel-nota">
              <span className="panel-dato-k">Nota de la ficha del lead</span>
              <span className="panel-item-texto">{proyecto.nota_lead}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
