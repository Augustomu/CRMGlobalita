# CRM de prospección — Manual de funcionalidades y estructura

Documento de especificación para construir el sistema desde cero. Está escrito para que un agente de código pueda implementarlo sin tener que inferir reglas de negocio: cada comportamiento que hoy existe en el prototipo está descrito acá, con sus casos borde y las decisiones ya cerradas.

El prototipo de referencia vive en este proyecto como Design Components (`Dashboard.dc.html` como entrada). El prototipo es la fuente de verdad visual y de comportamiento; este manual es la fuente de verdad de las reglas.

> **Este archivo es el manual VIVO.** `CRM Globalita manual.pdf` es la revisión
> congelada del 08/09/2026; de ahí en adelante los cambios se escriben acá, con
> su fecha y su motivo, y el **Registro de cambios** del final los lista. Donde
> el PDF y este archivo digan cosas distintas, **manda este archivo**.
>
> Lo ya construido y lo que falta están en `docs/DIVERGENCIAS.md` y
> `docs/PENDIENTES.md`.

**El stack queda a criterio de quien implemente.** El manual no asume framework, base de datos ni proveedor de colas. Donde una decisión técnica es forzada por el negocio (por ejemplo: los envíos tienen que sobrevivir a que el navegador esté cerrado), está marcada como requisito, no como sugerencia.

---

## 1. De qué trata el proyecto

Es un CRM de prospección saliente en LinkedIn y WhatsApp para un equipo chico (hoy 1 administrador y 3 colaboradores) que vende servicios industriales en LATAM y Brasil.

El trabajo real que hace el equipo, y que el sistema tiene que sostener:

1. **Invitar.** Se manejan hasta 10 cuentas de LinkedIn en paralelo. Cada cuenta recorre listas de Sales Navigator (o CSV importados) página por página y manda invitaciones de conexión, con un cupo diario por cuenta. Ese primer paso se llama **R0**.
2. **Seguir.** Cuando alguien acepta la invitación, entra en una cadencia de mensajes numerados **R1 a R8**, con esperas fijas entre paso y paso. Los R7–R8 pueden salir por WhatsApp si el lead tiene teléfono cargado.
3. **Cancelar y reciclar.** La invitación que nadie acepta se cancela a los 90 días (para liberar el cupo de invitaciones pendientes de LinkedIn), el lead espera 60 días y vuelve a la cola como **Recontacto**.
4. **Agendar.** El objetivo de toda la cadencia es una reunión. La reunión se agenda desde la ficha del lead, se refleja en la agenda del sistema y se sincroniza con Google Calendar.
5. **Repartir.** El administrador reparte leads entre colaboradores. Cada colaborador ve solo sus leads; el administrador ve todo.

Volumen que el sistema tiene que soportar sin degradarse: **27.000+ perfiles** en la base compartida, **1.500+ leads activos** en follow-up, **200 invitaciones por semana por cuenta** × 10 cuentas.

### 1.1 Qué NO es

- No es un CRM de ventas completo: no hay pipeline de oportunidades, ni cotizaciones, ni facturación. El objeto central es el **lead** y su avance por la cadencia, no el deal.
- No es una bandeja de entrada unificada. Las conversaciones de leads viven en la ficha del lead. WhatsApp personal (amigos y familia) es una pestaña aparte y deliberadamente separada.
- No es multi-empresa/multi-tenant. Es una instalación para un equipo.

---

## 2. Glosario

| Término | Significado |
|---|---|
| **Lead** | Persona a prospectar. Es la entidad central. |
| **Cuenta** (o cuenta de invitación) | Perfil de LinkedIn desde el que se invita y se escribe. Se identifica por una abreviatura de 2–3 letras: `AL`, `DL`, `FR`, `ED`, `AU`, `AMU`. Hay 10 slots. |
| **Lista** | Origen de perfiles de una cuenta: una búsqueda guardada de Sales Navigator o un CSV importado. Tiene páginas y prioridad. |
| **R0** | La invitación de conexión de LinkedIn. |
| **R1–R8** | Los 8 mensajes de seguimiento de la cadencia, en orden. |
| **Fase 2** | Estado del lead que agotó R1–R4 sin responder: se corre 3 meses y retoma en R5. |
| **Etapa** | En qué punto de la cadencia está el lead: `R0`…`R8`, `Fase 2`, `Recontacto`. |
| **Próximo contacto** | Fecha en la que toca el siguiente mensaje de este lead. Es el campo que ordena el trabajo del día. |
| **Vencimiento** | Un lead cuyo próximo contacto ya pasó o está por pasar. |
| **Mensaje destacado** | Plantilla del repositorio marcada como favorita, global o por cuenta, para tenerla a mano al escribir. |
| **Cola de envíos** | Los envíos programados que están por salir (mensajes de cadencia, recordatorios, agradecimientos). |
| **Entrante** | Mensaje de WhatsApp recibido de un número que el sistema todavía no clasificó. |

---

## 3. Modelo de datos

Los tipos están en notación neutra. Toda fecha suelta es `date` (ISO `YYYY-MM-DD`); toda marca de tiempo es `timestamp` con zona.

### 3.1 Usuario

| Campo | Tipo | Notas |
|---|---|---|
| `id` | id | |
| `nombre` | string | |
| `email` | string | único; sirve de login |
| `rol` | enum | `Administrador` \| `Colaborador` |
| `estado` | enum | `activo` \| `pendiente` \| `suspendido` |
| `permisos` | map<string, bool> | overrides por usuario; ver §6 |
| `metodo_invitacion` | enum | `link` \| `clave_temporal` |
| `invitado_en` | timestamp | null si se creó directo |
| `ultimo_acceso` | timestamp | |

Reglas:
- `pendiente` = invitado por link y todavía no entró. No puede iniciar sesión hasta aceptar.
- `suspendido` = no puede iniciar sesión, pero sus leads y su actividad se conservan.
- Puede haber **más de un Administrador**. Nada en el sistema debe asumir uno solo (ver §6.3 y §8.6).

### 3.2 Lead

El objeto más grande del sistema. Campos agrupados por para qué sirven.

**Identidad y origen**

| Campo | Tipo | Notas |
|---|---|---|
| `id` | id | |
| `nombre` | string | tal como figura en LinkedIn; puede ser largo y traer el cargo adentro. No truncar en el dato, truncar en la vista. |
| `cargo` | string | |
| `empresa` | string | |
| `web` | string | |
| `industria` | string | |
| `pais` | string | nombre completo o código ISO-2; ver §5.6 |
| `ciudad` | string | |
| `cuenta` | fk Cuenta | desde qué cuenta se lo trabaja |
| `lista` | string | descripción del origen (`"Sales Navigator · Gerentes SP"`, `"Referido · WhatsApp directo"`) |
| `pagina_origen` | int? | de qué página de la lista salió. `null` si vino de referido o de un entrante. Sirve para medir qué páginas rinden. |
| `nota_r0` | bool | si la invitación se mandó con nota o sin nota |

**Contacto**

