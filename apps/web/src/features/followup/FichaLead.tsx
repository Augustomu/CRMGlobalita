import { useEffect, useMemo, useRef, useState } from 'react';
import { tocaHoy } from '@crm/core/cadencia';
import { idiomaEfectivo } from '@crm/core/idioma';
import { linkWhatsApp } from '@crm/core/telefono';
import { IconoWhatsApp } from '../../ui/iconos';
import { recientes, sePuedeSacar } from '@crm/core/etiqueta';
import { diaLocal } from '@crm/core/fecha';
import { pb } from '../../lib/pocketbase';
import type { EnvioRecord, EtiquetaRecord, LeadRecord, PlantillaRecord, UsuarioRecord } from '../../lib/types';
import { puedeEditar, puedeUsuario } from './useLeads';
import { AbrirProyecto } from './AbrirProyecto';
import { nombreDePersona } from '@crm/core/linkedin';
import { NOMBRE_SITUACION, iniciales } from './ListaContactos';
import { EnviarMensaje, type Propuesta } from './EnviarMensaje';
import { Colapsable, type Chip } from './Colapsable';
import { FechaReunion } from './FechaReunion';
import { useFicha } from './useFicha';
import { useAtajos } from './useAtajos';
import { LogEdiciones } from './LogEdiciones';
import { PanelEtiquetas } from './PanelEtiquetas';
import { EditarLinks } from './EditarLinks';
import { AnalisisPerfil } from './AnalisisPerfil';

const HOY = diaLocal();

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
  telefono: string;
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
    telefono: p?.telefono ?? '',
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
  /** Aplicar una etiqueta cambia su fecha de uso: hay que releer el catálogo. */
  onEtiquetasCambiadas?: () => void;
  /** Destacar o guardar un mensaje cambia el repositorio: hay que releerlo. */
  onPlantillasCambiadas?: () => void;
  /**
   * §9.3: el estado sucio vive acá, pero quien frena la navegación es App.
   * Por eso se reporta hacia arriba en vez de resolverlo adentro de la ficha.
   */
  onSucio?: (sucio: boolean) => void;
  /** Se incrementa cuando el aviso pide «Guardar y salir». */
  nonceGuardar?: number;
  /**
   * Todos los leads. El calendario de próximo contacto los usa para saber
   * cuántos caen cada día: la carga es del equipo, no de este lead.
   */
  leads?: LeadRecord[];
}

