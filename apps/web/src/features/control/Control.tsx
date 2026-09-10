import { useMemo, useState } from 'react';
import { NOMBRE_LINEA, type LineaNegocio } from '@crm/core/permisos';
import type { UsuarioRecord } from '../../lib/types';
import { leadsDeControl, porAtencion, resumenDeControl, ETIQUETA_CONTROL } from '@crm/core/control';
import { ddmm } from '@crm/core/fecha';
import { useControl, type ProyectoConDatos } from './useControl';
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
 * Sección Control (§7.11): proyectos, leads y reuniones EN UNA SOLA LISTA.
 *
 * POR QUE SE UNIFICO. Tenía tres solapas —Proyectos, Leads, Reuniones— y las
 * tres miraban lo mismo desde ángulos distintos. Augusto, el 10/09: *«definimos
 * la unificación entre proyectos, leads y reuniones, todo en un solo lugar»*.
 *
 * Tres solapas obligan a llevar el hilo en la cabeza: uno leía «Reuniones 20»,
 * pasaba a Leads y no sabía cuáles de esos leads eran los de esas veinte.
 * Ahora hay una fila por lead y cada renglón trae su proyecto y sus reuniones
 * al lado.
 *
 * QUE SE MUESTRA. Sólo los leads con la etiqueta **Control**. Es una decisión
 * de quien los sigue y no una regla del sistema, y ahí está la ventaja:
 * «avanzado» no se deduce de la etapa ni del número de reuniones — hay leads
 * con cuatro que no van a ningún lado y leads con una que están por cerrar.
 *
 * **Toda la sección es de solo lectura para cualquier rol**, y el header lo
 * declara con la pastilla. Lo que se edita se edita en la ficha del lead o en
 * el proyecto; acá se mira. Es lo único que ve el Observador.
 */