| Campo | Tipo | Notas |
|---|---|---|
| `telefono` | string | se normaliza con código de país al guardar; ver §5.7 |
| `email`, `email2`, `email3` | string | hasta 3 |
| `link_perfil` | url | perfil de LinkedIn |
| `link_chat` | url | hilo de mensajes de LinkedIn |
| `foto` | blob/url | opcional, se pega desde el portapapeles |

**Estado de la cadencia**

| Campo | Tipo | Notas |
|---|---|---|
| `etapa` | enum | ver glosario |
| `proximo_contacto` | date | |
| `sin_leer` | bool | hay un entrante sin abrir |
| `canal_sin_leer` | enum | `in` \| `wa` |
| `etiquetas` | string[] | libres, del catálogo; ver §3.9 |
| `nota` | text | resumen del perfil escrito a mano |

**Fechas medidas** (`fechas`, objeto embebido)

| Campo | Tipo | Notas |
|---|---|---|
| `invitacion` | timestamp | cuándo salió R0 |
| `aceptacion` | timestamp | cuándo aceptó |
| `respuesta` | timestamp | primera respuesta del lead |
| `demora_respuesta` | derivado | `respuesta − aceptacion`, mostrado en lenguaje natural (`"8 h"`, `"18 días"`) |
| `demora_reunion` | derivado | `reunion.fecha − respuesta` |
| `ultimo_contacto` | timestamp | último envío nuestro |

Requisito: guardar los timestamps crudos, no los textos. Todos los "8 h" / "cada 6 días" del prototipo son derivados y se calculan al leer.

**Historial de envíos** (`historial_envios[]`) — la base de la analítica

| Campo | Tipo | Notas |
|---|---|---|
| `r` | enum | qué paso se envió |
| `enviado_en` | timestamp | |
| `canal` | enum | `LinkedIn` \| `WhatsApp` |
| `plantilla_id` | fk Mensaje? | qué plantilla se usó; null si se escribió a mano |
| `idioma` | enum | `es` \| `pt` \| `en` |
| `texto` | text | el texto realmente enviado (permite comparar variantes) |

**Reunión** (`reunion`, objeto embebido; null si no hay)

| Campo | Tipo | Notas |
|---|---|---|
| `fecha` | date | |
| `hora` | time | |
| `duracion_min` | int | default 30, editable en pasos de 15 |
| `estado` | enum | `pendiente` \| `asistio` \| `no-asistio` \| `cancelada` |
| `calendario_id` | fk Usuario | en qué calendario se agendó |
| `notas` | text | |

**Historial de reuniones** (`historial[]`): `{ fecha, hora, resultado }` con resultado `asistió` \| `no asistió` \| `cancelada`. Una reunión reagendada deja el intento anterior acá.

**Conversaciones**: `mensajes_li[]` y `mensajes_wa[]`, cada mensaje `{ quien: 'in'|'out', texto, enviado_en, ack? }` con `ack` ∈ `enviado` \| `entregado` \| `leido` (solo WhatsApp).

**Log de ediciones** (`log[]`): `{ editado_en, usuario_id, campo, antes, despues }`. Ver §8.4 (deshacer y revertir).

### 3.3 Cuenta de invitación

| Campo | Tipo | Notas |
|---|---|---|
| `id`, `abrev` | id, string | `AL`, `DL`, … |
| `nombre_perfil` | string | nombre real del perfil de LinkedIn |
| `estado_sesion` | enum | `activa` \| `caida` \| `sin_vincular` |
| `cupo_diario` | int | invitaciones por día; editable por cuenta. Default 40. |
| `objetivo_semanal` | int | default 200 |
| `sesion_wa` | enum | `activa` \| `caida` — WhatsApp se vincula por QR, aparte de LinkedIn |

Hay 10 slots fijos. Los no vinculados se muestran como `libre 7`…`libre 10`.

### 3.4 Lista de invitación

| Campo | Tipo | Notas |
|---|---|---|
| `id`, `nombre` | | |
| `cuenta_id` | fk Cuenta | una lista pertenece a una cuenta |
| `fuente` | enum | `Sales Navigator` \| `CSV importado` |
| `prioridad` | int | 1 es la más alta |
| `paginas_total` | int | |
| `pagina_actual` | int | hasta dónde llegó el script. **Dato de la automatización: se muestra, no se edita a mano.** |
| `perfiles_por_pagina` | int | 25 en Sales Navigator |

Derivados: `restantes = (paginas_total − pagina_actual) × perfiles_por_pagina`; estado `agotada` (sin páginas), `en uso` (la de mayor prioridad con páginas), `en espera`.

### 3.5 Mensaje / plantilla (repositorio)

| Campo | Tipo | Notas |
|---|---|---|
| `id`, `nombre` | | el nombre `R{n} · …` es lo que ata la plantilla al paso de la cadencia. Ver §5.2. |
| `textos` | map<idioma, text> | `es`, `pt`, `en`; pueden faltar |
| `destacado` | enum/string | `null` \| `"todas las cuentas"` \| lista de abreviaturas (`"AL, DL"`) |
| `orden` | int | reordenable |

Variables que se reemplazan al resolver una plantilla: `{nombre}` (primer nombre), `{empresa}`, `{industria}`, `{ciudad}`, `{tema}`. Si un campo está vacío se usa un genérico según idioma (`su planta` / `sua planta`).

### 3.6 Asignación de leads

`asignacion: { lead_id → usuario_id }`.

Reglas cerradas:
- Los leads son **compartidos**: el administrador siempre ve todos. No existe "devolver un lead al administrador" como operación necesaria.
- Un lead sin asignación explícita pertenece al administrador.
- Un lead creado por un usuario (entrante de WhatsApp, importación de CSV) queda asignado a quien lo creó.

### 3.7 Tarea

`{ id, nombre, etiquetas[], prioridad 1–5, inicio, fin, notas, notificar, hecha }`. Independiente del lead (no hay FK obligatoria).

### 3.8 Regla (motor de automatización)

`{ id, nombre, disparador, condicion?, accion, activa, corridas_semana }`.

Disparadores: se agrega una etiqueta · el lead responde · la reunión queda en no asistió · N días sin actividad · entra un lead nuevo.
Condiciones: sin condición · de una cuenta · de un país · en una etapa.
Acciones: fijar próximo contacto · cambiar la etapa · asignar a un colaborador · cargar mensaje a la cola · crear una tarea.

Dos reglas vienen de fábrica y no se borran (se pueden apagar): ver §5.9.

### 3.9 Etiqueta

`{ nombre, editada_en }`. Catálogo libre, sin colores por etiqueta. Ejemplos en uso: `Caliente`, `Tibio`, `Frío`, `Decisor`, `Contacto`, `Recordatorio`, `Reagendar`, `Periodico`, `No target`, `Fase 2`, más etiquetas de segmento (`MX Norte`, `Compras SP`).

### 3.10 Registro de actividad

`{ ts, usuario_id, tipo, accion, sobre_lead_id?, canal? }`. Tipos: `sesion`, `envio`, `edicion`, `reunion`, `permiso`. **Retención 90 días.**

### 3.11 Base compartida (perfiles ya invitados)

