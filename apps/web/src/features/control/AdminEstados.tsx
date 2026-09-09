import { useEffect, useState } from 'react';
import { pb } from '../../lib/pocketbase';
import { useEscape } from '../../lib/useEscape';

/**
 * Administrador de estados de proyecto (§3.13.2).
 *
 * POR QUE EXISTE. Augusto los buscó en la pantalla y no los encontró: los siete
 * estaban escritos a mano en `core/proyecto.ts`, y la leyenda del pie de
 * Control salía de ahí. Corregir una palabra era un cambio de código.
 *
 * QUÉ SE EDITA Y QUÉ NO. El nombre y el significado son texto que se lee en
 * pantalla: se editan. La clave no, porque tiene reglas colgadas — `congelado`
 * lo pone el sistema a los 30 días sin movimiento, los cerrados son terminales,
 * y la tarjeta «Activos» cuenta cuatro estados concretos. Renombrar
 * «Congelado» a «En pausa» es cosmética; borrar la clave deja proyectos en un
 * estado que ya no existe y una regla apuntando al vacío.
 *
 * Se dice en la pantalla, no se esconde: un campo que no se puede tocar sin
 * explicación se lee como algo roto.
 */
interface EstadoRecord {
  id: string;
  clave: string;
  nombre: string;
  significado: string;
  orden: number;
  activo: boolean;
  automatico: boolean;
}

export function AdminEstados({ onCerrar }: { onCerrar: () => void }) {
  useEscape(onCerrar);
  const [estados, setEstados] = useState<EstadoRecord[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Qué fila se está guardando, para no dejar el botón mudo. */
  const [guardando, setGuardando] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    pb.collection('estado_proyecto')
      .getFullList<EstadoRecord>({ sort: 'orden' })
      .then((r) => {
        if (!vivo) return;
        setEstados(r);
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

  /** Escribe el cambio en la fila y en el servidor. */
  async function guardar(id: string, campo: 'nombre' | 'significado', valor: string) {
    const antes = estados.find((e) => e.id === id);
    if (!antes || antes[campo] === valor) return;
    setGuardando(id);
    setError(null);
    try {
      const nuevo = await pb.collection('estado_proyecto').update<EstadoRecord>(id, {
        [campo]: valor,
      });
      setEstados((v) => v.map((e) => (e.id === id ? nuevo : e)));
    } catch (e) {
      // 404 en PocketBase es «la regla no te deja», no «no existe» (§13.4).
      const crudo = e instanceof Error ? e.message : String(e);
      setError(
        /not.*found/i.test(crudo)
          ? 'No tenés permiso para editar los estados. Sólo un administrador puede.'
          : crudo,
      );
    } finally {
      setGuardando(null);
    }
  }

  return (
    <div className="overlay-fondo" onClick={onCerrar}>
      <div className="overlay-caja overlay-medio" onClick={(e) => e.stopPropagation()}>
        <header className="overlay-header">
          <span className="overlay-titulo">Estados de proyecto</span>
          <span className="campo-ayuda">
            {cargando ? 'leyendo…' : `${estados.length} estados`}
          </span>
          <button type="button" className="boton-icono-26 al-final" title="Cerrar" onClick={onCerrar}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        <div className="overlay-cuerpo">
          <span className="campo-ayuda">
            El nombre y el significado son los que se leen en Control y en la ficha del lead. Se
            guardan al salir del campo.
          </span>
          {error && <div className="login-error">{error}</div>}

          {estados.map((e) => (
            <div key={e.id} className="estado-fila">
              <div className="estado-fila-arriba">
                <input
                  className="estado-nombre"
                  defaultValue={e.nombre}
                  onBlur={(ev) => void guardar(e.id, 'nombre', ev.target.value.trim())}
                  aria-label={`Nombre de ${e.clave}`}
                />
                {/* La clave, a la vista y sin poder tocarse: es lo que hace que
                    las reglas y los proyectos ya cargados sigan encontrándose. */}
                <code className="estado-clave" title="La clave interna. No se cambia: hay reglas y proyectos que la usan.">
                  {e.clave}
                </code>
                {e.activo && (
                  <span className="pastilla" title="Cuenta en la tarjeta «Activos» de Control">
                    activo
                  </span>
                )}
                {e.automatico && (
                  <span
                    className="pastilla pastilla-especial"
                    title="Lo pone el sistema solo: a los 30 días sin movimiento"
                  >
                    automático
                  </span>
                )}
                {guardando === e.id && <span className="campo-ayuda">guardando…</span>}
              </div>
              <textarea
                className="estado-significado"
                rows={2}
                defaultValue={e.significado}
                placeholder="Qué quiere decir este estado"
                onBlur={(ev) => void guardar(e.id, 'significado', ev.target.value.trim())}
                aria-label={`Significado de ${e.clave}`}
              />
            </div>
          ))}

          {!cargando && estados.length === 0 && (
            <p className="vacio">No hay estados cargados. Reiniciá PocketBase para que se creen.</p>
          )}
        </div>

        <footer className="overlay-pie">
          <span className="campo-ayuda">
            No se crean ni se borran estados desde acá. Cada clave tiene reglas colgadas —el
            congelado automático, los cerrados que no vuelven atrás, los cuatro que cuentan como
            activos—, así que borrar una dejaría proyectos en un estado que ya no existe.
          </span>
        </footer>
      </div>
    </div>
  );
}
