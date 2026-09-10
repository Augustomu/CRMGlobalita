/// <reference path="../pb_data/types.d.ts" />

// Lo que le faltaba a la base para que el worker pueda invitar (§5.3, §8.1).
//
// Son dos cosas y sin ellas el proceso no puede arrancar sin inventar:
//
// 1. `cuenta.cooldown_hasta` — hasta cuándo quedó frenada la cuenta por un
//    aviso de LinkedIn. En el repositorio viejo esto vivía en un
//    `account-cooldowns.json` en la raíz, que se pierde con la máquina y que no
//    se ve desde ninguna pantalla. Acá se ve en Automatizaciones al lado de la
//    cuenta, que es donde alguien va a preguntarse por qué no salió nada.
//
// 2. La configuración del ritmo, en `configuracion` con clave `invitaciones`.
//    Son los números que en el repositorio viejo eran `const` adentro de tres
//    archivos distintos —`invitar-agent.js`, `lib/anti-detection.js`,
//    `lib/safety-guard.js`— y subir un cupo obligaba a un commit.
//
// ACÁ HUBO UN CAMPO DE MÁS Y SE SACÓ. Esta migración agregaba también un
// `lista_invitacion.busqueda` con la URL de la búsqueda guardada. Ese dato ya
// existía: `origen_id` de `1788607000_lista_con_url.js`, con los 22
// `savedSearchId` reales cargados. Eran el mismo dato pensado de dos maneras
// —la URL y el id que la genera— y era la familia 7 del registro, la misma cosa
// en dos lugares, a punto de morder en cuanto el worker tuviera que elegir de
// cuál leer. Se fue el nuevo y quedó el que tiene los datos: se guarda el id, y
// la URL la arma `urlDeLista()` de `core/invitacion.ts`.
//
// LOS NÚMEROS ESTÁN ESCRITOS DOS VECES, acá y en `core/invitar.ts`
// (`CONFIG_INVITAR_INICIAL`), por el mismo motivo que el espejo de
// `pb_hooks/google.js`: el motor JS de PocketBase no puede cargar TypeScript y
// las migraciones no tienen paso de build. Lo que impide que se separen es un
// test que lee ESTE archivo y le exige los mismos valores
// (`invitar.test.ts` → «la semilla de la base y la de core son la misma»).
// Por eso el bloque de abajo es JSON puro y sin comentarios adentro: el test lo
// parsea. La explicación de cada número está en `core/invitar.ts`.

const RITMO_INICIAL = {
  "espera_min_s": 3,
  "espera_max_s": 9,
  "pausa_media_cada": 30,
  "pausa_media_min_s": 90,
  "pausa_media_max_s": 180,
  "pausa_larga_cada": 50,
  "pausa_larga_min_s": 180,
  "pausa_larga_max_s": 300,
  "reset_navegador_cada": 40,
  "pre_bloqueo_cada": 10,
  "tope_por_corrida": 40,
  "warmup_min_s": 10,
  "warmup_max_s": 20,
  "hora_desde": 8,
  "hora_hasta": 22,
  "horas_de_freno": {
    "captcha": 24,
    "actividad_inusual": 24,
    "automatizacion": 72,
    "restringida": 168
  }
};

migrate(
  (app) => {
    // LIMPIAR EL CAMPO DE MÁS, si alcanzó a crearse.
    //
    // Esta migración se llamaba `1788603300_...` y en esa numeración alcanzó a
    // aplicarse una vez, con el `busqueda` que después se sacó. Renombrar el
    // archivo lo hace nuevo para PocketBase —el registro viejo sigue en
    // `_migrations` apuntando a un archivo que ya no existe— así que el bloque
    // de arriba desaparece del código PERO LA COLUMNA QUEDA EN LA BASE.
    //
    // Una columna que ninguna migración crea es una columna que no existe en
    // una base recién levantada y sí en la de quien estuvo acá hoy: dos
    // esquemas distintos con el mismo código. Y encima es la mitad duplicada de
    // `origen_id`, esperando a que alguien la llene.
    //
    // Se borra sólo el campo, y sólo si está: no hay ningún dato adentro —se
    // verificó, 0 de 35 filas— porque nunca llegó a escribirse nada.
    const listas = app.findCollectionByNameOrId('lista_invitacion');
    if (listas.fields.getByName('busqueda')) {
      listas.fields.removeByName('busqueda');
      app.save(listas);
    }

    const cuenta = app.findCollectionByNameOrId('cuenta');
    if (!cuenta.fields.getByName('cooldown_hasta')) {
      cuenta.fields.add(new Field({ name: 'cooldown_hasta', type: 'text', max: 40 }));
      app.save(cuenta);
    }

    // No se pisa lo que ya esté cargado: si alguien lo ajustó desde la
    // pantalla, su valor manda sobre esta semilla.
    let fila;
    try {
      fila = app.findFirstRecordByFilter('configuracion', 'clave = "invitaciones"');
    } catch (_) {
      fila = new Record(app.findCollectionByNameOrId('configuracion'));
      fila.set('clave', 'invitaciones');
      fila.set('valor', RITMO_INICIAL);
    }
    fila.set(
      'descripcion',
      'Ritmo y frenos de la corrida de invitaciones. Lo lee el worker; se edita en Automatizaciones.',
    );
    app.save(fila);
  },

  (app) => {
    const cuenta = app.findCollectionByNameOrId('cuenta');
    cuenta.fields.removeByName('cooldown_hasta');
    app.save(cuenta);

    try {
      app.delete(app.findFirstRecordByFilter('configuracion', 'clave = "invitaciones"'));
    } catch (_) {
      // No estaba: nada que hacer.
    }
  },
);