Tabla única de todos los perfiles que alguna cuenta ya invitó, para no pisarse entre cuentas: `{ nombre, link_perfil, rol, empresa, web, industria, pais, ciudad, resumen, cuenta, etapa, ultimo_r, duplicado_en[] }`. `duplicado_en` lista las otras cuentas que tienen el mismo perfil.

### 3.12 Chat personal y entrante

- **Chat personal**: `{ id, nombre, telefono, mensajes[], no_leido }`. Amigos y familia. No es un lead.
- **Entrante**: `{ id, telefono, texto, recibido_en }` — mensaje de un número sin clasificar. Ver §5.8 para el ruteo.

---

## 4. Estructura de la aplicación

Una sola aplicación web, un header fijo de 44 px y tres secciones principales más overlays.

```
Header (44 px, siempre visible)
├── Switch de canal de conversación: in {n} / wa {n}
├── Tabs de sección: Automatizaciones · Follow-up · WA Personal · Usuarios
├── Subtabs (solo en Follow-up): Follow Up {n} / Sin leer {n}
└── Acciones (derecha): ··· · vencimientos · repositorio · tareas ·
    notificaciones · agenda · tema · sesión

Secciones
├── Automatizaciones   (pestañas: Invitaciones / Cancelación / Seguimiento)
├── Follow-up          (columna 1: lista · columna 2: ficha · sidebars)
├── WA Personal        (lista de chats + chat + entrantes)
└── Usuarios           (pestañas: Usuarios / Actividad)   [solo con permiso]

Overlays (pantalla completa o panel)
├── Vencimientos de mensajes
├── Base compartida
├── Repositorio de mensajes (sidebar arrastrable)
├── Agenda (sidebar arrastrable)
├── Tareas (popover)
├── Reglas y acciones rápidas (panel)
├── Cuentas conectadas / QR (panel)
├── Notificaciones (popover)
├── Atajos de teclado (popover)
└── Cambios sin guardar (modal de confirmación)
```

Qué tabs y qué iconos ve cada usuario se calcula desde sus permisos (§6), no desde su rol.

---

## 5. Reglas de negocio

Esta sección es la parte del manual que no se puede inferir de la interfaz. Implementarla exacta.

### 5.1 Cadencia R0–R8

| Paso | Nombre | Canal | Espera hasta el siguiente |
|---|---|---|---|
| R0 | Invitación | LinkedIn (con o sin nota) | — (arranca al aceptar) |
| R1 | Primer contacto | LinkedIn | 15 días |
| R2 | Seguimiento corto | LinkedIn | 15 días |
| R3 | Caso concreto | LinkedIn | 21 días |
| R4 | Pedir el decisor | WhatsApp si hay teléfono, si no LinkedIn | 28 días |
| R5 | Reapertura fase 2 | LinkedIn | 15 días |
| R6 | Seguimiento fase 2 | LinkedIn | 15 días |
| R7 | Caso concreto fase 2 | LinkedIn | 21 días |
| R8 | Último intento fase 2 | WhatsApp si hay teléfono | 28 días |

- La espera se cuenta **desde el envío del paso anterior**, no desde la respuesta.
- Los nombres de los pasos y las esperas son **editables por el usuario** en Automatizaciones → Seguimiento. Guardarlos como configuración, no como constantes.
- Cada paso se puede **pausar** individualmente. Un paso pausado no dispara envíos y el lead queda esperando.
- Después de R4 sin respuesta el lead pasa a **Fase 2**: el próximo contacto se corre **90 días** y al volver retoma en R5.
- Después de R8 sin respuesta el lead termina la cadencia (queda en Fase 2 sin próximo paso automático).
- Si el lead responde en cualquier punto, la cadencia automática se detiene: el seguimiento pasa a ser manual desde la ficha.

### 5.2 De dónde sale el texto de cada paso

Un solo lugar de verdad: el **repositorio de mensajes**. La automatización busca la plantilla cuyo nombre empieza con `R{n} · `. Si no existe, el paso no tiene texto y hay que avisarlo, no inventarlo.

El nombre del paso en Automatizaciones es una etiqueta de ese panel; el texto siempre viene del repositorio.

### 5.3 Cupos y ventana de envío de invitaciones

- El **cupo diario es por cuenta** (default 40, editable). No hay cupo global.
- El script trabaja la lista de **mayor prioridad que todavía tenga páginas**; cuando se agota, pasa a la siguiente automáticamente.
- El objetivo semanal por cuenta es 200 invitaciones. El contador se resetea los **lunes 00:01**.
- Una cuenta con sesión caída queda en **cero** y sus envíos se acumulan; hay que avisarlo en la interfaz (chip "sesión caída" + tarea automática sugerida).

### 5.4 Cancelación y recontacto

- Invitación sin aceptar durante **90 días** (configurable) → se cancela, para liberar el límite de invitaciones pendientes de LinkedIn.
- El lead cancelado espera **60 días** (configurable) y vuelve a la cola con etapa **Recontacto** y la plantilla de reinvitación.
- Tope de cancelaciones por día y por cuenta: **30** (configurable), para no hacer un movimiento masivo sospechoso.
- La interfaz tiene que poder responder: cuántos leads cancelados cumplen la espera **hoy**, **esta semana** y **la próxima**, por cuenta.

### 5.5 Métricas y analítica

Lo que el sistema tiene que poder calcular (los datos de §3.2 alcanzan para todo esto):

- **Por cuenta y por semana**: invitaciones enviadas, aceptadas, conversión de la semana cerrada, avance contra el objetivo de 200.
  - *Aceptadas* se cuenta por **fecha de aceptación**, no de envío: una aceptación de esta semana puede venir de una invitación de hace un mes. Es una diferencia que confunde si no se aclara en la vista.
- **Por paso R**: cuántos leads tocan hoy, cuántos se enviaron, cuántas respuestas, tasa de conversión. En R0 la "conversión" es la aceptación de la invitación, no una respuesta: marcarla distinto.
- **Cuándo responden**: distribución de respuestas por día de semana y franja horaria.
- **Qué perfiles convierten**: reuniones concretadas por cargo.
- **Qué industrias convierten**: reuniones sobre aceptaciones por industria.
- **Qué variante convierte** (habilitado por `historial_envios.plantilla_id` + `texto`).
- **Qué páginas de qué listas rinden** (habilitado por `pagina_origen`).
- **Si la nota en R0 mejora la aceptación** (habilitado por `nota_r0`).

### 5.6 Idioma sugerido

Se deduce del país del lead:

- `pt` — Brasil (`BR`), Mozambique (`MZ`)
- `es` — Argentina, México (`MX`), Uruguay, Chile, Colombia, Perú, Paraguay, Bolivia, España
- `en` — cualquier otro

Se aceptan códigos ISO-2 y nombres completos, porque los CSV llegan de las dos formas. El idioma es una **sugerencia**: el usuario puede cambiarlo al escribir.

### 5.7 Normalización de teléfono

Al guardar un teléfono se le agrega el código de país según el país del lead: Brasil 55, México 52, Argentina 54, Uruguay 598, Chile 56, Colombia 57, Perú 51, Paraguay 595, Bolivia 591, Mozambique 258, Portugal 351, España 34.

