# Control de proyectos y rol Observador — especificación de las funciones nuevas

Anexo a `MANUAL.md`. Cubre solo lo que se agregó después de la versión anterior del prototipo: la entidad **Proyecto**, la sección **Control**, el rol **Observador** y el vínculo lead → proyecto. Todo lo que no esté acá sigue como está en `MANUAL.md`.

Prototipo de referencia: `Control.dc.html` (sección), `Dashboard.dc.html` (rol, permisos, header, creación de proyectos), `AdminUsuarios.dc.html` (rol y permisos por usuario), `FollowupDetalle.dc.html` (acción "Abrir proyecto").

Fecha de referencia del prototipo: **04/09/2026**.

---

## 1. Por qué existe

El CRM sigue leads en una cadencia (R0–R8). Lo que no tenía era la capa de arriba: **el trabajo que se abre cuando el lead ya avanzó**. Una reunión puede terminar en una venta de Fabript/PIV, en una parcería con otro proveedor o en un prototipo, y eso no cabe en la etapa del lead.

Además hay un socio de IT (Alejandro) que necesita ver el estado del trabajo sin ver la prospección: no le interesan las invitaciones ni los mensajes, le interesa **qué proyectos hay, en qué estado están, qué se habló y cuántas reuniones se generaron**.

Dos cosas nuevas, entonces: la entidad Proyecto y un rol de solo lectura que solo ve proyectos y reuniones.

---

## 2. Entidad Proyecto

Un lead puede tener **varios** proyectos (le vendemos Fabript/PIV y además armamos una parcería). Un proyecto puede existir **sin** lead (contactos anteriores a la prospección, referidos, ferias).

| Campo | Tipo | Notas |
|---|---|---|
| `id` | id | |
| `lead_id` | id? | `null` si no vino de la prospección |
| `nombre` | string | Título del trabajo, no el nombre de la persona |
| `empresa` | string | Se copia del lead al crear; después es independiente |
| `tipo` | enum | `fabript_piv` \| `parceria` \| `prototipo` |
| `estado` | enum | Ver §3 |
| `pais`, `ciudad`, `industria` | string | Se copian del lead al crear |
| `rol_contacto` | string | Cargo de la persona con la que se habla |
| `contacto` | string | Nombre de la persona |
| `cuenta` | string | Cuenta de invitación de la que salió (`AL`, `DL`, …) |
| `responsable_id` | id | Usuario dueño del proyecto |
| `abierto` | date | Fecha de creación |
| `nota_lead` | text | Copia de la nota "Acerca de" de la ficha, para leerla sin entrar al lead |
| `notas[]` | `{fecha, texto, autor_id}` | Contexto que no cambia el estado |
| `updates[]` | `{fecha, texto, autor_id}` | Qué se habló / qué pasó, en orden cronológico |
| `acciones[]` | `{fecha, texto, autor_id, hecha}` | Próximos pasos con fecha |

**Campos derivados** (no se guardan, se calculan):

- `reuniones` — cantidad de reuniones asociadas al proyecto.
- `ultima_reunion` — la reunión pasada más reciente. Si no hay pasadas pero sí una futura, se muestra `programada DD/MM`; si no hay ninguna, `sin reuniones`. Nunca puede leerse "sin reuniones" al lado de un conteo mayor a cero.
- `ultimo_movimiento` — la fecha más alta entre `updates[]`, `notas[]` y reuniones.
- `proxima_accion` — el primer ítem de `acciones[]` sin `hecha`.

### 2.1 Tipos

`Venta de PIB` se renombró a **Fabript/PIV**. El tipo `prototipo` sigue existiendo como tipo de proyecto (se filtra con su chip), pero **no** tiene vista propia: la pestaña "Prototipos" se eliminó.

---

## 3. Estados del proyecto

Siete estados. La regla de cada uno es normativa: define cuándo el sistema (o el usuario) lo aplica.

| Estado | Cuándo |
|---|---|
| **Sin hablar** | El proyecto existe pero todavía no hubo una conversación sobre él |
| **En conversación** | Hay ida y vuelta activo, sin propuesta formal enviada |
| **Propuesta enviada** | La pelota está del otro lado: mandamos algo y esperamos respuesta |
| **Nuestra pelota** | Nos falta hacer algo: armar la propuesta, mandar material, definir precio |
| **Congelado** | Más de 30 días sin movimiento. No se descarta, pero no avanza |
| **Cerrado ganado** | Se cerró y arrancó el trabajo |
| **Cerrado perdido** | Se cerró sin avanzar. Queda en el historial con el motivo |

