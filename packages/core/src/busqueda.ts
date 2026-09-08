// Cómo buscan los buscadores del CRM (§7.2, §7.5, panel de partner).
//
// La base es latinoamericana y está llena de tildes y cedillas: Lucía Gonçalves,
// María Fernández Villagrán, Amílcar Sitoe, Fábio Menezes. Escribir el acento
// obliga a saber de antemano cómo está cargado el nombre, que es justo lo que
// uno va a buscar porque no lo sabe. Buscar «Lucia» tiene que traer a «Lucía».
//
// La regla estaba escrita una vez —en la Base compartida— y las otras dos
// pantallas comparaban en crudo, así que el mismo texto encontraba cosas
// distintas según en qué columna se lo escribiera.

const MARCAS = new RegExp('[\\u0300-\\u036f]', 'g');

/**
 * Minúsculas y sin tildes.
 *
 * Los acentos se sacan descomponiendo (NFD) y tirando las marcas. Ojo: el motor
 * JS de PocketBase no implementa `normalize('NFD')` —no falla, devuelve el
 * texto igual—, así que esto sirve en el navegador y en Node, pero un hook del
 * servidor necesita la tabla explícita.
 */
export function sinAcentos(s: string | null | undefined): string {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(MARCAS, '');
}

/**
 * Si alguno de los campos contiene lo buscado.
 *
 * Los campos se pegan con un espacio: buscar «Opus CM» encuentra la empresa
 * aunque venga partida, y de paso nadie puede hacer matching a caballo de dos
 * campos por accidente.
 */
export function coincide(campos: (string | null | undefined)[], consulta: string): boolean {
  const q = sinAcentos(consulta).trim();
  if (!q) return true;
  return sinAcentos(campos.filter(Boolean).join(' ')).includes(q);
}
