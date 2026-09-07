---
tipo: decision
seccion: "§8.3"
estado: abierta
impacto: 2-alto
recomendada: "Guardar google_event_id y calendar_id"
---

# D10 · Identidad del evento de Google Calendar

**Problema.** La reunión no guarda el id del evento creado. Sin él, reagendar o cancelar **crea eventos nuevos** en vez de actualizar, y el calendario se llena de duplicados.

**Recomendación.** Guardar `google_event_id` y `google_calendar_id` en la reunión, más `etag` para detectar cambios hechos del lado de Google. Toda escritura es un upsert por ese id.

