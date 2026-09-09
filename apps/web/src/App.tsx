import { useEffect, useState } from 'react';
import { pb } from './lib/pocketbase';
import type { UsuarioRecord } from './lib/types';
import { useAuth } from './features/auth/useAuth';
import { Login } from './features/auth/Login';
import { Invitacion } from './features/auth/Invitacion';
import { PARAMETRO_INVITACION } from '@crm/core/alta';
import { useLeads, puedeUsuario } from './features/followup/useLeads';
import { ListaContactos, iniciales } from './features/followup/ListaContactos';
import { FichaLead } from './features/followup/FichaLead';
import { CambiosSinGuardar } from './features/followup/CambiosSinGuardar';
import { usePlantillas } from './features/followup/usePlantillas';
import { Vencimientos, leadsVencidos } from './features/vencimientos/Vencimientos';
import { Usuarios } from './features/usuarios/Usuarios';
import { Repositorio } from './features/repositorio/Repositorio';
import { Atajos } from './features/shell/Atajos';
import { CuentasConectadas } from './features/shell/CuentasConectadas';
import { Notificaciones } from './features/shell/Notificaciones';
import { useEtiquetas } from './features/followup/useEtiquetas';
import { Control } from './features/control/Control';
import { seccionInicial } from '@crm/core/permisos';
import { Agenda } from './features/agenda/Agenda';
import { Tareas } from './features/tareas/Tareas';
import { Duplicados } from './features/duplicados/Duplicados';
import { useDuplicados } from './features/duplicados/useDuplicados';
import { Automatizaciones } from './features/automatizaciones/Automatizaciones';
import { WaPersonal } from './features/wapersonal/WaPersonal';
import { BaseCompartida } from './features/compartida/BaseCompartida';
import { ImportarCsv } from './features/importar/ImportarCsv';
import { NuevoLead } from './features/alta/NuevoLead';
import { Reglas } from './features/reglas/Reglas';

const TEMAS = ['tema-claro', 'tema-oscuro', 'tema-noche'] as const;

type Seccion = 'followup' | 'control' | 'usuarios' | 'automatizaciones' | 'wapersonal';

/**
 * Las secciones que traen sus propios datos y no dependen de `useLeads`.
 * Sin esto, entrar a Control o Automatizaciones mostraba «Cargando leads…»
 * arriba de una pantalla que no usa ni un lead de esa carga.
 */
const CON_DATOS_PROPIOS: Seccion[] = ['control', 'automatizaciones', 'wapersonal'];

