import { useCallback, useEffect, useMemo, useState } from 'react';
import { pb } from '../../lib/pocketbase';
import type { UsuarioRecord } from '../../lib/types';

type Tipo = 'sesion' | 'envio' | 'edicion' | 'reunion' | 'permiso';

interface ActividadRecord {
  id: string;
  usuario: string;
  tipo: Tipo;
  accion: string;
  lead: string;
  canal?: 'linkedin' | 'whatsapp';
  created: string;
  expand?: {
    usuario?: { name?: string; rol?: string };
    lead?: { expand?: { perfil?: { nombre?: string } } };
  };
}

const ICONO: Record<Tipo, string> = {
  sesion: '→',
  envio: '✈',
  edicion: '✎',
  reunion: '📅',
  permiso: '🔑',
};

const NOMBRE_TIPO: Record<Tipo, string> = {
  sesion: 'Sesión',
  envio: 'Envío',
  edicion: 'Edición',
  reunion: 'Reunión',
  permiso: 'Permisos',
};

/** «hoy 09:12» / «03/09 17:20». Hoy se nombra; el resto lleva fecha. */
function cuando(iso: string, hoy: string): string {
  const f = String(iso ?? '');
  const dia = f.slice(0, 10);
  const hora = f.length >= 16 ? f.slice(11, 16) : '';
  if (!dia) return '';
  if (dia === hoy) return `hoy ${hora}`;
  return `${dia.slice(8, 10)}/${dia.slice(5, 7)} ${hora}`;
}

interface Props {
  usuarios: UsuarioRecord[];
}

/**
 * Actividad (§7.8). Portada de `docs/prototipo/AdminUsuarios.dc.html`.
 *
 * Quién hizo qué y cuándo. No es un log técnico: es la respuesta a «¿quién le
 * cambió el teléfono a este lead?» y a «¿esta persona está trabajando?», que
 * son las dos preguntas que un administrador hace de verdad.
 */
export function Actividad({ usuarios }: Props) {
  const [filas, setFilas] = useState<ActividadRecord[]>([]);
  const [quien, setQuien] = useState('todos');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const hoy = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const recargar = useCallback(async () => {
    try {
      const r = await pb.collection('actividad').getList<ActividadRecord>(1, 200, {
        expand: 'usuario,lead.perfil',
        sort: '-created',
      });
      setFilas(r.items);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const vistas = quien === 'todos' ? filas : filas.filter((f) => f.usuario === quien);

  return (
    <div className="act">
      <div className="act-filtros">
        <span className="auto-th">Ver</span>
        <button
          type="button"
          className={`chip ${quien === 'todos' ? 'chip-on' : ''}`}
          onClick={() => setQuien('todos')}
        >
          Todos
        </button>
        {usuarios.map((u) => (
          <button
            key={u.id}
            type="button"
            className={`chip ${quien === u.id ? 'chip-on' : ''}`}
            onClick={() => setQuien(u.id)}
          >
            {u.name.split(' ')[0]}
          </button>
        ))}
        <span className="campo-ayuda tabular al-final">{vistas.length} movimientos</span>
      </div>

      {error && <div className="aviso-error">{error}</div>}
      {cargando && <p className="campo-ayuda">Leyendo la actividad…</p>}

      {!cargando && !vistas.length && (
        <p className="vacio">
          Todavía no hay actividad registrada. Se llena sola a medida que el equipo trabaja.
        </p>
      )}

      {vistas.map((a) => (
        <div key={a.id} className="act-fila">
          <span className="act-icono" title={NOMBRE_TIPO[a.tipo] ?? a.tipo}>
            {ICONO[a.tipo] ?? '•'}
          </span>
          <span className="act-cuando tabular">{cuando(a.created, hoy)}</span>
          <span className="act-quien">
            {a.expand?.usuario?.name ?? 'Usuario dado de baja'}
          </span>
          <span className="act-accion">{a.accion}</span>
          <span className="act-sobre">{a.expand?.lead?.expand?.perfil?.nombre ?? '—'}</span>
          {a.canal ? (
            <span className={a.canal === 'whatsapp' ? 'act-canal act-canal-wa' : 'act-canal act-canal-li'}>
              {a.canal === 'whatsapp' ? 'WA' : 'LI'}
            </span>
          ) : (
            <span />
          )}
        </div>
      ))}
    </div>
  );
}
