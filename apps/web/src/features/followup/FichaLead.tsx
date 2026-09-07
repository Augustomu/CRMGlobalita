import { useEffect, useState } from 'react';
import { tocaHoy } from '@crm/core/cadencia';
import { idiomaEfectivo } from '@crm/core/idioma';
import { linkWhatsApp } from '@crm/core/telefono';
import { pb } from '../../lib/pocketbase';
import type { EnvioRecord, LeadRecord, PlantillaRecord } from '../../lib/types';
import { NOMBRE_SITUACION } from './ListaContactos';
import { EnviarMensaje } from './EnviarMensaje';

const HOY = new Date().toISOString().slice(0, 10);

/** Campos editables, separados por dónde viven de verdad (D01, D08). */
interface Borrador {
  // perfil = identidad de la persona, compartida por las 10 cuentas
  cargo: string;
  empresa: string;
  industria: string;
  ciudad: string;
  pais: string;
  // lead = el trabajo de esta cuenta con esa persona
  email: string;
  nota: string;
  proximo_contacto: string;
}

function borradorDe(lead: LeadRecord): Borrador {
  const p = lead.expand?.perfil;
  return {
    cargo: p?.cargo ?? '',
    empresa: p?.empresa ?? '',
    industria: p?.industria ?? '',
    ciudad: p?.ciudad ?? '',
    pais: p?.pais ?? '',
    email: lead.email ?? '',
    nota: lead.nota ?? '',
    proximo_contacto: (lead.proximo_contacto ?? '').slice(0, 10),
  };
}

