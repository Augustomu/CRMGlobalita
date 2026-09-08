# Auditoría — prototipo vs. construido

Fecha: **07/09/2026**. Contra el bundle **leído entero**: 29 pantallas, los cuatro
documentos y las 14 imágenes.

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

---

# Lo que apareció al leer el bundle entero

La primera versión de esta auditoría se hizo con el 21% leído. Estas son las
cosas que solo aparecieron al abrir las 21 pantallas que faltaban y las 14
imágenes.

## La jerarquía de documentos, que estaba en duda

El `README.md` del bundle la fija y resuelve la contradicción que había
encontrado:

> `MANUAL.md` es la fuente de verdad de las **reglas**.
> El prototipo es la fuente de verdad de lo **visual y del comportamiento**.

`DESIGN-SYSTEM.md` **no** está en esa lista. Es el manual del dashboard viejo
—habla de matrices, clusters, AUTO-CAN y `dashboard.html`— y su tabla de colores
está desactualizada: dice `--bg: #F5F4F0`, y el prototipo y
`css-followup-extracto.css` coinciden en `#F2EEE6`. Los tokens que uso son los
correctos. Sus reglas de peso (400/500/600) y de topbar (52px) también quedan
superadas por el prototipo, que usa 700 y 44px.

## Errores concretos en lo que ya construí

**Las cuentas son gente real, y las inventé.** `Dashboard.dc.html` trae
`CUENTAS_NOMBRE = { AL: 'Alejandro', DL: 'David', FR: 'Francisco', ED: 'Edith',
AU: 'Augusto', AMU: 'Ana María' }`. Mi seed puso «Alberto Cordoba», «Diego
Lamas», «Franco Ruiz», «Elena Duarte». Por eso mi título de evento decía
«Alexandre Jordão · **Diego** · Alberto» y el de Augusto decía «· **David** ·».

**El calendario de próximo contacto no es un calendario pelado.** Pinta cada día
según la carga contra un tope (`tope 40 leads por día`): verde el elegido, ámbar
los que se acercan, rojo los pasados de tope. Y abajo tiene cuatro atajos —
`A 1 semana`, `S 2 semanas`, `D 3 semanas`, `F 4 semanas` — que muestran la fecha
resultante con el corrimiento que hizo falta (`14/09 +2d`) cuando el día ideal
estaba lleno. Es el prop `cargaDias`. No implementé nada de eso.

**El aviso de cambios sin guardar tiene TRES salidas**, no dos:
`Seguir editando` · `Descartar` · `Guardar y salir`.

## Reglas exactas que ahora tengo

| Qué | Regla |
|---|---|
| Escala de la columna 1 | arranca en 80, suma 80 al llegar a 400px del final, vuelve a 80 al filtrar, y si el lead elegido cae fuera de la ventana la expande a `índice + 80` |
| Filtros de la columna 1 | ocho: vencidos, orden, whatsapp, reunión, rol, país, ciudad, etiqueta |
| Cola de envíos | lotes de 5 por cuenta, espaciados 30–40 s, umbral de 15 minutos, countdown en vivo |
| Importar CSV | tres pasos; el duplicado se detecta por los **últimos 8 dígitos** del teléfono |
| Motor de reglas | 5 disparadores × 4 condiciones × 5 acciones, con el vocabulario cerrado |
| Confirmar reunión | `Principal` + `Copia 1, 2…`; avisa si el perfil no tiene email |
| Base compartida | 27.412 perfiles de diseño |
| Sesiones WA | dice **Baileys** explícitamente |

## Una pregunta que la lectura no resolvió

Entre las imágenes hay **dos shells distintos**:

- El de `Dashboard.dc.html`, que es el que construí: sin marca, tabs
  `Automatizaciones · Control · Follow-up · WA Personal · Usuarios`, subtabs en
  el header.
- Otro con **marca «Globalita»**, tabs `Automatizaciones · Follow-up · Tareas ·
  Agenda · Reglas · Cuentas`, subtabs dentro de la columna 1, y dos chips en el
  header: `WA 5/6` y `6.165 · 1.086`.

El segundo aparece en cinco de las diez capturas anotadas. No sé cuál es el
vigente y no lo voy a adivinar.

---

## Cierre — 08/09/2026

Esta auditoría se hizo el 07/09 y midió el punto de partida. **Está saldada.**

| | 07/09 | 08/09 |
|---|---|---|
| Construidas y al día | 9 | **29** |
| Construidas a medias | 4 | 0 |
| Sin construir | 16 | 0 |
| Tests en `core/` | 170 | **276** |

Las 16 que faltaban se construyeron con su colección, sus datos de demo y sus
reglas en `core/` (bloque B del plan), y las 4 a medias se completaron
(bloque C). El detalle de cada una está en los commits `B.1`…`B.9` y
`C.1`…`C.4`.

### Lo que se omitió a propósito

CLAUDE.md regla 6: lo que depende de datos que todavía no existen **se omite y
se anota**, no se reemplaza por una versión inventada. Son tres cosas:

1. **El texto del mensaje que logró la respuesta** (Análisis del perfil). El
   CRM no guarda el hilo de la conversación —se lee en el chat real—, así que
   no hay texto que mostrar. Sí se construyó *qué paso* la trajo, que sale de
   los envíos registrados y es la mitad accionable de la pregunta.
2. **Las franjas horarias de «Cuándo responden»** (Automatizaciones).
   `f_respuesta` guarda solo la fecha. Se muestra por día de la semana, que es
   un dato real, con la nota de que la hora llega con la integración.
3. **Guardar un contacto en Gmail** (WA Personal). Necesita la conexión de
   Google. El botón queda a la vista y apagado, con el motivo.

### Correcciones a esta misma auditoría

Dos cosas que decía y resultaron no ser así al mirarlas con datos adentro:

- **«Rehacer Duplicados en el estilo nuevo»**: no hacía falta. La pantalla está
  al día —comparación lado a lado, campos en desacuerdo marcados, vista previa
  de la fusión, tres salidas—. Lo que faltaba era el dato: sin un perfil
  marcado siempre decía «no hay duplicados pendientes».
- **El duplicado por slug igual no existe.** `perfil.slug` tiene índice único,
  así que el segundo no llega a guardarse. Es la única clase de duplicado que
  el modelo previene solo, y no hay que contemplarla en ningún lado.

### Lo que sigue abierto

Nada de diseño. Lo que queda es el **bloque D — escala e integraciones**, y
buena parte depende de Augusto:

- El cliente OAuth de Google (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
  `APP_URL` en el VPS).
- La decisión sobre el repositorio público y el historial ya expuesto.
- La importación de los datos de producción, que necesita su contraseña.

Y una que no depende de nadie: **medir el volumen real**. Hoy `useLeads` hace
`getFullList` y trae los 6.165 leads de una. Hay que medirlo con volumen de
verdad antes de decidir si el filtrado se mueve al servidor — y medirlo, no
suponerlo, porque traer todo es lo que hace que el buscador sea instantáneo.
