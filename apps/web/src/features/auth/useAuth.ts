import { useEffect, useState } from 'react';
import { pb } from '../../lib/pocketbase';
import type { UsuarioRecord } from '../../lib/types';

export interface EstadoAuth {
  usuario: UsuarioRecord | null;
  cargando: boolean;
  entrar: (email: string, password: string) => Promise<void>;
  salir: () => void;
  error: string | null;
}

/**
 * Sesión real contra PocketBase (§6.6). Las colecciones exigen usuario
 * autenticado (ver `reglas` en la migración), así que sin esto no se puede
 * leer ni un lead: no es una pantalla decorativa, es lo que habilita todo
 * lo demás.
 */
export function useAuth(): EstadoAuth {
  const [usuario, setUsuario] = useState<UsuarioRecord | null>(
    (pb.authStore.record as unknown as UsuarioRecord) ?? null,
  );
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return pb.authStore.onChange(() => {
      setUsuario((pb.authStore.record as unknown as UsuarioRecord) ?? null);
    });
  }, []);

  /**
   * Comprobar contra el SERVIDOR que la sesión guardada todavía vale.
   *
   * `authStore.isValid` sólo mira que el token no esté vencido, y eso no
   * alcanza: un token puede estar perfecto y apuntar a un usuario que ya no
   * existe —la base se recreó, al usuario lo borraron, le revocaron el
   * acceso—. Ahí el servidor contesta 401 a todo y la pantalla quedaba
   * MOSTRANDO EL CRM VACÍO, con el cartel «Ningún lead con esos filtros»
   * echándole la culpa a los filtros.
   *
   * Una sesión que no sirve tiene que llevar al login, no a un CRM sin datos:
   * lo segundo parece que se perdió todo.
   */
  useEffect(() => {
    if (!pb.authStore.isValid) return;
    let vivo = true;
    setCargando(true);
    pb.collection('users')
      .authRefresh()
      .catch(() => {
        if (vivo) pb.authStore.clear();
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, []);

  async function entrar(email: string, password: string) {
    setCargando(true);
    setError(null);
    try {
      await pb.collection('users').authWithPassword(email, password);
    } catch {
      // No se distingue "no existe" de "clave mala": es una decisión de
      // seguridad estándar, no un detalle que falte resolver.
      setError('Email o contraseña incorrectos.');
    } finally {
      setCargando(false);
    }
  }

  function salir() {
    pb.authStore.clear();
  }

  return { usuario, cargando, entrar, salir, error };
}
