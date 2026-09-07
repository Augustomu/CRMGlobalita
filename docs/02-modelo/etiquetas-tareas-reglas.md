---
tipo: entidad
seccion: "§3.7, §3.9, §3.10"
etapa: 1
---

# Etiquetas, tareas y actividad

## Etiqueta

`{ nombre, editada_en }`. Catálogo libre, **sin colores por etiqueta**.

En uso: Caliente, Tibio, Frío, Decisor, Contacto, Recordatorio, Reagendar, Periódico, No target, Fase 2, más etiquetas de segmento (MX Norte, Compras SP).

Ojo: *Fase 2*, *Recordatorio* y *Reagendar* también son estados → [[D04-fase-2-existe-dos-veces]].

## Tarea

`{ nombre, etiquetas[], prioridad 1–5, inicio, fin, notas, notificar, hecha }`. **Independiente del lead** (no hay FK obligatoria).

La fila es una grilla: check, nombre, fechas, vencimiento, etiquetas, alertas y prioridad en columnas rectas.

## Registro de actividad

`{ ts, usuario_id, tipo, accion, sobre_lead_id?, canal? }` con tipo ∈ sesión, envío, edición, reunión, permiso. **Retención 90 días.**

