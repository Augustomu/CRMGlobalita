import { useState } from 'react';
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
 * NUNCA DEVUELVE UNA FECHA A MEDIAS. Mientras falta el día o el mes no hay
 * fecha, y eso se guarda acá adentro. Antes se le mandaba al llamador un ISO
 * parcial —«2026-09-00» al elegir sólo el mes— con la idea de que este mismo
 * componente lo sabía volver a leer. El problema es que también lo sabía leer
 * la base: los tres llamadores guardaban al vuelo y el guard que tenían,
 * `if (iso)`, da verdadero para «2026-09-00». Una regla que cada llamador
 * tiene que acordarse de aplicar es una regla que alguno va a olvidar; ahora
 * no hay nada que recordar, porque lo incompleto no sale de acá.
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
  const completo = iso.length >= 10;

  // La mitad elegida cuando todavía no hay fecha. Vive acá y no en el
  // llamador: es un paso de la interacción, no un dato.
  const [medio, setMedio] = useState({ dia: 0, mes: 0 });
  const dia = completo ? Number(iso.slice(8, 10)) : medio.dia;
  const mes = completo ? Number(iso.slice(5, 7)) : medio.mes;

  // Cuántos días ofrecer. Sin mes elegido se muestran 31: al elegir el mes
  // después, la regla de core descarta el 31 de abril devolviendo vacío.
  const anio = completo ? Number(iso.slice(0, 4)) : Number(hoy.slice(0, 4));
  const tope = mes ? diasDelMes(anio, mes) : 31;

  function elegir(d: number, m: number) {
    if (!d || !m) {
      // Falta la mitad: lo elegido no se pierde, pero afuera no sale nada.
      setMedio({ dia: d, mes: m });
      // Salvo que se esté BORRANDO una fecha que ya estaba: eso sí es un
      // cambio, y el llamador tiene que enterarse.
      if (completo) onCambiar('');
      return;
    }
    // El 31 de abril no existe: core devuelve vacío. En ese caso lo elegido
    // se queda a la vista para poder corregir el mes, en vez de borrarse.
    const armada = fechaDeDiaMes(d, m, hoy, preferir);
    setMedio(armada ? { dia: 0, mes: 0 } : { dia: d, mes: m });
    onCambiar(armada);
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
