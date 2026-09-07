---
tipo: regla
seccion: "§5.4"
modulo: core/cancelacion.ts
etapa: 5
---

# Cancelación y recontacto

- Invitación **sin aceptar durante 90 días** (configurable) → se cancela, para liberar el límite de invitaciones pendientes de LinkedIn.
- El lead cancelado **espera 60 días** (configurable) y vuelve a la cola con etapa **Recontacto** y la plantilla de reinvitación. → [[D24-plantilla-de-reinvitacion]]
- **Tope de cancelaciones: 30 por día y por cuenta** (configurable), para no hacer un movimiento masivo sospechoso.

## Lo que la interfaz tiene que poder responder

Cuántos leads cancelados cumplen la espera **hoy**, **esta semana** y **la próxima**, por cuenta. Ese es el cuadro "Vuelven a la cola de envío" de Automatizaciones → Cancelación.

## Hueco conocido

No hay campo `cancelada_en` ni estado para los 60 días de espera. Sin eso no se puede consultar qué invitaciones toca cancelar hoy. → [[D17-estado-de-cadencia]]