Con teléfono cargado, la ficha muestra un acceso directo al chat de WhatsApp de ese número (`wa.me/<solo dígitos>`). Sin teléfono, las acciones de WhatsApp quedan **deshabilitadas, no ocultas**.

### 5.8 Ruteo de WhatsApp entrante

Cuando llega un mensaje de un número desconocido:

1. **Si los últimos 8 dígitos coinciden con un lead ya cargado** → el mensaje entra **solo al follow-up**: el lead pasa a `sin_leer` con chip `wa`. En WA Personal solo se muestra el aviso "Ya estaban en la base" con acceso a la ficha. No se crea nada nuevo.
2. **Si no coincide** → queda como entrante en WA Personal con tres salidas:
   - **Mover a FU**: crea el lead y salta a Follow-up → Sin leer.
   - **Es personal**: se queda como chat personal.
   - **Agendar**: pide nombre y lo guarda en la agenda.
3. Un chat personal que después resulta de trabajo se pasa con **Mover a FU** desde el encabezado del chat (y también desde la fila de la lista).

Decisión cerrada: **las conversaciones de leads no viven en WA Personal.** Están en la ficha y en la columna 1 del follow-up.

### 5.9 Reglas de fábrica

Dos, que se pueden apagar pero no borrar:

1. **La etiqueta `Contacto` sugiere el próximo R.** Si el lead tiene la etiqueta `Contacto` y no tiene ninguna etiqueta en conflicto (`Reunión`, `Esperando confirmación`, `Aprobación del presupuesto`), el sistema propone el siguiente R en el chat.
2. **Enviar un R agrega la etiqueta `Recordatorio`** si todavía no la tiene.

### 5.10 Al enviar un mensaje desde la ficha

El envío es una operación compuesta. Todo esto pasa en un solo paso:

1. Se registra la entrada en `historial_envios` (paso, timestamp, canal, plantilla, idioma, texto).
2. Se agrega la etiqueta `Recordatorio` (regla de fábrica).
3. Si el paso empuja a Fase 2, se agrega la etiqueta `Fase 2`.
4. Se **propone** la próxima fecha de contacto según la cadencia — el usuario la acepta o la carga a mano. No se fija sola.
5. Todo lo anterior entra a la pila de deshacer como una sola edición.

### 5.11 Alrededor de la reunión

- Recordatorio configurable: ninguno / 2 / 3 / 4 horas antes.
- Confirmación 24 h antes y aviso 1 h 30 antes de la reunión (activables).
- Agradecimiento post reunión cuando el estado pasa a `asistio`.
- Estas tres viven en **Reglas y acciones rápidas**, no en Automatizaciones.

---

## 6. Permisos y roles

### 6.1 Las 19 claves de permiso

Cuatro grupos. Las cuatro últimas se separaron de los roles el **08/09/2026**:
§10.24 pide que el Observador no vea datos de contacto, y §10.13 pide poder
decidir cualquier permiso **por persona**. Con la visibilidad metida adentro del
rol, «que Vera no vea teléfonos» sólo se podía resolver inventándole un rol.

**Secciones**

| Clave | Qué habilita |
|---|---|
| `followup` | Sección Follow-up |
| `waPersonal` | Sección WA Personal |
| `control` | Sección Control (proyectos y dashboard de reuniones) |
| `automatizaciones` | Sección Automatizaciones + panel de reglas |
| `usuarios` | Usuarios y permisos + reasignar leads |

**Herramientas**

| Clave | Qué habilita |
|---|---|
| `colaEnvios` | Ver la cola de envíos |
| `importarLeads` | Importar CSV y carga masiva de teléfonos |
| `vencimientos` | Vencimientos de mensajes |
| `repositorio` | Repositorio y mensajes destacados |
| `baseCompartida` | Base compartida de perfiles invitados |
| `cuentasConectadas` | QR y vincular números |
| `tareas` | Lista de tareas |
| `agenda` | Agenda propia y la del admin como ocupado |

**Alcance y acciones**

| Clave | Qué habilita |
|---|---|
| `verTodosLeads` | Sin esto, sólo ve los leads en los que figura |
| `enviarMensajes` | Redactar y enviar desde la ficha |

**Visibilidad de datos sensibles**

| Clave | Qué habilita |
|---|---|
| `verTelefono` | El número y el botón de WhatsApp |
| `verEmails` | Los correos de la ficha |
| `verLinks` | El perfil de LinkedIn y el hilo del chat |
| `verConversaciones` | El hilo de mensajes |

Follow-up y WA Personal dejaron de ser secciones fijas: son permisos como el
resto. Es lo que permite que un rol se quede sin ellas.

### 6.2 Resolución del permiso

El rol es un **preset**, no una jaula:

```
puede(usuario, clave):
  si usuario.permisos tiene la clave explícita  → ese valor
  si el preset del rol la incluye               → true
  en otro caso                                  → false
```

En la ficha del usuario cada permiso se muestra como «por rol» o «editado», con
un botón para volver al preset del rol (que es borrar los overrides).

**Pendiente (08/09/2026):** hoy los presets están en el código. Augusto pidió
poder **editar el preset de cada rol** desde la pantalla de Usuarios, para que
al invitar a alguien como Colaborador ya se sepa qué trae. El ajuste por
persona seguiría funcionando igual, encima del preset.

### 6.3 Qué implica ser Colaborador (con el preset por defecto)

Ve: Follow-up, WA Personal, tareas, agenda, y sólo sus leads (en la lista, en
vencimientos y en notificaciones).

No ve: automatizaciones, base compartida, vencimientos, repositorio y mensajes
destacados, cuentas conectadas/QR, cola de envíos, importar CSV, enviar
mensajes.

**Agenda del colaborador**: sus reuniones, más las de cada administrador como
bloques **Ocupado** sin nombre ni detalle. Un switch elige qué calendario mira:
*Mi calendario* o *Calendario de {admin}* — un ítem por administrador. Al
agendar, elige a qué calendario va la reunión, y la disponibilidad suma los
días tomados de ese calendario.

### 6.3.1 El Observador, y el alcance de Control

El Observador entra **sólo a Control**: proyectos, reuniones y la lista de
leads que confirmaron interés. No ve Follow-up, ni la prospección, ni datos de
contacto — nombre, cargo, empresa, industria y lugar sí; teléfono, email y
links no (§10.24).

**El alcance de Control tiene tres formas** (decidido el 08/09/2026):

| Alcance | Quién | Qué ve |
|---|---|---|
| **Todo** | Administrador | Las dos casas, todas las cuentas |
| **Por casa** | El partner de una empresa propia | Sólo Globalita, o sólo Seng |
| **Por cuenta** | El dueño de una cuenta de invitación | Sólo lo que salió de su cuenta, **con todos los datos** |

Las dos primeras ya estaban. La tercera es nueva y sale de un caso concreto:
*Bruno Rocha, dueño de su cuenta, quiere ver lo mismo que ve Alejandro en
Control pero sólo de su cuenta*. Es también la respuesta a la pregunta que
quedó abierta sobre *«la parte de reuniones que aplica sólo al perfil de
Alberto Córdoba»*: es el mismo mecanismo, Alberto acotado a la cuenta AL.

