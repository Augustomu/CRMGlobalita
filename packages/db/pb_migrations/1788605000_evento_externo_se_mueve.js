/// <reference path="../pb_data/types.d.ts" />

// Un evento de Google se puede mover desde la agenda (§7.6).
//
// POR QUE ESTO CAMBIA UNA DECISION QUE YA ESTABA TOMADA. La migracion anterior
// —`1788604000_evento_con_lead`— dice textual: «moverlo desde aca daria a
// entender lo contrario», y por eso los bloques de Google no se arrastraban.
// El argumento era cierto y la decision no era mia. Augusto, el 09/09:
//
//   «Mantengo apretado y quiero mover hacia abajo, no me deja. Eso deberia ser
//    una funcionalidad, y tiene que mandar una notificacion a la persona.»
//
// Y el costo de aquella decision era peor de lo que parecia: en su base hay
// 1769 eventos de Google contra 288 reuniones del CRM. O sea que el arrastre
// estaba habilitado en la porcion chica de la pantalla y bloqueado en toda la
// otra. Quedo anotado en APRENDIZAJES como familia 8, «decidir por el usuario».
//
// QUE SE AGREGA. Dos columnas de estado, las mismas que ya tiene `reunion`:
//
//   sync_estado    ok | error | sin_conexion | omitida
//   sync_detalle   por que, en castellano
//
// POR QUE HACEN FALTA Y NO ALCANZA CON UN LOG. Mover el bloque en la agenda es
// instantaneo —se escribe en la base y listo—, pero el viaje a Google puede
// fallar: el permiso vencido, Google caido, el evento borrado del otro lado.
// Sin estas dos columnas la pantalla diria «movido» y el calendario de verdad
// seguiria igual, sin que nadie se entere hasta la proxima reunion. Un log en
// el servidor no lo lee nadie a tiempo.
//
// LA REGLA DE ESCRITURA YA ESTABA: el dueno del calendario puede tocar sus
// propios eventos (`calendario = @request.auth.id`), que es lo que hizo falta
// para vincularlos con un lead. Mover usa la misma.

migrate(
  (app) => {
    const c = app.findCollectionByNameOrId('evento_externo');

    if (!c.fields.getByName('sync_estado')) {
      c.fields.add(
        new Field({
          name: 'sync_estado',
          type: 'select',
          maxSelect: 1,
          values: ['ok', 'error', 'sin_conexion', 'omitida'],
          required: false,
        }),
      );
    }

    if (!c.fields.getByName('sync_detalle')) {
      c.fields.add(
        new Field({
          name: 'sync_detalle',
          type: 'text',
          max: 400,
          required: false,
        }),
      );
    }

    app.save(c);
  },

  (app) => {
    const c = app.findCollectionByNameOrId('evento_externo');
    c.fields.removeByName('sync_estado');
    c.fields.removeByName('sync_detalle');
    app.save(c);
  },
);
