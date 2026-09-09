import { useEffect, useMemo, useState } from 'react';
import { comoSeCompara, leadsParecidos, type PersonaDelCalendario } from '@crm/core/vincular';
import { pb } from '../../lib/pocketbase';
import { useEscape } from '../../lib/useEscape';
import { NuevoLead } from '../alta/NuevoLead';

/**
 * Conectar los eventos de una persona del calendario con un lead (§7.6).
 *
 * POR QUÉ ESTA PANTALLA EXISTE. La agenda dibuja las 288 reuniones del CRM y
 * los 1769 eventos que bajaron de Google. Los segundos no tienen lead detrás,
 * y por eso se ven distinto. Augusto lo leyó como un problema de color; el
 * color decía la verdad y lo que faltaba era el vínculo.
 *
 * POR PERSONA, NO POR EVENTO. Son 278 eventos de prospección sueltos, pero
 * sólo 145 personas: «FabriPT Catchup Herik» aparece 45 veces y «Brenno» 38.
 * Conectar de a un evento serían 278 decisiones para 145 respuestas, y las dos
 * primeras ya resuelven un tercio. Por eso lo que se elige acá vale para
 * TODOS los eventos de esa persona, de una.
 *
 * NO ADIVINA. Los leads se ordenan por parecido —los que comparten una palabra
 * del nombre van arriba— pero elige una persona. Es la misma decisión de
 * Duplicados y por el mismo motivo: juntar a dos personas distintas es el error
 * caro, y deshacerlo después cuesta más que elegir bien ahora.
 */
interface LeadParaElegir {
  id: string;
  nombre: string;
  empresa: string;
  cuenta: string;
  telefono: string;
}

