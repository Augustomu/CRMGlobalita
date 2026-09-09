import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ESTRELLAS,
  FILTROS,
  PRIORIDAD_POR_DEFECTO,
  alternarOrden,
  estaVencida,
  venceHoy,
  visibles,
  type ClaveOrden,
  type FiltroTarea,
  type Tarea,
} from '@crm/core/tarea';
import { ddmm } from '@crm/core/fecha';
import { nombreDePersona } from '@crm/core/linkedin';
import { linkWhatsApp } from '@crm/core/telefono';
import { pb } from '../../lib/pocketbase';
import { useEscape } from '../../lib/useEscape';
import { IconoLinkedIn, IconoNotas, IconoWhatsApp } from '../../ui/iconos';
import { Vencimientos, leadsVencidos } from '../vencimientos/Vencimientos';
import type { LeadRecord, PlantillaRecord, UsuarioRecord } from '../../lib/types';

interface PerfilDeTarea {
  nombre?: string;
  empresa?: string;
  cargo?: string;
  slug?: string;
  telefono?: string;
  telefono_valido?: boolean;
  telefono_raw?: string;
}

interface TareaRecord extends Tarea {
  etiquetas: string;
  usuario: string;
  lead: string;
  expand?: { lead?: { id?: string; expand?: { perfil?: PerfilDeTarea } } };
}

const ORDENES: { clave: ClaveOrden; titulo: string }[] = [
  { clave: 'vencimiento', titulo: 'Ordenar por fecha de vencimiento' },
  { clave: 'prioridad', titulo: 'Ordenar por estrellas' },
  { clave: 'inicio', titulo: 'Ordenar por fecha de inicio' },
];

function hoyIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}


/** Las cinco estrellas de prioridad. */
function Estrellas({ valor, onElegir }: { valor: number; onElegir?: (v: number) => void }) {
  return (
    <div className="tarea-estrellas">
      {ESTRELLAS.map((v) => (
        <button
          key={v}
          type="button"
          className={`tarea-estrella ${(valor || 0) >= v ? 'tarea-estrella-on' : ''}`}
          title={`Prioridad ${v} de 5`}
          disabled={!onElegir}
          onClick={() => onElegir?.(v)}
        >
          ★
        </button>
      ))}
    </div>
  );
}

/**
 * El lead de la tarea, con lo que hace falta para trabajarla.
 *
 * «Una tarea conectada a un lead tiene que traer sus datos»: el nombre, cómo
 * escribirle y cómo llegar a la ficha. Antes decía sólo «Sobre Fulano», que
 * obliga a ir a buscarlo a la lista para hacer cualquier cosa.
 */
function LeadDeLaTarea({
  perfil,
  lead,
  onIrAlLead,
}: {
  perfil: PerfilDeTarea;
  lead: string;
  onIrAlLead?: (id: string) => void;
}) {
  const wa = perfil.telefono
    ? linkWhatsApp({ valor: perfil.telefono, valido: perfil.telefono_valido === true })
    : undefined;
  return (
    <div className="tarea-lead">
      <span className="tarea-lead-quien">
        <button
          type="button"
          className="tarea-lead-nombre"
          title="Abrir la ficha del lead"
          onClick={() => onIrAlLead?.(lead)}
          disabled={!onIrAlLead}
        >
          {nombreDePersona(perfil.nombre ?? '') || 'Sin nombre'}
        </button>
        {(perfil.empresa || perfil.cargo) && (
          <span className="campo-ayuda">{[perfil.empresa, perfil.cargo].filter(Boolean).join(' · ')}</span>
        )}
      </span>

      {/* §9.7: lo que no se puede usar se muestra deshabilitado con el motivo,
          no se esconde. Si no está, uno se pregunta si el lead lo tiene. */}
      {perfil.slug ? (
        <a
          className="boton-icono-22 boton-li-on"
          href={`https://www.linkedin.com/in/${perfil.slug}`}
          target="_blank"
          rel="noreferrer"
          title="Abrir el perfil de LinkedIn"
        >
          <IconoLinkedIn />
        </a>
      ) : (
        <span className="boton-icono-22 boton-off" title="Sin perfil de LinkedIn cargado">
          <IconoLinkedIn />
        </span>
      )}

      {wa ? (
        <a
          className="boton-icono-22 boton-wa-on"
          href={wa}
          target="_blank"
          rel="noreferrer"
          title="Abrir el chat de WhatsApp"
        >
          <IconoWhatsApp />
        </a>
      ) : (
        <span
          className="boton-icono-22 boton-off"
          title={perfil.telefono ? `Teléfono a revisar: ${perfil.telefono_raw || perfil.telefono}` : 'Sin teléfono cargado'}
        >
          <IconoWhatsApp />
        </span>
      )}
    </div>
  );
}

