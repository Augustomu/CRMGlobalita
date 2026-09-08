import { useCallback, useEffect, useState } from 'react';
import { pb } from '../../lib/pocketbase';
import type { PlantillaRecord, UsuarioRecord } from '../../lib/types';

/**
 * El repositorio de mensajes. Es el único lugar de verdad de los textos (§5.2).
 *
 * Depende del usuario a propósito: las colecciones exigen sesión, así que si
 * esto se dispara antes del login la API devuelve vacío y nunca se entera de
 * que después hubo sesión. Pasando el usuario, se recarga al entrar.
 *
 * Devuelve `recargar` porque los textos se editan desde TRES lugares —el
 * Repositorio, la ficha al destacar, y la ficha al guardar un texto nuevo— y
 * §7.9 pide que el cambio se vea al instante en todos. Sin esto, destacar un
 * mensaje desde la ficha no hacía aparecer el chip hasta recargar la página.
 */
export function usePlantillas(usuario: UsuarioRecord | null) {
  const [plantillas, setPlantillas] = useState<PlantillaRecord[]>([]);

  const recargar = useCallback(async () => {
    if (!usuario) {
      setPlantillas([]);
      return;
    }
    try {
      const r = await pb.collection('plantilla').getFullList<PlantillaRecord>({ sort: 'orden' });
      setPlantillas(r);
    } catch {
      setPlantillas([]);
    }
  }, [usuario]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  return { plantillas, recargar };
}
