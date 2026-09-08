import { useEffect, useMemo, useState } from 'react';
import { CADENCIA_POR_DEFECTO, siguientePaso, tocaHoy } from '@crm/core/cadencia';
import { planDeEnvio } from '@crm/core/envio';
import { idiomaEfectivo } from '@crm/core/idioma';
import { plantillasDe, resolverParaPaso, type Plantilla } from '@crm/core/plantilla';
import { canalDe } from '@crm/core/cadencia';
import type { Idioma, Paso } from '@crm/core/tipos';
import { diaLocal } from '@crm/core/fecha';
import { pb } from '../../lib/pocketbase';
import type { LeadRecord, PlantillaRecord } from '../../lib/types';

const HOY = diaLocal();
const IDIOMAS: Idioma[] = ['es', 'pt', 'en'];

function aPlantilla(r: PlantillaRecord): Plantilla {
  return {
    id: r.id,
    nombre: r.nombre,
    paso: (r.paso || null) as Plantilla['paso'],
    por_defecto: r.por_defecto,
    textos: r.textos ?? {},
    orden: r.orden ?? 0,
  };
}

/** "hace 3 días" / "en 5 días", igual que en la lista. */
function cuanto(fecha: string): string {
  const dias = Math.round((Date.parse(fecha.slice(0, 10)) - Date.parse(HOY)) / 86_400_000);
  if (dias === 0) return 'vence hoy';
  if (dias < 0) return `hace ${-dias} días`;
  return `en ${dias} días`;
}

/**
 * Los leads a los que les toca hoy: `situacion = en_curso` con la fecha
 * cumplida (D17). Es la misma condición que usa `tocaHoy` en la lista, para que
 * no existan dos definiciones de "vencido".
 */
export function leadsVencidos(leads: LeadRecord[]): LeadRecord[] {
  return leads
    .filter((l) => tocaHoy({ situacion: l.situacion, proximo_contacto: l.proximo_contacto || null }, HOY))
    .sort((a, b) => (a.proximo_contacto || '').localeCompare(b.proximo_contacto || ''));
}

interface Props {
  leads: LeadRecord[];
  plantillas: PlantillaRecord[];
  onCerrar: () => void;
  onCambio: () => void;
}

/**
 * Vencimientos (§7.7). Overlay de a un lead por vez, con avance, para procesar
 * los que vencen. Portado de `docs/prototipo/Vencimientos.dc.html`.
 *
 * Es la cola de trabajo diaria: dado que los R se mandan a mano (D15), esta
 * pantalla es donde el equipo pasa la mayor parte del tiempo.
 */
