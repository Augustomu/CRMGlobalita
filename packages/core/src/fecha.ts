// Cómo se dicen y se comparan las fechas en el CRM.
//
// Dos cosas que estaban escritas muchas veces, cada una con su variante:
// «qué día es hoy» (nueve pantallas, todas en UTC) y «dd/mm» (cinco copias).

/**
 * Hoy, en la zona de QUIEN MIRA.
 *
 * `new Date().toISOString().slice(0, 10)` da el día en UTC, y eso está mal en
 * todo el continente: a las 21:00 en Buenos Aires ya es mañana en UTC. Con esa
 * fecha, la lista marcaba como vencido lo que vence mañana, el calendario
 * tachaba hoy como si hubiera pasado, y los filtros de «toca hoy» quedaban
 * corridos un día — de noche, que es cuando se cierra el día de trabajo.
 *
 * Recibe la fecha para poder testearlo: sin eso, el test dependería del reloj
 * de la máquina que lo corre.
 */
export function diaLocal(d: Date = new Date()): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

/**
 * «dd/mm» a partir de un ISO, sin pasar por `Date`.
 *
 * Cortar el texto y no parsear es a propósito: `new Date('2026-09-08')` se
 * interpreta como UTC y al formatearla en una zona al oeste vuelve como el 7.
 * El día que muestra la ficha tiene que ser el día que dice el dato.
 */
export function ddmm(iso: string | null | undefined): string {
  const s = String(iso ?? '');
  return s.length >= 10 ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '';
}

/** «dd/mm/aaaa», para cuando el año importa. */
export function ddmmaaaa(iso: string | null | undefined): string {
  const s = String(iso ?? '');
  return s.length >= 10 ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '';
}