export function Control({ usuario }: Props) {
  const { proyectos, leads, lineas, cargando, error } = useControl(usuario);
  // Quien ve las dos lineas puede mirar una por vez. Quien ve una sola no elige
  // nada: el filtro ya se aplico al leer.
  const [linea, setLinea] = useState<LineaNegocio | null>(null);
  const [abierto, setAbierto] = useState<ProyectoConDatos | null>(null);

  /**
   * Los leads de la pantalla: los de la línea elegida, con la etiqueta, y
   * ordenados por lo que hace más que no se toca.
   *
   * EL ORDEN VA AL REVES de lo que uno esperaría, y es a propósito: el que
   * tuvo reunión ayer no necesita nada; el que no se toca hace dos meses se
   * está enfriando. La regla está en `core/control.ts` con sus tests.
   */
  const filas = useMemo(() => {
    const deLaLinea = linea ? leads.filter((l) => LINEA_DE_LA_CASA[l.casa] === linea) : leads;
    return porAtencion(leadsDeControl(deLaLinea));
  }, [leads, linea]);

  const resumen = useMemo(() => resumenDeControl(filas), [filas]);

  /** Para abrir el panel desde la fila: del id del proyecto al proyecto. */
  const proyectoPorId = useMemo(
    () => new Map(proyectos.map((p) => [p.proyecto.id, p])),
    [proyectos],
  );

  // El panel muestra lo recién leído, no una copia congelada de cuando se abrió.
  const panel = abierto
    ? proyectos.find((p) => p.proyecto.id === abierto.proyecto.id) ?? abierto
    : null;

  return (
    <section className="control">
      <header className="ctrl-header">
        <span className="ctrl-titulo">Control de proyectos</span>
        {/*
          EL RESUMEN, y se calcula SOBRE LOS LEADS MARCADOS.

          El contador viejo decía «Reuniones 20» y esas veinte eran todas las
          reuniones de las cuentas de esa línea, incluidas las de leads que
          nadie sigue y las que nadie confirmó si ocurrieron. Ese número no
          medía avance comercial: medía cuánto se agendó alguna vez.

          «Sin proyecto» y «sin reuniones» están a propósito. Un resumen que
          sólo cuenta lo que hay se lee como si estuviera todo bien, y lo que
          falta es la mitad del dato.
        */}
        <div className="ctrl-resumen">
          <span className="ctrl-dato">
            <b className="tabular">{resumen.leads}</b> leads
          </span>
          <span className="ctrl-dato">
            <b className="tabular">{resumen.reuniones}</b> reuniones
          </span>
          <span className="ctrl-dato">
            <b className="tabular">{resumen.conProyecto}</b> con proyecto
          </span>
          {resumen.sinProyecto > 0 && (
            <span className="ctrl-dato ctrl-dato-falta" title="Marcados como avanzados y sin proyecto abierto">
              <b className="tabular">{resumen.sinProyecto}</b> sin abrir
            </span>
          )}
          {resumen.sinReuniones > 0 && (
            <span className="ctrl-dato ctrl-dato-falta" title="Marcados como avanzados y todavía sin ninguna reunión">
              <b className="tabular">{resumen.sinReuniones}</b> sin reunión
            </span>
          )}
          {resumen.ultima && (
            <span className="ctrl-dato ctrl-dato-suave">última {ddmm(resumen.ultima)}</span>
          )}
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
        {!cargando && !error && filas.length === 0 && (
          <p className="vacio">
            Ningún lead con la etiqueta <b>{ETIQUETA_CONTROL}</b>. Se pone desde la ficha del
            lead, y es la forma de decir «éste ya está avanzado»: la pantalla muestra ésos y
            nada más.
          </p>
        )}

        {!cargando && !error && filas.length > 0 && (
          <div className="bc-scroll">
            <div className="bc-tabla ctrl-unificado-tabla">
              <div className="bc-encabezado">
                <span className="auto-th">Contacto</span>
                <span className="auto-th">Empresa e industria</span>
                <span className="auto-th">Lugar</span>
                {/* De qué cuenta entró: es lo único que dice quién lo trajo. */}
                <span className="auto-th">Origen</span>
                <span className="auto-th">Etiquetas</span>
                <span className="auto-th auto-der">Reun.</span>
                <span className="auto-th auto-der">Última</span>
                <span className="auto-th">Proyecto</span>
              </div>

              {filas.map((l) => {
                const suyo = l.proyecto ? proyectoPorId.get(l.proyecto) ?? null : null;
                return (
                  <div key={l.id} className="bc-fila">
                    <div className="bc-celda bc-lead">
                      <span className="bc-nombre">{l.nombre}</span>
                      <span className="campo-ayuda">{l.cargo || 'sin cargo'}</span>
                    </div>
                    <div className="bc-celda bc-empresa">
                      <span>{l.empresa || '—'}</span>
                      <span className="campo-ayuda">{l.industria || '—'}</span>
                    </div>
                    <span className="bc-celda bc-texto">
                      {[l.ciudad, l.pais].filter(Boolean).join(' · ') || '—'}
                    </span>
                    <span className="bc-celda">
                      <span className="pastilla" title="La cuenta por la que entró el lead">
                        {l.cuenta || '—'}
                      </span>
                    </span>
                    <div className="bc-celda ctrl-leads-etiquetas">
                      {l.etiquetas.map((e) => (
                        <span key={e} className="ctrl-chip-interes">
                          {e}
                        </span>
                      ))}
                    </div>
                    {/* Sin reuniones va MARCADO y no con un guión: un lead
                        marcado como avanzado que nunca tuvo una reunión es la
                        contradicción que esta pantalla existe para mostrar. */}
                    <span
                      className={
                        l.reuniones ? 'bc-celda bc-fuerte tabular' : 'bc-celda ctrl-falta tabular'
                      }
                    >
                      {l.reuniones || 'ninguna'}
                    </span>
                    <span className="bc-celda bc-texto tabular">{ddmm(l.ultima) || '—'}</span>
                    <span className="bc-celda">
                      {suyo ? (
                        <button
                          type="button"
                          className="ctrl-chip-abierto"
                          title="Ver el proyecto"
                          onClick={() => setAbierto(suyo)}
                        >
                          abierto
                        </button>
                      ) : (
                        <span className="ctrl-falta">sin abrir</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {panel && <PanelProyecto p={panel} onCerrar={() => setAbierto(null)} />}
    </section>
  );
}
