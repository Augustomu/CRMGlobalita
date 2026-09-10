/// <reference path="../pb_data/types.d.ts" />

// Lo que le falta a `cuenta` para poder vincular WhatsApp (§8.2).
//
// La señal ya existía: `ultima_senal_wa`, y `core/sesion.ts` deduce de ella si
// la sesión está activa, caída o sin vincular. Eso alcanza para decir SI está
// viva, pero no para lo demás que hace falta cuando NO lo está:
//
//   · `qr_wa` — el código a escanear. Vive en la base y no en un archivo porque
//     el que lo escanea mira la pantalla del CRM, y el worker corre en otro
//     proceso. Es texto, no una imagen: la pantalla lo dibuja.
//   · `qr_wa_desde` — cuándo se emitió. UN QR DE WHATSAPP CADUCA AL MINUTO.
//     Sin la fecha, la pantalla muestra uno vencido con total aplomo: se
//     escanea, no pasa nada, y parece que WhatsApp está roto. La regla de
//     vigencia está en `core/whatsapp.ts` con sus tests.
//   · `wa_motivo` — POR QUE no está viva. «Sin vincular» es una sola palabra
//     para cosas que se arreglan distinto: la desvincularon desde el teléfono
//     (hay que escanear de nuevo), la credencial se rompió (ídem), otra sesión
//     tomó el lugar (hay que cerrar la otra), o WhatsApp bloqueó el número
//     (no hay nada que hacer y no hay a quién reclamarle). Una pantalla que
//     dice «sin vincular» y nada más obliga a adivinar cuál de las cuatro es.
//   · `wa_numero` — con qué número quedó vinculada. El QR lo escanea una
//     persona con un teléfono en la mano y nada le impide usar el equivocado;
//     si eso pasa y nadie mira, se descubre el día que sale un mensaje. Se
//     guarda sin `+`, y `numeroTapado()` lo tapa antes de escribirlo en un log.
//
// NO SE GUARDA LA CREDENCIAL ACA, y es a propósito. La sesión de Baileys son
// archivos que van a una carpeta fuera del repositorio y fuera de `pb_data`,
// ignorada por git. Meterla en la base la mandaría a los backups, y una sesión
// de WhatsApp no se respalda: se vuelve a vincular. Copiarla es peor que
// perderla.

migrate(
  (app) => {
    const c = app.findCollectionByNameOrId('cuenta');

    const campos = [
      // El QR es largo: son ~250 caracteres de datos codificados.
      { name: 'qr_wa', max: 1000 },
      { name: 'qr_wa_desde', max: 40 },
      { name: 'wa_motivo', max: 40 },
      { name: 'wa_numero', max: 30 },
    ];

    let toco = false;
    for (const f of campos) {
      if (!c.fields.getByName(f.name)) {
        c.fields.add(new Field({ name: f.name, type: 'text', max: f.max, required: false }));
        toco = true;
      }
    }
    if (toco) app.save(c);
  },

  (app) => {
    const c = app.findCollectionByNameOrId('cuenta');
    for (const n of ['qr_wa', 'qr_wa_desde', 'wa_motivo', 'wa_numero']) {
      c.fields.removeByName(n);
    }
    app.save(c);
  },
);