**La diferencia que importa**: el partner por casa **no ve datos de contacto**
—no es su gente—; el dueño de cuenta **sí**, porque son sus propios leads.

El alcance es un dato del usuario, no un permiso: los permisos son sí/no y esto
es un recorte. Hoy existe `users.linea_control` (la casa); falta el equivalente
por cuenta.

**El alcance se aplica en el servidor**, nunca al dibujar: las reglas de la base
filtran las filas y las vistas recortan las columnas. Que una pantalla no
muestre un dato no sirve de nada si el dato llegó al navegador.

### 6.4 Ver el CRM como otro usuario

Un administrador puede entrar a la vista de un colaborador desde el chip de sesión. No persiste entre recargas; "Volver a mi usuario" regresa. Es una herramienta de soporte, no una suplantación auditada (aunque conviene registrarla en el log de actividad).

### 6.5 Asignación: responsable y acompañantes

Un lead puede estar asignado a **más de una persona** (decidido el
08/09/2026). No son iguales:

- **Responsable**: uno solo. Es el que aparece en la columna 1, donde hay lugar
  para un chip, y el que responde por el seguimiento.
- **Acompañantes**: los que también lo trabajan y lo ven en su lista.

§3.6 sigue valiendo: un lead sin asignación explícita pertenece al
administrador, y el administrador ve todos siempre.

Con esto, la regla de `verTodosLeads` pasa a leerse *«sin esto sólo ve los
leads en los que figura»* — como responsable o como acompañante.

En la lista y en la ficha, tocar el chip del agente abre la lista de gente para
asignar. Cuando son varios, se muestra un icono y el detalle al pasar por
encima.

### 6.6 Asignación masiva

Panel "Asignar en lote" en Usuarios:
- Filtros combinables: cuenta (chips con el conteo de cada una), país, ciudad, industria — los tres últimos son **checklists multi-selección**, no selects de un valor.
- Buscador por nombre, empresa y cargo.
- "Seleccionar los N que coinciden" alcanza a **todos** los que pasan el filtro, no solo a los visibles en pantalla.
- Check por fila para el uno por uno.
- La ficha del usuario muestra el reparto por cuenta (`AL 3 · DL 12`).

### 6.7 Login y sesión

- Usuario/email + contraseña.
- "Mantener la sesión abierta" persiste la sesión localmente; si no, la sesión muere al cerrar.
- Cerrar sesión desde el chip de sesión en el header.

---

## 7. Pantalla por pantalla

### 7.1 Header

Alto fijo 44 px, nada envuelve a una segunda línea (`flex-shrink: 0`, sin `flex-wrap`). Iconos de 28 px.

- **Switch de canal** (`in {n}` / `wa {n}`): elige en qué canal se abre la conversación del lead activo. LinkedIn en azul, WhatsApp en verde.
- **Tabs de sección**, filtradas por permisos.
- **Subtabs de Follow-up**: `Follow Up {total}` / `Sin leer {n}`.
- **Sueltos a la derecha**: vencimientos (con badge de cuántos), repositorio, tareas, notificaciones (badge con el total sin leer entre Follow-up y WA Personal), agenda, tema, chip de sesión.
- **Menú `···`**: cuentas conectadas, base compartida, reglas y acciones rápidas, atajos de teclado.
- **Tema**: ciclo claro → oscuro → **noche** (cálido, menos contraste, para trabajar de noche).

### 7.2 Follow-up

Tres columnas, las dos últimas opcionales.

**Columna 1 — lista de contactos** (ancho arrastrable 260–520 px, doble clic alterna 260/340, persistido):

- Buscador por nombre, empresa, teléfono, ciudad.
- Importar CSV (con permiso).
- Filtros en popover: próximo contacto (todos / solo vencidos) y orden, WhatsApp (con/sin), reunión (con / sin / asistió / no asistió), rol, país, ciudad, etiquetas. El botón muestra cuántos filtros hay activos y cuántos leads quedan.
- Chips de cuenta (`todas`, `AL`, `DL`, …).
- Chips de colaborador (**solo para el administrador**): todos / cada colaborador activo. Cada lead asignado muestra un chip chico con el nombre del colaborador.
- Últimos leads editados, como accesos rápidos.
- La lista, por fila: **nombre de la persona** (sin el cargo que LinkedIn deja
  pegado; el completo va en el `title`), **la cuenta de la que salió**,
  próximo contacto, fecha de reunión con color según estado (verde asistió,
  rojo no asistió, neutro pendiente), **el último mensaje enviado** —el R si
  fue de la cadencia, `FU` si fue suelto—, **las etiquetas**, el **icono de
  WhatsApp** cuando hay teléfono, y el **agente**. Los entrantes sin leer salen
  con borde ámbar y etiqueta «nuevo».
- **Lo que no entra, se despliega al pasar por encima.** Con muchos agentes o
  muchas etiquetas la fila no alcanza: se muestra un icono y el detalle en el
  hover. De las etiquetas se puede **elegir cuáles se ven y en qué orden**
  cuando entran dos o tres.
- **Escala**: la lista renderiza 80 leads y suma de 80 en 80 al acercarse al final del scroll. Si se selecciona un lead fuera de la ventana visible, la ventana se expande antes de hacer scroll a él. Con 1.500+ leads no hay paginado visible.
- Al pie: cola de envíos (con permiso), con cuenta regresiva del próximo envío.
- Arriba de todo, cuando está abierta: la **conversación** del lead activo, en el canal que elige el switch del header.

**Columna 2 — ficha del lead** (mínimo 440 px):

- Encabezado: nombre, cuenta, etapa, links (perfil, chat), botón verde de WhatsApp si hay teléfono, chip "Asignado a" (reasignable, con opción *sin asignar*), botón de deshacer, botón de acciones rápidas.
- Bloques colapsables: **Datos · Contacto · Fecha de reunión · Análisis del
  perfil**.

  > **Cambio del 08/09/2026.** Antes eran seis: Etiquetas y Log de ediciones
  > estaban en la lista. Volvieron a ser **iconos junto al perfil**, en el
  > encabezado. La razón es de uso, no de gusto: los dos se consultan de
  > refilón mientras se trabaja el lead —qué etiquetas tiene, qué se le tocó—
  > y como bloques empujaban hacia abajo Enviar mensaje, que es lo que se usa
  > todo el día. El icono del log **reemplaza al tooltip** del perfil.

- El icono de **Etiquetas** agrega y **quita del lead** (nunca borra del
  catálogo: eso se hace en el panel de etiquetas).
