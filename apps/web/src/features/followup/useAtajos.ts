import { useEffect } from 'react';

/**
 * Atajos de teclado de la ficha (§9.1), portados de
 * `docs/prototipo/FollowupDetalle.dc.html` (`componentDidMount`).
 *
 * | Tecla | Acción                          |
 * |-------|---------------------------------|
 * | A     | Guardar la ficha                |
 * | S     | Enviar el mensaje escrito       |
 * | D     | Abrir la fecha de próximo contacto |
 * | R     | Abrir la fecha de reunión       |
 * | F     | Cambiar el canal de envío       |
 * | G     | Abrir o cerrar la conversación  |
 * | H     | Abrir el chat real del canal    |
 * | V     | Abrir el perfil de LinkedIn     |
 * | Ctrl+Z / Cmd+Z | Deshacer               |
 */
export interface Atajos {
  guardar?: () => void;
  enviar?: () => void;
  proximoContacto?: () => void;
  reunion?: () => void;
  cambiarCanal?: () => void;
  conversacion?: () => void;
  irAlChat?: () => void;
  verPerfil?: () => void;
  deshacer?: () => void;
}

export function useAtajos(atajos: Atajos, bloqueados = false) {
  useEffect(() => {
    function alTeclado(e: KeyboardEvent) {
      // §9.1: se ignoran cuando el foco está en un campo editable.
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.tagName === 'SELECT' ||
          t.isContentEditable)
      ) {
        return;
      }
      if (bloqueados) return;

      const k = (e.key || '').toLowerCase();

      // Ctrl+Z / Cmd+Z se atiende antes del filtro de modificadores.
      if (k === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        atajos.deshacer?.();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const mapa: Record<string, (() => void) | undefined> = {
        a: atajos.guardar,
        s: atajos.enviar,
        d: atajos.proximoContacto,
        r: atajos.reunion,
        f: atajos.cambiarCanal,
        g: atajos.conversacion,
        h: atajos.irAlChat,
        v: atajos.verPerfil,
        // La C ya no deshace (09/09, a pedido). Ctrl+Z sí.
      };

      const accion = mapa[k];
      if (accion) {
        e.preventDefault();
        accion();
      }
    }

    document.addEventListener('keydown', alTeclado);
    return () => document.removeEventListener('keydown', alTeclado);
  }, [atajos, bloqueados]);
}
