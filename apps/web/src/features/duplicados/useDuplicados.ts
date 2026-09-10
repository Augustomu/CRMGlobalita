import { useCallback, useEffect, useState } from 'react';
import type { LeadDelPerfil } from '@crm/core/fusion';
import {
  avisoDeDeteccion,
  DATOS_QUE_CONFIRMAN,
  type AvisoDeteccion,
} from '@crm/core/dedupe';
import { pb } from '../../lib/pocketbase';
import type { PerfilRecord, UsuarioRecord } from '../../lib/types';

/** Los perfiles marcados y sin fusionar: es lo único que la bandeja muestra. */
const FILTRO_MARCADOS =
  'posible_duplicado_de != null && posible_duplicado_de != "[]" && fusionado_en = ""';

/**
 * El filtro de los que el detector NO puede ver, armado con la MISMA lista de
 * campos que usa `sinConQueConfirmar()`.
 *
 * Se genera y no se escribe a mano para que no haya dos definiciones de «con
 * qué se confirma un perfil»: agregar un cuarto dato en `core` y olvidarse de
 * este filtro es la familia 7 del registro.
 */
const FILTRO_INVISIBLES =
  `fusionado_en = "" && ` + DATOS_QUE_CONFIRMAN.map((c) => `${c} = ""`).join(' && ');

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
  /**
   * Qué está mostrando la bandeja, y qué no puede mostrar.
   *
   * Sin esto, «0 duplicados» se lee como «está todo limpio» y no es lo que
   * dice: es que nadie marcó ninguno.
   */
  const [aviso, setAviso] = useState<AvisoDeteccion | null>(null);

  const recargar = useCallback(async () => {
    if (!usuario) {
      setGrupos([]);
      setAviso(null);
      setCargando(false);
      return;
    }
    try {
      // Ojo con el filtro: sobre un campo JSON, `:length` mide el largo del
      // TEXTO, no del array, asi que "[]" cuenta como 2 y devolvia tambien los
      // perfiles ya resueltos — 354 en vez de 149.
      const marcados = await pb.collection('perfil').getFullList<PerfilMarcado>({
        filter: FILTRO_MARCADOS,
        sort: 'created',
      });

      /*
       * Los dos números del aviso los cuenta el SERVIDOR.
       *
       * Se piden con `getList(1, 1)` y se lee `totalItems`: así no viaja ni un
       * teléfono al navegador para contar cuántos hay. Traerse los 410 perfiles
       * para contarlos acá sería pasarle datos de contacto a un usuario que
       * quizá no tiene el permiso de verlos (§6.2).
       */
      // El aviso es secundario: si estas dos cuentas fallan, la bandeja
      // igual tiene que mostrar los grupos. Por eso van con su propio catch y
      // no adentro del try grande.
      const cuantos = (filtro: string) =>
        pb
          .collection('perfil')
          .getList(1, 1, { filter: filtro, fields: 'id' })
          .then((r) => r.totalItems)
          .catch(() => null);

      const [vivos, invisibles] = await Promise.all([
        cuantos('fusionado_en = ""'),
        cuantos(FILTRO_INVISIBLES),
      ]);
      setAviso(
        vivos === null || invisibles === null
          ? null
          : avisoDeDeteccion({
              vivos,
              marcados: marcados.length,
              invisibles,
              // No hay columna de «cuándo se marcó», así que se usa el `updated`
              // del perfil, que es un techo. El texto lo dice: «hasta el».
              ultima_marca: marcados.reduce((m, p) => (p.updated > m ? p.updated : m), ''),
            }),
      );

      const armados = agruparPorConexion(marcados);

      // Los leads de los perfiles en juego: son los que se mueven al fusionar y
      // los que pueden chocar.
      //
      // En tandas de a 40. Con 150 perfiles marcados el filtro de un solo tiro
      // se pasaba de largo y PocketBase respondía 400, así que la bandeja se
      // quedaba vacía justo cuando más duplicados había.
      const ids = armados.flatMap((g) => g.map((p) => p.id));
      const leads: unknown[] = [];
      for (let i = 0; i < ids.length; i += 40) {
        const tanda = ids.slice(i, i + 40);
        const r = await pb.collection('lead').getFullList({
          filter: tanda.map((id) => `perfil = "${id}"`).join(' || '),
          expand: 'cuenta',
          fields: 'id,perfil,cuenta,email,expand.cuenta.abrev',
        });
        leads.push(...r);
      }

      const porPerfil = new Map<string, LeadDelPerfil[]>();
      for (const l of leads as unknown as Array<{
        id: string;
        perfil: string;
        cuenta: string;
        email?: string;
        expand?: { cuenta?: { abrev?: string } };
      }>) {
        const item: LeadDelPerfil = {
          id: l.id,
          perfil: l.perfil,
          cuenta: l.cuenta,
          cuenta_abrev: l.expand?.cuenta?.abrev,
          email: l.email,
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

  return { grupos, cargando, error, aviso, recargar };
}
