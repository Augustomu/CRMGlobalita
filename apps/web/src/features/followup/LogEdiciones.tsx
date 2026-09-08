import { useEffect, useState } from 'react';
import { pb } from '../../lib/pocketbase';
import type { EdicionRecord } from '../../lib/types';

/**
 * Los campos que se pueden revertir desde el log. Portado de la constante
 * `REVERTIBLES` del prototipo.
 *
 * No están todos: revertir un email o un teléfono es seguro porque el valor
 * anterior sigue siendo válido, pero revertir una nota de tres párrafos
 * pisaría lo que alguien escribió después. Los que no están se muestran con
 * "sin revertir" en vez de un botón que haría algo peor que no hacer nada.
 */
const REVERTIBLES = new Set([
  'Cargo', 'Empresa', 'Web', 'Industria', 'Ciudad', 'País', 'Teléfono',
  'Email', 'Email 2', 'Email 3',
]);

/** De la etiqueta que se muestra al campo real, para poder revertir. */
const CAMPO_DE: Record<string, { coleccion: 'perfil' | 'lead'; campo: string }> = {
  Cargo: { coleccion: 'perfil', campo: 'cargo' },
  Empresa: { coleccion: 'perfil', campo: 'empresa' },
  Web: { coleccion: 'perfil', campo: 'web' },
  Industria: { coleccion: 'perfil', campo: 'industria' },
  Ciudad: { coleccion: 'perfil', campo: 'ciudad' },
  País: { coleccion: 'perfil', campo: 'pais' },
  Teléfono: { coleccion: 'perfil', campo: 'telefono' },
  Email: { coleccion: 'lead', campo: 'email' },
  'Email 2': { coleccion: 'lead', campo: 'email2' },
  'Email 3': { coleccion: 'lead', campo: 'email3' },
};

interface Props {
  perfilId: string;
  leadId: string;
  editable: boolean;
  onRevertido: () => void;
}

/**
 * El histórico de todo lo editado en un perfil, con fecha y valor anterior
 * (cambio 14 del documento de diseño).
 *
 * Vive en la base y no en memoria: la pila de deshacer de la ficha se pierde
 * al cerrarla, y la pregunta que este panel contesta —"¿quién le cambió la
 * empresa, y qué decía antes?"— llega tres semanas después.
 */
export function LogEdiciones({ perfilId, leadId, editable, onRevertido }: Props) {
  const [entradas, setEntradas] = useState<EdicionRecord[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    try {
      const r = await pb.collection('edicion').getFullList<EdicionRecord>({
        filter: `perfil = "${perfilId}"`,
        sort: '-created',
        expand: 'usuario',
      });
      setEntradas(r);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    void cargar();
  }, [perfilId]);

  async function revertir(e: EdicionRecord) {
    const destino = CAMPO_DE[e.campo];
    if (!destino) return;
    try {
      await pb
        .collection(destino.coleccion)
        .update(destino.coleccion === 'perfil' ? perfilId : leadId, { [destino.campo]: e.antes });
      // Revertir TAMBIÉN se registra: si no, el log diría que el campo vale lo
      // que decía antes sin explicar por qué, y el próximo que lo mire va a
      // pensar que el cambio nunca ocurrió.
      await pb.collection('edicion').create({
        perfil: perfilId,
        lead: leadId,
        usuario: pb.authStore.record?.id ?? '',
        campo: e.campo,
        antes: e.despues,
        despues: e.antes,
      });
      await cargar();
      onRevertido();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  // §7.2: es uno de los seis bloques de la ficha, no un overlay. El log se
  // consulta para entender qué se tocó ANTES de volver a tocarlo, y para eso
  // hay que poder verlo junto al campo.
  return (
    <div className="log-bloque">
        <div className="log-lista">
          {error && <div className="login-error">{error}</div>}
          {!cargando && entradas.length === 0 && (
            <div className="log-vacio">sin ediciones registradas en este perfil</div>
          )}
          {entradas.map((e) => (
            <div key={e.id} className="log-fila">
              <div className="log-fecha tabular">
                {/* D23: PocketBase guarda en UTC. Cortar el string mostraba
                    "02:00" para algo editado a las 20:00 del día anterior. */}
                {new Date(String(e.created).replace(' ', 'T')).toLocaleString('es-AR', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
                {e.expand?.usuario?.name && (
                  <span className="log-quien">{e.expand.usuario.name}</span>
                )}
              </div>
              <div className="log-cambio">
                <span className="campo-label">{e.campo}</span>
                <div className="log-valores">
                  {e.antes ? (
                    <span className="log-antes">{e.antes}</span>
                  ) : (
                    <span className="log-vacio-valor">vacío</span>
                  )}
                  <span className="log-flecha">→</span>
                  <span className="log-despues">{e.despues || 'vacío'}</span>
                </div>
              </div>
              {editable && REVERTIBLES.has(e.campo) ? (
                <button
                  type="button"
                  className="boton-mini"
                  title={`Volver a: ${e.antes || 'vacío'}`}
                  onClick={() => void revertir(e)}
                >
                  revertir
                </button>
              ) : (
                <span className="log-sin-revertir" title="Este campo no se puede revertir desde el log">
                  sin revertir
                </span>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
