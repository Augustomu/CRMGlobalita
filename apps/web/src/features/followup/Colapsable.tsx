import { useEffect, useState } from 'react';

/**
 * Bloque colapsable con chips editables. Portado de
 * `docs/prototipo/Colapsable.dc.html`.
 *
 * CERRADO POR DEFECTO, y es lo que hace que la ficha entre en una pantalla
 * (cambio 1 del documento de diseño). Con Datos y Contacto abiertos, la fecha
 * de reunión —que es a lo que apunta todo el trabajo— quedaba abajo de todo,
 * fuera de la vista.
 *
 * Los campos NO son un formulario: son pastillas que muestran etiqueta + valor,
 * y al tocarlas se convierten en un input. Un campo vacío se ve con borde
 * punteado y `cargar` como placeholder.
 */
export interface Chip {
  clave: string;
  label: string;
  valor: string;
  /** Lo que se muestra cuando está vacío. Por defecto, `cargar`. */
  placeholder?: string;
  titulo?: string;
  editable?: boolean;
}

export interface BloqueTexto {
  label: string;
  valor: string;
  /** El prototipo marca estos como extraídos de LinkedIn. */
  origen?: string;
  vacioTexto?: string;
  /**
   * Con qué clave se guarda al editarlo. El prototipo muestra «Acerca de» como
   * texto fijo, pero en la base esa nota se escribe a mano y tiene que poder
   * editarse desde algún lado; el bloque es ese lado.
   */
  clave?: string;
}

interface Props {
  titulo: string;
  /**
   * Cambiar de lead vuelve a cerrar el bloque y cancela la edición. Sin esto,
   * al saltar de ficha en ficha el bloque queda abierto y se pierde la razón
   * de tenerlo colapsado.
   */
  contactoId?: string;
  /** Sobrescribe el contador. Se usa donde no hay chips que contar. */
  resumen?: string;
  chips?: Chip[];
  bloques?: BloqueTexto[];
  onEditar?: (clave: string, valor: string) => void;
  children?: React.ReactNode;
  abiertoPorDefecto?: boolean;
}

export function Colapsable({
  titulo,
  contactoId,
  resumen,
  chips = [],
  bloques = [],
  onEditar,
  children,
  abiertoPorDefecto = false,
}: Props) {
  const [abierto, setAbierto] = useState(abiertoPorDefecto);
  const [editando, setEditando] = useState<string | null>(null);
  const [borrador, setBorrador] = useState('');

  useEffect(() => {
    setAbierto(abiertoPorDefecto);
    setEditando(null);
    setBorrador('');
  }, [contactoId, abiertoPorDefecto]);

  function empezar(c: Chip) {
    if (!onEditar || c.editable === false) return;
    setEditando(c.clave);
    setBorrador(c.valor);
  }

  function salir(c: Chip) {
    if (borrador !== c.valor) onEditar?.(c.clave, borrador);
    setEditando(null);
  }

  // El contador solo se muestra CERRADO: abierto se ve el contenido, y el
  // número al lado del título pasa a ser ruido.
  const total = chips.length + bloques.length;
  const llenos = chips.filter((c) => c.valor).length + bloques.filter((b) => b.valor).length;
  const alLado = abierto ? '' : (resumen ?? (total ? `${llenos}/${total}` : ''));

  return (
    <div className="colapsable">
      <button type="button" className="colapsable-cabecera" onClick={() => setAbierto((a) => !a)}>
        <span className="colapsable-flecha">{abierto ? '▾' : '▸'}</span>
        <span className="colapsable-titulo">{titulo}</span>
        {alLado && <span className="colapsable-resumen tabular">{alLado}</span>}
      </button>

      {abierto && (
        <div className="colapsable-cuerpo">
          {chips.length > 0 && (
            <div className="colapsable-chips">
              {chips.map((c) => {
                const editable = Boolean(onEditar) && c.editable !== false;
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
                    title={c.titulo ?? (editable ? `Editar ${c.label.toLowerCase()}` : c.label)}
                    onClick={() => empezar(c)}
                  >
                    <span className="chip-campo-label">{c.label}</span>
                    <span className={c.valor ? 'chip-campo-valor' : 'chip-campo-placeholder'}>
                      {/* Un campo vacío NO repite su propio nombre: "EMAIL email"
                          se lee como si el valor fuera "email". El prototipo usa
                          `cargar` si se puede editar y `sin dato` si no. */}
                      {c.valor || c.placeholder || (editable ? 'cargar' : 'sin dato')}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {bloques.map((b) => {
            const editable = Boolean(onEditar) && Boolean(b.clave);
            if (editable && editando === b.clave) {
              return (
                <div key={b.label} className="colapsable-bloque">
                  <div className="colapsable-bloque-cabecera">
                    <span className="campo-label">{b.label}</span>
                  </div>
                  <textarea
                    autoFocus
                    rows={5}
                    className="colapsable-texto-editando"
                    value={borrador}
                    onChange={(e) => setBorrador(e.target.value)}
                    onBlur={() => {
                      if (borrador !== b.valor) onEditar?.(b.clave!, borrador);
                      setEditando(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setEditando(null);
                    }}
                  />
                </div>
              );
            }
            return (
              <div key={b.label} className="colapsable-bloque">
                <div className="colapsable-bloque-cabecera">
                  <span className="campo-label">{b.label}</span>
                  {b.origen && <span className="colapsable-origen">{b.origen}</span>}
                </div>
                <div
                  className={b.valor ? 'colapsable-texto' : 'colapsable-texto-vacio'}
                  role={editable ? 'button' : undefined}
                  tabIndex={editable ? 0 : undefined}
                  title={editable ? `Editar ${b.label.toLowerCase()}` : undefined}
                  onClick={() => {
                    if (!editable) return;
                    setEditando(b.clave!);
                    setBorrador(b.valor);
                  }}
                >
                  {b.valor || b.vacioTexto || `sin ${b.label.toLowerCase()}`}
                </div>
              </div>
            );
          })}

          {children}
        </div>
      )}
    </div>
  );
}
