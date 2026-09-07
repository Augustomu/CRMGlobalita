---
tipo: regla
seccion: "§5.5"
modulo: core/metricas.ts
etapa: 7
---

# Métricas y analítica

Los datos de [[lead]] alcanzan para todo esto. Se guardan desde la etapa 2; en la etapa 7 solo se leen.

- **Por cuenta y por semana:** invitaciones enviadas, aceptadas, conversión de la semana cerrada, avance contra el objetivo de 200.
- **Por paso R:** cuántos leads tocan hoy, cuántos se enviaron, cuántas respuestas, tasa de conversión.
- **Cuándo responden:** distribución por día de semana y franja horaria.
- **Qué perfiles convierten:** reuniones concretadas por cargo.
- **Qué industrias convierten:** reuniones sobre aceptaciones por industria.
- **Qué variante convierte:** habilitado por `historial_envios.plantilla_id` + `texto`. → [[D16-plantilla-por-paso]]
- **Qué páginas rinden:** habilitado por `pagina_origen`.
- **Si la nota en R0 mejora la aceptación:** habilitado por `nota_r0`.

## Dos aclaraciones que cambian el número

- **Aceptadas se cuenta por fecha de aceptación, no de envío.** Una aceptación de esta semana puede venir de una invitación de hace un mes. Hay que aclararlo en la vista o el número se lee mal.
- **En R0 la "conversión" es la aceptación de la invitación, no una respuesta.** Marcarla distinto.
