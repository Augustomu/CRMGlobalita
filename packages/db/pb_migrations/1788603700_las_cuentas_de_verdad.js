/// <reference path="../pb_data/types.d.ts" />

// Los nombres de las cuentas, corregidos por Augusto el 09/09/2026.
//
// Lo que estaba mal y por que importa: `nombre_perfil` es lo que va en el
// titulo del evento que el CRM escribe en Google Calendar
// («Jorge Lara Huerta / Francisco / Augusto», §5.11). Con el nombre equivocado,
// cada reunion que se agenda sale mal escrita en el calendario de verdad — y
// ahi ya no alcanza con corregir la base.
//
//   AU  decia «Augusto Unzaga» y es ALBERTO Unzaga
//   AMU decia «A. M. Unzaga»   y es AUGUSTO Unzaga, la cuenta de Augusto
//   BR  decia «Bruno»          y es BRENNO Rocha
//
// Y faltaban dos cuentas que existen en la operacion y no en la base:
//
//   AC  Alberto Cordova   (SENG; es el del link de reserva)
//   DP  Delia Pace
//
// El perfil de Chrome de cada una sale de la maquina, leido de Chrome el mismo
// dia: AC es «Profile 6 · Alberto Cordova» y DP es «Profile 8 · Delia».
//
// LAS DOS NUEVAS ARRANCAN SIN SESION Y SIN LEADS. Augusto dijo «todavia no las
// conecte pero ya lo voy a hacer»: existen para poder asignarles leads y para
// que el titulo del evento salga bien, no porque haya algo andando detras.

migrate(
  (app) => {
    // ---------- los tres nombres mal ----------
    const arreglos = {
      AU: 'Alberto Unzaga',
      AMU: 'Augusto Unzaga',
      BR: 'Brenno Rocha',
    };

    for (const cuenta of app.findAllRecords('cuenta')) {
      const abrev = String(cuenta.get('abrev'));
      if (arreglos[abrev] && String(cuenta.get('nombre_perfil')) !== arreglos[abrev]) {
        cuenta.set('nombre_perfil', arreglos[abrev]);
        // AU es Alberto Unzaga: su Chrome es el que dice eso, no el personal.
        if (abrev === 'AU') cuenta.set('chrome_perfil', 'Profile 5');
        app.save(cuenta);
      }
    }

    // ---------- las dos que faltaban ----------
    const coleccion = app.findCollectionByNameOrId('cuenta');
    const nuevas = [
      { abrev: 'AC', nombre: 'Alberto Cordova', slot: 8, linea: 'inversiones', chrome: 'Profile 6' },
      { abrev: 'DP', nombre: 'Delia Pace', slot: 9, linea: 'ia', chrome: 'Profile 8' },
    ];

    for (const n of nuevas) {
      try {
        app.findFirstRecordByFilter('cuenta', 'abrev = {:a}', { a: n.abrev });
        continue; // ya existe
      } catch (_) {
        // No estaba: se crea.
      }
      const r = new Record(coleccion);
      r.set('abrev', n.abrev);
      r.set('nombre_perfil', n.nombre);
      r.set('slot', n.slot);
      r.set('linea_negocio', n.linea);
      r.set('chrome_perfil', n.chrome);
      // Los mismos cupos que el resto: no hay motivo para que empiecen distinto.
      r.set('cupo_diario', 40);
      r.set('objetivo_semanal', 200);
      // Sin sesion: no hay nada conectado todavia, y decir lo contrario es el
      // error que acabamos de sacar de la pantalla de Cuentas conectadas.
      r.set('estado_sesion', 'sin_vincular');
      r.set('sesion_wa', 'sin_vincular');
      app.save(r);
    }

    app.logger().info('las-cuentas-de-verdad', 'detalle', 'AU/AMU/BR corregidas, AC y DP creadas');
  },

  (app) => {
    for (const abrev of ['AC', 'DP']) {
      try {
        app.delete(app.findFirstRecordByFilter('cuenta', 'abrev = {:a}', { a: abrev }));
      } catch (_) {
        // Ya no estaba.
      }
    }
    const viejos = { AU: 'Augusto Unzaga', AMU: 'A. M. Unzaga', BR: 'Bruno' };
    for (const cuenta of app.findAllRecords('cuenta')) {
      const abrev = String(cuenta.get('abrev'));
      if (viejos[abrev]) {
        cuenta.set('nombre_perfil', viejos[abrev]);
        app.save(cuenta);
      }
    }
  },
);