- **Enviar mensaje**:
  - **El switch de canal decide por dónde sale.** LinkedIn o WhatsApp: lo que
    se elige es lo que se manda. No es una etiqueta de lo que va a pasar.
  - **La secuencia, no un desplegable de paso.** Una fila `R0 ✓ · R1 ✓ · R2`
    donde lo tildado ya se mandó y lo que falta se ve solo, cada uno con **el
    idioma en que salió**. El que toca es el primero sin tilde.
  - Chips de mensajes destacados (reemplazan el texto, arrastrables para
    reordenar).
  - «Destacar mensajes»: checklist sobre todos los mensajes del repositorio.
  - «Guardar»: crea el mensaje en el repositorio y después pregunta si cargarlo
    en otro idioma y si destacarlo.
  - `↗ Ir al chat` **al lado del título** del bloque.

  > **Cambio del 08/09/2026.** Se sacaron el botón «Copiar» y los tres textos
  > de ayuda del pie («al registrar se agregan…», «el CRM no manda el
  > mensaje…», «el envío automático llega con el worker»). Se leen una vez y
  > después son ruido en el lugar donde se trabaja todo el día.
- **Acciones rápidas** (rayo): todas las acciones del lead agrupadas — ficha (guardar, deshacer), contacto (enviar, cambiar canal, abrir el chat real, ver perfil), seguimiento (próximo contacto, reunión, análisis), asignación. Cada una con su atajo.
- **Edición**: los campos se ven en vivo mientras se editan (no se ocultan hasta guardar). Toda edición apila su estado anterior; guardar limpia la pila.

**Sidebars** (una a la vez): Agenda (ancho 340–900) y Repositorio de mensajes (300–620). Las dos arrastrables, con doble clic para volver al ancho normal, persistido.

### 7.3 Automatizaciones

Columna izquierda con tres pestañas; columna derecha fija.

**Invitaciones** — las 10 cuentas. Cada fila: abreviatura, estado de sesión, resumen de listas, cupo diario editable, avance semanal. Se despliega y muestra sus listas con prioridad (flechas para reordenar), última página vista (dato de la automatización, no editable), perfiles restantes estimados y chip *agotada / en uso / en espera*.

**Cancelación** — los tres números configurables (días sin aceptar, espera de recontacto, tope por día y cuenta) y la tabla "Vuelven a la cola de envío" por cuenta (hoy / esta semana / la próxima) con el total listo para reinvitar.

**Seguimiento** — cadencia R1–R8 con nombre y espera editables y on/off por paso; **Rendimiento por R** (toca / enviados / respuestas / tasa en barra); tres tarjetas de análisis: cuándo responden, perfiles con más reuniones, industrias que más convierten.

**Columna derecha (fija)** — "Sale hoy" **por cuenta** (invitaciones / seguimiento / cancelaciones) y métricas semanales por cuenta (enviadas, aceptadas, conversión de la semana anterior, objetivo).

Arriba de todo: un botón global **en marcha / todo en pausa**.

### 7.4 WA Personal

Solo amigos y familia. Lista de chats (con punto ámbar en los no leídos y botón "Mover a FU" en cada fila), chat abierto con su encabezado y "Mover a FU", y la bandeja de entrantes desconocidos con las tres acciones de §5.8. Los entrantes que resultaron ser leads ya cargados aparecen solo como aviso "Ya estaban en la base".

Sin botón "Ignorar" y sin etiqueta "Personal" en la lista: la pestaña ya implica que es personal.

### 7.5 Usuarios (con permiso `usuarios`)

Dos pestañas.

**Usuarios**: lista con rol, estado y último acceso; alta por invitación (link por email → queda `pendiente`; contraseña temporal → entra `activo`), suspender/reactivar, baja, reenviar invitación. La ficha del usuario muestra rol, tabla de los 12 permisos con su origen (por rol / editado), leads asignados (con cruz para quitarlos y buscador para agregar), reparto por cuenta, y el panel "Asignar en lote".

**Actividad**: cuándo, usuario, acción, sobre qué lead y canal, con filtro por usuario. Registra ingresos, envíos, ediciones de ficha, reuniones y cambios de permisos. Retención 90 días.

### 7.6 Agenda

> **Cambio del 08/09/2026.** La referencia de comportamiento pasa a ser
> **Google Calendar**: arrastrar, estirar y ver la duración tienen que
> funcionar como ahí. En particular el bloque **mide lo que dura** y puede
> cruzar la hora siguiente — un evento de media hora a las 10:45 llega a las
> 11:15 —, y se estira desde el borde de abajo **en las tres vistas**, no sólo
> en la semanal.

Tres vistas.

- **Semanal** (default): lunes a sábado (domingo no se muestra), 8 a 20 h. La columna de hoy en color de acento, sábado en gris. Arrastre y resize sobre bloques de **15 minutos**; el evento se desplaza dentro de la celda según los minutos, así un movimiento a :15 / :30 / :45 se ve. Al arrastrar se pintan **todos los cuadros que abarca la duración** y el header muestra "soltar en HH:MM".
- **Diaria**: la misma grilla en un día, en filas de 15 minutos.
- **Lista**: una fila por lead con seguimiento — check de control, última reunión, próximo contacto editable, foto (se pega del portapapeles), cuenta y nombre, nueva reunión, notas, links, etiquetas. El filtro de check es una caja sin texto en tres estados: vacía (todos), con check (con check), con cruz (sin check).

**Hover del evento**: nombre, empresa, cuenta, hora y duración, estado, asistió / no asistió, pegar foto, notas, links, y dos campos para cambiar **hora y fecha**. No hay popup del evento: clic en el evento abre la ficha del lead. Los bloqueos de Google Calendar se muestran con el nombre del evento.

### 7.7 Vencimientos de mensajes

Overlay de a un lead por vez, con avance (`1 de 4`), para procesar los que vencen. Muestra: cuenta y nombre, salto de etapa (`R3 → R4`), cuánto falta o hace cuánto venció, etiquetas, dos tarjetas (**Vencimiento** y **Próximo contacto** con la regla de cadencia al lado), datos de contexto (empresa, ciudad, mensajes, último contacto), chips de mensajes destacados (pastillas chicas `R+nombre corto`), el mensaje que toca con su idioma detectado, y los botones **Saltar** / **Aprobar**.

### 7.8 Base compartida

Tabla única de perfiles ya invitados, con buscador, filtro por cuenta y etapa, marca de duplicados entre cuentas. Nombre y empresa son links directos (perfil de LinkedIn, página de la empresa). Columnas separadas de Lugar y Resumen. Doble clic en "último R" abre el historial R1→R4 debajo de la fila.

### 7.9 Repositorio de mensajes

Sidebar. Lista de plantillas con nombre, texto por idioma (ES/PT/EN), estrella de destacado con alcance (todas las cuentas o cuentas puntuales), orden arrastrable, alta y baja. **Cualquier edición se refleja al instante en Enviar mensaje, en Vencimientos y en Automatizaciones** — es el único lugar de verdad de los textos.

### 7.10 Otros paneles

- **Cuentas conectadas**: LinkedIn y WhatsApp por cuenta, con QR por cuenta y vincular otro número.
- **Tareas**: la fila es una grilla — check, nombre, fechas, vencimiento, etiquetas, alertas y prioridad en columnas rectas.
- **Reglas y acciones rápidas**: las reglas de §3.8 y §5.9 con on/off y corridas de la semana, alta de reglas nuevas (disparador → condición → acción) y los avisos alrededor de la reunión.
- **Notificaciones**: total sin leer entre Follow-up y WA Personal; al abrirlo lista cada uno con su canal (LI/WA) y salta a la ficha o a la pestaña.
- **Importar CSV**: reconoce países como código de 2 letras además del nombre completo; previsualiza y deja elegir qué filas entran.

