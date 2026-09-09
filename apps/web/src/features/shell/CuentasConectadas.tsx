import { useEffect, useMemo, useState } from 'react';
import { pb } from '../../lib/pocketbase';
import { useEscape } from '../../lib/useEscape';
import {
  estadoDeSesion,
  NOMBRE_ESTADO_SESION,
  porQueNingunaSesion,
} from '@crm/core/sesion';

/**
 * Cuentas conectadas (§7.10, §8.2). Portada de
 * `docs/prototipo/SesionesWa.dc.html`.
 *
 * Son DOS listas, LinkedIn y WhatsApp, no una tabla con dos columnas de estado:
 * son dos sesiones distintas, se caen por motivos distintos y se recuperan de
 * maneras distintas — LinkedIn hay que volver a loguearlo, WhatsApp pide un QR.
 *
 * Lo que hace que valga la pena entrar no es el estado: es la CONSECUENCIA. El
 * renglón de abajo dice cuántos envíos quedaron frenados, porque una sesión
 * caída no avisa sola — la cola se acumula en silencio y el lead no recibe
 * nada.
 *
 * Google Calendar va en una TERCERA sección y no como columna de las otras dos,
 * porque no es lo mismo: LinkedIn y WhatsApp son una sesión por cuenta de
 * prospección, y Google es una cuenta por persona del CRM. Ponerlo en la misma
 * tabla obligaría a dejar celdas vacías en las filas que no aplican, que es
 * exactamente cómo se lee mal una pantalla de estado.
 */
interface CuentaRecord {
  id: string;
  abrev: string;
  nombre_perfil: string;
  slot: number;
  estado_sesion: string;
  sesion_wa: string;
  /** Cuándo respondió la sesión por última vez. Lo escribe el worker. */
  ultima_senal_li: string;
  ultima_senal_wa: string;
}

/**
 * Si el proceso que sostiene las sesiones existe.
 *
 * Hoy no: `apps/worker/` está vacío. Está acá y no escondido en un `if` para
 * que el día que exista se cambie en un solo lugar — y para que se vea que la
 * pantalla no lo está adivinando.
 */
const HAY_WORKER = false;

interface EnCola {
  cuenta: string;
  estado: string;
}

/**
 * Lo que contesta `/api/google/estado`.
 *
 * El `refresh_token` NO está acá y no puede estar: es una llave permanente al
 * calendario de la persona y vive en una colección con todas las reglas en
 * `null` (§8.3). El servidor contesta sí o no.
 */
interface EstadoGoogle {
  servidor_listo: boolean;
  conectado: boolean;
  email: string;
  calendario: string;
}

