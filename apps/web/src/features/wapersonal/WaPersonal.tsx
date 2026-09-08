import { useCallback, useEffect, useMemo, useState } from 'react';
import { conDias, ultimoTexto, type MensajeChat } from '@crm/core/chat';
import { paraWhatsApp } from '@crm/core/telefono';
import { pb } from '../../lib/pocketbase';

interface ChatRecord {
  id: string;
  cuenta: string;
  nombre: string;
  telefono: string;
  no_leido: boolean;
  mensajes: MensajeChat[] | null;
}

interface EntranteRecord {
  id: string;
  cuenta: string;
  telefono: string;
  texto: string;
  recibido_en: string;
  ruteo: 'desconocido' | 'conocido_en_esta_cuenta' | 'conocido_otra_cuenta' | 'ambiguo';
  candidatos: { perfil?: string; lead?: string; nombre?: string }[] | null;
  resuelto: boolean;
}

function hoyIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function hora(iso: string): string {
  const s = String(iso ?? '');
  return s.length >= 16 ? s.slice(11, 16) : '';
}

/** El teléfono como se muestra: los últimos dígitos alcanzan para reconocerlo. */
function corto(tel: string): string {
  const t = String(tel ?? '');
  return t.length > 6 ? `…${t.slice(-6)}` : t;
}

interface Props {
  onIrAlLead: (id: string) => void;
}

/**
 * WA Personal (§7.4). Portada de `docs/prototipo/WhatsappPersonal.dc.html`.
 *
 * Existe para separar dos cosas que llegan por el mismo canal: el WhatsApp de
 * trabajo y el personal. La columna izquierda tiene tres franjas apiladas —lo
 * que ya se ruteó solo, lo que hay que decidir, y los chats personales— y esa
 * pila es el orden en que hay que mirarlas: primero lo que no requiere nada,
 * después lo que sí, y al final el archivo.
 */
