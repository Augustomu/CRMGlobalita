import { useMemo, useRef, useState } from 'react';
import { leer, marcarDuplicados, type FilaImportable, type LecturaCsv } from '@crm/core/csv';
import { normalizarTelefono } from '@crm/core/telefono';
import { pb } from '../../lib/pocketbase';
import type { LeadRecord } from '../../lib/types';

interface Props {
  leads: LeadRecord[];
  /** La cuenta bajo la que entran los leads importados. */
  cuenta: string;
  onCerrar: () => void;
  onImportado: () => void;
}

type Paso = 1 | 2 | 3;

/**
 * Importar leads desde CSV (§7.6). Portada de `docs/prototipo/ImportarCsv.dc.html`.
 *
 * Tres pasos, y el del medio no es un trámite: es donde se ve qué va a pasar
 * ANTES de que pase. Importar 900 filas sin mirar es cómo se llena una base de
 * duplicados que después cuesta semanas limpiar.
 */
export function ImportarCsv({ leads, cuenta, onCerrar, onImportado }: Props) {
  const [paso, setPaso] = useState<Paso>(1);
  const [lectura, setLectura] = useState<LecturaCsv | null>(null);
  const [filas, setFilas] = useState<FilaImportable[]>([]);
  const [fuera, setFuera] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState('');
  const [resultado, setResultado] = useState<{ nuevos: number; fusionados: number } | null>(null);
  const [importando, setImportando] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const telefonos = useMemo(
    () => leads.map((l) => l.expand?.perfil?.telefono ?? '').filter(Boolean),
    [leads],
  );

  function procesar(texto: string) {
    const r = leer(texto);
    if (!r.filas.length) {
      setError(
        r.descartadas > 0
          ? `Se leyeron ${r.descartadas} filas pero ninguna tiene nombre y teléfono a la vez.`
          : 'No se pudo leer el archivo: verificá que tenga columnas nombre y telefono.',
      );
      return;
    }
    setLectura(r);
    setFilas(marcarDuplicados(r.filas, telefonos));
    setFuera(new Set());
    setError(null);
    setPaso(2);
  }

  function elegirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setNombreArchivo(f.name);
    const lector = new FileReader();
    lector.onload = (ev) => procesar(String(ev.target?.result ?? ''));
    lector.onerror = () => setError('No se pudo abrir el archivo.');
    // UTF-8 explícito: sin esto el navegador adivina y los acentos de un
    // archivo exportado de Excel salen rotos.
    lector.readAsText(f, 'utf-8');
  }

  const elegidas = filas.filter((f) => !fuera.has(f.id));

  async function importar() {
    setImportando(true);
    let nuevos = 0;
    let fusionados = 0;
    try {
      for (const f of elegidas) {
        const tel = normalizarTelefono(f.telefono, f.pais);
        const datos = {
          nombre: f.nombre,
          cargo: f.cargo,
          empresa: f.empresa,
          ciudad: f.ciudad,
          pais: f.pais,
          email: f.email,
          link_perfil: f.link_perfil,
          telefono: tel.valor,
          telefono_raw: f.telefono,
          telefono_valido: tel.valido,
        };

        if (f.duplicado) {
          // Fusionar es COMPLETAR, no pisar: el archivo suele traer el cargo o
          // la ciudad que faltaban, pero lo que ya está en la ficha lo puso
          // alguien a mano y vale más que una columna de un CSV.
          const existente = leads.find(
            (l) => (l.expand?.perfil?.telefono ?? '').slice(-8) === tel.valor.slice(-8),
          );
          if (existente?.perfil) {
            const p = existente.expand?.perfil ?? {};
            const completar: Record<string, string> = {};
            for (const [k, v] of Object.entries(datos)) {
              if (typeof v === 'string' && v && !(p as Record<string, unknown>)[k]) completar[k] = v;
            }
            if (Object.keys(completar).length) {
              await pb.collection('perfil').update(existente.perfil, completar);
            }
            fusionados++;
            continue;
          }
        }

        const perfil = await pb.collection('perfil').create(datos);
        await pb.collection('lead').create({
          perfil: perfil.id,
          cuenta,
          etapa: 'R0',
          situacion: 'en_curso',
          lista: nombreArchivo || 'Importado de CSV',
          // §7.6: entran en «Sin leer» para que se vean como novedad y no se
          // mezclen con los que alguien ya trabajó.
          sin_leer_li: true,
        });
        nuevos++;
      }
      setResultado({ nuevos, fusionados });
      setPaso(3);
      onImportado();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setImportando(false);
    }
  }

  return (
    <div className="overlay-fondo" onClick={onCerrar}>
      <div className="overlay-caja imp" onClick={(e) => e.stopPropagation()}>
        <div className="overlay-header">
          <span className="overlay-titulo">Importar leads desde CSV</span>
          <button type="button" className="boton-icono-28 al-final" title="Cerrar" onClick={onCerrar}>
            ×
          </button>
        </div>

        <div className="overlay-cuerpo imp-cuerpo">
          {paso === 1 && (
            <>
              <span className="imp-ayuda">
                Subí un CSV con una fila por lead. Columnas esperadas:{' '}
                <b>nombre, telefono, empresa, cargo, ciudad, pais, email</b>. Solo{' '}
                <b>nombre</b> y <b>telefono</b> son obligatorias.
              </span>
              <label className="imp-zona">
                <span className="imp-icono">↑</span>
                <span>Hacé clic para elegir el archivo</span>
                <input ref={input} type="file" accept=".csv,text/csv" onChange={elegirArchivo} hidden />
              </label>
              {error && <div className="imp-error">{error}</div>}
              <span className="campo-ayuda">
                Se aceptan archivos separados por coma, punto y coma o tabulación, con o sin
                comillas — que es lo que exporta Excel.
              </span>
            </>
          )}

          {paso === 2 && lectura && (
            <>
              <div className="imp-resumen">
                <span>{filas.length} leads leídos del archivo</span>
                <span className="imp-pill imp-pill-nuevo al-final">
                  {filas.length - filas.filter((f) => f.duplicado).length} nuevos
                </span>
                {filas.some((f) => f.duplicado) && (
                  <span className="imp-pill imp-pill-dup">
                    {filas.filter((f) => f.duplicado).length} ya están en la base (se completan)
                  </span>
                )}
              </div>

              {(lectura.descartadas > 0 || lectura.columnasIgnoradas.length > 0) && (
                <div className="imp-avisos">
                  {lectura.descartadas > 0 && (
                    <span>
                      {lectura.descartadas}{' '}
                      {lectura.descartadas === 1 ? 'fila quedó afuera' : 'filas quedaron afuera'} por
                      no tener nombre y teléfono.
                    </span>
                  )}
                  {lectura.columnasIgnoradas.length > 0 && (
                    <span>
                      Columnas que no se usan: {lectura.columnasIgnoradas.join(', ')}.
                    </span>
                  )}
                </div>
              )}

              <div className="imp-lista">
                {filas.map((f) => {
                  const dentro = !fuera.has(f.id);
                  return (
                    <div key={f.id} className={`imp-fila ${dentro ? '' : 'imp-fila-fuera'}`}>
                      <button
                        type="button"
                        className={`imp-check ${dentro ? 'imp-check-on' : ''}`}
                        title={dentro ? 'No importar este lead' : 'Importar este lead'}
                        onClick={() =>
                          setFuera((s) => {
                            const n = new Set(s);
                            if (n.has(f.id)) n.delete(f.id);
                            else n.add(f.id);
                            return n;
                          })
                        }
                      >
                        {dentro ? '✓' : ''}
                      </button>
                      <div className="imp-quien">
                        <span className="imp-nombre">{f.nombre}</span>
                        <span className="campo-ayuda">{f.empresa || '—'}</span>
                      </div>
                      <span className="imp-tel tabular">{f.telefono}</span>
                      <span className={f.duplicado ? 'imp-dup' : 'imp-nuevo'}>
                        {f.duplicado ? 'ya existe' : 'nuevo'}
                      </span>
                    </div>
                  );
                })}
              </div>

              {error && <div className="imp-error">{error}</div>}

              <div className="imp-acciones">
                <button type="button" className="boton-secundario" onClick={() => setPaso(1)}>
                  Elegir otro archivo
                </button>
                <button
                  type="button"
                  className="boton-principal al-final"
                  disabled={!elegidas.length || importando}
                  onClick={() => void importar()}
                >
                  {importando
                    ? 'Importando…'
                    : `Importar ${elegidas.length} ${elegidas.length === 1 ? 'lead' : 'leads'}`}
                </button>
              </div>
            </>
          )}

          {paso === 3 && resultado && (
            <div className="imp-fin">
              <span className="imp-tilde">✓</span>
              <span className="imp-fin-titulo">Importación completa</span>
              <span className="imp-fin-detalle">
                {resultado.nuevos} {resultado.nuevos === 1 ? 'lead nuevo cargado' : 'leads nuevos cargados'}
                {resultado.fusionados > 0 &&
                  ` · ${resultado.fusionados} ${resultado.fusionados === 1 ? 'ficha existente se completó' : 'fichas existentes se completaron'}`}
                {' '}en Follow-up, los nuevos en Sin leer.
              </span>
              <button type="button" className="boton-principal" onClick={onCerrar}>
                Ir a Follow-up
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
