import { useState } from 'react';
import { esCorreo } from '@crm/core/reunion';

interface Props {
  /** Los mails que ya están en la ficha. */
  emails: string[];
  fecha: string;
  hora: string;
  duracion: number;
  onEnviar: (destinatarios: string[]) => void;
  onCerrar: () => void;
}

/**
 * Confirmar reunión (§5.11). Portada de `docs/prototipo/ConfirmarReunion.dc.html`.
 *
 * Manda la invitación de calendario. Se piden los mails acá y no se toman
 * derecho de la ficha porque la reunión suele sumar gente que no es el lead —el
 * jefe, el técnico— y esa lista existe solo para esta reunión: guardarla en la
 * ficha ensuciaría el contacto con direcciones que no son suyas.
 */
export function ConfirmarReunion({ emails, fecha, hora, duracion, onEnviar, onCerrar }: Props) {
  const [mails, setMails] = useState<string[]>(() => [...emails.filter(Boolean), '', '']);

  const validos = mails.filter(esCorreo).map((m) => m.trim());
  const cuando =
    (fecha ? `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}` : '') +
    (hora ? ` · ${hora}` : '') +
    (duracion ? ` · ${duracion} min` : '');

  function cambiar(i: number, v: string) {
    setMails((m) => {
      const n = [...m];
      n[i] = v;
      // Siempre queda una fila vacía al final: agregar un invitado más no
      // debería requerir buscar un botón.
      if (i === n.length - 1 && v.trim()) n.push('');
      return n;
    });
  }

  return (
    <div className="overlay-fondo" onClick={onCerrar}>
      <div className="overlay-caja cnf" onClick={(e) => e.stopPropagation()}>
        <div className="overlay-header">
          <span className="overlay-titulo">Confirmar la reunión</span>
          <span className="campo-ayuda tabular">{cuando}</span>
          <button type="button" className="boton-icono-28 al-final" title="Cerrar" onClick={onCerrar}>
            ×
          </button>
        </div>

        <div className="overlay-cuerpo cnf-cuerpo">
          {emails.filter(Boolean).length === 0 && (
            <span className="campo-ayuda">
              El perfil no tiene email guardado. El que cargás como principal queda en la ficha; las
              copias valen sólo para esta reunión.
            </span>
          )}

          {mails.map((v, i) => (
            <div key={i} className="cnf-campo">
              <span className="auto-th">{i === 0 ? 'Principal' : `Copia ${i}`}</span>
              <input
                autoFocus={i === 0}
                value={v}
                placeholder={i === 0 ? 'nombre@empresa.com' : 'opcional'}
                onChange={(e) => cambiar(i, e.target.value)}
              />
            </div>
          ))}

          <div className="cnf-pie">
            <span className={validos.length ? 'campo-ayuda' : 'cnf-falta'}>
              {validos.length
                ? `${validos.length} ${validos.length === 1 ? 'destinatario' : 'destinatarios'}`
                : 'falta al menos un correo'}
            </span>
            <button
              type="button"
              className="boton-principal al-final"
              disabled={!validos.length}
              onClick={() => onEnviar(validos)}
            >
              Enviar invitación
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
