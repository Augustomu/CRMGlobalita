/**
 * Indicador de WhatsApp en la fila de la lista.
 *
 * Una sola burbuja con dos estados, no dos logos: la columna 1 ya está densa y
 * sumarle iconos la ensucia. La burbuja es la misma que usa el prototipo para
 * los canales (`Dashboard.dc.html`), y los dos estados siguen §9.7:
 * deshabilitado con motivo antes que oculto.
 *
 *   verde   -> tiene WhatsApp usable
 *   apagada -> no tiene, o el teléfono está a revisar (D29)
 *
 * LinkedIn no lleva icono a propósito: prácticamente todos los leads vienen de
 * ahí, así que mostrarlo no distingue nada. Lo que varía es el WhatsApp.
 */
export function BurbujaWhatsApp({ activa, motivo }: { activa: boolean; motivo?: string }) {
  return (
    <span
      className={`burbuja ${activa ? 'burbuja-on' : 'burbuja-off'}`}
      title={activa ? 'Tiene WhatsApp' : (motivo ?? 'Sin teléfono cargado')}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M20 15a3 3 0 01-3 3H8l-4 3V6a3 3 0 013-3h10a3 3 0 013 3z" />
      </svg>
    </span>
  );
}