export function ConectarEvento({
  persona,
  onVincular,
  onCerrar,
  onConectado,
}: {
  persona: PersonaDelCalendario;
  /**
   * Quién escribe el vínculo. Lo hace `useAgenda`, no esta pantalla: la
   * escritura y la recarga van juntas y viven donde vive el estado.
   */
  onVincular: (ids: string[], leadId: string) => Promise<void>;
  onCerrar: () => void;
  onConectado: () => void;
}) {
  useEscape(onCerrar);
  const [leads, setLeads] = useState<LeadParaElegir[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    pb.collection('lead')
      .getFullList<{
        id: string;
        expand?: {
          perfil?: { nombre?: string; empresa?: string; telefono?: string };
          cuenta?: { abrev?: string };
        };
      }>({ expand: 'perfil,cuenta', sort: 'created' })
      .then((todos) => {
        if (!vivo) return;
        setLeads(
          todos.map((l) => ({
            id: l.id,
            nombre: l.expand?.perfil?.nombre ?? '(sin nombre)',
            empresa: l.expand?.perfil?.empresa ?? '',
            cuenta: l.expand?.cuenta?.abrev ?? '',
            telefono: l.expand?.perfil?.telefono ?? '',
          })),
        );
        setCargando(false);
      })
      .catch((e) => {
        if (!vivo) return;
        setError(e instanceof Error ? e.message : String(e));
        setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, []);

  const ordenados = useMemo(() => {
    const texto = comoSeCompara(busqueda.trim());
    const filtrados = texto
      ? leads.filter(
          (l) => comoSeCompara(l.nombre).includes(texto) || comoSeCompara(l.empresa).includes(texto),
        )
      : leads;
    // Con búsqueda manda lo que escribió; sin búsqueda, los parecidos primero.
    return texto ? filtrados : leadsParecidos(persona.nombre, filtrados, (l) => l.nombre);
  }, [leads, busqueda, persona.nombre]);

  const cuantosParecidos = useMemo(() => {
    const palabras = new Set(
      comoSeCompara(persona.nombre)
        .split(' ')
        .filter((x) => x.length > 2),
    );
    if (!palabras.size) return 0;
    return leads.filter((l) =>
      comoSeCompara(l.nombre)
        .split(' ')
        .some((x) => palabras.has(x)),
    ).length;
  }, [leads, persona.nombre]);

  async function conectar(leadId: string) {
    setGuardando(leadId);
    setError(null);
    try {
      await onVincular(persona.eventos, leadId);
      onConectado();
      onCerrar();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setGuardando(null);
    }
  }

  // Crear el lead reusa el alta de siempre —con su detección de duplicados y
  // su elección de cuenta— en vez de tener un alta propia acá. Al volver con
  // el id, engancha los eventos sin que haya que buscarlo de nuevo.
  if (creando) {
    return (
      <NuevoLead
        nombre={persona.nombre}
        onCerrar={() => setCreando(false)}
        onCreado={(id) => void conectar(id)}
      />
    );
  }

  const rango =
    persona.desde && persona.hasta && persona.desde.slice(0, 10) !== persona.hasta.slice(0, 10)
      ? `${persona.desde.slice(0, 10)} → ${persona.hasta.slice(0, 10)}`
      : persona.hasta.slice(0, 10);

  return (
    <div className="overlay-fondo" onClick={onCerrar}>
      <div className="overlay-caja overlay-medio" onClick={(e) => e.stopPropagation()}>
        <header className="overlay-header">
          <span className="overlay-titulo">Conectar con un lead</span>
          <span className="campo-ayuda">{cargando ? 'leyendo…' : `${leads.length} leads`}</span>
          <button type="button" className="boton-icono-26 al-final" title="Cerrar" onClick={onCerrar}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        <div className="overlay-cuerpo">
          <span className="campo-ayuda">
            En el calendario esta persona figura como <b>{persona.nombre}</b>.{' '}
            {persona.cuantos === 1
              ? 'Tiene 1 evento'
              : `Tiene ${persona.cuantos} eventos, y se conectan los ${persona.cuantos} de una`}
            {rango && <> · {rango}</>}.
          </span>

          <label className="campo">
            <input
              autoFocus
              value={busqueda}
              placeholder="Buscar el lead por nombre o empresa…"
              onChange={(e) => setBusqueda(e.target.value)}
            />
            {!busqueda && cuantosParecidos > 0 && (
              <span className="campo-ayuda">
                {cuantosParecidos === 1
                  ? 'Hay 1 que comparte una palabra del nombre: va primero.'
                  : `Hay ${cuantosParecidos} que comparten alguna palabra del nombre: van primero.`}
              </span>
            )}
            {!busqueda && !cargando && cuantosParecidos === 0 && (
              <span className="campo-ayuda">
                Ningún lead comparte una palabra con ese nombre. Puede estar cargado con el nombre
                completo —«Brenno» contra «Brenno Silva»— o no existir todavía.
              </span>
            )}
          </label>

          {error && <div className="login-error">{error}</div>}

          <div className="conectar-lista">
            {ordenados.slice(0, 60).map((l) => (
              <button
                key={l.id}
                type="button"
                className="dest-opcion"
                disabled={guardando !== null}
                onClick={() => void conectar(l.id)}
              >
                <span className="dest-opcion-texto">
                  <span className="dest-opcion-titulo">
                    <b>{l.nombre}</b>
                    {l.empresa && <span className="campo-ayuda">{l.empresa}</span>}
                    {l.cuenta && <span className="pastilla">{l.cuenta}</span>}
                  </span>
                  {l.telefono && <span className="campo-ayuda tabular">{l.telefono}</span>}
                </span>
                <span className="campo-ayuda">
                  {guardando === l.id
                    ? `conectando ${persona.cuantos}…`
                    : persona.cuantos === 1
                      ? 'conectar'
                      : `conectar los ${persona.cuantos}`}
                </span>
              </button>
            ))}

            {!cargando && ordenados.length === 0 && (
              <span className="campo-ayuda">Ningún lead con ese nombre.</span>
            )}
            {ordenados.length > 60 && (
              <span className="campo-ayuda">
                …y {ordenados.length - 60} más. Escribí para achicar la lista.
              </span>
            )}
          </div>

          {/* De las 145 personas del calendario sin lead, 55 no tienen ningún
              lead parecido: nunca se cargaron. Sin esta salida, para más de un
              tercio esta pantalla no tendría respuesta posible. */}
          <button
            type="button"
            className="boton-mini"
            disabled={guardando !== null}
            onClick={() => setCreando(true)}
          >
            No está en la lista: crear el lead «{persona.nombre}»
          </button>
        </div>
      </div>
    </div>
  );
}
