import { useMemo, useState } from 'react';
import { NOMBRE_LINEA, type LineaNegocio } from '@crm/core/permisos';
import type { UsuarioRecord } from '../../lib/types';
import { leadsDeControl, porAtencion, resumenDeControl, ETIQUETA_CONTROL } from '@crm/core/control';
import { ddmm, diaLocal } from '@crm/core/fecha';
import {
  ESTADOS_ACTIVOS,
  NOMBRE_ESTADO,
  REGLA_ESTADO,
  estadoEfectivo,
  type EstadoProyecto,
} from '@crm/core/proyecto';
import { useControl, type ProyectoConDatos } from './useControl';
import { PanelProyecto } from './PanelProyecto';
import { AdminEstados } from './AdminEstados';
import { EstadisticaReuniones } from './EstadisticaReuniones';

/** Los siete estados, en el orden en que avanza un proyecto. */
const ESTADOS: EstadoProyecto[] = [
  'sin_hablar',
  'en_conversacion',
  'propuesta_enviada',
  'nuestra_pelota',
  'congelado',
  'cerrado_ganado',
  'cerrado_perdido',
];

const HOY = diaLocal();

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
  const { proyectos, reuniones, leads, lineas, cargando, error } = useControl(usuario);
  // Quien ve las dos lineas puede mirar una por vez. Quien ve una sola no elige
  // nada: el filtro ya se aplico al leer.
  const [linea, setLinea] = useState<LineaNegocio | null>(null);
  const [abierto, setAbierto] = useState<ProyectoConDatos | null>(null);
  /** §3.13.2 · El editor de los estados. Se abre desde la leyenda. */
  const [adminAbierto, setAdminAbierto] = useState(false);

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

  /**
   * Las reuniones de la línea, para la estadística.
   *
   * OJO CON EL RECORTE: acá NO se filtra por la etiqueta Control. La
   * estadística mide la actividad de la línea entera —cuántas reuniones hubo,
   * de dónde son, en qué terminaron— y la lista de abajo mide el avance de los
   * leads marcados. Filtrar las dos por lo mismo sonaría más prolijo y
   * escondería la mitad del trabajo hecho.
   */
  const reunionesDeLaLinea = useMemo(
    () => (linea ? reuniones.filter((r) => r.linea === linea) : reuniones),
    [reuniones, linea],
  );

  /** Para abrir el panel desde la fila: del id del proyecto al proyecto. */
  const proyectoPorId = useMemo(
    () => new Map(proyectos.map((p) => [p.proyecto.id, p])),
    [proyectos],
  );

  /**
   * LAS TARJETAS, sobre los proyectos DE LOS LEADS MARCADOS.
   *
   * Antes contaban todos los proyectos de la línea. Ahora cuentan los de esta
   * lista, que es de lo que trata la pantalla: si el resumen mide un conjunto
   * y la tabla muestra otro, los dos números se leen como si hablaran de lo
   * mismo y no hablan de lo mismo.
   *
   * El estado se calcula con `estadoEfectivo`, no se lee del campo: un
   * proyecto sin movimiento hace más de 30 días está congelado aunque nadie
   * haya tocado nada. La regla vive en core y la comparten el filtro, los
   * conteos y las tarjetas para que no puedan discrepar.
   */
  const tarjetas = useMemo(() => {
    const suyos = filas
      .map((l) => (l.proyecto ? proyectoPorId.get(l.proyecto) : null))
      .filter((x): x is ProyectoConDatos => Boolean(x))
      .map((x) => estadoEfectivo(x.proyecto, x.reuniones, HOY));
    const cuenta = (f: (e: EstadoProyecto) => boolean) => suyos.filter(f).length;
    return [
      { n: cuenta((e) => ESTADOS_ACTIVOS.includes(e)), label: 'Activos', detalle: 'Sin hablar, en conversación, propuesta enviada y nuestra pelota.', color: 'var(--accent)' },
      { n: cuenta((e) => e === 'propuesta_enviada'), label: 'Propuesta enviada', detalle: 'La pelota está del otro lado.', color: 'var(--info)' },
      { n: cuenta((e) => e === 'nuestra_pelota'), label: 'Nuestra pelota', detalle: 'Nos falta hacer algo a nosotros.', color: 'var(--warning)' },
      { n: cuenta((e) => e === 'congelado'), label: 'Congelados', detalle: 'Más de 30 días sin movimiento.', color: 'var(--muted)' },
      { n: cuenta((e) => e === 'cerrado_ganado'), label: 'Cerrados ganados', detalle: 'Se cerraron y arrancó el trabajo.', color: 'var(--success)' },
    ];
  }, [filas, proyectoPorId]);

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
        {/*
          LOS ESTADOS, ARRIBA. Estaban al final de la pantalla vieja, después de
          la tabla entera: había que bajar hasta el fondo para leer qué
          significa «Nuestra pelota», que es justo lo que uno necesita ANTES de
          mirar la tabla.
        */}
        {!cargando && !error && (
          <div className="ctrl-bloque">
            <div className="ctrl-leyenda-cabeza">
              <span className="ctrl-filtro-label">Los estados y cuándo se aplican</span>
              {/* §3.13.2 · Acá se editan. Antes esta leyenda salía de un
                  archivo de código y corregir una palabra era un cambio de
                  programa. */}
              <button
                type="button"
                className="boton-mini al-final"
                title="Cambiar el nombre y el significado de cada estado"
                onClick={() => setAdminAbierto(true)}
              >
                Editar los estados
              </button>
            </div>
            <div className="ctrl-leyenda">
              {ESTADOS.map((e) => (
                <div key={e} className="ctrl-leyenda-item">
                  <span className={`ctrl-pastilla ctrl-estado-${e}`}>{NOMBRE_ESTADO[e]}</span>
                  <span className="ctrl-tarjeta-detalle">{REGLA_ESTADO[e]}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Las tarjetas, de los proyectos DE ESTOS leads. Si el resumen midiera
            un conjunto y la tabla mostrara otro, los dos números se leerían
            como si hablaran de lo mismo. */}
        {!cargando && !error && filas.length > 0 && (
          <div className="ctrl-tarjetas">
            {tarjetas.map((t) => (
              <div key={t.label} className="ctrl-tarjeta">
                <span className="ctrl-tarjeta-n" style={{ color: t.color }}>
                  {t.n}
                </span>
                <span className="ctrl-tarjeta-label">{t.label}</span>
                <span className="ctrl-tarjeta-detalle">{t.detalle}</span>
              </div>
            ))}
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
          <div className="ctrl-bloque-cabecera">
            <span className="ctrl-filtro-label">Los leads que se siguen</span>
            <span className="campo-ayuda ctrl-derecha">
              sólo los de etiqueta {ETIQUETA_CONTROL} · primero el que hace más que no se toca
            </span>
          </div>
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

        {/* LA ESTADÍSTICA DE LAS REUNIONES, al final y no arriba.
            Primero va lo accionable —en qué estado está cada lead marcado y
            cuál hace más que no se toca— y después el análisis, que es largo:
            ocho tarjetas, el gráfico por mes, diez agrupadores y la tabla del
            período. Puesto arriba, empujaba la lista fuera de la pantalla.

            Se había perdido entera al unificar las tres solapas, y Augusto lo
            marcó enseguida: «todo donde estaba antes, pero solamente en una
            solapa». Unificar era juntar, no recortar. */}
        {!cargando && !error && reunionesDeLaLinea.length > 0 && (
          <div className="ctrl-bloque">
            <div className="ctrl-bloque-cabecera">
              <span className="ctrl-filtro-label">Las reuniones de la línea</span>
              {/* El recorte se dice en pantalla. Sin esto, este número y el de
                  la lista de arriba se leen como si contaran lo mismo, que es
                  exactamente lo que hizo preguntar de dónde salían las 20. */}
              <span className="campo-ayuda ctrl-derecha">
                todas las de la línea, con etiqueta {ETIQUETA_CONTROL} o sin ella
              </span>
            </div>
            <EstadisticaReuniones reuniones={reunionesDeLaLinea} />
          </div>
        )}
      </div>

      {panel && <PanelProyecto p={panel} onCerrar={() => setAbierto(null)} />}
      {adminAbierto && <AdminEstados onCerrar={() => setAdminAbierto(false)} />}
    </section>
  );
}
