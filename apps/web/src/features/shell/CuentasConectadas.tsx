import { useEffect, useMemo, useRef, useState } from 'react';
import { pb } from '../../lib/pocketbase';
import { useEscape } from '../../lib/useEscape';
import {
  estadoDeSesion,
  NOMBRE_ESTADO_SESION,
  porQueNingunaSesion,
} from '@crm/core/sesion';
import { comoSeVeLaSesionWa, comoVaElVinculo, numeroTapado } from '@crm/core/whatsapp';
import { CodigoQr } from './CodigoQr';

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
  /** El QR que emitió Baileys, y cuándo. Los escribe el worker (§8.2). */
  qr_wa?: string;
  qr_wa_desde?: string;
  /** Por qué no está viva, y con qué número quedó vinculada. */
  wa_motivo?: string;
  wa_numero?: string;
  /** Si esta cuenta usa WhatsApp. Hoy una sola de las nueve (§8.2). */
  wa_habilitado?: boolean;
}

/**
 * Si el proceso que sostiene las sesiones existe.
 *
 * **Desde el 10/09 existe**: `apps/worker/` sabe vincular LinkedIn, medir las
 * listas, invitar y vincular WhatsApp. Estuvo en `false` todo el tiempo que la
 * carpeta estuvo vacía, y estaba acá arriba —y no escondido en un `if`— para
 * que el día que existiera se cambiara en un solo lugar.
 *
 * Que exista NO quiere decir que esté corriendo. Eso lo dice la señal de cada
 * cuenta, que es otra cosa y se mira por separado.
 */
const HAY_WORKER = true;

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
interface CuentaGoogle {
  id: string;
  email: string;
  principal: boolean;
  conectada: boolean;
  calendario: string;
}

interface EstadoGoogle {
  servidor_listo: boolean;
  conectado: boolean;
  email: string;
  calendario: string;
  /** Todas las conectadas. La del calendario es la que tiene `principal`. */
  cuentas?: CuentaGoogle[];
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
  /** Qué cuenta tiene el panel del QR abierto. */
  const [qr, setQr] = useState<string | null>(null);
  /**
   * Cuándo se apretó «Vincular», en esta pantalla y en este momento.
   *
   * NO va a la base a propósito: es de esta pestaña. Guardarlo haría que una
   * pestaña abierta desde ayer contara como un pedido recién hecho, y la
   * pantalla diría «prendiendo la sesión» sobre un proceso que no existe.
   */
  const [pedidoEn, setPedidoEn] = useState<string | null>(null);
  const [errorWa, setErrorWa] = useState<string | null>(null);
  /**
   * Lo último que dijo el worker.
   *
   * El proceso lo lanza PocketBase, que **descarta su salida**: si se muere al
   * arrancar, el servidor contesta 200 —porque lanzarlo salió bien— y acá no
   * pasa nada. Eso es indistinguible de un botón roto, y es lo que Augusto
   * reportó dos veces el 11/09. El worker deja un diario y acá se muestra.
   */
  const [diario, setDiario] = useState<string>('');
  const [eligiendoCuenta, setEligiendoCuenta] = useState(false);
  /**
   * Qué cuenta está por desvincularse, esperando confirmación.
   *
   * Se pregunta porque desvincular **no se deshace apretando de nuevo**: hay
   * que tener el teléfono a mano para escanear otro QR. No es como cerrar un
   * panel.
   */
  const [confirmarBaja, setConfirmarBaja] = useState<string | null>(null);

