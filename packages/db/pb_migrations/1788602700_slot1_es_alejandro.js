/// <reference path="../pb_data/types.d.ts" />

// El slot 1 se llama Alejandro, no Alberto.
//
// DE DONDE SALIO EL ERROR. El importador del Calendar
// (`recuperacion/importar-calendar.mjs`) trae una tabla de abreviaturas para
// leer los titulos de los eventos —"Jorge / Alejandro / Augusto"— y de ahi sale
// la cuenta de cada lead. La abreviatura AL estaba bien; el `nombre_perfil` que
// quedo cargado en la cuenta, no.
//
// COMO SE DETECTO. Contra el export: 19 eventos dicen "Alejandro" y 1 dice
// "Alberto". La cuenta decia "Alberto", asi que los leads de Alejandro figuraban
// como de otra persona.
//
// POR QUE IMPORTA AHORA y no es cosmetico: `nombre_perfil` es lo que va en el
// titulo del evento que el CRM escribe en Google Calendar
// ("Jorge Lara Huerta / Alejandro / Augusto", §5.11). Con el nombre equivocado,
// cada reunion que se agende desde ahora sale mal escrita en el calendario de
// verdad, y ya no alcanza con corregir la base.
//
// Confirmado por Augusto el 09/09/2026: «AL alejandro».
//
// Es condicional a proposito. Si alguien ya lo corrigio a mano, esto no lo
// vuelve a tocar; y si manana el slot 1 es otra persona, tampoco le pisa el
// nombre.

migrate(
  (app) => {
    let cuenta;
    try {
      cuenta = app.findFirstRecordByFilter('cuenta', 'slot = 1');
    } catch (_) {
      return; // no hay slot 1: base vacia o esquema distinto
    }

    if (String(cuenta.get('nombre_perfil')) !== 'Alberto') return;

    cuenta.set('nombre_perfil', 'Alejandro');
    app.save(cuenta);
    app.logger().info('slot1-es-alejandro', 'detalle', 'nombre_perfil: Alberto -> Alejandro');
  },

  (app) => {
    let cuenta;
    try {
      cuenta = app.findFirstRecordByFilter('cuenta', 'slot = 1');
    } catch (_) {
      return;
    }
    if (String(cuenta.get('nombre_perfil')) !== 'Alejandro') return;
    cuenta.set('nombre_perfil', 'Alberto');
    app.save(cuenta);
  },
);
