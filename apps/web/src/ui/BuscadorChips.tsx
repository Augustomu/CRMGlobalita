import { useRef } from 'react';

/**
 * El buscador de varias palabras, con chips (§7.2).
 *
 * ESTÁ ACÁ Y NO COPIADO EN CADA PANTALLA. Lo primero fue escribirlo dentro de
 * la columna 1 de Follow-up, que es donde se pidió. Llevarlo a la Base
 * compartida y al panel del partner con copiar y pegar habría dejado tres
 * versiones del mismo campo, y la tercera vez que alguien tocara una de las
 * tres, las otras dos habrían quedado distintas. Es la familia 7 del registro
 * —la misma cosa en dos lugares— que ya se cometió cinco veces.
 *
 * LA REGLA NO VIVE ACÁ. Qué significa que un lead «cumpla» los chips lo dice
 * `core/busqueda.ts`, con sus tests. Esto es el campo y nada más: junta
 * palabras y las devuelve.
 *
 * Enter fija lo escrito; la cruz saca un chip; y borrar con el campo vacío
 * saca el último, que es como se deshace sin apuntarle a una cruz de 9 px.
 */
export function BuscadorChips({
  chips,
  onChips,
  texto,
  onTexto,
  placeholder,
  className = 'lista-buscar',
  autoFocus,
}: {
  chips: string[];
  onChips: (v: string[]) => void;
  texto: string;
  onTexto: (v: string) => void;
  placeholder: string;
  /** La clase del recuadro, para que cada pantalla lo acomode a su ancho. */
  className?: string;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);

  function fijar() {
    const t = texto.trim();
    if (!t) return;
    // Sin repetidos: dos veces la misma palabra no achica más y ocupa lugar.
    if (!chips.some((x) => x.toLowerCase() === t.toLowerCase())) onChips([...chips, t]);
    onTexto('');
  }

  return (
    <div
      className={className}
      onClick={(e) => {
        // Tocar cualquier parte del recuadro pone el cursor a escribir. Sin
        // esto, el espacio entre chips es un agujero muerto.
        if (e.target === e.currentTarget) ref.current?.focus();
      }}
    >
      {chips.map((c) => (
        <span key={c} className="lista-chip-buscar">
          {c}
          <button type="button" title={`Sacar «${c}»`} onClick={() => onChips(chips.filter((x) => x !== c))}>
            ×
          </button>
        </span>
      ))}
      <input
        ref={ref}
        type="text"
        value={texto}
        autoFocus={autoFocus}
        onChange={(e) => onTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            fijar();
            return;
          }
          if (e.key === 'Backspace' && !texto && chips.length) onChips(chips.slice(0, -1));
        }}
        placeholder={chips.length ? 'y…' : placeholder}
        title="Enter agrega una palabra más. Todas tienen que cumplirse."
      />
    </div>
  );
}
