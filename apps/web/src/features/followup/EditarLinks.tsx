import { useState } from 'react';
import { pareceHiloDeChat, slugDeLinkedIn, urlDePerfil } from '@crm/core/linkedin';

interface Props {
  linkPerfil: string;
  linkChat: string;
  onGuardar: (perfil: string, chat: string) => void;
  onCerrar: () => void;
}

/**
 * Editar links (§7.2). Portada de `docs/prototipo/EditarLinks.dc.html`.
 *
 * Los dos links del lead: el perfil público y el hilo del chat. Se editan a
 * mano porque el del chat NO se puede deducir — LinkedIn lo arma con un id de
 * conversación que solo existe una vez que alguien abrió el hilo. El del
 * perfil sí se puede armar desde el slug, y por eso arranca con ese valor.
 */
export function EditarLinks({ linkPerfil, linkChat, onGuardar, onCerrar }: Props) {
  const [perfil, setPerfil] = useState(linkPerfil);
  const [chat, setChat] = useState(linkChat);

  // Lo que se guarda es el SLUG, no lo que se pego: el slug es la identidad y
  // la URL es una de las formas de escribirlo (D08).
  const slug = slugDeLinkedIn(perfil);
  const chatRaro = !pareceHiloDeChat(chat);

  return (
    <>
      <div className="popover-fondo" onClick={onCerrar} />
      <div className="popover popover-anclado edl">
        <div className="pet-header">
          <span className="campo-label">Links</span>
        </div>
        <div className="edl-campo">
          <span className="auto-th">Perfil</span>
          <input
            autoFocus
            value={perfil}
            placeholder="https://www.linkedin.com/in/…"
            onChange={(e) => setPerfil(e.target.value)}
          />
          {perfil.trim() && !slug && (
            <span className="pet-error">No se reconoce un perfil de LinkedIn ahí.</span>
          )}
          {slug && <span className="campo-ayuda">Se guarda como «{slug}» → {urlDePerfil(slug)}</span>}
        </div>
        <div className="edl-campo">
          <span className="auto-th">Chat</span>
          <input
            value={chat}
            placeholder="https://www.linkedin.com/messaging/thread/…"
            onChange={(e) => setChat(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onGuardar(slug, chat.trim())}
          />
          <span className={chatRaro ? 'pet-error' : 'campo-ayuda'}>
            {chatRaro
              ? 'Eso no parece un hilo de chat. El del perfil va en el campo de arriba.'
              : 'El del chat hay que pegarlo: LinkedIn lo arma con un id de conversación que solo existe después de abrir el hilo.'}
          </span>
        </div>
        <button
          type="button"
          className="boton-principal al-final"
          onClick={() => onGuardar(slug, chat.trim())}
        >
          Aplicar
        </button>
      </div>
    </>
  );
}
