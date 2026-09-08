import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  NOMBRE_FUENTE,
  enPrioridad,
  estadoDeLista,
  mover,
  restantes,
  resumenDeCuentas,
  resumenDeListas,
  salidasDeHoy,
  vuelvenALaCola,
  type ConfigCancelacion,
  type CuentaInvitacion,
  type ListaInvitacion,
} from '@crm/core/invitacion';
import {
  anchoDeTasa,
  colorDeTasa,
  cuandoResponden,
  industriasQueConvierten,
  metricasSemanales,
  perfilesConMasReuniones,
  porcentaje,
  rendimientoPorPaso,
  type EnvioMedido,
  type LeadMedido,
} from '@crm/core/rendimiento';
import type { ConfigCadencia } from '@crm/core/tipos';
import { pb } from '../../lib/pocketbase';

type Grupo = 'Invitaciones' | 'Cancelación' | 'Seguimiento';

const GRUPOS: Grupo[] = ['Invitaciones', 'Cancelación', 'Seguimiento'];

const BAJADA: Record<Grupo, string> = {
  Invitaciones: 'Qué lista trabaja cada cuenta, por dónde va y cuántas invitaciones salen por día.',
  Cancelación: 'Cuándo se cancela una invitación sin aceptar y cuántos vuelven a la cola.',
  Seguimiento: 'La cadencia R1–R8 sobre los que aceptaron y su rendimiento real.',
};

const CANAL_LEGIBLE: Record<string, string> = {
  linkedin: 'LinkedIn',
  whatsapp: 'WhatsApp',
  whatsapp_si_hay_telefono: 'WhatsApp si hay teléfono',
};

function hoyIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface CuentaRecord extends CuentaInvitacion {
  linea_negocio?: string;
}

interface ConfigRecord {
  id: string;
  clave: string;
  valor: Record<string, unknown>;
}

interface LeadRecord extends LeadMedido {
  expand?: { perfil?: { cargo?: string; industria?: string } };
}

interface ReunionRecord {
  id: string;
  lead: string;
  estado: string;
}

/** Una barrita horizontal con su valor: la única forma de comparar de un vistazo. */
function Barra({ ancho, tono, valor }: { ancho: number; tono?: string; valor: string }) {
  return (
    <span className="auto-barra-caja">
      <span className="auto-barra-pista">
        <span className={`auto-barra-relleno ${tono ? `auto-tono-${tono}` : ''}`} style={{ width: `${ancho}%` }} />
      </span>
      <span className={`auto-barra-valor tabular ${tono ? `auto-tono-${tono}` : ''}`}>{valor}</span>
    </span>
  );
}

/**
 * Automatizaciones (§7.3). Portada de `docs/prototipo/Automatizaciones.dc.html`.
 *
 * Tres grupos en la columna izquierda y una columna derecha FIJA que no cambia
 * al cambiar de grupo: es el resumen de qué va a pasar hoy, y tiene que estar a
 * la vista mientras se tocan los números que lo cambian.
 */
