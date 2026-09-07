import { useEffect, useState } from 'react';
import { pb } from '../../lib/pocketbase';
import type { PlantillaRecord } from '../../lib/types';

/**
 * El repositorio de mensajes. Es el único lugar de verdad de los textos (§5.2),
 * así que se carga una vez y lo comparten todas las fichas.
 */
export function usePlantillas() {
  const [plantillas, setPlantillas] = useState<PlantillaRecord[]>([]);

  useEffect(() => {
    let vivo = true;
    pb.collection('plantilla')
      .getFullList<PlantillaRecord>({ sort: 'orden' })
      .then((r) => {
        if (vivo) setPlantillas(r);
      })
      .catch(() => {
        if (vivo) setPlantillas([]);
      });
    return () => {
      vivo = false;
    };
  }, []);

  return plantillas;
}