  /**
   * Pedir la baja. Lo ejecuta el worker, no esta pantalla.
   *
   * El navegador no puede hablarle a WhatsApp ni al proceso que sostiene la
   * sesión. Escribe el pedido en la cuenta y el worker —que está escuchando esa
   * fila— hace el `logout` de verdad, que es lo que saca el dispositivo también
   * del teléfono.
   */
  async function desvincular(abrev: string) {
    const c = cuentas.find((x) => x.abrev === abrev);
    if (!c) return;
    setErrorWa(null);
    setConfirmarBaja(null);
    try {
      await pb.collection('cuenta').update(c.id, { wa_motivo: 'desvincular' });
      setQr(null);
    } catch (err) {
      setErrorWa(err instanceof Error ? err.message : 'No se pudo pedir la baja.');
    }
  }
  /** Para llevar la vista al panel: con Google abajo, el QR quedaba fuera de cuadro. */
  const panelQr = useRef<HTMLDivElement | null>(null);
  /**
   * Un reloj de un segundo, sólo mientras el panel está abierto.
   *
   * El estado del vínculo depende del TIEMPO —el QR vigente vence al minuto, el
   * pedido deja de contar a los 25 segundos— y sin esto la pantalla se queda
   * congelada en el último valor que calculó. Es un segundo y sólo cuando hay
   * un panel abierto: no hay nada que recalcular con el panel cerrado.
   */
  const [tic, setTic] = useState(0);
  useEffect(() => {
    if (!qr) return;
    const t = setInterval(() => setTic((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [qr]);

  /**
   * Mientras el panel está abierto, se PREGUNTA por la cuenta. No se espera.
   *
   * Arriba hay una suscripción en vivo y está bien: cuando anda, el QR aparece
   * solo. Pero se apoya en una conexión abierta contra PocketBase, y esa
   * conexión se corta sin avisar — el servidor se reinicia, la pestaña estuvo
   * dormida, la red parpadeó. Cuando eso pasa la pantalla se queda esperando un
   * cambio que ya ocurrió.
   *
   * El 11/09 pasó tres veces seguidas: el QR estaba escrito en la base,
   * fresco, y la pantalla seguía diciendo «prendiendo la sesión». Desde el otro
   * lado eso es indistinguible de un worker que no arrancó.
   *
   * Cada tres segundos y SÓLO con el panel abierto: es una fila por su id
   * contra una base que casi siempre está en la misma máquina, y dura lo que
   * dura escanear un código. La suscripción sigue siendo el camino rápido;
   * esto es el que no se puede romper en silencio.
   */
  useEffect(() => {
    if (!qr) return;
    let vivo = true;
    const mirar = async () => {
      const c = cuentas.find((x) => x.abrev === qr);
      if (!c) return;
      try {
        const fresca = await pb.collection('cuenta').getOne<CuentaRecord>(c.id);
        if (!vivo) return;
        setCuentas((antes) => antes.map((x) => (x.id === fresca.id ? { ...x, ...fresca } : x)));
      } catch {
        // La base puede estar reiniciándose. Se vuelve a mirar en tres segundos.
      }
    };
    void mirar();
    const t = setInterval(() => void mirar(), 3000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qr]);

  /**
   * Llevar la vista al panel cuando se abre.
   *
   * El panel se dibuja al final del cuerpo, debajo de LinkedIn y de Google. Con
   * nueve cuentas arriba quedaba **fuera de cuadro**: se apretaba «Vincular»,
   * pasaba algo nueve filas más abajo, y desde donde estaba el dedo eso se ve
   * igual que un botón que no hace nada.
   */
  useEffect(() => {
    if (!qr) return;
    panelQr.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [qr]);

  /**
   * Si a los 8 segundos de pedirlo no hay código, el worker tiene algo que
   * decir. Una sola vez y no en bucle: es para explicar una falla, no para
   * vigilar un proceso sano.
   */
  useEffect(() => {
    if (!qr || !pedidoEn) return;
    const t = setTimeout(() => void leerDiario(qr), 8000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qr, pedidoEn]);

  const [google, setGoogle] = useState<EstadoGoogle | null>(null);
  const [googleFallo, setGoogleFallo] = useState<string | null>(null);
  const [yendoAGoogle, setYendoAGoogle] = useState(false);
  const [confirmarCorte, setConfirmarCorte] = useState(false);
  /** 7.4 · El traído del histórico: puede tardar, así que se avisa mientras. */
  const [trayendo, setTrayendo] = useState(false);
  const [historico, setHistorico] = useState<string | null>(null);
  /**
   * Ya no hay botón de agenda: se trae al conectar la cuenta.
   *
   * Estuvo como botón y estaba mal pensado, igual que el del histórico:
   * conectar una cuenta y que los chats sigan mostrando números hasta acordarse
   * de apretar otra cosa es pedirle a la persona que sepa cómo funciona esto
   * por dentro. Conectar una cuenta de Google ES pedir que se usen sus
   * contactos. El resultado llega en el aviso de la vuelta (`avisoGoogle`).
   */
  const agenda: string | null = null;
  /** Reuniones futuras que todavía no llegaron al calendario. La consecuencia. */
  const [sinSincronizar, setSinSincronizar] = useState(0);

  /**
   * El QR llega SOLO, sin recargar.
   *
   * Baileys rota el código cada menos de un minuto y lo escribe en la cuenta.
   * Sin esto habría que apretar F5 justo en la ventana buena — que es la peor
   * forma posible de escanear algo que caduca. PocketBase avisa de cada cambio
   * en `cuenta`; se actualiza sólo la fila que cambió.
   *
   * Si la suscripción no se puede abrir, la pantalla sigue andando con lo que
   * cargó: es un canal de actualización, no la fuente.
   */
  useEffect(() => {
    let vivo = true;
    const prometida = pb
      .collection('cuenta')
      .subscribe<CuentaRecord>('*', (e) => {
        if (!vivo || !e.record) return;
        setCuentas((antes) => antes.map((c) => (c.id === e.record.id ? { ...c, ...e.record } : c)));
      })
      .catch(() => undefined);

    return () => {
      vivo = false;
      void prometida.then(() => pb.collection('cuenta').unsubscribe('*')).catch(() => undefined);
    };
  }, []);

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
  /**
   * @param nueva Conectar OTRA cuenta en vez de reemplazar la que hay.
   *   La primera es la del calendario; las demás se conectan para leer —hoy, la
   *   agenda de contactos—. Cambiar en qué calendario se escriben las reuniones
   *   es otra decisión y no puede ser el efecto secundario de esto.
   */
  async function conectarGoogle(nueva = false) {
    setYendoAGoogle(true);
    setGoogleFallo(null);
    try {
      const r = await pb.send<{ listo: boolean; url?: string; motivo?: string }>(
        `/api/google/inicio${nueva ? '?nueva=1' : ''}`,
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

  /**
   * Abrir el panel del QR **y prender la sesión**.
   *
   * Las dos cosas juntas, porque separadas es lo que estaba mal: el panel se
   * abría solo y esperaba un código que nadie estaba emitiendo. El QR no lo
   * puede generar el navegador —lo emite Baileys, del lado del worker— así que
   * abrir el panel sin prender nada es abrir una sala de espera vacía.
   *
   * Si el servidor contesta 404 es que el worker no está al lado (el CRM
   * publicado en el VPS, por ejemplo). Ahí no se inventa nada: se dice que hay
   * que correr el comando a mano, que sigue funcionando igual.
   */
  /** Trae el diario del worker. Silencioso: es información de apoyo. */
  async function leerDiario(abrev: string) {
    try {
      const r = await pb.send<{ hay?: boolean; texto?: string }>(
        `/api/wa/diario?abrev=${encodeURIComponent(abrev)}`,
        {},
      );
      setDiario(r?.hay ? String(r.texto ?? '') : '');
    } catch {
      setDiario('');
    }
  }

  async function abrirVinculo(abrev: string) {
    setQr(abrev);
    setErrorWa(null);
    setDiario('');
    setEligiendoCuenta(false);
    try {
      const r = await pb.send<{ ok?: boolean; ya_estaba?: boolean; error?: string }>(
        '/api/wa/vincular',
        { method: 'POST', body: { abrev } },
      );
      if (r?.ok) {
        // SIEMPRE, incluso si ya estaba corriendo. `pedidoEn` es «lo pediste
        // recién», no «se lanzó un proceso»: sin esto, apretar Vincular sobre
        // una sesión ya prendida dejaba el panel mostrando el estado viejo y
        // parecía que no hacía nada. Augusto: «cuando quiero tocar vincular
        // nuevamente no me aparece el QR, tengo que cerrar todo y abrirlo».
        setPedidoEn(new Date().toISOString());
        return;
      }
      setErrorWa(r?.error ?? 'El servidor no pudo prender la sesión.');
    } catch (err) {
      const status = (err as { status?: number })?.status;
      setErrorWa(
        status === 404
          ? 'Este CRM no tiene el worker al lado, así que no puede prender la sesión solo. ' +
              'Corré en una terminal: node apps/worker/src/whatsapp.ts vincular ' +
              abrev +
              ' — el código aparece acá igual.'
          : err instanceof Error
            ? err.message
            : 'No se pudo hablar con el servidor.',
      );
    }
  }

  /** Sumar una cuenta a WhatsApp. Es un dato de la cuenta, no de esta pantalla. */
  async function habilitarWhatsapp(c: CuentaRecord) {
    setErrorWa(null);
    try {
      await pb.collection('cuenta').update(c.id, { wa_habilitado: true });
      setCuentas((cs) => cs.map((x) => (x.id === c.id ? { ...x, wa_habilitado: true } : x)));
      setEligiendoCuenta(false);
      await abrirVinculo(c.abrev);
    } catch (err) {
      setErrorWa(err instanceof Error ? err.message : 'No se pudo habilitar la cuenta.');
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

  /** Las que usan WhatsApp, y las que podrían sumarse. */
  const conWhatsapp = useMemo(() => cuentas.filter((c) => c.wa_habilitado), [cuentas]);
  const sinWhatsapp = useMemo(() => cuentas.filter((c) => !c.wa_habilitado), [cuentas]);

  const activasLi = [...estadoLi.values()].filter((e) => e === 'activa').length;
  const activasWa = conWhatsapp.filter((c) => estadoWa.get(c.id) === 'activa').length;
  const explicacion = porQueNingunaSesion(HAY_WORKER, cuentas.length);

  /**
   * Los envíos que están esperando a que vuelva una sesión.
   *
   * Sólo cuentan los de las cuentas CAÍDAS: la cola de una cuenta sana no está
   * frenada, está esperando su turno, que es otra cosa.
   */
  const frenados = cuentas
    .filter(
      (c) =>
        estadoLi.get(c.id) !== 'activa' ||
        // WhatsApp sólo frena a las cuentas que lo usan: una cuenta sin
        // WhatsApp no tiene nada esperando por ese lado.
        (c.wa_habilitado && estadoWa.get(c.id) !== 'activa'),
    )
    .reduce((a, c) => a + (pendientes.get(c.id) ?? 0), 0);

  return (
    <div className="overlay-fondo" onClick={onCerrar}>
      <div className="overlay-caja overlay-cuentas" onClick={(e) => e.stopPropagation()}>
        <header className="overlay-header">
          <span className="overlay-titulo">Cuentas conectadas</span>
          <span className="campo-ayuda tabular">
            {cargando
              ? 'leyendo…'
              : `${activasLi}/${cuentas.length} LinkedIn · ${activasWa}/${conWhatsapp.length} WhatsApp`}
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

          {/* --------------------------------------------------- WhatsApp

              UNA FILA, NO NUEVE. Antes esta sección dibujaba una fila por
              cuenta, cada una con su «Vincular», y las nueve en rojo. Eso decía
              que hay nueve sesiones de WhatsApp pendientes, y no es cierto:
              Augusto lo aclaró el 11/09 —«el resto no tiene cuentas de
              WhatsApp, mi cuenta de WhatsApp es la única que voy a utilizar».
              Ocho filas que nunca se van a poner verdes tapan la única que
              importa. Cuál cuenta usa WhatsApp es un dato de la cuenta
              (`wa_habilitado`), no algo escrito acá. */}
          <div className="cc-seccion">
            <span className="campo-label">WhatsApp</span>
            <span className="campo-ayuda">Baileys</span>
            {sinWhatsapp.length > 0 && (
              <button
                type="button"
                className="boton-mini al-final"
                title="Sumar otra cuenta a WhatsApp"
                onClick={() => setEligiendoCuenta((v) => !v)}
              >
                Vincular otro número
              </button>
            )}
          </div>

          {eligiendoCuenta && (
            <div className="cc-fila cc-nota">
              <span className="campo-ayuda">¿De qué cuenta?</span>
              {sinWhatsapp.map((c) => (
                <button
                  key={`sumar-${c.id}`}
                  type="button"
                  className="boton-mini"
                  onClick={() => void habilitarWhatsapp(c)}
                >
                  {c.abrev}
                </button>
              ))}
            </div>
          )}

          {conWhatsapp.length === 0 && (
            <div className="cc-fila cc-nota">
              <span className="cc-estado">
                Ninguna cuenta usa WhatsApp todavía. Se suma con «Vincular otro número».
              </span>
            </div>
          )}

          {conWhatsapp.map((c) => {
            const estado = estadoWa.get(c.id) ?? 'sin_vincular';
            const viva = estado === 'activa';
            const espera = pendientes.get(c.id) ?? 0;
            return (
              <div key={`wa-${c.id}`} className="cc-fila">
                <span className="pastilla">{c.abrev}</span>
                <span className="cc-perfil">
                  {c.wa_numero ? numeroTapado(c.wa_numero) : c.nombre_perfil || 'sin nombre cargado'}
                </span>
                <span className={viva ? 'cc-estado cc-ok' : 'cc-estado cc-mal'}>
                  <span className={viva ? 'cc-punto cc-punto-ok' : 'cc-punto cc-punto-mal'} />
                  {viva ? 'conectada' : NOMBRE_ESTADO_SESION[estado]}
                </span>
                <span className="cc-detalle">
                  {viva ? '' : espera ? `${espera} ${espera === 1 ? 'frenado' : 'frenados'}` : ''}
                </span>
                {/* La confirmación va EN LA MISMA FILA, reemplazando a los
                    botones, igual que la de Google unas líneas más abajo. La
                    versión anterior abría un bloque aparte a todo lo ancho:
                    quedaba un botón gigante y el texto suelto arriba. Cuando ya
                    hay un patrón para «confirmar algo que no se deshace», se
                    usa ese — dos formas distintas de preguntar lo mismo en una
                    pantalla es lo que la vuelve difícil de leer. */}
                {viva && confirmarBaja === c.abrev ? (
                  <>
                    <button
                      type="button"
                      className="boton-mini-peligro"
                      title="Cierra la sesión y saca el dispositivo del teléfono. Para volver hay que escanear un QR nuevo."
                      onClick={() => void desvincular(c.abrev)}
                    >
                      Sí, desvincular
                    </button>
                    <button
                      type="button"
                      className="boton-mini"
                      onClick={() => setConfirmarBaja(null)}
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <>
                    {/* Sólo con la sesión viva: sobre una caída no hay nada que
                        dar de baja, y un botón que no hace nada es peor que no
                        tenerlo. */}
                    {viva && (
                      <button
                        type="button"
                        className="boton-mini"
                        title="Cerrar la sesión y sacar el dispositivo del teléfono"
                        onClick={() => setConfirmarBaja(c.abrev)}
                      >
                        Desvincular
                      </button>
                    )}
                    <button
                      type="button"
                      className={viva ? 'boton-mini' : 'boton-principal'}
                      title={viva ? 'Volver a vincular este número' : 'Vincular este número'}
                      onClick={() => void abrirVinculo(c.abrev)}
                    >
                      {viva ? 'QR' : 'Vincular'}
                    </button>
                  </>
                )}
              </div>
            );
          })}

          {/* --------------------------------------------------- Google

              GOOGLE, a secas. La misma conexión trae el calendario Y la agenda
              de contactos, así que el título que nombra una sola de las dos
              hace buscar la otra en otro lado.

              El «+» va ACÁ, en el encabezado, y no en la fila de una cuenta:
              conectar otra no es una acción SOBRE la que ya está. Es el mismo
              lugar donde WhatsApp tiene «Vincular otro número». */}
          <div className="cc-seccion">
            <span className="campo-label">Google</span>
            <span className="campo-ayuda">calendario y agenda de contactos</span>
            {google?.servidor_listo && google?.conectado && !confirmarCorte && (
              <button
                type="button"
                className="boton-mini al-final"
                disabled={yendoAGoogle}
                title="Conectar otra cuenta de Google. Se lee también su agenda de contactos; el calendario donde se escriben las reuniones no cambia."
                onClick={() => void conectarGoogle(true)}
              >
                + Otra cuenta
              </button>
            )}
          </div>

          {/* Las cuentas de LEER: las que no son la del calendario. Cada una en
              su fila, como LinkedIn y WhatsApp — sin esto Augusto conectó una
              segunda y no la veía por ningún lado. */}
          {(google?.cuentas ?? [])
            .filter((c) => !c.principal && c.conectada)
            .map((c) => (
              <div key={c.id} className="cc-fila cc-fila-google">
                <span className="pastilla">ag</span>
                <span className="cc-perfil">{c.email || 'sin correo'}</span>
                <span className="cc-estado cc-ok">
                  <span className="cc-punto cc-punto-ok" />
                  conectada
                </span>
                <span className="cc-acciones">
                  <span className="campo-ayuda">sólo agenda</span>
                </span>
              </div>
            ))}

          <div className="cc-fila cc-fila-google">
            <span className="pastilla">cal</span>
            <span className="cc-perfil">
              {google?.conectado
                ? google.email || 'cuenta de Google'
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

            {/* TODOS LOS BOTONES EN UNA CAJA PROPIA.
                `.cc-fila` es una grilla de cinco columnas fijas —pastilla,
                nombre, estado, detalle, botón— y acá hay cuatro botones
                metiéndose en la última. El 11/09 se veían superpuestos y con el
                texto cortado («Conectar otra cuent»). Van en un flex que
                envuelve: la grilla les da una celda, y ellos se acomodan
                adentro. */}
            <span className="cc-acciones">

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
            {/* EL HISTORICO SOLO APARECE SI FALLO.
                Augusto, 11/09: *«traer histórico debería desaparecer, porque
                automáticamente cuando se conecta siempre tiene que traer el
                histórico»*. Tiene razón, y ya era así: la vuelta de Google lo
                trae sola. El botón sobraba en el 99% de los casos y ocupaba el
                lugar del que sí hace falta.
                Queda para el 1%: si esa vez falló —Google lento, demasiados
                eventos— la conexión igual quedó guardada, y sin este botón la
                única salida sería desconectar y volver a conectar. */}
            {google?.conectado && !confirmarCorte && Boolean(sinSincronizar) && (
              <button
                type="button"
                className="boton-mini"
                disabled={trayendo}
                title="Volver a traer los eventos del calendario. Al conectar se traen solos; esto es para reintentar si esa vez falló."
                onClick={() => void traerHistorico()}
              >
                {trayendo ? 'trayendo…' : 'Reintentar el histórico'}
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
            </span>
          </div>

          {(googleFallo || avisoGoogle || historico || agenda) && (
            <div className="cc-fila cc-nota">
              <span className={googleFallo ? 'cc-estado cc-mal' : 'cc-estado cc-ok'}>
                {googleFallo ??
                  agenda ??
                  historico ??
                  (avisoGoogle === 'conectado' ? 'Calendario conectado.' : avisoGoogle)}
              </span>
            </div>
          )}

          {qr && (() => {
            // La cuenta que se está vinculando, y lo que core dice de ella.
            // `tic` no se usa acá: está para que este bloque se recalcule cada
            // segundo, porque todo lo de abajo depende de la hora.
            void tic;
            const suya = cuentas.find((c) => c.abrev === qr) ?? null;
            const lectura = suya ? comoSeVeLaSesionWa(suya) : null;
            const vigente = Boolean(lectura?.qr_vigente && suya?.qr_wa);
            // En qué punto va el vínculo. La diferencia que importa es entre
            // «esperá, ya viene» y «no hay ningún proceso del otro lado».
            const paso = suya ? comoVaElVinculo(suya, pedidoEn) : null;

            return (
              <div className="cc-qr-panel" ref={panelQr}>
                <span className="campo-label">Vincular {qr}</span>

                <div className="cc-qr-caja">
                  {vigente ? (
                    <CodigoQr texto={String(suya?.qr_wa ?? '')} />
                  ) : (
                    /* NO SE DIBUJA UN QR VENCIDO. Un código caducado a la vista
                       es peor que ninguno: se escanea, no pasa nada, y parece
                       que WhatsApp está roto. La vigencia la decide
                       `core/whatsapp.ts`, que sabe cuánto dura. */
                    <span className={paso?.paso === 'conectada' ? 'cc-qr-listo' : undefined}>
                      {/* Cuando ya está vinculada, el panel tiene que DECIRLO.
                          Un recuadro que sigue hablando de códigos después de
                          escanear se lee como que no funcionó — y eso fue
                          exactamente lo que pasó el 11/09: la sesión estaba
                          viva y la pantalla seguía en «renovando el código». */}
                      {paso?.paso === 'conectada'
                        ? `✓ ${paso.titular}`
                        : paso
                          ? paso.titular
                          : 'esperando el código'}
                    </span>
                  )}
                </div>

                {/* El renglón de estado sale de core y dice en qué punto va:
                    conectada, escaneá, prendiendo, o no hay nadie del otro
                    lado. Ese último es el que faltaba y el que hacía que el
                    botón pareciera roto. */}
                {paso && (
                  <span className="campo-ayuda">
                    {vigente
                      ? 'Escaneá desde WhatsApp > Dispositivos vinculados. Se renueva solo cada menos de un minuto: no hace falta recargar.'
                      : paso.que_hacer || paso.titular}
                  </span>
                )}

                {suya?.wa_numero && (
                  <span className="campo-ayuda">
                    Vinculado antes con {numeroTapado(suya.wa_numero)}.
                  </span>
                )}

                {errorWa && <span className="cc-estado cc-mal">{errorWa}</span>}

                {/* Lo que dijo el worker, sólo cuando NO hay código. Con el QR
                    a la vista sobra: el proceso está andando. */}
                {!vigente && diario && (
                  <details className="cc-diario">
                    <summary className="campo-ayuda">Qué dijo el worker</summary>
                    <pre>{diario}</pre>
                  </details>
                )}

                {/* Botonera propia y no `cc-fila`: esa es la fila de la tabla
                    de arriba, con sus columnas fijas, y acá metía los dos
                    botones en un ancho que no les daba — se superponían. */}
                <div className="cc-qr-botones">
                  {/* Reintentar sólo cuando de verdad no hay nadie emitiendo.
                      Con un proceso vivo, apretar de nuevo levanta un segundo
                      que pelea por la misma credencial y los dos se
                      desloguean. */}
                  {paso?.hay_que_prender && (
                    <button
                      type="button"
                      className="boton-principal"
                      onClick={() => void abrirVinculo(qr)}
                    >
                      Prender la sesión
                    </button>
                  )}
                  <button type="button" className="boton-mini" onClick={() => setQr(null)}>
                    Cerrar
                  </button>
                </div>
              </div>
            );
          })()}

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
