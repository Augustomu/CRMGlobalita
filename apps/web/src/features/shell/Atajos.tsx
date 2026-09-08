/**
 * Los atajos de teclado, listados (§7.1, §9.1).
 *
 * Los atajos ya estaban todos implementados en `useAtajos.ts`; lo que faltaba
 * era decir cuáles son. Un atajo que nadie sabe que existe no es un atajo, y
 * el header lo prometía en el menú con un cartelito de «falta».
 *
 * La lista se escribe acá y no se deriva de `useAtajos`: ese archivo tiene las
 * ACCIONES, y la acción no sabe cómo se llama en castellano ni en qué contexto
 * sirve. Derivarlo daría una tabla de nombres de función.
 */
const ATAJOS: { tecla: string; que: string; donde: string }[] = [
  { tecla: 'A', que: 'Guardar la ficha', donde: 'Follow-up' },
  { tecla: 'S', que: 'Registrar el mensaje escrito', donde: 'Follow-up' },
  { tecla: 'D', que: 'Abrir la fecha de próximo contacto', donde: 'Follow-up' },
  { tecla: 'R', que: 'Abrir la fecha de reunión', donde: 'Follow-up' },
  { tecla: 'F', que: 'Cambiar el canal de envío', donde: 'Follow-up' },
  { tecla: 'G', que: 'Abrir o cerrar la conversación', donde: 'Follow-up' },
  { tecla: 'H', que: 'Abrir el chat real del canal', donde: 'Follow-up' },
  { tecla: 'V', que: 'Abrir el perfil de LinkedIn', donde: 'Follow-up' },
  { tecla: 'C', que: 'Deshacer la última edición', donde: 'Follow-up' },
  { tecla: 'Ctrl+Z', que: 'Deshacer la última edición', donde: 'Follow-up' },
  { tecla: 'Esc', que: 'Cerrar el panel abierto', donde: 'todas' },
];

export function Atajos({ onCerrar }: { onCerrar: () => void }) {
  return (
    <>
      <div className="popover-fondo" onClick={onCerrar} />
      <div className="popover popover-anclado atajos">
        <div className="atajos-cabeza">
          <span className="campo-label">Atajos de teclado</span>
          <span className="campo-ayuda al-final">§9.1</span>
        </div>
        <div className="atajos-lista">
          {ATAJOS.map((a) => (
            <div key={`${a.tecla}-${a.que}`} className="atajos-fila">
              <kbd className="atajos-tecla">{a.tecla}</kbd>
              <span className="atajos-que">{a.que}</span>
              <span className="campo-ayuda al-final">{a.donde}</span>
            </div>
          ))}
        </div>
        {/* §9.1: la regla que evita que escribir «a» en una nota guarde la
            ficha. Decirla acá ahorra el susto de descubrirla. */}
        <span className="campo-ayuda">
          No se disparan mientras el foco está en un campo de texto.
        </span>
      </div>
    </>
  );
}
