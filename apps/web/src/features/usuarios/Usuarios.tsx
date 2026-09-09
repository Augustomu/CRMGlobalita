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
import { DIAS_DE_INVITACION } from '@crm/core/alta';
import { apiUrl, pb } from '../../lib/pocketbase';
import { Actividad } from './Actividad';
import { AsignarEnLote } from './AsignarEnLote';
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
  const [enviandoAcceso, setEnviandoAcceso] = useState(false);
  const [avisoAcceso, setAvisoAcceso] = useState<string | null>(null);
  /** Las dos vistas del prototipo: la lista de usuarios y el registro. */
  const [vista, setVista] = useState<'usuarios' | 'actividad'>('usuarios');
  const [loteAbierto, setLoteAbierto] = useState(false);
  const [altaAbierta, setAltaAbierta] = useState(false);
  /** La baja pide confirmar aparte: es el único botón que borra. */
  const [confirmarBaja, setConfirmarBaja] = useState(false);

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

  // Cambiar de usuario desarma la baja: la confirmación es de ESE usuario, y
  // dejarla armada al pasar al siguiente es cómo se borra a quien no era.
  useEffect(() => {
    setConfirmarBaja(false);
  }, [seleccionado]);

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

  /**
   * Le manda a esa persona un enlace para elegir su contraseña.
   *
   * Es el mismo mecanismo del alta, y a propósito: si «reiniciar la clave»
   * fuera ponerle una nueva y decírsela, volveríamos a tener una contraseña
   * que un tercero conoce y que viaja escrita.
   *
   * El servidor quema las invitaciones anteriores antes de emitir la nueva:
   * dos correos abiertos son dos llaves.
   */
  async function reenviarAcceso() {
    if (!usuario) return;
    setEnviandoAcceso(true);
    setError(null);
    setAvisoAcceso(null);
    try {
      const r = await fetch(apiUrl('/api/invitar'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: pb.authStore.token },
        body: JSON.stringify({ usuario_id: usuario.id }),
      });
      const d = (await r.json()) as { ok?: boolean; error?: string };
      if (!r.ok || !d.ok) {
        setError(d.error ?? 'No se pudo mandar el correo.');
        return;
      }
      setAvisoAcceso('correo enviado');
      // El cartel se va solo: es una confirmación, no un estado.
      setTimeout(() => setAvisoAcceso(null), 6000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setEnviandoAcceso(false);
    }
  }

  /**
   * La baja del usuario (§7.5).
   *
   * Es el único botón de la pantalla que borra algo, así que pide confirmar
   * aparte y dice ANTES qué queda huérfano: los leads que tenía asignados
   * quedan sin agente y sus tareas sin dueño. No se pierde ningún lead —la
   * relación `asignado` no arrastra— pero conviene saberlo antes, no después.
   *
   * Nadie se borra a sí mismo: lo impide la regla de PocketBase, no sólo el
   * botón. Si el último administrador pudiera borrarse, el CRM quedaría sin
   * quien administre.
   */
  async function darDeBaja() {
    if (!usuario || usuario.id === usuarioActual.id) return;
    setGuardando(true);
    setError(null);
    try {
      await pb.collection('users').delete(usuario.id);
      setUsuarios((us) => us.filter((u) => u.id !== usuario.id));
      setSeleccionado(null);
      setConfirmarBaja(false);
      onCambio();
    } catch (e) {
      // PocketBase contesta 404 cuando la regla no deja: para él, el registro
      // «no existe». Traducirlo importa — «The requested resource wasn't
      // found» no le dice a nadie que el problema es con qué usuario entró.
      const status = (e as { status?: number }).status;
      setError(
        status === 404
          ? 'No se pudo borrar. Casi siempre es porque es el usuario con el que estás conectado: sólo se puede dar de baja a otro. Salí y volvé a entrar con tu usuario.'
          : e instanceof Error
            ? e.message
            : String(e),
      );
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

  const asignables = leads.map((l) => ({
    id: l.id,
    nombre: l.expand?.perfil?.nombre ?? 'sin nombre',
    empresa: l.expand?.perfil?.empresa ?? '',
    cargo: l.expand?.perfil?.cargo ?? '',
    ciudad: l.expand?.perfil?.ciudad ?? '',
    pais: l.expand?.perfil?.pais ?? '',
    industria: l.expand?.perfil?.industria ?? '',
    cuenta: l.expand?.cuenta?.abrev ?? '',
    asignado: l.asignado ?? '',
  }));

  // La Actividad es una vista propia y no un bloque mas: contesta otra
  // pregunta —quien hizo que— y comparte con esta pantalla solo el permiso.
  if (vista === 'actividad') {
    return (
      <div className="usuarios usuarios-actividad">
        <div className="auto-header">
          <div className="auto-grupos">
            <button type="button" className="auto-grupo" onClick={() => setVista('usuarios')}>
              Usuarios
            </button>
            <button type="button" className="auto-grupo auto-grupo-on">
              Actividad
            </button>
          </div>
          <span className="auto-bajada">Quién hizo qué y cuándo. Se llena sola.</span>
        </div>
        <Actividad usuarios={usuarios} />
      </div>
    );
  }

  return (
    <div className="usuarios">
      <aside className="usuarios-lista">
        <div className="lista-buscador">
          <div className="auto-grupos">
            <button type="button" className="auto-grupo auto-grupo-on">
              Usuarios
            </button>
            <button type="button" className="auto-grupo" onClick={() => setVista('actividad')}>
              Actividad
            </button>
          </div>
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

                {/*
                  Reenviar el acceso (§6.7).
                  Para el pendiente es «se le venció el enlace»; para el activo
                  es «se olvidó la clave». El texto lo dice, porque son dos
                  cosas distintas y el correo que sale también.

                  No hay un botón de «ver la contraseña» ni de «ponerle una»:
                  nadie, ni el administrador, tiene por qué conocer la clave de
                  otro. Reiniciar significa mandar un enlace, no fijar una.
                */}
                <button
                  type="button"
                  className="boton-mini"
                  disabled={enviandoAcceso || usuario.id === usuarioActual.id}
                  title={
                    usuario.id === usuarioActual.id
                      ? 'Para cambiar tu propia contraseña, usá el enlace desde tu correo'
                      : usuario.estado === 'pendiente'
                        ? 'Mandarle otro enlace para elegir su contraseña'
                        : 'Reiniciar su contraseña: la actual deja de servir y le llega un enlace'
                  }
                  onClick={() => void reenviarAcceso()}
                >
                  {enviandoAcceso
                    ? 'Mandando…'
                    : usuario.estado === 'pendiente'
                      ? 'Reenviar invitación'
                      : 'Reiniciar contraseña'}
                </button>
                {avisoAcceso && <span className="pastilla pastilla-ok">{avisoAcceso}</span>}

                {/*
                  La baja (§7.5). En dos tiempos: el primer clic no borra, abre
                  la pregunta con las consecuencias escritas. Un botón que borra
                  a la primera, al lado de otros que no, se aprieta por inercia.
                */}
                {usuario.id !== usuarioActual.id &&
                  (confirmarBaja ? (
                    <>
                      <span className="pastilla pastilla-alerta">
                        ¿Borrar a {usuario.name || usuario.email}?
                        {susLeads.length > 0 &&
                          ` Sus ${susLeads.length} ${susLeads.length === 1 ? 'lead queda' : 'leads quedan'} sin asignar.`}
                      </span>
                      <button
                        type="button"
                        className="boton-mini boton-mini-peligro"
                        disabled={guardando}
                        onClick={() => void darDeBaja()}
                      >
                        {guardando ? 'Borrando…' : 'Sí, borrar'}
                      </button>
                      <button
                        type="button"
                        className="boton-mini"
                        onClick={() => setConfirmarBaja(false)}
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="boton-mini"
                      title="Borrar el usuario. Sus leads quedan sin asignar; no se borra ninguno."
                      onClick={() => setConfirmarBaja(true)}
                    >
                      Dar de baja
                    </button>
                  ))}

                {/* El reparto de sus leads por cuenta (§6.5). Iba como
                    pastillas sueltas —«FR 2»— al lado del correo y de los
                    botones, así que parecía una etiqueta más y no se entendía
                    qué era. Ahora lo dice, y cada una explica su número. */}
                {repartoPorCuenta.length > 0 && (
                  <span className="campo-ayuda">Leads por cuenta:</span>
                )}
                {repartoPorCuenta.map(([abrev, n]) => (
                  <span
                    key={abrev}
                    className="pastilla"
                    title={`${n} ${n === 1 ? 'lead asignado' : 'leads asignados'} de la cuenta ${abrev}`}
                  >
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
                  <div className="colapsable-cabecera sin-cursor">
                    <span className="colapsable-titulo">{g.titulo}</span>
                  </div>
                  <div className="colapsable-cuerpo colapsable-cuerpo-pelado">
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
                  <div className="colapsable-cabecera sin-cursor">
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
                <div className="colapsable-cabecera sin-cursor">
                  <span className="colapsable-titulo">Leads asignados</span>
                  <span className="colapsable-resumen">{susLeads.length}</span>
                  {/* §7.8: repartir una base de mil de a uno no es trabajo. */}
                  <button type="button" className="boton-mini al-final" onClick={() => setLoteAbierto(true)}>
                    Asignar en lote
                  </button>
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
                className="boton-secundario al-final"
                onClick={() => void volverAlPreset()}
                disabled={guardando || usuario.id === usuarioActual.id}
              >
                Volver a los permisos del rol
              </button>
            </footer>
          </>
        )}
      </section>

      {loteAbierto && usuario && (
        <AsignarEnLote
          leads={asignables}
          usuarioId={usuario.id}
          usuarioNombre={usuario.name}
          nombreDe={(id) => usuarios.find((u) => u.id === id)?.name ?? ''}
          onCerrar={() => setLoteAbierto(false)}
          onAsignar={async (ids) => {
            // De a uno y en serie: PocketBase no tiene escritura en lote, y
            // mandar 300 PATCH en paralelo hace que el servidor tire la mitad.
            for (const id of ids) {
              await pb.collection('lead').update(id, { asignado: usuario.id });
            }
            onCambio();
          }}
        />
      )}

      {altaAbierta && (
        <AltaUsuario
          onCerrar={() => setAltaAbierta(false)}
          // Solo recarga la lista: el overlay lo cierra el propio
          // componente cuando la persona leyo a donde salio el correo.
          onCreado={() => void recargar()}
        />
      )}
    </div>
  );
}

/**
 * Alta de usuario (§7.5, §6.7).
 *
 * No hay campo de contraseña, y eso es el cambio: el administrador no elige ni
 * ve la clave de nadie. Se manda un correo con el usuario y un enlace de un
 * solo uso donde la persona elige la suya.
 *
 * Antes el admin escribía una clave temporal y se la pasaba por fuera —
 * WhatsApp, un papel, un mensaje que queda ahí. Además de que la clave viajaba
 * por donde fuera, nadie sabía si la persona había llegado a entrar.
 *
 * El alta la hace el SERVIDOR, no esta pantalla. La colección `users` no acepta
 * `create` desde la API justamente para que no exista auto-registro: si lo
 * aceptara, cualquiera que sepa la URL se da de alta solo.
 */
function AltaUsuario({ onCerrar, onCreado }: { onCerrar: () => void; onCreado: () => void }) {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [rol, setRol] = useState<Rol>('colaborador');
  const [error, setError] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const [listo, setListo] = useState<string | null>(null);

  async function crear() {
    setCreando(true);
    setError(null);
    try {
      const r = await fetch(apiUrl('/api/invitar'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: pb.authStore.token,
        },
        body: JSON.stringify({ nombre, email: email.trim().toLowerCase(), rol }),
      });
      const d = (await r.json()) as { ok?: boolean; error?: string; email?: string };
      if (!r.ok || !d.ok) {
        setError(d.error ?? 'No se pudo dar de alta.');
        return;
      }
      // No se cierra sola: hay que poder LEER a dónde se mandó el correo. Un
      // alta que se cierra en silencio deja la duda de si salió.
      setListo(d.email ?? email);
      onCreado();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreando(false);
    }
  }

  return (
    <div className="overlay-fondo" onClick={onCerrar}>
      <div className="overlay-caja overlay-medio" onClick={(e) => e.stopPropagation()}>
        <header className="overlay-header">
          <span className="overlay-titulo">Invitar usuario</span>
          <button type="button" className="boton-icono-26" onClick={onCerrar}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        {listo ? (
          <>
            <div className="overlay-cuerpo">
              <p className="inv-listo">
                Le mandamos el correo a <strong>{listo}</strong>.
              </p>
              <p className="campo-ayuda">
                Adentro tiene su usuario y un enlace para elegir su contraseña. Sirve una sola vez y
                vence en {DIAS_DE_INVITACION} días; si se le vence, desde su ficha se le manda otro.
              </p>
              <p className="campo-ayuda">
                Hasta que entre, figura como <strong>pendiente</strong> y no puede iniciar sesión.
              </p>
            </div>
            <footer className="overlay-pie">
              <button type="button" className="boton-principal al-final" onClick={onCerrar}>
                Listo
              </button>
            </footer>
          </>
        ) : (
          <>
            <div className="overlay-cuerpo">
              <label className="campo">
                <span className="campo-label">Nombre</span>
                <input value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
              </label>
              <label className="campo">
                <span className="campo-label">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && nombre && email && void crear()}
                />
                <span className="campo-ayuda">
                  Es con lo que va a entrar, y a donde le llega el correo de acceso.
                </span>
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
                <span className="campo-ayuda">
                  El rol es un preset de permisos (§6.2). Después se ajusta uno por uno desde su ficha.
                </span>
              </div>
              {error && <div className="login-error">{error}</div>}
            </div>
            <footer className="overlay-pie">
              <button type="button" className="boton-secundario" onClick={onCerrar}>
                Cancelar
              </button>
              <button
                type="button"
                className="boton-principal al-final"
                disabled={!nombre || !email || creando}
                onClick={() => void crear()}
              >
                {creando ? 'Mandando el correo…' : 'Invitar'}
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
