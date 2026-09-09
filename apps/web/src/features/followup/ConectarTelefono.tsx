import { useEffect, useMemo, useState } from 'react';
import { pb } from '../../lib/pocketbase';
import { useEscape } from '../../lib/useEscape';
import { normalizar } from '@crm/core/cruce';

/**
 * Conectar un lead con un teléfono que ya está en la base (§7.2, §13).
 *
 * EL PROBLEMA. Los datos entraron por dos puertas y no se tocan. Los leads
 * salieron del calendario —tienen nombre, correo y reuniones— y los teléfonos
 * salieron de dos exportaciones de contactos de WhatsApp, que entraron como
 * perfiles sin lead. Hoy: **167 leads sin teléfono y 168 teléfonos sin lead**.
 *
 * Duplicados cruzó los que tenían el nombre igual —76— y ahí se terminó lo que
 * se puede hacer solo: el resto no coincide exacto («Marcelo Carneiro» contra
 * «Marcelo Carñero») y adivinar de más junta a dos personas distintas, que es
 * el error caro.
 *
 * Así que lo decide una persona. Acá se busca por nombre entre los teléfonos
 * huérfanos y se conecta el que corresponde.
 *
 * QUÉ HACE AL CONECTAR. Copia el teléfono al perfil del lead y marca el perfil
 * de origen como fusionado. **No borra nada**: el perfil del CSV queda con su
 * `fusionado_en` apuntando al que quedó, igual que en Duplicados, así que
 * siempre se puede ver de dónde salió ese número.
 */
interface PerfilConTelefono {
  id: string;
  nombre: string;
  telefono: string;
  telefono_raw: string;
  telefono_valido: boolean;
  empresa: string;
}

export function ConectarTelefono({
  perfilDelLead,
  nombreDelLead,
  onCerrar,
  onConectado,
}: {
  perfilDelLead: string;
  nombreDelLead: string;
  onCerrar: () => void;
  onConectado: () => void;
}) {
  useEscape(onCerrar);
  const [candidatos, setCandidatos] = useState<PerfilConTelefono[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    // Los perfiles que tienen teléfono. El «sin lead» se filtra abajo: la
    // colección no sabe de leads y traerlos todos es una consulta sola.
    pb.collection('perfil')
      .getFullList<PerfilConTelefono>({
        filter: 'telefono != "" && (fusionado_en = "" || fusionado_en = null)',
        fields: 'id,nombre,telefono,telefono_raw,telefono_valido,empresa',
        sort: 'nombre',
      })
      .then(async (todos) => {
        if (!vivo) return;
        // Cuáles de esos ya son un lead: ésos no se ofrecen, ya tienen dueño.
        const conLead = await pb
          .collection('lead')
          .getFullList<{ perfil: string }>({ fields: 'perfil' })
          .catch(() => []);
        const ocupados = new Set(conLead.map((l) => l.perfil));
        if (!vivo) return;
        setCandidatos(todos.filter((p) => !ocupados.has(p.id)));
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

  /**
   * Los parecidos primero.
   *
   * Sin escribir nada, arriba van los que comparten alguna palabra con el
   * nombre del lead: en una lista de 168 números, empezar por «Marcelo» cuando
   * el lead se llama Marcelo ahorra la búsqueda entera. Y si no hay ninguno, la
   * lista completa sigue estando.
   */
  const ordenados = useMemo(() => {
    const texto = normalizar(busqueda.trim());
    const conFiltro = texto
      ? candidatos.filter(
          (p) =>
            normalizar(p.nombre).includes(texto) ||
            p.telefono.includes(busqueda.replace(/\D/g, '')),
        )
      : candidatos;

    if (texto) return conFiltro;

    const palabras = new Set(normalizar(nombreDelLead).split(' ').filter((x) => x.length > 2));
    const puntos = (p: PerfilConTelefono) =>
      normalizar(p.nombre)
        .split(' ')
        .filter((x) => palabras.has(x)).length;

    return [...conFiltro].sort((a, b) => puntos(b) - puntos(a));
  }, [candidatos, busqueda, nombreDelLead]);

  const parecidos = useMemo(() => {
    const palabras = new Set(normalizar(nombreDelLead).split(' ').filter((x) => x.length > 2));
    return candidatos.filter((p) =>
      normalizar(p.nombre)
        .split(' ')
        .some((x) => palabras.has(x)),
    ).length;
  }, [candidatos, nombreDelLead]);

  async function conectar(p: PerfilConTelefono) {
    setGuardando(p.id);
    setError(null);
    try {
      // 1. El teléfono pasa al perfil del lead.
      await pb.collection('perfil').update(perfilDelLead, {
        telefono: p.telefono,
        telefono_raw: p.telefono_raw,
        telefono_valido: p.telefono_valido,
      });
      // 2. El de origen queda marcado, no borrado: así se puede ver de dónde
      //    salió el número si mañana alguien pregunta.
      await pb.collection('perfil').update(p.id, { fusionado_en: perfilDelLead });
      onConectado();
      onCerrar();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setGuardando(null);
    }
  }

  return (
    <div className="overlay-fondo" onClick={onCerrar}>
      <div className="overlay-caja overlay-medio" onClick={(e) => e.stopPropagation()}>
        <header className="overlay-header">
          <span className="overlay-titulo">Conectar un teléfono</span>
          <span className="campo-ayuda">
            {cargando ? 'leyendo…' : `${candidatos.length} sin lead`}
          </span>
          <button type="button" className="boton-icono-26 al-final" title="Cerrar" onClick={onCerrar}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        <div className="overlay-cuerpo">
          <span className="campo-ayuda">
            Son los números que entraron de WhatsApp y todavía no son de nadie. Elegí el de{' '}
            <b>{nombreDelLead}</b>: el número pasa a este lead y el contacto suelto queda marcado
            como fusionado, no se borra.
          </span>

          <label className="campo">
            <input
              autoFocus
              value={busqueda}
              placeholder="Buscar por nombre o por número…"
              onChange={(e) => setBusqueda(e.target.value)}
            />
            {!busqueda && parecidos > 0 && (
              <span className="campo-ayuda">
                {parecidos === 1
                  ? 'Hay 1 que comparte una palabra del nombre: va primero.'
                  : `Hay ${parecidos} que comparten alguna palabra del nombre: van primero.`}
              </span>
            )}
          </label>

          {error && <div className="login-error">{error}</div>}

          <div className="conectar-lista">
            {ordenados.slice(0, 60).map((p) => (
              <button
                key={p.id}
                type="button"
                className="dest-opcion"
                disabled={guardando !== null}
                onClick={() => void conectar(p)}
              >
                <span className="dest-opcion-texto">
                  <span className="dest-opcion-titulo">
                    <b>{p.nombre}</b>
                    {p.empresa && <span className="campo-ayuda">{p.empresa}</span>}
                    {!p.telefono_valido && (
                      <span className="pastilla pastilla-especial">a revisar</span>
                    )}
                  </span>
                  <span className="campo-ayuda tabular">{p.telefono_raw || p.telefono}</span>
                </span>
                <span className="campo-ayuda">{guardando === p.id ? 'conectando…' : 'conectar'}</span>
              </button>
            ))}

            {!cargando && ordenados.length === 0 && (
              <span className="campo-ayuda">
                {busqueda
                  ? 'Ningún número suelto con ese nombre.'
                  : 'No quedan teléfonos sin lead: están todos conectados.'}
              </span>
            )}
            {ordenados.length > 60 && (
              <span className="campo-ayuda">
                …y {ordenados.length - 60} más. Escribí para achicar la lista.
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
