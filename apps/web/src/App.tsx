import { useEffect, useState } from 'react';
import { useAuth } from './features/auth/useAuth';
import { Login } from './features/auth/Login';
import { useLeads, puedeUsuario } from './features/followup/useLeads';
import { ListaContactos } from './features/followup/ListaContactos';
import { FichaLead } from './features/followup/FichaLead';
import { usePlantillas } from './features/followup/usePlantillas';
import { Vencimientos, leadsVencidos } from './features/vencimientos/Vencimientos';
import { useEtiquetas } from './features/followup/useEtiquetas';

const TEMAS = ['tema-claro', 'tema-oscuro', 'tema-noche'] as const;

export function App() {
  const auth = useAuth();
  const { leads, cargando, error, recargar } = useLeads(auth.usuario);
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [tema, setTema] = useState(0);
  const [vencAbierto, setVencAbierto] = useState(false);
  const plantillas = usePlantillas(auth.usuario);
  const catalogoEtiquetas = useEtiquetas(auth.usuario);

  useEffect(() => {
    document.body.className = TEMAS[tema]!;
  }, [tema]);

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
          <span className="tab tab-on">Follow-up</span>
          {puedeUsuario(auth.usuario, 'automatizaciones') && (
            <span className="tab tab-off" title="Etapa 5">Automatizaciones</span>
          )}
          {puedeUsuario(auth.usuario, 'usuarios') && (
            <span className="tab tab-off" title="Etapa 6">Usuarios</span>
          )}
        </nav>

        <div className="header-derecha">
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
        {cargando && <p className="vacio">Cargando leads…</p>}
        {error && (
          <div className="aviso-error">
            <strong>No se pudo leer la base.</strong>
            <p>{error}</p>
            <p className="campo-ayuda">
              ¿Está corriendo PocketBase? <code>npm run db:dev -- --seed</code>
            </p>
          </div>
        )}
        {!cargando && !error && (
          <>
            <ListaContactos
              leads={leads}
              seleccionado={seleccionado}
              onSeleccionar={setSeleccionado}
              usuario={auth.usuario}
              verColaboradores={puedeUsuario(auth.usuario, 'verTodosLeads')}
            />
            {lead ? (
              <FichaLead
                lead={lead}
                plantillas={plantillas}
                catalogoEtiquetas={catalogoEtiquetas}
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
