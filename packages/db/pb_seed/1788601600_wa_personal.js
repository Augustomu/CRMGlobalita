/// <reference path="../../../.pb/pb_data/types.d.ts" />

// WA Personal: chats de amigos y familia, y los entrantes por identificar.
//
// PARA QUE. La pantalla existe para separar dos cosas que llegan por el mismo
// canal: el WhatsApp de trabajo y el personal. Sin datos no se puede juzgar lo
// unico que importa del diseño — que los tres casos del ruteo (§5.8) se
// distingan de un vistazo:
//
//   conocido en esta cuenta -> ya se fue solo al follow-up, se avisa y listo.
//   desconocido             -> hay que decidir: trabajo, personal, o agendar.
//   conocido en otra cuenta -> se sabe quien es pero NO se auto-asigna.
//
// Los telefonos son inventados y estan enmascarados: el repositorio es publico.

migrate(
  (app) => {
    const ahora = new Date();
    const HOY = ahora.getFullYear() + '-' + String(ahora.getMonth() + 1).padStart(2, '0') + '-' + String(ahora.getDate()).padStart(2, '0');
    const DIA = 86400000;
    const en = (dias, hora) => new Date(Date.parse(HOY) + dias * DIA).toISOString().slice(0, 10) + ' ' + hora + ':00.000Z';

    // La cuenta de WhatsApp del dueño de la sesion. D19: el chat personal
    // pertenece a la CUENTA que lo recibio, no es global.
    let cuenta = null;
    for (const c of app.findAllRecords('cuenta')) {
      if (String(c.get('abrev')) === 'AU') { cuenta = c; break; }
    }
    if (!cuenta) {
      const todas = app.findAllRecords('cuenta');
      if (!todas.length) return;
      cuenta = todas[0];
    }

    // nombre, telefono, no_leido, mensajes
    const CHATS = [
      ['Mama', '5493415550001', false, [
        ['in', 'Aca el asado, avisame si venis', -2, '13:20'],
        ['out', 'Voy, llevo el vino', -2, '13:42'],
        ['in', 'Perfecto', -2, '13:45'],
      ]],
      ['Pablo (futbol)', '5493415550002', true, [
        ['in', 'Che falta uno para el jueves', -1, '19:05'],
        ['out', 'Contame', -1, '19:31'],
        ['in', 'Dale, 21hs la de siempre', 0, '08:12'],
      ]],
      ['Vero', '5493415550003', false, [
        ['in', 'Feliz cumple!!', -12, '09:00'],
        ['out', 'Gracias!!', -12, '11:24'],
      ]],
      ['Edificio - consorcio', '5493415550004', false, [
        ['in', 'Se corta el agua manana de 9 a 13', -4, '17:40'],
      ]],
      ['Kine', '5493415550005', false, [
        ['out', 'Hola, tengo turno el martes?', -6, '10:02'],
        ['in', 'Si, 18:30', -6, '10:44'],
        ['out', 'Gracias', -6, '10:45'],
      ]],
    ];

    for (const [nombre, telefono, noLeido, mensajes] of CHATS) {
      const r = new Record(app.findCollectionByNameOrId('chat_personal'));
      r.set('cuenta', cuenta.id);
      r.set('nombre', nombre);
      r.set('telefono', telefono);
      r.set('no_leido', noLeido);
      r.set(
        'mensajes',
        mensajes.map(([quien, texto, dias, hora]) => ({ quien, texto, en: en(dias, hora) })),
      );
      app.save(r);
    }

    // Entrantes por identificar. El ruteo ya viene resuelto en el registro para
    // no recalcularlo en cada render (es lo que dice el esquema).
    const ENTRANTES = [
      // Desconocido: los tres botones del prototipo tienen sentido.
      ['5493415559111', 'Hola, vi tu perfil. Necesito cotizar repuestos para dos plantas.', 0, '07:48', 'desconocido'],
      ['5493415559222', 'Buenas! Soy el primo de Marta, me paso tu numero.', 0, '09:15', 'desconocido'],
      // Ambiguo: el telefono coincide con mas de un perfil. NUNCA se le cuelga
      // el mensaje al lead equivocado.
      ['5493415559333', 'Te mando lo que quedo pendiente ayer.', -1, '16:02', 'ambiguo'],
    ];

    for (const [telefono, texto, dias, hora, ruteo] of ENTRANTES) {
      const r = new Record(app.findCollectionByNameOrId('entrante'));
      r.set('cuenta', cuenta.id);
      r.set('telefono', telefono);
      r.set('texto', texto);
      r.set('recibido_en', en(dias, hora));
      r.set('ruteo', ruteo);
      r.set('resuelto', false);
      app.save(r);
    }

    // Uno que YA se ruteo solo porque el telefono estaba en la base: se avisa
    // en la franja de arriba y no pide ninguna decision. Se busca un lead con
    // telefono para que el aviso lleve a una ficha de verdad.
    for (const l of app.findAllRecords('lead')) {
      let p = null;
      try { p = app.findRecordById('perfil', String(l.get('perfil'))); } catch (_) { continue; }
      if (!p || !p.get('telefono_valido')) continue;
      const r = new Record(app.findCollectionByNameOrId('entrante'));
      r.set('cuenta', cuenta.id);
      r.set('telefono', String(p.get('telefono')));
      r.set('texto', 'Perfecto, lo miro y te confirmo.');
      r.set('recibido_en', en(0, '08:31'));
      r.set('ruteo', 'conocido_en_esta_cuenta');
      r.set('candidatos', [{ perfil: p.id, lead: l.id, nombre: String(p.get('nombre')) }]);
      r.set('resuelto', true); // ya resuelto: solo se avisa
      app.save(r);
      break;
    }
  },

  (app) => {
    for (const c of app.findAllRecords('chat_personal')) app.delete(c);
    for (const e of app.findAllRecords('entrante')) app.delete(e);
  },
);
