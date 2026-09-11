# Lo que reportó Augusto

Pedido por él el 11/09/2026: *«quiero que anotes todos los problemas enviados y
hasta que no te confirme que fue resuelto no lo elimines. Pedime confirmación si
está resuelto antes de avanzar con otra cosa»*.

**Por qué existe este archivo y no alcanzaba `PENDIENTES.md`.** Ese dice lo que
falta hacer según el plan. Esto dice lo que **una persona vio que estaba mal**, y
son dos listas distintas: varias veces el mismo día se dio algo por arreglado
—porque el código cambió y los tests pasaban— y del otro lado de la pantalla
seguía roto. El botón de vincular estuvo «arreglado» cuatro veces antes de
funcionar.

## Cómo se lee

| | |
|---|---|
| 🔴 | reportado, todavía no arreglado |
| 🟡 | **arreglado pero SIN CONFIRMAR por Augusto** — no se borra hasta que él lo diga |
| ✅ | él confirmó que anda |

**Nada pasa a ✅ sin que Augusto lo diga.** Que los tests pasen no es la
confirmación: la confirmación es que él lo vea andar.

---

## 🟡 Esperando confirmación

| # | Qué reportó | Qué se hizo |
|---|---|---|
| 1 | «toco el botón de vincular y no hace nada» | El botón prende el worker (`/api/wa/vincular`), el panel se lleva a la vista, y el worker deja un diario que la pantalla muestra |
| 2 | «sigue sin funcionar, me da error al escanear» | La credencial se borraba con el turno y el diario adentro. Ahora vive en `cred/` aparte |
| 3 | «pongo desvincular y sigue igual» | Dos bugs: la suscripción en vivo no funciona en Node (se cambió por consulta cada 10 s) y el pedido se borraba al conectar |
| 4 | «quiero vincular y sigue así» | La pantalla esperaba que le avisaran; ahora pregunta cada 3 s con el panel abierto. Y había 9 instancias de Vite sirviendo código viejo |
| 5 | «revisá estética y tamaño de los botones» | La confirmación de desvincular usa el patrón que ya existía (el de Google), en la misma fila |
| 6 | «no veo mis chats en la pantalla» | No había nadie escuchando. `apps/worker/src/entrantes.ts` |
| 7 | «sigo sin ver los mensajes» | Estaban guardados con una forma que la pantalla no sabe leer (`quien:'ellos'`, `cuando`) |
| 8 | «los teléfonos están sin agendar y sin foto» | Los nombres se traen de Google Contacts; las fotos de WhatsApp, al importar |
| 9 | «quiero el teléfono abajo del nombre y poder copiarlo» | Hecho, con «✓ copiado» de dos segundos |
| 10 | «agregame un botón para conectar cuenta de Gmail nueva» | Varias cuentas de Google por persona; la agenda se lee de todas |

## 🔴 Reportado y todavía sin resolver

| # | Qué reportó | Estado |
|---|---|---|
| 11 | «no cumple con los colores ni con el fondo de WhatsApp» | Los tokens están puestos pero **no se ve aplicado**. Hay que mirarlo contra la pantalla real |
| 12 | «mandaron nuevos mensajes y no me llegaron» | **El worker no estaba corriendo.** Hay que dejarlo andando y que no se caiga con cada reinicio |
| 13 | «el horario está mal, no es la zona horaria correcta» | Se mostraba la hora **UTC sin convertir**: 17:05 donde WhatsApp dice 11:05 |
| 14 | Un chat junta las conversaciones de varias personas | Arreglado para las importaciones nuevas, pero **lo ya importado sigue mezclado**: WhatsApp manda el historial una sola vez |
| 15 | Ninguna foto en los 58 chats importados | Ídem: el código ya las pide, pero el historial ya entró |

## ✅ Confirmado por Augusto

*(vacío — todavía no confirmó ninguno)*

---

## Lo que NO es de él pero salió de mirar esto

| Qué | Estado |
|---|---|
| Su teléfono real quedó en el historial de git del repo público | 🔴 **decisión suya**: sacarlo requiere reescribir el historial |
| Pegó dos contraseñas en el chat | 🔴 **decisión suya**: cambiarlas |
| `unzi.la12@gmail.com` es usuario del CRM en producción, con acceso a los 240 leads | 🔴 **decisión suya**: revisar si esa cuenta es de él |
