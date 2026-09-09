/// <reference path="../pb_data/types.d.ts" />

// Los estados de proyecto, con nombre y significado editables (§3.13.2).
//
// EL PROBLEMA. Augusto los buscó en la pantalla y no los encontró, y tenía
// razon: los siete estaban escritos a mano en `core/proyecto.ts` y no habia
// ninguna forma de tocarlos desde el CRM. La leyenda del pie de Control —la que
// explica que significa cada estado— salia de ese archivo, asi que corregir una
// palabra era un cambio de codigo.
//
// QUE SE PUEDE EDITAR Y QUE NO, y por que no es lo mismo.
//
// El NOMBRE y el SIGNIFICADO son de quien usa el CRM: son texto que se lee en
// pantalla y no cambian el comportamiento de nada. Se editan.
//
// La CLAVE no. Sobre las claves hay reglas colgadas: `congelado` lo pone solo
// el sistema a los 30 dias sin movimiento, los `cerrado_*` son terminales y no
// vuelven atras, y la tarjeta «Activos» cuenta cuatro estados concretos.
// Renombrar «Congelado» a «En pausa» es cosmetica; borrar la clave `congelado`
// deja proyectos en un estado que ya no existe y una regla apuntando al vacio.
//
// Por eso esta coleccion tiene una fila por clave estructural y no se crean ni
// se borran filas desde la pantalla. Si algun dia hacen falta estados nuevos,
// el campo `estado` de `proyecto` es un `select` con valores fijos: habria que
// ampliarlo tambien, y esa es una decision de modelo, no de pantalla.

migrate(
  (app) => {
    const coleccion = new Collection({
      type: 'base',
      name: 'estado_proyecto',
      // Los lee cualquiera que este dentro: son etiquetas de pantalla.
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      // Los edita solo un administrador: es la leyenda que lee todo el equipo.
      createRule: null,
      updateRule: '@request.auth.rol = "administrador"',
      deleteRule: null,
      fields: [
        { name: 'id', type: 'text', primaryKey: true, required: true, min: 15, max: 15, autogeneratePattern: '[a-z0-9]{15}' },
        // La clave estructural. No se edita: hay reglas colgadas de ella.
        { name: 'clave', type: 'text', required: true, max: 40 },
        { name: 'nombre', type: 'text', required: true, max: 60 },
        { name: 'significado', type: 'text', max: 400 },
        { name: 'orden', type: 'number' },
        // Si cuenta en la tarjeta «Activos» de Control.
        { name: 'activo', type: 'bool' },
        // Marca las que el sistema maneja solo, para que la pantalla lo diga.
        { name: 'automatico', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_estado_clave ON estado_proyecto (clave)'],
    });
    app.save(coleccion);

    // La semilla sale de los mismos textos que estaban en core/proyecto.ts, para
    // que el dia del cambio nadie vea nada distinto.
    const semilla = [
      ['sin_hablar', 'Sin hablar', 'El proyecto existe pero todavia no hubo una conversacion sobre el.', 1, true, false],
      ['en_conversacion', 'En conversacion', 'Hay ida y vuelta activo, sin propuesta formal enviada.', 2, true, false],
      ['propuesta_enviada', 'Propuesta enviada', 'La pelota esta del otro lado: mandamos algo y esperamos respuesta.', 3, true, false],
      ['nuestra_pelota', 'Nuestra pelota', 'Nos falta hacer algo: armar la propuesta, mandar material, definir precio.', 4, true, false],
      ['congelado', 'Congelado', 'Mas de 30 dias sin movimiento. No se descarta, pero no avanza.', 5, false, true],
      ['cerrado_ganado', 'Cerrado ganado', 'Se cerro y arranco el trabajo.', 6, false, false],
      ['cerrado_perdido', 'Cerrado perdido', 'Se cerro sin avanzar. Queda en el historial con el motivo.', 7, false, false],
    ];

    for (const [clave, nombre, significado, orden, activo, automatico] of semilla) {
      const r = new Record(coleccion);
      r.set('clave', clave);
      r.set('nombre', nombre);
      r.set('significado', significado);
      r.set('orden', orden);
      r.set('activo', activo);
      r.set('automatico', automatico);
      app.save(r);
    }
  },

  (app) => {
    app.delete(app.findCollectionByNameOrId('estado_proyecto'));
  },
);
