import { useEffect, useState } from 'react';
import { useAuth } from './features/auth/useAuth';
import { Login } from './features/auth/Login';
import { useLeads, puedeUsuario } from './features/followup/useLeads';
import { ListaContactos } from './features/followup/ListaContactos';
import { FichaLead } from './features/followup/FichaLead';
import { usePlantillas } from './features/followup/usePlantillas';
import { Vencimientos, leadsVencidos } from './features/vencimientos/Vencimientos';
import { Usuarios } from './features/usuarios/Usuarios';
import { Repositorio } from './features/repositorio/Repositorio';
import { useEtiquetas } from './features/followup/useEtiquetas';
import { Control } from './features/control/Control';
import { seccionInicial } from '@crm/core/permisos';
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
  // §5.2: la primera seccion visible es la primera de la lista de permitidas,
  // no Follow-up fijo. Al entrar, el Observador cae en Control.
  const [seccion, setSeccion] = useState<Seccion | null>(null);
  const plantillas = usePlantillas(usuarioDeFollowup);
  const catalogoEtiquetas = useEtiquetas(usuarioDeFollowup);
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

  if (!auth.usuario) return <Login auth={auth} />;

  const lead = leads.find((l) => l.id === seleccionado) ?? null;
  const nVencidos = leadsVencidos(leads).length;

  return (
    <div className="app">
      <header className="header">
        <strong className="header-marca">CRM Globalita</strong>
        <nav className="header-tabs">
          {puedeUsuario(auth.usuario, 'followup') && (
            <button
              type="button"
              className={`tab ${seccion === 'followup' ? 'tab-on' : 'tab-off'}`}
              onClick={() => setSeccion('followup')}
            >
              Follow-up
            </button>
          )}
          {puedeUsuario(auth.usuario, 'control') && (
            <button
              type="button"
              className={`tab ${seccion === 'control' ? 'tab-on' : 'tab-off'}`}
              onClick={() => setSeccion('control')}
            >
              Control
            </button>
          )}
          {puedeUsuario(auth.usuario, 'automatizaciones') && (
            <span className="tab tab-off" title="Etapa 5, todavía no construida">Automatizaciones</span>
          )}
          {puedeUsuario(auth.usuario, 'usuarios') && (
            <button
              type="button"
              className={`tab ${seccion === 'usuarios' ? 'tab-on' : 'tab-off'}`}
              onClick={() => setSeccion('usuarios')}
            >
              Usuarios
            </button>
          )}
        </nav>

        <div className="header-derecha">
          {puedeUsuario(auth.usuario, 'repositorio') && (
            <button
              type="button"
              className="boton-secundario"
              onClick={() => setRepoAbierto(true)}
              title="Repositorio de mensajes"
            >
              repositorio
            </button>
          )}
          {puedeUsuario(auth.usuario, 'importarLeads') && duplicados.grupos.length > 0 && (
            <button
              type="button"
              className="boton-secundario boton-badge"
              onClick={() => setDupAbierto(true)}
              title="Perfiles que podrían ser la misma persona"
            >
              duplicados
              <span className="badge">{duplicados.grupos.length}</span>
            </button>
          )}
          {puedeUsuario(auth.usuario, 'vencimientos') && (
            <button
              type="button"
              className="boton-secundario boton-badge"
              onClick={() => setVencAbierto(true)}
              title="Vencimientos de mensajes"
            >
              vencimientos
              {nVencidos > 0 && <span className="badge">{nVencidos}</span>}
            </button>
          )}
          <span className="pastilla pastilla-suave">
            {auth.usuario.name} · {auth.usuario.rol}
          </span>
          <button
            type="button"
            className="boton-secundario"
            onClick={() => setTema((t) => (t + 1) % TEMAS.length)}
            title="claro → oscuro → noche"
          >
            tema
          </button>
          <button type="button" className="boton-secundario" onClick={auth.salir}>
            salir
          </button>
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
              leads={leads}
              seleccionado={seleccionado}
              onSeleccionar={setSeleccionado}
              usuario={auth.usuario}
              verColaboradores={puedeUsuario(auth.usuario, 'verTodosLeads')}
              veTelefono={puedeUsuario(auth.usuario, 'verTelefono')}
            />
            {lead ? (
              <FichaLead
                lead={lead}
                plantillas={plantillas}
                catalogoEtiquetas={catalogoEtiquetas}
                usuario={auth.usuario}
                onGuardado={recargar}
              />
            ) : (
              <section className="ficha">
                <p className="vacio">Elegí un lead de la lista.</p>
              </section>
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
