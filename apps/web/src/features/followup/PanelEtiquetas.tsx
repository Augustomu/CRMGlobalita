import { useState } from 'react';
import {
  nombreDisponible,
  porUltimoUso,
  sePuedeRenombrar,
  type Etiqueta,
} from '@crm/core/etiqueta';
import { ddmm } from '@crm/core/fecha';
import { pb } from '../../lib/pocketbase';

interface Props {
  catalogo: Etiqueta[];
  aplicadas: string[];
  onAlternar: (etiqueta: Etiqueta, poner: boolean) => void;
  onCatalogoCambiado: () => void;
}


/**
 * Panel de etiquetas (§7.2). Portada de `docs/prototipo/PanelEtiquetas.dc.html`.
 *
 * El catálogo entero, ordenado por último uso: crear, renombrar, borrar y
 * aplicar en un solo lugar. Antes esto era un popover de solo aplicar, y
 * corregir un nombre mal escrito obligaba a ir a la base.
 */
export function PanelEtiquetas({ catalogo, aplicadas, onAlternar, onCatalogoCambiado }: Props) {
  const [nueva, setNueva] = useState('');
  const [editando, setEditando] = useState<string | null>(null);
  const [borrador, setBorrador] = useState('');
  const [error, setError] = useState<string | null>(null);

  const lista = porUltimoUso(catalogo);
  const puestas = new Set(aplicadas);

  async function crear() {
    const n = nueva.trim();
    if (!nombreDisponible(catalogo, n)) {
      setError(n ? `Ya existe una etiqueta «${n}».` : null);
      return;
    }
    try {
      await pb.collection('etiqueta').create({ nombre: n, del_sistema: false });
      setNueva('');
      setError(null);
      onCatalogoCambiado();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function renombrar(et: Etiqueta) {
    const n = borrador.trim();
    if (n === et.nombre) {
      setEditando(null);
      return;
    }
    if (!nombreDisponible(catalogo, n, et.id)) {
      setError(n ? `Ya existe una etiqueta «${n}».` : 'El nombre no puede quedar vacío.');
      return;
    }
    try {
      await pb.collection('etiqueta').update(et.id, { nombre: n });
      setEditando(null);
      setError(null);
      onCatalogoCambiado();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function borrar(et: Etiqueta) {
    try {
      await pb.collection('etiqueta').delete(et.id);
      onCatalogoCambiado();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  // §7.2 lo lista entre los seis bloques colapsables de la ficha, no como
  // popover: el catálogo de etiquetas se mira y se edita mientras se trabaja
  // el lead, y un popover se cierra en cuanto se toca cualquier otra cosa.
  return (
    <div className="pet">
        <div className="pet-nueva">
          <input
            value={nueva}
            placeholder="Nueva etiqueta…"
            onChange={(e) => {
              setNueva(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => e.key === 'Enter' && void crear()}
          />
          <button type="button" className="boton-mini" disabled={!nueva.trim()} onClick={() => void crear()}>
            Crear
          </button>
        </div>

        {error && <span className="pet-error">{error}</span>}

        <div className="pet-lista">
          {lista.map((et) => {
            const puesta = puestas.has(et.id);
            const editable = sePuedeRenombrar(et);
            if (editando === et.id) {
              return (
                <div key={et.id} className="pet-fila">
                  <input
                    autoFocus
                    value={borrador}
                    onChange={(e) => setBorrador(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void renombrar(et);
                      if (e.key === 'Escape') setEditando(null);
                    }}
                  />
                  <button type="button" className="boton-mini" onClick={() => void renombrar(et)}>
                    Guardar
                  </button>
                </div>
              );
            }
            return (
              <div key={et.id} className="pet-fila">
                <button
                  type="button"
                  className={`chip-pastilla ${puesta ? 'chip-pastilla-on' : ''}`}
                  title={et.del_sistema ? 'La pone el sistema (D04)' : 'Aplicar o sacar del lead'}
                  onClick={() => onAlternar(et, !puesta)}
                >
                  {et.nombre}
                </button>
                <span className="campo-ayuda tabular al-final">{ddmm(et.usada_en) || 'sin usar'}</span>
                {/* Las del sistema no se editan ni se borran: su nombre está
                    escrito en el código que las aplica. Los botones no se
                    dibujan, en vez de dibujarse y no hacer nada. */}
                {editable && (
                  <>
                    <button
                      type="button"
                      className="pet-icono"
                      title="Renombrar"
                      onClick={() => {
                        setEditando(et.id);
                        setBorrador(et.nombre);
                        setError(null);
                      }}
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className="pet-icono pet-icono-borrar"
                      title="Borrar del catálogo"
                      onClick={() => void borrar(et)}
                    >
                      ×
                    </button>
                  </>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}
