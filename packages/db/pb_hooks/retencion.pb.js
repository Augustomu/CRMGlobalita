/// <reference path="../../../.pb/pb_data/types.d.ts" />

// Retencion del registro de actividad: 90 dias (§3.10, decision #14).
//
// Corre DENTRO de PocketBase y no en el cliente por la misma razon que el hook
// de Calendar: si dependiera de que alguien tenga el CRM abierto, la tabla
// crece mientras nadie mira, que es justo cuando crece mas.
//
// Por que se borra en vez de guardarse todo:
//
//   El registro sirve para responder "que paso la semana pasada" — quien mando
//   que, quien edito que campo, quien entro. A los tres meses ya no responde
//   nada: nadie audita un envio de marzo, y lo que si importa de ese envio
//   —que salio, a quien, con que texto— vive en `envio`, no aca.
//
//   Y son datos de personas. Guardar indefinidamente el rastro de lo que hizo
//   cada colaborador porque "por las dudas" es exactamente lo que la decision
//   #14 cerro que no.
//
// El barrido va a las 3 de la maniana: a esa hora no hay nadie usando el CRM y
// un DELETE grande no le pisa una consulta a nadie.

cronAdd('retencion_actividad', '0 3 * * *', () => {
  const DIAS = 90;
  const corte = new Date(Date.now() - DIAS * 86400000).toISOString().replace('T', ' ');

  const r = $app
    .db()
    .newQuery('DELETE FROM actividad WHERE created < {:corte}')
    .bind({ corte: corte })
    .execute();

  // Se registra cuantas se fueron. Un barrido silencioso que un dia borra de
  // mas no deja rastro de haber corrido.
  const cuantas = r && r.rowsAffected ? r.rowsAffected() : 0;
  if (cuantas > 0) {
    console.log(`[retencion] actividad: ${cuantas} entradas de mas de ${DIAS} dias`);
  }
});
