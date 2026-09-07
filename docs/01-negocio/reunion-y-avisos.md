---
tipo: regla
seccion: "§3.2, §5.11, §8.3"
modulo: core/reunion.ts
etapa: 3
---

# Reunión y avisos

## El objeto

`{ fecha, hora, duracion_min (default 30, en pasos de 15), estado, calendario_id, notas }`, con estado ∈ pendiente / asistió / no-asistió / cancelada.

`historial[]` guarda los intentos anteriores: `{ fecha, hora, resultado }`. Una reunión reagendada deja el intento anterior ahí.

## Los tres avisos

Viven en **Reglas y acciones rápidas**, no en Automatizaciones:

- Recordatorio configurable: ninguno / 2 / 3 / 4 horas antes.
- Confirmación 24 h antes y aviso 1 h 30 antes (activables).
- Agradecimiento post reunión cuando el estado pasa a **asistió**.

## Google Calendar

- Las reuniones creadas en el CRM se escriben en el calendario del usuario elegido.
- Los eventos existentes se leen como **bloqueos** para calcular disponibilidad.
- Cambiar hora, fecha o duración desde la agenda **actualiza** el evento (la interfaz confirma con "Calendar actualizado").
- Reenviar la invitación del evento al lead es una **acción explícita**.

## Huecos conocidos

- Falta `google_event_id`: sin él, reagendar crea eventos duplicados. → [[D10-identidad-del-evento-de-calendar]]
- Falta zona horaria en la reunión, con leads en tres husos. → [[D23-zona-horaria-de-la-reunion]]
- `demora_reunion` con reagendadas: ¿contra la primera o la última? → [[D11-demora-reunion-reagendada]]

