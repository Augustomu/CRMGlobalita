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

/**
 * «dd/mm/aa», para paneles angostos donde el año importa pero no entran cuatro
 * cifras. Existe porque si no, la pantalla que lo necesita se escribe su propio
 * formateador —y con él se lleva la trampa de arriba: las dos copias que había
 * partían el texto sin el guard de largo, así que con un ISO incompleto
 * («2026-09») devolvían «undefined/09» en vez de nada.
 */
export function ddmmaa(iso: string | null | undefined): string {
  const s = String(iso ?? '');
  return s.length >= 10 ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(2, 4)}` : '';
}

/** «dd/mm/aaaa», para cuando el año importa. */
export function ddmmaaaa(iso: string | null | undefined): string {
  const s = String(iso ?? '');
  return s.length >= 10 ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '';
}

/**
 * Cuántos días tiene un mes de un año. Febrero incluido.
 *
 * `new Date(anio, mes, 0)` da el último día del mes anterior, así que pasando
 * el mes SIN restarle uno se obtiene el último del mes que uno quiere.
 */
export function diasDelMes(anio: number, mes: number): number {
  return new Date(anio, mes, 0).getDate();
}

/**
 * El año que corresponde a un día y un mes escritos sin año (§7.6).
 *
 * POR QUÉ EXISTE. Augusto: *«en la parte de nueva y próximo contacto, que
 * solamente sea mes y día, no hace falta año»*. Tiene razón: nadie agenda a
 * dos años vista, y escribir «2026» cada vez que se corre una fecha es
 * tipear un dato que el sistema ya sabe.
 *
 * PERO EL AÑO HAY QUE ELEGIRLO, y no siempre es el de hoy. En diciembre,
 * «15/01» es del año que viene; en enero, «28/12» es del año pasado si se
 * está corrigiendo algo que ya pasó. Por eso hace falta decir hacia dónde se
 * mira:
 *
 *   'futuro'  la próxima vez que caiga ese día. Es el de agendar.
 *   'pasado'  la última vez que cayó. Es el de corregir un histórico.
 *
 * Hoy cuenta como válido en los dos sentidos: agendar «para hoy» y corregir
 * «a hoy» son las dos cosas que más se hacen.
 *
 * EL 29 DE FEBRERO. Si el año candidato no es bisiesto, ese día no existe y
 * se sigue buscando: hacia adelante o hacia atrás según corresponda. Sin esto
 * devolvería «2027-02-29», que `Date` interpreta como el 1 de marzo — o sea
 * una fecha que nadie escribió.
 */
export function anioDe(
  dia: number,
  mes: number,
  hoy: string,
  preferir: 'futuro' | 'pasado' = 'futuro',
): number | null {
  if (!Number.isInteger(dia) || !Number.isInteger(mes)) return null;
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;

  const base = Number(String(hoy).slice(0, 4));
  if (!Number.isFinite(base)) return null;

  // Cuatro años de margen alcanza y sobra: el salto más largo es el de
  // diciembre a enero, y el 29 de febrero aparece una vez cada cuatro.
  const paso = preferir === 'futuro' ? 1 : -1;
  for (let i = 0; i <= 4; i++) {
    const anio = base + i * paso;
    if (dia > diasDelMes(anio, mes)) continue;
    const iso = `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    if (preferir === 'futuro' ? iso >= hoy : iso <= hoy) return anio;
  }
  return null;
}

/**
 * El ISO que resulta de un día y un mes sin año, o `''` si no es una fecha.
 *
 * Devolver `''` y no lanzar es a propósito: esto se llama mientras alguien
 * escribe, y un 31 a medio tipear en un mes de 30 no es un error de nadie.
 */
export function fechaDeDiaMes(
  dia: number,
  mes: number,
  hoy: string,
  preferir: 'futuro' | 'pasado' = 'futuro',
): string {
  const anio = anioDe(dia, mes, hoy, preferir);
  if (anio === null) return '';
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/**
 * Cuántos días hay de una fecha a la otra. Negativo si `hasta` ya pasó.
 *
 * Estaba escrita cuatro veces —`proyecto.ts` en privado, y a mano en
 * Vencimientos, la lista de contactos y el envío de mensajes— y es la mitad
 * de la que faltaba: `fecha.ts` sabía decir qué día es hoy y cómo se escribe
 * un día, pero no sabía restar dos. Sin eso, cada pantalla que necesitaba
 * «cuántos días faltan» no tenía de dónde tomarlo y lo volvía a escribir.
 *
 * Corta el ISO a diez caracteres antes de parsear: con la hora adentro, dos
 * fechas del mismo día separadas por unas horas dan una diferencia de 0,9 y
 * `Math.round` la manda a 1.
 */
export function diasEntre(desde: string, hasta: string): number {
  const a = Date.parse(String(desde ?? '').slice(0, 10));
  const b = Date.parse(String(hasta ?? '').slice(0, 10));
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/**
 * Cómo se dice una fecha respecto de hoy: «hoy», «mañana», «ayer»,
 * «hace 3 días», «en 5 días».
 *
 * POR QUÉ ESTÁ ACÁ. Vivía en dos pantallas con el mismo propósito y ya habían
 * divergido: la lista decía «mañana» y Vencimientos, para el mismo día, decía
 * «en 1 días» —con el plural roto— porque su copia no tenía los casos de ±1.
 * El comentario de Vencimientos afirmaba «igual que en la lista» y no lo era.
 * Dos funciones que nadie mira juntas se separan solas; una sola con tests no
 * puede.
 *
 * Devuelve «hoy» pelado. La pantalla que quiera decir «vence hoy» le pone el
 * verbo adelante: el tiempo verbal es de cada pantalla, la cuenta de días no.
 */
export function cuandoEs(fecha: string, hoy: string): string {
  const dias = diasEntre(hoy, fecha);
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'mañana';
  if (dias === -1) return 'ayer';
  const n = Math.abs(dias);
  const plural = n === 1 ? 'día' : 'días';
  return dias < 0 ? `hace ${n} ${plural}` : `en ${n} ${plural}`;
}
