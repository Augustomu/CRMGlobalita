import { useEffect, useMemo, useState } from 'react';
import {
  planDeAlta,
  problemasDelAlta,
  proximoSugerido,
  type AltaDeLead,
} from '@crm/core/alta-lead';
import { decidirAlta } from '@crm/core/dedupe';
import { diaLocal } from '@crm/core/fecha';
import { NOMBRE_CASA } from '@crm/core/proyecto';
import { pb } from '../../lib/pocketbase';
import type { CuentaRecord, PerfilRecord } from '../../lib/types';

const HOY = diaLocal();

interface Props {
  /** La cuenta que viene propuesta: la del lead abierto, o la primera. */
  cuenta?: string;
  /** Quién queda siguiendo al lead. Es el que está cargando. */
  asignado?: string;
  /**
   * El nombre con el que arranca el formulario.
   *
   * Lo usa «Conectar con un lead» de la agenda: ahí ya se sabe cómo se llama la
   * persona —está en el título del evento del calendario— y volver a tipearlo
   * sería pedir un dato que la pantalla anterior ya tenía.
   */
  nombre?: string;
  onCerrar: () => void;
  /** Se llama con el id del lead nuevo para poder abrirlo. */
  onCreado: (leadId: string) => void;
}

/** Un perfil que se parece al que se está cargando. */
interface Parecido {
  id: string;
  slug: string;
  urn: string;
  huella: string;
  nombre: string;
  empresa: string;
  telefono: string;
}

/**
 * Cargar un lead a mano (§7.2).
 *
 * Hasta acá a la base sólo se entraba por un CSV o por un WhatsApp entrante.
 * Falta el caso de todos los días: te pasan un contacto, lo conocés en una
 * feria, te lo recomienda un cliente. Armar un CSV de una fila para eso es
 * absurdo, y el resultado es que ese contacto termina en un papel.
 *
 * Dos campos obligatorios y nada más —nombre y cuenta—, porque un formulario
 * que pide diez cosas para guardar una es un formulario que no se usa. Lo que
 * falta se completa después: la mitad la trae el scan de LinkedIn.
 *
 * Lo que sí hace antes de guardar es preguntar si esa persona ya está (D02).
 * Cargar dos veces al mismo es el error caro: se le escribe desde dos cuentas
 * y se quema el contacto.
 */