export function Automatizaciones() {
  const [grupo, setGrupo] = useState<Grupo>('Invitaciones');
  const [cuentas, setCuentas] = useState<CuentaRecord[]>([]);
  const [listas, setListas] = useState<ListaInvitacion[]>([]);
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [envios, setEnvios] = useState<EnvioMedido[]>([]);
  const [reuniones, setReuniones] = useState<ReunionRecord[]>([]);
  const [config, setConfig] = useState<Record<string, ConfigRecord>>({});
  const [abierta, setAbierta] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hoy = hoyIso();

  const recargar = useCallback(async () => {
    try {
      const [c, l, le, en, re, cf] = await Promise.all([
        pb.collection('cuenta').getFullList<CuentaRecord>({ sort: 'slot' }),
        pb.collection('lista_invitacion').getFullList<ListaInvitacion>({ sort: 'orden' }),
        pb.collection('lead').getFullList<LeadRecord>({ expand: 'perfil' }),
        pb.collection('envio').getFullList<EnvioMedido>(),
        pb.collection('reunion').getFullList<ReunionRecord>(),
        pb.collection('configuracion').getFullList<ConfigRecord>(),
      ]);
      setCuentas(c);
      setListas(l);
      setLeads(le);
      setEnvios(en);
      setReuniones(re);
      const porClave: Record<string, ConfigRecord> = {};
      for (const r of cf) porClave[r.clave] = r;
      setConfig(porClave);
      if (!abierta && c.length) setAbierta(c[0].id);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [abierta]);

  useEffect(() => {
    void recargar();
    // Se lee una vez: son números de planificación, no un monitor en vivo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cadencia = (config['cadencia']?.valor ?? {}) as unknown as ConfigCadencia;
  const cancelacion = (config['cancelacion']?.valor ?? {
    dias_sin_aceptar: 90,
    espera_recontacto_dias: 60,
    tope_diario_por_cuenta: 30,
  }) as unknown as ConfigCancelacion;
  const pausado = Boolean((config['automatizacion']?.valor as { pausado?: boolean })?.pausado);

  async function guardarConfig(clave: string, valor: unknown) {
    const r = config[clave];
    setConfig((c) => ({ ...c, [clave]: { ...(c[clave] ?? { id: '', clave }), valor } as ConfigRecord }));
    if (!r?.id) return;
    await pb.collection('configuracion').update(r.id, { valor }).catch(() => void recargar());
  }

  const listasPorCuenta = useMemo(() => {
    const m = new Map<string, ListaInvitacion[]>();
    for (const l of listas) m.set(l.cuenta, [...(m.get(l.cuenta) ?? []), l]);
    return m;
  }, [listas]);

  const salidas = useMemo(
    () => salidasDeHoy(cuentas, listasPorCuenta, leads, cancelacion, hoy, pausado),
    [cuentas, listasPorCuenta, leads, cancelacion, hoy, pausado],
  );
  const totalHoy = salidas.reduce((a, s) => a + s.invitaciones + s.seguimiento + s.cancelaciones, 0);
  const frenadas = salidas.filter((s) => s.frenada).map((s) => s.cuenta);

  const metricas = useMemo(() => metricasSemanales(cuentas, leads, hoy), [cuentas, leads, hoy]);
  const tabla = useMemo(() => rendimientoPorPaso(leads, envios, hoy), [leads, envios, hoy]);

  const seguimiento = tabla.filter((f) => !f.esAceptacion);
  const totEnv = seguimiento.reduce((a, f) => a + f.enviados, 0);
  const totResp = seguimiento.reduce((a, f) => a + f.respuestas, 0);
  const r0 = tabla.find((f) => f.esAceptacion);

  const analisis = useMemo(() => {
    const porLead = new Map(leads.map((l) => [l.id, l]));
    const conPerfil = reuniones.map((r) => {
      const l = porLead.get(r.lead) as LeadRecord | undefined;
      return { cargo: l?.expand?.perfil?.cargo, industria: l?.expand?.perfil?.industria, estado: r.estado };
    });
    // Leads DISTINTOS con al menos una reunión viva. Contando reuniones, quien
    // reagenda cuenta dos veces y la tasa se pasa de 100%.
    const conReunion = new Set(reuniones.filter((r) => r.estado !== 'cancelada').map((r) => r.lead));
    const aceptados = new Map<string, number>();
    const aceptadosConReunion = new Map<string, number>();
    for (const l of leads) {
      if (!l.f_aceptacion) continue;
      const i = l.expand?.perfil?.industria?.trim() || 'sin industria';
      aceptados.set(i, (aceptados.get(i) ?? 0) + 1);
      if (conReunion.has(l.id)) aceptadosConReunion.set(i, (aceptadosConReunion.get(i) ?? 0) + 1);
    }
    return {
      cuando: cuandoResponden(leads),
      perfiles: perfilesConMasReuniones(conPerfil),
      industrias: industriasQueConvierten(aceptados, aceptadosConReunion),
    };
  }, [leads, reuniones]);

  async function cambiarOrden(lista: ListaInvitacion, direccion: -1 | 1) {
    const nuevos = mover(listasPorCuenta.get(lista.cuenta) ?? [], lista.id, direccion);
    if (!nuevos.length) return;
    setListas((ls) => ls.map((l) => ({ ...l, orden: nuevos.find((n) => n.id === l.id)?.orden ?? l.orden })));
    await Promise.all(
      nuevos.map((n) => pb.collection('lista_invitacion').update(n.id, { orden: n.orden })),
    ).catch(() => void recargar());
  }

  async function cambiarCupo(c: CuentaRecord, cupo: number) {
    setCuentas((cs) => cs.map((x) => (x.id === c.id ? { ...x, cupo_diario: cupo } : x)));
    await pb.collection('cuenta').update(c.id, { cupo_diario: cupo }).catch(() => void recargar());
  }

  function cambiarPaso(paso: string, campo: 'nombre' | 'espera_dias' | 'activo', valor: unknown) {
    const pasos = (cadencia.pasos ?? []).map((p) => (p.paso === paso ? { ...p, [campo]: valor } : p));
    void guardarConfig('cadencia', { ...cadencia, pasos });
  }

  const pasos = cadencia.pasos ?? [];
  const activos = pasos.filter((p) => p.activo).length;

  return (
    <section className="auto">
      <div className="auto-header">
        <div className="auto-grupos">
          {GRUPOS.map((g) => (
            <button
              key={g}
              type="button"
              className={`auto-grupo ${grupo === g ? 'auto-grupo-on' : ''}`}
              onClick={() => setGrupo(g)}
            >
              {g}
            </button>
          ))}
        </div>
        <span className="auto-bajada">{BAJADA[grupo]}</span>
        {/* §7.3: el interruptor global. Vive en `configuracion` porque una
            pausa que solo existe en el navegador de quien la apretó no pausa
            nada del lado del worker. */}
        <button
          type="button"
          className={pausado ? 'auto-pausa' : 'auto-marcha'}
          onClick={() => void guardarConfig('automatizacion', { pausado: !pausado })}
        >
          {!pausado && <span className="cola-punto" />}
          {pausado ? 'todo en pausa' : 'en marcha'}
        </button>
      </div>

      {error && <div className="aviso-error">{error}</div>}

      <div className="auto-cuerpo">
        <div className="auto-col">
          {grupo === 'Invitaciones' && (
            <div className="auto-tarjeta">
              <div className="auto-tarjeta-header">
                <span className="auto-titulo">Cuentas de invitación</span>
                <span className="campo-ayuda">{resumenDeCuentas(cuentas)}</span>
              </div>
              {cuentas.map((c) => {
                const mias = enPrioridad(listasPorCuenta.get(c.id) ?? []);
                const libre = c.estado_sesion === 'sin_vincular';
                const esta = abierta === c.id;
                const m = metricas.find((x) => x.cuenta === c.abrev);
                return (
                  <div key={c.id} className={`auto-cuenta ${esta ? 'auto-cuenta-on' : ''}`}>
                    <div className="auto-cuenta-fila">
                      <span className={`auto-cuenta-abrev ${libre ? 'auto-apagado' : ''}`}>{c.abrev}</span>
                      <span className="auto-cuenta-medio">
                        <span className={`auto-cuenta-estado auto-sesion-${c.estado_sesion}`}>
                          {c.estado_sesion === 'activa'
                            ? 'activa'
                            : c.estado_sesion === 'caida'
                              ? 'sesión caída'
                              : 'sin vincular'}
                        </span>
                        <span className="campo-ayuda">{resumenDeListas(mias)}</span>
                      </span>
                      <span className="auto-cupo">
                        <input
                          type="number"
                          min={0}
                          max={80}
                          value={c.cupo_diario ?? 0}
                          onChange={(e) => void cambiarCupo(c, Number(e.target.value))}
                        />
                        <span className="campo-ayuda">/d</span>
                      </span>
                      <span className="auto-semana tabular">
                        {m ? `${m.enviadas}/${m.objetivo}` : '—'}
                      </span>
                      <button
                        type="button"
                        className="auto-flecha"
                        title="Ver las listas de la cuenta"
                        onClick={() => setAbierta(esta ? null : c.id)}
                      >
                        {esta ? '▾' : '▸'}
                      </button>
                    </div>

                    {esta && (
                      <div className="auto-listas">
                        <span className="auto-th">#</span>
                        <span className="auto-th">Lista</span>
                        <span className="auto-th auto-der">Últ. página</span>
                        <span className="auto-th auto-der">Perfiles</span>
                        <span className="auto-th auto-der">Estado</span>
                        {mias.map((l, i) => {
                          const estado = estadoDeLista(l, mias);
                          return (
                            <ItemLista
                              key={l.id}
                              lista={l}
                              indice={i}
                              estado={estado}
                              onMover={(d) => void cambiarOrden(l, d)}
                            />
                          );
                        })}
                        {!mias.length && <span className="auto-nota">Sin listas asignadas.</span>}
                        <span className="auto-nota">
                          El script toma la lista de prioridad 1 que todavía tenga páginas; cuando se
                          agota pasa a la siguiente. El cupo de la cuenta manda sobre cuántos perfiles
                          saca por día.
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {grupo === 'Cancelación' && (
            <>
              <div className="auto-tarjeta">
                <span className="auto-titulo">Regla de cancelación</span>
                <NumeroConTexto
                  valor={cancelacion.dias_sin_aceptar}
                  min={30}
                  max={180}
                  texto="días sin aceptar → se cancela"
                  onCambio={(v) => void guardarConfig('cancelacion', { ...cancelacion, dias_sin_aceptar: v })}
                />
                <NumeroConTexto
                  valor={cancelacion.espera_recontacto_dias}
                  min={0}
                  max={180}
                  texto="días de espera antes de reinvitar"
                  onCambio={(v) =>
                    void guardarConfig('cancelacion', { ...cancelacion, espera_recontacto_dias: v })
                  }
                />
                <NumeroConTexto
                  valor={cancelacion.tope_diario_por_cuenta}
                  min={1}
                  max={200}
                  texto="cancelaciones por día y cuenta"
                  onCambio={(v) =>
                    void guardarConfig('cancelacion', { ...cancelacion, tope_diario_por_cuenta: v })
                  }
                />
              </div>

              <div className="auto-tarjeta auto-tarjeta-info">
                <span className="auto-titulo">Vuelven a la cola de envío</span>
                <div className="auto-recontacto">
                  <span className="auto-th">Cuenta</span>
                  <span className="auto-th">Cumplen la espera</span>
                  <span className="auto-th auto-der">Leads</span>
                  {vuelvenALaCola(cuentas, leads, cancelacion, hoy).map((r, i) => (
                    <RecontactoFila key={`${r.cuenta}-${r.cuando}-${i}`} {...r} />
                  ))}
                </div>
                <span className="auto-nota auto-nota-borde">
                  Entran como etapa <b className="auto-recontacto-etapa">Recontacto</b> con la plantilla de
                  reinvitación, respetando el cupo diario de cada cuenta. Total listo para reinvitar:{' '}
                  <b>{vuelvenALaCola(cuentas, leads, cancelacion, hoy).reduce((a, r) => a + r.n, 0)} leads</b>.
                </span>
              </div>
            </>
          )}

          {grupo === 'Seguimiento' && (
            <>
              <div className="auto-tarjeta">
                <div className="auto-tarjeta-header">
                  <span className="auto-titulo">Cadencia R1–R8</span>
                  <span className="campo-ayuda">
                    {activos} de {pasos.length} pasos activos
                  </span>
                </div>
                <div className="auto-pasos">
                  <span className="auto-th">R</span>
                  <span className="auto-th">Nombre del paso</span>
                  <span className="auto-th auto-der">Espera</span>
                  <span className="auto-th auto-der">Estado</span>
                  {pasos.map((p) => (
                    <PasoFila
                      key={p.paso}
                      clave={p.paso}
                      nombre={p.nombre}
                      canal={CANAL_LEGIBLE[p.canal] ?? p.canal}
                      espera={p.espera_dias}
                      activo={p.activo}
                      onNombre={(v) => cambiarPaso(p.paso, 'nombre', v)}
                      onEspera={(v) => cambiarPaso(p.paso, 'espera_dias', v)}
                      onToggle={() => cambiarPaso(p.paso, 'activo', !p.activo)}
                    />
                  ))}
                </div>
                <span className="auto-nota">
                  El nombre es el de este panel; el texto sale de la plantilla «R{'{n}'} · …» del
                  Repositorio de mensajes.
                </span>
              </div>

              <div className="auto-tarjeta">
                <div className="auto-tarjeta-header">
                  <span className="auto-titulo">Rendimiento por R</span>
                  <span className="campo-ayuda">
                    aceptación R0 {r0?.tasa ?? 0}% · seguimiento R1–R8 {totResp}/{totEnv} ={' '}
                    {porcentaje(totResp, totEnv)}%
                  </span>
                </div>
                <div className="auto-control">
                  <span className="auto-th">R</span>
                  <span className="auto-th auto-der">Toca</span>
                  <span className="auto-th auto-der">Enviados</span>
                  <span className="auto-th auto-der">Respuestas</span>
                  <span className="auto-th">Tasa de conversión</span>
                  {tabla.map((f) => (
                    <ControlFila key={f.paso} fila={f} />
                  ))}
                </div>
                <span className="auto-nota">
                  R0 mide aceptación de la invitación y queda fuera del promedio de seguimiento: son dos
                  tasas que no se comparan, y mezclarlas hace parecer que la cadencia rinde mejor de lo
                  que rinde.
                </span>
              </div>

              <div className="auto-analisis">
                <TarjetaAnalisis
                  titulo="Cuándo responden"
                  filas={analisis.cuando}
                  pie="Por día. La hora de la respuesta no está en los datos: llega con la integración de LinkedIn y WhatsApp."
                />
                <TarjetaAnalisis
                  titulo="Perfiles con más reuniones"
                  filas={analisis.perfiles}
                  pie="reuniones concretadas por cargo"
                />
                <TarjetaAnalisis
                  titulo="Industrias que más convierten"
                  filas={analisis.industrias}
                  pie="de los leads aceptados, cuántos llegaron a una reunión"
                />
              </div>
            </>
          )}
        </div>

        {/* La columna derecha NO cambia con el grupo: es lo que va a pasar hoy,
            y tiene que estar a la vista mientras se tocan los números que lo
            cambian. */}
        <div className="auto-col auto-col-der">
          <div className="auto-tarjeta">
            <div className="auto-tarjeta-header">
              <span className="auto-titulo">Sale hoy por cuenta</span>
              <span className="campo-ayuda">{pausado ? 'todo en pausa' : `${totalHoy} acciones`}</span>
            </div>
            <div className="auto-hoy">
              <span className="auto-th">Cuenta</span>
              <span className="auto-th auto-der">Invit.</span>
              <span className="auto-th auto-der">Segu.</span>
              <span className="auto-th auto-der">Cancel.</span>
              {salidas.map((s) => (
                <SalidaFila key={s.cuenta} {...s} />
              ))}
            </div>
            <span className="auto-nota">
              {frenadas.length
                ? `${frenadas.join(', ')} ${frenadas.length === 1 ? 'está' : 'están'} en cero: la sesión no está activa. Lo que le tocaba se acumula.`
                : 'Todas las cuentas con sesión activa.'}
            </span>
          </div>

          <div className="auto-tarjeta">
            <div className="auto-tarjeta-header">
              <span className="auto-titulo">Métricas semanales por cuenta</span>
              <span className="campo-ayuda">reset: lunes 00:01</span>
            </div>
            <div className="auto-metricas">
              <span className="auto-th">Cuenta</span>
              <span className="auto-th auto-der">Enviadas</span>
              <span className="auto-th auto-der">Aceptadas</span>
              <span className="auto-th auto-der">Conv. sem. ant.</span>
              <span className="auto-th auto-der">Objetivo</span>
              {metricas.map((m) => (
                <MetricaFila key={m.cuenta} {...m} />
              ))}
            </div>
            <span className="auto-nota">
              <b>Aceptadas</b>: invitaciones que el lead aceptó dentro de la semana en curso, contadas por
              fecha de aceptación — pueden venir de invitaciones enviadas semanas antes.{' '}
              <b>Conv. sem. ant.</b>: aceptadas sobre enviadas de la semana ya cerrada.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function ItemLista({
  lista,
  indice,
  estado,
  onMover,
}: {
  lista: ListaInvitacion;
  indice: number;
  estado: string;
  onMover: (d: -1 | 1) => void;
}) {
  const chip = estado === 'agotada' ? 'agotada' : estado === 'en uso' ? 'en uso' : 'en espera';
  return (
    <>
      <span className="auto-orden">
        <button type="button" title="Subir prioridad" onClick={() => onMover(-1)}>
          ▲
        </button>
        <span className={`tabular ${estado === 'en uso' ? 'auto-orden-activo' : ''}`}>{indice + 1}</span>
        <button type="button" title="Bajar prioridad" onClick={() => onMover(1)}>
          ▼
        </button>
      </span>
      <span className="auto-lista-nombre">
        <span>{lista.nombre}</span>
        <span className="campo-ayuda">{NOMBRE_FUENTE[lista.fuente]}</span>
      </span>
      {/* Dato de la automatización: se muestra y no se edita. Moverlo a mano
          re-invitaría a gente ya invitada o saltearía un tramo entero, y ninguna
          de las dos cosas deja rastro hasta semanas después. */}
      <span className="auto-pagina tabular" title="Hasta acá llegó el script — no se edita">
        <b>{lista.pagina}</b>
        <span className="campo-ayuda">/{lista.paginas}</span>
      </span>
      <span className="auto-restantes tabular">{restantes(lista)}</span>
      <span className="auto-der">
        <span className={`auto-chip auto-chip-${chip.replace(' ', '-')}`}>{chip}</span>
      </span>
    </>
  );
}

function NumeroConTexto({
  valor,
  min,
  max,
  texto,
  onCambio,
}: {
  valor: number;
  min: number;
  max: number;
  texto: string;
  onCambio: (v: number) => void;
}) {
  return (
    <div className="auto-numero">
      <input
        type="number"
        min={min}
        max={max}
        value={valor}
        onChange={(e) => onCambio(Number(e.target.value) || min)}
      />
      <span>{texto}</span>
    </div>
  );
}

function RecontactoFila({ cuenta, cuando, n }: { cuenta: string; cuando: string; n: number }) {
  const tono = cuando === 'hoy' ? 'ya' : cuando === 'esta semana' ? 'pronto' : 'lejos';
  return (
    <>
      <span className="auto-cuenta-chico tabular">{cuenta}</span>
      <span className="auto-cuando">{cuando}</span>
      <span className={`auto-recontacto-n tabular auto-tono-${tono}`}>{n}</span>
    </>
  );
}

function PasoFila({
  clave,
  nombre,
  canal,
  espera,
  activo,
  onNombre,
  onEspera,
  onToggle,
}: {
  clave: string;
  nombre: string;
  canal: string;
  espera: number;
  activo: boolean;
  onNombre: (v: string) => void;
  onEspera: (v: number) => void;
  onToggle: () => void;
}) {
  return (
    <>
      <span className={`auto-paso-clave tabular ${activo ? '' : 'auto-apagado'}`}>{clave}</span>
      <span className="auto-paso-nombre">
        <input type="text" value={nombre} onChange={(e) => onNombre(e.target.value)} />
        <span className="campo-ayuda">{canal}</span>
      </span>
      <span className="auto-espera">
        <input
          type="number"
          min={0}
          max={180}
          value={espera}
          onChange={(e) => onEspera(Number.isNaN(parseInt(e.target.value, 10)) ? 0 : parseInt(e.target.value, 10))}
        />
        <span className="campo-ayuda">d</span>
      </span>
      <span className="auto-der">
        <button type="button" className={`auto-estado ${activo ? 'auto-estado-on' : ''}`} onClick={onToggle}>
          {activo ? 'activo' : 'pausado'}
        </button>
      </span>
    </>
  );
}

function ControlFila({ fila }: { fila: ReturnType<typeof rendimientoPorPaso>[number] }) {
  return (
    <>
      <span className="auto-r">{fila.paso}</span>
      <span className="auto-der tabular">{fila.toca}</span>
      <span className="auto-der tabular">{fila.enviados}</span>
      <span className="auto-der tabular">
        {fila.respuestas}
        {fila.esAceptacion ? ' acept.' : ''}
      </span>
      <span className="auto-tasa">
        <Barra ancho={anchoDeTasa(fila.tasa)} tono={colorDeTasa(fila.tasa)} valor={`${fila.tasa}%`} />
        {fila.esAceptacion && (
          <span
            className="auto-chip auto-chip-nota"
            title="En R0 la conversión es la aceptación de la invitación, no una respuesta a un mensaje"
          >
            aceptación
          </span>
        )}
      </span>
    </>
  );
}

function SalidaFila({
  cuenta,
  invitaciones,
  seguimiento,
  cancelaciones,
  frenada,
}: {
  cuenta: string;
  invitaciones: number;
  seguimiento: number;
  cancelaciones: number;
  frenada: boolean;
}) {
  const c = frenada ? 'auto-apagado' : '';
  return (
    <>
      <span className={`auto-cuenta-chico tabular ${c}`}>{cuenta}</span>
      <span className={`auto-der tabular ${c}`}>{invitaciones}</span>
      <span className={`auto-der tabular ${c}`}>{seguimiento}</span>
      <span className={`auto-der tabular ${c}`}>{cancelaciones}</span>
    </>
  );
}

function MetricaFila({
  cuenta,
  enviadas,
  aceptadas,
  conversionAnterior,
  objetivo,
}: {
  cuenta: string;
  enviadas: number;
  aceptadas: number;
  conversionAnterior: number;
  objetivo: number;
}) {
  const tono = conversionAnterior >= 55 ? 'bien' : conversionAnterior >= 35 ? 'normal' : 'flojo';
  return (
    <>
      <span className="auto-cuenta-chico">{cuenta}</span>
      <span className="auto-der tabular">{enviadas}</span>
      <span
        className="auto-der tabular auto-ayuda"
        title={`${aceptadas} aceptadas esta semana, contadas por fecha de aceptación — no por fecha de envío.`}
      >
        {aceptadas}
      </span>
      <span className={`auto-der tabular auto-tono-${tono}`}>{conversionAnterior}%</span>
      <span className="auto-der tabular campo-ayuda">
        {enviadas}/{objetivo}
      </span>
    </>
  );
}

function TarjetaAnalisis({
  titulo,
  filas,
  pie,
}: {
  titulo: string;
  filas: { que: string; valor: string; ancho: number }[];
  pie: string;
}) {
  return (
    <div className="auto-tarjeta">
      <span className="auto-titulo">{titulo}</span>
      {filas.map((f) => (
        <div key={f.que} className="auto-analisis-fila">
          <span className="auto-analisis-que">{f.que}</span>
          <Barra ancho={f.ancho} valor={f.valor} />
        </div>
      ))}
      {!filas.length && <span className="campo-ayuda">Todavía no hay datos.</span>}
      <span className="auto-nota">{pie}</span>
    </div>
  );
}
