---
tipo: regla
seccion: "§5.1, §5.2"
modulo: core/cadencia.ts
etapa: 4
---

# Cadencia R0–R8

| Paso | Nombre | Canal | Espera hasta el siguiente |
|---|---|---|---|
| R0 | Invitación | LinkedIn (con o sin nota) | arranca al aceptar |
| R1 | Primer contacto | LinkedIn | 15 días |
| R2 | Seguimiento corto | LinkedIn | 15 días |
| R3 | Caso concreto | LinkedIn | 21 días |
| R4 | Pedir el decisor | WhatsApp si hay teléfono, si no LinkedIn | 28 días |
| R5 | Reapertura fase 2 | LinkedIn | 15 días |
| R6 | Seguimiento fase 2 | LinkedIn | 15 días |
| R7 | Caso concreto fase 2 | LinkedIn | 21 días |
| R8 | Último intento fase 2 | WhatsApp si hay teléfono | 28 días |

## Reglas

- La espera se cuenta **desde el envío del paso anterior**, no desde la respuesta.
- Nombres y esperas son **editables** en Automatizaciones → Seguimiento. Se guardan como **configuración**, nunca como constantes en el código.
- Cada paso se puede **pausar** individualmente. Un paso pausado no dispara envíos y el lead queda esperando.
- Después de R4 sin respuesta el lead pasa a **Fase 2**: el próximo contacto se corre 90 días y al volver retoma en R5. → [[D15-fase-2-mas-28-o-mas-90]]
- Después de R8 sin respuesta la cadencia **termina** (queda en Fase 2 sin próximo paso automático).
- Si el lead **responde** en cualquier punto, la cadencia automática se detiene y el seguimiento pasa a ser manual desde la ficha. → [[D17-estado-de-cadencia]]

## De dónde sale el texto

Un solo lugar de verdad: el [[plantilla|repositorio de mensajes]]. La automatización busca la plantilla cuyo nombre empieza con `R{n} · `. Si no existe, el paso **no tiene texto y hay que avisarlo, no inventarlo**. El nombre del paso en Automatizaciones es solo una etiqueta de ese panel.

Esto choca con la métrica de variantes de [[metricas]]: → [[D16-plantilla-por-paso]]