export function NuevoLead({ cuenta, asignado, nombre, onCerrar, onCreado }: Props) {
  const [cuentas, setCuentas] = useState<CuentaRecord[]>([]);
  const [a, setA] = useState<AltaDeLead>({
    nombre: nombre ?? '',
    cuenta: cuenta ?? '',
    proximo_contacto: proximoSugerido(HOY),
  });
  const [parecidos, setParecidos] = useState<Parecido[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(false);

  useEffect(() => {
    pb.collection('cuenta')
      .getFullList<CuentaRecord>({ sort: 'slot' })
      .then((cs) => {
        setCuentas(cs);
        setA((v) => (v.cuenta ? v : { ...v, cuenta: cs[0]?.id ?? '' }));
      })
      .catch(() => setCuentas([]));
  }, []);

  const linea = cuentas.find((c) => c.id === a.cuenta)?.linea_negocio ?? null;
  const plan = useMemo(() => planDeAlta(a, linea), [a, linea]);
  const problemas = problemasDelAlta(a);
  const falta = (campo: keyof AltaDeLead) => problemas.some((p) => p.campo === campo);

  const set = (campo: keyof AltaDeLead) => (e: { target: { value: string } }) =>
    setA((v) => ({ ...v, [campo]: e.target.value }));

  /**
   * Busca a esa persona en la base antes de crearla.
   *
   * Se dispara al salir de los campos que identifican —nombre, empresa,
   * LinkedIn, teléfono— y otra vez al guardar, porque entre que se escribió y
   * se apretó el botón alguien pudo haberla cargado.
   */
  async function buscarParecidos(): Promise<Parecido[]> {
    const { slug, urn, huella } = plan.identidad;
    const tel = String(plan.perfil.telefono ?? '');
    const nombre = String(plan.perfil.nombre ?? '');
    if (!nombre) return [];

    // El nombre entra como «contiene» además de la huella: la huella exige que
    // coincida la empresa, y en un alta a mano la empresa casi nunca está.
    const partes = [
      slug ? 'slug = ' + JSON.stringify(slug) : '',
      urn ? 'urn = ' + JSON.stringify(urn) : '',
      huella ? 'huella = ' + JSON.stringify(huella) : '',
      tel ? 'telefono = ' + JSON.stringify(tel) : '',
      'nombre ~ ' + JSON.stringify(nombre),
    ].filter(Boolean);

    setBuscando(true);
    try {
      const r = await pb.collection('perfil').getList<Parecido>(1, 6, {
        filter: partes.join(' || '),
        fields: 'id,slug,urn,huella,nombre,empresa,telefono',
      });
      setParecidos(r.items);
      return r.items;
    } catch {
      // Que falle la búsqueda no puede impedir cargar el lead: lo peor que
      // pasa es un duplicado, y para eso está la bandeja de Duplicados.
      setParecidos([]);
      return [];
    } finally {
      setBuscando(false);
    }
  }

  async function guardar() {
    setIntento(true);
    if (problemas.length) return;
    setGuardando(true);
    setError(null);
    try {
      const candidatos = await buscarParecidos();
      const veredicto = decidirAlta(plan.identidad, candidatos);

      let perfilId: string;
      if (veredicto.accion === 'mismo') {
        // Ya está cargada: no se crea otra vez, se le completa lo que falte.
        // Completar, no pisar: lo que ya está lo puso alguien a mano.
        perfilId = veredicto.perfil_id;
        const antes = await pb.collection('perfil').getOne<PerfilRecord>(perfilId);
        const completar: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(plan.perfil)) {
          const actual = (antes as unknown as Record<string, unknown>)[k];
          if (v !== '' && v != null && !actual) completar[k] = v;
        }
        if (Object.keys(completar).length) {
          await pb.collection('perfil').update(perfilId, completar);
        }
      } else {
        const nuevo = await pb.collection('perfil').create({
          ...plan.perfil,
          // D02: entra igual, marcado. Fusionar es decisión de una persona.
          posible_duplicado_de:
            veredicto.accion === 'nuevo_posible_duplicado' ? veredicto.candidatos : null,
        });
        perfilId = nuevo.id;
      }

      // Un lead por (perfil, cuenta): si ya existe, se abre el que hay.
      const filtro =
        'perfil = ' + JSON.stringify(perfilId) + ' && cuenta = ' + JSON.stringify(a.cuenta);
      const yaHay = await pb.collection('lead').getFirstListItem(filtro).catch(() => null);
      if (yaHay) {
        onCreado(yaHay.id);
        onCerrar();
        return;
      }

      const lead = await pb.collection('lead').create({
        ...plan.lead,
        perfil: perfilId,
        asignado: a.asignado || asignado || '',
      });
      onCreado(lead.id);
      onCerrar();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(false);
    }
  }

  const yaEsta = decidirAlta(plan.identidad, parecidos);

  return (
    <div className="overlay-fondo" onClick={onCerrar}>
      <div className="overlay-caja alta" onClick={(e) => e.stopPropagation()}>
        <div className="overlay-header">
          <span className="overlay-titulo">Nuevo lead</span>
          {/* La casa no se elige: se deduce de la cuenta. Se muestra para que
              se vea que elegir la cuenta ya decidió el negocio (§3.13). */}
          {plan.casa && <span className="overlay-progreso">{NOMBRE_CASA[plan.casa]}</span>}
          <button
            type="button"
            className="boton-icono-28 al-final"
            title="Cerrar"
            onClick={onCerrar}
          >
            ×
          </button>
        </div>

        <div className="overlay-cuerpo alta-cuerpo">
          <div className="alta-fila">
            <label className="campo alta-ancho">
              <span className="campo-label">Nombre y apellido *</span>
              <input
                autoFocus
                value={a.nombre}
                onChange={set('nombre')}
                onBlur={() => void buscarParecidos()}
                className={intento && falta('nombre') ? 'campo-mal' : ''}
                placeholder="Como figura en LinkedIn"
              />
            </label>
            <label className="campo alta-corto">
              <span className="campo-label">Cuenta *</span>
              <select
                value={a.cuenta}
                onChange={set('cuenta')}
                className={intento && falta('cuenta') ? 'campo-mal' : ''}
              >
                {!a.cuenta && <option value="">—</option>}
                {cuentas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.abrev} · {c.nombre_perfil}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="campo">
            <span className="campo-label">LinkedIn</span>
            <input
              value={a.linkedin ?? ''}
              onChange={set('linkedin')}
              onBlur={() => void buscarParecidos()}
              placeholder="https://www.linkedin.com/in/…"
            />
          </label>

          <div className="alta-fila">
            <label className="campo alta-ancho">
              <span className="campo-label">Teléfono</span>
              <input
                value={a.telefono ?? ''}
                onChange={set('telefono')}
                onBlur={() => void buscarParecidos()}
                placeholder="Con o sin código de país"
              />
            </label>
            <label className="campo alta-ancho">
              <span className="campo-label">Email</span>
              <input value={a.email ?? ''} onChange={set('email')} />
            </label>
          </div>

          <div className="alta-fila">
            <label className="campo alta-ancho">
              <span className="campo-label">Cargo</span>
              <input value={a.cargo ?? ''} onChange={set('cargo')} />
            </label>
            <label className="campo alta-ancho">
              <span className="campo-label">Empresa</span>
              <input
                value={a.empresa ?? ''}
                onChange={set('empresa')}
                onBlur={() => void buscarParecidos()}
              />
            </label>
          </div>

          <div className="alta-fila">
            <label className="campo alta-ancho">
              <span className="campo-label">Industria</span>
              <input value={a.industria ?? ''} onChange={set('industria')} />
            </label>
            <label className="campo alta-ancho">
              <span className="campo-label">País</span>
              <input value={a.pais ?? ''} onChange={set('pais')} placeholder="Brasil, Argentina…" />
            </label>
            <label className="campo alta-ancho">
              <span className="campo-label">Ciudad</span>
              <input value={a.ciudad ?? ''} onChange={set('ciudad')} />
            </label>
          </div>

          <div className="alta-fila">
            <label className="campo alta-corto">
              <span className="campo-label">Próximo contacto</span>
              <input
                type="date"
                value={a.proximo_contacto ?? ''}
                onChange={set('proximo_contacto')}
              />
            </label>
            {/* El país decide el idioma del mensaje (§5.6). Se muestra acá
                porque es lo que va a pasar cuando se le escriba, y sin país no
                hay forma de darse cuenta de que va a salir en inglés. */}
            <div className="campo alta-corto">
              <span className="campo-label">Le escribimos en</span>
              <span className="alta-derivado">
                {plan.idioma}
                {!a.pais && <span className="campo-ayuda"> · falta el país</span>}
              </span>
            </div>
          </div>

          <label className="campo">
            <span className="campo-label">Nota</span>
            <textarea
              rows={2}
              value={a.nota ?? ''}
              onChange={set('nota')}
              placeholder="De dónde salió, quién lo recomendó…"
            />
          </label>

          {/* Lo que ya está en la base y se parece. No bloquea: avisa. */}
          {yaEsta.accion !== 'nuevo' && (
            <div
              className={
                yaEsta.accion === 'mismo' ? 'alta-aviso alta-aviso-fuerte' : 'alta-aviso'
              }
            >
              <span>
                {yaEsta.accion === 'mismo'
                  ? 'Esta persona ya está cargada. Se le completa la ficha y se le agrega el lead de esta cuenta, sin duplicarla.'
                  : 'Hay alguien parecido en la base. Se carga igual, marcado como posible duplicado para revisar en Duplicados.'}
              </span>
              <div className="alta-parecidos">
                {parecidos.map((p) => (
                  <span key={p.id} className="alta-parecido">
                    <b>{p.nombre}</b>
                    {p.empresa ? ' · ' + p.empresa : ''}
                    {p.telefono ? ' · ' + p.telefono : ''}
                  </span>
                ))}
              </div>
            </div>
          )}

          {plan.avisos.map((av) => (
            <span key={av} className="campo-ayuda">
              {av}
            </span>
          ))}

          {intento && problemas.length > 0 && (
            <div className="imp-error">{problemas.map((p) => p.motivo).join(' ')}</div>
          )}
          {error && <div className="imp-error">{error}</div>}
        </div>

        <div className="overlay-pie">
          <span className="campo-ayuda">
            {buscando ? 'Buscando si ya está…' : 'Entra en R0, en curso.'}
          </span>
          <button type="button" className="boton-secundario al-final" onClick={onCerrar}>
            Cancelar
          </button>
          <button
            type="button"
            className="boton-principal"
            disabled={guardando}
            onClick={() => void guardar()}
          >
            {guardando ? 'Guardando…' : 'Crear lead'}
          </button>
        </div>
      </div>
    </div>
  );
}
