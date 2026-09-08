import { useEffect, useMemo, useState } from 'react';
import {
  cohorteDe,
  concluir,
  demoraDeRespuesta,
  dondeSeCorto,
  minutosDeRespuesta,
  frecuenciaDeEnvio,
  pasoQueRespondio,
  type EnvioDelLead,
  type LeadAnalizado,
} from '@crm/core/analisis';
import { CADENCIA_POR_DEFECTO, siguientePaso } from '@crm/core/cadencia';
import { ddmm } from '@crm/core/fecha';
import type { Paso } from '@crm/core/tipos';
import { pb } from '../../lib/pocketbase';
import type { LeadRecord } from '../../lib/types';

interface Props {
  lead: LeadRecord;
  /** Todos los leads, para armar la cohorte de parecidos. */
  leads: LeadRecord[];
}

interface EnvioRecord extends EnvioDelLead {
  lead: string;
}

/** Un saliente del hilo, para poder mostrar el texto que trajo la respuesta. */
interface MensajeRecord {
  id: string;
  quien: 'in' | 'out';
  texto: string;
  enviado_en: string;
  canal: string;
}

function aAnalizado(l: LeadRecord): LeadAnalizado {
  return {
    id: l.id,
    etapa: l.etapa,
    cargo: l.expand?.perfil?.cargo,
    industria: l.expand?.perfil?.industria,
    f_invitacion: l.f_invitacion ?? null,
    f_aceptacion: l.f_aceptacion ?? null,
    f_respuesta: l.f_respuesta ?? null,
  };
}

/**
 * Una comparación contra la cohorte: el valor propio, el del grupo y la barra.
 *
 * La barra se llena a la mitad cuando este lead va igual que el promedio, así
 * que pasada la mitad es «mejor que el promedio» sin tener que leer números.
 */
function Comparacion({
  label,
  mio,
  suyo,
  ancho,
}: {
  label: string;
  mio: string;
  suyo: string;
  ancho: number;
}) {
  return (
    <div className="ana-barra">
      <span className="auto-th">{label}</span>
      <span className="ana-barra-valor tabular">
        {mio} <span className="campo-ayuda">vs {suyo}</span>
      </span>
      <div className="ana-barra-riel">
        <div className="ana-barra-relleno" style={{ width: `${Math.max(2, Math.round(ancho))}%` }} />
        {/* La marca del promedio. Sin ella la barra no dice contra qué. */}
        <div className="ana-barra-medio" />
      </div>
    </div>
  );
}

/** Un dato con su rótulo. Vacío se dice, no se esconde. */
function Dato({ label, valor }: { label: string; valor: string | null }) {
  return (
    <div className="ana-dato">
      <span className="auto-th">{label}</span>
      <span className={valor ? 'ana-valor' : 'ana-valor ana-vacio'}>{valor ?? 'sin datos todavía'}</span>
    </div>
  );
}

/**
 * Análisis del perfil (§7.2). Portada de `docs/prototipo/AnalisisPerfil.dc.html`.
 *
 * «El mensaje que logró la respuesta» sale del hilo (colección `mensaje`): es
 * el último saliente ANTERIOR a la respuesta. Estuvo mucho tiempo sin poder
 * mostrarse porque el CRM no guardaba la conversación; ahora sí, y por eso se
 * muestra el texto además del paso.
 *
 * Cuando el hilo todavía no tiene nada —que es lo normal hasta que el worker
 * lea los chats— se sigue diciendo cuál de los R la trajo, que es la mitad
 * accionable de la pregunta.
 */