Reglas:

1. **Congelado es automático.** Si `ultimo_movimiento` tiene más de 30 días y el estado no es cerrado, el sistema lo pasa a Congelado. Cargar una actualización lo saca de Congelado y lo devuelve al estado anterior.
2. Los dos estados cerrados son terminales: solo un usuario los cambia a mano.
3. Los estados **activos** (los cuatro primeros) son los que cuentan en la tarjeta "Activos".
4. La leyenda con estas reglas se muestra al pie de la vista de Proyectos. No es documentación aparte: es parte de la pantalla.

---

## 4. Sección Control

Dos pestañas: **Proyectos** y **Reuniones**. Toda la sección es de **solo lectura** para cualquier rol (se edita desde la ficha del lead o desde el proyecto, no desde acá). El header lleva una pastilla "Solo lectura".

### 4.1 Proyectos

- Cinco tarjetas de resumen: Activos · Propuesta enviada · Nuestra pelota · Congelados · Cerrados ganados.
- Filtros en dos filas, cada una con su etiqueta: **Tipo** y **Estado**. Cada chip muestra el conteo.
- Tabla, una fila por proyecto, en dos líneas:
  - **Línea 1** — Proyecto (nombre + empresa · contacto + icono de notas) · Tipo · Estado · Lugar (país / ciudad) · Industria y rol · Reun. · Últ. reunión · Próxima acción.
  - **Línea 2 — tira de avance**: carrusel horizontal. Orden: primero las próximas acciones (destacadas en ámbar), después las actualizaciones de la más nueva a la más vieja, después las notas. Cada tarjeta lleva su etiqueta (Próxima acción / Actualización / Nota), la fecha y el texto. Se corre al costado; no se corta ni se colapsa.
- **Icono de notas**: mismo lenguaje visual que la ficha del lead. Prendido en acento cuando el proyecto tiene notas; en `hover` muestra la nota "Acerca de" del lead y la última nota del proyecto. Es el vínculo de lectura entre el proyecto y la ficha.
- Clic en la fila abre el **panel de proyecto** (derecha, ancho máximo 720 px):
  - Grilla de datos: contacto, rol, empresa, industria, país y ciudad, cuenta, responsable, abierto, reuniones (con la fecha de la última) y si tiene ficha en el CRM.
  - **Tres columnas**: `Notas` · `Actualización del proyecto` · `Próximas acciones`. Notas y actualizaciones, de la más nueva a la más vieja; acciones en orden de fecha.
  - Reuniones del proyecto, numeradas, con estado.
  - Nota de la ficha del lead, textual.

### 4.2 Reuniones

Período: **último mes / 3 meses / 6 meses**. Todo lo de abajo respeta el período elegido.

Ocho tarjetas: Reuniones · Asistieron (con %) · No asistió · Reagendadas · Con proyecto · **Conversión** (% de reuniones que terminaron en proyecto) · Empresas distintas · Promedio por semana.

- **Gráfico por mes**: una barra por mes del período. La barra entera es el total; la banda oscura de abajo es la porción que derivó en proyecto. Al pie: promedio por mes, mejor mes y duración promedio.
- **Agrupar por** (barras horizontales con conteo y %): país, ciudad, industria, rol, empresa, cuenta, quién la generó, estado, **día de la semana**, **franja horaria** (mañana 8–11, mediodía 11–14, tarde 14–17, última hora 17–20).
- **Tabla del período**, numerada: # · fecha · hora + duración · con quién (nombre y cargo) · empresa · lugar (país / ciudad) · industria · quién la generó · estado · nota.

Estados de reunión: `asistió`, `no asistió`, `reagendada`, `pendiente` (futura).

---

## 5. Rol Observador

Tercer rol fijo, junto a Administrador y Colaborador. Es de **solo lectura**.

Permisos por rol (preset): `control`, `verTodosLeads`. Nada más.

No ve: Follow-up, WA Personal, automatizaciones, cola de envíos, vencimientos, repositorio, base compartida, cuentas conectadas, tareas, agenda, usuarios. No edita nada en ninguna pantalla.

