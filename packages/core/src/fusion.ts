// Fusión de perfiles duplicados. Implementa la parte de D02 que dice que la
// fusión la aprueba una persona, nunca el sistema.
//
// El detector propone; esto calcula qué quedaría; la persona confirma.

export interface PerfilFusionable {
  id: string;
  created: string;
  slug: string;
  urn: string;
  huella: string;
  nombre: string;
  cargo: string;
  empresa: string;
  web: string;
  industria: string;
  pais: string;
  ciudad: string;
  resumen: string;
  telefono: string;
  telefono_raw: string;
  telefono_valido: boolean;
  no_contactar: boolean;
}

/** Los campos que se combinan al fusionar. */
const CAMPOS = [
  'slug', 'urn', 'nombre', 'cargo', 'empresa', 'web',
  'industria', 'pais', 'ciudad', 'resumen', 'telefono', 'telefono_raw',
] as const;

/** Palabras de un nombre, comparables: sin acentos, sin puntuación, sin orden. */
function palabras(nombre: string): string[] {
  return nombre
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Entre dos nombres de la misma persona, el que dice más.
 *
 * El Calendar guarda solo el primer nombre — el título del evento es
 * "Marcelo / Francisco / Augusto" — mientras el CSV trae "Marcelo Carneiro".
 * Con la regla de antigüedad a secas, fusionar PERDERÍA el apellido, que es
 * justamente el dato que había que recuperar.
 *
 * Solo se prefiere el largo cuando contiene entero al corto: "Marcelo" ->
 * "Marcelo Carneiro" sí; "Thiago Gomes" vs "Tiago Gomes" no, porque ahí ninguno
 * amplía al otro y la diferencia la tiene que mirar una persona.
 */
function nombreMasCompleto(valores: string[]): string | null {
  let mejor = valores[0]!;
  for (const v of valores.slice(1)) {
    const a = palabras(mejor);
    const b = palabras(v);
    const largo = a.length >= b.length ? a : b;
    const corto = a.length >= b.length ? b : a;
    if (!corto.every((t) => largo.includes(t))) return null;
    if (b.length > a.length) mejor = v;
  }
  return mejor;
}

export interface Conflicto {
  campo: string;
  valores: { id: string; valor: string }[];
}

export interface PlanFusion {
  /** Sobrevive el más viejo: es el que tiene más historia colgada. */
  sobrevive: string;
  absorbidos: string[];
  /** Lo que quedaría en el perfil sobreviviente. */
  resultado: Record<string, unknown>;
  /**
   * Campos donde los perfiles dicen cosas distintas y ninguna es vacía.
   * Son los que la persona tiene que mirar: el sistema elige el del
   * sobreviviente, pero avisa que había otra opción.
   */
  conflictos: Conflicto[];
}

/**
 * Calcula el resultado de fusionar, sin escribir nada.
 *
 * La regla: gana el perfil más viejo, y los campos vacíos se completan con lo
 * que traigan los otros. Así el cruce Calendar + WhatsApp funciona solo — uno
 * aporta el LinkedIn, el otro el teléfono — y lo único que hay que mirar son
 * los desacuerdos reales.
 */
export function planDeFusion(perfiles: PerfilFusionable[]): PlanFusion {
  if (perfiles.length < 2) throw new Error('Hacen falta al menos dos perfiles');

  const ordenados = [...perfiles].sort((a, b) => a.created.localeCompare(b.created));
  const base = ordenados[0]!;
  const resto = ordenados.slice(1);

  const resultado: Record<string, unknown> = {};
  const conflictos: Conflicto[] = [];

  for (const campo of CAMPOS) {
    const valores = ordenados
      .map((p) => ({ id: p.id, valor: String(p[campo] ?? '').trim() }))
      .filter((v) => v.valor);

    // El primero no vacío en orden de antigüedad.
    resultado[campo] = valores[0]?.valor ?? '';

    // Hay conflicto solo si dos perfiles dicen cosas DISTINTAS y no vacías.
    const distintos = [...new Set(valores.map((v) => v.valor))];
    if (distintos.length <= 1) continue;

    // El nombre tiene una salida antes del conflicto: si uno amplía al otro,
    // gana el que dice más, no el más viejo.
    if (campo === 'nombre') {
      const completo = nombreMasCompleto(distintos);
      if (completo) {
        resultado.nombre = completo;
        continue;
      }
    }

    conflictos.push({ campo, valores });
  }

  // El teléfono queda válido solo si el valor elegido venía de un perfil que lo
  // tenía validado: si no, arrastraríamos un "válido" que no corresponde.
  const dueñoTel = ordenados.find((p) => p.telefono && p.telefono === resultado.telefono);
  resultado.telefono_valido = Boolean(dueñoTel?.telefono_valido);

  // no_contactar es pegajoso: si CUALQUIERA lo tiene, el fusionado lo tiene.
  // Es un pedido de la persona y perderlo al fusionar sería grave.
  resultado.no_contactar = ordenados.some((p) => p.no_contactar);

  // Ya no es un duplicado pendiente.
  resultado.posible_duplicado_de = [];

  return {
    sobrevive: base.id,
    absorbidos: resto.map((p) => p.id),
    resultado,
    conflictos,
  };
}

/** Etiqueta legible de cada campo, para la pantalla. */
export const NOMBRE_CAMPO: Record<string, string> = {
  slug: 'Perfil de LinkedIn',
  urn: 'URN de Sales Navigator',
  nombre: 'Nombre',
  cargo: 'Cargo',
  empresa: 'Empresa',
  web: 'Web',
  industria: 'Industria',
  pais: 'País',
  ciudad: 'Ciudad',
  resumen: 'Resumen',
  telefono: 'Teléfono',
  telefono_raw: 'Teléfono original',
};

// ---------------------------------------------------------------- los leads

export interface LeadDelPerfil {
  id: string;
  perfil: string;
  cuenta: string;
  /** Para poder decir cuál es, si hay choque. */
  cuenta_abrev?: string;
  /**
   * El email, para poder decidir la fusión.
   *
   * Vive en el lead y no en el perfil (§3.2: es propio de la relación con una
   * cuenta), pero es el dato que más ayuda a resolver un duplicado: dos «Sergio
   * Chávez» con el mismo correo son la misma persona; con correos de empresas
   * distintas, casi seguro que no.
   */
  email?: string;
}

export interface PlanLeads {
  /** Leads que pasan a colgar del perfil sobreviviente. */
  mover: string[];
  /**
   * Choques: el sobreviviente y un absorbido tienen los dos un lead en la MISMA
   * cuenta. `lead` es único por (perfil, cuenta), así que moverlo fallaría.
   *
   * No se resuelve solo: dos relaciones con la misma cuenta significan dos
   * historias de envíos distintas, y elegir cuál se tira no es algo que el
   * sistema pueda decidir por su cuenta.
   */
  choques: { cuenta: string; cuenta_abrev?: string; leads: string[] }[];
}

/**
 * Qué pasa con los leads al fusionar. No escribe nada.
 *
 * Los leads son la razón de que sobreviva el perfil más viejo: es el que tiene
 * la historia de envíos colgada, y moverla cuesta más que moverla al revés.
 */
export function planDeLeads(
  sobrevive: string,
  absorbidos: string[],
  leads: LeadDelPerfil[],
): PlanLeads {
  const cuentasDelSobreviviente = new Set(
    leads.filter((l) => l.perfil === sobrevive).map((l) => l.cuenta),
  );

  const mover: string[] = [];
  const porCuenta = new Map<string, { cuenta_abrev?: string; leads: string[] }>();

  for (const l of leads) {
    if (!absorbidos.includes(l.perfil)) continue;

    if (cuentasDelSobreviviente.has(l.cuenta)) {
      const previo = porCuenta.get(l.cuenta) ?? { cuenta_abrev: l.cuenta_abrev, leads: [] };
      // El del sobreviviente también entra en el choque: hay que ver los dos.
      if (previo.leads.length === 0) {
        const suyo = leads.find((x) => x.perfil === sobrevive && x.cuenta === l.cuenta);
        if (suyo) previo.leads.push(suyo.id);
      }
      previo.leads.push(l.id);
      porCuenta.set(l.cuenta, previo);
      continue;
    }

    // Dos absorbidos con lead en la misma cuenta también chocan entre ellos.
    const gemelo = mover.find((id) => leads.find((x) => x.id === id)?.cuenta === l.cuenta);
    if (gemelo) {
      mover.splice(mover.indexOf(gemelo), 1);
      porCuenta.set(l.cuenta, { cuenta_abrev: l.cuenta_abrev, leads: [gemelo, l.id] });
      continue;
    }

    mover.push(l.id);
  }

  return {
    mover,
    choques: [...porCuenta].map(([cuenta, v]) => ({ cuenta, ...v })),
  };
}
