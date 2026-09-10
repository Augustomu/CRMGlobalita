/**
 * Los atajos de teclado, listados (§7.1, §9.1).
 *
 * Los atajos ya estaban todos implementados en `useAtajos.ts`; lo que faltaba
 * era decir cuáles son. Un atajo que nadie sabe que existe no es un atajo, y
 * el header lo prometía en el menú con un cartelito de «falta».
 *
 * La lista y los textos salen del prototipo (`Dashboard.dc.html`, `ATAJOS`).
 * No se derivan de `useAtajos`: ese archivo tiene las ACCIONES, y la acción no
 * sabe cómo se llama en castellano. Derivarlo daría una tabla de nombres de
 * función.
 */
const ATAJOS: { tecla: string; que: string }[] = [
  { tecla: 'A', que: 'Guardar la ficha' },
  { tecla: 'S', que: 'Enviar el mensaje escrito' },
  { tecla: 'D', que: 'Abrir la fecha de próximo contacto' },
  { tecla: 'R', que: 'Abrir la fecha de reunión' },
  { tecla: 'F', que: 'Cambiar el canal de envío: LinkedIn o WhatsApp' },
  { tecla: 'G', que: 'Abrir o cerrar la conversación' },
  { tecla: 'H', que: 'Abrir el chat real del canal elegido' },
  { tecla: 'V', que: 'Abrir el perfil de LinkedIn' },
  // La C se sacó el 09/09 a pedido de Augusto. Ctrl+Z se queda: es el gesto
  // que todo el mundo ya tiene en el dedo, y una letra suelta que deshace es
  // fácil de apretar sin querer.
  { tecla: 'Ctrl+Z', que: 'Deshacer la última edición de la ficha' },
  { tecla: 'Esc', que: 'Cerrar el panel abierto' },
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
            </div>
          ))}
        </div>

        {/* Las mismas cuatro teclas hacen otra cosa adentro del calendario, y
            eso hay que decirlo: si no, la primera vez parece que el atajo se
            rompió. */}
        <span className="campo-ayuda atajos-nota">
          Dentro del calendario de próximo contacto, A S D F pasan a ser 1, 2, 3 y 4 semanas.
        </span>
        {/* §9.1: la regla que evita que escribir «a» en una nota guarde la
            ficha. Decirla acá ahorra el susto de descubrirla. */}
        <span className="campo-ayuda">
          No se disparan mientras el foco está en un campo de texto.
        </span>
      </div>
    </>
  );
}
