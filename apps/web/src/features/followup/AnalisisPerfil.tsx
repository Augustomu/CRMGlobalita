import { useEffect, useMemo, useState } from 'react';
import {
  cohorteDe,
  concluir,
  demoraDeRespuesta,
  dondeSeCorto,
  frecuenciaDeEnvio,
  pasoQueRespondio,
  type EnvioDelLead,
  type LeadAnalizado,
} from '@crm/core/analisis';
import { CADENCIA_POR_DEFECTO, siguientePaso } from '@crm/core/cadencia';
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
 * LO QUE EL PROTOTIPO MUESTRA Y ACÁ NO ESTÁ: «el mensaje que logró la
 * respuesta», con su texto. Eso necesita el hilo de la conversación, que el
 * CRM todavía no guarda (se lee en el chat real). Lo que sí se puede decir es
 * cuál de los R la trajo, que es la mitad accionable de la pregunta.
 */
export function AnalisisPerfil({ lead, leads }: Props) {
  const [envios, setEnvios] = useState<EnvioRecord[]>([]);
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

  if (cargando) return <p className="campo-ayuda">Leyendo los envíos…</p>;

  return (
    <div className="ana">
      <div className="ana-metricas">
        <div className="ana-metrica">
          <span className="ana-numero tabular">{mios.length}</span>
          <span className="auto-th">Enviados</span>
        </div>
        <div className="ana-metrica">
          <span className="ana-numero tabular">{lead.f_respuesta ? 1 : 0}</span>
          <span className="auto-th">Respuestas</span>
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
          <div className="ana-comparacion">
            <span>Contestan</span>
            <span className="tabular">{cohorte.tasaRespuesta}%</span>
            <span>Envíos promedio</span>
            <span className="tabular">{cohorte.enviosPromedio}</span>
            <span>Tardan</span>
            <span className="tabular">{cohorte.demoraPromedio ?? '—'}</span>
          </div>
        </div>
      ) : (
        <span className="campo-ayuda">
          Todavía no hay leads parecidos con los que comparar: hace falta la industria o el cargo.
        </span>
      )}

      <div className={`ana-conclusion ana-tono-${conclusion.tono}`}>{conclusion.texto}</div>

      {/* El hueco se dice, no se disimula (CLAUDE.md regla 6). */}
      <span className="campo-ayuda">
        El texto del mensaje que trajo la respuesta no está: el CRM todavía no guarda el hilo, se lee
        en el chat real. Llega con la integración.
      </span>
    </div>
  );
}
