/// <reference path="../../../.pb/pb_data/types.d.ts" />

// Abrir un link en el Chrome de la cuenta que corresponde (§7.2, §7.6).
//
// POR QUE ESTO NO PUEDE VIVIR EN LA PANTALLA. Una pagina web no puede elegir
// con que navegador —ni con que perfil— se abre un link. No es una limitacion
// del CRM: es del navegador, y es a proposito. Elegir el perfil requiere
// arrancar el programa con `--profile-directory`, o sea un proceso local.
//
// Hoy PocketBase corre en la maquina de Augusto, asi que puede hacerlo. El dia
// que el CRM se publique en el VPS, este endpoint estaria intentando abrir
// Chrome EN EL SERVIDOR: inutil y peligroso. Por eso esta apagado salvo que
// CHROME_LOCAL este puesto, y el servicio del VPS no lo pone.
//
// LAS TRES LLAVES, porque esto ejecuta un programa:
//
//   1. Requiere sesion. No es un endpoint anonimo.
//   2. CHROME_LOCAL tiene que estar puesto. Sin eso contesta 404 y no hace
//      nada, ni siquiera dice que existe.
//   3. La URL se valida contra una lista de dominios y el perfil contra un
//      patron. No se arma una linea de comandos con texto del navegador: los
//      argumentos van separados, asi que no hay shell que interpretar.
//
// Sin las tres, esto seria «corran cualquier programa con cualquier argumento»
// detras de un formulario.

routerAdd(
  'POST',
  '/api/abrir',
  (e) => {
    const habilitado = String($os.getenv('CHROME_LOCAL') || '');
    if (!habilitado) {
      // 404 y no 403: si el CRM esta publicado, este endpoint no existe. Decir
      // «existe pero no podes» es contar de mas.
      return e.json(404, { error: 'no disponible' });
    }

    // La lista va ADENTRO del handler, no arriba del archivo.
    //
    // En PocketBase cada handler corre en un runtime JS aislado y NO ve el
    // scope del archivo que lo registro: una constante declarada arriba
    // simplemente no existe aca. Se probo y fallaba con un 400 generico —sin
    // decir por que— en TODA llamada, incluso las validas. Es la misma trampa
    // que esta documentada en google.js.
    const DOMINIOS = [
      'linkedin.com',
      'www.linkedin.com',
      'wa.me',
      'web.whatsapp.com',
      'calendar.google.com',
      'meet.google.com',
      'mail.google.com',
    ];

    const cuerpo = new DynamicModel({ url: '', perfil: '' });
    e.bindBody(cuerpo);

    const url = String(cuerpo.url || '').trim();
    const perfil = String(cuerpo.perfil || 'Default').trim();

    if (!/^https:\/\//i.test(url)) {
      return e.json(400, { error: 'Solo https.' });
    }

    // El dominio, sacado a mano: la parte entre "https://" y la primera barra,
    // sin credenciales ni puerto.
    const resto = url.slice(8);
    const corte = resto.search(/[/?#]/);
    let host = (corte < 0 ? resto : resto.slice(0, corte)).toLowerCase();
    const arroba = host.lastIndexOf('@');
    if (arroba >= 0) host = host.slice(arroba + 1);
    const dosPuntos = host.indexOf(':');
    if (dosPuntos >= 0) host = host.slice(0, dosPuntos);

    if (DOMINIOS.indexOf(host) < 0) {
      return e.json(400, { error: 'Ese dominio no esta en la lista: ' + host });
    }

    // «Default» o «Profile N». Cualquier otra cosa —una ruta, un guion, un
    // espacio de mas— se rechaza antes de llegar al programa.
    if (!/^(Default|Profile [0-9]{1,2})$/.test(perfil)) {
      return e.json(400, { error: 'Perfil de Chrome invalido.' });
    }

    const exe =
      String($os.getenv('CHROME_EXE') || '') ||
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

    try {
      // Argumentos separados, no una linea de comandos: no hay shell que
      // interprete comillas ni ampersands.
      const cmd = $os.cmd(exe, '--profile-directory=' + perfil, url);
      cmd.start();
      return e.json(200, { ok: true, perfil });
    } catch (err) {
      $app.logger().error('abrir', 'perfil', perfil, 'err', String(err));
      return e.json(500, {
        error:
          'No se pudo abrir Chrome. Revisa CHROME_EXE si no esta en la ruta habitual: ' +
          String(err),
      });
    }
  },
  $apis.requireAuth(),
);
