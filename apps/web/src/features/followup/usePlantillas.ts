import { useEffect, useState } from 'react';
import { pb } from '../../lib/pocketbase';
import type { PlantillaRecord, UsuarioRecord } from '../../lib/types';

/**
 * El repositorio de mensajes. Es el único lugar de verdad de los textos (§5.2).
 *
 * Depende del usuario a propósito: las colecciones exigen sesión, así que si
 * esto se dispara antes del login la API devuelve vacío y nunca se entera de
 * que después hubo sesión. Pasando el usuario, se recarga al entrar.
 */
export function usePlantillas(usuario: UsuarioRecord | null) {
  const [plantillas, setPlantillas] = useState<PlantillaRecord[]>([]);

  useEffect(() => {
    if (!usuario) {
      setPlantillas([]);
      return;
    }
    let vivo = true;
    pb.collection('plantilla')
      .getFullList<PlantillaRecord>({ sort: 'orden' })
      .then((r) => vivo && setPlantillas(r))
      .catch(() => vivo && setPlantillas([]));
    return () => {
      vivo = false;
    };
  }, [usuario]);

  return plantillas;
}
