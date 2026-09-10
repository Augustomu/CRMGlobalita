import { diasDelMes, fechaDeDiaMes, diaLocal } from '@crm/core/fecha';

/**
 * Un día y un mes, sin año (§7.6).
 *
 * POR QUÉ NO ES UN `<input type="date">`. Augusto, el 09/09: *«en la parte de
 * nueva y próximo contacto, que solamente sea mes y día, no hace falta año. Y
 * además me aparece un emoji de calendario, eso no tiene sentido»*.
 *
 * Las dos cosas vienen del mismo lado: el campo de fecha del navegador SIEMPRE
 * pide el año y SIEMPRE dibuja su propio icono, que además no es el mismo en
 * Chrome que en Firefox. Ese icono era la única pieza de la pantalla que no
 * salía de los tokens del CRM.
 *
 * EL AÑO NO DESAPARECE, SE DEDUCE. La regla vive en `core/fecha.ts` con sus
 * tests: hacia adelante para agendar —en diciembre, «15/01» es del año que
 * viene— y hacia atrás para corregir un histórico. Acá no se decide nada.
 *
 * SON DOS SELECTS Y NO UN CAMPO DE TEXTO. Un texto obliga a acordarse del
 * formato —¿03/09 o 09/03?— y a validar mientras se escribe. Con dos listas no
 * hay formato que recordar, no se puede escribir un mes 13, y en el teléfono
 * abre la rueda del sistema en vez del teclado.
 */
const MESES = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

export function CampoDia({
  valor,
  onCambiar,
  preferir = 'futuro',
  titulo,
  vacio = 'día',
}: {
  /** ISO completo, o `''` si todavía no hay nada elegido. */
  valor: string;
  /** Devuelve el ISO ya con el año puesto, o `''` si se limpió. */
  onCambiar: (iso: string) => void;
  /** Hacia dónde se busca el año. `futuro` para agendar, `pasado` para corregir. */
  preferir?: 'futuro' | 'pasado';
  titulo?: string;
  /** Qué dice la opción vacía del día. */
  vacio?: string;
}) {
  const hoy = diaLocal();
  const iso = String(valor ?? '');
  const dia = iso.length >= 10 ? Number(iso.slice(8, 10)) : 0;
  const mes = iso.length >= 10 ? Number(iso.slice(5, 7)) : 0;

  // Cuántos días ofrecer. Sin mes elegido se muestran 31: al elegir el mes
  // después, la regla de core descarta el 31 de abril devolviendo vacío.
  const anio = iso.length >= 4 ? Number(iso.slice(0, 4)) : Number(hoy.slice(0, 4));
  const tope = mes ? diasDelMes(anio, mes) : 31;

  function elegir(d: number, m: number) {
    if (!d || !m) {
      // Falta la mitad: todavía no es una fecha, pero lo elegido no se pierde.
      // Se arma un ISO parcial que este mismo componente sabe volver a leer.
      onCambiar(d || m ? `${anio}-${String(m || 0).padStart(2, '0')}-${String(d || 0).padStart(2, '0')}` : '');
      return;
    }
    onCambiar(fechaDeDiaMes(d, m, hoy, preferir));
  }

  return (
    <span className="campo-dia" title={titulo}>
      <select
        value={dia || ''}
        className={dia ? undefined : 'campo-dia-vacio'}
        aria-label="Día"
        onChange={(e) => elegir(Number(e.target.value), mes)}
      >
        <option value="">{vacio}</option>
        {Array.from({ length: tope }, (_, i) => i + 1).map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      <select
        value={mes || ''}
        className={mes ? undefined : 'campo-dia-vacio'}
        aria-label="Mes"
        onChange={(e) => elegir(dia, Number(e.target.value))}
      >
        <option value="">mes</option>
        {MESES.map((m, i) => (
          <option key={m} value={i + 1}>
            {m}
          </option>
        ))}
      </select>
    </span>
  );
}
