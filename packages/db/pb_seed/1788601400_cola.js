/// <reference path="../../../.pb/pb_data/types.d.ts" />

// La cola de envíos de demo.
//
// PARA QUE. La cola es la única parte de la pantalla que muestra algo que
// todavía no pasó, y su diseño depende entero de que haya varios casos a la
// vez: un lote de una cuenta, otra cuenta enviando en paralelo, el sexto que
// quedó afuera del lote, un recordatorio que no hace lote, algo ya enviado y
// algo que falló. Con dos filas sueltas no se puede juzgar nada de eso.
//
// LOS TIEMPOS SON RELATIVOS AL MOMENTO DE SEMBRAR. La cuenta regresiva corre de
// verdad, así que después de un rato lo más cercano queda vencido y se ve como
// «demorado» — que es lo correcto, porque todavía no hay worker que lo consuma
// (bloque D). Para volver a ver la cola en movimiento:
//
//   node packages/db/dev.mjs --reset --seed

migrate(
  (app) => {
    const MIN = 60000;
    const ahora = Date.now();
    const en = (minutos) => new Date(ahora + minutos * MIN).toISOString().replace('T', ' ');

    // Las cuentas por abreviatura, para poder armar el lote de una y no de otra.
    const porAbrev = {};
    for (const c of app.findAllRecords('cuenta')) porAbrev[String(c.get('abrev'))] = c.id;
    const abrevs = Object.keys(porAbrev).sort();
    if (abrevs.length < 2) return;
    const A = abrevs[0];
    const B = abrevs[1];

    // Leads de verdad, para que la fila muestre un nombre real de la demo y el
    // clic lleve a la ficha. Se saltean los del relleno de volumen: la cola
    // tiene que verse con los nombres del prototipo.
    const leads = [];
    for (const l of app.findAllRecords('lead')) {
      if (String(l.get('lista')) === 'Relleno de demo') continue;
      leads.push(l.id);
    }
    if (leads.length < 12) {
      for (const l of app.findAllRecords('lead')) {
        if (leads.length >= 14) break;
        if (leads.indexOf(l.id) === -1) leads.push(l.id);
      }
    }
    if (!leads.length) return;
    const lead = (i) => leads[i % leads.length];

    // tipo, cuenta, minutos, estado, paso, canal
    //
    // Los seis primeros son de la MISMA cuenta a propósito: cinco entran al
    // lote y el sexto queda afuera esperando turno. Los dos de la segunda
    // cuenta prueban que el cupo es por cuenta y no del sistema.
    const ITEMS = [
      ['mensaje', A, 6, 'pendiente', 'R2', 'linkedin'],
      ['mensaje', A, 7, 'pendiente', 'R4', 'linkedin'],
      ['mensaje', A, 8, 'pendiente', 'R1', 'linkedin'],
      ['mensaje', A, 9, 'pendiente', 'R3', 'linkedin'],
      ['mensaje', A, 11, 'pendiente', 'R5', 'linkedin'],
      ['mensaje', A, 13, 'pendiente', 'R2', 'linkedin'],
      ['mensaje', B, 7, 'pendiente', 'R6', 'whatsapp'],
      ['mensaje', B, 12, 'pendiente', 'R1', 'linkedin'],

      // No hacen lote: salen a su hora exacta.
      ['recordatorio', B, 40, 'pendiente', '', 'whatsapp'],
      ['gracias', A, 130, 'pendiente', '', 'whatsapp'],

      // Más allá de los 15 minutos: programados, sin turno calculado.
      //
      // Los dos en la cuenta A. §12 pide que la segunda —AMU, la de la sesión
      // caída— tenga TRES envíos frenados, que es el número que muestra el
      // panel de cuentas conectadas: con cuatro, la pantalla y el manual dicen
      // cosas distintas.
      ['mensaje', A, 95, 'pendiente', 'R7', 'linkedin'],
      ['mensaje', A, 1445, 'pendiente', 'R3', 'linkedin'],

      // Ya salieron.
      ['mensaje', A, -22, 'enviado', 'R1', 'linkedin'],
      ['recordatorio', B, -95, 'enviado', '', 'whatsapp'],

      // Falló: le pasó la hora y NO se mandó. Tiene que verse como demorado,
      // no contarse como hecho.
      ['gracias', B, -8, 'error', '', 'whatsapp'],
    ];

    const TEXTO = {
      R1: 'Hola, te escribo por el tema de repuestos para planta. ¿Es a vos a quien le corresponde?',
      R2: 'Te dejo el caso de una planta parecida a la tuya, por si sirve de referencia.',
      R3: 'Quedó pendiente lo de la cotización, ¿lo vemos esta semana?',
      R4: 'Te mando el detalle técnico que te había quedado debiendo.',
      R5: 'Retomo esto por si quedó traspapelado entre los mails.',
      R6: 'Última desde acá; si en algún momento vira a prioridad, quedo a disposición.',
      R7: 'Aprovecho para reactivar el contacto: cambió el plazo de entrega.',
    };

    let i = 0;
    for (const [tipo, abrev, minutos, estado, paso, canal] of ITEMS) {
      const r = new Record(app.findCollectionByNameOrId('cola'));
      r.set('lead', lead(i));
      r.set('tipo', tipo);
      r.set('cuenta', porAbrev[abrev]);
      r.set('canal', canal);
      r.set('paso', paso);
      r.set('idioma', i % 5 === 0 ? 'pt' : 'es');
      r.set(
        'texto',
        tipo === 'mensaje'
          ? TEXTO[paso] || ''
          : tipo === 'recordatorio'
            ? 'Te recuerdo la reunión de mañana.'
            : 'Gracias por el tiempo de hoy, te dejo lo que quedó pendiente.',
      );
      r.set('cuando', en(minutos));
      r.set('estado', estado);
      if (estado === 'enviado') r.set('enviado_en', en(minutos));
      if (estado === 'error') r.set('error', 'La sesión de WhatsApp se cayó antes de mandarlo.');
      app.save(r);
      i++;
    }
  },

  (app) => {
    for (const c of app.findAllRecords('cola')) app.delete(c);
  },
);
