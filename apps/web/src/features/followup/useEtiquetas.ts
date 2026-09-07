import { useEffect, useState } from 'react';
import { pb } from '../../lib/pocketbase';
import type { EtiquetaRecord } from '../../lib/types';

/** El catálogo de etiquetas (§3.9). Se carga una vez y lo comparten las fichas. */
export function useEtiquetas() {
  const [etiquetas, setEtiquetas] = useState<EtiquetaRecord[]>([]);

  useEffect(() => {
    let vivo = true;
    pb.collection('etiqueta')
      .getFullList<EtiquetaRecord>({ sort: 'nombre' })
      .then((r) => vivo && setEtiquetas(r))
      .catch(() => vivo && setEtiquetas([]));
    return () => {
      vivo = false;
    };
  }, []);

  return etiquetas;
}
