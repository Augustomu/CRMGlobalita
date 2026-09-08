import { useEffect, useState } from 'react';
import { pb } from '../../lib/pocketbase';

/**
 * Cuentas conectadas (§7.10): LinkedIn y WhatsApp por cuenta, con QR.
 *
 * Es la pantalla desde la que se ve por qué la cola no está saliendo. Con diez
 * cuentas, una sesión caída no se nota hasta que alguien pregunta por qué un
 * lead no recibió nada, y la respuesta —«la sesión de FR expiró el martes»—
 * tiene que estar a un clic.
 *
 * **El QR todavía no se puede mostrar** y eso se dice, no se disimula: el
 * código lo emite la sesión de WhatsApp Web, que vive en el worker de
 * Playwright. Hasta que el worker exista, acá sólo se ve el estado. Un botón
 * de «Vincular» que no vincula nada sería peor que no tenerlo.
 */
interface CuentaRecord {
  id: string;
  abrev: string;
  nombre_perfil: string;
  slot: number;
  estado_sesion: string;
  sesion_wa: string;
  linea_negocio: string;
}

const LEGIBLE: Record<string, string> = {
  activa: 'activa',
  expirada: 'expirada',
  sin_vincular: 'sin vincular',
  '': 'sin datos',
};

/** Verde, ámbar o gris: el estado se lee sin leer la palabra. */
function tono(estado: string): string {
  if (estado === 'activa') return 'cc-ok';
  if (estado === 'expirada') return 'cc-mal';
  return 'cc-tibio';
}

export function CuentasConectadas({ onCerrar }: { onCerrar: () => void }) {
  const [cuentas, setCuentas] = useState<CuentaRecord[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    pb.collection('cuenta')
      .getFullList<CuentaRecord>({ sort: 'slot' })
      .then((r) => {
        setCuentas(r);
        setCargando(false);
      })
      .catch(() => setCargando(false));
  }, []);

  const caidas = cuentas.filter((c) => c.estado_sesion !== 'activa' || c.sesion_wa !== 'activa').length;

  return (
    <div className="overlay-fondo" onClick={onCerrar}>
      <div className="overlay-caja overlay-cuentas" onClick={(e) => e.stopPropagation()}>
        <header className="overlay-header">
          <span className="overlay-titulo">Cuentas conectadas</span>
          <span className="campo-ayuda">
            {cargando
              ? 'leyendo…'
              : caidas
                ? `${caidas} con algo caído`
                : 'todas las sesiones en pie'}
          </span>
          <div className="barra" />
          <button type="button" className="boton-icono-26" title="Cerrar" onClick={onCerrar}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        <div className="cc-lista">
          <div className="cc-cabeza">
            <span className="auto-th">Cuenta</span>
            <span className="auto-th">Perfil</span>
            <span className="auto-th">LinkedIn</span>
            <span className="auto-th">WhatsApp</span>
            <span className="auto-th">Vincular</span>
          </div>

          {cuentas.map((c) => (
            <div key={c.id} className="cc-fila">
              <span className="pastilla">{c.abrev}</span>
              <span className="cc-perfil">{c.nombre_perfil || 'sin nombre cargado'}</span>
              <span className={`cc-estado ${tono(c.estado_sesion)}`}>
                {LEGIBLE[c.estado_sesion] ?? c.estado_sesion}
              </span>
              <span className={`cc-estado ${tono(c.sesion_wa)}`}>
                {LEGIBLE[c.sesion_wa] ?? c.sesion_wa}
              </span>
              <span className="cc-qr" title="El QR lo emite la sesión de WhatsApp Web, que vive en el worker">
                QR · llega con el worker
              </span>
            </div>
          ))}

          {!cargando && !cuentas.length && <div className="cc-vacio">No hay cuentas cargadas.</div>}
        </div>

        <footer className="overlay-pie">
          {/* CLAUDE.md regla 6: lo que no se puede construir todavía se omite y
              se anota; no se reemplaza por una versión inventada. */}
          <span className="campo-ayuda">
            El estado sale de la base. Vincular un número y ver el QR necesitan la sesión de
            WhatsApp Web, que corre en el worker de Playwright (Etapa 5): un botón que no vincula
            nada sería peor que no tenerlo.
          </span>
        </footer>
      </div>
    </div>
  );
}