export function CuentasConectadas({
  onCerrar,
  avisoGoogle,
}: {
  onCerrar: () => void;
  /** El resultado de la vuelta de Google, si se acaba de volver de ahí. */
  avisoGoogle?: string | null;
}) {
  useEscape(onCerrar);
  const [cuentas, setCuentas] = useState<CuentaRecord[]>([]);
  const [cola, setCola] = useState<EnCola[]>([]);
  const [cargando, setCargando] = useState(true);
  /** Qué cuenta tiene el QR abierto. `nueva` es vincular otro número. */
  const [qr, setQr] = useState<string | null>(null);

  const [google, setGoogle] = useState<EstadoGoogle | null>(null);
  const [googleFallo, setGoogleFallo] = useState<string | null>(null);
  const [yendoAGoogle, setYendoAGoogle] = useState(false);
  const [confirmarCorte, setConfirmarCorte] = useState(false);
  /** 7.4 · El traído del histórico: puede tardar, así que se avisa mientras. */
  const [trayendo, setTrayendo] = useState(false);
  const [historico, setHistorico] = useState<string | null>(null);
  /** Reuniones futuras que todavía no llegaron al calendario. La consecuencia. */
  const [sinSincronizar, setSinSincronizar] = useState(0);

  useEffect(() => {
    let vivo = true;
    Promise.all([
      pb.collection('cuenta').getFullList<CuentaRecord>({ sort: 'slot' }),
      pb
        .collection('cola')
        .getFullList<EnCola>({ filter: 'estado = "pendiente"', fields: 'cuenta,estado' })
        .catch(() => [] as EnCola[]),
      pb.send<EstadoGoogle>('/api/google/estado', {}).catch(() => null),
      // Las que ya pasaron no cuentan: nadie las va a escribir en el calendario
      // y no hay nada que hacer al respecto.
      pb
        .collection('reunion')
        .getList(1, 1, {
          filter: `inicio > "${new Date().toISOString().slice(0, 19).replace('T', ' ')}" && sync != "ok"`,
          fields: 'id',
        })
        .then((r) => r.totalItems)
        .catch(() => 0),
    ])
      .then(([cs, q, g, pendientesDeCalendar]) => {
        if (!vivo) return;
        setCuentas(cs);
        setCola(q);
        setGoogle(g);
        setSinSincronizar(pendientesDeCalendar);
        setCargando(false);
      })
      .catch(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, []);

  /**
   * Empezar la vuelta de OAuth.
   *
   * El servidor arma la URL —él tiene el client_id— y acá solo se navega. La
   * pantalla no conoce ningún dato de la aplicación de Google.
   */
  async function conectarGoogle() {
    setYendoAGoogle(true);
    setGoogleFallo(null);
    try {
      const r = await pb.send<{ listo: boolean; url?: string; motivo?: string }>(
        '/api/google/inicio',
        {},
      );
      if (r.listo && r.url) {
        window.location.href = r.url;
        return;
      }
      setGoogleFallo(r.motivo ?? 'El servidor no pudo empezar la conexión.');
    } catch (err) {
      setGoogleFallo(err instanceof Error ? err.message : 'No se pudo hablar con el servidor.');
    }
    setYendoAGoogle(false);
  }

  /**
   * 7.3 y 7.4 · Trae el calendario hacia atrás, una sola vez.
   *
   * La agenda dibujaba sólo las reuniones con leads, así que un jueves con un
   * almuerzo a las 12 se veía libre. Esto trae todo lo demás —unos 400 días
   * para atrás— y a partir de ahí el reloj de cada cinco minutos lo mantiene.
   *
   * Es un botón y no algo automático porque son hasta 15000 eventos paginados:
   * conviene que alguien lo dispare sabiendo que va a tardar, y no que pase
   * solo al abrir una pantalla.
   */
  async function traerHistorico() {
    setTrayendo(true);
    setHistorico(null);
    setGoogleFallo(null);
    try {
      const r = await pb.send<{ ok?: boolean; vistos?: number; error?: string }>(
        '/api/google/historico',
        { method: 'POST', body: {} },
      );
      setHistorico(
        r?.ok
          ? `Listo: ${r.vistos ?? 0} eventos revisados. Ya se ven en la agenda.`
          : (r?.error ?? 'No se pudo traer el histórico.'),
      );
    } catch (err) {
      setGoogleFallo(err instanceof Error ? err.message : 'No se pudo traer el histórico.');
    } finally {
      setTrayendo(false);
    }
  }

  async function desconectarGoogle() {
    setGoogleFallo(null);
    try {
      await pb.send('/api/google/desconectar', { method: 'POST' });
      setGoogle((g) => (g ? { ...g, conectado: false, email: '' } : g));
      setConfirmarCorte(false);
    } catch (err) {
      setGoogleFallo(err instanceof Error ? err.message : 'No se pudo desconectar.');
    }
  }

  /** Cuántos envíos espera cada cuenta. */
  const pendientes = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of cola) m.set(c.cuenta, (m.get(c.cuenta) ?? 0) + 1);
    return m;
  }, [cola]);

  // El estado sale de la SEÑAL, no del campo que alguien escribió una vez. Los
  // valores del seed decían «activa» en cinco cuentas sin que hubiera una sola
  // sesión detrás; con la señal vacía, todas dicen «sin vincular», que es la
  // verdad hasta que el worker exista.
  const estadoLi = useMemo(
    () => new Map(cuentas.map((c) => [c.id, estadoDeSesion(c.ultima_senal_li)])),
    [cuentas],
  );
  const estadoWa = useMemo(
    () => new Map(cuentas.map((c) => [c.id, estadoDeSesion(c.ultima_senal_wa)])),
    [cuentas],
  );

  const activasLi = [...estadoLi.values()].filter((e) => e === 'activa').length;
  const activasWa = [...estadoWa.values()].filter((e) => e === 'activa').length;
  const explicacion = porQueNingunaSesion(HAY_WORKER, cuentas.length);

  /**
   * Los envíos que están esperando a que vuelva una sesión.
   *
   * Sólo cuentan los de las cuentas CAÍDAS: la cola de una cuenta sana no está
   * frenada, está esperando su turno, que es otra cosa.
   */
  const frenados = cuentas
    .filter((c) => estadoLi.get(c.id) !== 'activa' || estadoWa.get(c.id) !== 'activa')
    .reduce((a, c) => a + (pendientes.get(c.id) ?? 0), 0);

  return (
    <div className="overlay-fondo" onClick={onCerrar}>
      <div className="overlay-caja overlay-cuentas" onClick={(e) => e.stopPropagation()}>
        <header className="overlay-header">
          <span className="overlay-titulo">Cuentas conectadas</span>
          <span className="campo-ayuda tabular">
            {cargando
              ? 'leyendo…'
              : `${activasLi} LinkedIn · ${activasWa}/${cuentas.length} WhatsApp`}
          </span>
          <div className="barra" />
          <button type="button" className="boton-icono-26" title="Cerrar" onClick={onCerrar}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        <div className="cc-cuerpo">
          {explicacion && <div className="cc-aviso">{explicacion}</div>}

          <div className="cc-seccion">
            <span className="campo-label">LinkedIn</span>
          </div>
          {cuentas.map((c) => {
            const estado = estadoLi.get(c.id) ?? 'sin_vincular';
            const viva = estado === 'activa';
            return (
              <div key={`li-${c.id}`} className="cc-fila">
                <span className="pastilla">{c.abrev}</span>
                <span className="cc-perfil">{c.nombre_perfil || 'sin nombre cargado'}</span>
                <span className={viva ? 'cc-estado cc-ok' : 'cc-estado cc-mal'}>
                  <span className={viva ? 'cc-punto cc-punto-ok' : 'cc-punto cc-punto-mal'} />
                  {NOMBRE_ESTADO_SESION[estado]}
                </span>
                {/* La sesión de LinkedIn no se recupera con un QR: hay que
                    volver a loguearla desde el worker. Por eso acá no hay
                    botón, y decirlo es mejor que poner uno que no haga nada. */}
                <span className="cc-detalle">
                  {viva ? '' : `${pendientes.get(c.id) ?? 0} en cola esperando`}
                </span>
              </div>
            );
          })}

          <div className="cc-seccion">
            <span className="campo-label">WhatsApp</span>
            <span className="campo-ayuda">Baileys</span>
            <button
              type="button"
              className="boton-mini al-final"
              onClick={() => setQr('un número nuevo')}
            >
              Vincular otro número
            </button>
          </div>
          {cuentas.map((c) => {
            const estado = estadoWa.get(c.id) ?? 'sin_vincular';
            const viva = estado === 'activa';
            const espera = pendientes.get(c.id) ?? 0;
            return (
              <div key={`wa-${c.id}`} className="cc-fila">
                <span className="pastilla">{c.abrev}</span>
                <span className="cc-perfil">{c.nombre_perfil || 'sin nombre cargado'}</span>
                <span className={viva ? 'cc-estado cc-ok' : 'cc-estado cc-mal'}>
                  <span className={viva ? 'cc-punto cc-punto-ok' : 'cc-punto cc-punto-mal'} />
                  {viva ? 'conectada' : NOMBRE_ESTADO_SESION[estado]}
                </span>
                <span className="cc-detalle">
                  {viva ? '' : `${espera} ${espera === 1 ? 'frenado' : 'frenados'}`}
                </span>
                <button
                  type="button"
                  className={viva ? 'boton-mini' : 'boton-principal'}
                  title={viva ? 'Volver a vincular este número' : 'Vincular este número'}
                  onClick={() => setQr(c.abrev)}
                >
                  {viva ? 'QR' : 'Vincular'}
                </button>
              </div>
            );
          })}

          {/* --------------------------------------------------- Google */}
          <div className="cc-seccion">
            <span className="campo-label">Google Calendar</span>
            <span className="campo-ayuda">una cuenta por persona, no por slot</span>
          </div>

          <div className="cc-fila">
            <span className="pastilla">cal</span>
            <span className="cc-perfil">
              {google?.conectado
                ? google.email || 'conectada'
                : google?.servidor_listo === false
                  ? 'el servidor todavía no tiene las credenciales'
                  : 'tu calendario'}
            </span>
            <span className={google?.conectado ? 'cc-estado cc-ok' : 'cc-estado cc-mal'}>
              <span className={google?.conectado ? 'cc-punto cc-punto-ok' : 'cc-punto cc-punto-mal'} />
              {!google
                ? cargando
                  ? 'leyendo…'
                  : 'sin respuesta'
                : google.conectado
                  ? 'conectada'
                  : google.servidor_listo
                    ? 'sin conectar'
                    : 'sin configurar'}
            </span>
            <span className="cc-detalle">
              {google?.conectado
                ? google.calendario && google.calendario !== 'primary'
                  ? google.calendario
                  : ''
                : sinSincronizar
                  ? `${sinSincronizar} ${sinSincronizar === 1 ? 'reunión futura' : 'reuniones futuras'} sin escribir`
                  : ''}
            </span>

            {/* Sin credenciales en el servidor el botón no puede hacer nada:
                en vez de uno que falla, se dice qué falta. */}
            {google && !google.servidor_listo && (
              <span className="campo-ayuda">falta configurarlo en el servidor</span>
            )}
            {google?.servidor_listo && !google.conectado && (
              <button
                type="button"
                className="boton-principal"
                disabled={yendoAGoogle}
                title="Te lleva a Google a dar el permiso y volvés acá"
                onClick={() => void conectarGoogle()}
              >
                {yendoAGoogle ? 'yendo…' : 'Conectar'}
              </button>
            )}
            {/* 7.4 · El histórico. Sólo cuando está conectada: sin cuenta no
                hay de dónde traerlo. */}
            {google?.conectado && !confirmarCorte && (
              <button
                type="button"
                className="boton-mini"
                disabled={trayendo}
                title="Traer los eventos del calendario de los últimos ~400 días, para que la agenda muestre el día completo y no sólo las reuniones del CRM"
                onClick={() => void traerHistorico()}
              >
                {trayendo ? 'trayendo…' : 'Traer el histórico'}
              </button>
            )}

            {google?.conectado &&
              (confirmarCorte ? (
                <>
                  <button
                    type="button"
                    className="boton-mini-peligro"
                    onClick={() => void desconectarGoogle()}
                  >
                    Sí, desconectar
                  </button>
                  <button
                    type="button"
                    className="boton-mini"
                    onClick={() => setConfirmarCorte(false)}
                  >
                    Cancelar
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="boton-mini"
                  title="Deja de escribir en tu calendario. Los eventos ya creados quedan donde están."
                  onClick={() => setConfirmarCorte(true)}
                >
                  Desconectar
                </button>
              ))}
          </div>

          {(googleFallo || avisoGoogle || historico) && (
            <div className="cc-fila cc-nota">
              <span className={googleFallo ? 'cc-estado cc-mal' : 'cc-estado cc-ok'}>
                {googleFallo ??
                  historico ??
                  (avisoGoogle === 'conectado' ? 'Calendario conectado.' : avisoGoogle)}
              </span>
            </div>
          )}

          {qr && (
            <div className="cc-qr-panel">
              <span className="campo-label">Vincular {qr}</span>
              <div className="cc-qr-caja">
                {/* CLAUDE.md regla 6: lo que no se puede construir todavía se
                    omite y se anota; no se inventa. El código lo emite la
                    sesión de Baileys, que vive en el worker. */}
                <span>
                  el QR aparece acá
                  <br />
                  al conectar Baileys
                </span>
              </div>
              <span className="campo-ayuda">
                Escaneá desde WhatsApp &gt; Dispositivos vinculados. La cola de esa cuenta arranca
                sola al reconectar.
              </span>
              <button type="button" className="boton-mini" onClick={() => setQr(null)}>
                Cerrar
              </button>
            </div>
          )}

          {!cargando && !cuentas.length && <div className="cc-vacio">No hay cuentas cargadas.</div>}
        </div>

        <footer className="overlay-pie">
          <span className={frenados ? 'cc-resumen cc-resumen-alerta' : 'cc-resumen'}>
            {cargando
              ? ''
              : frenados
                ? `${frenados} envíos frenados por sesiones caídas. Mientras la sesión no vuelva, la cola se acumula sin avisar al lead.`
                : google && !google.conectado
                  ? 'Sin Google conectado, las reuniones que agendes quedan sólo en el CRM: no llega invitación ni aparecen en tu calendario.'
                  : 'Todas las sesiones activas: la cola sale según lo programado.'}
          </span>
        </footer>
      </div>
    </div>
  );
}
