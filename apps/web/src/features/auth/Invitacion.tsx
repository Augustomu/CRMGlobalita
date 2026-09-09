import { useEffect, useState } from 'react';
import {
  LARGO_MINIMO_CLAVE,
  problemaDeClave,
  type EstadoInvitacion,
} from '@crm/core/alta';
import { apiUrl, pb } from '../../lib/pocketbase';

/**
 * La pantalla donde alguien recién invitado elige su contraseña (§6.7).
 *
 * Se abre sola cuando la URL trae `?invitacion=TOKEN`, que es el enlace del
 * correo. Es la única pantalla del CRM a la que se entra sin sesión además del
 * login — y tiene que serlo: quien la abre todavía no tiene con qué entrar.
 *
 * Lo que la protege no es una sesión sino el token: 40 caracteres al azar,
 * guardado hasheado, que vale una sola vez y vence a los siete días.
 */
interface Datos {
  estado: EstadoInvitacion;
  nombre?: string;
  email?: string;
  motivo?: 'alta' | 'reinicio';
}

/** Qué decirle a quien abre un enlace que ya no sirve. */
const MENSAJE: Record<Exclude<EstadoInvitacion, 'valida'>, { titulo: string; detalle: string }> = {
  usada: {
    titulo: 'Este enlace ya se usó',
    detalle:
      'Tu contraseña ya está elegida. Entrá con tu email y tu contraseña; si no la recordás, pedile a quien administra el CRM que te la reinicie.',
  },
  vencida: {
    titulo: 'Este enlace venció',
    detalle: 'Los enlaces duran siete días. Pedile otro a quien te dio de alta.',
  },
  inexistente: {
    titulo: 'Este enlace no existe',
    detalle: 'Puede que se haya cortado al copiarlo. Probá abrirlo de nuevo desde el correo.',
  },
};

export function Invitacion({ token, onListo }: { token: string; onListo: () => void }) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [clave, setClave] = useState('');
  const [repetida, setRepetida] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetch(apiUrl(`/api/invitacion/${encodeURIComponent(token)}`))
      .then((r) => r.json())
      .then((d) => vivo && setDatos(d as Datos))
      .catch(() => vivo && setDatos({ estado: 'inexistente' }));
    return () => {
      vivo = false;
    };
  }, [token]);

  /**
   * El problema se calcula en cada tecla pero sólo se muestra cuando hay algo
   * escrito en los dos campos: decirle «no coinciden» a alguien que todavía no
   * terminó de escribir la segunda es regañarlo por no haber terminado.
   */
  const problema = problemaDeClave(clave, repetida || undefined);
  const mostrar = clave.length > 0 && repetida.length > 0 ? problema : null;

  async function guardar() {
    if (problema) return;
    setGuardando(true);
    setError(null);
    try {
      const r = await fetch(apiUrl(`/api/invitacion/${encodeURIComponent(token)}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clave }),
      });
      const d = (await r.json()) as { ok?: boolean; error?: string; email?: string };
      if (!r.ok || !d.ok) {
        setError(d.error ?? 'No se pudo guardar la contraseña.');
        return;
      }
      // Se entra sola: pedirle que escriba de nuevo lo que acaba de elegir es
      // hacerle repetir un trámite que el sistema ya sabe hacer.
      await pb.collection('users').authWithPassword(d.email ?? datos?.email ?? '', clave);
      setListo(true);
      onListo();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(false);
    }
  }

  if (!datos) {
    return (
      <div className="login-fondo">
        <div className="login-caja">
          <p className="vacio">Revisando el enlace…</p>
        </div>
      </div>
    );
  }

  if (datos.estado !== 'valida') {
    const m = MENSAJE[datos.estado];
    return (
      <div className="login-fondo">
        <div className="login-caja">
          <h1 className="login-titulo">{m.titulo}</h1>
          <p className="campo-ayuda">{m.detalle}</p>
          <button
            type="button"
            className="boton-principal"
            onClick={() => {
              // Se limpia el token de la URL: si queda, recargar vuelve a
              // mostrar el mismo cartel y parece que la app está trabada.
              window.history.replaceState({}, '', '/');
              onListo();
            }}
          >
            Ir al login
          </button>
        </div>
      </div>
    );
  }

  if (listo) {
    return (
      <div className="login-fondo">
        <div className="login-caja">
          <h1 className="login-titulo">Listo</h1>
          <p className="campo-ayuda">Entrando al CRM…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-fondo">
      <div className="login-caja">
        <h1 className="login-titulo">
          {datos.motivo === 'reinicio' ? 'Elegí una contraseña nueva' : 'Elegí tu contraseña'}
        </h1>

        {/* El usuario se dice explícitamente porque no es obvio: se entra con
            el email, no con un nombre de usuario, y es la primera pregunta que
            hace todo el mundo. */}
        <div className="inv-usuario">
          <span className="campo-label">Vas a entrar con</span>
          <span className="inv-email">{datos.email}</span>
        </div>

        <label className="campo">
          <span className="campo-label">Contraseña</span>
          <input
            type="password"
            autoFocus
            autoComplete="new-password"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
          />
          <span className="campo-ayuda">Al menos {LARGO_MINIMO_CLAVE} caracteres.</span>
        </label>

        <label className="campo">
          <span className="campo-label">Repetila</span>
          <input
            type="password"
            autoComplete="new-password"
            value={repetida}
            onChange={(e) => setRepetida(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !problema && void guardar()}
          />
        </label>

        {mostrar && <div className="login-error">{mostrar}</div>}
        {error && <div className="login-error">{error}</div>}

        <button
          type="button"
          className="boton-principal"
          disabled={Boolean(problema) || guardando}
          onClick={() => void guardar()}
        >
          {guardando ? 'Guardando…' : 'Guardar y entrar'}
        </button>
      </div>
    </div>
  );
}
