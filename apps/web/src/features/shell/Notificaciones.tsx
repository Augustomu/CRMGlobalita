import type { LeadRecord } from '../../lib/types';

/**
 * Las notificaciones (§7.1, §7.10).
 *
 * *«Total sin leer entre Follow-up y WA Personal; al abrirlo lista cada uno con
 * su canal (LI/WA) y salta a la ficha o a la pestaña.»*
 *
 * Había campana con badge, y el clic llevaba a la subtab «Sin leer» — que es
 * una lista de leads, no de mensajes. La diferencia importa: con veinte sin
 * leer, la subtab dice cuáles son pero no por dónde entró cada uno, y entrar a
 * responder por LinkedIn algo que llegó por WhatsApp es un viaje al pedo.
 */
interface Props {
  leads: LeadRecord[];
  /** Los entrantes de WA Personal que todavía no se pasaron a Follow-up. */
  waPersonal: number;
  onIrAlLead: (id: string, canal: 'linkedin' | 'whatsapp') => void;
  onIrAWaPersonal: () => void;
  onCerrar: () => void;
}

export function Notificaciones({ leads, waPersonal, onIrAlLead, onIrAWaPersonal, onCerrar }: Props) {
  // Un lead con los dos canales sin leer aparece DOS veces, una por canal: son
  // dos conversaciones distintas y se contestan en lugares distintos.
  const filas = leads.flatMap((l) => {
    const p = l.expand?.perfil;
    const base = { id: l.id, nombre: p?.nombre ?? 'sin nombre', cuenta: l.expand?.cuenta?.abrev ?? '' };
    return [
      ...(l.sin_leer_li ? [{ ...base, canal: 'linkedin' as const }] : []),
      ...(l.sin_leer_wa ? [{ ...base, canal: 'whatsapp' as const }] : []),
    ];
  });

  return (
    <>
      <div className="popover-fondo" onClick={onCerrar} />
      <div className="popover popover-anclado notif">
        <div className="notif-cabeza">
          <span className="campo-label">Sin leer</span>
          <span className="campo-ayuda al-final tabular">
            {filas.length + waPersonal} en total
          </span>
        </div>

        <div className="notif-lista">
          {filas.map((f) => (
            <button
              key={`${f.id}-${f.canal}`}
              type="button"
              className="notif-fila"
              onClick={() => {
                onIrAlLead(f.id, f.canal);
                onCerrar();
              }}
            >
              <span className={`pastilla ${f.canal === 'whatsapp' ? 'pastilla-wa' : 'pastilla-li'}`}>
                {f.canal === 'whatsapp' ? 'WA' : 'LI'}
              </span>
              <span className="notif-nombre">{f.nombre}</span>
              <span className="campo-ayuda al-final">{f.cuenta}</span>
            </button>
          ))}

          {/* WA Personal no son leads todavía: son entrantes de un número que
              nadie sumó al CRM. Por eso llevan a la pestaña y no a una ficha
              que no existe. */}
          {waPersonal > 0 && (
            <button
              type="button"
              className="notif-fila"
              onClick={() => {
                onIrAWaPersonal();
                onCerrar();
              }}
            >
              <span className="pastilla pastilla-wa">WA</span>
              <span className="notif-nombre">
                {waPersonal} {waPersonal === 1 ? 'entrante' : 'entrantes'} en WA Personal
              </span>
              <span className="campo-ayuda al-final">sin sumar</span>
            </button>
          )}

          {!filas.length && !waPersonal && (
            <div className="notif-vacio">Nada sin leer.</div>
          )}
        </div>
      </div>
    </>
  );
}
