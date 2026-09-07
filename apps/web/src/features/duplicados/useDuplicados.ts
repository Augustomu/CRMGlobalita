import { useCallback, useEffect, useState } from 'react';
import type { LeadDelPerfil } from '@crm/core/fusion';
import { pb } from '../../lib/pocketbase';
import type { PerfilRecord, UsuarioRecord } from '../../lib/types';

/** Un perfil marcado, con lo que el detector anotó. */
export interface PerfilMarcado extends PerfilRecord {
  posible_duplicado_de: string[] | null;
  distinto_de: string[] | null;
  fusionado_en: string;
}

export interface GrupoDuplicado {
  /** Estable entre recargas: el id del perfil más viejo del grupo. */
  id: string;
  perfiles: PerfilMarcado[];
  leads: LeadDelPerfil[];
}

/**
 * Arma los grupos a partir de las marcas del detector.
 *
 * El detector deja en cada perfil los ids de sus posibles gemelos, así que el
 * grupo es la componente conexa de ese grafo: si A apunta a B y B a C, los tres
 * se miran juntos. Separarlos en pares haría que la misma persona apareciera
 * tres veces en la bandeja.
 */
function agruparPorConexion(perfiles: PerfilMarcado[]): PerfilMarcado[][] {
  const vivos = new Map(perfiles.map((p) => [p.id, p]));
  const visto = new Set<string>();
  const grupos: PerfilMarcado[][] = [];

  for (const p of perfiles) {
    if (visto.has(p.id)) continue;

    const grupo: PerfilMarcado[] = [];
    const pila = [p.id];
    while (pila.length) {
      const id = pila.pop()!;
      if (visto.has(id)) continue;
      visto.add(id);
      const actual = vivos.get(id);
      if (!actual) continue;
      grupo.push(actual);
      for (const otro of actual.posible_duplicado_de ?? []) {
        if (!visto.has(otro) && vivos.has(otro)) pila.push(otro);
      }
    }

    // Un grupo de uno queda cuando su único gemelo ya se resolvió. No es un
    // duplicado: no tiene con qué compararse.
    if (grupo.length > 1) {
      grupo.sort((a, b) => a.created.localeCompare(b.created));
      grupos.push(grupo);
    }
  }

  return grupos.sort((a, b) => a[0]!.created.localeCompare(b[0]!.created));
}

/**
 * Los duplicados pendientes de resolver (D02). Solo lee: quién se fusiona con
 * quién lo decide una persona en la bandeja.
 */
export function useDuplicados(usuario: UsuarioRecord | null) {
  const [grupos, setGrupos] = useState<GrupoDuplicado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    if (!usuario) {
      setGrupos([]);
      setCargando(false);
      return;
    }
    try {
      // `:length` filtra del lado del servidor: la bandeja no tiene por qué
      // bajarse la base entera para encontrar los pocos marcados.
      const marcados = await pb.collection('perfil').getFullList<PerfilMarcado>({
        filter: 'posible_duplicado_de:length > 0 && fusionado_en = ""',
        sort: 'created',
      });

      const armados = agruparPorConexion(marcados);

      // Los leads de todos los perfiles en juego, de una sola vez: son los que
      // se mueven al fusionar y los que pueden chocar.
      const ids = armados.flatMap((g) => g.map((p) => p.id));
      const leads = ids.length
        ? await pb.collection('lead').getFullList({
            filter: ids.map((id) => `perfil = "${id}"`).join(' || '),
            expand: 'cuenta',
            fields: 'id,perfil,cuenta,expand.cuenta.abrev',
          })
        : [];

      const porPerfil = new Map<string, LeadDelPerfil[]>();
      for (const l of leads as unknown as Array<{
        id: string;
        perfil: string;
        cuenta: string;
        expand?: { cuenta?: { abrev?: string } };
      }>) {
        const item: LeadDelPerfil = {
          id: l.id,
          perfil: l.perfil,
          cuenta: l.cuenta,
          cuenta_abrev: l.expand?.cuenta?.abrev,
        };
        porPerfil.set(l.perfil, [...(porPerfil.get(l.perfil) ?? []), item]);
      }

      setGrupos(
        armados.map((perfiles) => ({
          id: perfiles[0]!.id,
          perfiles,
          leads: perfiles.flatMap((p) => porPerfil.get(p.id) ?? []),
        })),
      );
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCargando(false);
    }
  }, [usuario]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  return { grupos, cargando, error, recargar };
}
