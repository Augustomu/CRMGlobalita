# Auditoría — prototipo vs. construido

Fecha: **07/09/2026**. Contra `docs/_bundle/CRM de prospeccion.html` (29 pantallas)
y `docs/MANUAL.md`.

Se hizo porque hasta acá venía trabajando contra el documento de cambios de
diseño y el prototipo de Follow-up, sin haber leído el manual completo ni el
backlog del prototipo. El resultado es que faltaba bastante más de lo que
estaba diciendo.

---

## Resumen

| | |
|---|---|
| Pantallas del prototipo | 29 |
| Construidas y al día | **9** |
| Construidas a medias | **4** |
| Sin construir | **16** |

De las 7 etapas del manual: 1 y 2 casi completas, 3 y 4 a la mitad, **5 en
cero**, 6 y 7 apenas empezadas.

---

## Pantalla por pantalla

### Construidas y al día

| Pantalla | Dónde |
|---|---|
| `Login` | `features/auth/` |
| `Dashboard` (el shell) | `App.tsx` |
| `Colapsable` | `features/followup/Colapsable.tsx` |
| `FollowupDetalle` | `features/followup/FichaLead.tsx` |
| `FechaReunion` | `features/followup/FechaReunion.tsx` |
| `EnviarMensaje` | `features/followup/EnviarMensaje.tsx` |
| `LogEdiciones` | `features/followup/LogEdiciones.tsx` |
| `Control` | `features/control/` |
| `Manual del proyecto` | es documentación, no pantalla |

### Construidas a medias

| Pantalla | Qué le falta |
|---|---|
| `ListaContactos` | el popover tiene **2 filtros de 8** (faltan orden, reunión, rol, país, ciudad, etiquetas); no se puede **arrastrar el ancho** (260–520, doble clic, persistido); **no renderiza de a 80** — hoy dibuja todo, y el manual habla de 1.500+ leads activos |
| `AdminUsuarios` | falta la pestaña **Actividad**, la **asignación en lote**, el reparto por cuenta, y dar de baja / reenviar invitación |
| `Vencimientos` | falta el chip de idioma detectado y el atajo "usar recomendado" |
| `RepositorioMensajes` | falta la **estrella de destacado con alcance** (todas las cuentas o algunas), el **orden arrastrable** y el alta/baja |

### Sin construir

| Pantalla | Qué es | Peso |
|---|---|---|
| `Agenda` | tres vistas (semanal, diaria, lista), arrastre y resize de 15 min, hover con ficha completa | **grande** |
| `Automatizaciones` | tres pestañas: invitaciones, cancelación, seguimiento + columna "Sale hoy" | **grande** |
| `WhatsappPersonal` | pestaña de amigos y familia, bandeja de entrantes desconocidos | **grande** |
| `Tareas` | grilla con check, fechas, prioridad por estrellas, emoji de notas | media |
| `BaseCompartida` | tabla de perfiles ya invitados, duplicados entre cuentas | media |
| `ColaEnvios` | qué sale hoy, con cuenta regresiva, al pie de la columna 1 | media |
| `ImportarCsv` | previsualizar y elegir filas; países por código de 2 letras | media |
| `Conversaciones` | el hilo de LinkedIn/WhatsApp del lead | media |
| `ReglasAcciones` | motor de reglas: disparador → condición → acción | media |
| `SesionesWa` | QR por cuenta, vincular otro número | chica |
| `AnalisisPerfil` | ventana, caída y probabilidad del lead | chica |
| `ConfirmarReunion` | mail de confirmación al invitado | chica |
| `EventoAgenda` | el hover del evento en la agenda | chica |
| `EditarLinks` | editar el link de perfil y el de chat | chica |
| `PanelEtiquetas` | crear, renombrar y borrar etiquetas (hoy solo se aplican) | chica |
| `CambiosSinGuardar` | el aviso al cruzar de sección o de lead con cambios | **chica y urgente** |

---

## Lo que puede hacer perder trabajo

Esto no es "falta una pantalla", es un agujero:

1. **No hay aviso de cambios sin guardar.** El manual lo pone como transversal
   desde el día uno (§9.3) y el prototipo lo tiene resuelto. Hoy cambiás de
   lead con la ficha editada y lo escrito se pierde sin preguntar.

2. **La columna 1 dibuja todos los leads.** Con los 21 de demo no se nota. El
   manual dice 1.500+ activos y la base real tiene 6.165 contactos. Hay un
   `TODO(escala)` puesto en `useLeads.ts` y nada más.

---

## Reglas de negocio que faltan en `core/`

El CLAUDE.md dice que toda regla vive en `packages/core/` con su test. Estas
todavía no existen:

| Módulo | Para qué | Manual |
|---|---|---|
| `cupos.ts` | cupo diario por cuenta y ventana de envío | §5.3 |
| `cancelacion.ts` | cancelar a los 90 días, esperar 60, volver como recontacto | §5.4 |
| `reglas.ts` | el motor: disparador → condición → acción | §3.8, §5.9 |
| `tarea.ts` | prioridad, vencimiento y orden de las tareas | §3.7 |
| `agenda.ts` | solapamientos, bloqueos ajenos, pasos de 15 minutos | §7.6 |
| `actividad.ts` | qué se registra y la retención de 90 días | §3.10 |

---

## Integraciones

| | Estado |
|---|---|
| **Google Calendar** | el hook escribe el evento y está probado, pero **falta el cliente OAuth**: hay que crearlo en Google Cloud y poner `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` y `APP_URL` en el VPS. Sin eso los días ocupados salen solo de las reuniones ya cargadas |
| **LinkedIn** | nada. Es la etapa 5 y la de más riesgo técnico (§8.1) |
| **WhatsApp** | nada. Se eligió Baileys; el alcance acordado es responder mensajes y enviar/responder en LinkedIn desde todas las cuentas |
| **CSV** | nada |
| **Gmail** | nada |

---

## Orden propuesto

Primero lo que evita perder datos, después lo que se rompe con volumen, y
recién ahí pantallas nuevas.

1. Aviso de **cambios sin guardar** (§9.3)
2. **Renderizar de a 80** en la columna 1 (§7.2)
3. Los **6 filtros** que faltan en la columna 1
4. **Agenda** — es la pantalla grande que más se usa después de Follow-up
5. **Tareas** y el **panel de etiquetas** completo
6. Etapa 5 entera: cuentas, listas, cupos, R0, cancelación
