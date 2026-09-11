/// <reference path="../../../.pb/pb_data/types.d.ts" />

// El vigía de la sesión de WhatsApp (§8.2).
//
// POR QUE EXISTE. Augusto, 11/09: *«el botón de WhatsApp aparece como que se
// desvinculó, buscá la opción para que se mantenga conectado»*. La sesión se
// caía cada vez que se reiniciaba PocketBase, porque el worker es un proceso
// aparte que alguien tenía que volver a lanzar a mano — y ese alguien era yo.
// Pasó cuatro veces en un día.
//
// POR QUE ACA Y NO EN EL SCRIPT DE ARRANQUE. El worker necesita entrar a
// PocketBase, y desde un `.cmd` no hay forma de darle credenciales sin dejar
// una clave escrita en un archivo. PocketBase ya está corriendo, ya sabe quién
// es cada uno, y puede generar un token en el momento. Es el único lugar de
// esta máquina donde esto se puede hacer sin guardar una contraseña.
//
// QUE MIRA, y en qué orden:
//   1. Que la cuenta use WhatsApp (`wa_habilitado`).
//   2. Que la señal esté vieja. La escribe el worker cada cinco minutos, así
//      que quince sin señal es «no hay nadie del otro lado».
//   3. Que NO haya un QR fresco: si lo hay, hay un worker vivo esperando que
//      alguien escanee, y levantar otro serían dos peleando por la credencial.
//   4. Que la credencial exista. Sin ella el worker pediría un QR que nadie
//      está mirando, y lo rotaría cada minuto para siempre.
//
// LO QUE NO HACE: no vuelve a vincular. Si la sesión se cayó porque alguien la
// cerró desde el teléfono, hay que escanear otra vez — y eso lo decide una
// persona, no un reloj.

cronAdd('wa-vigia', '*/5 * * * *', () => {
  // Todo adentro del handler: en PocketBase cada uno corre en un runtime JS
  // aislado y NO ve el scope del archivo.
  if (!String($os.getenv('WORKER_LOCAL') || '')) return;

  const raiz = String($os.getenv('CRM_RAIZ') || '');
  if (!raiz) return;

  let cuentas;
  try {
    cuentas = $app.findRecordsByFilter('cuenta', 'wa_habilitado = true', '', 20, 0);
  } catch (err) {
    return;
  }

  for (const c of cuentas) {
    const abrev = String(c.getString('abrev') || '');
    if (!/^[A-Z]{2,4}$/.test(abrev)) continue;

    // 2. ¿Hace cuánto que no da señal?
    const senal = String(c.getString('ultima_senal_wa') || '');
    if (senal) {
      const t = new Date(senal.replace(' ', 'T')).getTime();
      if (isFinite(t) && Date.now() - t < 15 * 60 * 1000) continue; // viva
    }

    // 3. ¿Hay un QR fresco? Entonces hay un worker esperando que lo escaneen.
    const desde = String(c.getString('qr_wa_desde') || '');
    if (desde) {
      const t = new Date(desde.replace(' ', 'T')).getTime();
      if (isFinite(t) && Date.now() - t < 3 * 60 * 1000) continue;
    }

    // 4. ¿Existe la credencial? Sin ella no hay nada que reconectar: haría
    //    falta que una persona escanee, y para eso está el botón.
    const base =
      String($os.getenv('WA_SESION_DIR') || '') ||
      (String($os.getenv('USERPROFILE') || '') || String($os.getenv('HOME') || '')) +
        '/.globalita-wa';
    try {
      $os.stat(base + '/' + abrev.toLowerCase() + '/cred/creds.json');
    } catch (err) {
      continue;
    }

    // El token: el dueño de esta base. Se genera en el momento y caduca solo.
    let token = '';
    let coleccion = '_superusers';
    try {
      const su = $app.findRecordsByFilter('_superusers', 'id != ""', '', 1, 0)[0];
      if (!su) continue;
      token = su.newAuthToken();
    } catch (err) {
      continue;
    }

    const pasar = ['PATH', 'Path', 'SystemRoot', 'windir', 'TEMP', 'TMP',
                   'HOME', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH',
                   'PB_URL', 'WA_NUMERO', 'WA_PAIS', 'WA_SESION_DIR'];
    const entorno = [];
    for (const k of pasar) {
      const v = String($os.getenv(k) || '');
      if (v) entorno.push(k + '=' + v);
    }
    entorno.push('PB_TOKEN=' + token);
    entorno.push('PB_COL=' + coleccion);
    // NO se le pasa WA_HISTORIAL_DIAS: esto es una reconexión, no una
    // vinculación nueva. WhatsApp sólo manda el historial al vincular, así que
    // pedirlo acá no traería nada y sí abriría la puerta a que una reconexión
    // automática vuelque conversaciones sin que nadie lo haya pedido.

    try {
      const cmd = $os.cmd(String($os.getenv('NODE_EXE') || '') || 'node',
                          raiz + '/apps/worker/src/whatsapp.ts', 'vincular', abrev);
      cmd.dir = raiz;
      cmd.env = entorno;
      cmd.start();
      $app.logger().info('wa-vigia', 'reconectando', abrev);
    } catch (err) {
      $app.logger().error('wa-vigia', 'cuenta', abrev, 'err', String(err));
    }
  }
});
