import { useEffect, useMemo, useState } from 'react';
import { pb } from '../../lib/pocketbase';
import { useEscape } from '../../lib/useEscape';

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
 */
interface CuentaRecord {
  id: string;
  abrev: string;
  nombre_perfil: string;
  slot: number;
  estado_sesion: string;
  sesion_wa: string;
}

interface EnCola {
  cuenta: string;
  estado: string;
}

export function CuentasConectadas({ onCerrar }: { onCerrar: () => void }) {
  useEscape(onCerrar);
  const [cuentas, setCuentas] = useState<CuentaRecord[]>([]);
  const [cola, setCola] = useState<EnCola[]>([]);
  const [cargando, setCargando] = useState(true);
  /** Qué cuenta tiene el QR abierto. `nueva` es vincular otro número. */
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    Promise.all([
      pb.collection('cuenta').getFullList<CuentaRecord>({ sort: 'slot' }),
      pb
        .collection('cola')
        .getFullList<EnCola>({ filter: 'estado = "pendiente"', fields: 'cuenta,estado' })
        .catch(() => [] as EnCola[]),
    ])
      .then(([cs, q]) => {
        if (!vivo) return;
        setCuentas(cs);
        setCola(q);
        setCargando(false);
      })
      .catch(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, []);

  /** Cuántos envíos espera cada cuenta. */
  const pendientes = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of cola) m.set(c.cuenta, (m.get(c.cuenta) ?? 0) + 1);
    return m;
  }, [cola]);

  const activasLi = cuentas.filter((c) => c.estado_sesion === 'activa').length;
  const activasWa = cuentas.filter((c) => c.sesion_wa === 'activa').length;

  /**
   * Los envíos que están esperando a que vuelva una sesión.
   *
   * Sólo cuentan los de las cuentas CAÍDAS: la cola de una cuenta sana no está
   * frenada, está esperando su turno, que es otra cosa.
   */
  const frenados = cuentas
    .filter((c) => c.sesion_wa !== 'activa' || c.estado_sesion !== 'activa')
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
          <div className="cc-seccion">
            <span className="campo-label">LinkedIn</span>
          </div>
          {cuentas.map((c) => {
            const viva = c.estado_sesion === 'activa';
            return (
              <div key={`li-${c.id}`} className="cc-fila">
                <span className="pastilla">{c.abrev}</span>
                <span className="cc-perfil">{c.nombre_perfil || 'sin nombre cargado'}</span>
                <span className={viva ? 'cc-estado cc-ok' : 'cc-estado cc-mal'}>
                  <span className={viva ? 'cc-punto cc-punto-ok' : 'cc-punto cc-punto-mal'} />
                  {viva ? 'activa' : c.estado_sesion === 'caida' ? 'caída' : 'sin vincular'}
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
            const viva = c.sesion_wa === 'activa';
            const espera = pendientes.get(c.id) ?? 0;
            return (
              <div key={`wa-${c.id}`} className="cc-fila">
                <span className="pastilla">{c.abrev}</span>
                <span className="cc-perfil">{c.nombre_perfil || 'sin nombre cargado'}</span>
                <span className={viva ? 'cc-estado cc-ok' : 'cc-estado cc-mal'}>
                  <span className={viva ? 'cc-punto cc-punto-ok' : 'cc-punto cc-punto-mal'} />
                  {viva ? 'conectada' : 'pide QR'}
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
                : 'Todas las sesiones activas: la cola sale según lo programado.'}
          </span>
        </footer>
      </div>
    </div>
  );
}