---

## 8. Integraciones

### 8.1 LinkedIn

Es la integración crítica y la más frágil. No hay API pública para invitar y mandar mensajes: la implementación real es automatización de sesión (extensión de navegador o worker headless con la sesión del usuario).

Consecuencias que el diseño ya asume:
- Las sesiones **se caen** y hay que mostrarlo (`estado_sesion`), acumular los envíos y avisar.
- Los cupos diarios existen para no gatillar límites de la plataforma. Son configurables porque el límite real cambia.
- La cancelación de invitaciones a los 90 días existe para liberar el tope de invitaciones pendientes.
- Los envíos tienen que correr del lado del servidor/worker, no en la pestaña del usuario: **requisito**, la cola tiene que sobrevivir a que el navegador esté cerrado.

### 8.2 WhatsApp

Vinculación por **QR por cuenta** (sesión de WhatsApp Web). Se necesita:
- Estado de sesión por cuenta y aviso cuando cae.
- Recepción de entrantes y el ruteo de §5.8.
- Acks de mensaje (`enviado` / `entregado` / `leído`).
- Acceso directo a `wa.me/<número>` como salida de escape cuando conviene escribir a mano.

### 8.3 Google Calendar

- Las reuniones creadas en el CRM se escriben en el calendario del usuario elegido.
- Los eventos existentes del calendario se leen como **bloqueos** (con su nombre) para calcular disponibilidad.
- Cambiar hora, fecha o duración desde la agenda actualiza el evento (la interfaz confirma con "Calendar actualizado").
- Reenviar la invitación del evento al lead es una acción explícita.

### 8.4 CSV

Importación de leads con detección de país por código de 2 letras o nombre completo, y carga masiva de teléfonos.

### 8.5 Gmail

Decisión cerrada: queda como **estado de interfaz simple** (un toggle en WA Personal), sin pantalla de permisos ni elección de cuenta.

### 8.6 Nota sobre múltiples administradores

Nada en el modelo de calendarios debe asumir un solo administrador: la lista de calendarios se arma con un ítem por cada usuario con rol `Administrador`, y los bloques "Ocupado" que ve un colaborador se calculan **por administrador elegido** (las reuniones propias de ese admin, no las de terceros). Si se suma un segundo administrador, aparece solo.

---

## 9. Atajos de teclado y detalles de UX

### 9.1 Atajos

| Tecla | Acción |
|---|---|
| `A` | Guardar la ficha |
| `S` | Enviar el mensaje escrito |
| `D` | Abrir la fecha de próximo contacto |
| `R` | Abrir la fecha de reunión |
| `F` | Cambiar el canal de envío (LinkedIn / WhatsApp) |
| `G` | Abrir o cerrar la conversación |
| `H` | Abrir el chat real del canal elegido |
| `V` | Abrir el perfil de LinkedIn |
| `C` | Deshacer la última edición |
| `Z` | Deshacer (equivalente a `C`, desde el header del detalle) |
| `Ctrl+Z` / `Cmd+Z` | Deshacer la última edición |

Dentro del calendario de próximo contacto, `A S D F` pasan a ser 1, 2, 3 y 4 semanas.

Los atajos se ignoran cuando el foco está en un `input`, `textarea`, `select` o campo editable.

### 9.2 Deshacer y revertir

- Toda edición de la ficha apila su estado anterior.
- El botón **Deshacer** del header del detalle saca el último cambio; guardar limpia la pila.
- En el log de ediciones, los campos revertibles tienen su propio botón **revertir**.
- Un envío de mensaje (§5.10) entra como **una sola** edición, aunque toque varios campos.

### 9.3 Cambios sin guardar

Cambiar de sección o de lead con cambios pendientes dispara el aviso de "cambios sin guardar", con opciones de descartar o volver. Los campos se siguen viendo en vivo mientras se editan; lo que no puede pasar es cruzar de sección sin decidir qué hacer con lo pendiente.

### 9.4 Anchos arrastrables

Columna 1 (260–520), agenda (340–900) y repositorio (300–620). Cada uno con doble clic para volver al ancho normal y persistencia local.

### 9.5 Popovers

Los popovers grandes (filtros, próximo contacto, histórico) se posicionan con coordenadas calculadas desde el botón (`position: fixed`), para que no los recorte el scroll de la columna.

### 9.6 Color y temas

Tres temas: claro, oscuro y **noche** (cálido, menos contraste). El botón del header cicla claro → oscuro → noche.

Colores de marca fijos: LinkedIn azul, WhatsApp verde. En modo oscuro el acento se aclara para que el texto sobre acento mantenga contraste. Todo el color pasa por variables de tema; no hay colores sueltos.

### 9.7 Estados vacíos y deshabilitados

Preferir **deshabilitado con motivo** antes que oculto: WhatsApp sin teléfono se muestra tachado con el título "Sin teléfono cargado", no desaparece. Los permisos son la excepción: lo que un usuario no puede usar no se muestra.

---

## 10. Casos borde y decisiones ya tomadas

Estas son decisiones cerradas. Cambiarlas es rediseñar, no corregir.

1. **Los leads son compartidos.** El administrador ve todos siempre. No hay "devolver al administrador": reasignar es directo.
2. **Las conversaciones de leads no viven en WA Personal.** Están en la ficha y en la columna 1.
3. **Un entrante que coincide con un lead ya cargado no crea nada**: entra al follow-up y en WA Personal solo queda el aviso.
4. **La última página vista de una lista es un dato de la automatización**, no un campo editable.
5. **Las listas de invitación se reordenan con flechas, no con drag.** Son 2–3 ítems por cuenta; el drag no ahorra pasos y las flechas ya son accesibles por teclado y touch.
6. **Los textos de los R salen del repositorio**, nunca de constantes en el código de la automatización.
7. **Al enviar, la próxima fecha se propone, no se fija.** El usuario acepta o carga a mano.
8. **Gmail queda como toggle de interfaz**, sin flujo de permisos.
9. **El nombre del lead se guarda completo** aunque traiga el cargo adentro y mida 120 caracteres. Se trunca en la vista, nunca en el dato.
10. **Aceptadas se cuenta por fecha de aceptación**, no de envío. Aclararlo en la vista o el número se lee mal.
11. **Los cupos son por cuenta.** No existe un cupo global.
12. **Domingo no se muestra en la agenda.** Sábado sí, en gris.
13. **El rol es un preset de permisos, no una jaula.** Cualquier permiso se puede prender o apagar por usuario.
14. **Retención del log de actividad: 90 días.**
15. **Un lead que responde sale de la cadencia automática.** El seguimiento pasa a manual.
16. **La cola de envíos tiene que correr del lado del servidor.** Si depende de la pestaña abierta, el producto no funciona.

---

## 10.bis Transversales agregados el 08/09/2026

- **Traducción al portugués** de todo el CRM. El equipo trabaja con Brasil y
  parte de la operación se lee en portugués.
