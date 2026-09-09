/// <reference path="../pb_data/types.d.ts" />

// Los perfiles «Manual 35f9q8» pasan a llamarse por su correo.
//
// QUE SON. Augusto los vio en la agenda y los llamo «eventos fantasma», y era
// una lectura razonable: «Manual 35f9q8» no identifica a nadie. Pero no son
// fantasmas. Son SIETE REUNIONES REALES, con su fecha, su cuenta y el correo
// del invitado:
//
//   30/07 ED  jtigua@envasur.com.ec        20/08 ED  f.estrada@ripipsa.com
//   14/08 FR  paulo.ferreira@artecola.cl   21/08 AL  saldana_alejandro@yahoo.com
//   20/08 DL  daniel.pires@unox.com        02/09 ED  nacho_berrueta@hotmail.com
//   04/09 ED  mendoreb81@gmail.com
//
// De donde salio el nombre feo: el importador saca el nombre del titulo del
// evento, que se parte por «/». Estos siete no tenian titulo legible, asi que
// genero uno con letras al azar para no dejarlo vacio.
//
// POR QUE NO SE BORRAN. Borrarlas perderia siete reuniones que ocurrieron, con
// gente con la que hay que hacer seguimiento. Lo que les falta es un nombre, no
// que dejen de existir.
//
// POR QUE EL CORREO Y NO UN NOMBRE INVENTADO. En el caso de «Jorge» se decidio
// NO sacar el nombre del correo, porque «Jdeleonmx» era cambiar un dato malo
// por uno peor. Aca es distinto: no hay ningun nombre que empeorar. El correo
// es el unico dato que identifica a la persona de verdad, se reconoce de un
// vistazo, y Augusto lo puede corregir desde la ficha. «Manual 35f9q8» no
// identifica nada.

migrate(
  (app) => {
    let tocados = 0;

    for (const perfil of app.findAllRecords('perfil')) {
      const nombre = String(perfil.get('nombre') || '');
      // Solo los generados por el importador: «Manual » y seis caracteres.
      if (!/^Manual [A-Za-z0-9]{6}$/.test(nombre)) continue;

      // El correo sale del lead. Si no hay, se deja como esta: un nombre feo es
      // mejor que uno vacio, y por lo menos se puede buscar.
      let correo = '';
      try {
        const leads = app.findAllRecords(
          'lead',
          $dbx.exp('perfil = {:p}', { p: perfil.id }),
        );
        for (const l of leads) {
          const e = String(l.get('email') || '').trim();
          if (e) { correo = e; break; }
        }
      } catch (_) {
        correo = '';
      }

      if (!correo) continue;
      perfil.set('nombre', correo);
      app.save(perfil);
      tocados++;
    }

    app.logger().info('los-manual-tienen-correo', 'renombrados', tocados);
  },

  (app) => {
    // No se revierte: el nombre viejo eran letras al azar, no habia informacion
    // que devolver. Volver atras seria empeorarlo a proposito.
    app
      .logger()
      .info('los-manual-tienen-correo', 'detalle', 'nada que revertir: el nombre viejo no decia nada');
  },
);