export function FichaLead({
  lead,
  plantillas,
  onGuardado,
}: {
  lead: LeadRecord;
  plantillas: PlantillaRecord[];
  onGuardado: () => void;
}) {
  const [borrador, setBorrador] = useState<Borrador>(() => borradorDe(lead));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [envios, setEnvios] = useState<EnvioRecord[]>([]);

  useEffect(() => {
    setBorrador(borradorDe(lead));
    setError(null);
  }, [lead.id, lead.updated]);

  // El historial de envíos es la base de la analítica (§3.2); acá se muestra
  // como lo que el equipo necesita ver: qué se mandó y cuándo.
  useEffect(() => {
    let vivo = true;
    pb.collection('envio')
      .getFullList<EnvioRecord>({ filter: `lead = "${lead.id}"`, sort: '-enviado_en' })
      .then((r) => vivo && setEnvios(r))
      .catch(() => vivo && setEnvios([]));
    return () => {
      vivo = false;
    };
  }, [lead.id, lead.updated]);

  const p = lead.expand?.perfil;
  const original = borradorDe(lead);
  const sucio = (Object.keys(borrador) as (keyof Borrador)[]).some(
    (k) => borrador[k] !== original[k],
  );

  const idioma = idiomaEfectivo({ pais: borrador.pais });
  const wa = p?.telefono
    ? linkWhatsApp({ valor: p.telefono, valido: p.telefono_valido })
    : undefined;
  const vence = tocaHoy(
    { situacion: lead.situacion, proximo_contacto: lead.proximo_contacto || null },
    HOY,
  );

  function set<K extends keyof Borrador>(k: K, v: Borrador[K]) {
    setBorrador((b) => ({ ...b, [k]: v }));
  }

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      if (p) {
        await pb.collection('perfil').update(p.id, {
          cargo: borrador.cargo,
          empresa: borrador.empresa,
          industria: borrador.industria,
          ciudad: borrador.ciudad,
          pais: borrador.pais,
        });
      }
      await pb.collection('lead').update(lead.id, {
        email: borrador.email,
        nota: borrador.nota,
        proximo_contacto: borrador.proximo_contacto || null,
      });
      onGuardado();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="ficha">
      <header className="ficha-header">
        <div className="ficha-titulo-fila">
          <h2 className="ficha-nombre" title={p?.nombre}>
            {p?.nombre ?? '(sin perfil)'}
          </h2>
          {p?.no_contactar && (
            <span className="pastilla pastilla-error" title={p.no_contactar_motivo}>
              no contactar
            </span>
          )}
        </div>

        <div className="ficha-chips">
          <span className="pastilla">{lead.expand?.cuenta?.abrev ?? '—'}</span>
          <span className="pastilla">{lead.etapa}</span>
          <span className="pastilla">{NOMBRE_SITUACION[lead.situacion] ?? lead.situacion}</span>
          <span className="pastilla" title="Idioma sugerido por país (§5.6)">
            {idioma}
          </span>
          {vence && <span className="pastilla pastilla-alerta">le toca hoy</span>}
          <span className="pastilla pastilla-suave">
            {lead.expand?.asignado?.name ?? 'sin asignar'}
          </span>
        </div>

        <div className="ficha-acciones">
          {p?.slug && (
            <a
              className="boton-secundario"
              href={`https://www.linkedin.com/in/${p.slug}`}
              target="_blank"
              rel="noreferrer"
            >
              Perfil
            </a>
          )}
          {lead.link_chat && (
            <a className="boton-secundario" href={lead.link_chat} target="_blank" rel="noreferrer">
              Chat LinkedIn
            </a>
          )}
          {/* §9.7: sin teléfono se muestra deshabilitado con motivo, no oculto. */}
          {wa ? (
            <a className="boton-whatsapp" href={wa} target="_blank" rel="noreferrer">
              WhatsApp
            </a>
          ) : (
            <span
              className="boton-whatsapp boton-off"
              title={
                p?.telefono
                  ? `Teléfono a revisar: ${p.telefono_raw || p.telefono}`
                  : 'Sin teléfono cargado'
              }
            >
              WhatsApp
            </span>
          )}
        </div>
      </header>

      <div className="ficha-cuerpo">
        <Bloque titulo="Datos">
          <Campo label="Cargo" valor={borrador.cargo} onChange={(v) => set('cargo', v)} />
          <Campo label="Empresa" valor={borrador.empresa} onChange={(v) => set('empresa', v)} />
          <Campo label="Industria" valor={borrador.industria} onChange={(v) => set('industria', v)} />
          <Campo label="Ciudad" valor={borrador.ciudad} onChange={(v) => set('ciudad', v)} />
          <Campo label="País" valor={borrador.pais} onChange={(v) => set('pais', v)} />
          <p className="nota-tecnica">
            Estos campos viven en el <strong>perfil</strong>: se comparten con las otras cuentas
            que trabajen a la misma persona (D01).
          </p>
        </Bloque>

        <Bloque titulo="Contacto">
          <Campo label="Email" valor={borrador.email} onChange={(v) => set('email', v)} />
          <div className="campo">
            <span className="campo-label">Teléfono</span>
            <input value={p?.telefono ?? ''} readOnly />
            <span className="campo-ayuda">
              {p?.telefono
                ? p.telefono_valido
                  ? 'Normalizado (D29). Vive en el perfil, no en el lead (D08).'
                  : `A revisar. Original: ${p.telefono_raw || '—'}`
                : 'Sin teléfono cargado.'}
            </span>
          </div>
        </Bloque>

        <Bloque titulo="Seguimiento">
          <div className="campo">
            <span className="campo-label">Próximo contacto</span>
            <input
              type="date"
              value={borrador.proximo_contacto}
              onChange={(e) => set('proximo_contacto', e.target.value)}
            />
          </div>
          <div className="campo">
            <span className="campo-label">Origen</span>
            <input value={lead.lista || '—'} readOnly />
          </div>
        </Bloque>

        <Bloque titulo="Etiquetas">
          <div className="chips">
            {(lead.expand?.etiquetas ?? []).map((e) => (
              <span key={e.id} className={`chip ${e.del_sistema ? 'chip-sistema' : ''}`}>
                {e.nombre}
              </span>
            ))}
            {(lead.expand?.etiquetas ?? []).length === 0 && (
              <span className="vacio">Sin etiquetas.</span>
            )}
          </div>
        </Bloque>

        <Bloque titulo="Enviar mensaje">
          <EnviarMensaje lead={lead} plantillas={plantillas} onRegistrado={onGuardado} />
        </Bloque>

        <Bloque titulo={`Historial de envíos (${envios.length})`}>
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
        </Bloque>

        <Bloque titulo="Nota">
          <textarea
            rows={5}
            value={borrador.nota}
            onChange={(e) => set('nota', e.target.value)}
            placeholder="Resumen del perfil, escrito a mano."
          />
        </Bloque>

        {p?.resumen && (
          <Bloque titulo="Análisis del perfil">
            <p className="texto-largo">{p.resumen}</p>
            <span className="campo-ayuda">extraído de LinkedIn</span>
          </Bloque>
        )}
      </div>

      <footer className="ficha-pie">
        {error && <span className="login-error">{error}</span>}
        <span className="campo-ayuda">
          {sucio ? 'Hay cambios sin guardar.' : 'Sin cambios pendientes.'}
        </span>
        <button
          type="button"
          className="boton-principal"
          disabled={!sucio || guardando}
          onClick={() => void guardar()}
        >
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </footer>
    </section>
  );
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  const [abierto, setAbierto] = useState(true);
  return (
    <div className="bloque">
      <button type="button" className="bloque-cabecera" onClick={() => setAbierto((a) => !a)}>
        <span className="bloque-flecha">{abierto ? '▾' : '▸'}</span>
        {titulo}
      </button>
      {abierto && <div className="bloque-cuerpo">{children}</div>}
    </div>
  );
}

function Campo({
  label,
  valor,
  onChange,
}: {
  label: string;
  valor: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="campo">
      <span className="campo-label">{label}</span>
      <input value={valor} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
