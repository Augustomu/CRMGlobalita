import { useEffect, useState } from 'react';
import { useAuth } from './features/auth/useAuth';
import { Login } from './features/auth/Login';
import { useLeads, puedeUsuario } from './features/followup/useLeads';
import { ListaContactos, iniciales } from './features/followup/ListaContactos';
import { FichaLead } from './features/followup/FichaLead';
import { CambiosSinGuardar } from './features/followup/CambiosSinGuardar';
import { usePlantillas } from './features/followup/usePlantillas';
import { Vencimientos, leadsVencidos } from './features/vencimientos/Vencimientos';
import { Usuarios } from './features/usuarios/Usuarios';
import { Repositorio } from './features/repositorio/Repositorio';
import { useEtiquetas } from './features/followup/useEtiquetas';
import { Control } from './features/control/Control';
import { seccionInicial } from '@crm/core/permisos';
import { Agenda } from './features/agenda/Agenda';
import { Tareas } from './features/tareas/Tareas';
import { Duplicados } from './features/duplicados/Duplicados';
import { useDuplicados } from './features/duplicados/useDuplicados';

const TEMAS = ['tema-claro', 'tema-oscuro', 'tema-noche'] as const;

type Seccion = 'followup' | 'control' | 'usuarios';

export function App() {
  const auth = useAuth();

  // Los datos de prospeccion solo se piden si el usuario tiene Follow-up.
  // El Observador tiene verTodosLeads pero NO followup, y §7 dice que no ve
  // telefonos, emails ni links: si igual se bajaran, estarian en su navegador
  // aunque ninguna pantalla los dibuje.
  const usuarioDeFollowup = puedeUsuario(auth.usuario, 'followup') ? auth.usuario : null;

  const { leads, cargando, error, recargar } = useLeads(usuarioDeFollowup);
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [tema, setTema] = useState(0);
  const [vencAbierto, setVencAbierto] = useState(false);
  const [repoAbierto, setRepoAbierto] = useState(false);
  const [dupAbierto, setDupAbierto] = useState(false);
  const [masAbierto, setMasAbierto] = useState(false);
  const [usuarioAbierto, setUsuarioAbierto] = useState(false);
  const [agendaAbierta, setAgendaAbierta] = useState(false);
  const [tareasAbierto, setTareasAbierto] = useState(false);
  /**
   * Qué canal de conversación está abierto, o ninguno. Vive en el header
   * porque la conversación se abre en la columna 1, arriba de la lista: es un
   * solo lugar para los dos canales, y el switch elige cuál.
   */
  const [conv, setConv] = useState<'linkedin' | 'whatsapp' | null>(null);
  /** Los dos filtros de la columna 1: todos, o solo los que tienen sin leer. */
  const [subtab, setSubtab] = useState<'todos' | 'sinleer'>('todos');
  // §5.2: la primera seccion visible es la primera de la lista de permitidas,
  // no Follow-up fijo. Al entrar, el Observador cae en Control.
  const [seccion, setSeccion] = useState<Seccion | null>(null);

  // ---------------------------------------------------- cambios sin guardar
  //
  // §9.3: cruzar de lead o de sección con la ficha editada tiene que preguntar.
  // El estado sucio vive adentro de la ficha (`useFicha`), así que la ficha lo
  // reporta hacia arriba y ACÁ se decide si la navegación pasa o espera.
  const [sucio, setSucio] = useState(false);
  /** Lo que se quiso hacer y quedó esperando la respuesta del aviso. */
  const [pendiente, setPendiente] = useState<{ correr: () => void } | null>(null);
  /** Se incrementa para pedirle a la ficha que guarde ("Guardar y salir"). */
  const [nonceGuardar, setNonceGuardar] = useState(0);
  /** Entre que se pidió guardar y que la ficha avisa que terminó. */
  const [esperandoGuardado, setEsperandoGuardado] = useState(false);

  /**
   * Toda navegación pasa por acá. Sin cambios pendientes ejecuta directo; con
   * cambios, guarda la intención y muestra el aviso.
   */
  function irA(accion: () => void) {
    if (!sucio) return accion();
    setPendiente({ correr: accion });
  }
  const plantillas = usePlantillas(usuarioDeFollowup);
  const { etiquetas: catalogoEtiquetas, recargar: recargarEtiquetas } = useEtiquetas(usuarioDeFollowup);
  // Se carga sin abrir nada, para el contador del header, pero solo para quien
  // puede resolverlos.
  const duplicados = useDuplicados(
    puedeUsuario(auth.usuario, 'importarLeads') ? auth.usuario : null,
  );

  useEffect(() => {
    document.body.className = TEMAS[tema]!;
  }, [tema]);

  // Al entrar (o al cambiar de usuario) se elige la sección de arranque una vez.
  // Si el usuario no tiene ninguna de las tres, queda en null y se le dice.
  useEffect(() => {
    if (!auth.usuario) {
      setSeccion(null);
      return;
    }
    const inicial = seccionInicial({
      rol: auth.usuario.rol as never,
      permisos: auth.usuario.permisos ?? {},
    });
    setSeccion(inicial === 'waPersonal' ? null : inicial);
  }, [auth.usuario?.id]);

  // Si el lead seleccionado deja de estar en la lista (cambió el filtro o el
  // usuario), se cae a la primera fila en vez de quedar en una ficha fantasma.
  useEffect(() => {
    if (leads.length === 0) setSeleccionado(null);
    else if (!leads.some((l) => l.id === seleccionado)) setSeleccionado(leads[0]!.id);
  }, [leads, seleccionado]);

  // Cambiar de seccion cierra los menus del header.
  useEffect(() => {
    setMasAbierto(false);
    setUsuarioAbierto(false);
  }, [seccion]);

  /**
   * «Guardar y salir»: cuando la ficha termina de guardar deja de estar sucia,
   * y recién ahí se deja pasar lo que el usuario quería hacer.
   *
   * Se espera en vez de navegar de una porque guardar puede fallar —la red, una
   * regla del servidor— y en ese caso irse igual perdería lo escrito, que es
   * justo lo que este aviso existe para evitar.
   */
  useEffect(() => {
    if (!esperandoGuardado || sucio) return;
    setEsperandoGuardado(false);
    pendiente?.correr();
    setPendiente(null);
  }, [esperandoGuardado, sucio, pendiente]);

  if (!auth.usuario) return <Login auth={auth} />;

  const nVencidos = leadsVencidos(leads).length;
  const nSinLeerLi = leads.filter((l) => l.sin_leer_li).length;
  const nSinLeerWa = leads.filter((l) => l.sin_leer_wa).length;
  const nSinLeer = leads.filter((l) => l.sin_leer_li || l.sin_leer_wa).length;

  // El subtab filtra la lista de verdad, no solo el conteo del header.
  const visibles = subtab === 'sinleer' ? leads.filter((l) => l.sin_leer_li || l.sin_leer_wa) : leads;
  const lead = visibles.find((l) => l.id === seleccionado) ?? null;

  return (
    <div className="app">
      <header className="header">
        {/* El prototipo NO tiene marca en el header: los 44px de alto son para
            trabajar, no para el logo. Arranca con el switch de conversación. */}
        {seccion === 'followup' && (
          <div
            className="header-conv"
            title="Abrir la conversación del lead. El switch elige el canal (G)"
          >
            {(['linkedin', 'whatsapp'] as const).map((c) => (
              <button
                key={c}
                type="button"
                className={`header-conv-boton ${conv === c ? `header-conv-${c}` : ''}`}
                onClick={() => setConv((a) => (a === c ? null : c))}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <path d="M20 15a3 3 0 01-3 3H8l-4 3V6a3 3 0 013-3h10a3 3 0 013 3z" />
                </svg>
                {c === 'linkedin' ? 'in' : 'wa'}
                <span className="tabular">{c === 'linkedin' ? nSinLeerLi : nSinLeerWa}</span>
              </button>
            ))}
          </div>
        )}

        {/* El orden es el del prototipo, no el mío: Automatizaciones, Control,
            Follow-up, WA Personal, Usuarios. */}
        <nav className="header-tabs">
          {puedeUsuario(auth.usuario, 'automatizaciones') && (
            <span className="tab tab-off tab-pendiente" title="Etapa 5, todavía no construida">
              Automatizaciones
            </span>
          )}
          {puedeUsuario(auth.usuario, 'control') && (
            <button
              type="button"
              className={`tab ${seccion === 'control' ? 'tab-on' : 'tab-off'}`}
              onClick={() => irA(() => setSeccion('control'))}
            >
              Control
            </button>
          )}
          {puedeUsuario(auth.usuario, 'followup') && (
            <button
              type="button"
              className={`tab ${seccion === 'followup' ? 'tab-on' : 'tab-off'}`}
              onClick={() => irA(() => setSeccion('followup'))}
            >
              Follow-up
            </button>
          )}
          {puedeUsuario(auth.usuario, 'waPersonal') && (
            <span className="tab tab-off tab-pendiente" title="Todavía no construida">
              WA Personal
            </span>
          )}
          {puedeUsuario(auth.usuario, 'usuarios') && (
            <button
              type="button"
              className={`tab ${seccion === 'usuarios' ? 'tab-on' : 'tab-off'}`}
              onClick={() => irA(() => setSeccion('usuarios'))}
            >
              Usuarios
            </button>
          )}
        </nav>

        {/* Los dos filtros de la columna 1, con su conteo. Solo en Follow-up. */}
        {seccion === 'followup' && (
          <div className="header-subtabs">
            {(
              [
                ['todos', 'Follow Up', leads.length],
                ['sinleer', 'Sin leer', nSinLeer],
              ] as const
            ).map(([clave, texto, n]) => (
              <button
                key={clave}
                type="button"
                className={`header-subtab ${subtab === clave ? 'header-subtab-on' : ''}`}
                onClick={() => setSubtab(clave)}
              >
                {texto}
                <span className="tabular">{n}</span>
              </button>
            ))}
          </div>
        )}

        <div className="header-derecha">
          <div className="relativo">
            <button
              type="button"
              className="boton-icono-28"
              title="Más herramientas"
              onClick={() => setMasAbierto((a) => !a)}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <circle cx="5" cy="12" r="1.7" />
                <circle cx="12" cy="12" r="1.7" />
                <circle cx="19" cy="12" r="1.7" />
              </svg>
              {duplicados.grupos.length > 0 && (
                <span className="badge-punto tabular">{duplicados.grupos.length}</span>
              )}
            </button>
            {masAbierto && (
              <>
                <div className="popover-fondo" onClick={() => setMasAbierto(false)} />
                <div className="popover popover-anclado header-mas">
                  {puedeUsuario(auth.usuario, 'importarLeads') && (
                    <button
                      type="button"
                      className="header-mas-item"
                      onClick={() => {
                        setDupAbierto(true);
                        setMasAbierto(false);
                      }}
                    >
                      <span>Duplicados sin resolver</span>
                      {duplicados.grupos.length > 0 && (
                        <span className="chip-mini chip-mini-alerta tabular">
                          {duplicados.grupos.length}
                        </span>
                      )}
                    </button>
                  )}
                  {/* Estas cuatro son las del menú en el prototipo. Tareas y
                      Agenda NO van acá: son botones sueltos del header.
                      Las que todavía no existen se listan igual, con el motivo:
                      esconderlas haría creer que el sistema no las contempla. */}
                  {(
                    [
                      ['cuentasConectadas', 'Cuentas conectadas'],
                      ['baseCompartida', 'Base compartida'],
                      ['automatizaciones', 'Reglas y acciones rápidas'],
                    ] as const
                  ).map(([clave, texto]) =>
                    puedeUsuario(auth.usuario, clave) ? (
                      <span key={clave} className="header-mas-item header-mas-off">
                        <span>{texto}</span>
                        <span className="chip-mini">falta</span>
                      </span>
                    ) : null,
                  )}
                  <span className="header-mas-item header-mas-off">
                    <span>Atajos de teclado</span>
                    <span className="chip-mini">falta</span>
                  </span>
                </div>
              </>
            )}
          </div>

          {puedeUsuario(auth.usuario, 'vencimientos') && (
            <button
              type="button"
              className="boton-icono-28"
              onClick={() => setVencAbierto(true)}
              title="Vencimientos de mensajes"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
              {nVencidos > 0 && <span className="badge-punto tabular">{nVencidos}</span>}
            </button>
          )}

          {puedeUsuario(auth.usuario, 'repositorio') && (
            <button
              type="button"
              className="boton-icono-28"
              onClick={() => setRepoAbierto(true)}
              title="Repositorio de mensajes"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="3.5" y="4" width="17" height="16" rx="2" />
                <path d="M3.5 9h17M9 9v11" />
              </svg>
            </button>
          )}

          {/* Tareas, notificaciones y agenda: el prototipo los tiene sueltos,
              en este orden. Los dos que todavía no existen se muestran
              DESHABILITADOS con el motivo en el title, no ocultos: §9.7 dice
              que esconder lo que no se puede usar hace creer que el sistema no
              lo contempla. La excepción son los permisos, que sí ocultan. */}
          {puedeUsuario(auth.usuario, 'tareas') && (
            <button
              type="button"
              className={`boton-icono-28 ${tareasAbierto ? 'boton-icono-on' : ''}`}
              title="Tareas"
              onClick={() => setTareasAbierto(true)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M4 7l2 2 4-4M4 15l2 2 4-4M13 8h7M13 16h7" />
              </svg>
            </button>
          )}

          {/* Esta sí funciona: son los leads con mensajes sin leer, que ya se
              cuentan para el switch del header. */}
          <button
            type="button"
            className="boton-icono-28"
            title={nSinLeer ? `${nSinLeer} con mensajes sin leer` : 'Sin mensajes sin leer'}
            onClick={() => irA(() => {
              setSeccion('followup');
              setSubtab('sinleer');
            })}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M18 8a6 6 0 10-12 0c0 7-2 8-2 8h16s-2-1-2-8z" />
              <path d="M13.7 21a2 2 0 01-3.4 0" />
            </svg>
            {nSinLeer > 0 && <span className="badge-punto tabular">{nSinLeer}</span>}
          </button>

          {puedeUsuario(auth.usuario, 'agenda') && (
            <button
              type="button"
              className={`boton-icono-28 ${agendaAbierta ? 'boton-icono-on' : ''}`}
              title="Agenda"
              onClick={() => setAgendaAbierta((a) => !a)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="3.5" y="5" width="17" height="15" rx="2" />
                <path d="M3.5 10h17M8 3v4M16 3v4" />
              </svg>
            </button>
          )}

          <button
            type="button"
            className="boton-icono-28"
            onClick={() => setTema((t) => (t + 1) % TEMAS.length)}
            title="Tema: claro → oscuro → noche"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z" />
            </svg>
          </button>

          <div className="relativo">
            <button
              type="button"
              className="header-avatar"
              title={`${auth.usuario.name} · ${auth.usuario.rol}`}
              onClick={() => setUsuarioAbierto((a) => !a)}
            >
              {iniciales(auth.usuario.name)}
            </button>
            {usuarioAbierto && (
              <>
                <div className="popover-fondo" onClick={() => setUsuarioAbierto(false)} />
                <div className="popover popover-anclado header-usuario">
                  <span className="header-usuario-nombre">{auth.usuario.name}</span>
                  <span className="campo-ayuda">{auth.usuario.rol}</span>
                  <button type="button" className="boton-mini" onClick={auth.salir}>
                    Salir
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="cuerpo">
        {seccion !== 'control' && cargando && <p className="vacio">Cargando leads…</p>}
        {seccion !== 'control' && error && (
          <div className="aviso-error">
            <strong>No se pudo leer la base.</strong>
            <p>{error}</p>
            <p className="campo-ayuda">
              ¿Está corriendo PocketBase? <code>npm run db:dev -- --seed</code>
            </p>
          </div>
        )}
        {seccion === 'control' && auth.usuario && <Control usuario={auth.usuario} />}

        {!cargando && !error && seccion === 'usuarios' && auth.usuario && (
          <Usuarios usuarioActual={auth.usuario} leads={leads} onCambio={recargar} />
        )}

        {!cargando && !error && seccion === 'followup' && (
          <>
            <ListaContactos
              leads={visibles}
              conversacion={conv}
              onCerrarConversacion={() => setConv(null)}
              seleccionado={seleccionado}
              onSeleccionar={(id) => irA(() => setSeleccionado(id))}
              usuario={auth.usuario}
              verColaboradores={puedeUsuario(auth.usuario, 'verTodosLeads')}
              veTelefono={puedeUsuario(auth.usuario, 'verTelefono')}
              veCola={puedeUsuario(auth.usuario, 'colaEnvios')}
            />
            {lead ? (
              <FichaLead
                lead={lead}
                plantillas={plantillas}
                catalogoEtiquetas={catalogoEtiquetas}
                usuario={auth.usuario}
                onGuardado={recargar}
                leads={leads}
                onEtiquetasCambiadas={recargarEtiquetas}
                onSucio={setSucio}
                nonceGuardar={nonceGuardar}
              />
            ) : (
              <section className="ficha">
                <p className="vacio">Elegí un lead de la lista.</p>
              </section>
            )}

            {/* §7.2: la agenda es un SIDEBAR de Follow-up, no una sección.
                Se abre al lado de la lista para poder mirar la semana sin
                perder de vista en qué lead se estaba. */}
            {agendaAbierta && (
              <Agenda
                leads={leads}
                onCerrar={() => setAgendaAbierta(false)}
                onIrAlLead={(id) => irA(() => setSeleccionado(id))}
              />
            )}
          </>
        )}
      </main>

      {repoAbierto && (
        <Repositorio onCerrar={() => setRepoAbierto(false)} onCambio={recargar} />
      )}

      {dupAbierto && (
        <Duplicados
          duplicados={duplicados}
          onCerrar={() => setDupAbierto(false)}
          onCambio={recargar}
        />
      )}

      {tareasAbierto && (
        <Tareas usuario={auth.usuario} onCerrar={() => setTareasAbierto(false)} />
      )}

      {pendiente && (
        <CambiosSinGuardar
          nombre={lead?.expand?.perfil?.nombre ?? ''}
          onCancelar={() => setPendiente(null)}
          onDescartar={() => {
            // La ficha se remonta con los valores de la base al cambiar de lead,
            // así que descartar es simplemente dejar pasar la navegación.
            setSucio(false);
            pendiente.correr();
            setPendiente(null);
          }}
          onGuardar={() => {
            // Guardar es asíncrono y vive en la ficha. Se le pide por nonce y
            // la navegación espera a que ella avise que ya no está sucia.
            setNonceGuardar((n) => n + 1);
            setEsperandoGuardado(true);
          }}
        />
      )}

      {vencAbierto && (
        <Vencimientos
          leads={leads}
          plantillas={plantillas}
          onCerrar={() => setVencAbierto(false)}
          onCambio={recargar}
        />
      )}
    </div>
  );
}
