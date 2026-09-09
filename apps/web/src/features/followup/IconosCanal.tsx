import { IconoWhatsApp } from '../../ui/iconos';

/**
 * Indicador de WhatsApp en la fila de la lista.
 *
 * Es **el logo de WhatsApp**, no una burbuja de chat. Antes era una burbuja
 * genérica y Augusto lo dijo derecho: «no se entiende». Tenía razón — una
 * burbuja al lado de un lead puede querer decir cualquier cosa: que hay
 * mensajes, que hay sin leer, que se puede escribir.
 *
 * Dos estados, siguiendo §9.7 —deshabilitado con motivo antes que oculto—:
 *
 *   verde   -> tiene WhatsApp usable
 *   apagado -> no tiene, o el teléfono está a revisar (D29)
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
      <IconoWhatsApp />
    </span>
  );
}
