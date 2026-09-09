import { useEffect, useMemo, useState } from 'react';
import { normalizar } from '@crm/core/cruce';
import {
  planDeFusion,
  planDeLeads,
  NOMBRE_CAMPO,
  type PerfilFusionable,
} from '@crm/core/fusion';
import { iniciales } from '../followup/ListaContactos';
import { pb } from '../../lib/pocketbase';
import { useEscape } from '../../lib/useEscape';
import type { PerfilMarcado, useDuplicados } from './useDuplicados';

/** Lo que se compara en pantalla, en el orden en que sirve mirarlo. */
const CAMPOS_VISIBLES = [
  'nombre',
  'cargo',
  'empresa',
  'slug',
  'telefono',
  'pais',
  'ciudad',
  'industria',
  'web',
] as const;

function aFusionable(p: PerfilMarcado): PerfilFusionable {
  return {
    id: p.id,
    created: p.created,
    slug: p.slug ?? '',
    urn: p.urn ?? '',
    huella: p.huella ?? '',
    nombre: p.nombre ?? '',
    cargo: p.cargo ?? '',
    empresa: p.empresa ?? '',
    web: p.web ?? '',
    industria: p.industria ?? '',
    pais: p.pais ?? '',
    ciudad: p.ciudad ?? '',
    resumen: p.resumen ?? '',
    telefono: p.telefono ?? '',
    telefono_raw: p.telefono_raw ?? '',
    telefono_valido: Boolean(p.telefono_valido),
    no_contactar: Boolean(p.no_contactar),
  };
}

interface Props {
  /** Lo carga App para poder mostrar el contador en el header sin abrir nada. */
  duplicados: ReturnType<typeof useDuplicados>;
  onCerrar: () => void;
  onCambio: () => void;
}

/**
 * Bandeja de duplicados (D02). El detector marca perfiles que se pisan; acá
 * una persona decide. **El sistema nunca fusiona solo**: hay dos personas
 * distintas compartiendo un teléfono (Mauricio Mantovani y Paul Goris,
 * +31 6 3179xxxx) y fusionarlas sería irreversible.
 *
 * No hay `.dc.html` para esta pantalla: es posterior al prototipo. Se construyó
 * con las mismas piezas que Vencimientos (overlay, tarjetas, pie con acciones)
 * para que no desentone.
 */