export function Vencimientos({ leads, plantillas, onCerrar, onCambio }: Props) {
  const pendientes = useMemo(() => leadsVencidos(leads), [leads]);
  const cfg = CADENCIA_POR_DEFECTO;

  const [indice, setIndice] = useState(0);
  const [aprobados, setAprobados] = useState(0);
  const [saltados, setSaltados] = useState(0);
  const [idioma, setIdioma] = useState<Idioma>('es');
  const [texto, setTexto] = useState('');
  const [tocado, setTocado] = useState(false);
  const [plantillaId, setPlantillaId] = useState<string | undefined>();
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lead = pendientes[indice];
  const perfil = lead?.expand?.perfil;
  const terminado = indice >= pendientes.length;

  const catalogo = useMemo(() => plantillas.map(aPlantilla), [plantillas]);
  /** El idioma que sale del pais, contra el que se compara el elegido. */
  const sugerido = idiomaEfectivo({ pais: perfil?.pais ?? '' });
  const paso = (lead ? siguientePaso(cfg, lead.etapa) ?? lead.etapa : 'R1') as Paso;
  const destacados = useMemo(() => plantillasDe(catalogo, paso), [catalogo, paso]);

  const resuelto = useMemo(() => {
    if (!lead) return null;
    return resolverParaPaso(catalogo, paso, idioma, {
      nombre: perfil?.nombre,
      empresa: perfil?.empresa,
      industria: perfil?.industria,
      ciudad: perfil?.ciudad,
    }, plantillaId);
  }, [catalogo, paso, idioma, plantillaId, lead, perfil]);

  // Al cambiar de lead se recalcula el idioma y se recarga el texto.
  useEffect(() => {
    if (!lead) return;
    setIdioma(idiomaEfectivo({ pais: perfil?.pais ?? '' }));
    setPlantillaId(undefined);
    setTocado(false);
    setError(null);
  }, [lead?.id]);

  useEffect(() => {
    if (tocado || !resuelto) return;
    setTexto(resuelto.hay ? resuelto.texto : '');
  }, [resuelto, tocado]);

  // Escape cierra, como cualquier overlay.
  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    document.addEventListener('keydown', f);
    return () => document.removeEventListener('keydown', f);
  }, [onCerrar]);

  function siguiente() {
    setIndice((i) => i + 1);
    setTocado(false);
  }

  async function aprobar() {
    if (!lead || !texto || guardando) return;
    setGuardando(true);
    setError(null);
    try {
      const canal = canalDe(cfg, paso, Boolean(perfil?.telefono_valido));
      const plan = planDeEnvio(
        cfg,
        { etapa: lead.etapa, situacion: lead.situacion, tiene_telefono: Boolean(perfil?.telefono_valido) },
        {
          lead_id: lead.id,
          paso,
          canal,
          idioma,
          texto,
          plantilla_id: tocado ? undefined : plantillaId ?? (resuelto?.hay ? resuelto.plantilla.id : undefined),
          a_mano: true,
        },
        HOY,
      );

      await pb.collection('envio').create(plan.envio);

      const ids = new Set(lead.etiquetas ?? []);
      for (const nombre of plan.etiquetas_a_agregar) {
        const e = await pb.collection('etiqueta').getFirstListItem(`nombre = "${nombre}"`).catch(() => null);
        if (e) ids.add(e.id);
      }

      // Acá SÍ se aplica la fecha propuesta: aprobar en Vencimientos es
      // justamente aceptar lo que la cadencia propone (§7.7).
      await pb.collection('lead').update(lead.id, {
        etapa: paso,
        situacion: plan.lead.situacion,
        f_ultimo_contacto: plan.lead.f_ultimo_contacto,
        etiquetas: [...ids],
        ...(plan.proximo_contacto_propuesto ? { proximo_contacto: plan.proximo_contacto_propuesto } : {}),
      });

      setAprobados((n) => n + 1);
      onCambio();
      siguiente();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(false);
    }
  }

  const avance = pendientes.length ? Math.round((indice / pendientes.length) * 100) : 100;
  const proximo = lead
    ? planDeEnvio(
        cfg,
        { etapa: lead.etapa, situacion: lead.situacion, tiene_telefono: Boolean(perfil?.telefono_valido) },
        { lead_id: lead.id, paso, canal: 'linkedin', idioma, texto: '', a_mano: true },
        HOY,
      ).proximo_contacto_propuesto
    : null;

  return (
    <div className="overlay-fondo" onClick={onCerrar}>
      <div className="overlay-caja" onClick={(e) => e.stopPropagation()}>
        <header className="overlay-header">
          <span className="overlay-titulo">Vencimientos</span>
          <span className="overlay-progreso">
            {Math.min(indice + 1, pendientes.length)} de {pendientes.length}
          </span>
          <div className="barra">
            <div className="barra-avance" style={{ width: `${avance}%` }} />
          </div>
          <button type="button" className="boton-icono-26" onClick={onCerrar} title="Cerrar (Esc)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        {lead && !terminado ? (
          <div className="overlay-cuerpo">
            <div className="venc-titulo">
              <span className="ficha-cuenta">{lead.expand?.cuenta?.abrev}</span>
              <span className="venc-nombre">{perfil?.nombre}</span>
              <span className="fila-duenio">
                {lead.etapa} → {paso}
              </span>
              <span className="venc-vencimiento">{cuanto(lead.proximo_contacto)}</span>
            </div>

            <div className="ficha-etiquetas">
              {(lead.expand?.etiquetas ?? []).map((e) => (
                <span key={e.id} className="chip-etiqueta">{e.nombre}</span>
              ))}
              {(lead.expand?.etiquetas ?? []).length === 0 && (
                <span className="campo-ayuda">sin etiquetas</span>
              )}
            </div>

            <div className="venc-tarjetas">
              <div className="venc-tarjeta">
                <span className="campo-label">Vencimiento</span>
                <span className="venc-fecha">{lead.proximo_contacto?.slice(0, 10)}</span>
                <span className="campo-ayuda">{cuanto(lead.proximo_contacto)}</span>
              </div>
              <div className="venc-tarjeta venc-tarjeta-acento">
                <span className="campo-label">Próximo contacto</span>
                <span className="venc-fecha">{proximo ?? 'termina la cadencia'}</span>
                <span className="campo-ayuda">
                  {paso} · {proximo ? `${cuanto(proximo)}` : 'sin próximo paso'}
                </span>
              </div>
            </div>

            <div className="colapsable-chips">
              {[
                ['Empresa', perfil?.empresa],
                ['Ciudad', perfil?.ciudad],
                ['Último contacto', lead.f_ultimo_contacto?.slice(0, 10)],
              ]
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <span key={k} className="chip-campo">
                    <span className="chip-campo-label">{k}</span>
                    <span className="chip-campo-valor">{v}</span>
                  </span>
                ))}
            </div>

            {destacados.length > 1 && (
              <div className="campo">
                <span className="campo-label">Mensajes destacados</span>
                <div className="chips">
                  {destacados.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`chip ${(plantillaId ?? destacados[0]!.id) === p.id ? 'chip-on' : ''}`}
                      onClick={() => {
                        setPlantillaId(p.id);
                        setTocado(false);
                      }}
                    >
                      {p.nombre}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="campo">
              <div className="venc-mensaje-cabecera">
                <span className="campo-label">Mensaje que toca</span>
                <span className="pastilla">
                  {resuelto?.hay ? resuelto.plantilla.nombre : 'sin plantilla'}
                </span>
                {/* §7.7: el idioma se detecta por el país del perfil y se
                    puede cambiar. El chip dice CUÁL se detectó y por qué, para
                    que cambiarlo sea una decisión y no una corrección a ciegas.
                    Cuando el elegido no es el detectado, se avisa: mandarle en
                    español a un brasileño es el error que esta pantalla existe
                    para no repetir 40 veces por día. */}
                <span
                  className={idioma === sugerido ? 'venc-idioma' : 'venc-idioma venc-idioma-cambiado'}
                  title={
                    perfil?.pais
                      ? `Detectado por el país del perfil: ${perfil.pais}`
                      : 'El perfil no tiene país cargado: se asume español'
                  }
                >
                  {idioma === sugerido ? `detectado ${sugerido}` : `detectado ${sugerido} · vas a mandar ${idioma}`}
                </span>
                <div className="selector-idioma">
                  {IDIOMAS.map((i) => (
                    <button
                      key={i}
                      type="button"
                      className={idioma === i ? 'idioma-on' : 'idioma-off'}
                      onClick={() => {
                        setIdioma(i);
                        setTocado(false);
                      }}
                    >
                      {i}
                    </button>
                  ))}
                </div>
              </div>

              {resuelto && !resuelto.hay && (
                <div className="aviso-suave">
                  {resuelto.motivo === 'sin_plantilla'
                    ? `No hay plantilla para ${paso}. Escribí el texto a mano.`
                    : `Esa plantilla no tiene texto en ${idioma}. Escribilo o cambiá de idioma.`}
                </div>
              )}

              <textarea
                rows={5}
                value={texto}
                onChange={(e) => {
                  setTexto(e.target.value);
                  setTocado(true);
                }}
              />
            </div>

            {error && <div className="login-error">{error}</div>}
          </div>
        ) : (
          <div className="overlay-cuerpo overlay-final">
            <span className="venc-nombre">
              {pendientes.length === 0
                ? 'No hay vencimientos'
                : `${aprobados} aprobados · ${saltados} saltados`}
            </span>
            <span className="campo-ayuda">
              {pendientes.length === 0
                ? 'Nadie tiene el próximo contacto cumplido hoy.'
                : 'Los aprobados quedaron registrados con su próxima fecha aplicada.'}
            </span>
          </div>
        )}

        <footer className="overlay-pie">
          <span className="campo-ayuda">
            {pendientes.length - indice > 0
              ? `${pendientes.length - indice} por revisar`
              : 'todo revisado'}
          </span>
          {lead && !terminado ? (
            <>
              <button
                type="button"
                className="boton-secundario al-final"
                onClick={() => {
                  setSaltados((n) => n + 1);
                  siguiente();
                }}
              >
                Saltar
              </button>
              <button
                type="button"
                className="boton-principal"
                disabled={!texto || guardando}
                onClick={() => void aprobar()}
              >
                {guardando ? 'Registrando…' : '✓ Aprobar'}
              </button>
            </>
          ) : (
            <button type="button" className="boton-principal al-final" onClick={onCerrar}>
              Listo
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
