/**
 * Los iconos que aparecen en más de una pantalla.
 *
 * No es un cajón de sastre: es el módulo de los iconos compartidos, y existe
 * por un pedido concreto de Augusto — *«el icono de notas tiene que ser el
 * mismo en todos lados»*. Estaban dibujados inline en cada componente y habían
 * derivado: la agenda usaba una hoja corrida 1 px respecto de la de Control, y
 * la columna 1 marcaba WhatsApp con una burbuja de chat cualquiera que, en sus
 * palabras, «no se entiende».
 *
 * Un icono que se usa en un solo lugar se sigue dibujando ahí. Traerlo acá
 * sólo porque es un SVG no ayuda a nadie.
 *
 * El tamaño lo pone el CSS de quien los usa (`width`/`height` sobre el `svg`),
 * como el resto de la app. Acá sólo va la forma.
 */

/**
 * Notas. La hoja con la esquina doblada de `Control.dc.html`.
 *
 * Es la del prototipo, no la de la agenda: cuando dos versiones difieren,
 * gana el prototipo (§9.6 del manual).
 */
export function IconoNotas() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 5h16v11l-4 4H4z" />
      <path d="M7 9h10M7 13h6" />
    </svg>
  );
}

/**
 * WhatsApp: la burbuja con el auricular adentro.
 *
 * Va rellena y no en trazo porque es una **marca**, no un símbolo: en trazo, a
 * 13 px, se lee como una burbuja de chat más — que es exactamente lo que había
 * antes y lo que no se entendía. El color lo pone quien lo usa; en verde de
 * marca cuando está activo (§9.6).
 */
export function IconoWhatsApp() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.87 9.87 0 004.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0012.04 2zm0 18.15h-.01a8.2 8.2 0 01-4.18-1.15l-.3-.18-3.11.82.83-3.04-.2-.31a8.16 8.16 0 01-1.25-4.38c0-4.54 3.7-8.24 8.24-8.24a8.18 8.18 0 015.82 2.42 8.18 8.18 0 012.41 5.83c0 4.54-3.69 8.23-8.25 8.23z" />
      <path d="M16.56 14.24c-.25-.13-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.8-.78.97-.14.16-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.38-1.72-.15-.25-.02-.38.11-.51.11-.11.25-.29.37-.44.13-.14.17-.25.25-.41.09-.17.04-.31-.02-.44-.06-.12-.56-1.35-.77-1.85-.2-.48-.4-.42-.56-.43h-.47c-.16 0-.43.06-.65.31-.23.25-.86.84-.86 2.05s.88 2.38 1 2.54c.13.17 1.74 2.65 4.2 3.72.59.25 1.05.4 1.4.52.59.19 1.13.16 1.55.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.08.15-1.18-.06-.11-.23-.17-.48-.29z" />
    </svg>
  );
}

/**
 * LinkedIn: la «in» dentro del cuadrado.
 *
 * Rellena, por lo mismo que WhatsApp: es una marca.
 */
export function IconoLinkedIn() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zM8.34 18.34H5.67V9.75h2.67v8.59zM7 8.58a1.55 1.55 0 110-3.1 1.55 1.55 0 010 3.1zm11.34 9.76h-2.67v-4.18c0-1-.02-2.28-1.39-2.28-1.39 0-1.6 1.09-1.6 2.21v4.25h-2.67V9.75h2.56v1.17h.04a2.81 2.81 0 012.53-1.39c2.7 0 3.2 1.78 3.2 4.1v4.71z" />
    </svg>
  );
}
