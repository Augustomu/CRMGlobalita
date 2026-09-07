import { useState } from 'react';

/**
 * Bloque colapsable con chips editables. Portado de
 * `docs/prototipo/Colapsable.dc.html`.
 *
 * Los campos NO son un formulario: son pastillas que muestran etiqueta + valor,
 * y al tocarlas se convierten en un input. Un campo vacío se ve con borde
 * punteado y el nombre del campo como placeholder. Es la interacción del
 * prototipo y cambia bastante la densidad respecto de label + input apilados.
 */
export interface Chip {
  clave: string;
  label: string;
  valor: string;
  /** Lo que se muestra cuando está vacío. Por defecto, el label en minúscula. */
  placeholder?: string;
  titulo?: string;
}

export interface BloqueTexto {
  label: string;
  valor: string;
  /** El prototipo marca estos como extraídos de LinkedIn. */
  origen?: string;
  vacioTexto?: string;
}

interface Props {
  titulo: string;
  resumen?: string;
  chips?: Chip[];
  bloques?: BloqueTexto[];
  onEditar?: (clave: string, valor: string) => void;
  children?: React.ReactNode;
  abiertoPorDefecto?: boolean;
}

export function Colapsable({
  titulo,
  resumen,
  chips = [],
  bloques = [],
  onEditar,
  children,
  abiertoPorDefecto = true,
}: Props) {
  const [abierto, setAbierto] = useState(abiertoPorDefecto);
  const [editando, setEditando] = useState<string | null>(null);
  const [borrador, setBorrador] = useState('');

  function empezar(c: Chip) {
    if (!onEditar) return;
    setEditando(c.clave);
    setBorrador(c.valor);
  }

  function salir(c: Chip) {
    if (borrador !== c.valor) onEditar?.(c.clave, borrador);
    setEditando(null);
  }

  return (
    <div className="colapsable">
      <button type="button" className="colapsable-cabecera" onClick={() => setAbierto((a) => !a)}>
        <span className="colapsable-flecha">{abierto ? '▾' : '▸'}</span>
        <span className="colapsable-titulo">{titulo}</span>
        {resumen && <span className="colapsable-resumen">{resumen}</span>}
      </button>

      {abierto && (
        <div className="colapsable-cuerpo">
          {chips.length > 0 && (
            <div className="colapsable-chips">
              {chips.map((c) => {
                if (editando === c.clave) {
                  return (
                    <span key={c.clave} className="chip-campo chip-campo-editando">
                      <span className="chip-campo-label">{c.label}</span>
                      <input
                        autoFocus
                        value={borrador}
                        placeholder={c.label}
                        onChange={(e) => setBorrador(e.target.value)}
                        onBlur={() => salir(c)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') salir(c);
                          if (e.key === 'Escape') setEditando(null);
                        }}
                      />
                    </span>
                  );
                }
                return (
                  <button
                    key={c.clave}
                    type="button"
                    className={`chip-campo ${c.valor ? '' : 'chip-campo-vacio'}`}
                    title={c.titulo ?? c.label}
                    onClick={() => empezar(c)}
                  >
                    <span className="chip-campo-label">{c.label}</span>
                    <span className={c.valor ? 'chip-campo-valor' : 'chip-campo-placeholder'}>
                      {/* Un campo vacío NO repite su propio nombre: "EMAIL email"
                          se lee como si el valor fuera "email". El prototipo usa
                          `cargar` si se puede editar y `sin dato` si no. */}
                      {c.valor || c.placeholder || (onEditar ? 'cargar' : 'sin dato')}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {bloques.map((b) => (
            <div key={b.label} className="colapsable-bloque">
              <div className="colapsable-bloque-cabecera">
                <span className="campo-label">{b.label}</span>
                {b.origen && <span className="colapsable-origen">{b.origen}</span>}
              </div>
              {b.valor ? (
                <div className="colapsable-texto">{b.valor}</div>
              ) : (
                <div className="colapsable-texto-vacio">
                  {b.vacioTexto ?? `sin ${b.label.toLowerCase()}`}
                </div>
              )}
            </div>
          ))}

          {children}
        </div>
      )}
    </div>
  );
}
