import { useState } from 'react';
import type { EstadoAuth } from './useAuth';

export function Login({ auth }: { auth: EstadoAuth }) {
  const [email, setEmail] = useState('alberto@globalita.test');
  const [password, setPassword] = useState('demo12345');

  return (
    <div className="login-fondo">
      <form
        className="login-caja"
        onSubmit={(e) => {
          e.preventDefault();
          void auth.entrar(email, password);
        }}
      >
        <h1 className="login-titulo">CRM Globalita</h1>
        <p className="login-sub">Prospección en LinkedIn y WhatsApp</p>

        <label className="campo">
          <span className="campo-label">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
        </label>

        <label className="campo">
          <span className="campo-label">Contraseña</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {auth.error && <div className="login-error">{auth.error}</div>}

        <button type="submit" className="boton-principal" disabled={auth.cargando}>
          {auth.cargando ? 'Entrando…' : 'Entrar'}
        </button>

        <p className="login-pista">
          Datos de demo: <code>alberto@globalita.test</code> (administrador) o{' '}
          <code>sofia@globalita.test</code> (colaboradora). Clave <code>demo12345</code>.
        </p>
      </form>
    </div>
  );
}
