---
tipo: decision
seccion: "§3.2"
estado: abierta
impacto: 3-medio
recomendada: "Derivar el no leído de los mensajes"
---

# D05 · Un lead con no leídos en los dos canales

**Problema.** `sin_leer` (bool) + `canal_sin_leer` (in | wa) no puede representar un lead que tiene mensajes sin abrir en LinkedIn **y** en WhatsApp a la vez. Pasa seguido con los leads de R4 en adelante.

**Recomendación.** Derivarlo: `sin_leer_li` y `sin_leer_wa` calculados desde el último mensaje entrante contra la última apertura de ese canal. El chip del header muestra los dos.