interface Props {
  usuario: UsuarioRecord | null;
  onCerrar: () => void;
  /** Para saltar a la ficha desde una tarea. Falta cuando Tareas se abre sin follow-up. */
  onIrAlLead?: (id: string) => void;
  /**
   * Los vencimientos, para el panel de la derecha.
   *
   * Van juntos porque son la misma cola del día: lo que hay que hacer y a
   * quién hay que escribirle. En dos overlays separados hay que cerrar uno
   * para ver el otro, y en la práctica se termina mirando sólo uno.
   *
   * Si falta el permiso `vencimientos`, no llegan y el panel no existe.
   */
  leads?: LeadRecord[];
  plantillas?: PlantillaRecord[];
  onCambio?: () => void;
}

/**
 * Tareas (§3.7 y §7.10). Portada de `docs/prototipo/Tareas.dc.html`.
 *
 * La fila es una GRILLA: check, nombre, fechas, vencimiento, etiquetas y
 * prioridad quedan en columnas rectas. Con la fila libre las fechas bailaban
 * según el largo del nombre y no se podían comparar de un vistazo, que es para
 * lo único que sirve una lista de pendientes.
 */
export function Tareas({ usuario, onCerrar, onIrAlLead, leads, plantillas, onCambio }: Props) {
  useEscape(onCerrar);
  const [tareas, setTareas] = useState<TareaRecord[]>([]);
  const [filtro, setFiltro] = useState<FiltroTarea>('Abiertas');
  const [orden, setOrden] = useState<ClaveOrden[]>(['vencimiento']);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [nuevaAbierta, setNuevaAbierta] = useState(false);
  const [nombre, setNombre] = useState('');
  const [prioridad, setPrioridad] = useState(PRIORIDAD_POR_DEFECTO);
  const [fin, setFin] = useState('');
  const [notas, setNotas] = useState('');
  const [notifica, setNotifica] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Abierto por defecto cuando hay algo que hacer: si no, no se entera. */
  const [panelVenc, setPanelVenc] = useState(true);

  const hoy = hoyIso();
  const vencidos = useMemo(() => (leads ? leadsVencidos(leads) : []), [leads]);
  const hayVenc = Boolean(leads && plantillas);

  const recargar = useCallback(async () => {
    try {
      const r = await pb.collection('tarea').getFullList<TareaRecord>({
        // El perfil entero, no sólo el nombre: una tarea sobre un lead tiene
        // que traer con qué escribirle. Ir a buscar el teléfono a la ficha
        // convierte «llamar a Wellington» en tres pantallas.
        expand: 'lead.perfil',
        fields: '*,expand.lead.id,expand.lead.expand.perfil.nombre,expand.lead.expand.perfil.empresa,expand.lead.expand.perfil.cargo,expand.lead.expand.perfil.slug,expand.lead.expand.perfil.telefono,expand.lead.expand.perfil.telefono_valido,expand.lead.expand.perfil.telefono_raw',
        sort: '-created',
      });
      setTareas(r);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const lista = useMemo(
    () => visibles(tareas, filtro, orden, hoy) as TareaRecord[],
    [tareas, filtro, orden, hoy],
  );

  const abiertas = tareas.filter((t) => !t.hecha);
  const nVencidas = abiertas.filter((t) => estaVencida(t, hoy)).length;
  const nHoy = abiertas.filter((t) => venceHoy(t, hoy)).length;

  async function guardar(id: string, patch: Partial<TareaRecord>) {
    // Optimista: marcar hecha una tarea tiene que sentirse instantáneo, y si
    // el guardado falla la recarga la devuelve a su estado real.
    setTareas((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    try {
      await pb.collection('tarea').update(id, patch);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      await recargar();
    }
  }

  async function crear() {
    if (!nombre.trim()) return;
    try {
      await pb.collection('tarea').create({
        nombre: nombre.trim(),
        prioridad,
        fin: fin || null,
        notas,
        notificar: notifica,
        hecha: false,
        usuario: usuario?.id ?? '',
      });
      setNombre('');
      setPrioridad(PRIORIDAD_POR_DEFECTO);
      setFin('');
      setNotas('');
      setNuevaAbierta(false);
      await recargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function borrar(id: string) {
    setTareas((ts) => ts.filter((t) => t.id !== id));
    await pb.collection('tarea').delete(id).catch(() => recargar());
  }

  return (
    <div className="overlay-fondo" onClick={onCerrar}>
      <div
        className={`overlay-caja overlay-tareas ${hayVenc && panelVenc ? 'overlay-tareas-con-panel' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="overlay-header">
          <span className="overlay-titulo">Tareas</span>
          {nVencidas > 0 && <span className="pastilla pastilla-error">{nVencidas} vencidas</span>}
          {nHoy > 0 && <span className="pastilla pastilla-alerta">{nHoy} hoy</span>}
          <span className="campo-ayuda">{abiertas.length} abiertas</span>
          {hayVenc && (
            <button
              type="button"
              className={`chip al-final ${panelVenc ? 'chip-on' : ''}`}
              title={panelVenc ? 'Ocultar los vencimientos' : 'Mostrar los vencimientos'}
              onClick={() => setPanelVenc((v) => !v)}
            >
              {vencidos.length} vencen
            </button>
          )}
          <button
            type="button"
            className={`boton-icono-28 ${hayVenc ? '' : 'al-final'}`}
            title="Agregar tarea"
            onClick={() => setNuevaAbierta((a) => !a)}
          >
            +
          </button>
          <button type="button" className="boton-icono-28" title="Cerrar" onClick={onCerrar}>
            ×
          </button>
        </div>

        <div className="overlay-cuerpo">
          <div className="tarea-filtros">
            <span className="campo-label">Ver</span>
            <div className="chips">
              {FILTROS.map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`chip ${filtro === f ? 'chip-on' : ''}`}
                  onClick={() => setFiltro(f)}
                >
                  {f}
                </button>
              ))}
            </div>
            <span className="campo-label">Ordenar</span>
            <div className="chips">
              {ORDENES.map((o) => (
                <button
                  key={o.clave}
                  type="button"
                  className={`chip ${orden.includes(o.clave) ? 'chip-on' : ''}`}
                  title={`${o.titulo} · se combinan en el orden que los tocás`}
                  onClick={() => setOrden((v) => alternarOrden(v, o.clave))}
                >
                  {o.clave}
                  {orden.includes(o.clave) && (
                    <span className="tarea-orden-n tabular">{orden.indexOf(o.clave) + 1}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {error && <div className="login-error">{error}</div>}

          {nuevaAbierta && (
            <div className="tarea-nueva">
              <input
                autoFocus
                value={nombre}
                placeholder="Nombre de la tarea…"
                onChange={(e) => setNombre(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void crear()}
              />
              <div className="tarea-nueva-fila">
                <span className="campo-label">Prioridad</span>
                <Estrellas valor={prioridad} onElegir={setPrioridad} />
                <span className="campo-label">Vence</span>
                <input type="date" value={fin} onChange={(e) => setFin(e.target.value)} />
                <button
                  type="button"
                  className={`reunion-check ${notifica ? 'reunion-check-on' : ''}`}
                  onClick={() => setNotifica((n) => !n)}
                >
                  <span className="reunion-check-caja" />
                  <span>notifica</span>
                </button>
              </div>
              <textarea
                rows={2}
                value={notas}
                placeholder="Notas…"
                onChange={(e) => setNotas(e.target.value)}
              />
              <div className="tarea-nueva-acciones">
                <button type="button" className="boton-secundario" onClick={() => setNuevaAbierta(false)}>
                  Cancelar
                </button>
                <button type="button" className="boton-principal" disabled={!nombre.trim()} onClick={() => void crear()}>
                  Crear tarea
                </button>
              </div>
            </div>
          )}

          {lista.length === 0 && <p className="vacio">Ninguna tarea con ese filtro.</p>}

          {lista.map((t) => {
            const vencida = estaVencida(t, hoy);
            return (
              <div key={t.id} className={`tarea-fila ${t.hecha ? 'tarea-hecha' : ''}`}>
                <button
                  type="button"
                  className={`agenda-check ${t.hecha ? 'agenda-check-on' : ''}`}
                  title={t.hecha ? 'Volver a abrir' : 'Marcar como hecha'}
                  onClick={() => void guardar(t.id, { hecha: !t.hecha })}
                >
                  {t.hecha ? '✓' : ''}
                </button>

                <button type="button" className="tarea-nombre" onClick={() => setAbierta(abierta === t.id ? null : t.id)}>
                  {t.nombre}
                </button>

                <span className="tarea-inicio tabular">{ddmm(t.inicio)}</span>
                <span className={`tarea-fin tabular ${vencida ? 'tarea-vencida' : ''}`}>
                  {ddmm(t.fin) || '—'}
                </span>

                {/* El icono de notas, el mismo de Control y de la agenda.
                    Sólo se ve si hay algo escrito: uno vacío en cada fila
                    sería una columna de ruido. */}
                <span className={`tarea-notas-marca ${t.notas ? 'tarea-notas-on' : ''}`} title={t.notas || ''}>
                  {t.notas ? <IconoNotas /> : null}
                </span>
                <span className="tarea-alerta" title={t.notificar ? 'Notifica al vencer' : 'Sin aviso'}>
                  {t.notificar ? '🔔' : ''}
                </span>

                {/* §3.7 y §7.10: las etiquetas van EN LA FILA. El campo existía
                    y no se dibujaba, así que una tarea etiquetada se veía igual
                    que una sin etiquetar y el filtro no tenía de dónde salir. */}
                <span className="tarea-etiquetas">
                  {String(t.etiquetas ?? '')
                    .split(',')
                    .map((x) => x.trim())
                    .filter(Boolean)
                    .map((x) => (
                      <span key={x} className="chip-etiqueta">
                        {x}
                      </span>
                    ))}
                </span>

                <Estrellas valor={t.prioridad} />

                {abierta === t.id && (
                  <div className="tarea-detalle">
                    <div className="tarea-nueva-fila">
                      <span className="campo-label">Prioridad</span>
                      <Estrellas valor={t.prioridad} onElegir={(v) => void guardar(t.id, { prioridad: v })} />
                      <span className="campo-label">Vence</span>
                      <input
                        type="date"
                        value={String(t.fin ?? '').slice(0, 10)}
                        onChange={(e) => void guardar(t.id, { fin: e.target.value || null })}
                      />
                      <button
                        type="button"
                        className={`reunion-check ${t.notificar ? 'reunion-check-on' : ''}`}
                        onClick={() => void guardar(t.id, { notificar: !t.notificar })}
                      >
                        <span className="reunion-check-caja" />
                        <span>notifica</span>
                      </button>
                      <button type="button" className="csg-descartar al-final" onClick={() => void borrar(t.id)}>
                        Eliminar
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      value={t.notas ?? ''}
                      placeholder="Notas de la tarea…"
                      onChange={(e) => void guardar(t.id, { notas: e.target.value })}
                    />
                    {t.expand?.lead?.expand?.perfil && (
                      <LeadDeLaTarea perfil={t.expand.lead.expand.perfil} onIrAlLead={onIrAlLead} lead={t.lead} />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Los vencimientos, a la derecha. Es la misma pantalla de §7.7 sin su
            marco: no hay una segunda version. */}
        {hayVenc && panelVenc && (
          <div className="tarea-panel-venc">
            <Vencimientos
              leads={leads ?? []}
              plantillas={plantillas ?? []}
              onCerrar={() => setPanelVenc(false)}
              onCambio={() => onCambio?.()}
              comoPanel
            />
          </div>
        )}
      </div>
    </div>
  );
}
