/// <reference path="../pb_data/types.d.ts" />

// Fuera `cuenta.estado_sesion` y `cuenta.sesion_wa` (§3).
//
// ─────────────────────────────────────────────────────────────────────────────
// LO QUE HAY ADENTRO, medido en la base real el 11/09 antes de tocar nada:
//
//   AL  activa        activa          ultima_senal_li: (vacia)
//   DL  activa        activa          ultima_senal_li: (vacia)
//   FR  activa        activa          ultima_senal_li: (vacia)
//   ED  activa        activa          ultima_senal_li: (vacia)
//   AU  activa        activa          ultima_senal_li: (vacia)
//   AMU caida         caida           ultima_senal_li: (vacia)
//   BR  sin_vincular  sin_vincular    ultima_senal_li: (vacia)
//   AC  sin_vincular  sin_vincular    ultima_senal_li: (vacia)
//   DP  sin_vincular  sin_vincular    ultima_senal_li: (vacia)
//
// CINCO CUENTAS DICEN «ACTIVA» Y LAS NUEVE TIENEN LA SENAL REAL VACIA. Eso no
// es un dato: es una afirmacion vieja con cara de dato. Vino de la semilla de
// demo, nadie volvio a tocarla, y el 10/09 hizo que el CRM creyera que habia
// cinco sesiones de LinkedIn vivas cuando no habia ni una. Esta en el registro
// de aprendizajes, familia 6.
//
// El estado se CALCULA desde el 10/09, en `core/sesion.ts`, a partir de
// `ultima_senal_li` y `ultima_senal_wa`, que las escribe el worker cuando la
// sesion contesta de verdad. Estas dos columnas quedaron sin que nadie las lea
// ni las escriba, mintiendo en silencio.
//
// SACARLAS NO PIERDE NINGUN DATO: lo que hay adentro es exactamente la mentira
// que este proyecto ya pago una vez. Queda anotado arriba, y en el registro, por
// si algun dia alguien pregunta que decian.
//
// Augusto lo autorizo el 11/09: *«eliminalas entonces»*.
//
// LA GUARDA QUE QUEDA. No se comprueba que esten vacias —no lo estan, y ese es
// el punto— sino que lo que tengan sea uno de los tres valores conocidos del
// select. Un valor distinto significaria que alguien empezo a usarlas para otra
// cosa entre que esto se escribio y esto corre, y ahi si hay que mirar antes de
// llevarselo por delante. Vale sobre todo para el VPS, donde esto corre despues.
//
// SI ALGUNA VEZ HICIERA FALTA VOLVER: el `down` las devuelve. Vacias — lo que no
// vuelve es el contenido, porque no habia ninguno que valiera la pena guardar.

migrate(
  (app) => {
    const c = app.findCollectionByNameOrId('cuenta');
    const CONOCIDOS = ['', 'activa', 'caida', 'sin_vincular'];
    let toco = false;

    for (const nombre of ['estado_sesion', 'sesion_wa']) {
      const campo = c.fields.getByName(nombre);
      if (!campo) continue;

      // Se anota lo que se lleva, antes de llevarselo. Una columna que
      // desaparece sin dejar rastro es lo que hace imposible contestar «¿que
      // decia?» seis meses despues.
      const rastro = [];
      for (const fila of app.findAllRecords('cuenta')) {
        const v = String(fila.getString(nombre) || '').trim();
        if (CONOCIDOS.indexOf(v) < 0) {
          throw new Error(
            'No se saca «cuenta.' + nombre + '»: la cuenta ' + fila.getString('abrev') +
            ' tiene «' + v + '», que no es ninguno de los valores conocidos. ' +
            'Alguien la esta usando para otra cosa: hay que mirarlo antes de sacarla.',
          );
        }
        if (v) rastro.push(fila.getString('abrev') + '=' + v);
      }

      // `app`, no `$app`: adentro de una migracion el runtime lo pasa por
      // parametro y el global no existe.
      app.logger().info(
        'migracion-1788750000',
        'campo', nombre,
        'contenido_que_se_saca', rastro.join(' '),
      );

      c.fields.removeById(campo.id);
      toco = true;
    }

    if (toco) app.save(c);
  },
  (app) => {
    const c = app.findCollectionByNameOrId('cuenta');
    let toco = false;

    for (const nombre of ['estado_sesion', 'sesion_wa']) {
      if (c.fields.getByName(nombre)) continue;
      c.fields.add(new Field({
        name: nombre,
        type: 'select',
        maxSelect: 1,
        values: ['activa', 'caida', 'sin_vincular'],
        required: false,
      }));
      toco = true;
    }

    if (toco) app.save(c);
  },
);
