---
tipo: decision
seccion: "§6.1"
estado: cerrada
impacto: 1-bloqueante
resuelta: "El chat personal pertenece a la cuenta de WhatsApp que lo recibió"
---

# D19 · WA Personal no tiene permiso

**Problema.** Las 12 claves de [[permisos]] no incluyen ninguna para WA Personal, y §4 dice que los tabs se calculan desde permisos. Con el preset actual, los colaboradores ven el WhatsApp personal del administrador: amigos y familia. El modelo tampoco dice de quién es cada chat personal.

**Decidido (2026-09-06).** El chat personal y el entrante **pertenecen a la cuenta de WhatsApp que los recibió**. Cada usuario ve los chats de las cuentas que opera, y nada más.

- Si el único WhatsApp vinculado es el de AMU y lo opera Augusto, es el único que ve esos chats.
- Si mañana Sofía vincula el suyo en otra cuenta, ve los de ella y no los de AMU.
- No hace falta que nadie se acuerde de configurar un permiso: la privacidad sale del modelo, no de una casilla.

## Consecuencias

- `chat_personal` y `entrante` llevan `cuenta_id`, igual que el resto de las conversaciones. → [[conversaciones]]
- El contador `wa {n}` del header y el badge de notificaciones cuentan **solo lo visible para ese usuario**.
- El ruteo de [[ruteo-whatsapp]] no cambia: lo que cambia es quién ve la bandeja de entrantes.
- Si más adelante hace falta esconderle la pestaña entera a alguien, se agrega la clave 13. Hoy no hace falta: sin cuentas asignadas, la pestaña ya sale vacía.

## Regla general que deja sentada

Cuando la privacidad se puede resolver **con el modelo de datos**, se resuelve ahí y no con un permiso. Un permiso mal configurado filtra datos; una relación bien modelada, no.