`PERMS` se amplió con tres claves nuevas: **`control`**, **`followup`** y **`waPersonal`**. Follow-up y WA Personal dejaron de ser secciones fijas y pasaron a ser permisos como el resto — es lo que permite que un rol se quede sin ellas. El preset de Colaborador incluye `followup` y `waPersonal`; el de Administrador incluye todo.

Como con los otros roles, **cada permiso se puede prender o apagar por usuario** desde la ficha en Usuarios, con la marca "por rol / editado" y el botón para volver al preset.

### 5.1 Header del Observador

Solo dos controles: el **chip de usuario** y el **tema**. Se ocultan notificaciones, tareas, agenda, vencimientos, repositorio y el menú "···". Regla general: un icono del header se muestra solo si el usuario tiene el permiso de lo que abre; el de notificaciones requiere `followup` o `waPersonal`, y el de "···" requiere al menos una de las herramientas que contiene.

### 5.2 Sección inicial

La primera sección visible del usuario es la primera de su lista de permitidas, no `Follow-up` fijo. Al entrar, el Observador cae en **Control**.

---

## 6. Cómo un lead se convierte en proyecto

Es **manual y explícito**, desde la ficha del lead (columna 2) → botón de acciones rápidas → grupo **Control de proyectos**:

- *Abrir proyecto Fabript/PIV*
- *Abrir proyecto de parcería*

Al elegir uno, el sistema crea el proyecto con:

- `nombre`: `"Fabript/PIV para {empresa}"` o `"Parcería con {empresa}"` (editable después).
- `lead_id`, `contacto`, `empresa`, `pais`, `ciudad`, `industria`, `rol_contacto`, `cuenta`, `nota_lead`: copiados de la ficha.
- `responsable_id`: el usuario asignado al lead.
- `estado`: **En conversación**.
- `notas[]` y `updates[]`: un registro inicial, `"Proyecto abierto desde la ficha del lead"`.

El proyecto queda visible **al instante** en Control, para el Observador y para el administrador. Abrir dos veces el mismo tipo sobre el mismo lead no duplica: reemplaza.

**Por qué manual.** Un lead que acepta y responde no es un proyecto; muchos quedan en la nada. Si se creara automáticamente al agendar una reunión, Control se llenaría de proyectos vacíos y el conteo de "Activos" dejaría de significar algo. La decisión de que existe un trabajo la toma una persona.

Las reuniones se asocian al proyecto por `lead_id`: si el lead tiene proyecto, sus reuniones cuentan en ese proyecto. Una reunión de un lead sin proyecto cuenta en el total del dashboard pero no en la conversión.

---

## 7. Qué ve cada rol de esto

| | Administrador | Colaborador | Observador |
|---|---|---|---|
| Sección Control | sí | no (por preset) | sí, es lo único |
| Abrir proyecto desde la ficha | sí | sí, sobre sus leads | no |
| Editar notas, actualizaciones y acciones | sí | sobre sus leads | no |
| Dashboard de reuniones | sí | no | sí |
| Datos de contacto (teléfono, email, links) | sí | sobre sus leads | no |

El Observador ve nombre, cargo, empresa, industria, país y ciudad de la persona con la que se tuvo la reunión — eso es el objeto del control. No ve teléfonos, emails, links ni conversaciones.

---

## 8. Criterios de aceptación

1. Entrar como Observador deja el header con dos controles (usuario y tema) y una sola pestaña, Control.
2. Un proyecto sin movimiento hace más de 30 días figura Congelado sin que nadie lo toque; al cargar una actualización sale de Congelado.
3. La columna Últ. reunión nunca dice "sin reuniones" si el conteo es mayor a cero: con reunión futura dice `programada DD/MM`.
4. La tira de avance de una fila se corre al costado y muestra, en orden: próximas acciones, actualizaciones (más nueva primero) y notas.
5. Cambiar el período en Reuniones recalcula las ocho tarjetas, el gráfico, el agrupador activo y la tabla.
6. Agrupar por día de la semana y por franja horaria devuelve conteos que suman el total del período.
7. Abrir un proyecto desde la ficha de un lead lo hace visible en Control sin recargar, con estado En conversación y su primer registro de actualización.
8. Apagar el permiso `control` a un usuario le saca la pestaña; prenderlo se la devuelve, sin tocar su rol.