export function Duplicados({ duplicados, onCerrar, onCambio }: Props) {
  const { grupos, cargando, error, recargar } = duplicados;
  const [indice, setIndice] = useState(0);
  const [excluidos, setExcluidos] = useState<string[]>([]);
  const [trabajando, setTrabajando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const [fusionados, setFusionados] = useState(0);
  const [separados, setSeparados] = useState(0);
  /**
   * Dos formas de mirar lo mismo.
   *
   * De a uno se ven los dos perfiles enfrentados campo por campo: es lo que
   * hace falta cuando hay que decidir de verdad. En lista entran los que no
   * tienen nada que decidir —el nombre completo coincide y ninguno de los dos
   * tiene otro candidato— y se aprueban de a muchos.
   *
   * Sin la lista, aprobar 28 cruces obvios son 28 vueltas de la misma pantalla.
   */
  const [modo, setModo] = useState<'uno' | 'lista'>('uno');
  const [tildados, setTildados] = useState<string[]>([]);
  const [enLote, setEnLote] = useState<{ hechos: number; total: number } | null>(null);

  const grupo = grupos[indice] ?? null;
  const terminado = !cargando && (grupos.length === 0 || indice >= grupos.length);

  // Al cambiar de grupo vuelven a entrar todos: la exclusión es del grupo que
  // se está mirando, no del siguiente.
  useEffect(() => {
    setExcluidos([]);
    setFallo(null);
  }, [grupo?.id]);

  useEscape(onCerrar, trabajando);

  const elegidos = useMemo(
    () => (grupo?.perfiles ?? []).filter((p) => !excluidos.includes(p.id)),
    [grupo, excluidos],
  );

  const plan = useMemo(
    () => (elegidos.length >= 2 ? planDeFusion(elegidos.map(aFusionable)) : null),
    [elegidos],
  );

  const planLeads = useMemo(
    () =>
      plan && grupo
        ? planDeLeads(plan.sobrevive, plan.absorbidos, grupo.leads)
        : null,
    [plan, grupo],
  );

  const hayChoques = Boolean(planLeads?.choques.length);

  function leadsDe(id: string) {
    return (grupo?.leads ?? []).filter((l) => l.perfil === id);
  }

  function siguiente() {
    setIndice((i) => i + 1);
  }

  /**
   * Deja el grupo consistente después de resolverlo: los que siguen vivos se
   * apuntan entre ellos, y las marcas hacia perfiles que ya no están se van.
   * Sin esto, la bandeja seguiría mostrando fantasmas.
   */
  async function reapuntar(vivos: string[]) {
    for (const id of vivos) {
      await pb.collection('perfil').update(id, {
        posible_duplicado_de: vivos.length > 1 ? vivos.filter((o) => o !== id) : [],
      });
    }
  }

  async function fusionar() {
    if (!plan || !planLeads || !grupo || hayChoques || trabajando) return;
    setTrabajando(true);
    setFallo(null);
    try {
      // 1. Los absorbidos sueltan slug y urn ANTES de que el sobreviviente los
      //    reclame: los dos tienen índice único y quedarían chocando.
      for (const id of plan.absorbidos) {
        await pb.collection('perfil').update(id, {
          slug: '',
          urn: '',
          posible_duplicado_de: [],
          fusionado_en: plan.sobrevive,
        });
      }

      // 2. Los leads pasan al sobreviviente con su historial de envíos colgado.
      for (const id of planLeads.mover) {
        await pb.collection('lead').update(id, { perfil: plan.sobrevive });
      }

      // 3. Recién ahora el sobreviviente toma los datos combinados.
      await pb.collection('perfil').update(plan.sobrevive, plan.resultado);

      const quedan = [
        plan.sobrevive,
        ...grupo.perfiles.filter((p) => excluidos.includes(p.id)).map((p) => p.id),
      ];
      await reapuntar(quedan);

      setFusionados((n) => n + 1);
      onCambio();
      await recargar();
      // La lista se rearma: el grupo resuelto ya no está, así que el índice se
      // queda donde estaba y muestra el siguiente.
    } catch (e) {
      setFallo(e instanceof Error ? e.message : String(e));
    } finally {
      setTrabajando(false);
    }
  }

  /**
   * Fusiona un grupo cualquiera, no el que se está mirando.
   *
   * Es la misma secuencia de tres pasos de `fusionar`, y el orden importa por
   * lo mismo: slug y urn tienen índice único, así que los absorbidos los sueltan
   * antes de que el sobreviviente los reclame.
   */
  async function fusionarGrupo(g: (typeof grupos)[number]) {
    const pl = planDeFusion(g.perfiles.map(aFusionable));
    const pLeads = planDeLeads(pl.sobrevive, pl.absorbidos, g.leads);
    if (pl.conflictos.length || pLeads.choques.length) return false;

    for (const id of pl.absorbidos) {
      await pb.collection('perfil').update(id, {
        slug: '',
        urn: '',
        posible_duplicado_de: [],
        fusionado_en: pl.sobrevive,
      });
    }
    for (const id of pLeads.mover) {
      await pb.collection('lead').update(id, { perfil: pl.sobrevive });
    }
    await pb.collection('perfil').update(pl.sobrevive, pl.resultado);
    await pb.collection('perfil').update(pl.sobrevive, { posible_duplicado_de: [] });
    return true;
  }

  /**
   * Aprueba de a muchos.
   *
   * Va de a uno por dentro y muestra el avance: son consultas a la base, no una
   * transacción, y si falla la número 12 hace falta saber que las 11 anteriores
   * sí se hicieron.
   */
  async function aprobarLote() {
    if (trabajando) return;
    const elegidos = paraLote.filter((x) => tildados.includes(x.grupo.id));
    if (!elegidos.length) return;

    setTrabajando(true);
    setFallo(null);
    setEnLote({ hechos: 0, total: elegidos.length });
    try {
      let n = 0;
      for (const { grupo: g } of elegidos) {
        await fusionarGrupo(g);
        setEnLote({ hechos: ++n, total: elegidos.length });
      }
      setFusionados((x) => x + n);
      onCambio();
      await recargar();
      setTildados([]);
      setModo('uno');
    } catch (e) {
      setFallo(e instanceof Error ? e.message : String(e));
    } finally {
      setEnLote(null);
      setTrabajando(false);
    }
  }

  async function sonDistintos() {
    if (!grupo || trabajando) return;
    setTrabajando(true);
    setFallo(null);
    try {
      const ids = grupo.perfiles.map((p) => p.id);
      for (const p of grupo.perfiles) {
        const ya = new Set(p.distinto_de ?? []);
        for (const otro of ids) if (otro !== p.id) ya.add(otro);
        await pb.collection('perfil').update(p.id, {
          distinto_de: [...ya],
          posible_duplicado_de: [],
        });
      }
      setSeparados((n) => n + 1);
      onCambio();
      await recargar();
    } catch (e) {
      setFallo(e instanceof Error ? e.message : String(e));
    } finally {
      setTrabajando(false);
    }
  }

  /**
   * Los grupos que se pueden aprobar sin mirarlos uno por uno.
   *
   * Tres condiciones, todas necesarias:
   *   - son exactamente dos perfiles (no una maraña de tres o más),
   *   - sus nombres normalizados coinciden enteros,
   *   - la fusión no tiene conflictos ni choques de leads.
   *
   * Con eso, el lote deja de ser un acto de fe: lo que entra es lo que la
   * pantalla de a uno también aprobaría sin dudar.
   */
  const paraLote = useMemo(() => {
    const salida: { grupo: (typeof grupos)[number]; nombre: string }[] = [];
    for (const g of grupos.slice(indice)) {
      if (g.perfiles.length !== 2) continue;
      const [a, b] = g.perfiles;
      if (!a || !b) continue;
      if (normalizar(a.nombre ?? '') !== normalizar(b.nombre ?? '')) continue;
      const pl = planDeFusion(g.perfiles.map(aFusionable));
      if (pl.conflictos.length) continue;
      if (planDeLeads(pl.sobrevive, pl.absorbidos, g.leads).choques.length) continue;
      salida.push({ grupo: g, nombre: a.nombre ?? '' });
    }
    return salida;
  }, [grupos, indice]);

  const avance = grupos.length ? Math.round((indice / grupos.length) * 100) : 100;
  const conflictoDe = new Set((plan?.conflictos ?? []).map((c) => c.campo));

  return (
    <div className="overlay-fondo" onClick={() => !trabajando && onCerrar()}>
      <div className="overlay-caja overlay-ancho" onClick={(e) => e.stopPropagation()}>
        <header className="overlay-header">
          <span className="overlay-titulo">Duplicados</span>
          <span className="overlay-progreso">
            {grupos.length ? `${Math.min(indice + 1, grupos.length)} de ${grupos.length}` : '—'}
          </span>

          {/* El modo lista sólo aparece si hay algo que aprobar en lote: un
              botón que lleva a una pantalla vacía es peor que no tenerlo. */}
          {paraLote.length > 0 && (
            <div className="chips">
              <button
                type="button"
                className={`chip ${modo === 'uno' ? 'chip-on' : ''}`}
                onClick={() => setModo('uno')}
              >
                de a uno
              </button>
              <button
                type="button"
                className={`chip ${modo === 'lista' ? 'chip-on' : ''}`}
                title="Los que coinciden en el nombre completo y no tienen nada que decidir"
                onClick={() => {
                  setModo('lista');
                  setTildados(paraLote.map((x) => x.grupo.id));
                }}
              >
                en lista · {paraLote.length}
              </button>
            </div>
          )}
          <div className="barra">
            <div className="barra-avance" style={{ width: `${avance}%` }} />
          </div>
          <button type="button" className="boton-icono-26" onClick={onCerrar} title="Cerrar (Esc)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        {cargando ? (
          <div className="overlay-cuerpo">
            <p className="vacio">Buscando perfiles que se pisan…</p>
          </div>
        ) : error ? (
          <div className="overlay-cuerpo">
            <div className="aviso-error">
              <strong>No se pudo leer la base.</strong>
              <p>{error}</p>
            </div>
          </div>
        ) : modo === 'lista' ? (
          <div className="overlay-cuerpo">
            <div className="dup-encabezado">
              <span className="pastilla pastilla-ok">{paraLote.length} sin nada que decidir</span>
              <span className="campo-ayuda">
                El nombre completo coincide y ninguno de los dos tiene otro candidato. Destildá el
                que quieras mirar de a uno.
              </span>
            </div>

            <div className="dup-lista">
              {paraLote.map(({ grupo: g, nombre }) => {
                const emails = [...new Set(g.leads.map((l) => l.email).filter(Boolean))];
                const cuentas = [...new Set(g.leads.map((l) => l.cuenta_abrev).filter(Boolean))];
                const tel = g.perfiles.find((x) => x.telefono)?.telefono ?? '';
                const cargo = g.perfiles.find((x) => x.cargo)?.cargo ?? '';
                const pais = g.perfiles.find((x) => x.pais)?.pais ?? '';
                const tildado = tildados.includes(g.id);
                return (
                  <label key={g.id} className={`dup-lista-fila ${tildado ? '' : 'dup-lista-off'}`}>
                    <input
                      type="checkbox"
                      checked={tildado}
                      disabled={trabajando}
                      onChange={() =>
                        setTildados((v) =>
                          v.includes(g.id) ? v.filter((x) => x !== g.id) : [...v, g.id],
                        )
                      }
                    />
                    {/* Sin foto: ni el export del Calendar ni el CSV la traen.
                        Las iniciales es lo que usa el resto de la app. */}
                    <span className="dup-lista-avatar">{iniciales(nombre)}</span>
                    <span className="dup-lista-quien">
                      <span className="dup-lista-nombre">{nombre}</span>
                      <span className="campo-ayuda">
                        {[cargo, pais].filter(Boolean).join(' · ') || 'sin cargo cargado'}
                      </span>
                    </span>
                    <span className="dup-lista-dato">{emails[0] ?? '—'}</span>
                    <span className="dup-lista-dato tabular">{tel || '—'}</span>
                    <span className="dup-lista-cuentas">
                      {cuentas.map((c) => (
                        <span key={c} className="pastilla">
                          {c}
                        </span>
                      ))}
                      {/* Lo que gana la persona al fusionar, que es la razón de
                          estar haciendo esto. */}
                      <span className="pastilla pastilla-ok">
                        {g.leads.length} lead{g.leads.length === 1 ? '' : 's'} + teléfono
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        ) : grupo && !terminado ? (
          <div className="overlay-cuerpo">
            <div className="dup-encabezado">
              <span className="pastilla pastilla-alerta">
                {grupo.perfiles.length} perfiles que podrían ser la misma persona
              </span>
              <span className="campo-ayuda">
                Destildá el que no corresponda para dejarlo afuera de la fusión.
              </span>
            </div>

            <div
              className="dup-tarjetas"
              style={{ gridTemplateColumns: `repeat(${grupo.perfiles.length}, minmax(0, 1fr))` }}
            >
              {grupo.perfiles.map((p) => {
                const fuera = excluidos.includes(p.id);
                const queda = plan?.sobrevive === p.id;
                const nLeads = leadsDe(p.id).length;
                return (
                  <div
                    key={p.id}
                    className={`dup-tarjeta ${queda ? 'dup-tarjeta-queda' : ''} ${fuera ? 'dup-tarjeta-fuera' : ''}`}
                  >
                    <div className="dup-tarjeta-cabecera">
                      <button
                        type="button"
                        className={`dup-check ${fuera ? '' : 'dup-check-on'}`}
                        onClick={() =>
                          setExcluidos((e) =>
                            e.includes(p.id) ? e.filter((x) => x !== p.id) : [...e, p.id],
                          )
                        }
                        title={fuera ? 'Incluir en la fusión' : 'Dejar afuera de la fusión'}
                      >
                        {!fuera && (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <path d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      <span className="dup-estado">
                        {fuera ? 'afuera' : queda ? 'se queda' : 'se absorbe'}
                      </span>
                    </div>

                    <dl className="dup-campos">
                      {CAMPOS_VISIBLES.map((campo) => {
                        const valor = String((p as unknown as Record<string, unknown>)[campo] ?? '').trim();
                        return (
                          <div
                            key={campo}
                            className={`dup-campo ${conflictoDe.has(campo) && !fuera ? 'dup-campo-conflicto' : ''}`}
                          >
                            <dt className="dup-campo-label">{NOMBRE_CAMPO[campo] ?? campo}</dt>
                            <dd className="dup-campo-valor">
                              {valor || <span className="dup-campo-vacio">—</span>}
                            </dd>
                          </div>
                        );
                      })}
                    </dl>

                    <div className="dup-tarjeta-pie">
                      <span className="campo-ayuda tabular">{p.created.slice(0, 10)}</span>
                      <span className={`pastilla ${nLeads ? 'pastilla-suave' : ''}`}>
                        {nLeads === 0 ? 'sin leads' : nLeads === 1 ? '1 lead' : `${nLeads} leads`}
                      </span>
                      {p.no_contactar && <span className="pastilla pastilla-error">no contactar</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            {plan && (
              <div className="dup-resultado">
                <span className="campo-label">Si se fusionan queda un solo perfil</span>
                <div className="colapsable-chips">
                  {CAMPOS_VISIBLES.map((campo) => {
                    const valor = String(plan.resultado[campo] ?? '');
                    if (!valor) return null;
                    return (
                      <span key={campo} className="chip-campo">
                        <span className="chip-campo-label">{NOMBRE_CAMPO[campo] ?? campo}</span>
                        <span className="chip-campo-valor">{valor}</span>
                      </span>
                    );
                  })}
                </div>
                {planLeads && planLeads.mover.length > 0 && (
                  <span className="campo-ayuda">
                    {planLeads.mover.length === 1
                      ? '1 lead pasa al perfil que queda, con su historial.'
                      : `${planLeads.mover.length} leads pasan al perfil que queda, con su historial.`}
                  </span>
                )}
                {Boolean(plan.resultado.no_contactar) && (
                  <span className="campo-ayuda">
                    Uno de los perfiles está marcado como <b>no contactar</b>: el fusionado
                    lo hereda.
                  </span>
                )}
              </div>
            )}

            {plan && plan.conflictos.length > 0 && (
              <div className="aviso-suave">
                <b>Dicen cosas distintas</b> en{' '}
                {plan.conflictos.map((c) => NOMBRE_CAMPO[c.campo] ?? c.campo).join(', ')}. Queda
                el valor del perfil más viejo; si no es el correcto, editalo después en la ficha.
              </div>
            )}

            {hayChoques && (
              <div className="aviso-error">
                <strong>No se pueden fusionar todavía.</strong>
                <p>
                  Hay dos leads en la misma cuenta (
                  {planLeads!.choques.map((c) => c.cuenta_abrev ?? c.cuenta).join(', ')}), o sea
                  dos historiales de envíos para la misma relación. Elegí cuál se queda y
                  descartá el otro desde Follow-up antes de fusionar.
                </p>
              </div>
            )}

            {elegidos.length < 2 && (
              <div className="aviso-suave">
                Hacen falta al menos dos perfiles para fusionar. Volvé a tildar alguno, o marcá
                que son personas distintas.
              </div>
            )}

            {fallo && <div className="login-error">{fallo}</div>}
          </div>
        ) : (
          <div className="overlay-cuerpo overlay-final">
            <span className="venc-nombre">
              {fusionados === 0 && separados === 0
                ? 'No hay duplicados pendientes'
                : `${fusionados} fusionados · ${separados} marcados como distintos`}
            </span>
            <span className="campo-ayuda">
              {fusionados === 0 && separados === 0
                ? 'Ningún perfil está marcado como posible duplicado.'
                : 'Los perfiles absorbidos quedan como rastro, apuntando al que sobrevivió.'}
            </span>
          </div>
        )}

        <footer className="overlay-pie">
          <span className="campo-ayuda">
            {enLote
              ? `Uniendo ${enLote.hechos} de ${enLote.total}…`
              : grupos.length - indice > 0
                ? `${grupos.length - indice} por revisar`
                : 'todo revisado'}
          </span>

          {modo === 'lista' ? (
            <>
              <button
                type="button"
                className="boton-secundario"
                disabled={trabajando}
                onClick={() => {
                  setModo('uno');
                  setTildados([]);
                }}
              >
                Volver
              </button>
              <button
                type="button"
                className="boton-principal al-final"
                disabled={trabajando || !tildados.length}
                onClick={() => void aprobarLote()}
              >
                {trabajando
                  ? 'Uniendo…'
                  : `Aprobar ${tildados.length} ${tildados.length === 1 ? 'unión' : 'uniones'}`}
              </button>
            </>
          ) : grupo && !terminado ? (
            <>
              <button
                type="button"
                className="boton-secundario al-final"
                onClick={siguiente}
                disabled={trabajando}
              >
                Dejar para después
              </button>
              <button
                type="button"
                className="boton-secundario"
                onClick={() => void sonDistintos()}
                disabled={trabajando}
                title="No vuelven a aparecer emparentados"
              >
                Son personas distintas
              </button>
              <button
                type="button"
                className="boton-principal"
                onClick={() => void fusionar()}
                disabled={trabajando || hayChoques || elegidos.length < 2}
              >
                {trabajando ? 'Fusionando…' : `✓ Fusionar ${elegidos.length}`}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="boton-principal al-final"
              onClick={onCerrar}
            >
              Listo
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
