import { useEffect, useMemo, useRef, useState } from 'react';
import { tocaHoy } from '@crm/core/cadencia';
import { idiomaEfectivo } from '@crm/core/idioma';
import { linkWhatsApp } from '@crm/core/telefono';
import { pb } from '../../lib/pocketbase';
import type { EnvioRecord, EtiquetaRecord, LeadRecord, PlantillaRecord, UsuarioRecord } from '../../lib/types';
import { puedeEditar, puedeUsuario } from './useLeads';
import { NOMBRE_SITUACION, iniciales } from './ListaContactos';
import { EnviarMensaje, type Propuesta } from './EnviarMensaje';
import { Colapsable, type Chip } from './Colapsable';
import { useFicha } from './useFicha';
import { useAtajos } from './useAtajos';

const HOY = new Date().toISOString().slice(0, 10);

/**
 * Los campos editables de la ficha, separados por dónde viven de verdad:
 * los de identidad en `perfil` (D01), los de la relación en `lead`.
 */
interface Valores {
  cargo: string;
  empresa: string;
  web: string;
  industria: string;
  ciudad: string;
  pais: string;
  email: string;
  email2: string;
  email3: string;
  nota: string;
  proximo_contacto: string;
}

function valoresDe(lead: LeadRecord): Valores {
  const p = lead.expand?.perfil;
  return {
    cargo: p?.cargo ?? '',
    empresa: p?.empresa ?? '',
    web: p?.web ?? '',
    industria: p?.industria ?? '',
    ciudad: p?.ciudad ?? '',
    pais: p?.pais ?? '',
    email: lead.email ?? '',
    email2: lead.email2 ?? '',
    email3: lead.email3 ?? '',
    nota: lead.nota ?? '',
    proximo_contacto: (lead.proximo_contacto ?? '').slice(0, 10),
  };
}

interface Props {
  lead: LeadRecord;
  plantillas: PlantillaRecord[];
  catalogoEtiquetas: EtiquetaRecord[];
  usuario: UsuarioRecord | null;
  onGuardado: () => void;
}

