/// <reference path="../../../.pb/pb_data/types.d.ts" />

// Tareas de demo.
//
// La coleccion ya existia (1788600600) pero nunca se habia sembrado, asi que la
// pantalla salia vacia y no se podia ver ni el orden combinado, ni las
// estrellas, ni el rojo de las vencidas.
//
// Estan armadas para cubrir los casos que la pantalla tiene que distinguir:
// vencidas, de hoy, futuras, sin fecha, hechas, y con prioridades distintas.
// Sin eso no se puede juzgar si el orden por vencimiento + prioridad hace lo
// que tiene que hacer.

migrate(
  (app) => {
    // Hoy en la zona del servidor, no en UTC: con toISOString() a las 18:00 en
    // Mexico ya es manana, y las "vencidas hoy" quedarian como de ayer.
    const ahora = new Date();
    const HOY = ahora.getFullYear() + '-' + String(ahora.getMonth() + 1).padStart(2, '0') + '-' + String(ahora.getDate()).padStart(2, '0');
    const DIA = 86400000;
    const mover = (dias) => new Date(Date.parse(HOY) + dias * DIA).toISOString().slice(0, 10);

    // El admin del seed de demo.
    let usuario = '';
    for (const u of app.findAllRecords('users')) {
      if (String(u.get('rol')) === 'administrador') { usuario = u.id; break; }
    }

    // Un par de tareas se cuelgan de un lead, que es el caso que prueba que la
    // tarea NO necesita uno: las demas van sueltas.
    //
    // Se busca uno con TELEFONO, no uno por el nombre de su lista: la version
    // anterior filtraba por 'Sales Navigator - Gerentes SP' con guion, y el
    // dato lleva punto medio, asi que no encontraba nada y las dos tareas
    // quedaban sueltas sin que nada fallara. Con telefono ademas se ve el caso
    // completo: el bloque del lead muestra LinkedIn y WhatsApp activos.
    let unLead = '';
    for (const l of app.findAllRecords('lead')) {
      let perfil = null;
      try {
        perfil = app.findRecordById('perfil', String(l.get('perfil')));
      } catch (_) {
        continue;
      }
      if (perfil.get('telefono') && perfil.get('telefono_valido')) {
        unLead = l.id;
        break;
      }
    }
    if (!unLead) {
      const todos = app.findAllRecords('lead');
      if (todos.length) unLead = todos[0].id;
    }

    const TAREAS = [
      // nombre, prioridad, dias hasta el vencimiento (null = sin fecha), hecha, notas, notifica, conLead, etiquetas
      //
      // Las etiquetas son libres (§3.7) y se ven en la fila. No todas las
      // tareas llevan: una lista donde todas tienen etiqueta no muestra que la
      // columna puede estar vacia, que es el caso mas comun.
      ['Preparar la propuesta de Opus CM', 5, -3, false, 'Pidieron alcance de una planta, no de las tres.', true, true, 'propuesta, AL'],
      ['Llamar a compras de Sao Paulo', 4, -1, false, '', true, false, 'llamada'],
      ['Revisar los 75 duplicados del import', 3, 0, false, 'Salieron de la recuperacion del Calendar.', true, false, 'datos'],
      ['Mandar el caso de la planta de Cordoba', 5, 0, false, '', false, true, 'propuesta'],
      ['Actualizar el repositorio con el R4 nuevo', 2, 2, false, '', false, false, 'mensajes'],
      ['Pedir el QR de la cuenta AMU', 4, 3, false, 'La sesion de WhatsApp se cayo el martes.', true, false, 'cuentas, urgente'],
      ['Armar el informe de septiembre', 3, 12, false, '', false, false, 'informe'],
      ['Ver si Villagran responde antes del viernes', 1, 4, false, '', false, false, ''],
      ['Cargar los telefonos que faltan', 2, null, false, 'Solo el 12% de la base tiene telefono.', false, false, 'datos'],
      ['Definir el tope diario por cuenta', 3, null, false, '', false, false, ''],
      ['Renovar el acceso a Sales Navigator', 5, -8, true, 'Ya esta pago hasta marzo.', false, false, 'cuentas'],
      ['Escribir el mensaje de agradecimiento', 2, -5, true, '', false, false, 'mensajes'],
    ];

    for (const [nombre, prioridad, dias, hecha, notas, notifica, conLead, etiquetas] of TAREAS) {
      const r = new Record(app.findCollectionByNameOrId('tarea'));
      r.set('nombre', nombre);
      r.set('prioridad', prioridad);
      r.set('fin', dias === null ? '' : mover(dias));
      // El inicio es una semana antes del vencimiento, o nada si no vence.
      r.set('inicio', dias === null ? '' : mover(dias - 7));
      r.set('notas', notas);
      r.set('etiquetas', etiquetas);
      r.set('notificar', notifica);
      r.set('hecha', hecha);
      r.set('usuario', usuario);
      if (conLead && unLead) r.set('lead', unLead);
      app.save(r);
    }
  },

  (app) => {
    for (const t of app.findAllRecords('tarea')) app.delete(t);
  },
);
