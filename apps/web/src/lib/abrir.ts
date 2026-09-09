import { pb } from './pocketbase';

/**
 * Abrir un link en el Chrome de la cuenta que corresponde (§7.2).
 *
 * EL PROBLEMA. Augusto tiene una ventana de Chrome por cuenta de prospección,
 * cada una con su sesión de LinkedIn. Un `target="_blank"` normal abre con el
 * perfil que esté activo —casi siempre el personal— así que hay que copiar la
 * URL y pegarla en la ventana correcta; y si uno no se da cuenta, mira el perfil
 * desde la cuenta equivocada, que en LinkedIn deja rastro.
 *
 * POR QUÉ PASA POR EL SERVIDOR. Una página web no puede elegir con qué perfil
 * de navegador se abre un link: no hay API, y es a propósito. Hace falta
 * arrancar el programa con `--profile-directory`, o sea un proceso local. Hoy
 * PocketBase corre en la máquina, así que puede; en el VPS ese endpoint no
 * existe (§8.3).
 *
 * SIEMPRE ABRE ALGO. Si el endpoint no está —CRM publicado, Chrome en otra
 * ruta, el permiso apagado— cae en la pestaña de siempre. Un botón que no hace
 * nada es peor que uno que hace lo de antes.
 */
export async function abrirConPerfil(url: string, perfil: string | null | undefined) {
  if (!url) return;

  if (!perfil) {
    window.open(url, '_blank', 'noreferrer');
    return;
  }

  try {
    const r = await pb.send<{ ok?: boolean }>('/api/abrir', {
      method: 'POST',
      body: { url, perfil },
    });
    if (r?.ok) return;
  } catch {
    // 404 (no está habilitado), 400 (dominio fuera de la lista) o el programa
    // que no arranca. En los tres casos la salida es la misma.
  }

  window.open(url, '_blank', 'noreferrer');
}