export function FichaLead({ lead, plantillas, catalogoEtiquetas, usuario, onGuardado }: Props) {
  // Dos ejes independientes: si puede editar ESTE lead, y qué campos ve.
  const editable = puedeEditar(usuario, lead);
  const veTelefono = puedeUsuario(usuario, 'verTelefono');
  const veEmails = puedeUsuario(usuario, 'verEmails');
  const veLinks = puedeUsuario(usuario, 'verLinks');
  const original = useMemo(() => valoresDe(lead), [lead.id, lead.updated]);
  const ficha = useFicha<Valores>(original, `${lead.id}:${lead.updated}`);
  const { valores, aplicar } = ficha;

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [envios, setEnvios] = useState<EnvioRecord[]>([]);
  const [etiquetasAbierto, setEtiquetasAbierto] = useState(false);
  const [logAbierto, setLogAbierto] = useState(false);
  const [infoVisible, setInfoVisible] = useState(false);
  const [propuesta, setPropuesta] = useState<Propuesta | null>(null);
  const [nonceEnviar, setNonceEnviar] = useState(0);
  const refProximo = useRef<HTMLInputElement>(null);

  const p = lead.expand?.perfil;

  useEffect(() => {
    let vivo = true;
    pb.collection('envio')
      .getFullList<EnvioRecord>({ filter: `lead = "${lead.id}"`, sort: '-enviado_en', expand: 'plantilla' })
      .then((r) => vivo && setEnvios(r))
      .catch(() => vivo && setEnvios([]));
    return () => {
      vivo = false;
    };
  }, [lead.id, lead.updated]);

  // Cambiar de lead cierra todos los paneles, como el prototipo.
  useEffect(() => {
    setEtiquetasAbierto(false);
    setLogAbierto(false);
    setInfoVisible(false);
    setPropuesta(null);
    setError(null);
  }, [lead.id]);

  const idioma = idiomaEfectivo({ pais: valores.pais });
  const wa = p?.telefono ? linkWhatsApp({ valor: p.telefono, valido: p.telefono_valido }) : undefined;
  const linkPerfil = p?.slug ? `https://www.linkedin.com/in/${p.slug}` : '';
  const vence = tocaHoy(
    { situacion: lead.situacion, proximo_contacto: lead.proximo_contacto || null },
    HOY,
  );
  const etiquetasAplicadas = lead.expand?.etiquetas ?? [];

  async function guardar() {
    if (!ficha.sucio || !editable) return;
    setGuardando(true);
    setError(null);
    try {
      if (p) {
        await pb.collection('perfil').update(p.id, {
          cargo: valores.cargo,
          empresa: valores.empresa,
          web: valores.web,
          industria: valores.industria,
          ciudad: valores.ciudad,
          pais: valores.pais,
        });
      }
      await pb.collection('lead').update(lead.id, {
        email: valores.email,
        email2: valores.email2,
        email3: valores.email3,
        nota: valores.nota,
        proximo_contacto: valores.proximo_contacto || null,
      });
      ficha.limpiar(); // §9.2: guardar limpia la pila de deshacer
      onGuardado();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarEtiqueta(et: EtiquetaRecord, poner: boolean) {
    const ids = new Set(lead.etiquetas ?? []);
    if (poner) ids.add(et.id);
    else ids.delete(et.id);
    await pb.collection('lead').update(lead.id, { etiquetas: [...ids] });
    onGuardado();
  }

  useAtajos(
    {
      guardar: () => void guardar(),
      enviar: () => setNonceEnviar((n) => n + 1),
      proximoContacto: () => refProximo.current?.showPicker?.() ?? refProximo.current?.focus(),
      verPerfil: () => linkPerfil && window.open(linkPerfil, '_blank'),
      irAlChat: () => {
        const url = wa ?? lead.link_chat ?? linkPerfil;
        if (url) window.open(url, '_blank');
      },
      deshacer: ficha.deshacer,
    },
    etiquetasAbierto || logAbierto,
  );

  const datosChips: Chip[] = [
    { clave: 'cargo', label: 'Cargo', valor: valores.cargo },
    { clave: 'empresa', label: 'Empresa', valor: valores.empresa },
    { clave: 'web', label: 'Web', valor: valores.web },
    { clave: 'industria', label: 'Industria', valor: valores.industria },
    { clave: 'ciudad', label: 'Ciudad', valor: valores.ciudad },
    { clave: 'pais', label: 'País', valor: valores.pais },
  ];

  const contactoChips: Chip[] = [
    { clave: 'email', label: 'Email', valor: valores.email },
    { clave: 'email2', label: 'Email 2', valor: valores.email2 },
    { clave: 'email3', label: 'Email 3', valor: valores.email3 },
  ];

  /** Los hitos que el prototipo muestra en el tooltip del nombre. */
  const hitos = [
    ['Invitación', lead.f_invitacion],
    ['Aceptación', lead.f_aceptacion],
    ['Respuesta', lead.f_respuesta],
    ['Último contacto', lead.f_ultimo_contacto],
    ['Cancelada', lead.f_cancelada],
  ].filter(([, v]) => v) as [string, string][];

  return (
    <section className="ficha">
      <header className="ficha-header">
        <span className="ficha-avatar" title={p?.nombre}>
          {iniciales(p?.nombre ?? '')}
        </span>

        <span className="ficha-cuenta" title="Cuenta de LinkedIn">
          {lead.expand?.cuenta?.abrev ?? '—'}
        </span>

        <span className="boton-chico" title="Asignado a">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <circle cx="12" cy="8" r="3.4" />
            <path d="M5 20a7 7 0 0114 0" />
          </svg>
          {lead.expand?.asignado?.name?.split(' ')[0] ?? 'sin asignar'}
        </span>

        <button
          type="button"
          className="boton-icono-26"
          title="Log de ediciones"
          onClick={() => setLogAbierto((a) => !a)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
        </button>

        {/* Solo aparece cuando hay algo que deshacer, como el prototipo. */}
        {ficha.hayDeshacer && (
          <button
            type="button"
            className="boton-deshacer"
            title={`Deshacer: ${ficha.ultimaEtiqueta}`}
            onClick={ficha.deshacer}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 9h11a4 4 0 010 8h-6" />
              <path d="M8 5L4 9l4 4" />
            </svg>
            <span>{ficha.ultimaEtiqueta}</span>
          </button>
        )}

        <div className="ficha-nombre-caja">
          <span className="ficha-nombre">{p?.nombre ?? '(sin perfil)'}</span>
          {hitos.length > 0 && (
            <span
              className="ficha-info"
              onMouseEnter={() => setInfoVisible(true)}
              onMouseLeave={() => setInfoVisible(false)}
            >
              <span className="ficha-info-i">i</span>
              {infoVisible && (
                <span className="ficha-info-panel">
                  {hitos.map(([label, valor]) => (
                    <span key={label} className="ficha-info-fila">
                      <span className="campo-label">{label}</span>
                      <span className="ficha-info-valor">{valor.slice(0, 10)}</span>
                    </span>
                  ))}
                </span>
              )}
            </span>
          )}
        </div>

        <div className="ficha-botonera">
          {veLinks && linkPerfil && (
            <a className="boton-icono-26" href={linkPerfil} target="_blank" rel="noreferrer" title="Abrir perfil de LinkedIn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M7 17L17 7M17 7h-7M17 7v7" />
              </svg>
            </a>
          )}

          <div className="relativo">
            <button
              type="button"
              className="boton-chico"
              title="Etiquetas del perfil"
              onClick={() => setEtiquetasAbierto((a) => !a)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M20 12l-8 8-8-8V4h8l8 8z" />
                <circle cx="8.5" cy="8.5" r="1.2" />
              </svg>
              <span className="tabular">{etiquetasAplicadas.length}</span>
            </button>
            {etiquetasAbierto && (
              <>
                <div className="popover-fondo" onClick={() => setEtiquetasAbierto(false)} />
                <div className="popover popover-anclado">
                  <span className="campo-label">Etiquetas</span>
                  <div className="chips">
                    {catalogoEtiquetas.map((et) => {
                      const puesta = (lead.etiquetas ?? []).includes(et.id);
                      return (
                        <button
                          key={et.id}
                          type="button"
                          className={`chip-pastilla ${puesta ? 'chip-pastilla-on' : ''}`}
                          title={et.del_sistema ? 'La pone el sistema (D04)' : undefined}
                          onClick={() => void cambiarEtiqueta(et, !puesta)}
                        >
                          {et.nombre}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* §9.7: sin teléfono, deshabilitado con motivo — nunca oculto. */}
          {veTelefono && wa ? (
            <a className="boton-whatsapp" href={wa} target="_blank" rel="noreferrer">
              WhatsApp
            </a>
          ) : (
            <span
              className="boton-whatsapp boton-off"
              title={p?.telefono ? `Teléfono a revisar: ${p.telefono_raw || p.telefono}` : 'Sin teléfono cargado'}
            >
              WhatsApp
            </span>
          )}
        </div>

        {/* Chips de las etiquetas aplicadas, debajo de la botonera. */}
        {etiquetasAplicadas.length > 0 && (
          <div className="ficha-etiquetas">
            {etiquetasAplicadas.map((e) => (
              <span key={e.id} className="chip-etiqueta">
                {e.nombre}
              </span>
            ))}
          </div>
        )}

        <div className="ficha-chips">
          <span className="pastilla">{lead.etapa}</span>
          <span className="pastilla">{NOMBRE_SITUACION[lead.situacion] ?? lead.situacion}</span>
          <span className="pastilla" title="Idioma sugerido por país (§5.6)">{idioma}</span>
          {vence && <span className="pastilla pastilla-alerta">le toca hoy</span>}
          {p?.no_contactar && (
            <span className="pastilla pastilla-error" title={p.no_contactar_motivo}>
              no contactar
            </span>
          )}
        </div>
      </header>

      <div className="ficha-cuerpo">
        <Colapsable
          titulo="Datos"
          chips={datosChips}
          bloques={p?.resumen ? [{ label: 'Resumen', valor: p.resumen, origen: 'extraído de LinkedIn' }] : []}
          onEditar={
            editable
              ? (clave, valor) => aplicar({ [clave]: valor } as Partial<Valores>, etiquetaDe(clave))
              : undefined
          }
        />

        <Colapsable
          titulo="Contacto"
          chips={veEmails ? contactoChips : []}
          onEditar={
            editable
              ? (clave, valor) => aplicar({ [clave]: valor } as Partial<Valores>, etiquetaDe(clave))
              : undefined
          }
        >
          {!veEmails && (
            <span className="campo-ayuda">Los emails no están habilitados para tu usuario.</span>
          )}
          <div className="campo">
            <span className="campo-label">Teléfono</span>
            <input value={veTelefono ? (p?.telefono ?? '') : '· · · · ·'} readOnly />
            <span className="campo-ayuda">
              {!veTelefono
                ? 'El teléfono no está habilitado para tu usuario.'
                : p?.telefono
                  ? p.telefono_valido
                    ? 'Normalizado (D29). Vive en el perfil, no en el lead (D08).'
                    : `A revisar. Original: ${p.telefono_raw || '—'}`
                  : 'Sin teléfono cargado.'}
            </span>
          </div>
        </Colapsable>

        <Colapsable titulo="Seguimiento" resumen={valores.proximo_contacto || 'sin fecha'}>
          <div className="campo">
            <span className="campo-label">Próximo contacto</span>
            <input
              ref={refProximo}
              type="date"
              value={valores.proximo_contacto}
              onChange={(e) => aplicar({ proximo_contacto: e.target.value }, 'Próximo contacto')}
            />
          </div>
          <div className="campo">
            <span className="campo-label">Origen</span>
            <input value={lead.lista || '—'} readOnly />
          </div>
          <p className="nota-tecnica">
            La reunión y la agenda llegan en la Etapa 3, cuando exista la colección
            <code> reunion</code>. Faltan las decisiones D10, D18 y D23.
          </p>
        </Colapsable>

        {/* El banner de propuesta del prototipo: aparece DESPUÉS de registrar
            un envío, con las dos salidas de §5.10 punto 4. */}
        {propuesta && (
          <div className="propuesta">
            <span className="propuesta-tag">Recordatorio</span>
            <span className="propuesta-texto">
              {propuesta.paso} enviado. La cadencia propone el próximo contacto para el{' '}
              <strong>{propuesta.fecha}</strong> ({propuesta.dias} días).
            </span>
            <button
              type="button"
              className="propuesta-aceptar"
              onClick={() => {
                aplicar({ proximo_contacto: propuesta.fecha }, 'Próximo contacto');
                setPropuesta(null);
              }}
            >
              Aceptar fecha
            </button>
            <button type="button" className="propuesta-descartar" onClick={() => setPropuesta(null)}>
              La cargo a mano
            </button>
          </div>
        )}

        {editable && puedeUsuario(usuario, 'enviarMensajes') && (
        <Colapsable titulo="Enviar mensaje">
          <EnviarMensaje
            lead={lead}
            plantillas={plantillas}
            nonceEnviar={nonceEnviar}
            onRegistrado={(prop) => {
              setPropuesta(prop);
              onGuardado();
            }}
          />
        </Colapsable>
        )}

        <Colapsable titulo={`Historial de envíos`} resumen={String(envios.length)} abiertoPorDefecto={false}>
          {envios.length === 0 && <span className="vacio">Todavía no se registró ningún envío.</span>}
          {envios.map((e) => (
            <div key={e.id} className="envio-fila">
              <span className="pastilla">{e.paso}</span>
              <span className={`pastilla ${e.canal === 'whatsapp' ? 'pastilla-wa' : 'pastilla-li'}`}>
                {e.canal}
              </span>
              <span className="pastilla">{e.idioma}</span>
              <span className="envio-fecha">{String(e.enviado_en).slice(0, 10)}</span>
              <p className="envio-texto">{e.texto}</p>
            </div>
          ))}
        </Colapsable>

        <Colapsable titulo="Nota" abiertoPorDefecto={false}>
          <textarea
            rows={5}
            value={valores.nota}
            onChange={(e) => aplicar({ nota: e.target.value }, 'Nota')}
            placeholder="Resumen del perfil, escrito a mano."
          />
        </Colapsable>

        {logAbierto && (
          <div className="aviso-suave">
            El log de ediciones todavía no se guarda en la base: la pila de deshacer vive solo
            mientras la ficha está abierta. Falta la colección de log (§3.2) y la decisión D21.
          </div>
        )}
      </div>

      <footer className="ficha-pie">
        {error && <span className="login-error">{error}</span>}
        <span className="campo-ayuda">
          {!editable
            ? 'Tenés este lead asignado en modo lectura: podés verlo, no editarlo.'
            : ficha.sucio
              ? 'Hay cambios sin guardar.'
              : 'Sin cambios pendientes.'}
        </span>
        <button
          type="button"
          className="boton-principal"
          disabled={!ficha.sucio || guardando || !editable}
          onClick={() => void guardar()}
          title="Guardar (A)"
        >
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </footer>
    </section>
  );
}

/** Las etiquetas del prototipo para la pila de deshacer (`REVERTIBLES`). */
function etiquetaDe(clave: string): string {
  const nombres: Record<string, string> = {
    cargo: 'Cargo',
    empresa: 'Empresa',
    web: 'Web',
    industria: 'Industria',
    ciudad: 'Ciudad',
    pais: 'País',
    email: 'Email',
    email2: 'Email 2',
    email3: 'Email 3',
    nota: 'Nota',
    proximo_contacto: 'Próximo contacto',
  };
  return nombres[clave] ?? clave;
}