export function AnalisisPerfil({ lead, leads }: Props) {
  const [envios, setEnvios] = useState<EnvioRecord[]>([]);
  const [hilo, setHilo] = useState<MensajeRecord[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;
    pb.collection('envio')
      .getFullList<EnvioRecord>({ fields: 'lead,paso,enviado_en' })
      .then((r) => {
        if (vivo) {
          setEnvios(r);
          setCargando(false);
        }
      })
      .catch(() => vivo && setCargando(false));

    // Sólo los salientes de ESTE lead: el que trajo la respuesta es uno de
    // ellos, y traer el hilo entero de la base para leer uno sería absurdo.
    pb.collection('mensaje')
      .getFullList<MensajeRecord>({ filter: `lead = "${lead.id}"`, sort: 'enviado_en' })
      .then((r) => vivo && setHilo(r))
      .catch(() => vivo && setHilo([]));
    return () => {
      vivo = false;
    };
  }, []);

  const porLead = useMemo(() => {
    const m = new Map<string, EnvioDelLead[]>();
    for (const e of envios) m.set(e.lead, [...(m.get(e.lead) ?? []), { paso: e.paso, enviado_en: e.enviado_en }]);
    return m;
  }, [envios]);

  const mios = porLead.get(lead.id) ?? [];
  const yo = aAnalizado(lead);
  const cohorte = useMemo(() => cohorteDe(yo, leads.map(aAnalizado), porLead), [lead, leads, porLead]);
  const siguiente = siguientePaso(CADENCIA_POR_DEFECTO, lead.etapa as Paso);
  const conclusion = concluir(yo, mios, cohorte, siguiente);

  const frecuencia = frecuenciaDeEnvio(mios);
  const corte = dondeSeCorto(mios, lead.f_respuesta);
  const respondio = pasoQueRespondio(mios, lead.f_respuesta);

  /**
   * El texto del mensaje que trajo la respuesta.
   *
   * Es la misma regla que `envioQueRespondio` —el último saliente anterior a
   * la respuesta— pero sobre el HILO, que es donde está el texto. Se compara
   * el timestamp completo: un mensaje de las 18:00 no provocó una respuesta de
   * las 11:40 del mismo día.
   */
  const salientes = useMemo(() => hilo.filter((m) => m.quien === 'out'), [hilo]);
  /** Los del lead. El prototipo los cuenta como «Recibidos». */
  const entrantes = useMemo(() => hilo.filter((m) => m.quien === 'in'), [hilo]);

  const textoQueRespondio = useMemo(() => {
    const r = String(lead.f_respuesta ?? '');
    if (!r) return null;
    const previos = salientes.filter((m) => String(m.enviado_en ?? '').localeCompare(r) <= 0);
    return previos[previos.length - 1] ?? null;
  }, [salientes, lead.f_respuesta]);

  /**
   * El entrante que vino después, para poder decir las dos horas.
   *
   * «enviado 10:14 · respondió 18:40» dice de un vistazo lo que tardó; con una
   * sola de las dos hay que ir a buscar la otra.
   */
  const respuestaAl = useMemo(() => {
    if (!textoQueRespondio) return null;
    return entrantes.find(
      (m) => String(m.enviado_en ?? '').localeCompare(String(textoQueRespondio.enviado_en)) > 0,
    ) ?? null;
  }, [entrantes, textoQueRespondio]);

  if (cargando) return <p className="campo-ayuda">Leyendo los envíos…</p>;

  return (
    <div className="ana">
      <div className="ana-metricas">
        <div className="ana-metrica">
          <span className="ana-numero tabular">{mios.length}</span>
          <span className="auto-th">Enviados</span>
        </div>
        <div className="ana-metrica">
          {/* Los mensajes DEL LEAD, no un 0/1. Con el hilo guardado es un
              número de verdad: tres respuestas y una respuesta no son el mismo
              lead. Si el hilo todavía no llegó, cae a la fecha de respuesta,
              que es lo único que se sabe. */}
          <span className="ana-numero tabular">
            {entrantes.length || (lead.f_respuesta ? 1 : 0)}
          </span>
          <span className="auto-th">Recibidos</span>
        </div>
        <div className="ana-metrica">
          {/* Manual p. 6: `respuesta − aceptacion`, en lenguaje natural. «0
              días» para una respuesta de la misma tarde dice algo falso —que
              fue instantánea—; «8 h» dice lo que pasó. */}
          <span className="ana-numero tabular">{demoraDeRespuesta(yo, mios) ?? '—'}</span>
          <span className="auto-th">Tardó en contestar</span>
        </div>
        <div className="ana-metrica">
          <span className="ana-numero tabular">{frecuencia != null ? `${frecuencia} d` : '—'}</span>
          <span className="auto-th">Cada cuánto se le escribe</span>
        </div>
      </div>

      <div className="ana-campos">
        <Dato label="Qué paso lo trajo" valor={respondio} />
        <Dato label="Dónde se cortó" valor={corte} />
        <Dato label="Próximo paso" valor={siguiente ?? 'la cadencia terminó'} />
        <Dato
          label="Aceptó la invitación"
          valor={lead.f_aceptacion ? String(lead.f_aceptacion).slice(0, 10) : null}
        />
      </div>

      {cohorte ? (
        <div className="ana-cohorte">
          <span className="auto-th">
            Comparado con {cohorte.cuantos} leads de {cohorte.criterio}
          </span>
          {/* «X vs Y» con la barra, como el prototipo. Los números solos
              obligan a comparar de memoria; la barra dice de un vistazo si
              este lead está por arriba o por debajo, que es la única pregunta
              que se le hace a una comparación. */}
          <div className="ana-barras">
            <Comparacion
              label="Mensajes enviados"
              mio={String(mios.length)}
              suyo={String(cohorte.enviosPromedio)}
              ancho={
                cohorte.enviosPromedio
                  ? Math.min(100, (mios.length / cohorte.enviosPromedio) * 50)
                  : 0
              }
            />
            <Comparacion
              label="Tiempo de respuesta"
              mio={demoraDeRespuesta(yo, mios) ?? '—'}
              suyo={cohorte.demoraPromedio ?? '—'}
              // Más corto que el promedio llena más barra: acá lo bueno es
              // tardar menos, al revés que en las otras dos.
              ancho={
                minutosDeRespuesta(yo, mios) != null && cohorte.minutosPromedio
                  ? Math.min(100, (cohorte.minutosPromedio / (minutosDeRespuesta(yo, mios) || 1)) * 50)
                  : 0
              }
            />
            <Comparacion
              label="Tasa de respuesta"
              mio={`${mios.length ? Math.round((entrantes.length / mios.length) * 100) : 0}%`}
              suyo={`${cohorte.tasaRespuesta}%`}
              ancho={mios.length ? Math.min(100, (entrantes.length / mios.length) * 100) : 0}
            />
          </div>
        </div>
      ) : (
        <span className="campo-ayuda">
          Todavía no hay leads parecidos con los que comparar: hace falta la industria o el cargo.
        </span>
      )}

      <div className={`ana-conclusion ana-tono-${conclusion.tono}`}>{conclusion.texto}</div>

      {/* §7.2: «el mensaje que logró la respuesta», con su texto. */}
      {textoQueRespondio ? (
        <div className="ana-mensaje">
          <span className="auto-th">El mensaje que trajo la respuesta</span>
          <p>{textoQueRespondio.texto}</p>
          <span className="campo-ayuda tabular">
            {textoQueRespondio.canal === 'whatsapp' ? 'WhatsApp' : 'LinkedIn'} · enviado{' '}
            {ddmm(textoQueRespondio.enviado_en)} {String(textoQueRespondio.enviado_en).slice(11, 16)}
            {respuestaAl
              ? ` · respondió ${ddmm(respuestaAl.enviado_en)} ${String(respuestaAl.enviado_en).slice(11, 16)}`
              : ''}
          </span>
        </div>
      ) : (
        // El hueco se dice, no se disimula (CLAUDE.md regla 6).
        <span className="campo-ayuda">
          {lead.f_respuesta
            ? 'El texto del mensaje que trajo la respuesta no está en el hilo todavía: el CRM guarda lo registrado, y el resto llega cuando el worker lea los chats.'
            : 'Todavía no contestó, así que no hay mensaje que haya traído nada.'}
        </span>
      )}
    </div>
  );
}
