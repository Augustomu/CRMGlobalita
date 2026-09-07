---
tipo: decision
seccion: "§5.4"
estado: abierta
impacto: 2-alto
recomendada: "Agregar cancelada_en al lead"
---

# D03 · Falta `cancelada_en`

**Problema.** [[cancelacion-recontacto]] define cancelar a los 90 días y esperar 60, pero el modelo no guarda cuándo se canceló. Sin ese timestamp no se puede calcular la tabla "vuelven a la cola" ni saber a quién le toca hoy.

**Recomendación.** Agregar `fechas.cancelada_en`. La consulta de recontacto pasa a ser `cancelada_en + espera <= hoy`. Va junto con [[D17-estado-de-cadencia]].