export function App() {
  const auth = useAuth();

  const [viendoComo, setViendoComo] = useState<UsuarioRecord | null>(null);
  const [otrosUsuarios, setOtrosUsuarios] = useState<UsuarioRecord[]>([]);
  /**
   * El token del correo de invitación, si la URL lo trae.
   *
   * Se lee una sola vez al arrancar: después la URL se limpia, y volver a
   * leerla en cada render haría reaparecer la pantalla.
   */
  const [tokenInvitacion, setTokenInvitacion] = useState<string | null>(() => {
    try {
      return new URLSearchParams(window.location.search).get(PARAMETRO_INVITACION);
    } catch {
      return null;
    }
  });
  /**
   * Qué etiquetas se ven primero en la fila de la lista (§7.2).
   *
   * Es una preferencia de quien mira y por eso vive en el navegador, no en el
   * lead ni en el usuario: cuál etiqueta importa depende de para qué se esté
   * usando la lista ese día, y no tiene por qué ser igual para todo el equipo.
   */
  const [etiquetasPreferidas, setEtiquetasPreferidas] = useState<string[]>(() => {
    try {
      const v = localStorage.getItem('crm.etiquetas-en-la-fila');
      return v ? (JSON.parse(v) as string[]) : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('crm.etiquetas-en-la-fila', JSON.stringify(etiquetasPreferidas));
    } catch {
      // Sin almacenamiento (ventana privada) la preferencia dura la sesión.
    }
  }, [etiquetasPreferidas]);

  /**
   * Quién manda para lo que se DIBUJA.
   *
   * `auth.usuario` sigue siendo quien está autenticado —las peticiones salen
   * con su token y el servidor le contesta lo suyo—; `usuario` es desde qué
   * ojos se mira. Mientras se mira como otro, la barra de arriba lo dice: sin
   * eso es demasiado fácil quedarse ahí y reportar como bug lo que es el
   * permiso del otro funcionando.
   */
  const usuarioReal = auth.usuario;
  const usuario = viendoComo ?? auth.usuario;

  // Los usuarios a los que se puede mirar. Sólo para el administrador, y sólo
  // los activos: entrar como uno suspendido no muestra nada útil.
  useEffect(() => {
    if (usuarioReal?.rol !== 'administrador') {
      setOtrosUsuarios([]);
      return;
    }
    let vivo = true;
    pb.collection('users')
      .getFullList<UsuarioRecord>({ filter: 'estado = "activo"', sort: 'name' })
      .then((r) => vivo && setOtrosUsuarios(r.filter((u) => u.id !== usuarioReal.id)))
      .catch(() => vivo && setOtrosUsuarios([]));
    return () => {
      vivo = false;
    };
  }, [usuarioReal?.id, usuarioReal?.rol]);


  // Los datos de prospeccion solo se piden si el usuario tiene Follow-up.
  // El Observador tiene verTodosLeads pero NO followup, y §7 dice que no ve
  // telefonos, emails ni links: si igual se bajaran, estarian en su navegador
  // aunque ninguna pantalla los dibuje.
  const usuarioDeFollowup = puedeUsuario(usuario, 'followup') ? usuario : null;

  const { leads, cargando, error, recargar } = useLeads(usuarioDeFollowup);
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [tema, setTema] = useState(0);
  const [vencAbierto, setVencAbierto] = useState(false);
  const [repoAbierto, setRepoAbiertoBruto] = useState(false);
  const [dupAbierto, setDupAbierto] = useState(false);
  const [masAbierto, setMasAbierto] = useState(false);
  const [atajosAbiertos, setAtajosAbiertos] = useState(false);
  const [cuentasAbiertas, setCuentasAbiertas] = useState(false);
  /** El resultado de la vuelta de Google, tal como lo mandó el servidor. */
  const [avisoGoogle, setAvisoGoogle] = useState<string | null>(null);
  const [notifAbiertas, setNotifAbiertas] = useState(false);
  const [usuarioAbierto, setUsuarioAbierto] = useState(false);
  const [agendaAbierta, setAgendaAbiertaBruto] = useState(false);

  /**
   * La vuelta de Google (§8.3).
   *
   * El callback del servidor no puede devolver una pantalla: acá llega el
   * navegador redirigido desde Google. Así que deja el resultado en la URL
   * (`/?google=conectado`) y la aplicación lo levanta al arrancar, abre la
   * pantalla donde se ve el estado y lo muestra ahí.
   *
   * El parámetro se saca de la URL apenas se lee. Si quedara, recargar la
   * página volvería a mostrar «conectado» sin que nadie se haya conectado, que
   * es peor que no avisar nada.
   */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const msg = params.get('google');
    if (!msg) return;
    setAvisoGoogle(msg);
    setCuentasAbiertas(true);
    params.delete('google');
    const resto = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (resto ? `?${resto}` : ''));
  }, []);

  // §7.2: «Sidebars (una a la vez)». En una laptop de 14" las dos al mismo
  // tiempo dejan la ficha en 300 px, que es no poder trabajar con ninguna.
  const setRepoAbierto = (v: boolean | ((x: boolean) => boolean)) => {
    setRepoAbiertoBruto((x) => {
      const n = typeof v === 'function' ? v(x) : v;
      if (n) setAgendaAbiertaBruto(false);
      return n;
    });
  };
  const setAgendaAbierta = (v: boolean | ((x: boolean) => boolean)) => {
    setAgendaAbiertaBruto((x) => {
      const n = typeof v === 'function' ? v(x) : v;
      if (n) setRepoAbiertoBruto(false);
      return n;
    });
  };
  const [tareasAbierto, setTareasAbierto] = useState(false);
  const [compartidaAbierta, setCompartidaAbierta] = useState(false);
  const [importarAbierto, setImportarAbierto] = useState(false);
  const [nuevoAbierto, setNuevoAbierto] = useState(false);
  const [reglasAbiertas, setReglasAbiertas] = useState(false);
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
  const { plantillas, recargar: recargarPlantillas } = usePlantillas(usuarioDeFollowup);
  const { etiquetas: catalogoEtiquetas, recargar: recargarEtiquetas } = useEtiquetas(usuarioDeFollowup);
  // Se carga sin abrir nada, para el contador del header, pero solo para quien
  // puede resolverlos.
  const duplicados = useDuplicados(
    puedeUsuario(usuario, 'importarLeads') ? usuario : null,
  );

  useEffect(() => {
    document.body.className = TEMAS[tema]!;
  }, [tema]);

  // Al entrar (o al cambiar de usuario) se elige la sección de arranque una vez.
  // Si el usuario no tiene ninguna de las tres, queda en null y se le dice.
  useEffect(() => {
    if (!usuario) {
      setSeccion(null);
      return;
    }
    const inicial = seccionInicial({
      rol: usuario.rol as never,
      permisos: usuario.permisos ?? {},
    });
    setSeccion(inicial === 'waPersonal' ? 'wapersonal' : inicial);
  }, [usuario?.id]);

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

  // El enlace del correo de alta (§6.7). Va ANTES del login: quien lo abre
  // todavía no tiene con qué entrar, y mandarlo al login sería mandarlo a un
  // formulario que no puede completar.
  if (tokenInvitacion) {
    return (
      <Invitacion
        token={tokenInvitacion}
        onListo={() => {
          // Se saca el token de la URL para que recargar no vuelva a abrir la
          // pantalla con un enlace que ya se quemó.
          window.history.replaceState({}, '', '/');
          setTokenInvitacion(null);
        }}
      />
    );
  }

  if (!usuario) return <Login auth={auth} />;

  const nVencidos = leadsVencidos(leads).length;
  const nSinLeerLi = leads.filter((l) => l.sin_leer_li).length;
  const nSinLeerWa = leads.filter((l) => l.sin_leer_wa).length;
  const nSinLeer = leads.filter((l) => l.sin_leer_li || l.sin_leer_wa).length;

  /**
   * Si el menú `···` tiene algo adentro (§7.1).
   *
   * «Atajos de teclado» no cuenta: es de la aplicación, no una herramienta con
   * permiso, y un menú que sólo la tiene es un botón que promete y no da.
   */
  const tieneMas =
    puedeUsuario(usuario, 'importarLeads') ||
    puedeUsuario(usuario, 'baseCompartida') ||
    puedeUsuario(usuario, 'automatizaciones') ||
    puedeUsuario(usuario, 'cuentasConectadas');

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
          {puedeUsuario(usuario, 'automatizaciones') && (
            <button
              type="button"
              className={`tab ${seccion === 'automatizaciones' ? 'tab-on' : 'tab-off'}`}
              onClick={() => irA(() => setSeccion('automatizaciones'))}
            >
              Automatizaciones
            </button>
          )}
          {puedeUsuario(usuario, 'control') && (
            <button
              type="button"
              className={`tab ${seccion === 'control' ? 'tab-on' : 'tab-off'}`}
              onClick={() => irA(() => setSeccion('control'))}
            >
              Control
            </button>
          )}
          {puedeUsuario(usuario, 'followup') && (
            <button
              type="button"
              className={`tab ${seccion === 'followup' ? 'tab-on' : 'tab-off'}`}
              onClick={() => irA(() => setSeccion('followup'))}
            >
              Follow-up
            </button>
          )}
          {puedeUsuario(usuario, 'waPersonal') && (
            <button
              type="button"
              className={`tab ${seccion === 'wapersonal' ? 'tab-on' : 'tab-off'}`}
              onClick={() => irA(() => setSeccion('wapersonal'))}
            >
              WA Personal
            </button>
          )}
          {puedeUsuario(usuario, 'usuarios') && (
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
          {/* §7.1: «el de ··· requiere al menos una de las herramientas que
              contiene». Con el preset de Observador quedan dos controles: chip
              de usuario y tema — y un menú de una sola opción («Atajos») es
              justamente lo que la regla evita. */}
          {tieneMas && (
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
                  {puedeUsuario(usuario, 'importarLeads') && (
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
                  {puedeUsuario(usuario, 'baseCompartida') && (
                    <button
                      type="button"
                      className="header-mas-item"
                      onClick={() => {
                        setMasAbierto(false);
                        irA(() => setCompartidaAbierta(true));
                      }}
                    >
                      <span>Base compartida</span>
                    </button>
                  )}
                  {puedeUsuario(usuario, 'automatizaciones') && (
                    <button
                      type="button"
                      className="header-mas-item"
                      onClick={() => {
                        setMasAbierto(false);
                        irA(() => setReglasAbiertas(true));
                      }}
                    >
                      <span>Reglas y acciones rápidas</span>
                    </button>
                  )}
                  {puedeUsuario(usuario, 'cuentasConectadas') && (
                    <button
                      type="button"
                      className="header-mas-item"
                      onClick={() => {
                        setMasAbierto(false);
                        setCuentasAbiertas(true);
                      }}
                    >
                      <span>Cuentas conectadas</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="header-mas-item"
                    onClick={() => {
                      setMasAbierto(false);
                      setAtajosAbiertos(true);
                    }}
                  >
                    <span>Atajos de teclado</span>
                  </button>
                </div>
              </>
            )}
            {atajosAbiertos && <Atajos onCerrar={() => setAtajosAbiertos(false)} />}
          </div>
          )}

          {puedeUsuario(usuario, 'vencimientos') && (
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

          {puedeUsuario(usuario, 'repositorio') && (
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
          {puedeUsuario(usuario, 'tareas') && (
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
          {/* §7.1: el icono aparece sólo si el usuario tiene lo que abre. */}
          {(puedeUsuario(usuario, 'followup') || puedeUsuario(usuario, 'waPersonal')) && (
            <div className="relativo">
              <button
                type="button"
                className={`boton-icono-28 ${notifAbiertas ? 'boton-icono-on' : ''}`}
                title={nSinLeer ? `${nSinLeer} con mensajes sin leer` : 'Sin mensajes sin leer'}
                onClick={() => setNotifAbiertas((a) => !a)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M18 8a6 6 0 10-12 0c0 7-2 8-2 8h16s-2-1-2-8z" />
                  <path d="M13.7 21a2 2 0 01-3.4 0" />
                </svg>
                {nSinLeer > 0 && <span className="badge-punto tabular">{nSinLeer}</span>}
              </button>
              {notifAbiertas && (
                <Notificaciones
                  leads={leads.filter((l) => l.sin_leer_li || l.sin_leer_wa)}
                  waPersonal={0}
                  onIrAlLead={(id, canal) =>
                    irA(() => {
                      setSeccion('followup');
                      setSeleccionado(id);
                      setConv(canal);
                    })
                  }
                  onIrAWaPersonal={() => irA(() => setSeccion('wapersonal'))}
                  onCerrar={() => setNotifAbiertas(false)}
                  onCambio={recargar}
                />
              )}
            </div>
          )}

          {puedeUsuario(usuario, 'agenda') && (
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
              title={`${usuario.name} · ${usuario.rol}`}
              onClick={() => setUsuarioAbierto((a) => !a)}
            >
              {iniciales(usuario.name)}
            </button>
            {usuarioAbierto && (
              <>
                <div className="popover-fondo" onClick={() => setUsuarioAbierto(false)} />
                <div className="popover popover-anclado header-usuario">
                  <span className="header-usuario-nombre">{usuario.name}</span>
                  <span className="campo-ayuda">{usuario.rol}</span>

                  {/* §6.4: sólo un administrador, y sólo mientras dure la
                      pestaña. «Volver a mi usuario» regresa. */}
                  {usuarioReal?.rol === 'administrador' && (
                    <>
                      {viendoComo ? (
                        <button
                          type="button"
                          className="boton-mini"
                          onClick={() => {
                            setViendoComo(null);
                            setUsuarioAbierto(false);
                          }}
                        >
                          Volver a mi usuario
                        </button>
                      ) : (
                        <>
                          <span className="campo-label">Ver el CRM como</span>
                          <div className="header-usuario-otros">
                            {otrosUsuarios.map((u) => (
                              <button
                                key={u.id}
                                type="button"
                                className="header-mas-item"
                                title={`Ver lo que ve ${u.name} (${u.rol})`}
                                onClick={() => {
                                  setViendoComo(u);
                                  setUsuarioAbierto(false);
                                }}
                              >
                                <span>{u.name}</span>
                                <span className="chip-mini">{u.rol}</span>
                              </button>
                            ))}
                            {!otrosUsuarios.length && (
                              <span className="campo-ayuda">No hay otros usuarios activos.</span>
                            )}
                          </div>
                        </>
                      )}
                    </>
                  )}

                  <button type="button" className="boton-mini" onClick={auth.salir}>
                    Salir
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {viendoComo && (
        <div className="vercomo">
          <span>
            Estás viendo el CRM como <strong>{viendoComo.name}</strong> ({viendoComo.rol}).
          </span>
          {/* Honesto: cambia lo que se DIBUJA, no lo que el servidor contesta.
              §6.4 lo llama herramienta de soporte y no suplantación auditada, y
              esto es exactamente eso. */}
          <span className="campo-ayuda">
            Cambia lo que se muestra, no con qué permisos se pide: las peticiones siguen saliendo
            con tu sesión.
          </span>
          <button type="button" className="boton-mini al-final" onClick={() => setViendoComo(null)}>
            Volver a mi usuario
          </button>
        </div>
      )}

      <main className="cuerpo">
        {seccion && !CON_DATOS_PROPIOS.includes(seccion) && cargando && (
          <p className="vacio">Cargando leads…</p>
        )}
        {seccion && !CON_DATOS_PROPIOS.includes(seccion) && error && (
          <div className="aviso-error">
            <strong>No se pudo leer la base.</strong>
            <p>{error}</p>
            <p className="campo-ayuda">
              ¿Está corriendo PocketBase? <code>npm run db:dev -- --seed</code>
            </p>
          </div>
        )}
        {seccion === 'control' && usuario && <Control usuario={usuario} />}

        {seccion === 'automatizaciones' && <Automatizaciones />}

        {/* Mover un chat a Follow-up abre la ficha del lead recién creado: la
            acción no termina hasta que se ve dónde quedó. */}
        {seccion === 'wapersonal' && (
          <WaPersonal
            onIrAlLead={(id) => {
              setSeleccionado(id);
              setSeccion('followup');
              recargar();
            }}
          />
        )}

        {/* Acá va el usuario REAL, no el que se está «viendo como».
            Los tres chequeos de identidad de esta pantalla —no editarte los
            permisos, no reiniciarte la clave, no darte de baja— existen porque
            el servidor los va a rechazar, y el servidor mira quién está
            autenticado, no a quién se está mirando. Con el impersonado, el
            botón de baja aparecía sobre el usuario con el que uno estaba
            conectado y PocketBase devolvía un 404 sin explicar nada. */}
        {!cargando && !error && seccion === 'usuarios' && usuario && usuarioReal && (
          <Usuarios usuarioActual={usuarioReal} leads={leads} onCambio={recargar} />
        )}

        {!cargando && !error && seccion === 'followup' && (
          <>
            <ListaContactos
              leads={visibles}
              conversacion={conv}
              onCerrarConversacion={() => setConv(null)}
              seleccionado={seleccionado}
              onSeleccionar={(id) => irA(() => setSeleccionado(id))}
              usuario={usuario}
              verColaboradores={puedeUsuario(usuario, 'verTodosLeads')}
              veTelefono={puedeUsuario(usuario, 'verTelefono')}
              veCola={puedeUsuario(usuario, 'colaEnvios')}
              // Reasignar desde la fila. La lista de gente es la misma que la
              // de «ver como», más uno mismo: son los usuarios activos.
              usuarios={
                usuarioReal && puedeUsuario(usuario, 'usuarios')
                  ? [usuarioReal, ...otrosUsuarios]
                  : []
              }
              puedeAsignar={puedeUsuario(usuario, 'usuarios')}
              onAsignar={async (leadId, usuarioId) => {
                await pb.collection('lead').update(leadId, { asignado: usuarioId ?? '' });
                recargar();
              }}
              preferidas={etiquetasPreferidas}
              onPreferidas={setEtiquetasPreferidas}
              onImportar={
                puedeUsuario(usuario, 'importarLeads')
                  ? () => irA(() => setImportarAbierto(true))
                  : undefined
              }
              onNuevo={
                puedeUsuario(usuario, 'importarLeads')
                  ? () => irA(() => setNuevoAbierto(true))
                  : undefined
              }
            />
            {lead ? (
              <FichaLead
                lead={lead}
                plantillas={plantillas}
                onPlantillasCambiadas={recargarPlantillas}
                catalogoEtiquetas={catalogoEtiquetas}
                usuario={usuario}
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
                usuario={usuario}
                seleccionado={seleccionado}
                onCerrar={() => setAgendaAbierta(false)}
                onIrAlLead={(id) => irA(() => setSeleccionado(id))}
              />
            )}

            {/* §7.9: el repositorio también es un SIDEBAR, no un modal. Se
                edita una plantilla justo cuando se la está mirando contra el
                lead al que se le va a mandar, y un modal tapa exactamente eso. */}
            {repoAbierto && (
              <Repositorio
                cuentaActual={
                  leads.find((l) => l.id === seleccionado)?.expand?.cuenta?.abrev ?? ''
                }
                onCerrar={() => setRepoAbierto(false)}
                onCambio={() => {
                  recargar();
                  recargarPlantillas();
                }}
              />
            )}
          </>
        )}
      </main>


      {cuentasAbiertas && (
        <CuentasConectadas
          avisoGoogle={avisoGoogle}
          onCerrar={() => {
            setCuentasAbiertas(false);
            setAvisoGoogle(null);
          }}
        />
      )}

      {dupAbierto && (
        <Duplicados
          duplicados={duplicados}
          onCerrar={() => setDupAbierto(false)}
          onCambio={recargar}
        />
      )}

      {tareasAbierto && (
        <Tareas
          usuario={usuario}
          onCerrar={() => setTareasAbierto(false)}
          // Los vencimientos, al lado. Solo con el permiso: sin el, el panel
          // no existe y Tareas queda como estaba.
          leads={puedeUsuario(usuario, 'vencimientos') ? leads : undefined}
          plantillas={puedeUsuario(usuario, 'vencimientos') ? plantillas : undefined}
          onCambio={recargar}
          // Una tarea sobre un lead tiene que poder llevar a su ficha; si no,
          // hay que buscarlo a mano en una lista de 1.500.
          onIrAlLead={(id) => {
            setTareasAbierto(false);
            irA(() => {
              setSeleccionado(id);
              setSeccion('followup');
            });
          }}
        />
      )}

      {compartidaAbierta && <BaseCompartida onCerrar={() => setCompartidaAbierta(false)} />}

      {reglasAbiertas && <Reglas onCerrar={() => setReglasAbiertas(false)} />}

      {/* §7.2: el alta a mano. La cuenta que propone es la del lead abierto
          —lo más probable es que el contacto nuevo venga de la misma tanda— y
          queda asignado a quien lo carga. */}
      {nuevoAbierto && (
        <NuevoLead
          cuenta={lead?.cuenta ?? leads[0]?.cuenta ?? ''}
          asignado={usuarioReal?.id ?? ''}
          onCerrar={() => setNuevoAbierto(false)}
          onCreado={(id) => {
            // Primero la recarga y DESPUÉS la selección: el efecto que evita
            // fichas fantasma tira la selección a la primera fila si el id no
            // está en la lista, y recién está cuando la recarga terminó.
            void recargar().then(() => setSeleccionado(id));
          }}
        />
      )}

      {importarAbierto && (
        <ImportarCsv
          leads={leads}
          cuenta={lead?.cuenta ?? leads[0]?.cuenta ?? ''}
          onCerrar={() => setImportarAbierto(false)}
          onImportado={recargar}
        />
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
