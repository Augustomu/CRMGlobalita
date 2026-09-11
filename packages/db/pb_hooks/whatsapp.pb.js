/// <reference path="../../../.pb/pb_data/types.d.ts" />

// Prender la sesión de WhatsApp desde el CRM (§8.2).
//
// POR QUE EXISTE. El QR de WhatsApp no lo puede generar el navegador: lo emite
// Baileys, que es un proceso de Node hablando con WhatsApp. Hasta el 11/09 ese
// proceso lo arrancaba una persona tipeando un comando, y la pantalla sólo
// mostraba el código que él dejaba en la base. Resultado: apretar «Vincular»
// abría un panel que decía «esperando el código» para siempre, y Augusto
// escribió lo único que se podía concluir mirando eso — *«toco el botón de
// vincular y no hace nada»*.
//
// Ahora el botón prende el proceso. Es lo que hace que la pantalla funcione
// como WhatsApp Web, que es como se pidió: *«quiero que sumes el QR dentro del
// CRM para que funcione como WhatsApp Web»*.
//
// LAS CUATRO LLAVES, porque esto ejecuta un programa —las mismas tres de
// `abrir.pb.js`, que ya lanza Chrome, más una que es propia de acá:
//
//   1. Requiere sesión. No es un endpoint anónimo.
//   2. WORKER_LOCAL tiene que estar puesto. Sin eso contesta 404: en el VPS
//      este endpoint no existe y no dice que existe.
//   3. La abreviatura se valida contra un patrón y después contra la base. No
//      se arma una línea de comandos con texto del navegador: los argumentos
//      van separados, así que no hay shell que interprete nada.
//   4. La cuenta tiene que tener `wa_habilitado`. Hoy es una sola.
//
// LA CLAVE DE NADIE VIAJA ACA. El worker necesita entrar a PocketBase, y la
// forma obvia —ponerle PB_USER y PB_PASS en el entorno— dejaría la clave de
// Augusto en una variable de un proceso servidor. En vez de eso se le pasa un
// token del usuario que apretó el botón: sirve para lo mismo, caduca solo, y
// no vale para nada fuera de esta base.

routerAdd(
  'POST',
  '/api/wa/vincular',
  (e) => {
    // Todo adentro del handler: en PocketBase cada handler corre en un runtime
    // JS aislado y NO ve el scope del archivo. Está documentado en google.js y
    // en abrir.pb.js, y costó un 400 genérico en TODAS las llamadas.
    const habilitado = String($os.getenv('WORKER_LOCAL') || '');
    if (!habilitado) {
      return e.json(404, { error: 'no disponible' });
    }

    const raiz = String($os.getenv('CRM_RAIZ') || '');
    if (!raiz) {
      return e.json(500, {
        error:
          'Falta CRM_RAIZ: el servidor no sabe dónde está el repositorio para lanzar el worker.',
      });
    }

    const cuerpo = new DynamicModel({ abrev: '' });
    e.bindBody(cuerpo);
    const abrev = String(cuerpo.abrev || '').trim().toUpperCase();

    if (!/^[A-Z]{2,4}$/.test(abrev)) {
      return e.json(400, { error: 'Abreviatura inválida.' });
    }

    let cuenta;
    try {
      const filas = $app.findRecordsByFilter('cuenta', 'abrev = {:a}', '', 1, 0, { a: abrev });
      cuenta = filas[0];
    } catch (err) {
      return e.json(500, { error: 'No se pudo leer la cuenta: ' + String(err) });
    }
    if (!cuenta) {
      return e.json(404, { error: 'No hay ninguna cuenta «' + abrev + '».' });
    }
    if (!cuenta.getBool('wa_habilitado')) {
      return e.json(400, {
        error:
          'La cuenta ' + abrev + ' no usa WhatsApp. Prendela primero desde Cuentas conectadas.',
      });
    }

    // Si ya hay un QR de hace menos de dos minutos, del otro lado hay un
    // proceso vivo emitiéndolos. Lanzar otro serían dos sesiones peleando por
    // la misma credencial, que es como se desloguean entre ellas. El worker
    // también se niega por su cuenta (turno.pid); esto evita el proceso de más.
    const desde = String(cuenta.getString('qr_wa_desde') || '');
    if (desde) {
      const t = new Date(desde.replace(' ', 'T')).getTime();
      if (isFinite(t) && Date.now() - t < 120000) {
        return e.json(200, { ok: true, ya_estaba: true });
      }
    }

    // El token del usuario que apretó el botón. El worker entra como él.
    let token = '';
    try {
      token = e.auth.newAuthToken();
    } catch (err) {
      return e.json(500, { error: 'No se pudo generar el token para el worker: ' + String(err) });
    }

    // El entorno se arma a mano, variable por variable. `cmd.env` REEMPLAZA el
    // entorno entero —no lo suma—, así que lo que no esté acá no llega: HOME es
    // donde vive la credencial de Baileys, y sin SystemRoot Node ni arranca en
    // Windows.
    const pasar = ['PATH', 'Path', 'SystemRoot', 'windir', 'TEMP', 'TMP',
                   'HOME', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH',
                   'PB_URL', 'PB_COL', 'WA_NUMERO', 'WA_PAIS', 'WA_SESION_DIR'];
    const entorno = [];
    for (const k of pasar) {
      const v = String($os.getenv(k) || '');
      if (v) entorno.push(k + '=' + v);
    }
    entorno.push('PB_TOKEN=' + token);

    const node = String($os.getenv('NODE_EXE') || '') || 'node';
    const script = raiz + '/apps/worker/src/whatsapp.ts';

    try {
      const cmd = $os.cmd(node, script, 'vincular', abrev);
      cmd.dir = raiz;
      cmd.env = entorno;
      // `start` y no `run`: la sesión de Baileys no termina nunca —se queda
      // viva sosteniendo la conexión— así que esperarla dejaría colgada la
      // petición del navegador para siempre.
      cmd.start();
      $app.logger().info('wa-vincular', 'cuenta', abrev);
      return e.json(200, { ok: true, ya_estaba: false });
    } catch (err) {
      $app.logger().error('wa-vincular', 'cuenta', abrev, 'err', String(err));
      return e.json(500, {
        error:
          'No se pudo prender la sesión: ' + String(err) + '. ' +
          'Se puede igual a mano: node apps/worker/src/whatsapp.ts vincular ' + abrev,
      });
    }
  },
  $apis.requireAuth(),
);
