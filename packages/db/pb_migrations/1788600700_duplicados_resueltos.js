/// <reference path="../../../.pb/pb_data/types.d.ts" />

// La otra mitad de D02: el detector MARCA duplicados, una persona los RESUELVE.
//
// Resolver tiene dos salidas y hasta ahora solo una quedaba registrada:
//
//   fusionar     -> los perfiles se combinan y el absorbido desaparece.
//   son distintos -> los dos perfiles siguen existiendo... y en la siguiente
//                    corrida del detector volvian a aparecer emparentados,
//                    porque nada guardaba la decision.
//
// `distinto_de` guarda esa decision. Es el caso de Mauricio Mantovani y Paul
// Goris, que comparten el telefono +31 6 31799446 y son dos personas: sin este
// campo, la bandeja los propone para siempre.
//
// `fusionado_en` deja el rastro de la fusion. No se borra el perfil absorbido
// sin dejar dicho a donde fue: si manana aparece un WhatsApp entrante con el
// telefono viejo, tiene que poder llegar al perfil que quedo.

migrate(
  (app) => {
    const perfil = app.findCollectionByNameOrId('perfil');

    // Ids de perfiles que YA se compararon con este y no son la misma persona.
    perfil.fields.add(
      new Field({ name: 'distinto_de', type: 'json', maxSize: 2000 }),
    );

    // Si este perfil fue absorbido, a donde fue. Vacio = perfil vivo.
    perfil.fields.add(
      new Field({ name: 'fusionado_en', type: 'text', max: 20 }),
    );

    app.save(perfil);
  },

  (app) => {
    const perfil = app.findCollectionByNameOrId('perfil');
    perfil.fields.removeByName('distinto_de');
    perfil.fields.removeByName('fusionado_en');
    app.save(perfil);
  },
);
