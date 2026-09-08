import { useCallback, useEffect, useState } from 'react';
import {
  anchoArrastrado,
  anchoDeDobleClic,
  anchoGuardado,
  type Panel,
} from '@crm/core/anchos';

/**
 * Un panel de ancho arrastrable (§9.4).
 *
 * El arrastre se escucha en `document` y no en el divisor: si el mouse sale del
 * divisor de 5 px —que es lo que pasa siempre— el panel deja de seguirlo.
 *
 * El ancho se guarda en `localStorage`, que es por navegador y no llega al
 * servidor. Es lo correcto: cuánto mide la columna depende de la pantalla en la
 * que se está trabajando, no de quién sos.
 */
export function useAncho(panel: Panel) {
  const [ancho, setAncho] = useState<number>(() => {
    try {
      return anchoGuardado(panel, localStorage.getItem(panel.clave)) ?? panel.normal;
    } catch {
      return panel.normal;
    }
  });

  const guardar = useCallback(
    (n: number) => {
      setAncho(n);
      try {
        localStorage.setItem(panel.clave, String(n));
      } catch {
        // Ventana privada o almacenamiento bloqueado: el ancho vale para esta
        // sesión y no se guarda. No es un error que haya que contarle a nadie.
      }
    },
    [panel],
  );

  const [arrastrando, setArrastrando] = useState<{ x0: number; w0: number } | null>(null);

  useEffect(() => {
    if (!arrastrando) return;
    const mover = (ev: MouseEvent) =>
      guardar(anchoArrastrado(panel, arrastrando.w0, ev.clientX - arrastrando.x0));
    const soltar = () => setArrastrando(null);
    document.addEventListener('mousemove', mover);
    document.addEventListener('mouseup', soltar);
    // Sin esto, arrastrar selecciona el texto de media pantalla.
    const cursor = document.body.style.cursor;
    const seleccion = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.removeEventListener('mousemove', mover);
      document.removeEventListener('mouseup', soltar);
      document.body.style.cursor = cursor;
      document.body.style.userSelect = seleccion;
    };
  }, [arrastrando, panel, guardar]);

  return {
    ancho,
    /** Para el `style` del panel. Sigue la escala de texto, como el resto. */
    estilo: { width: `calc(${ancho}px * var(--escala-texto))`, flexShrink: 0 },
    /** Para el divisor. */
    divisor: {
      onMouseDown: (e: { clientX: number; preventDefault: () => void }) => {
        e.preventDefault();
        setArrastrando({ x0: e.clientX, w0: ancho });
      },
      onDoubleClick: () => guardar(anchoDeDobleClic(panel, ancho)),
    },
  };
}