export function FichaLead({
  lead, plantillas, catalogoEtiquetas, usuario, onGuardado, onEtiquetasCambiadas,
  onPlantillasCambiadas,
  onSucio, nonceGuardar, leads = [],
}: Props) {
  // Dos ejes independientes: si puede editar ESTE lead, y qué campos ve.
  const editable = puedeEditar(usuario, lead);
  const veTelefono = puedeUsuario(usuario, 'verTelefono');

  /**
   * La foto del perfil, pegada del portapapeles.
   *
   * De LinkedIn la foto se copia, no se descarga: bajarla es abrir la imagen
   * en otra pestaña, guardarla y después buscarla. Es la misma acción que en
   * la agenda y en la vista Lista.
   */
  async function pegarFoto() {
    if (!p || !editable) return;
    try {
      const items = await navigator.clipboard.read();
      for (const it of items) {
        const tipo = it.types.find((t) => t.startsWith('image/'));
        if (!tipo) continue;
        const blob = await it.getType(tipo);
        const datos = new FormData();
        datos.append('foto', new File([blob], `foto.${tipo.split('/')[1]}`, { type: tipo }));
        await pb.collection('perfil').update(p.id, datos);
        onGuardado();
        return;
      }
      setError('No hay ninguna imagen en el portapapeles.');
    } catch {
      setError('El navegador no dejó leer el portapapeles.');
    }
  }
  const veEmails = puedeUsuario(usuario, 'verEmails');
  const veLinks = puedeUsuario(usuario, 'verLinks');
  const original = useMemo(() => valoresDe(lead), [lead.id, lead.updated]);
  const ficha = useFicha<Valores>(original, `${lead.id}:${lead.updated}`);
  const { valores, aplicar } = ficha;

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [envios, setEnvios] = useState<EnvioRecord[]>([]);
  const [linksAbierto, setLinksAbierto] = useState(false);
  const [infoVisible, setInfoVisible] = useState(false);
  const [propuesta, setPropuesta] = useState<Propuesta | null>(null);
  const [nonceEnviar, setNonceEnviar] = useState(0);
  const refProximo = useRef<HTMLButtonElement>(null);

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
          telefono: valores.telefono,
        });
      }
      await pb.collection('lead').update(lead.id, {
        email: valores.email,
        email2: valores.email2,
        email3: valores.email3,
        nota: valores.nota,
        proximo_contacto: valores.proximo_contacto || null,
      });

      // Cambio 14: cada campo que cambió deja su entrada en el log, con el
      // valor anterior. Se calcula por diferencia contra `original` en vez de
      // usar la pila de deshacer, porque la pila tiene los pasos intermedios
      // —escribir "Meta", después "Metalúrgica"— y el log quiere el salto que
      // de verdad quedó guardado.
      //
      // Va DESPUÉS de guardar y sin await bloqueante: que falle el log no
      // puede hacer que se pierda la edición.
      for (const clave of Object.keys(valores) as (keyof Valores)[]) {
        if (valores[clave] === original[clave]) continue;
        void pb
          .collection('edicion')
          .create({
            perfil: p?.id ?? '',
            lead: lead.id,
            usuario: usuario?.id ?? '',
            campo: etiquetaDe(clave),
            antes: original[clave],
            despues: valores[clave],
          })
          .catch(() => null);
      }

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
    // Se marca cuándo se usó, que es lo que ordena las seis que se ofrecen.
    // Solo al PONER: sacarla no es usarla, y si contara, quitar una etiqueta
    // la empujaría al principio de la fila de atajos.
    if (poner) {
      await pb.collection('etiqueta').update(et.id, { usada_en: HOY }).catch(() => null);
      onEtiquetasCambiadas?.();
    }
    onGuardado();
  }

  // §9.3: App frena la navegación con esto. Se avisa en cada cambio, y al
  // desmontar se limpia — si no, cerrar la ficha dejaría el guardián trabado
  // pidiendo guardar algo que ya no está en pantalla.
  useEffect(() => {
    onSucio?.(ficha.sucio);
    return () => onSucio?.(false);
  }, [ficha.sucio, onSucio]);

  // «Guardar y salir» del aviso: se pide por nonce, como el atajo S.
  const primerNonce = useRef(true);
  useEffect(() => {
    if (primerNonce.current) {
      primerNonce.current = false;
      return;
    }
    void guardar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonceGuardar]);

  useAtajos(
    {
      guardar: () => void guardar(),
      enviar: () => setNonceEnviar((n) => n + 1),
      // Ahora es un boton que abre el calendario doble, no un <input type=date>.
      proximoContacto: () => refProximo.current?.click(),
      verPerfil: () => linkPerfil && window.open(linkPerfil, '_blank'),
      irAlChat: () => {
        const url = wa ?? lead.link_chat ?? linkPerfil;
        if (url) window.open(url, '_blank');
      },
      deshacer: ficha.deshacer,
    },
    false,
  );

  // Exactamente los cinco del prototipo. El país NO es un chip: ahí solo se usa
  // para normalizar el teléfono y sugerir el idioma, y los dos ya se ven.
  const datosChips: Chip[] = [
    { clave: 'cargo', label: 'Cargo', valor: valores.cargo },
    { clave: 'empresa', label: 'Empresa', valor: valores.empresa },
    { clave: 'web', label: 'Web', valor: valores.web },
    { clave: 'industria', label: 'Industria', valor: valores.industria },
    { clave: 'ciudad', label: 'Ciudad', valor: valores.ciudad },
  ];

  // El teléfono va PRIMERO y es un chip, no un input con texto de ayuda: solo
  // el 12% de la base tiene teléfono, así que lo que más se ve de este bloque
  // es el estado vacío, y un chip punteado lo dice sin ocupar tres renglones.
  const contactoChips: Chip[] = [
    {
      clave: 'telefono',
      label: 'Teléfono',
      valor: veTelefono ? valores.telefono : '· · · · ·',
      editable: veTelefono,
      titulo: !veTelefono
        ? 'El teléfono no está habilitado para tu usuario'
        : valores.telefono && !p?.telefono_valido
          ? `A revisar. Original: ${p?.telefono_raw || '—'}`
          : 'Vive en el perfil, no en el lead (D08). Se normaliza al guardar (D29)',
    },
    { clave: 'email', label: 'Email', valor: valores.email, editable: veEmails },
    { clave: 'email2', label: 'Email 2', valor: valores.email2, editable: veEmails },
    { clave: 'email3', label: 'Email 3', valor: valores.email3, editable: veEmails },
  ];

  /**
   * Los hitos del tooltip del nombre. «Lista» va primero, como en el prototipo:
   * es de dónde salió el lead, y era lo único que justificaba la sección
   * «Seguimiento» que sobraba en la columna.
   */
  const hitos = [
    ['Lista', lead.lista || 'sin registrar'],
    ['Invitación', lead.f_invitacion],
    ['Aceptada', lead.f_aceptacion],
    ['Respondió', lead.f_respuesta],
    ['Último contacto', lead.f_ultimo_contacto],
    ['Cancelada', lead.f_cancelada],
  ].filter(([, v]) => v) as [string, string][];

  return (
    <section className="ficha">
      <header className="ficha-header">
        {/* El prototipo lo tiene como BOTÓN: la foto se pega del
            portapapeles, igual que en la agenda. De LinkedIn se copia, no se
            descarga. */}
        <button
          type="button"
          className="ficha-avatar"
          title={
            p?.foto
              ? 'Pegar otra imagen del portapapeles'
              : 'Copiá una imagen y tocá acá para pegarla'
          }
          onClick={() => void pegarFoto()}
        >
          {p?.foto ? (
            <img src={pb.files.getURL(p as never, p.foto, { thumb: '96x96' })} alt="" />
          ) : (
            iniciales(nombreDePersona(p?.nombre ?? ''))
          )}
        </button>

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
          {/* §10.9: el nombre se guarda completo y se recorta EN LA VISTA. El
              cargo que LinkedIn deja pegado ya vive en su campo, y repetirlo
              acá empuja el resto del encabezado fuera de la pantalla. El
              entero sigue estando, en el title. */}
          <span className="ficha-nombre" title={p?.nombre}>
            {p?.nombre ? nombreDePersona(p.nombre) : '(sin perfil)'}
          </span>
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
          {editable && <AbrirProyecto lead={lead} puedeEditar={editable} />}
          {veLinks && linkPerfil && (
            <a className="boton-icono-26" href={linkPerfil} target="_blank" rel="noreferrer" title="Abrir perfil de LinkedIn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M7 17L17 7M17 7h-7M17 7v7" />
              </svg>
            </a>
          )}

          {/* §7.2: los dos links se editan a mano. El del chat no se puede
              deducir del perfil, así que sin este panel no hay forma de
              cargarlo desde la app. */}
          {veLinks && editable && (
            <div className="relativo">
              <button
                type="button"
                className="boton-icono-26"
                title="Editar los links del lead"
                onClick={() => setLinksAbierto((a) => !a)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <path d="M10 13a5 5 0 007.5.5l3-3a5 5 0 00-7-7l-1.5 1.5" />
                  <path d="M14 11a5 5 0 00-7.5-.5l-3 3a5 5 0 007 7l1.5-1.5" />
                </svg>
              </button>
              {linksAbierto && (
                <EditarLinks
                  linkPerfil={linkPerfil}
                  linkChat={lead.link_chat ?? ''}
                  onCerrar={() => setLinksAbierto(false)}
                  onGuardar={async (perfilUrl, chatUrl) => {
                    setLinksAbierto(false);
                    if (p?.id && perfilUrl) await pb.collection('perfil').update(p.id, { slug: perfilUrl });
                    await pb.collection('lead').update(lead.id, { link_chat: chatUrl });
                    onGuardado();
                  }}
                />
              )}
            </div>
          )}

          {/* §9.7: sin teléfono, apagado con el motivo en el title — nunca
              oculto. Es un icono de 26px y no un botón con texto: en la fila
              del prototipo todo mide lo mismo, y una pastilla verde de 100px
              la partía en dos renglones. */}
          {veTelefono && wa ? (
            <a
              className="boton-icono-26 boton-wa-on"
              href={wa}
              target="_blank"
              rel="noreferrer"
              title="Abrir el chat de WhatsApp"
            >
              <IconoWhatsApp />
            </a>
          ) : (
            <span
              className="boton-icono-26 boton-off"
              title={p?.telefono ? `Teléfono a revisar: ${p.telefono_raw || p.telefono}` : 'Sin teléfono cargado'}
            >
              <IconoWhatsApp />
            </span>
          )}
        </div>

        {/* Las aplicadas, cada una con su × (cambio 9), y detrás las seis
            usadas más recientemente para poner de un clic (cambio 8). Van en
            la misma fila a propósito: es el mismo gesto —etiquetar— y separarlo
            en dos filas duplicaría el espacio para lo mismo. */}
        <div className="ficha-etiquetas">
          {etiquetasAplicadas.map((e) => (
            <span key={e.id} className="chip-etiqueta">
              {e.nombre}
              {editable && sePuedeSacar(e) && (
                <button
                  type="button"
                  className="chip-etiqueta-x"
                  title={`Sacar ${e.nombre}`}
                  onClick={() => void cambiarEtiqueta(e, false)}
                >
                  ×
                </button>
              )}
            </span>
          ))}

          {editable &&
            recientes(catalogoEtiquetas, lead.etiquetas ?? []).map((e) => (
              <button
                key={e.id}
                type="button"
                className="chip-etiqueta chip-etiqueta-sugerida"
                title={`Poner ${e.nombre}`}
                onClick={() => void cambiarEtiqueta(e as EtiquetaRecord, true)}
              >
                + {e.nombre}
              </button>
            ))}
        </div>

        {lead.archivada && (
          <span className="pastilla pastilla-suave" title={lead.archivada_motivo}>
            archivada
          </span>
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

      {/*
        El orden es el del documento de diseño, y no es cosmético:

          Datos      colapsado
          Contacto   colapsado
          Fecha de reunión
          Enviar mensaje

        Con Datos y Contacto abiertos —como estaba— la fecha de reunión queda
        abajo de todo. Y la reunión es a lo que apunta toda la cadencia: tiene
        que verse sin hacer scroll.

        Se fueron tres bloques que yo había inventado y el prototipo no tiene:
        «Seguimiento» (el próximo contacto vive adentro de Fecha de reunión y
        el origen pasó al tooltip del nombre), «Historial de envíos» y «Nota»
        (ahora es el bloque «Acerca de» de Datos). «Proyectos» pasó al menú de
        acciones, que es donde lo puso el prototipo nuevo.
      */}
      <div className="ficha-cuerpo">
        <Colapsable
          titulo="Datos"
          contactoId={lead.id}
          chips={datosChips}
          bloques={[
            {
              label: 'Acerca de',
              // Lo que escribió el equipo gana sobre lo extraído: si alguien se
              // tomó el trabajo de resumir el perfil, eso es lo que vale.
              valor: valores.nota || p?.resumen || '',
              origen: !valores.nota && p?.resumen ? 'extraído de LinkedIn' : undefined,
              vacioTexto: 'el perfil no tiene sección «Acerca de»',
              clave: 'nota',
            },
          ]}
          onEditar={
            editable
              ? (clave, valor) => aplicar({ [clave]: valor } as Partial<Valores>, etiquetaDe(clave))
              : undefined
          }
        />

        <Colapsable
          titulo="Contacto"
          contactoId={lead.id}
          chips={contactoChips}
          onEditar={
            editable
              ? (clave, valor) => aplicar({ [clave]: valor } as Partial<Valores>, etiquetaDe(clave))
              : undefined
          }
        />

        <FechaReunion
          lead={lead}
          usuario={usuario}
          editable={editable}
          leads={leads}
          proximoContacto={valores.proximo_contacto}
          onProximoContacto={(f: string) => aplicar({ proximo_contacto: f }, 'Próximo contacto')}
          refProximo={refProximo}
          onCambio={onGuardado}
        />

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

        {/* §7.2 los enumera: «Datos · Contacto · Fecha de reunión ·
            Etiquetas · Log de ediciones · Análisis del perfil». Son seis, y
            este es el orden.

            Etiquetas era un popover y el log un overlay. Los dos se consultan
            MIENTRAS se trabaja el lead —qué etiquetas tiene, qué se le tocó
            antes de volver a tocarlo— y las dos formas tapan justamente lo que
            uno está mirando. */}
        <Colapsable
          titulo="Etiquetas"
          contactoId={lead.id}
          resumen={`${etiquetasAplicadas.length} en este lead`}
        >
          <PanelEtiquetas
            catalogo={catalogoEtiquetas}
            aplicadas={lead.etiquetas ?? []}
            onAlternar={(et, poner) => void cambiarEtiqueta(et as EtiquetaRecord, poner)}
            onCatalogoCambiado={() => onEtiquetasCambiadas?.()}
          />
        </Colapsable>

        {p && (
          <Colapsable titulo="Log de ediciones" contactoId={lead.id} resumen="qué se editó y quién">
            <LogEdiciones
              perfilId={p.id}
              leadId={lead.id}
              editable={editable}
              onRevertido={onGuardado}
            />
          </Colapsable>
        )}

        <Colapsable titulo="Análisis del perfil" contactoId={lead.id} resumen="qué pasó con este lead">
          <AnalisisPerfil lead={lead} leads={leads} />
        </Colapsable>

        {editable && puedeUsuario(usuario, 'enviarMensajes') && (
          <EnviarMensaje
            lead={lead}
            plantillas={plantillas}
            envios={envios}
            nonceEnviar={nonceEnviar}
            onPlantillasCambiadas={onPlantillasCambiadas}
            onRegistrado={(prop) => {
              setPropuesta(prop);
              onGuardado();
            }}
          />
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
    telefono: 'Teléfono',
    nota: 'Nota',
    proximo_contacto: 'Próximo contacto',
  };
  return nombres[clave] ?? clave;
}
