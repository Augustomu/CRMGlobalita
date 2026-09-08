import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FILTROS_ETAPA,
  estaCompartido,
  grupoDeEtapa,
  historial,
  resumenDeRespuesta,
  visibles,
  type FilaCompartida,
  type FiltroEtapa,
} from '@crm/core/compartida';
import { ddmm } from '@crm/core/fecha';
import { pb } from '../../lib/pocketbase';
import { useEscape } from '../../lib/useEscape';

interface LeadRecord {
  id: string;
  perfil: string;
  cuenta: string;
  etapa: string;
  situacion: string;
  f_invitacion?: string;
  f_aceptacion?: string;
  f_respuesta?: string;
  proximo_contacto?: string;
  expand?: {
    perfil?: {
      id: string;
      nombre?: string;
      cargo?: string;
      empresa?: string;
      industria?: string;
      pais?: string;
      ciudad?: string;
      link_perfil?: string;
      link_empresa?: string;
    };
    cuenta?: { abrev?: string };
  };
}

interface EnvioRecord {
  lead: string;
  paso: string;
  enviado_en: string;
}

const COLUMNAS = [
  'Lead y rol',
  'Cuenta',
  'Empresa e industria',
  'Lugar',
  'Invitación',
  'Aceptación',
  'Último R',
  'Próximo envío',
  'Etapa',
];


/** El chip de etapa usa el grupo, no la R cruda: R6 sin contexto no dice nada. */
function claseDeGrupo(g: string): string {
  if (g === 'Recontacto') return 'bc-etapa-recontacto';
  if (g === 'Fase 2') return 'bc-etapa-fase2';
  if (g === 'Sin aceptar') return 'bc-etapa-sin';
  return 'bc-etapa-cadencia';
}

interface Props {
  onCerrar: () => void;
}

/**
 * Base compartida (§7.5). Portada de `docs/prototipo/BaseCompartida.dc.html`.
 *
 * UN REGISTRO POR PERFIL, no por lead. El mismo perfil trabajado por dos
 * cuentas es UNA fila con las dos cuentas, no dos filas: la tabla existe para
 * contestar «¿a esta persona ya le escribió alguien?», y partirla en dos filas
 * es exactamente la forma de que la respuesta se pierda.
 */
