import { useEffect, useState } from 'react';
import { pb } from '../../lib/pocketbase';
import type { EtiquetaRecord, UsuarioRecord } from '../../lib/types';

/** El catálogo de etiquetas (§3.9). Igual que las plantillas, espera al login. */
export function useEtiquetas(usuario: UsuarioRecord | null) {
  const [etiquetas, setEtiquetas] = useState<EtiquetaRecord[]>([]);

  useEffect(() => {
    if (!usuario) {
      setEtiquetas([]);
      return;
    }
    let vivo = true;
    pb.collection('etiqueta')
      .getFullList<EtiquetaRecord>({ sort: 'nombre' })
      .then((r) => vivo && setEtiquetas(r))
      .catch(() => vivo && setEtiquetas([]));
    return () => {
      vivo = false;
    };
  }, [usuario]);

  return etiquetas;
}
