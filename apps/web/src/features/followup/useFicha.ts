import { useCallback, useEffect, useState } from 'react';

/**
 * La pila de deshacer de la ficha, portada del prototipo
 * (`docs/prototipo/FollowupDetalle.dc.html`, métodos `aplicar` / `deshacer`).
 *
 * §9.2: toda edición apila su estado anterior; el botón Deshacer saca el último
 * cambio; guardar limpia la pila. Cada entrada lleva una etiqueta legible, que
 * es lo que el botón muestra ("Deshacer: Próximo contacto").
 */
export interface EntradaPila<T> {
  antes: Partial<T>;
  etiqueta: string;
}

export interface Ficha<T extends object> {
  /** Los valores actuales: lo original con los cambios encima. */
  valores: T;
  /** Aplica un cambio y lo apila. `etiqueta` describe qué se tocó. */
  aplicar: (patch: Partial<T>, etiqueta: string) => void;
  deshacer: () => void;
  /** Limpia todo: es lo que hace guardar (§9.2). */
  limpiar: () => void;
  sucio: boolean;
  /** Para el título del botón: "Deshacer: Empresa". */
  ultimaEtiqueta: string | null;
  hayDeshacer: boolean;
}

/**
 * `original` son los datos que vienen de la base. Los cambios viven aparte,
 * encima, hasta que se guardan — así los campos se ven en vivo mientras se
 * editan (§7.2) sin pisar el registro todavía.
 */
export function useFicha<T extends object>(original: T, claveReset: string): Ficha<T> {
  const [cambios, setCambios] = useState<Partial<T>>({});
  const [pila, setPila] = useState<EntradaPila<T>[]>([]);

  // Cambiar de lead resetea todo, como el componentDidUpdate del prototipo.
  useEffect(() => {
    setCambios({});
    setPila([]);
  }, [claveReset]);

  const valores = { ...original, ...cambios } as T;

  const aplicar = useCallback((patch: Partial<T>, etiqueta: string) => {
    setCambios((c) => {
      // Lo que se apila es el valor que había ANTES de este cambio, que puede
      // ser uno anterior sin guardar o el de la base.
      const antes: Partial<T> = {};
      for (const k of Object.keys(patch) as (keyof T)[]) {
        antes[k] = k in c ? c[k] : original[k];
      }
      setPila((p) => [...p, { antes, etiqueta }]);
      return { ...c, ...patch };
    });
  }, [original]);

  const deshacer = useCallback(() => {
    setPila((p) => {
      if (p.length === 0) return p;
      const ultima = p[p.length - 1]!;
      setCambios((c) => ({ ...c, ...ultima.antes }));
      return p.slice(0, -1);
    });
  }, []);

  const limpiar = useCallback(() => {
    setCambios({});
    setPila([]);
  }, []);

  return {
    valores,
    aplicar,
    deshacer,
    limpiar,
    sucio: pila.length > 0,
    hayDeshacer: pila.length > 0,
    ultimaEtiqueta: pila.length > 0 ? pila[pila.length - 1]!.etiqueta : null,
  };
}
