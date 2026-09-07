import { useEffect, useMemo, useState } from 'react';
import {
  DETALLE_LINEA,
  LINEAS,
  NOMBRE_LINEA,
  origen,
  puede,
  type Clave,
  type LineaNegocio,
  type Rol,
} from '@crm/core/permisos';
import { pb } from '../../lib/pocketbase';
import type { LeadRecord, UsuarioRecord } from '../../lib/types';
import { iniciales } from '../followup/ListaContactos';

/** Qué habilita cada clave, en criollo. Es lo que se lee en la tabla (§7.5). */
const EXPLICACION: Record<Clave, { que: string; detalle: string }> = {
  followup: { que: 'Follow-up', detalle: 'La sección de leads y su ficha' },
  waPersonal: { que: 'WA Personal', detalle: 'Los chats de amigos y familia de su cuenta' },
  control: { que: 'Control', detalle: 'Proyectos y el tablero de reuniones' },
  automatizaciones: { que: 'Automatizaciones', detalle: 'Invitaciones, cancelación y cadencia' },
  usuarios: { que: 'Usuarios', detalle: 'Esta pantalla, y reasignar leads' },
  colaEnvios: { que: 'Cola de envíos', detalle: 'Ver lo que está por salir' },
  importarLeads: { que: 'Importar', detalle: 'CSV y carga masiva de teléfonos' },
  vencimientos: { que: 'Vencimientos', detalle: 'La cola de los que vencen hoy' },
  repositorio: { que: 'Repositorio', detalle: 'Los textos de los mensajes' },
  baseCompartida: { que: 'Base compartida', detalle: 'Todos los perfiles ya invitados' },
  cuentasConectadas: { que: 'Cuentas conectadas', detalle: 'QR y vincular números' },
  tareas: { que: 'Tareas', detalle: 'Su lista de tareas' },
  agenda: { que: 'Agenda', detalle: 'Su agenda y la del admin como ocupado' },
  verTodosLeads: { que: 'Ver todos los leads', detalle: 'Sin esto, solo ve los asignados' },
  enviarMensajes: { que: 'Enviar mensajes', detalle: 'Redactar y registrar envíos' },
  verTelefono: { que: 'Ver teléfono', detalle: 'El número y el botón de WhatsApp' },
  verEmails: { que: 'Ver emails', detalle: 'Los correos del lead' },
  verLinks: { que: 'Ver links', detalle: 'Perfil de LinkedIn y chat' },
  verConversaciones: { que: 'Ver conversaciones', detalle: 'Los hilos de LinkedIn y WhatsApp' },
};

const GRUPOS: { titulo: string; claves: Clave[] }[] = [
  { titulo: 'Secciones', claves: ['followup', 'waPersonal', 'control', 'automatizaciones', 'usuarios'] },
  { titulo: 'Herramientas', claves: ['colaEnvios', 'importarLeads', 'vencimientos', 'repositorio', 'baseCompartida', 'cuentasConectadas', 'tareas', 'agenda'] },
  { titulo: 'Alcance y acciones', claves: ['verTodosLeads', 'enviarMensajes'] },
  { titulo: 'Datos sensibles', claves: ['verTelefono', 'verEmails', 'verLinks', 'verConversaciones'] },
];

const ROLES: Rol[] = ['administrador', 'colaborador', 'observador'];

interface Props {
  usuarioActual: UsuarioRecord;
  leads: LeadRecord[];
  onCambio: () => void;
}

