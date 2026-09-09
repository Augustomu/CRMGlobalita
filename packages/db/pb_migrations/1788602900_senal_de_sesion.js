/// <reference path="../pb_data/types.d.ts" />

// La senal de vida de cada sesion (§8.1, §8.2).
//
// EL PROBLEMA. `cuenta.estado_sesion` y `cuenta.sesion_wa` eran campos que
// alguien escribio una vez. El seed de demo los dejo en «activa» y
// «conectada», y la pantalla de Cuentas conectadas mostraba «5 LinkedIn · 5/7
// WhatsApp» sin que existiera una sola sesion de verdad — el worker ni siquiera
// esta escrito. Augusto lo vio de una: «figuran un monton de cuentas que no
// estan conectadas verdaderamente».
//
// Una pantalla de estado que afirma algo que nadie verifico es peor que no
// tenerla: se confia en ella justo cuando la cola dejo de salir y hay que saber
// por que.
//
// LA FORMA. El estado deja de declararse y pasa a deducirse de una senal con
// fecha: el worker toca `ultima_senal_li` / `ultima_senal_wa` cada vez que la
// sesion responde, y `core/sesion.ts` mira cuan vieja es. Mientras el worker no
// exista, las dos estan vacias y todo dice «sin vincular», que es la verdad.
//
// LOS CAMPOS VIEJOS NO SE BORRAN. Siguen ahi por dos razones: la pantalla de
// vincular por QR los usa como intencion del usuario —«esta cuenta se quiere
// conectar»—, y borrar columnas con datos adentro es exactamente lo que este
// repositorio no hace. Lo que cambia es quien manda: para mostrar el estado
// manda la senal, no el campo.

migrate(
  (app) => {
    const c = app.findCollectionByNameOrId('cuenta');
    for (const nombre of ['ultima_senal_li', 'ultima_senal_wa']) {
      if (!c.fields.getByName(nombre)) {
        c.fields.add(new Field({ name: nombre, type: 'text', max: 40 }));
      }
    }
    app.save(c);

    // Las senales arrancan vacias a proposito: hoy no hay ninguna sesion viva y
    // ponerles una fecha seria repetir el error que esto viene a arreglar.
    app.logger().info('senal-de-sesion', 'detalle', 'campos agregados, sin datos: no hay sesiones reales todavia');
  },

  (app) => {
    const c = app.findCollectionByNameOrId('cuenta');
    c.fields.removeByName('ultima_senal_li');
    c.fields.removeByName('ultima_senal_wa');
    app.save(c);
  },
);