- **Los textos de la cadencia se administran en el repositorio**, que es el
  único lugar de verdad (§5.2). Desde cada paso de Automatizaciones tiene que
  haber una puerta que abra ese mensaje: hoy se administran donde corresponde
  pero no se ven desde donde uno los busca.

---

## 11. Orden sugerido de construcción

Cada etapa deja algo usable. El criterio del orden es: primero lo que hace que el equipo pueda trabajar aunque falte todo lo demás.

**Etapa 1 — El lead y su ficha.**
Modelo de Lead, Cuenta y Etiqueta. Login y sesión. Follow-up con columna 1 (lista, buscador, filtros) y columna 2 (ficha completa, edición con deshacer, log). Sin automatización: todo a mano. Con esto el equipo ya puede reemplazar la planilla.

**Etapa 2 — Los textos y el envío manual.**
Repositorio de mensajes con idiomas y destacados. Enviar mensaje desde la ficha, con registro en `historial_envios`. Conversaciones (LinkedIn y WhatsApp) en la ficha. Idioma sugerido y normalización de teléfono.

**Etapa 3 — El calendario.**
Reunión en la ficha, agenda con las tres vistas, integración con Google Calendar (escribir y leer bloqueos), estados de asistencia e historial de reuniones.

**Etapa 4 — La cadencia.**
Próximo contacto, cadencia R1–R8 configurable, Vencimientos de mensajes, cola de envíos del lado del servidor, reglas de fábrica. Acá el sistema empieza a empujar el trabajo en lugar de solo registrarlo.

**Etapa 5 — Las invitaciones.**
Cuentas de invitación, listas con prioridad y páginas, cupos por cuenta, R0, cancelación a 90 días y recontacto a 60. Es la etapa con más riesgo técnico (§8.1): conviene aislarla detrás de una interfaz de worker desde el principio.

**Etapa 6 — El equipo.**
Usuarios, los 12 permisos, asignación de leads, asignación masiva, calendarios por administrador, log de actividad.

**Etapa 7 — La medición.**
Métricas semanales por cuenta, rendimiento por R, análisis de cuándo responden, qué perfiles y qué industrias convierten, qué variante de mensaje rinde, qué páginas de lista rinden. Los datos ya se venían guardando desde la etapa 2, así que acá solo se leen.

**Transversal, desde el día uno:** los tres temas, los atajos, el aviso de cambios sin guardar, y el criterio de escala de la columna 1 (renderizar de a 80). Meterlos al final cuesta el triple.

---

## 12. Datos de demo del prototipo

El prototipo usa constantes estáticas con fecha fija: **hoy es 04/09/2026**. Sirven como semilla de pruebas.

- **6 leads** que cubren los casos interesantes: uno que respondió rápido y frenó por el área de compras (`Alexandre Jordão`, DL, R3); el más avanzado, con reunión agendada (`Wellington Abner Simoes`, AL, R2); uno que aceptó y nunca respondió, ya en Fase 2 (`Herik Pires`, FR); una decisora que escribió ella primero y espera respuesta (`María de los Ángeles Fernández Villagrán…`, ED, R1, nombre deliberadamente larguísimo para probar truncado); un referido que llegó por WhatsApp y ya tuvo la reunión (`Gonzalo Adrián Núñez`, AU, R4); y una que respondió tarde y no asistió (`Lucía Gonçalves`, AMU, R5).
- **6 cuentas vinculadas** de 10 slots. `AMU` con la sesión de WhatsApp caída y 3 envíos frenados: es el caso que prueba los avisos de sesión.
- **4 usuarios**: Alberto Córdoba (administrador), Sofía Ferrer (colaboradora activa), Bruno Etchart (pendiente), Vera Molina (suspendida).
- **10 plantillas** en el repositorio (R0–R8 más agradecimiento post reunión), con textos en español y algunos en portugués.
- **Base compartida** con 27.412 perfiles declarados y una muestra cargada, incluyendo duplicados entre cuentas.

---

## Registro de cambios

Lo que cambió después de la revisión congelada del PDF (08/09/2026). Cada línea
dice **qué** cambió y **por qué**, que es lo que hace falta para poder
discutirlo después.

### 08/09/2026 — decisiones de Augusto sobre la app andando

| § | Cambio | Por qué |
|---|---|---|
| 6.1 | Las claves pasan de 15 a **19**: se separan `verTelefono`, `verEmails`, `verLinks`, `verConversaciones` | §10.24 pide que el Observador no vea datos de contacto y §10.13 pide decidirlo por persona. Metido en el rol, «que Vera no vea teléfonos» obligaba a inventarle un rol |
| 6.2 | Los **presets de rol** se van a poder editar desde Usuarios | Al invitar a alguien como Colaborador hay que saber qué trae, sin mirar el código |
| 6.3.1 | El alcance de Control suma **por cuenta**, además de por casa | El dueño de una cuenta quiere ver Control como lo ve el partner, pero sólo lo suyo — y **con** datos de contacto, porque son sus leads |
| 6.5 | Un lead puede tener **responsable y acompañantes** | Varias personas trabajan el mismo lead; la columna 1 tiene lugar para un chip, así que uno responde y el resto acompaña |
| 7.2 | Etiquetas y Log de ediciones vuelven a ser **iconos**, no bloques | Como bloques empujaban Enviar mensaje hacia abajo, que es lo que se usa todo el día |
| 7.2 | El **switch de canal manda de verdad**, y el paso se muestra como **secuencia con tildes** | El desplegable decía qué paso tocaba pero no dejaba elegir el canal; la secuencia muestra de un vistazo qué se mandó y qué falta |
| 7.2 | La lista muestra cuenta, último mensaje (R o `FU`), etiquetas, WhatsApp y agente; lo que no entra va al hover | Con 1.500 leads la fila decide si hay que abrir la ficha o no |
| 7.6 | La agenda se comporta **como Google Calendar** | Es el patrón que el equipo ya tiene en la mano |
| 7.11 | **Administrador de estados** de proyecto, con nombre y significado | Los estados los lee gente que no los definió; la leyenda tiene que salir del mismo lugar donde se escriben |
| 10.bis | **Portugués** | Parte de la operación se lee en portugués |

### Pendiente de decisión

- **El alcance de los mensajes destacados** (§3.5). Hoy es por cuenta; hace
  falta que sea por **casa** con excepción por cuenta. Sin resolverlo, cada
  cuenta nueva hay que agregarla a mano en cada mensaje.
- **Si Seng puede tener «Parcería»** (§3.13). Si sí, la casa deja de deducirse
  de la etiqueta y hay que elegirla aparte.

### Nota sobre las secciones todavía sin sincronizar

Este archivo venía de una revisión anterior al anexo de Control. Las secciones
**§3 (modelo), §5 (reglas), §7.3–7.10, §8, §9, §10 y §12** siguen como estaban
y el PDF del 08/09 es más nuevo en varias de ellas. Sincronizarlas está anotado
en `docs/PENDIENTES.md`; lo de arriba es lo que cambió **por decisión**, que es
lo que no está en ningún otro lado.