export function Usuarios({ usuarioActual, leads, onCambio }: Props) {
  const [usuarios, setUsuarios] = useState<UsuarioRecord[]>([]);
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [altaAbierta, setAltaAbierta] = useState(false);

  async function recargar() {
    try {
      const r = await pb.collection('users').getFullList<UsuarioRecord>({ sort: 'name' });
      setUsuarios(r);
      if (!seleccionado && r[0]) setSeleccionado(r[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    void recargar();
  }, []);

  const usuario = usuarios.find((u) => u.id === seleccionado) ?? null;

  /** Los leads de cada usuario, con el reparto por cuenta (§6.5). */
  const repartoPorCuenta = useMemo(() => {
    if (!usuario) return [];
    const m = new Map<string, number>();
    for (const l of leads) {
      if (l.asignado !== usuario.id) continue;
      const a = l.expand?.cuenta?.abrev ?? '?';
      m.set(a, (m.get(a) ?? 0) + 1);
    }
    return [...m].sort();
  }, [leads, usuario]);

  const susLeads = useMemo(
    () => (usuario ? leads.filter((l) => l.asignado === usuario.id) : []),
    [leads, usuario],
  );

  async function alternar(clave: Clave) {
    if (!usuario) return;
    // No se editan los permisos propios: si no, cualquiera con `usuarios` se
    // da todo lo demás y el permiso deja de significar algo (D20).
    if (usuario.id === usuarioActual.id) {
      setError('No podés editar tus propios permisos. Que lo haga otro administrador.');
      return;
    }
    const actual = puede({ rol: usuario.rol as Rol, permisos: usuario.permisos ?? {} }, clave);
    const permisos = { ...(usuario.permisos ?? {}), [clave]: !actual };
    setGuardando(true);
    setError(null);
    try {
      // Se usa el registro que devuelve el propio update en vez de volver a
      // pedir la lista: es la verdad recién escrita, y evita que una recarga
      // en vuelo pise el estado con datos viejos.
      const guardado = await pb.collection('users').update<UsuarioRecord>(usuario.id, { permisos });
      setUsuarios((us) => us.map((u) => (u.id === guardado.id ? guardado : u)));
      onCambio();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(false);
    }
  }

  async function volverAlPreset() {
    if (!usuario) return;
    setGuardando(true);
    try {
      const guardado = await pb.collection('users').update<UsuarioRecord>(usuario.id, { permisos: {} });
      setUsuarios((us) => us.map((u) => (u.id === guardado.id ? guardado : u)));
      onCambio();
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarRol(rol: Rol) {
    if (!usuario || usuario.id === usuarioActual.id) {
      setError('No podés cambiarte el rol a vos mismo.');
      return;
    }
    setGuardando(true);
    try {
      const guardado = await pb.collection('users').update<UsuarioRecord>(usuario.id, { rol });
      setUsuarios((us) => us.map((u) => (u.id === guardado.id ? guardado : u)));
      onCambio();
    } finally {
      setGuardando(false);
    }
  }

  /**
   * A que negocio esta limitado su Control.
   *
   * Es un ALCANCE, no un permiso: los permisos son sí/no y esto elige entre dos
   * negocios. Solo tiene sentido con el permiso de Control prendido, así que la
   * fila aparece únicamente cuando lo tiene.
   */
  async function cambiarLinea(linea: LineaNegocio | '') {
    if (!usuario) return;
    setGuardando(true);
    try {
      const guardado = await pb
        .collection('users')
        .update<UsuarioRecord>(usuario.id, { linea_control: linea });
      setUsuarios((us) => us.map((u) => (u.id === guardado.id ? guardado : u)));
      onCambio();
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarEstado(estado: string) {
    if (!usuario) return;
    setGuardando(true);
    try {
      const guardado = await pb.collection('users').update<UsuarioRecord>(usuario.id, { estado });
      setUsuarios((us) => us.map((u) => (u.id === guardado.id ? guardado : u)));
      onCambio();
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="usuarios">
      <aside className="usuarios-lista">
        <div className="lista-buscador">
          <span className="colapsable-titulo">Usuarios</span>
          <button
            type="button"
            className="boton-icono"
            title="Invitar usuario"
            onClick={() => setAltaAbierta(true)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
        <div className="lista-filas">
          {usuarios.map((u) => (
            <div
              key={u.id}
              className={`fila ${seleccionado === u.id ? 'fila-on' : ''}`}
              onClick={() => setSeleccionado(u.id)}
            >
              <div className="fila-arriba">
                <span className="avatar">{iniciales(u.name || u.email)}</span>
                <span className="fila-nombre">{u.name || u.email}</span>
              </div>
              <div className="fila-abajo">
                <span className="fila-etapa">{u.rol}</span>
                <span className={`fila-contacto ${u.estado !== 'activo' ? 'fila-contacto-vencido' : ''}`}>
                  {u.estado}
                </span>
                <span className="fila-contacto">
                  {leads.filter((l) => l.asignado === u.id).length} leads
                </span>
              </div>
            </div>
          ))}
          {usuarios.length === 0 && <p className="vacio">Cargando…</p>}
        </div>
      </aside>

      <section className="ficha">
        {!usuario ? (
          <p className="vacio">Elegí un usuario.</p>
        ) : (
          <>
            <header className="ficha-header">
              <span className="ficha-avatar">{iniciales(usuario.name || usuario.email)}</span>
              <div className="ficha-nombre-caja">
                <span className="ficha-nombre">{usuario.name || '(sin nombre)'}</span>
              </div>
              <div className="ficha-botonera">
                <div className="selector-idioma">
                  {ROLES.map((r) => (
                    <button
                      key={r}
                      type="button"
                      className={usuario.rol === r ? 'idioma-on' : 'idioma-off'}
                      onClick={() => void cambiarRol(r)}
                      disabled={guardando}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <div className="selector-idioma">
                  {['activo', 'pendiente', 'suspendido'].map((e) => (
                    <button
                      key={e}
                      type="button"
                      className={usuario.estado === e ? 'idioma-on' : 'idioma-off'}
                      onClick={() => void cambiarEstado(e)}
                      disabled={guardando}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
              <div className="ficha-chips">
                <span className="pastilla">{usuario.email}</span>
                {repartoPorCuenta.map(([abrev, n]) => (
                  <span key={abrev} className="pastilla">
                    {abrev} {n}
                  </span>
                ))}
                {usuario.id === usuarioActual.id && (
                  <span className="pastilla pastilla-alerta">sos vos</span>
                )}
              </div>
            </header>

            <div className="ficha-cuerpo">
              {error && <div className="login-error">{error}</div>}

              {usuario.id === usuarioActual.id && (
                <div className="aviso-suave">
                  No podés editar tus propios permisos ni tu rol. Es a propósito: si no,
                  cualquiera con el permiso <code>usuarios</code> podría darse todo lo demás.
                </div>
              )}

              {GRUPOS.map((g) => (
                <div key={g.titulo} className="colapsable">
                  <div className="colapsable-cabecera" style={{ cursor: 'default' }}>
                    <span className="colapsable-titulo">{g.titulo}</span>
                  </div>
                  <div className="colapsable-cuerpo" style={{ padding: 0 }}>
                    {g.claves.map((c) => {
                      const activo = puede(
                        { rol: usuario.rol as Rol, permisos: usuario.permisos ?? {} },
                        c,
                      );
                      const deDonde = origen(
                        { rol: usuario.rol as Rol, permisos: usuario.permisos ?? {} },
                        c,
                      );
                      return (
                        <div key={c} className="permiso-fila">
                          <span className="permiso-que">{EXPLICACION[c].que}</span>
                          <span className="permiso-detalle">{EXPLICACION[c].detalle}</span>
                          <span className={`permiso-origen ${deDonde === 'editado' ? 'permiso-editado' : ''}`}>
                            {deDonde}
                          </span>
                          <button
                            type="button"
                            className={`switch ${activo ? 'switch-on' : ''}`}
                            onClick={() => void alternar(c)}
                            disabled={guardando || usuario.id === usuarioActual.id}
                            title={activo ? 'Quitar' : 'Dar'}
                          >
                            <span className="switch-punto" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {puede({ rol: usuario.rol as Rol, permisos: usuario.permisos ?? {} }, 'control') && (
                <div className="colapsable">
                  <div className="colapsable-cabecera" style={{ cursor: 'default' }}>
                    <span className="colapsable-titulo">Qué negocio ve en Control</span>
                    <span className="colapsable-resumen">
                      {usuario.linea_control ? NOMBRE_LINEA[usuario.linea_control] : 'los dos'}
                    </span>
                  </div>
                  <div className="colapsable-cuerpo">
                    <span className="campo-ayuda">
                      Control se le da a alguien de afuera del equipo de prospección, y hay dos
                      negocios. El socio de un lado no tiene por qué ver los proyectos del otro.
                    </span>
                    <div className="permiso-fila">
                      <span className="permiso-que">Los dos</span>
                      <span className="permiso-detalle">Ve todo el trabajo, de las dos líneas.</span>
                      <span className="permiso-origen" />
                      <button
                        type="button"
                        className={`switch ${!usuario.linea_control ? 'switch-on' : ''}`}
                        onClick={() => void cambiarLinea('')}
                        disabled={guardando}
                      >
                        <span className="switch-punto" />
                      </button>
                    </div>
                    {LINEAS.map((l) => (
                      <div key={l} className="permiso-fila">
                        <span className="permiso-que">{NOMBRE_LINEA[l]}</span>
                        <span className="permiso-detalle">{DETALLE_LINEA[l]}</span>
                        <span className="permiso-origen" />
                        <button
                          type="button"
                          className={`switch ${usuario.linea_control === l ? 'switch-on' : ''}`}
                          onClick={() => void cambiarLinea(l as LineaNegocio)}
                          disabled={guardando}
                        >
                          <span className="switch-punto" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="colapsable">
                <div className="colapsable-cabecera" style={{ cursor: 'default' }}>
                  <span className="colapsable-titulo">Leads asignados</span>
                  <span className="colapsable-resumen">{susLeads.length}</span>
                </div>
                <div className="colapsable-cuerpo">
                  {susLeads.length === 0 && <span className="vacio">Sin leads asignados.</span>}
                  {susLeads.map((l) => (
                    <div key={l.id} className="permiso-fila">
                      <span className="permiso-que">{l.expand?.perfil?.nombre}</span>
                      <span className="permiso-detalle">
                        {l.expand?.cuenta?.abrev} · {l.etapa}
                      </span>
                      <span className="permiso-origen">
                        {l.nivel_asignacion ?? 'seguimiento'}
                      </span>
                      <button
                        type="button"
                        className="chip-pastilla"
                        disabled={guardando}
                        onClick={async () => {
                          const nuevo = (l.nivel_asignacion ?? 'seguimiento') === 'seguimiento'
                            ? 'lectura'
                            : 'seguimiento';
                          await pb.collection('lead').update(l.id, { nivel_asignacion: nuevo });
                          onCambio();
                        }}
                      >
                        cambiar
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <footer className="ficha-pie">
              <span className="campo-ayuda">
                Los permisos se guardan al tocarlos, no hace falta confirmar.
              </span>
              <button
                type="button"
                className="boton-secundario"
                style={{ marginLeft: 'auto' }}
                onClick={() => void volverAlPreset()}
                disabled={guardando || usuario.id === usuarioActual.id}
              >
                Volver a los permisos del rol
              </button>
            </footer>
          </>
        )}
      </section>

      {altaAbierta && (
        <AltaUsuario
          onCerrar={() => setAltaAbierta(false)}
          onCreado={() => {
            setAltaAbierta(false);
            void recargar();
          }}
        />
      )}
    </div>
  );
}

/** Alta de usuario (§7.5). El manual no tiene auto-registro: la crea un admin. */
function AltaUsuario({ onCerrar, onCreado }: { onCerrar: () => void; onCreado: () => void }) {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  const [rol, setRol] = useState<Rol>('colaborador');
  const [error, setError] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);

  async function crear() {
    setCreando(true);
    setError(null);
    try {
      await pb.collection('users').create({
        name: nombre,
        email,
        emailVisibility: true,
        password: clave,
        passwordConfirm: clave,
        verified: true,
        rol,
        estado: 'activo',
        permisos: {},
        metodo_invitacion: 'clave_temporal',
      });
      onCreado();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreando(false);
    }
  }

  return (
    <div className="overlay-fondo" onClick={onCerrar}>
      <div className="overlay-caja" style={{ width: 440 }} onClick={(e) => e.stopPropagation()}>
        <header className="overlay-header">
          <span className="overlay-titulo">Invitar usuario</span>
          <button type="button" className="boton-icono-26" onClick={onCerrar}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>
        <div className="overlay-cuerpo">
          <label className="campo">
            <span className="campo-label">Nombre</span>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
          </label>
          <label className="campo">
            <span className="campo-label">Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="campo">
            <span className="campo-label">Contraseña temporal</span>
            <input value={clave} onChange={(e) => setClave(e.target.value)} />
            <span className="campo-ayuda">Mínimo 8 caracteres. Que la cambie al entrar.</span>
          </label>
          <div className="campo">
            <span className="campo-label">Rol</span>
            <div className="selector-idioma">
              {ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  className={rol === r ? 'idioma-on' : 'idioma-off'}
                  onClick={() => setRol(r)}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          {error && <div className="login-error">{error}</div>}
        </div>
        <footer className="overlay-pie">
          <button type="button" className="boton-secundario" onClick={onCerrar}>
            Cancelar
          </button>
          <button
            type="button"
            className="boton-principal"
            style={{ marginLeft: 'auto' }}
            disabled={!nombre || !email || clave.length < 8 || creando}
            onClick={() => void crear()}
          >
            {creando ? 'Creando…' : 'Crear'}
          </button>
        </footer>
      </div>
    </div>
  );
}