export function WaPersonal({ onIrAlLead }: Props) {
  const [chats, setChats] = useState<ChatRecord[]>([]);
  const [entrantes, setEntrantes] = useState<EntranteRecord[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [borrador, setBorrador] = useState('');
  const [agendando, setAgendando] = useState<string | null>(null);
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [error, setError] = useState<string | null>(null);

  const hoy = hoyIso();

  const recargar = useCallback(async () => {
    try {
      const [c, e] = await Promise.all([
        pb.collection('chat_personal').getFullList<ChatRecord>({ sort: '-updated' }),
        pb.collection('entrante').getFullList<EntranteRecord>({ sort: '-recibido_en' }),
      ]);
      setChats(c);
      setEntrantes(e);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const activo = chats.find((c) => c.id === sel) ?? chats[0] ?? null;
  const hilo = useMemo(() => conDias(activo?.mensajes ?? [], hoy), [activo, hoy]);

  // Los que YA se rutearon solos: se avisa, no se pide nada.
  const rutedos = entrantes.filter((e) => e.resuelto && e.ruteo === 'conocido_en_esta_cuenta');
  // Los que piden una decisión.
  const pendientes = entrantes.filter((e) => !e.resuelto);

  async function esPersonal(e: EntranteRecord, nombre?: string) {
    try {
      await pb.collection('chat_personal').create({
        cuenta: e.cuenta,
        nombre: nombre?.trim() || corto(e.telefono),
        telefono: e.telefono,
        no_leido: false,
        mensajes: [{ quien: 'in', texto: e.texto, en: e.recibido_en }],
      });
      await pb.collection('entrante').update(e.id, { resuelto: true });
      setAgendando(null);
      setNombreNuevo('');
      await recargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  /**
   * «Mover a FU»: crea el perfil y el lead bajo la cuenta que recibió el
   * mensaje, y abre la ficha.
   *
   * Crea SIEMPRE con el teléfono como dato del perfil (D08), no del lead: si el
   * mismo número aparece mañana en otra cuenta, tiene que encontrar este mismo
   * perfil y no armar un duplicado.
   */
  async function moverAFollowup(telefono: string, nombre: string, cuenta: string, entranteId?: string, chatId?: string) {
    try {
      const perfil = await pb.collection('perfil').create({
        nombre: nombre || corto(telefono),
        telefono,
        telefono_raw: telefono,
        telefono_valido: Boolean(paraWhatsApp(telefono)),
      });
      const lead = await pb.collection('lead').create({
        perfil: perfil.id,
        cuenta,
        etapa: 'R0',
        situacion: 'en_curso',
        lista: 'Entrante de WhatsApp',
      });
      if (entranteId) await pb.collection('entrante').update(entranteId, { resuelto: true });
      if (chatId) await pb.collection('chat_personal').delete(chatId);
      await recargar();
      onIrAlLead(lead.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function enviar() {
    if (!activo || !borrador.trim()) return;
    const nuevos: MensajeChat[] = [
      ...(activo.mensajes ?? []),
      { quien: 'out', texto: borrador.trim(), en: new Date().toISOString() },
    ];
    setBorrador('');
    setChats((cs) => cs.map((c) => (c.id === activo.id ? { ...c, mensajes: nuevos, no_leido: false } : c)));
    await pb
      .collection('chat_personal')
      .update(activo.id, { mensajes: nuevos, no_leido: false })
      .catch(() => void recargar());
  }

  async function elegir(c: ChatRecord) {
    setSel(c.id);
    setBorrador('');
    if (c.no_leido) {
      setChats((cs) => cs.map((x) => (x.id === c.id ? { ...x, no_leido: false } : x)));
      await pb.collection('chat_personal').update(c.id, { no_leido: false }).catch(() => void recargar());
    }
  }

  return (
    <section className="wap">
      <div className="wap-col">
        <div className="wap-cabecera">
          <span className="wap-titulo">WA Personal</span>
          <span className="campo-ayuda">amigos y familia</span>
          <span className="campo-ayuda tabular al-final">{chats.length} chats</span>
        </div>

        <div className="wap-triage">
          {rutedos.length > 0 && (
            <div className="wap-auto">
              <span className="wap-auto-titulo">Ya estaban en la base: fueron al follow-up</span>
              {rutedos.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  className="wap-auto-fila"
                  onClick={() => e.candidatos?.[0]?.lead && onIrAlLead(e.candidatos[0].lead!)}
                >
                  <span className="wap-auto-nombre">{e.candidatos?.[0]?.nombre ?? corto(e.telefono)}</span>
                  <span className="wap-auto-hora tabular">{hora(e.recibido_en)}</span>
                </button>
              ))}
            </div>
          )}

          {pendientes.length > 0 ? (
            <div className="wap-nuevos">
              <span className="wap-nuevos-titulo">Números que no están en la base</span>
              {/* §7.4: el prototipo ofrece guardar también en Gmail. Necesita la
                  conexión de Google, que todavía no está (bloque D). Se deja a
                  la vista y apagado en vez de sacarlo: el hueco es parte de lo
                  que hay que ver. */}
              <button type="button" className="wap-gmail" disabled title="Necesita la conexión de Google (etapa de integraciones)">
                Conectar Gmail para agendar ahí también
              </button>

              {pendientes.map((e) => (
                <div key={e.id} className="wap-entrante">
                  <div className="wap-entrante-fila">
                    <span className="wap-entrante-nombre">{corto(e.telefono)}</span>
                    {e.ruteo === 'ambiguo' && (
                      <span
                        className="auto-chip auto-chip-agotada"
                        title="El teléfono coincide con más de un perfil: hay que elegir a mano para no colgarle el mensaje al lead equivocado"
                      >
                        ambiguo
                      </span>
                    )}
                    <span className="campo-ayuda tabular">{hora(e.recibido_en)}</span>
                  </div>
                  <span className="wap-entrante-txt">{e.texto}</span>
                  <div className="wap-acciones">
                    <button
                      type="button"
                      className="wap-boton-fu"
                      title="Lo pasa a la base y abre su ficha en Follow-up"
                      onClick={() => void moverAFollowup(e.telefono, corto(e.telefono), e.cuenta, e.id)}
                    >
                      Mover a FU
                    </button>
                    <button
                      type="button"
                      className="wap-boton"
                      title="Amigo o familia: queda en esta pestaña"
                      onClick={() => void esPersonal(e)}
                    >
                      Es personal
                    </button>
                    <button
                      type="button"
                      className="wap-boton wap-boton-plano"
                      title="Guardarlo en la agenda de contactos"
                      onClick={() => {
                        setAgendando(agendando === e.id ? null : e.id);
                        setNombreNuevo('');
                      }}
                    >
                      Agendar
                    </button>
                  </div>
                  {agendando === e.id && (
                    <div className="wap-agendar">
                      <input
                        autoFocus
                        value={nombreNuevo}
                        placeholder="Nombre para la agenda…"
                        onChange={(ev) => setNombreNuevo(ev.target.value)}
                        onKeyDown={(ev) => ev.key === 'Enter' && void esPersonal(e, nombreNuevo)}
                      />
                      <button type="button" className="wap-boton-fu" onClick={() => void esPersonal(e, nombreNuevo)}>
                        Guardar
                      </button>
                      <span className="campo-ayuda">se guarda solo en la agenda local</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="wap-vacio">sin números nuevos por identificar</div>
          )}
        </div>

        <div className="wap-chats">
          {chats.map((c) => (
            <div
              key={c.id}
              className={`wap-chat ${activo?.id === c.id ? 'wap-chat-on' : ''}`}
              onClick={() => void elegir(c)}
            >
              {c.no_leido && <span className="wap-punto" title="Sin leer" />}
              <div className="wap-chat-medio">
                <span className="wap-chat-nombre">{c.nombre}</span>
                <span className="wap-chat-ultimo">{ultimoTexto(c.mensajes ?? [])}</span>
              </div>
              {activo?.id === c.id && (
                <button
                  type="button"
                  className="wap-mover-mini"
                  title="Es de trabajo: mover a follow-up"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    void moverAFollowup(c.telefono, c.nombre, c.cuenta, undefined, c.id);
                  }}
                >
                  Mover a FU
                </button>
              )}
            </div>
          ))}
          {!chats.length && <p className="vacio">Todavía no hay chats personales.</p>}
        </div>
      </div>

      <div className="wap-hilo">
        <div className="wap-hilo-header">
          <span className="wap-hilo-nombre">{activo?.nombre ?? 'sin chat seleccionado'}</span>
          {activo && (
            <button
              type="button"
              className="wap-boton al-final"
              title="Es un contacto de trabajo: lo pasa a la base y abre su ficha en Follow-up"
              onClick={() => void moverAFollowup(activo.telefono, activo.nombre, activo.cuenta, undefined, activo.id)}
            >
              Mover a FU
            </button>
          )}
        </div>

        {error && <div className="aviso-error">{error}</div>}

        <div className="wap-burbujas">
          {hilo.map((i, n) =>
            i.tipo === 'dia' ? (
              <div key={n} className="wap-dia">
                <span>{i.etiqueta}</span>
              </div>
            ) : (
              <div key={n} className={`wap-linea ${i.quien === 'out' ? 'wap-linea-out' : ''}`}>
                <div className={`wap-burbuja ${i.quien === 'out' ? 'wap-burbuja-out' : ''}`}>
                  {i.texto}
                  <span className="wap-burbuja-hora tabular">{i.hora}</span>
                </div>
              </div>
            ),
          )}
          {!hilo.length && <p className="vacio">Elegí un chat.</p>}
        </div>

        <div className="wap-escribir">
          <textarea
            value={borrador}
            placeholder="Escribir mensaje…"
            onChange={(e) => setBorrador(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void enviar();
              }
            }}
          />
          <button type="button" className="wap-enviar" title="Enviar" disabled={!activo} onClick={() => void enviar()}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M4 12l16-8-6 16-2-6-8-2z" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}
