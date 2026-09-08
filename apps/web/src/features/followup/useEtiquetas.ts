import { useCallback, useEffect, useState } from 'react';
import { pb } from '../../lib/pocketbase';
import type { EtiquetaRecord, UsuarioRecord } from '../../lib/types';

/**
 * El catálogo de etiquetas (§3.9). Igual que las plantillas, espera al login.
 *
 * Devuelve también `recargar` porque aplicar una etiqueta le cambia la fecha de
 * uso, y de esa fecha salen las seis que se ofrecen en la ficha: sin releer, la
 * fila de atajos se queda con el orden de cuando entraste.
 */
export function useEtiquetas(usuario: UsuarioRecord | null) {
  const [etiquetas, setEtiquetas] = useState<EtiquetaRecord[]>([]);

  const recargar = useCallback(() => {
    if (!usuario) {
      setEtiquetas([]);
      return;
    }
    pb.collection('etiqueta')
      .getFullList<EtiquetaRecord>({ sort: 'nombre' })
      .then(setEtiquetas)
      .catch(() => setEtiquetas([]));
  }, [usuario]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  return { etiquetas, recargar };
}
