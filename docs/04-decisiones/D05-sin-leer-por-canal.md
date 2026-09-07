---
tipo: decision
seccion: "§3.2"
estado: cerrada
impacto: 3-medio
resuelta: "Dos flags por evento (sin_leer_li, sin_leer_wa), no derivados por ahora"
---

# D05 · Un lead con no leídos en los dos canales

**Problema.** `sin_leer` (bool) + `canal_sin_leer` (in | wa) no puede representar un lead que tiene mensajes sin abrir en LinkedIn **y** en WhatsApp a la vez. Pasa seguido con los leads de R4 en adelante.

**Decidido (2026-09-07).** Dos campos, `sin_leer_li` y `sin_leer_wa`, ya en el esquema de `lead`. El chip del header y la fila de la lista muestran los dos por separado.

## Por evento, no derivado — por ahora

La opción ideal es derivar el estado comparando el último mensaje entrante contra la última apertura de ese canal, sin guardar un booleano que se pueda desincronizar. Se pospuso porque las colecciones de conversación (`mensajes_li`, `mensajes_wa`) todavía no existen — llegan con [[envio-de-mensaje]] y la ficha de conversaciones en la etapa 2.

Mientras tanto, son **flags por evento**: se prenden cuando entra un mensaje por ese canal, se apagan cuando el usuario abre la conversación de ese canal. El riesgo es el de todo booleano de estado: si un flujo se olvida de apagarlo, queda un "sin leer" fantasma. Cuando existan las colecciones de conversación, conviene revisar si conviene pasar a la versión derivada — queda anotado acá para no perderlo, sin abrir una decisión nueva por algo tan chico.
