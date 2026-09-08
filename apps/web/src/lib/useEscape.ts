import { useEffect } from 'react';

/**
 * Cerrar con Escape.
 *
 * Estaba escrito en dos overlays de siete, así que Escape cerraba Duplicados y
 * el Repositorio y no hacía nada en Tareas, Reglas, Base compartida o Cuentas
 * conectadas. Una tecla que funciona a veces es peor que una que no funciona:
 * se la aprende y después falla justo cuando se confía en ella.
 *
 * `bloqueado` es para lo que tiene cambios sin guardar: ahí Escape no puede
 * tirar el trabajo de alguien sin preguntar.
 */
export function useEscape(onCerrar: () => void, bloqueado = false) {
  useEffect(() => {
    if (bloqueado) return;
    const f = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Un panel adentro de otro cierra el de adentro: sin esto, Escape sobre
      // el selector de alcance cierra el repositorio entero.
      e.stopPropagation();
      onCerrar();
    };
    document.addEventListener('keydown', f);
    return () => document.removeEventListener('keydown', f);
  }, [onCerrar, bloqueado]);
}
