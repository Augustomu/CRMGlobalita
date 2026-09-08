/// <reference path="../../../.pb/pb_data/types.d.ts" />

// Duplicados de demo.
//
// La pantalla existia y estaba bien, pero sin un solo perfil marcado siempre
// decia "no hay duplicados pendientes": no habia forma de juzgar si la
// comparacion lado a lado sirve, que es lo unico que esa pantalla tiene que
// resolver.
//
// Los tres casos son los que la base real produce de verdad (§5.9, D08):
//
//   1. EL MISMO NOMBRE ESCRITO DISTINTO. Un CSV sin acentos contra un perfil
//      cargado con ellos. Es el mas comun y el mas facil de fusionar.
//   2. EL MISMO TELEFONO, OTRO NOMBRE. O es la misma persona con el nombre mal
//      cargado, o son dos personas de la misma empresa que comparten linea.
//      No se puede decidir sin mirar: por eso la pantalla existe.
//   3. LA MISMA PERSONA, UNO CON SLUG Y OTRO SIN. Pasa cuando uno entro por
//      LinkedIn y el otro por un CSV; se cruzan por la huella nombre+empresa.
//
// EL DUPLICADO POR SLUG IGUAL NO EXISTE Y NO HACE FALTA CONTEMPLARLO: `slug`
// tiene indice unico en la base, asi que el segundo no llega a guardarse. Se
// intento sembrarlo y PocketBase lo rechazo — vale la pena dejarlo escrito,
// porque es la unica clase de duplicado que el modelo ya previene solo.
//
// Ademas se deja UN par marcado como `distinto_de`, para que se vea que la
// decision de "no son la misma persona" tambien se guarda y no vuelve a
// preguntar (migracion 1788600700).

migrate(
  (app) => {
    const perfiles = app.findCollectionByNameOrId('perfil');
    const leads = app.findCollectionByNameOrId('lead');

    const cuentas = [];
    for (const c of app.findAllRecords('cuenta')) cuentas.push(c.id);
    if (!cuentas.length) return;

    // nombre, cargo, empresa, telefono, slug, pais, ciudad, industria
    const PARES = [
      [
        ['Nicolas Bergallo', 'Jefe de Compras', 'Metalurgica Bergallo', '5493415551010', 'nicolas-bergallo', 'Argentina', 'Rosario', 'Metalurgia'],
        ['Nicolás Bergallo', 'Jefe de Compras', 'Metalúrgica Bergallo', '5493415551010', '', 'Argentina', 'Rosario', 'Metalurgia'],
      ],
      [
        ['Marta Pineda', 'Gerente de Planta', 'Envases del Litoral', '5493425552020', 'marta-pineda', 'Argentina', 'Santa Fe', 'Plasticos'],
        ['M. Pineda Rossi', 'Directora Industrial', 'Envases del Litoral', '5493425552020', '', 'Argentina', 'Santa Fe', 'Plasticos'],
      ],
      [
        ['Joao Ribeiro', 'Supervisor de Producao', 'Ribeiro Autopecas', '5511987653030', 'joao-ribeiro-sp', 'Brasil', 'Sao Paulo', 'Automotriz'],
        ['Joao Ribeiro', 'Supervisor', 'Ribeiro Autopecas', '', '', 'Brasil', 'Sao Paulo', 'Automotriz'],
      ],
      // Este par NO son la misma persona: mismo apellido, misma empresa, dos
      // hermanos. Queda resuelto como `distinto_de` para que no vuelva a
      // preguntar.
      [
        ['Hernan Costas', 'Gerente Comercial', 'Costas Hnos', '5493515554040', 'hernan-costas', 'Argentina', 'Cordoba', 'Construccion'],
        ['Hernan Costas Vega', 'Jefe de Deposito', 'Costas Hnos', '5493515554041', 'hernan-costas-vega', 'Argentina', 'Cordoba', 'Construccion'],
      ],
    ];

    let i = 0;
    PARES.forEach((par, indice) => {
      const ids = [];
      for (const [nombre, cargo, empresa, telefono, slug, pais, ciudad, industria] of par) {
        const p = new Record(perfiles);
        p.set('nombre', nombre);
        p.set('cargo', cargo);
        p.set('empresa', empresa);
        p.set('telefono', telefono);
        p.set('telefono_raw', telefono);
        p.set('telefono_valido', Boolean(telefono));
        if (slug) p.set('slug', slug);
        p.set('pais', pais);
        p.set('ciudad', ciudad);
        p.set('industria', industria);
        app.save(p);
        ids.push(p.id);

        // Cada perfil necesita su lead: sin el no aparece en ningun lado y la
        // fusion no tendria que reasignar nada, que es la mitad del trabajo.
        const l = new Record(leads);
        l.set('perfil', p.id);
        l.set('cuenta', cuentas[i % cuentas.length]);
        l.set('etapa', 'R1');
        l.set('situacion', 'en_curso');
        l.set('lista', 'Recuperado del import');
        app.save(l);
        i++;
      }

      const [a, b] = ids;
      const primero = app.findRecordById('perfil', a);
      const segundo = app.findRecordById('perfil', b);

      if (indice === PARES.length - 1) {
        // El par ya resuelto: se sabe que son distintos.
        primero.set('distinto_de', [b]);
        segundo.set('distinto_de', [a]);
      } else {
        // El marcado va en LOS DOS: desde cualquiera de las dos fichas se tiene
        // que poder llegar a la comparacion. Marcando uno solo, quien abre el
        // otro no se entera de que hay un duplicado esperando.
        primero.set('posible_duplicado_de', [b]);
        segundo.set('posible_duplicado_de', [a]);
      }
      app.save(primero);
      app.save(segundo);
    });
  },

  (app) => {
    for (const l of app.findAllRecords('lead')) {
      if (String(l.get('lista')) !== 'Recuperado del import') continue;
      const perfil = l.get('perfil');
      app.delete(l);
      try {
        app.delete(app.findRecordById('perfil', perfil));
      } catch (_) {}
    }
  },
);