export function BaseCompartida({ onCerrar }: Props) {
  useEscape(onCerrar);
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [envios, setEnvios] = useState<EnvioRecord[]>([]);
  const [q, setQ] = useState('');
  const [cuenta, setCuenta] = useState('todas');
  const [etapa, setEtapa] = useState<FiltroEtapa>('todas');
  const [abierto, setAbierto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    try {
      const [l, e] = await Promise.all([
        pb.collection('lead').getFullList<LeadRecord>({ expand: 'perfil,cuenta' }),
        pb.collection('envio').getFullList<EnvioRecord>(),
      ]);
      setLeads(l);
      setEnvios(e);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const enviosPorLead = useMemo(() => {
    const m = new Map<string, EnvioRecord[]>();
    for (const e of envios) m.set(e.lead, [...(m.get(e.lead) ?? []), e]);
    return m;
  }, [envios]);

  /**
   * Los leads colapsados a una fila por perfil.
   *
   * Cuando el mismo perfil tiene varios leads gana el MÁS AVANZADO para las
   * fechas: si una cuenta lo tiene en R4 y otra recién lo invitó, lo relevante
   * antes de volver a invitarlo es que alguien ya llegó a R4.
   */
  const { filas, enviosPorPerfil } = useMemo(() => {
    const porPerfil = new Map<string, FilaCompartida>();
    const env = new Map<string, EnvioRecord[]>();
    for (const l of leads) {
      const p = l.expand?.perfil;
      if (!p) continue;
      const abrev = l.expand?.cuenta?.abrev ?? '—';
      const previa = porPerfil.get(p.id);
      const mios = enviosPorLead.get(l.id) ?? [];
      env.set(p.id, [...(env.get(p.id) ?? []), ...mios]);

      const ultimo = mios
        .filter((e) => e.paso !== 'R0' && e.paso !== 'agradecimiento')
        .sort((a, b) => b.enviado_en.localeCompare(a.enviado_en))[0];

      const nueva: FilaCompartida = {
        perfil_id: p.id,
        nombre: p.nombre ?? 'sin nombre',
        cargo: p.cargo ?? '',
        empresa: p.empresa ?? '',
        industria: p.industria ?? '',
        pais: p.pais ?? '',
        ciudad: p.ciudad ?? '',
        cuentas: [abrev],
        etapa: l.etapa,
        situacion: l.situacion,
        f_invitacion: l.f_invitacion ?? null,
        f_aceptacion: l.f_aceptacion ?? null,
        f_respuesta: l.f_respuesta ?? null,
        proximo_contacto: l.proximo_contacto ?? null,
        ultimo_paso: ultimo?.paso ?? null,
        ultimo_en: ultimo?.enviado_en ?? null,
      };

      if (!previa) {
        porPerfil.set(p.id, nueva);
        continue;
      }
      const cuentas = previa.cuentas.includes(abrev) ? previa.cuentas : [...previa.cuentas, abrev];
      // Gana el más avanzado: comparar por la R alcanza porque la cadencia es
      // lineal (R0 → R8), y `esperando_recontacto` no es un avance.
      const gana = (nueva.ultimo_paso ?? '') > (previa.ultimo_paso ?? '') ? nueva : previa;
      porPerfil.set(p.id, { ...gana, cuentas });
    }
    return { filas: [...porPerfil.values()], enviosPorPerfil: env };
  }, [leads, enviosPorLead]);

  const abrevs = useMemo(
    () => ['todas', ...[...new Set(leads.map((l) => l.expand?.cuenta?.abrev).filter(Boolean))].sort()] as string[],
    [leads],
  );

  const vistas = useMemo(() => visibles(filas, cuenta, etapa, q), [filas, cuenta, etapa, q]);
  const compartidos = vistas.filter(estaCompartido).length;

  return (
    <div className="overlay-fondo" onClick={onCerrar}>
      <div className="overlay-caja bc" onClick={(e) => e.stopPropagation()}>
        <div className="overlay-header">
          <span className="overlay-titulo">Base compartida</span>
          <span className="campo-ayuda tabular">{filas.length.toLocaleString('es-AR')} perfiles</span>
          <span className="bc-badge">un registro por perfil invitado</span>
          <input
            className="bc-buscar"
            value={q}
            placeholder="Buscar por nombre, empresa, rol, ciudad…"
            onChange={(e) => setQ(e.target.value)}
          />
          <button type="button" className="boton-icono-28" title="Cerrar" onClick={onCerrar}>
            ×
          </button>
        </div>

        <div className="bc-filtros">
          <span className="auto-th">Cuenta</span>
          {abrevs.map((a) => (
            <button
              key={a}
              type="button"
              className={`chip ${cuenta === a ? 'chip-on' : ''}`}
              onClick={() => setCuenta(a)}
            >
              {a}
            </button>
          ))}
          <span className="bc-sep" />
          <span className="auto-th">Etapa</span>
          {FILTROS_ETAPA.map((e) => (
            <button
              key={e}
              type="button"
              className={`chip ${etapa === e ? 'chip-on' : ''}`}
              onClick={() => setEtapa(e)}
            >
              {e}
            </button>
          ))}
          <span className="campo-ayuda tabular al-final">
            {vistas.length} de {filas.length}
          </span>
        </div>

        {error && <div className="aviso-error">{error}</div>}

        <div className="bc-scroll">
          <div className="bc-tabla">
            <div className="bc-encabezado">
              {COLUMNAS.map((c) => (
                <span key={c} className="auto-th">
                  {c}
                </span>
              ))}
            </div>

            {vistas.map((f) => {
              const pasos = historial(enviosPorPerfil.get(f.perfil_id) ?? [], f.f_respuesta);
              const grupo = grupoDeEtapa(f);
              const ultimo = pasos[pasos.length - 1];
              return (
                <div key={f.perfil_id} className={estaCompartido(f) ? 'bc-fila bc-fila-compartida' : 'bc-fila'}>
                  <div className="bc-celda bc-lead">
                    <span className="bc-nombre">{f.nombre}</span>
                    <span className="campo-ayuda">{f.cargo || 'sin cargo'}</span>
                  </div>
                  <div className="bc-celda bc-cuentas">
                    {f.cuentas.map((c) => (
                      <span key={c} className="bc-chip-cuenta" title={f.cuentas.length > 1 ? 'Lo trabaja más de una cuenta' : ''}>
                        {c}
                      </span>
                    ))}
                  </div>
                  <div className="bc-celda bc-empresa">
                    <span>{f.empresa || '—'}</span>
                    <span className="campo-ayuda">{f.industria || '—'}</span>
                  </div>
                  <span className="bc-celda bc-texto">{[f.ciudad, f.pais].filter(Boolean).join(' · ') || '—'}</span>
                  <span className="bc-celda bc-texto tabular">{ddmm(f.f_invitacion)}</span>
                  <span className="bc-celda bc-fuerte tabular">{ddmm(f.f_aceptacion)}</span>
                  {/* Doble clic, como el prototipo: el historial es consulta, no
                      la acción principal de la fila. */}
                  <div
                    className="bc-celda bc-ultimo"
                    title="Doble clic para ver el historial completo"
                    onDoubleClick={() => setAbierto(abierto === f.perfil_id ? null : f.perfil_id)}
                  >
                    <span className="tabular">{ultimo ? `${ultimo.paso} · ${ddmm(ultimo.fecha)}` : '—'}</span>
                    <span className="campo-ayuda">{resumenDeRespuesta(f, pasos)}</span>
                  </div>
                  <span className="bc-celda bc-proximo tabular">{ddmm(f.proximo_contacto)}</span>
                  <div className="bc-celda">
                    <span className={`bc-etapa ${claseDeGrupo(grupo)}`}>{grupo}</span>
                  </div>

                  {abierto === f.perfil_id && (
                    <div className="bc-historial">
                      <span className="auto-th">Historial de {f.nombre}</span>
                      <div className="bc-historial-chips">
                        {pasos.map((p, i) => (
                          <span key={`${p.paso}-${i}`} className="bc-paso">
                            <b>{p.paso}</b>
                            <span className="tabular">{ddmm(p.fecha)}</span>
                            <span className="campo-ayuda">{p.estado}</span>
                          </span>
                        ))}
                        {!pasos.length && <span className="campo-ayuda">Todavía no se le mandó ningún R.</span>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {!vistas.length && <div className="vacio">Ningún perfil coincide con la búsqueda.</div>}
          </div>
        </div>

        <div className="bc-pie">
          <span>
            Antes de invitar, el script consulta acá:{' '}
            <b>{compartidos}</b> {compartidos === 1 ? 'perfil marcado en ámbar ya lo trabaja' : 'perfiles marcados en ámbar ya los trabaja'}{' '}
            más de una cuenta.
          </span>
          <span className="campo-ayuda al-final">pensada para 25.000 a 30.000 perfiles</span>
        </div>
      </div>
    </div>
  );
}
