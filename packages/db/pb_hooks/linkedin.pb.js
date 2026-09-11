/// <reference path="../../../.pb/pb_data/types.d.ts" />

// Comprobar la sesion de LinkedIn de una cuenta, desde la pantalla (§8.1).
//
// POR QUE EXISTE. Hasta el 11/09 la fila de LinkedIn no tenia ningun boton y en
// su lugar decia «0 en cola esperando». Augusto: *«en las cuentas de LinkedIn
// reemplazar 0 en cola esperando por el boton de ligar o no ligar»*. Tenia
// razon dos veces: ese texto no dice nada cuando la cola esta vacia —y esta
// vacia en las nueve— y ocupa justo el lugar donde tendria que estar lo unico
// que se puede hacer desde ahi.
//
// QUE HACE Y QUE NO. Lanza `apps/worker/src/vincular.ts`, que abre Chrome con
// el perfil de esa cuenta, entra a LinkedIn y mira si la sesion esta iniciada.
// NO invita a nadie y NO escribe la senal si la sesion esta caida: en ese caso
// hay que iniciarla a mano en el Chrome que se abrio.
//
// CHROME TIENE QUE ESTAR CERRADO. Playwright no puede tomar un perfil que ya
// esta abierto en otra ventana; si lo esta, el worker lo dice en su salida.
//
// Es el mismo patron que `/api/wa/vincular`: se arma el entorno variable por
// variable porque `cmd.env` REEMPLAZA el entorno entero, y se usa `start` y no
// `run` porque la navegacion tarda y esperarla dejaria colgado al navegador.

routerAdd(
  'POST',
  '/api/li/vincular',
  (e) => {
    const cuerpo = new DynamicModel({ abrev: '' });
    e.bindBody(cuerpo);
    const abrev = String(cuerpo.abrev || '').trim();
    if (!abrev) return e.json(400, { error: 'Falta decir cual cuenta.' });

    let cuenta;
    try {
      cuenta = $app.findFirstRecordByFilter('cuenta', 'abrev = {:a}', { a: abrev });
    } catch (_) {
      return e.json(404, { error: 'No existe la cuenta ' + abrev + '.' });
    }

    // El token del usuario que apreto el boton: el worker entra como el.
    //
    // Y CON QUE COLECCION validarlo. Un token no dice solo de que coleccion
    // salio, y si el worker lo refresca contra la equivocada PocketBase
    // contesta «requires auth record from _superusers collection» y el proceso
    // muere antes de escribir nada — que desde la pantalla se ve igual que si
    // el boton no hiciera nada.
    let token = '';
    let coleccion = 'users';
    try {
      token = e.auth.newAuthToken();
      coleccion = e.auth.collection().name || 'users';
    } catch (err) {
      return e.json(500, { error: 'No se pudo generar el token para el worker: ' + String(err) });
    }

    const raiz = $os.getenv('CRM_RAIZ') || __hooks + '/../../..';

    const pasar = ['PATH', 'Path', 'SystemRoot', 'windir', 'TEMP', 'TMP',
                   'HOME', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH',
                   'PB_URL', 'CHROME_PERFILES', 'LI_PERFILES'];
    const entorno = [];
    for (const k of pasar) {
      const v = String($os.getenv(k) || '');
      if (v) entorno.push(k + '=' + v);
    }
    entorno.push('PB_TOKEN=' + token);
    entorno.push('PB_COL=' + coleccion);

    const node = String($os.getenv('NODE_EXE') || '') || 'node';
    const script = raiz + '/apps/worker/src/vincular.ts';

    try {
      const cmd = $os.cmd(node, script, abrev);
      cmd.dir = raiz;
      cmd.env = entorno;
      cmd.start();
      $app.logger().info('li-vincular', 'cuenta', abrev);
    } catch (err) {
      $app.logger().error('li-vincular', 'err', String(err));
      return e.json(500, { error: 'No se pudo lanzar el navegador: ' + String(err) });
    }

    // Se contesta ENSEGUIDA y se dice cuanto tarda. La navegacion son entre
    // diez y treinta segundos, y sin esta frase el boton parece roto.
    return e.json(200, {
      ok: true,
      cuenta: abrev,
      aviso:
        'Se esta abriendo Chrome con el perfil de ' + abrev + '. Tarda entre diez y treinta ' +
        'segundos. Si Chrome ya estaba abierto, cerralo y proba de nuevo.',
    });
  },
  $apis.requireAuth(),
);
