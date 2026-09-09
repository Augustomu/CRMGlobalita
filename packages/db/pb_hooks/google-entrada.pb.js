/// <reference path="../../../.pb/pb_data/types.d.ts" />

// La VUELTA: lo que cambia en Google Calendar cambia en el CRM (§8.3).
//
// La ida ya estaba (google-calendar.pb.js): el CRM crea y actualiza el evento, y
// Google le avisa al invitado. Faltaba la vuelta, y sin ella la agenda mentia:
// si el cliente pedia correr la reunion y uno la movia desde el celular —que es
// donde uno la mueve— el CRM seguia mostrando el horario viejo para siempre, sin
// forma de notarlo desde adentro.
//
// POR QUE UN RELOJ Y NO UN AVISO DE GOOGLE. Google sabe empujar los cambios
// (`events.watch`), pero para eso necesita una URL publica con HTTPS donde
// golpear, y ademas hay que renovarle el canal cada siete dias. El CRM todavia
// no esta publicado, asi que un aviso empujado no se podria ni probar. Un reloj
// cada cinco minutos anda igual en la maquina de uno y en el VPS, y el dia que
// convenga empujar, lo que va abajo —el pedido incremental y la escritura— no
// cambia: cambia quien lo dispara.
//
// EL PELIGRO DE ESTO, y por que hay tanto cuidado abajo:
//
//   1. ECO INFINITO. Escribir la reunion con $app.save() dispara el hook de
//      salida, que la manda a Google, que en la vuelta siguiente vuelve como un
//      cambio... Por eso se escribe con SQL directo, igual que `anotar()`: una
//      consulta plana NO dispara hooks.
//   2. MAILS AL LEAD. Cada escritura hacia Google sale con `sendUpdates=all`,
//      o sea que le llega un correo al invitado. Un falso "cambio" no es ruido
//      en un log: es un mail de mas en la casilla de un cliente, cada cinco
//      minutos. Por eso la decision de si hubo cambio vive en core, con tests
//      (packages/core/src/sincronizar.ts) y se compara por INSTANTE, no por
//      texto.
//
// LA REGLA ESTA ESCRITA DOS VECES, y hay que saberlo. La version buena, con sus
// nueve tests, es `cambioDeGoogle()` en packages/core/src/sincronizar.ts. Esta
// de abajo es su espejo, porque el motor JS de PocketBase no puede cargar
// TypeScript y no hay paso de build para los hooks. Si se toca una, se tocan
// las dos. Esta anotado en PENDIENTES como la unica duplicacion de regla del
// repo.

cronAdd('google_entrada', '*/5 * * * *', () => {
  const g = require(`${__hooks}/google.js`);
  const c = g.config();
  if (!g.configurado(c)) return;

  let cuentas = [];
  try {
    cuentas = $app.findAllRecords('google_cuenta');
  } catch (_) {
    return;
  }

  for (const cuenta of cuentas) {
    if (!cuenta.get('refresh_token')) continue;
    try {
      g.traerCambios(cuenta);
    } catch (err) {
      // Una cuenta rota no puede frenar a las demas.
      $app.logger().error('google-entrada', 'cuenta', cuenta.id, 'err', String(err));
    }
  }
});
