# CRM de prospección — manual del producto

Este archivo es **el documento**. No hay un segundo lugar donde mirar: las
reglas de negocio, el modelo de datos, lo que hace cada pantalla, los permisos,
las integraciones, la operación y las decisiones ya cerradas están todas acá.

> **Por qué uno solo.** Hasta el 08/09/2026 lo mismo estaba escrito en el
> manual, en el anexo de Control, en treinta notas del vault y en dos informes
> de auditoría. No se desincronizaron en teoría: se desincronizaron de verdad —
> el modelo de datos del manual describía una tabla `lead` que ya no existía, y
> un documento de auditoría afirmó dos veces cosas falsas sobre el propio
> sistema. Un solo archivo no evita equivocarse; evita **equivocarse en un lugar
> y tener razón en otro**, que es lo caro.

Lo que queda afuera, a propósito:

| Archivo | Qué es | Por qué no está acá |
|---|---|---|
| `docs/PENDIENTES.md` | La lista de trabajo | Cambia todos los días. Mezclarla haría que la especificación parezca inestable |
| `docs/_bundle/CRM de prospeccion.html` | El prototipo | Es la fuente de verdad **visual**. Se lee con `node docs/desempacar.mjs` |
| `docs/manual-original.pdf` | La revisión congelada del 08/09/2026 | Es el histórico. Donde diga algo distinto de este archivo, **manda este archivo** |
| `docs/prototipo/ESTRUCTURA-Y-DECISIONES.md` | Por qué el prototipo es como es | Sale del bundle, se regenera; no se edita a mano |
| `apps/web/public/design-tokens.css` | Los colores y las medidas | Son código, no documentación. Copiarlos acá sería crear la segunda copia otra vez |

**La jerarquía, cuando dos cosas parecen contradecirse:**

| Fuente | Manda en |
|---|---|
| Este archivo | las **reglas**: modelo, cadencia, permisos, alcances, integraciones |
| El prototipo (`.dc.html`) | lo **visual y el comportamiento**: medidas, densidad, flujos |
| `design-tokens.css` | los **valores**: color, tema |

Si algo del prototipo no se puede construir todavía porque depende de datos que
no existen, **se omite y se anota** — no se reemplaza por una versión inventada.

**El stack queda a criterio de quien implemente.** Donde una decisión técnica
está forzada por el negocio —por ejemplo: los envíos tienen que sobrevivir a que
el navegador esté cerrado— está marcada como requisito, no como sugerencia.

---

## Índice

| § | Qué hay |
|---|---|
| 1 | De qué trata el proyecto, y qué NO es |
| 2 | Glosario |
| 3 | Modelo de datos (3.13: el proyecto) |
| 4 | Estructura de la aplicación |
| 5 | Reglas de negocio |
| 6 | Permisos, roles y alcances |
| 7 | Pantalla por pantalla (7.11: Control) |
| 8 | Integraciones |
| 9 | Atajos y detalles de UX |
| 10 | Casos borde y decisiones ya tomadas |
| 11 | Orden de construcción |
| 12 | Datos de demo |
| 13 | Operación: deploy, backups, riesgo, la base de desarrollo |
| 14 | Las decisiones, una por una |
| 15 | Registro de cambios |

---

## 1. De qué trata el proyecto

Es un CRM de prospección saliente en LinkedIn y WhatsApp para un equipo chico (hoy 1 administrador y 3 colaboradores) que vende servicios industriales en LATAM y Brasil.

El trabajo real que hace el equipo, y que el sistema tiene que sostener:

1. **Invitar.** Se manejan hasta 10 cuentas de LinkedIn en paralelo. Cada cuenta recorre listas de Sales Navigator (o CSV importados) página por página y manda invitaciones de conexión, con un cupo diario por cuenta. Ese primer paso se llama **R0**.
2. **Seguir.** Cuando alguien acepta la invitación, entra en una cadencia de mensajes numerados **R1 a R8**, con esperas fijas entre paso y paso. Los R4 y R8 pueden salir por WhatsApp si el lead tiene teléfono cargado.
3. **Cancelar y reciclar.** La invitación que nadie acepta se cancela a los 90 días (para liberar el cupo de invitaciones pendientes de LinkedIn), el lead espera 60 días y vuelve a la cola como **Recontacto**.
4. **Agendar.** El objetivo de toda la cadencia es una reunión. La reunión se agenda desde la ficha del lead, se refleja en la agenda del sistema y se sincroniza con Google Calendar.
5. **Repartir.** El administrador reparte leads entre colaboradores. Cada colaborador ve sólo los leads en los que figura; el administrador ve todo.
6. **Controlar.** Cuando la prospección avanzó, se abre un **proyecto**, y el trabajo pasa a seguirse en Control (§7.11). Es la capa de arriba del lead, y es lo único que ve un socio de afuera del equipo.

Volumen que el sistema tiene que soportar sin degradarse: **27.000+ perfiles** en la base compartida, **1.500+ leads activos** en follow-up, **200 invitaciones por semana por cuenta** × 10 cuentas.

### 1.1 Qué NO es

- No es un CRM de ventas completo: no hay pipeline de oportunidades, ni cotizaciones, ni facturación. El objeto central es el **lead** y su avance por la cadencia, no el deal.
- No es una bandeja de entrada unificada. Las conversaciones de leads viven en la ficha del lead. WhatsApp personal (amigos y familia) es una pestaña aparte y deliberadamente separada.
- No es multi-empresa/multi-tenant. Es una instalación para un equipo — aunque ese equipo trabaje para **dos empresas propias**, Globalita y Seng (§6.3.1).

---

## 2. Glosario

| Término | Significado |
|---|---|
| **Perfil** | La persona. Identidad única, compartida por las 10 cuentas: nombre, empresa, cargo, teléfono, foto. |
| **Lead** | El trabajo de **una cuenta** con un perfil. La misma persona puede ser lead de dos cuentas a la vez, y son dos leads. |
| **Cuenta** (o cuenta de invitación) | Perfil de LinkedIn desde el que se invita y se escribe. Se identifica por una abreviatura de 2–3 letras: `AL`, `DL`, `FR`, `ED`, `AU`, `AMU`. Hay 10 slots. |
| **Casa** | Cuál de las dos empresas propias es dueña de la cuenta: **Globalita** (línea `ia`) o **Seng** (línea `inversiones`). |
| **Lista** | Origen de perfiles de una cuenta: una búsqueda guardada de Sales Navigator o un CSV importado. Tiene páginas y prioridad. |
| **R0** | La invitación de conexión de LinkedIn. |
| **R1–R8** | Los 8 mensajes de seguimiento de la cadencia, en orden. |
| **Fase 2** | El lead que agotó R1–R4 sin responder: se corre 90 días y retoma en R5. No es un valor de `etapa`: es estar en R5–R8 (→ D04). |
| **Etapa** | En qué punto de la cadencia está el lead: `R0`…`R8`, `R0-recontacto`. |
| **Situación** | El otro eje del estado: `en_curso`, `contesto`, `pausado`, `agotado`, `esperando_recontacto`, `descartado` (→ D17). |
| **Próximo contacto** | Fecha en la que toca el siguiente mensaje de este lead. Es el campo que ordena el trabajo del día. |
| **Vencimiento** | Un lead cuyo próximo contacto ya pasó o está por pasar. |
| **Mensaje destacado** | Plantilla del repositorio marcada como favorita —para todas las cuentas, para toda una casa, o para cuentas puntuales— y por eso a mano al escribir. |
| **Cola de envíos** | Los envíos programados que están por salir (mensajes de cadencia, recordatorios, agradecimientos). |
| **Entrante** | Mensaje de WhatsApp recibido de un número que el sistema todavía no clasificó. |
| **Proyecto** | El trabajo que se abre cuando el lead avanzó: una venta de Fabript/PIV, una parcería, un prototipo. Un lead puede tener varios; un proyecto puede no tener lead. |

---

## 3. Modelo de datos

Los tipos están en notación neutra. Toda fecha suelta es `date` (ISO `YYYY-MM-DD`); toda marca de tiempo es `timestamp` con zona.

> **La separación que ordena todo lo demás.** La persona y el trabajo con esa
> persona son dos cosas (→ D01). `perfil` es la identidad —una por persona,
> compartida por las diez cuentas— y `lead` es lo que una cuenta puntual hace
> con ella. Por eso el teléfono vive en `perfil` (→ D08): un WhatsApp entrante
> se busca **una vez** para el sistema entero, no una vez por lead. Y por eso la
> «base compartida» dejó de ser una tabla aparte que hubiera que sincronizar
> (§3.12): es `perfil`.

### 3.1 Usuario

| Campo | Tipo | Notas |
|---|---|---|
| `id` | id | |
| `nombre` | string | |
| `email` | string | único; sirve de login |
| `rol` | enum | `Administrador` \| `Colaborador` \| `Observador` |
| `estado` | enum | `activo` \| `pendiente` \| `suspendido` |
| `permisos` | map<string, bool> | overrides por usuario; ver §6 |
| `linea_control` | enum? | El alcance de Control por casa: `ia` \| `inversiones` \| null. **No es un permiso** — ver §6.3.1 |
| `metodo_invitacion` | enum | `link` \| `clave_temporal` |
| `invitado_en` | timestamp | null si se creó directo |
| `ultimo_acceso` | timestamp | |

Reglas:
- `pendiente` = invitado por link y todavía no entró. No puede iniciar sesión hasta aceptar.
- `suspendido` = no puede iniciar sesión, pero sus leads y su actividad se conservan (→ D14).
- Puede haber **más de un Administrador**. Nada en el sistema debe asumir uno solo (→ D07, §6.3, §8.6).

### 3.2 Perfil y lead

#### 3.2.1 Perfil (la persona)

Una fila por persona. Es la tabla que evita que dos cuentas trabajen al mismo prospecto sin enterarse.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | id | |
| `slug` | string | La clave de deduplicación: el identificador del perfil de LinkedIn, sacado de la URL (→ D02) |
| `nombre` | string | Tal como figura en LinkedIn; **puede traer el cargo pegado**. No truncar en el dato, truncar en la vista (→ §10.9) |
| `cargo` | string | El rol de la persona en su empresa (→ D22: «rol» significa dos cosas distintas en el sistema) |
| `empresa`, `web`, `industria` | string | |
| `pais` | string | Nombre completo o ISO-2; los CSV llegan de las dos formas (§5.6) |
| `ciudad` | string | |
| `telefono` | string | Normalizado a E.164 al guardar (§5.7). **Vive acá, no en el lead** (→ D08) |
| `telefono_raw` | string | Lo que llegó, sin tocar, cuando la normalización no dio un número válido |
| `telefono_valido` | bool | `false` no bloquea nada: el lead se crea igual y el botón de WhatsApp queda deshabilitado con el motivo (§9.7) |
| `foto` | blob/url | Opcional, se pega desde el portapapeles: de LinkedIn se copia, no se descarga |
| `resumen` | text | Resumen del perfil |

#### 3.2.2 Lead

El trabajo de una cuenta con un perfil.

**Origen**

| Campo | Tipo | Notas |
|---|---|---|
| `id` | id | |
| `perfil` | fk Perfil | quién es |
| `cuenta` | fk Cuenta | desde qué cuenta se lo trabaja. Es justamente lo que varía entre relaciones |
| `lista` | string | descripción del origen (`"Sales Navigator · Gerentes SP"`, `"Referido · WhatsApp directo"`) |
| `pagina_origen` | int? | de qué página de la lista salió. `null` si vino de referido o de un entrante. Habilita «qué páginas rinden» |
| `nota_r0` | bool | si la invitación se mandó con nota. Habilita «si la nota mejora la aceptación» |

**Contacto propio de esta relación**

| Campo | Tipo | Notas |
|---|---|---|
| `email`, `email2`, `email3` | string | hasta 3 |
| `link_chat` | url | el hilo de mensajes de LinkedIn de **esta** cuenta |

`link_perfil` no es un campo suelto: sale de `perfil.slug`.

**Estado de la cadencia** — son dos ejes, no uno (→ D17)

| Campo | Tipo | Notas |
|---|---|---|
| `etapa` | enum | `R0`…`R8`, `R0-recontacto` |
| `situacion` | enum | `en_curso` \| `contesto` \| `pausado` \| `agotado` \| `esperando_recontacto` \| `descartado` |
| `proximo_contacto` | date | |
| `sin_leer_li` / `sin_leer_wa` | bool | **Dos flags, uno por canal** (→ D05). Un solo flag no puede decir «tiene un LinkedIn sin leer y además un WhatsApp sin leer» |
| `etiquetas` | string[] | libres, del catálogo; ver §3.9 |
| `nota` | text | resumen escrito a mano |

`etapa` sola no alcanzaba para representar los estados reales, y por eso son dos. Fase 2 dejó de ser un valor de `etapa`: es estar en R5–R8 (→ D04).

**Fechas medidas**

| Campo | Tipo | Notas |
|---|---|---|
| `invitacion` | timestamp | cuándo salió R0 |
| `aceptacion` | timestamp | cuándo aceptó |
| `respuesta` | timestamp | primera respuesta del lead |
| `ultimo_contacto` | timestamp | último envío nuestro |
| `demora_respuesta` | derivado | `respuesta − aceptacion`, mostrado en lenguaje natural (`"8 h"`, `"18 días"`). Sin aceptación, cae al último envío anterior; si el lead escribió primero, se dice eso y no un número (→ D12) |
| `demora_reunion` | derivado | `reunion.fecha − respuesta` (→ D11 para las reagendadas) |

**Requisito: guardar los timestamps crudos, no los textos.** Todos los «8 h» y «cada 6 días» del prototipo se calculan al leer.

**Historial de envíos** (`envio[]`) — la base de toda la analítica

| Campo | Tipo | Notas |
|---|---|---|
| `r` | enum | qué paso se envió |
| `enviado_en` | timestamp | |
| `canal` | enum | `LinkedIn` \| `WhatsApp` |
| `plantilla_id` | fk Mensaje? | qué plantilla se usó; null si se escribió a mano — y eso es un dato válido para la analítica de variantes |
| `idioma` | enum | `es` \| `pt` \| `en` |
| `texto` | text | **el texto realmente enviado**. Es lo que permite comparar variantes |

Se solapa con `mensajes_li[]` / `mensajes_wa[]` → D06.

**Reunión** (`reunion`, ver §5.11)

| Campo | Tipo | Notas |
|---|---|---|
| `fecha`, `hora` | date, time | |
| `zona` | string | Zona horaria del lead. Sin esto, con leads en tres husos, la columna miente por un día (→ D23) |
| `duracion_min` | int | default 30, editable en pasos de 15 |
| `estado` | enum | `pendiente` \| `asistio` \| `no-asistio` \| `cancelada` |
| `calendario_id` | fk Usuario | en qué calendario se agendó |
| `google_event_id` | string | Sin él, reagendar crea eventos duplicados (→ D10) |
| `notas` | text | |

**Historial de reuniones** (`historial[]`): `{ fecha, hora, resultado }`. Una reunión reagendada deja el intento anterior acá.

**Conversaciones**: `mensajes_li[]` y `mensajes_wa[]`, cada mensaje `{ quien: 'in'|'out', texto, enviado_en, ack? }` con `ack` ∈ `enviado` \| `entregado` \| `leido` (sólo WhatsApp).

**Log de ediciones** (`log[]`): `{ editado_en, usuario_id, campo, antes, despues }`. Ver §9.2.

### 3.3 Cuenta de invitación

| Campo | Tipo | Notas |
|---|---|---|
| `id`, `abrev` | id, string | `AL`, `DL`, … |
| `nombre_perfil` | string | nombre real del perfil de LinkedIn |
| `linea_negocio` | enum | `ia` (Globalita) \| `inversiones` (Seng). **De acá sale la casa** de todo lo que cuelga de la cuenta: leads, proyectos, reuniones |
| `estado_sesion` | enum | `activa` \| `caida` \| `sin_vincular`. **No se lee para mostrar el estado**: es un campo que alguien escribió una vez y el seed lo dejó en «activa» en cinco cuentas sin sesión. Sigue existiendo porque la pantalla de vincular lo usa como intención — «esta cuenta se quiere conectar» |
| `ultima_senal_li` | fecha | **La señal, no el estado.** El worker la toca cada vez que LinkedIn contesta; `core/sesion.ts` mira cuán vieja es (15 min). Vacía = sin vincular, que mientras el worker no corra es la verdad |
| `ultima_senal_wa` | fecha | lo mismo para WhatsApp |
| `chrome_perfil` | string | con qué perfil de Chrome se abre esa cuenta («Default», «Profile 1»…). Depende de la máquina, por eso es un campo y no una tabla en el código. Sin esto el worker **no arranca**: abriría un navegador sin sesión o el de otra cuenta, y en LinkedIn eso deja rastro |
| `cooldown_hasta` | fecha | hasta cuándo quedó frenada por un aviso de LinkedIn (§8.1.1). Lo escribe el worker solo; no se levanta a mano — el indicador interno de LinkedIn sigue activo aunque la cuenta parezca que volvió |
| `cupo_diario` | int | invitaciones por día; editable por cuenta. Default 40 |
| `objetivo_semanal` | int | default 200 |
| `sesion_wa` | enum | `activa` \| `caida` — WhatsApp se vincula por QR, **aparte** de LinkedIn. Mismo caso que `estado_sesion` |

Hay **10 slots fijos**. Los no vinculados se muestran como `libre 7`…`libre 10`.

Las dos casas, hoy:

| Línea | Nombre real | Cuentas |
|---|---|---|
| `ia` | **Globalita** | David, Alejandro, Edith, Francisco, Bruno |
| `inversiones` | **Seng** | Alberto Córdoba |

### 3.4 Lista de invitación

| Campo | Tipo | Notas |
|---|---|---|
| `id`, `nombre` | | |
| `cuenta_id` | fk Cuenta | una lista pertenece a una cuenta |
| `fuente` | enum | `Sales Navigator` \| `CSV importado` |
| `origen_id` | string | **De dónde salen los perfiles.** En Sales Navigator es el `savedSearchId` de la búsqueda guardada; en un CSV, el nombre del archivo importado. Sin esto la automatización sabe cómo se llama la lista y por qué página va, pero no a dónde ir a buscarla (→ §8.1) |
| `prioridad` | int | 1 es la más alta |
| `paginas_total` | int | |
| `pagina_actual` | int | hasta dónde llegó el script. **Dato de la automatización: se muestra, no se edita a mano** (→ §10.4) |
| `perfiles_por_pagina` | int | 25 en Sales Navigator |

Derivados: `restantes = (paginas_total − pagina_actual) × perfiles_por_pagina`; estado `agotada` (sin páginas), `en uso` (la de mayor prioridad con páginas), `en espera`.

**La URL se arma, no se guarda.** De una búsqueda guardada se anota el
`savedSearchId` y nada más. La dirección que uno copia del navegador trae
`lipi` y `snfl` pegados atrás —tracking de la sesión que la generó— que
cambian en cada visita y no identifican la búsqueda; guardarlos es guardar algo
que envejece mal. La regla vive en `core/invitacion.ts`.

`paginas_total` en 0 deja la lista **agotada**, y eso es correcto: una lista
cuyo tamaño nadie midió todavía no puede prometer invitaciones. El número sale
de mirar la búsqueda en Sales Navigator; hasta entonces la lista está cargada
pero no entra en la cola.

Las listas se reordenan con **flechas, no con drag**: son 2–3 por cuenta, el drag no ahorra pasos y las flechas ya son accesibles por teclado y touch (→ §10.5).

### 3.5 Mensaje / plantilla (repositorio)

| Campo | Tipo | Notas |
|---|---|---|
| `id`, `nombre` | | **Libre y editable.** Renombrar no rompe nada (→ D16) |
| `paso` | enum | `R0`…`R8`, `R0-recontacto`, `agradecimiento`. **Es lo que ata la plantilla a la cadencia**, no el nombre |
| `por_defecto` | bool | la que usa la automatización y la que precarga Vencimientos. Índice único parcial: una sola por paso |
| `textos` | map<idioma, text> | `es`, `pt`, `en`; pueden faltar |
| `destacado` | string? | El alcance del destacado; ver abajo |
| `orden` | int | reordenable |

Puede haber **varias plantillas por paso**, con una sola marcada por defecto (→ D16).

**El alcance del destacado** tiene cuatro formas:

| Valor | Qué significa |
|---|---|
| vacío | No está destacado |
| `todas` | Todas las cuentas |
| `casa:globalita` / `casa:seng` | Todas las cuentas de esa empresa propia, **incluidas las que se agreguen después** |
| `AL, DL` | Cuentas puntuales |

La forma por casa se agregó el 08/09/2026 y resuelve un problema que no daba error: con una lista de cuentas, **la cuenta que se sumara mañana empezaba sin ningún destacado y nadie se enteraba**. No hay aviso posible para eso — simplemente a esa persona le faltan chips. Con el alcance por casa, la cuenta nueva los hereda sola.

**Variables**: `{nombre}` (primer nombre), `{empresa}`, `{industria}`, `{ciudad}`, `{tema}`. Si un campo está vacío se usa un genérico según idioma: *su planta* / *sua planta* / *your plant*. Si el nombre viene con el cargo pegado —como llegan de LinkedIn— `{nombre}` corta antes del separador: *«Maria de los Angeles Fernandez - Gerente de Compras»* resuelve a **Maria**. Sin nombre, el saludo se limpia en vez de quedar como *«Hola , ¿cómo va?»*.

**Regla dura**: el repositorio es el **único lugar de verdad de los textos**. Cualquier edición se refleja al instante en Enviar mensaje, en Vencimientos y en Automatizaciones. Nunca constantes en el código. Si un paso no tiene plantilla, o la plantilla no tiene ese idioma, **se avisa y no se inventa** (§5.2): no cae a otro idioma en silencio.

### 3.6 Asignación de leads

Un lead puede estar asignado a **más de una persona**, y no son iguales:

- **Responsable**: uno solo. Es el que aparece en la columna 1 —donde hay lugar para un chip— y el que responde por el seguimiento.
- **Acompañantes**: los que también lo trabajan y lo ven en su lista.

Reglas cerradas:
- Los leads son **compartidos**: el administrador siempre ve todos. No existe «devolver un lead al administrador».
- Un lead sin asignación explícita pertenece al administrador → ambiguo con varios admins (→ D07).
- Un lead creado por un usuario (entrante de WhatsApp, importación de CSV) queda asignado a quien lo creó.

### 3.7 Tarea

`{ id, nombre, etiquetas[], prioridad 1–5, inicio, fin, notas, notificar, hecha }`. **Independiente del lead** (no hay FK obligatoria).

La fila es una grilla: check, nombre, fechas, vencimiento, etiquetas, alertas y prioridad en columnas rectas.

### 3.8 Regla (motor de automatización)

`{ id, nombre, disparador, condicion?, accion, activa, corridas_semana }`.

- **Disparadores**: se agrega una etiqueta · el lead responde · la reunión queda en no asistió · N días sin actividad · entra un lead nuevo.
- **Condiciones**: sin condición · de una cuenta · de un país · en una etapa.
- **Acciones**: fijar próximo contacto · cambiar la etapa · asignar a un colaborador · cargar mensaje a la cola · crear una tarea.

Dos reglas vienen de fábrica y no se borran, sólo se apagan: ver §5.9.

**Hueco conocido**: «se agrega una etiqueta» como disparador, más una acción que agrega etiquetas, se realimenta → D13.

### 3.9 Etiqueta

`{ nombre, editada_en }`. Catálogo libre, **sin colores por etiqueta**.

En uso: `Caliente`, `Tibio`, `Frío`, `Decisor`, `Contacto`, `Recordatorio`, `Reagendar`, `Periódico`, `No target`, `Fase 2`, más etiquetas de segmento (`MX Norte`, `Compras SP`).

Ojo: *Fase 2*, *Recordatorio* y *Reagendar* también son estados → D04.

### 3.10 Registro de actividad

`{ ts, usuario_id, tipo, accion, sobre_lead_id?, canal? }`. Tipos: `sesion`, `envio`, `edicion`, `reunion`, `permiso`. **Retención 90 días**, aplicada por un cron que corre a las 03:00.

### 3.11 Chat personal y entrante

- **Chat personal**: `{ id, nombre, telefono, mensajes[], no_leido }`. Amigos y familia. **No es un lead.**
- **Entrante**: `{ id, telefono, texto, recibido_en }` — mensaje de un número sin clasificar. Su ruteo está en §5.8.

Decisión cerrada: las conversaciones de leads **no viven en WA Personal**. Están en la ficha y en la columna 1 del follow-up. WA Personal es sólo amigos y familia, y por eso no lleva botón «Ignorar» ni etiqueta «Personal»: la pestaña ya lo implica.

### 3.12 Base compartida

**No es una tabla.** Es la vista de `perfil` (§3.2) con los leads de cada uno: qué cuentas ya invitaron a esa persona. Era la decisión estructural más grande del proyecto y quedó resuelta en D01 — antes repetía casi todos los campos del lead y había que sincronizarla; el campo `duplicado_en[]` desapareció, porque son los `lead` de ese mismo perfil y eso es una consulta.

**Se arma desde `perfil`, no desde `lead`.** No es un detalle de implementación:
un perfil **sin ningún lead** es el caso normal —alguien que está en la base y a
quien ninguna cuenta trabajó todavía— y es justamente lo que hay que poder ver
antes de invitar a alguien. Armándola desde los leads, esa gente no existe en
ninguna pantalla: pasó con los 175 contactos del CSV de WhatsApp, que quedaron
invisibles con teléfono y país cargados.

Por eso los grupos del filtro son **cinco** y no cuatro:

| Grupo | Qué es |
|---|---|
| En cadencia | Aceptó y está en R1–R4 |
| Fase 2 | Aceptó y está en R5–R8 |
| Recontacto | Se canceló y vuelve |
| **Sin aceptar** | Le escribimos y no contestó — material quemado |
| **Sin trabajar** | Nadie lo invitó todavía — material nuevo |

Los dos últimos parecen lo mismo y son opuestos. La columna de respuesta los
distingue igual: «nunca aceptó» contra «sin invitar».

### 3.13 Proyecto

La capa de arriba del lead: **el trabajo que se abre cuando la prospección ya avanzó**. Una reunión puede terminar en una venta de Fabript/PIV, en una parcería o en un prototipo, y eso no cabe en la etapa del lead.

Un lead puede tener **varios** proyectos. Un proyecto puede existir **sin** lead: contactos anteriores a la prospección, referidos, ferias.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | id | |
| `lead_id` | id? | `null` si no vino de la prospección |
| `nombre` | string | Título del trabajo, no el nombre de la persona |
| `empresa` | string | Se copia del lead al crear; después es independiente |
| `tipo` | enum | `fabript_piv` \| `parceria` \| `prototipo` |
| `estado` | enum | Ver §3.13.2 |
| `pais`, `ciudad`, `industria` | string | Se copian del lead al crear |
| `rol_contacto` | string | Cargo de la persona con la que se habla |
| `contacto` | string | Nombre de la persona |
| `cuenta` | string | Cuenta de invitación de la que salió (`AL`, `DL`, …). **De acá sale la casa** |
| `responsable_id` | id | Usuario dueño del proyecto |
| `abierto` | date | Fecha de creación |
| `nota_lead` | text | Copia de la nota «Acerca de» de la ficha, para leerla sin entrar al lead |
| `notas[]` | `{fecha, texto, autor_id}` | Contexto que no cambia el estado |
| `updates[]` | `{fecha, texto, autor_id}` | Qué se habló / qué pasó, en orden cronológico |
| `acciones[]` | `{fecha, texto, autor_id, hecha}` | Próximos pasos con fecha |

**Campos derivados** (no se guardan, se calculan):

- `reuniones` — cantidad de reuniones asociadas al proyecto.
- `ultima_reunion` — la reunión pasada más reciente. Si no hay pasadas pero sí una futura, se muestra `programada DD/MM`; si no hay ninguna, `sin reuniones`. **Nunca puede leerse «sin reuniones» al lado de un conteo mayor a cero.**
- `ultimo_movimiento` — la fecha más alta entre `updates[]`, `notas[]` y reuniones.
- `proxima_accion` — el primer ítem de `acciones[]` sin `hecha`.

#### 3.13.1 Tipos

`Venta de PIB` se renombró a **Fabript/PIV**. El tipo `prototipo` sigue existiendo como tipo de proyecto —se filtra con su chip— pero **no** tiene vista propia: la pestaña «Prototipos» se eliminó.

Los tres tipos calzan uno a uno con las etiquetas que marcan interés en la ficha, y por eso son el vocabulario compartido entre la prospección y Control.

#### 3.13.2 Estados del proyecto

> **Los siete no están fijos en el código.** Hay un **administrador de estados**
> donde se carga el nombre **y qué significa cada uno**. La leyenda del pie de
> Proyectos sale de ahí, así que escribir un estado es escribir su explicación:
> no hay forma de agregar uno sin decir qué quiere decir. Accesible desde
> Control y desde la ficha del lead. Decidido el 08/09/2026 — y resuelve solo
> la discusión sobre si «estamos viendo el prototipo» es un estado o una
> etiqueta, porque agregar el estado pasa a ser una operación normal.

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

1. **Congelado se calcula, no se guarda.** Si `ultimo_movimiento` tiene más de 30 días y el estado no es cerrado, el proyecto figura Congelado. Guardarlo obligaría a recordar cuál era el estado anterior, y bastaría con que nadie corriera el proceso un día para que la pantalla mintiera. Derivarlo hace que descongelar sea automático: cargar una actualización mueve la fecha y listo.
2. **Las acciones pendientes no cuentan como movimiento.** Son algo que todavía no pasó, y un proyecto lleno de intenciones sin ejecutar es exactamente el que hay que congelar.
3. Los dos estados cerrados son **terminales**: sólo un usuario los cambia a mano.
4. Los cuatro primeros son los **activos**, y son los que cuenta la tarjeta del mismo nombre.
5. La leyenda con estas reglas se muestra al pie de la vista de Proyectos. No es documentación aparte: es parte de la pantalla, porque Congelado lo pone el sistema y hay que poder entender por qué.

---

## 4. Estructura de la aplicación

Una sola aplicación web, un header fijo de 44 px y las secciones más overlays.

```
Header (44 px, siempre visible)
├── Switch de canal de conversación: in {n} / wa {n}
├── Tabs de sección: Automatizaciones · Control · Follow-up · WA Personal · Usuarios
├── Subtabs (sólo en Follow-up): Follow Up {n} / Sin leer {n}
└── Acciones (derecha): ··· · vencimientos · repositorio · tareas ·
    notificaciones · agenda · tema · sesión

Secciones
├── Automatizaciones   (pestañas: Invitaciones / Cancelación / Seguimiento)
├── Control            (pestañas: Proyectos / Reuniones)
├── Follow-up          (columna 1: lista · columna 2: ficha · sidebars)
├── WA Personal        (lista de chats + chat + entrantes)
└── Usuarios           (pestañas: Usuarios / Actividad)

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

**Qué tabs y qué iconos ve cada usuario se calcula desde sus permisos (§6), no desde su rol.** Un icono del header se muestra sólo si el usuario tiene el permiso de lo que abre: el de notificaciones requiere `followup` o `waPersonal`, y el de `···` requiere al menos una de las herramientas que contiene.

**La sección inicial es la primera permitida**, no `Follow-up` fijo. Un Observador cae en Control al entrar.

---

## 5. Reglas de negocio

Esta sección es la parte del manual que no se puede inferir de la interfaz. Implementarla exacta.

> **Dónde vive esto en el código.** Todas las reglas de esta sección son
> funciones puras en `packages/core/`, con sus tests citando la sección que
> implementan. Una regla que aparezca en un componente o en un handler está mal
> ubicada: es lo único que impide que la cadencia termine implementada en tres
> lugares con tres resultados distintos.

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
- Los nombres de los pasos y las esperas son **editables** en Automatizaciones → Seguimiento. Se guardan como **configuración, nunca como constantes** en el código.
- Cada paso se puede **pausar** individualmente. Un paso pausado no dispara envíos y el lead queda esperando.
- Después de R4 sin respuesta el lead pasa a **Fase 2**: el próximo contacto se corre **90 días** y al volver retoma en R5 (→ D15).
- Después de R8 sin respuesta la cadencia **termina** (queda en Fase 2 sin próximo paso automático).
- Si el lead **responde** en cualquier punto, la cadencia automática se detiene y el seguimiento pasa a ser manual desde la ficha (→ D17).

**Manual primero, automático después.** Hoy la mayoría de los R se mandan a mano desde la ficha. La cadencia es, antes que nada, un **motor de recordatorios**: calcula a quién le toca hoy, con qué texto y en qué idioma, y al enviar propone la próxima fecha y pone la etiqueta. Lo que el equipo necesita que pase siempre es eso: **que la fecha se mueva y que quede la etiqueta**. La automatización de envío es una capa encima que hace exactamente lo mismo sin intervención. La diferencia es sólo quién aprieta el botón, nunca el cálculo — y por eso Vencimientos (§7.7) es una pantalla de primera línea y no un accesorio.

### 5.2 De dónde sale el texto de cada paso

Un solo lugar de verdad: el **repositorio de mensajes** (§3.5). La automatización busca la plantilla con `paso = R{n}` y `por_defecto`. Si no existe, el paso **no tiene texto y hay que avisarlo, no inventarlo**. Tampoco cae a otro idioma en silencio.

El nombre del paso en Automatizaciones es una etiqueta de ese panel; el texto siempre viene del repositorio. Desde cada paso tiene que haber una puerta que **abra ese mensaje**: hoy se administran donde corresponde, pero no se ven desde donde uno los busca.

### 5.3 Cupos y ventana de envío de invitaciones

- El **cupo diario es por cuenta** (default 40, editable). **No hay cupo global.**
- El script trabaja la lista de **mayor prioridad que todavía tenga páginas**; cuando se agota, pasa a la siguiente automáticamente.
- El **objetivo semanal por cuenta es 200**. El contador se resetea los **lunes 00:01** (→ D25 para la zona del corte).
- Una cuenta con sesión caída queda en **cero** y sus envíos **se acumulan, no se pierden**. Hay que avisarlo: chip «sesión caída» más tarea automática sugerida (§13.5).

40 por día × 5 días hábiles = los 200 semanales. La coherencia es intencional.

### 5.4 Cancelación y recontacto

- Invitación **sin aceptar durante 90 días** (configurable) → se cancela, para liberar el límite de invitaciones pendientes de LinkedIn.
- El lead cancelado **espera 60 días** (configurable) y vuelve a la cola con etapa **Recontacto** y la plantilla de reinvitación (→ D24).
- **Tope de cancelaciones: 30 por día y por cuenta** (configurable), para no hacer un movimiento masivo sospechoso.
- La interfaz tiene que poder responder: cuántos leads cancelados cumplen la espera **hoy**, **esta semana** y **la próxima**, por cuenta. Ese es el cuadro «Vuelven a la cola de envío» de Automatizaciones → Cancelación.

**Hueco conocido**: falta el campo `cancelada_en` y el estado para los 60 días de espera. Sin eso no se puede consultar qué invitaciones toca cancelar hoy → D17.

### 5.5 Métricas y analítica

Lo que el sistema tiene que poder calcular. Los datos de §3.2 alcanzan para todo esto: se guardan desde el principio, y acá sólo se leen.

- **Por cuenta y por semana**: invitaciones enviadas, aceptadas, conversión de la semana cerrada, avance contra el objetivo de 200.
- **Por paso R**: cuántos leads tocan hoy, cuántos se enviaron, cuántas respuestas, tasa de conversión.
- **Cuándo responden**: distribución por día de semana y franja horaria.
- **Qué perfiles convierten**: reuniones concretadas por cargo.
- **Qué industrias convierten**: reuniones sobre aceptaciones por industria.
- **Qué variante convierte**: habilitado por `envio.plantilla_id` + `texto` (→ D16).
- **Qué páginas rinden**: habilitado por `pagina_origen`.
- **Si la nota en R0 mejora la aceptación**: habilitado por `nota_r0`.

**Dos aclaraciones que cambian el número:**

- **Aceptadas se cuenta por fecha de aceptación, no de envío.** Una aceptación de esta semana puede venir de una invitación de hace un mes. Hay que aclararlo en la vista o el número se lee mal.
- **En R0 la «conversión» es la aceptación de la invitación, no una respuesta.** Marcarla distinto.

### 5.6 Idioma sugerido

Se deduce del país del lead:

- **`pt`** — Brasil, Mozambique, **Portugal, Angola**.
- **`es`** — toda América Latina hispanohablante y España.
- **`en`** — default para cualquier otro país. No es una lista aparte que haya que mantener.

Se aceptan **códigos ISO-2 y nombres completos**, porque los CSV llegan de las dos formas.

**Es una sugerencia, con override guardado** (→ D09). El lead tiene su propio campo `idioma`: vacío = se usa la deducción por país; cargado = manda, aunque el país diga otra cosa. Resuelve al brasileño radicado en México, que con la sola inferencia se sugería mal para siempre. Se completa la primera vez que el usuario cambia el idioma al escribir.

**Países que faltaban** (→ D28): la lista original de `es` dejaba afuera a Ecuador, Venezuela y Centroamérica, y Portugal no estaba en ningún lado.

### 5.7 Normalización de teléfono

Al guardar se le agrega el código de país según el país del lead:

| País | Código | País | Código |
|---|---|---|---|
| Brasil | 55 | Perú | 51 |
| México | 52 | Paraguay | 595 |
| Argentina | 54 | Bolivia | 591 |
| Uruguay | 598 | Mozambique | 258 |
| Chile | 56 | Portugal | 351 |
| Colombia | 57 | España | 34 |

Es un normalizador propio, sin librería de terceros — el alcance son estos 12 países, no el mundo entero:

1. Si ya viene con el código del país adelante, no se toca.
2. Se saca el 0 de larga distancia.
3. **Argentina**: el 15 va después del código de área («011 15-1234-5678»), no al principio — se saca de ahí, no del inicio del número.
4. Se antepone el código del país deducido de `pais` (acepta ISO-2 y nombre completo, igual que §5.6).

Un teléfono que no da un número válido **no bloquea nada**: el lead se crea igual, con `telefono_valido: false` y el original guardado en `telefono_raw`. El botón de WhatsApp queda **deshabilitado con el motivo a la vista, no oculto** (§9.7).

**Al armar el link de `wa.me`** —y sólo ahí— hay dos rarezas de la región:

- **Argentina** necesita el **9** después del 54, o el link no abre para ningún lead argentino.
- **Brasil**: los celulares llevan un 9° dígito antes del número de 8 cifras. Los que vienen en formato viejo se completan cuando el patrón es reconocible (8 dígitos empezando en 6–9, rango móvil).

### 5.8 Ruteo de WhatsApp entrante

Cuando llega un mensaje de un número desconocido se normaliza (§5.7) y se busca contra `perfil.telefono` — **una sola búsqueda, no una por lead** (→ D08).

| Resultado | Qué pasa |
|---|---|
| **`desconocido`** | Ningún perfil coincide. Queda como *entrante* en WA Personal, con tres salidas: **Mover a FU** (crea el lead y salta a Follow-up → Sin leer), **Es personal** (se queda como chat personal), **Agendar** (pide nombre y lo guarda en la agenda). |
| **`conocido_en_esta_cuenta`** | Coincide un perfil que ya tiene lead en la cuenta que recibió el mensaje. El mensaje entra **sólo al follow-up**: el lead pasa a `sin_leer_wa`. En WA Personal sólo queda el aviso «Ya estaban en la base» con acceso a la ficha. **No se crea nada nuevo.** |
| **`conocido_otra_cuenta`** | Coincide un perfil, pero sus leads son de otra cuenta (o no tiene ninguno). **No se auto-asigna**: queda como entrante pero pre-identificado — la interfaz muestra quién es y con qué otra cuenta ya habla. «Mover a FU» acá crea un lead nuevo bajo esta cuenta, enlazado al mismo perfil. |
| **`ambiguo`** | El teléfono coincide con más de un perfil (dato sucio). Queda para elegir a mano, con los candidatos a la vista. **Nunca se le cuelga el mensaje al lead equivocado.** |

Un chat personal que después resulta de trabajo se pasa con **Mover a FU** desde el encabezado del chat y también desde la fila de la lista.

**Por qué cambió del diseño original.** El manual proponía emparejar por los últimos 8 dígitos, con reglas de desempate cuando coincidía más de un lead. Al mudar el teléfono a `perfil` (D08), el emparejamiento pasó a ser por el E.164 completo contra una identidad única: la ambigüedad por dígitos parecidos casi desaparece, y sólo puede pasar si **dos perfiles distintos** de verdad comparten el mismo teléfono.

### 5.9 Reglas de fábrica

Dos, que se pueden **apagar pero no borrar**:

1. **La etiqueta `Contacto` sugiere el próximo R.** Si el lead tiene `Contacto` y no tiene ninguna etiqueta en conflicto (`Reunión`, `Esperando confirmación`, `Aprobación del presupuesto`), el sistema **propone** el siguiente R en el chat.
2. **Enviar un R agrega la etiqueta `Recordatorio`** si todavía no la tiene.

### 5.10 Al enviar un mensaje desde la ficha

El envío es **una operación compuesta**. Todo esto pasa en un solo paso:

1. Se registra la entrada en `envio` (paso, timestamp, canal, plantilla, idioma, texto).
2. Se agrega la etiqueta **Recordatorio** (regla de fábrica, §5.9).
3. Si el paso empuja a Fase 2, se agrega la etiqueta **Fase 2**.
4. Se **propone** la próxima fecha de contacto según la cadencia — el usuario la acepta o la carga a mano. **No se fija sola.**
5. Todo lo anterior entra a la pila de deshacer como **una sola edición**.

**Cómo está implementado.** `planDeEnvio()` **calcula el plan y no escribe nada**. Devuelve tres cosas separadas a propósito:

- `envio` — la fila del historial.
- `lead` — lo que se aplica solo (situación, último contacto).
- `proximo_contacto_propuesto` — **aparte**, justamente para que quien llame no lo aplique sin que alguien lo acepte. Ese es el punto 4 codificado, no una convención que haya que recordar.

Devolver un plan en vez de aplicarlo hace que la ficha pueda mostrarlo antes de confirmar, que el worker lo aplique derecho, y que **los dos hagan exactamente lo mismo**.

**Casos que respeta:**

- Un lead que ya **contestó** no vuelve a la cadencia automática por registrar un envío.
- Registrar **R8** deja el lead `agotado` y sin próximo contacto.
- El **agradecimiento** post reunión (§5.11) no es un paso de la cadencia: no mueve la etapa ni propone fecha.
- Un texto escrito a mano queda con la plantilla vacía, y eso es un dato válido para la analítica de variantes.

**Pendiente**: el punto 5, la pila de deshacer, todavía no existe → D21.

### 5.11 Alrededor de la reunión

Los tres avisos viven en **Reglas y acciones rápidas**, no en Automatizaciones:

- Recordatorio configurable: ninguno / 2 / 3 / 4 horas antes.
- Confirmación 24 h antes y aviso 1 h 30 antes (activables).
- Agradecimiento post reunión cuando el estado pasa a **asistió**.

**El título del evento que escribe el CRM**:

    Jorge Lara Huerta / Francisco / Augusto
    nombre completo      cuenta      vos

Del lead va el **nombre completo**; de la cuenta de origen y de uno mismo, sólo
el primer nombre. El separador es ` / `, el mismo que tienen los 288 eventos
que ya estaban en el Calendar — y no es una preferencia: el importador parte el
título por `/` para saber cuál es el lead y cuál la cuenta, así que un evento
escrito con otro separador no se podría volver a leer con la misma herramienta
que leyó los viejos. La descripción lleva el link del **perfil** de LinkedIn, no
el de Sales Navigator, y el id del lead (§8.3).

**Zona horaria**: la base guarda en UTC, así que una reunión de las 18:00 en México vuelve como las 00:00 del día siguiente. Si se lee el texto crudo, la agenda miente por un día y una reunión que ya pasó figura como futura. Todo pasa por `enSuZona()` (→ D23).

### 5.12 De lead a proyecto

Es **manual y explícito**, desde la ficha del lead (columna 2) → acciones rápidas → grupo **Control de proyectos**:

- *Abrir proyecto Fabript/PIV*
- *Abrir proyecto de parcería*

Al elegir uno, el sistema crea el proyecto con:

- `nombre`: `"Fabript/PIV para {empresa}"` o `"Parcería con {empresa}"` (editable después).
- `lead_id`, `contacto`, `empresa`, `pais`, `ciudad`, `industria`, `rol_contacto`, `cuenta`, `nota_lead`: copiados de la ficha.
- `responsable_id`: el usuario asignado al lead.
- `estado`: **En conversación**.
- `notas[]` y `updates[]`: un registro inicial, `"Proyecto abierto desde la ficha del lead"`.

El proyecto queda visible **al instante** en Control. Abrir dos veces el mismo tipo sobre el mismo lead **no duplica: reemplaza**.

**Por qué manual.** Un lead que acepta y responde todavía no es un proyecto, y muchos quedan en la nada. Si se creara solo al agendar una reunión, Control se llenaría de proyectos vacíos y el conteo de «Activos» dejaría de significar algo. La decisión de que existe un trabajo la toma una persona.

**Dónde se edita.** En la **ficha del lead**, en el bloque `Proyectos` — no en Control, que es sólo lectura. Ahí se cambia el estado, se cargan actualizaciones, notas y próximas acciones, y se marcan hechas. Cualquier escritura mueve `ultimo_movimiento`, que es lo que **descongela**: no hay que acordarse de nada ni correr ningún proceso.

El bloque **no se gatea con `control`**: un colaborador abre y edita los proyectos de SUS leads, y los colaboradores no tienen esa clave. Quien manda es si puede editar el lead, que ya deja afuera al Observador.

**Las reuniones se asocian por `lead_id`**: si el lead tiene proyecto, sus reuniones cuentan en ese proyecto. Una reunión de un lead sin proyecto cuenta en el total del dashboard pero no en la conversión.

---

## 6. Permisos, roles y alcances

### 6.1 Las 19 claves de permiso

Cuatro grupos. Las cuatro últimas se separaron de los roles el **08/09/2026**: §10.24 pide que el Observador no vea datos de contacto, y §10.13 pide poder decidir cualquier permiso **por persona**. Con la visibilidad metida adentro del rol, «que Vera no vea teléfonos» sólo se podía resolver inventándole un rol.

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
| `verTodosLeads` | Sin esto, sólo ve los leads **en los que figura** — como responsable o como acompañante (§6.5) |
| `enviarMensajes` | Redactar y enviar desde la ficha |

**Visibilidad de datos sensibles**

| Clave | Qué habilita |
|---|---|
| `verTelefono` | El número y el botón de WhatsApp |
| `verEmails` | Los correos de la ficha |
| `verLinks` | El perfil de LinkedIn y el hilo del chat |
| `verConversaciones` | El hilo de mensajes |

Follow-up y WA Personal dejaron de ser secciones fijas: son permisos como el resto. Es lo que permite que un rol se quede sin ellas.

### 6.2 Resolución del permiso

El rol es un **preset, no una jaula**:

```
puede(usuario, clave):
  si usuario.permisos tiene la clave explícita  → ese valor
  si el preset del rol la incluye               → true
  en otro caso                                  → false
```

En la ficha del usuario cada permiso se muestra como «por rol» o «editado», con un botón para volver al preset del rol (que es simplemente borrar los overrides).

**Pendiente (08/09/2026):** hoy los presets están en el código. Se van a poder **editar desde la pantalla de Usuarios**, para que al invitar a alguien como Colaborador ya se sepa qué trae sin mirar el código. El ajuste por persona sigue funcionando igual, encima del preset.

**Huecos conocidos:**

- WA Personal ya tiene clave propia (`waPersonal`), pero el preset de Colaborador la incluye: por defecto todos los colaboradores ven el WhatsApp personal del administrador → D19.
- Un colaborador con `usuarios` puede darse a sí mismo las otras 18 → D20.

### 6.3 Qué implica ser Colaborador (con el preset por defecto)

Ve: Follow-up, WA Personal, tareas, agenda, y **sólo los leads en los que figura** (en la lista, en vencimientos y en notificaciones).

No ve: automatizaciones, Control, base compartida, vencimientos, repositorio y mensajes destacados, cuentas conectadas/QR, cola de envíos, importar CSV, enviar mensajes.

**Agenda del colaborador**: sus reuniones con detalle, más las de **todos** los administradores encima, en la misma grilla, como bloques ocupados con el nombre de pila del dueño de la agenda y nada más (→ D18). Sin selector: el chip que elegía un calendario a la vez se sacó el 09/09/2026 (§7.6). Al agendar, la disponibilidad ya suma los horarios de las dos agendas, que es la única forma de que la reunión entre en las dos.

### 6.3.1 El Observador, y el alcance de Control

El Observador entra **sólo a Control**: proyectos, reuniones y la lista de leads que confirmaron interés. No ve Follow-up, ni la prospección, ni datos de contacto — nombre, cargo, empresa, industria y lugar sí; teléfono, email y links no (§10.24).

Preset: `control` y `verTodosLeads`. Nada más. Es de **solo lectura** en toda pantalla.

**Control no es un permiso normal.** Las demás claves son sí/no sobre lo que ya hace el equipo. `control` se le da a alguien de **afuera** —el socio de IT de Globalita, el socio de inversiones de Seng, el dueño de una cuenta de invitación— y cada uno tiene que ver su negocio, no el del otro. Por eso lleva un **alcance** aparte, que no es una clave de la lista: los permisos son sí/no y esto elige entre mundos.

**El alcance tiene tres formas** (la tercera, decidida el 08/09/2026):

| Alcance | Quién | Qué ve |
|---|---|---|
| **Todo** | Administrador | Las dos casas, todas las cuentas |
| **Por casa** | El partner de una empresa propia | Sólo Globalita, o sólo Seng. **Sin** datos de contacto |
| **Por cuenta** | El dueño de una cuenta de invitación | Sólo lo que salió de su cuenta, **con** todos los datos |

La tercera sale de un caso concreto: *el dueño de su cuenta quiere ver lo mismo que ve el partner, pero sólo de su cuenta*. Es también la respuesta a la pregunta que quedó abierta sobre *«la parte de reuniones que aplica sólo al perfil de Alberto Córdoba»*: es el mismo mecanismo, acotado a la cuenta AL. No hace falta una regla aparte.

**La diferencia que importa**: el partner por casa **no ve datos de contacto** —no es su gente—; el dueño de cuenta **sí**, porque son sus propios leads.

**No se resolvió con dos claves de permiso** (`controlIa`, `controlInversiones`): los permisos son sí/no y esto es un alcance. Con una tercera casa habría que tocar el código en vez de cargar un dato.

**De dónde sale la casa.** Vive en la **cuenta** (`cuenta.linea_negocio`, §3.3); el proyecto y la reunión la heredan de ahí. Un proyecto sin cuenta —o una cuenta sin línea— sólo lo ve quien ve las dos: dárselo a un limitado sería filtrarle trabajo del otro negocio, y ese es el único lado del error que importa.

- Con `control` y **sin** alcance → ve las dos casas y elige cuál mirar con el switch del header.
- Con `control` y un alcance → ve sólo eso, y una pastilla dice cuál. No hay nada que elegir.

**El alcance se aplica en el servidor, nunca al dibujar.** Las reglas de la base filtran las **filas**; las vistas recortan las **columnas**. Que una pantalla no muestre un dato no sirve de nada si el dato llegó al navegador: estaría ahí, en su sesión, para cualquiera que mire la respuesta de red. Por eso al Observador ni siquiera se le piden los leads, las plantillas ni las etiquetas — se le pasa `null`.

**Estado**: `users.linea_control` (el alcance por casa) existe. El equivalente por cuenta está decidido y falta construirlo.

### 6.4 Ver el CRM como otro usuario

Un administrador puede entrar a la vista de un colaborador desde el chip de sesión. No persiste entre recargas; «Volver a mi usuario» regresa. Es una herramienta de soporte, no una suplantación auditada — aunque conviene registrarla en el log de actividad.

### 6.5 Asignación: responsable y acompañantes

Un lead puede estar asignado a **más de una persona** (decidido el 08/09/2026). No son iguales:

- **Responsable**: uno solo. Es el que aparece en la columna 1, donde hay lugar para un chip, y el que responde por el seguimiento.
- **Acompañantes**: los que también lo trabajan y lo ven en su lista.

§3.6 sigue valiendo: un lead sin asignación explícita pertenece al administrador, y el administrador ve todos siempre.

Con esto, `verTodosLeads` pasa a leerse *«sin esto sólo ve los leads en los que figura»* — como responsable o como acompañante.

En la lista y en la ficha, tocar el chip del agente abre la lista de gente para asignar. Cuando son varios, se muestra un icono y el detalle al pasar por encima.

### 6.6 Asignación masiva

Panel «Asignar en lote» en Usuarios:

- Filtros combinables: cuenta (chips con el conteo de cada una), país, ciudad, industria — los tres últimos son **checklists multi-selección**, no selects de un valor.
- Buscador por nombre, empresa y cargo.
- «Seleccionar los N que coinciden» alcanza a **todos** los que pasan el filtro, no sólo a los visibles en pantalla.
- Check por fila para el uno por uno.
- La ficha del usuario muestra el reparto por cuenta (`AL 3 · DL 12`).

### 6.7 Alta, login y sesión

**El alta la hace un administrador. No hay auto-registro** (§7.5), y eso se
sostiene en el servidor: la colección `users` no acepta `create` desde la API.
Si lo aceptara, cualquiera que sepa la URL se da de alta solo.

**El correo de alta no lleva la contraseña.** Lleva el usuario —el email con el
que va a entrar— y un enlace donde la persona **elige** la suya. La diferencia no
es de estilo: una clave escrita en un mail queda en esa bandeja para siempre, y
quien acceda a esa casilla dentro de dos años tiene una llave del CRM. El
enlace, en cambio, deja de servir apenas se usa, o a los **siete días**, lo que
pase antes.

El flujo, entero:

| Paso | Qué pasa |
|---|---|
| 1 | El administrador carga nombre, email y rol. Ninguna contraseña |
| 2 | El servidor crea el usuario en estado **pendiente**, con una clave aleatoria de 50 caracteres que **no viaja a ningún lado** — en ningún momento existe una clave que un tercero pudiera adivinar o encontrar escrita |
| 3 | Sale el correo con el usuario y el enlace. Si el correo no sale, la cuenta recién creada **se deshace**: un usuario que nadie puede usar y que además bloquea ese email es peor que no haber hecho nada |
| 4 | La persona abre el enlace, elige su contraseña y **entra directo** |
| 5 | El usuario pasa a **activo**, y el enlace se quema |

**El token**: 40 caracteres al azar, guardado **hasheado** en su propia
colección cuyas cinco reglas están vacías — sólo el servidor la lee. Se guarda
hasheado porque un backup que se filtre, con el token en claro, es entrar como
cualquiera de los invitados pendientes.

**Emitir un enlace quema los anteriores.** Dos correos abiertos son dos llaves.

**Los tres «no» se distinguen**, porque no es lo mismo para quien abre el
enlace: *vencido* → pedí otro; *ya usado* → entrá con tu contraseña;
*inexistente* → se cortó al copiarlo. Un solo mensaje para los tres manda a
escribirle al administrador a alguien que no lo necesitaba.

**Un usuario `pendiente` no puede iniciar sesión** (§3.1), y eso se comprueba en
el servidor, no en la pantalla de login.

**Reiniciar una contraseña es lo mismo**: sale un enlace, con otro texto — el
que dice que la anterior dejó de servir. **Nadie, ni el administrador, fija ni
ve la contraseña de otro.** No hay botón para eso.

Y del login en sí:

- Usuario/email + contraseña.
- «Mantener la sesión abierta» persiste la sesión localmente; si no, muere al cerrar.
- Cerrar sesión desde el chip de sesión en el header.
- **Una sesión con un token válido que apunta a un usuario que ya no existe se cierra sola.** Que el token no haya vencido no alcanza: si no se revalida contra el servidor, la app dibuja un CRM vacío y le echa la culpa a los filtros.

**Hace falta un servidor de correo** (§13.1). Sin SMTP configurado el alta
falla y lo dice; no crea a nadie a medias.

### 6.8 Qué ve cada rol

| | Administrador | Colaborador | Observador |
|---|---|---|---|
| Sección Control | sí | no (por preset) | sí, es lo único |
| Abrir proyecto desde la ficha | sí | sí, sobre sus leads | no |
| Editar notas, actualizaciones y acciones | sí | sobre sus leads | no |
| Dashboard de reuniones | sí | no | sí |
| Datos de contacto (teléfono, email, links) | sí | sobre sus leads | **no** (salvo alcance por cuenta, §6.3.1) |

El Observador ve nombre, cargo, empresa, industria, país y ciudad de la persona con la que se tuvo la reunión — eso es el objeto del control. No ve teléfonos, emails, links ni conversaciones.

---

## 7. Pantalla por pantalla

### 7.1 Header

Alto fijo 44 px, nada envuelve a una segunda línea (`flex-shrink: 0`, sin `flex-wrap`). Iconos de 28 px.

- **Switch de canal** (`in {n}` / `wa {n}`): elige en qué canal se abre la conversación del lead activo. LinkedIn en azul, WhatsApp en verde.
- **Tabs de sección**, filtradas por permisos.
- **Subtabs de Follow-up**: `Follow Up {total}` / `Sin leer {n}`.
- **Sueltos a la derecha**: vencimientos (con badge), repositorio, tareas, notificaciones (badge con el total sin leer entre Follow-up y WA Personal), agenda, tema, chip de sesión.
- **Menú `···`**: cuentas conectadas, base compartida, reglas y acciones rápidas, atajos de teclado.
- **Tema**: ciclo claro → oscuro → **noche** (cálido, menos contraste, para trabajar de noche).

### 7.2 Follow-up

Tres columnas, las dos últimas opcionales.

**Columna 1 — lista de contactos** (ancho arrastrable 260–520 px, doble clic alterna 260/340, persistido):

- **Buscador compuesto, y busca dentro de todo el lead** (09/09/2026). Augusto lo pidió *«como Google Drive, que buscás una frase y te encuentra el archivo que la tiene adentro»*.

  **Los chips se acumulan con «Y».** Se escribe una palabra, enter, y queda fija como chip; la siguiente **achica** lo que quedó. Es lo que significa «filtro» y es lo que hace Drive. Decidido por Augusto **con la contra a la vista**: «Martín» y «Josefina» juntos dan cero, porque nadie se llama las dos cosas. A cambio se puede afinar: «Martín» + «Vale» + «gerente». La cruz de cada chip lo saca, y **borrar con el campo vacío saca el último**, que es cómo se deshace sin apuntarle a una cruz de 9px.

  **Lo tecleado cuenta antes del enter**: la lista se achica mientras se escribe y el enter sólo fija lo que ya se estaba viendo. Si hubiera que confirmar cada palabra para ver algo, escribir a ciegas sería el modo normal de usarlo.

  **Dónde busca**: nombre, empresa, cargo, industria, ciudad, país, web y resumen del perfil; los tres correos; **las notas** —que es donde uno escribe lo que después no sabe cómo buscar—; etapa, situación, lista de origen, motivo de descarte y de archivado; la cuenta, el colaborador asignado y **las etiquetas**. Quedaron afuera dos que parecían texto y no lo son: `nota_r0` es un interruptor y `pagina_origen` un número de página.

  **El teléfono se compara por dígitos y en los dos sentidos**: `8477-0178` encuentra a `+55 31 8477-0178`, y al revés, escribirlo con el prefijo de país encuentra al que se guardó sin él. El mismo número está cargado de tres formas y el prefijo aparece o no según de dónde vino el contacto; comparar como texto casi nunca da. Hacen falta **4 dígitos** para tratar algo como teléfono: con tres, «311» entra en media agenda.

  **El teléfono respeta el permiso (§6.2).** Quien no puede verlos tampoco los encuentra buscando: si buscar un número trajera un lead, el buscador sería una forma de confirmar teléfonos sin tener permiso de verlos. Por eso los teléfonos viajan **aparte** del resto del texto y quien arma el buscable decide si los incluye — no se filtra después, que es donde estaría el agujero. Al lead se sigue llegando por el nombre.

  **Una sola regla, no dos**: `coincide()` —la de la Base compartida y el panel del partner— pasó a ser una envoltura de la nueva. Dos implementaciones de «coincide» encuentran cosas distintas, que es lo que hubo que venir a arreglar la primera vez. Regla en `core/busqueda.ts`, con 19 tests que citan esta sección.
- **Nuevo lead** y **Importar CSV**, los dos con el permiso `importarLeads`: son
  las dos formas de meter gente a la base, y quien puede una puede la otra.
- Filtros en popover: próximo contacto (todos / sólo vencidos) y orden, WhatsApp (con/sin), reunión (con / sin / asistió / no asistió), rol, país, ciudad, etiquetas. El botón muestra cuántos filtros hay activos y cuántos leads quedan.
- Chips de cuenta (`todas`, `AL`, `DL`, …).
- Chips de colaborador (**sólo para el administrador**).
- Últimos leads editados, como accesos rápidos.
- La fila: **el nombre de la persona** —sin el cargo que LinkedIn deja pegado; el completo va en el `title`—, **la cuenta de la que salió**, próximo contacto, fecha de reunión con color según estado (verde asistió, rojo no asistió, neutro pendiente), **el último mensaje enviado** —el R si fue de la cadencia, `FU` si fue suelto—, **las etiquetas**, el **icono de WhatsApp** cuando hay teléfono, y el **agente**. Los entrantes sin leer salen con borde ámbar y etiqueta «nuevo».
- **Lo que no entra se despliega al pasar por encima.** Con muchos agentes o muchas etiquetas la fila no alcanza: se muestra un icono y el detalle en el hover. De las etiquetas se puede **elegir cuáles se ven y en qué orden** cuando entran dos o tres.
- **Escala**: renderiza **80 leads** y suma de 80 en 80 al acercarse al final del scroll. Si se selecciona un lead fuera de la ventana visible, la ventana **se expande antes** de hacer scroll a él. Con 1.500+ leads no hay paginado visible.
- Al pie: cola de envíos (con permiso), con cuenta regresiva del próximo envío.
- Arriba de todo, cuando está abierta: la **conversación** del lead activo, en el canal que elige el switch del header.

**Columna 2 — ficha del lead** (mínimo 440 px):

- **Encabezado**: nombre, cuenta, links (perfil, chat), botón verde de WhatsApp si hay teléfono, chip «Asignado a» (reasignable, con opción *sin asignar*), deshacer, acciones rápidas, y los **iconos de Etiquetas y de Log de ediciones**.

  > **Lo que NO va en el encabezado** (09/09/2026): ni la etapa, ni la
  > situación, ni el idioma. Las tres estaban ahí como pastillas al lado de las
  > etiquetas —que sí se sacan con una ×—, así que parecían etiquetas que no se
  > podían borrar. Y las tres se leen donde se usan: la cadencia en la
  > secuencia de Enviar mensaje, y el idioma en el desplegable de esa misma
  > fila, que además deja cambiarlo. Arriba eran la misma información a diez
  > centímetros del lugar donde sirve.

  > Etiquetas y Log **son iconos, no bloques colapsables** (08/09/2026). Los dos
  > se consultan de refilón mientras se trabaja el lead —qué etiquetas tiene,
  > qué se le tocó— y como bloques empujaban hacia abajo Enviar mensaje, que es
  > lo que se usa todo el día. El icono del log **reemplaza al tooltip** del
  > perfil.

- El icono de **Etiquetas** agrega y **quita del lead**; nunca borra del catálogo, eso se hace en el panel de etiquetas.
- **Bloques colapsables**: Datos · Contacto · Fecha de reunión · Proyectos · Análisis del perfil.
- **Enviar mensaje**:
  - **El switch de canal decide por dónde sale.** LinkedIn o WhatsApp: lo que se elige es lo que se manda. No es una etiqueta de lo que va a pasar.
  - **La secuencia, no un desplegable de paso.** Una fila `R0 ✓ · R1 ✓ · R2` donde lo tildado ya se mandó y lo que falta se ve solo, cada uno con **el idioma en que salió**. El que toca es el primero sin tilde.
  - Chips de mensajes destacados (reemplazan el texto, arrastrables para reordenar).
  - «Destacar mensajes»: checklist sobre todos los mensajes del repositorio, con el alcance de §3.5.
  - «Guardar»: crea el mensaje en el repositorio y después pregunta si cargarlo en otro idioma y si destacarlo.
  - `↗ Ir al chat` **al lado del título** del bloque.
  - Sin botón «Copiar» y sin los textos de ayuda al pie: se leen una vez y después son ruido en el lugar donde se trabaja todo el día.
- **Acciones rápidas** (rayo): todas las acciones del lead agrupadas — ficha (guardar, deshacer), contacto (enviar, cambiar canal, abrir el chat real, ver perfil), seguimiento (próximo contacto, reunión, análisis), asignación, Control de proyectos. Cada una con su atajo.
- **Edición**: los campos se ven en vivo mientras se editan, no se ocultan hasta guardar. Toda edición apila su estado anterior; guardar limpia la pila.

**Alta manual de un lead** (el «+» al lado del buscador):

Hasta el 09/09/2026 a la base sólo se entraba por un CSV o por un WhatsApp
entrante. Falta el caso de todos los días —te pasan un contacto, lo conocés en
una feria, te lo recomienda un cliente— y armar un CSV de una fila para eso
termina en que el contacto se queda en un papel.

- **Obligatorios: nombre y cuenta. Nada más.** Un formulario que pide diez
  cosas para guardar una es un formulario que no se usa. El nombre, porque sin
  él no se lo puede buscar después; la cuenta, porque de ella cuelga la casa
  (§3.13) y el perfil desde el que se le escribe.
- **Opcionales**: LinkedIn, teléfono, email, cargo, empresa, industria, país,
  ciudad, próximo contacto y una nota. Lo que falte se completa después: la
  mitad la trae el scan de LinkedIn.
- **Lo que el CRM deduce solo y muestra**: la casa (de la línea de la cuenta),
  el idioma en que se le va a escribir (del país, §5.6) y el teléfono
  normalizado a E.164 (§5.7). Un teléfono que no da un número válido **no
  bloquea**: el lead entra con `telefono_valido: false` y el aviso explica por
  qué el botón de WhatsApp va a estar apagado (D29).
- **Antes de guardar pregunta si esa persona ya está** (D02). Si coincide el
  slug de LinkedIn o el URN, **no se duplica**: se le completa a la ficha lo
  que le falte y se le agrega el lead de esa cuenta. Si coincide sólo la
  huella, entra igual marcado como posible duplicado, para la bandeja de
  Duplicados.
- El lead nace en **R0 / en curso**, con `lista: "Carga manual"` —que es lo que
  después permite separarlo en las métricas de una tanda de Sales Navigator— y
  asignado a quien lo cargó. Al guardar, la ficha se abre en él.
- Sin próximo contacto avisa que no va a aparecer en Vencimientos, y propone
  **mañana**: el alta suele hacerse justo después de haber hablado.

La regla vive en `core/alta-lead.ts` (`problemasDelAlta`, `planDeAlta`,
`proximoSugerido`) y la decisión de duplicado la toma `decidirAlta` de
`core/dedupe.ts`, la misma que usa el import.

**Sidebars** (una a la vez): Agenda (340–900) y Repositorio (300–620). Las dos arrastrables, con doble clic para volver al ancho normal, persistido.

**Escribir un mensaje sin salir de «Destacar mensajes»** (09/09/2026).

El momento en que uno se da cuenta de que a un mensaje le falta el texto en
portugués es justo cuando lo está buscando para destacarlo. Antes había que
cerrar el modal, ir al Repositorio, escribirlo, volver y empezar de nuevo — y
en el camino se perdían el idioma y el alcance ya elegidos.

- **Los que NO tienen texto en el idioma elegido ahora aparecen**, abajo y
  marcados. Antes se los filtraba y desaparecían: uno veía tres mensajes en
  portugués sin enterarse de que había nueve esperando traducción.
- El **lápiz** de cada fila corrige el texto de ese idioma. **Completa, no
  pisa**: se escribe una sola clave de `textos` y las demás quedan como
  estaban.
- **«Escribir un mensaje nuevo»** crea uno ahí mismo. Sin paso: no todo mensaje
  pertenece a un escalón de la cadencia, y el Repositorio ya deja asignárselo
  después.
- Es **el mismo cuadro** para las tres cosas, porque son la misma acción con
  distinto punto de partida. Tres formularios parecidos era la forma segura de
  que terminaran viéndose distinto.

### 7.3 Automatizaciones

Columna izquierda con tres pestañas; columna derecha fija. Arriba de todo, un botón global **en marcha / todo en pausa**.

**Invitaciones** — las 10 cuentas. Cada fila: abreviatura, **por qué no está invitando** (o «le toca» con cuántas salen), resumen de listas, cupo diario editable, avance semanal. Se despliega y muestra sus listas con prioridad (flechas para reordenar), última página vista (dato de la automatización, no editable), perfiles restantes estimados y chip *agotada / en uso / en espera*.

Debajo, **Ritmo de la corrida**: los números que gobiernan el proceso de invitaciones (§8.1.1), editables. Se guardan en `configuracion` con clave `invitaciones` y los lee el worker.

**El chip de la izquierda muestra el freno, no el estado de la sesión.** Antes decía *activa / sesión caída / sin vincular*, deducido de la última señal. Estaba bien y era insuficiente: una cuenta con la sesión perfecta tampoco invita si le falta el perfil de Chrome, si LinkedIn la frenó, si son las tres de la mañana o si ya salió el cupo del día — y la pantalla decía «activa» igual. El freno **contiene** al estado de la sesión (`sin vincular` y `sesión caída` son dos de sus ocho valores), así que lo reemplaza en vez de ponerse al lado.

**Cancelación** — los tres números configurables (días sin aceptar, espera de recontacto, tope por día y cuenta) y la tabla «Vuelven a la cola de envío» por cuenta (hoy / esta semana / la próxima) con el total listo para reinvitar.

**Seguimiento** — cadencia R1–R8 con nombre y espera editables y on/off por paso; **Rendimiento por R** (toca / enviados / respuestas / tasa en barra); tres tarjetas de análisis: cuándo responden, perfiles con más reuniones, industrias que más convierten.

**Columna derecha (fija)** — «Sale hoy» por cuenta (invitaciones / seguimiento / cancelaciones) y métricas semanales por cuenta (enviadas, aceptadas, conversión de la semana anterior, objetivo).

### 7.4 WA Personal

Sólo amigos y familia. Lista de chats (punto ámbar en los no leídos y botón «Mover a FU» en cada fila), chat abierto con su encabezado, y la bandeja de entrantes desconocidos con las tres acciones de §5.8. Los entrantes que resultaron ser leads ya cargados aparecen sólo como aviso «Ya estaban en la base».

Sin botón «Ignorar» y sin etiqueta «Personal»: la pestaña ya lo implica.

### 7.5 Usuarios (con permiso `usuarios`)

Dos pestañas.

**Usuarios**: lista con rol, estado y último acceso; alta por invitación —siempre por enlace, nunca con una contraseña escrita (§6.7)—, suspender/reactivar, baja, y **reenviar el acceso**: para quien está `pendiente` es otro enlace de invitación; para quien ya entró, un reinicio de contraseña. La ficha del usuario muestra rol, tabla de los **19 permisos** con su origen (por rol / editado), el **alcance de Control** cuando corresponde, leads asignados (con cruz para quitarlos y buscador para agregar), reparto por cuenta (`AL 3 · DL 12`) y el panel «Asignar en lote».

**Actividad**: cuándo, usuario, acción, sobre qué lead y canal, con filtro por usuario. Registra ingresos, envíos, ediciones de ficha, reuniones y cambios de permisos. Retención 90 días.

### 7.6 Agenda

> **La referencia de comportamiento es Google Calendar.** Es el patrón que el
> equipo ya tiene en la mano, y copiarlo evita tener que explicar la agenda.

Tres vistas. La **semanal** y la **diaria** son la misma grilla con distinta cantidad de columnas — no dos pantallas parecidas, la misma. Tenerlas separadas costaba que la diaria no dejara estirar y que cualquier arreglo hubiera que hacerlo dos veces.

**La grilla.** Cada día es una columna de trece horas (8 a 20), y los eventos van **posicionados encima**, no metidos en la celda de su hora:

- El bloque **arranca en su minuto** y **mide lo que dura**: uno de 12:00 a 14:00 ocupa las dos horas; uno de media hora a las 10:45 llega a las 11:15.
- Se **estira desde el borde de abajo**, de a quince minutos, en las dos vistas. Mientras se estira el bloque crece en vivo y al soltar se guarda; soltar sin mover no escribe nada.
- Se **arrastra** a otro día u otra hora. Al arrastrar se pinta el hueco **del alto exacto** que va a ocupar — no los cuadros que toca — porque eso es lo que uno necesita ver antes de soltar.
- El bloque **dice cuánto dura** al lado de la hora. Cuando es de quince minutos, la hora y el nombre van en la misma línea: no hay alto para dos.
- **Dos reuniones a la misma hora se reparten el ancho en carriles.** Una encima de otra haría desaparecer la de atrás sin ninguna señal, que es peor que verlas apretadas. El reparto es por grupo encadenado: si A pisa a B y B pisa a C, los tres achican, aunque A y C no se toquen.
- Lunes a sábado, **domingo no se muestra** (→ §10.12). Sábado en gris.
- **La columna de hoy NO se tiñe**, y es obligatorio: «programada» es `--accent-light`, así que teñir la columna de hoy con ese mismo token borraría el bloque contra su propio fondo. Hoy se marca en el encabezado —acento, negrita y un subrayado de 2px— y con la línea roja de ahora, que sólo existe en esa columna.

**El color de los bloques (§9.6).** La agenda usa **el idioma del resto del dashboard: fondo de tinte claro + texto saturado del mismo tono**, igual que `.fila-reunion-asistio`, `.fila-ultimo`, `.badge-meeting`, `.badge-await` y `.pastilla`. Hasta el 09/09 era el único lugar del CRM con bloques sólidos y texto blanco, y por eso desentonaba aunque el contraste diera bien: *«es un verde demasiado fuerte»*, *«me gustaría una paleta un poquito más clara»*.

| Bloque | Fondo | Texto | Guía izquierda | Contraste |
|---|---|---|---|---|
| Programada | `--accent-light` | `--accent-hover` | 3px `--accent` | 6.51:1 |
| Asistió | `--success-light` | `--success` | 3px `--success` | 5.89:1 |
| No asistió | `--error-light` | `--error` | 3px `--error` | 5.30:1 |
| Cancelada | `--warning-light` | `--badge-await-text` | 3px **punteada** `--warning` | 6.59:1 |
| De Google, con lead | `--teal-light` | `--accent-hover` | 3px `--accent` | 6.05:1 |
| De Google, sin lead | `--info-light` | `--muted` | 3px **punteada** `--accent` | 6.28:1 |
| De Google, lo demás | rayado `--info-light` | `--muted` | 3px `--info-br` | 6.28:1 |

**Lo que delimita el bloque es la guía, no el relleno.** El tinte contra la columna da **1.17:1**: si el color fuera lo único, el bloque desaparecería. La guía va en el color saturado y contra la columna da 5.80:1. El tinte agrupa; la guía delimita y dice el estado. La **punteada** significa que no hubo reunión (cancelada) o que todavía no hay lead (sin conectar).

**La hora va en `--muted` y nunca en `--hint`**: medido, `--hint` sobre `--accent-light` da 2.91:1 y sobre `--info-light` 3.35:1. Un fondo claro perdona menos que uno oscuro y el texto secundario es donde se paga primero.

**El hover no cambia de tono: baja el brillo un 7% y engrosa la guía.** No va azul aunque se pidió: en este CRM el azul es LinkedIn, y un evento que se pone azul se lee como «esto es de LinkedIn». Bajar el brillo oscurece fondo y texto a la vez, así que el contraste se mantiene y no hace falta un token nuevo por estado. Los bloques que no responden a nada —el almuerzo— no tienen hover: diría «esto se puede tocar» y sería mentira.
- **Los ratos libres NO se dibujan.** Se probaron el 09/09 y se sacaron el mismo día: *«sacá eso de una opción de una hora y media en el medio libre, no me sirve y no quiero»*. En texto la idea suena útil; en pantalla eran catorce carteles por semana peleándole atención a las reuniones, que es lo único que la agenda tiene que mostrar. La regla vive en `core/huecos.ts` con sus 17 tests por si alguna vez tiene otro lugar —el panel de fecha, por ejemplo—, pero **la grilla no la usa**.
- **La cabecera del día dice cuántas reuniones tiene.** Cuenta reuniones con gente —del CRM o de Google ya conectadas— y **no** el almuerzo, los bloques ajenos ni las canceladas: la pregunta que contesta el número es «¿cuánta gente veo el jueves?». En cero no se dibuja.
- **La hora actual es una línea roja con su reloj**, sólo en la columna de hoy y sólo dentro de la franja de 8 a 20. Va por encima de todo, porque tapada por un evento deja de servir de referencia. Lleva el número al costado porque es lo único rojo de la grilla que no es un estado: una línea roja sola sobre un evento se lee como si el evento estuviera mal.
- **Abajo va la leyenda** de las ocho clases de bloque. La grilla dibuja programada, asistió, no asistió, canceló, de Google con lead, de Google sin lead, bloqueo de Google y ocupado de otra agenda; sin leyenda hay que deducir el código de color mirando.

**Vista Lista**: una fila por lead con seguimiento — check de control, última reunión, próximo contacto editable, foto (se pega del portapapeles), cuenta y nombre, nueva reunión, notas, links, etiquetas. El filtro de check es una caja sin texto en **tres estados**: vacía (todos), con check, con cruz (sin check).

**El orden es por última reunión, de la más nueva a la más vieja** (`porUltimaReunion`). La clave es la misma fecha que muestra la columna «Última»: si se ordenara por otra cosa, esa columna se vería salteada y habría que leer fila por fila para encontrar a quién se vio la semana pasada. Los que todavía no tuvieron ninguna reunión van **al final**, no al principio: una fila sin fecha arriba de todo se lee como si fuera la más reciente. Antes salían en el orden en que los devolvía la base, que es por fecha de creación del lead.

**Hover del evento**: nombre, empresa, cuenta, hora y duración, estado, asistió / no asistió, pegar foto, notas, links, y dos campos para cambiar hora y fecha. **No hay popup del evento**: clic en el evento abre la ficha del lead.

**La fecha de «Última» se corrige tocándola**, sin abrir la ficha. Se ve como texto —es un dato antes que un control— y se delata con un subrayado punteado al pasar por encima; una fila de diez columnas no aguanta un botón más.

**Y a esa corrección no se le avisa a nadie.** Mover una reunión que todavía no pasó es reagendarla y el invitado tiene que enterarse (`sendUpdates=all`, §8.3); corregir la fecha de una que **ya pasó** es arreglar un dato. Mandar «tu reunión se movió» por algo de hace ocho meses no es avisar, es ruido — y en el CRM eso pasa justo cuando alguien está ordenando el histórico, o sea de a muchas. La regla es del horario, no de la pantalla: **si el inicio ya pasó, Google no notifica**.

**Un solo calendario, integrado. Sin chips** (09/09/2026).

Había un chip por administrador —«Mío», «Alberto»— y se miraba uno a la vez.
Para agendar no sirve: la pregunta no es «¿cómo está mi semana?» sino «¿en qué
hueco entramos los dos?», y con chips eso obliga a mirar dos veces la misma
semana y a recordar la primera. Ahora es una grilla sola: **las reuniones
propias con todo el detalle y los horarios de los demás administradores encima,
como bloques ocupados**. Lo mismo en el panel de Fecha de reunión, donde el
hueco que sirve es el que está libre en las dos agendas.

**Conectar un evento del calendario con un lead** (09/09/2026).

El calendario propio trae dos clases de bloque: las reuniones que agendó el CRM
—que tienen lead— y todo lo demás, que llegó de Google y no tiene nada detrás.
Los segundos se dibujan distinto, y eso es correcto: no son reuniones del CRM.
Pero muchos **sí son reuniones de prospección** hechas antes de que el CRM
existiera, y ahí lo que falta no es color: es el vínculo.

- **Se conecta por PERSONA, no por evento.** Un evento suelto casi nunca está
  solo: son reuniones que se repiten con la misma persona. Al 09/09/2026 hay
  **278 eventos de prospección sin lead, y son 145 personas**: dos de ellas se
  llevan 83 eventos. Conectar de a un evento sería pedir 278 respuestas para
  145 preguntas. Elegir el lead una vez engancha **todos** los eventos de esa
  persona.
- **El nombre sale del título**, con la misma lectura que decide qué evento es
  de prospección (§5.11): la última parte es alguien de casa, así que la
  primera es la persona de afuera. «Rodrigues - Augusto» → Rodrigues.
- **No adivina.** Los leads se ordenan poniendo primero los que comparten una
  palabra entera del nombre, pero elige una persona. Es la misma decisión de
  Duplicados y por el mismo motivo: juntar a dos personas distintas es el error
  caro. Si esa persona todavía no es lead, se crea desde ahí con el alta de
  siempre —con su detección de duplicados— y queda conectada al volver.
- **Conectado, el bloque se pinta como reunión y el clic abre la ficha.** Lo
  que no cambia es de quién es el evento: sigue siendo de Google, así que no se
  arrastra. Moverlo desde el CRM daría a entender que el CRM lo controla.
- **El vínculo sobrevive a la sincronización**: el reloj que trae los cambios
  de Google pisa título, horario y duración, y no toca el lead. Si el evento se
  cancela en Google, la fila se borra y el vínculo se va con ella — el evento
  es de Google y ocurrió o no ocurrió allá.
- **Borrar el lead no borra el evento** (`cascadeDelete: false`). El evento
  pasó; el CRM no es quien para hacerlo desaparecer. Queda suelto otra vez.

**Los bloques de otro calendario** dicen CUÁNDO y **de quién es la agenda**, y
nada más (→ D18). De quién es hace falta para poder agendarle algo; con quién
se reúne, no: eso sigue sin viajar al navegador, porque sale de la colección de
vista `ocupado` (§6.3). No se arrastran —no son tuyos—, no abren ficha y no
tienen tarjeta.

### 7.7 Vencimientos de mensajes

Overlay de a un lead por vez, con avance (`1 de 4`), para procesar los que vencen.

Muestra: cuenta y nombre, salto de etapa (`R3 → R4`), cuánto falta o hace cuánto venció, etiquetas, dos tarjetas (**Vencimiento** y **Próximo contacto** con la regla de cadencia al lado), datos de contexto (empresa, ciudad, mensajes, último contacto), chips de mensajes destacados (pastillas chicas `R + nombre corto`), el mensaje que toca con su idioma detectado, y los botones **Saltar** / **Aprobar**.

Un usuario sin `verTodosLeads` sólo ve acá los suyos.

### 7.8 Base compartida

Los perfiles ya invitados, con buscador, filtro por cuenta y etapa, y marca de duplicados entre cuentas. Nombre y empresa son links directos (perfil de LinkedIn, web de la empresa). Columnas separadas de Lugar y Resumen. Doble clic en «último R» abre el historial R1→R4 debajo de la fila.

### 7.9 Repositorio de mensajes

Sidebar. Lista de plantillas con nombre, texto por idioma (ES/PT/EN), estrella de destacado con su alcance (§3.5), orden arrastrable, alta y baja. **Cualquier edición se refleja al instante en Enviar mensaje, en Vencimientos y en Automatizaciones** — es el único lugar de verdad de los textos.

### 7.10 Otros paneles

- **Cuentas conectadas**: LinkedIn y WhatsApp por cuenta, con QR por cuenta y vincular otro número. Los estados son `activa` / `caída` / `sin vincular`.
- **Tareas**: la fila es una grilla — check, nombre, fechas, vencimiento, etiquetas, alertas y prioridad en columnas rectas.
- **Reglas y acciones rápidas**: las reglas de §3.8 y §5.9 con on/off y corridas de la semana, alta de reglas nuevas (disparador → condición → acción) y los avisos alrededor de la reunión (§5.11).
- **Notificaciones**: total sin leer entre Follow-up y WA Personal; al abrirlo lista cada uno con su canal (LI/WA) y salta a la ficha o a la pestaña.
- **Importar CSV**: reconoce países como código de 2 letras además del nombre completo; previsualiza y deja elegir qué filas entran.
- **Administrador de estados de proyecto**: nombre y significado de cada estado (§3.13.2). Accesible desde Control y desde la ficha del lead.
- **Duplicados**: los perfiles marcados por D02, enfrentados campo por campo, con
  dos modos —de a uno y en lista, para los que no tienen nada que decidir—.

  **El correo manda.** Cada tarjeta muestra el correo de sus leads con la
  cuenta de la que salió. Es el dato que decide: los perfiles que entraron del
  calendario traen el nombre que el invitado tenga puesto en Google —muchas
  veces sólo el nombre de pila— y con eso no alcanza para saber si dos «Jorge»
  son el mismo. El correo del evento sí, y vive en el lead (§3.2).

  Y avisa cuando **un mismo perfil tiene leads con correos distintos**: eso no
  es un duplicado, es un perfil que junta a dos personas porque la importación
  las agrupó por un nombre de pila compartido.

  **Se arregla en el mismo lugar donde se ve.** Cada correo es un botón: al
  tocarlo, ese lead queda marcado como de otra persona y, al fusionar, **sale a
  un perfil propio** con su reunión y su correo. Así el teléfono del CSV le
  llega a la persona correcta y las demás no se lo llevan puesto.

  El que sale **se queda con el mismo nombre**. No se le inventa uno a partir
  del correo: sigue siendo un «Jorge» de verdad, sólo que otro, y sacar
  «Jdeleonmx» de `jdeleonmx@yahoo.com.mx` sería cambiar un dato malo por uno
  peor. Se renombra desde su ficha cuando se sepa quién es.

  Nada se borra: los perfiles absorbidos quedan marcados con `fusionado_en`, y
  los separados son perfiles nuevos.

### 7.11 Control de proyectos

Dos pestañas — **Proyectos** y **Reuniones** — y una regla que atraviesa todo: **la sección entera es de solo lectura para cualquier rol**. Se edita en la ficha del lead; acá se mira. El header lo declara con una pastilla.

#### 7.11.1 Proyectos

- **Cinco tarjetas** de resumen: Activos · Propuesta enviada · Nuestra pelota · Congelados · Cerrados ganados.
- **Filtros en dos filas rotuladas**: Tipo y Estado. Cada chip muestra su conteo.
- **Tabla, una fila por proyecto, en dos líneas**:
  - **Línea 1** — Proyecto (nombre + empresa · contacto + icono de notas) · Tipo · Estado · Lugar (país / ciudad) · Industria y rol · Últ. reunión · Próximo contacto · Próxima acción. Con los **enlaces**: LinkedIn de la empresa, web de la empresa y perfil del prospecto — sin ellos hay que salir del CRM para ver con quién se está hablando. La **cuenta de origen** se muestra abreviada (`AL`, `DL`) y al pasar por encima dice el nombre completo.
  - **Línea 2 — tira de avance**: carrusel horizontal. Orden: primero las próximas acciones (destacadas en ámbar), después las actualizaciones de la más nueva a la más vieja, después las notas. Cada tarjeta lleva su etiqueta (Próxima acción / Actualización / Nota), la fecha y el texto. Se corre al costado; no se corta ni se colapsa. **Lo primero que se ve es lo que falta hacer.**
- **Icono de notas**: el mismo lenguaje visual que en la ficha del lead y que en la agenda. Prendido en acento cuando el proyecto tiene notas; en hover muestra la nota «Acerca de» del lead y la última nota del proyecto.
- Al pie, la **leyenda de los estados** con la regla de cada uno, que sale del administrador de estados (§3.13.2).
- Clic en la fila abre el **panel del proyecto** (derecha, máximo 720 px):
  - Grilla de datos: contacto, rol, empresa, industria, país y ciudad, cuenta, responsable, abierto, reuniones (con la fecha de la última) y si tiene ficha en el CRM.
  - **Tres columnas**: `Notas` · `Actualización del proyecto` · `Próximas acciones`. Notas y actualizaciones de la más nueva a la más vieja; acciones en orden de fecha.
  - Las **reuniones del proyecto**, numeradas, con estado.
  - La nota de la ficha del lead, textual.

#### 7.11.2 Reuniones

Período: **último mes / 3 meses / 6 meses**. **Todo** lo de abajo se recalcula al cambiarlo.

**Ocho tarjetas**: Reuniones · Asistieron (con %) · No asistió · Reagendadas · Con proyecto · **Conversión** (% de reuniones que terminaron en proyecto) · Empresas distintas · Promedio por semana.

- **Gráfico por mes**: una barra por mes del período. La barra entera es el total; la banda oscura de abajo es la porción que derivó en proyecto. Al pie: promedio por mes, mejor mes y duración promedio.
- **Agrupar por** (barras horizontales con conteo y %): país, ciudad, industria, rol, empresa, cuenta, quién la generó, estado, **día de la semana** y **franja horaria** (mañana 8–11, mediodía 11–14, tarde 14–17, última hora 17–20).
- **Tabla del período**, numerada: # · fecha · hora + duración · con quién (nombre y cargo) · empresa · lugar · industria · quién la generó · estado · nota.

Estados de reunión: `asistió`, `no asistió`, `reagendada`, `pendiente` (futura).

**Las reuniones futuras no cuentan**: todavía no pasaron, y contarlas inflaría la conversión con algo que no ocurrió.

#### 7.11.3 El header del Observador

Le quedan dos controles: el **chip de usuario** y el **tema**. Se ocultan notificaciones, tareas, agenda, vencimientos, repositorio y el menú `···`.

Y los datos de prospección **ni siquiera se piden** (§6.3.1).

#### 7.11.4 Criterios de aceptación

1. Entrar como Observador deja el header con dos controles (usuario y tema) y una sola pestaña, Control.
2. Un proyecto sin movimiento hace más de 30 días figura Congelado sin que nadie lo toque; al cargar una actualización sale de Congelado.
3. La columna Últ. reunión nunca dice «sin reuniones» si el conteo es mayor a cero: con reunión futura dice `programada DD/MM`.
4. La tira de avance de una fila se corre al costado y muestra, en orden: próximas acciones, actualizaciones (más nueva primero) y notas.
5. Cambiar el período en Reuniones recalcula las ocho tarjetas, el gráfico, el agrupador activo y la tabla.
6. Agrupar por día de la semana y por franja horaria devuelve conteos que suman el total del período.
7. Abrir un proyecto desde la ficha de un lead lo hace visible en Control sin recargar, con estado En conversación y su primer registro de actualización.
8. Apagar el permiso `control` a un usuario le saca la pestaña; prenderlo se la devuelve, sin tocar su rol.
9. Un partner con alcance por casa no recibe del servidor ni un teléfono, ni un email, ni un link — no alcanza con que la pantalla no los dibuje.

---

## 8. Integraciones

### 8.1 LinkedIn

Es la integración crítica y la más frágil. **No hay API pública** para invitar y mandar mensajes: la implementación real es automatización de sesión — Playwright con contexto persistente, **un proceso por cuenta**.

Consecuencias que el diseño ya asume:

- Las sesiones **se caen** y hay que mostrarlo (`estado_sesion`), acumular los envíos y avisar (§13.5).
- Los **cupos diarios** existen para no gatillar límites de la plataforma. Son configurables porque el límite real cambia.
- La **cancelación a los 90 días** existe para liberar el tope de invitaciones pendientes.
- **Requisito**: los envíos corren del lado del servidor/worker, no en la pestaña del usuario. La cola tiene que sobrevivir a que el navegador esté cerrado. Si depende de la pestaña abierta, el producto no funciona.

**El riesgo de IP.** Una sesión que siempre entró desde Argentina y de golpe opera desde un datacenter dispara verificación o bloqueo. Mitigaciones desde el día uno:

1. **Región del VPS lo más cerca posible del uso real.** Hostinger tiene São Paulo: para cuentas que prospectan Brasil es lo más creíble.
2. **Una sesión por cuenta, aislada**, con su propio directorio de perfil y sus cookies persistidas. Nunca compartir contexto entre cuentas.
3. **Rampa de calentamiento**: arrancar en 10–15 invitaciones por día por cuenta y subir de a poco hasta 40. `cupo_diario` es configurable justamente para esto.
4. **Horario humano**: los envíos se distribuyen en la franja laboral con intervalos irregulares, nunca en ráfaga.
5. **Vincular las cuentas por QR/login desde el VPS una sola vez** y no rotar IP después: lo que dispara alarmas es el cambio, más que la IP en sí.
6. **Proxy residencial por cuenta** queda como plan B si aparecen verificaciones, no como gasto inicial (~USD 5–15 por cuenta y mes).

Empezar por **una sola cuenta** durante dos semanas antes de mover las diez.

### 8.1.1 La corrida de invitaciones

Es lo que hace `apps/worker/` — la primera cosa que el worker sabe hacer, y por
ahora la única. Las reglas viven en `core/invitar.ts` con sus tests; el worker
sólo abre el navegador y ejecuta lo que core le dice.

**A quién le toca.** Una cuenta por vez, en orden de slot. De esa cuenta se toma
la lista de mayor prioridad que todavía tenga páginas (§3.4), y cuántas
invitaciones salen es el **mínimo entre tres cosas**: lo que queda del cupo
diario, lo que queda en la lista, y el tope de la corrida. El cupo manda, pero
sin material no hay invitación por más cupo que sobre.

**Los ocho frenos.** Antes de abrir nada se pregunta si la cuenta puede operar.
Si no puede, se dice cuál es el motivo y se termina **sin abrir el navegador**:

| Freno | Qué pasó |
|---|---|
| `pausa_general` | alguien apretó «todo en pausa» en §7.3 |
| `cooldown` | LinkedIn avisó algo y la cuenta está frenada hasta una fecha |
| `fuera_de_horario` | son las tres de la mañana |
| `sin_vincular` | la sesión nunca dio señal |
| `sesion_caida` | la sesión dio señal y dejó de darla |
| `sin_chrome` | no está cargado con qué perfil de Chrome se abre esa cuenta |
| `cupo_cumplido` | ya salieron las del día |
| `sin_material` | ninguna lista de la cuenta tiene páginas |

Se evalúan **en ese orden**, y el orden no es alfabético: primero lo que no se
discute y vale para todas las cuentas, después lo de la sesión, y al final lo
del trabajo. Una cuenta con todo mal a la vez tiene que decir «en pausa» y no
«sin material», porque arreglarle el material no la hace arrancar.

**El estado de la sesión no se declara: se deduce.** Se mira `ultima_senal_li`,
que el worker toca cada vez que LinkedIn contesta. `cuenta.estado_sesion` no se
lee — es un campo del seed que decía «activa» en cinco cuentas que nunca
tuvieron una sesión detrás.

**El ritmo.** Todos estos números son **configuración, no constantes**, y se
editan en §7.3. Los valores iniciales salen de `globalita-automation`, donde
estuvieron en producción:

| | Inicial | Para qué |
|---|---|---|
| espera entre una y otra | 3–9 s, sorteada | que no haya dos iguales |
| pausa media | cada 30, de 90–180 s | un descanso corto |
| pausa larga | cada 50, de 180–300 s | cortar el patrón del bucle sostenido |
| reinicio del navegador | cada 40 | limpia la huella acumulada en el proceso |
| mirar señales de bloqueo | cada 10 | enterarse antes, no después |
| tope de la corrida | 40 | para seguir se vuelve a correr el proceso |
| espera de arranque | 10–20 s | abrir y disparar en el mismo instante es la firma más barata que hay |
| franja horaria | 08:00–22:00 | fuera de eso no hay nadie trabajando |

Cuando la pausa media y la larga caen en el mismo número —a las 150, con 30 y
50— **salen las dos**. Acortarlo sería aflojar una medida anti-detección sin
ninguna razón nueva.

**La espera se ajusta a cómo contesta LinkedIn**, y la intuición va al revés de
lo que parece: que conteste **muy rápido** (menos de medio segundo) es mala
señal —eso no es una persona navegando, y suele ser caché servido a un cliente
ya marcado— así que se espera entre 1,5 y 2 veces más. Cuando contesta lento
(2–4 s) se aprovecha, porque el ritmo ya es humano por sí solo. Y cuando
contesta muy lento (más de 4 s) se frena 2 a 3 veces más: eso no es la red, es
estrangulamiento, y es lo que precede al bloqueo.

**Cuando LinkedIn avisa** se corta, no se insiste. La gravedad cambia el freno:

| Aviso | Freno de la cuenta | ¿Para todo? |
|---|---|---|
| verificación de que sos humano | 24 h | no |
| actividad inusual | 24 h | no |
| uso de una herramienta de automatización | **72 h** | **sí** |
| cuenta restringida | **168 h** (una semana) | **sí** |

Los dos graves paran **todas** las cuentas y no sólo la avisada: las vecinas
salen de la misma IP, así que si LinkedIn marcó una, las otras ya están
miradas. La pausa que se activa es la **misma** de §7.3, la que se ve en
pantalla — un freno de emergencia invisible es un freno que alguien levanta sin
enterarse de por qué estaba puesto.

**Qué queda anotado.** Cada invitación que sale escribe tres cosas en la base:
el `perfil` (la persona, deduplicada por §14 · D02), el `lead` con su
`f_invitacion`, y un `envio` con `paso = R0`. **Nada de esto va a un archivo
local.** En el repositorio viejo el historial vivía en `history.json` y las
cuotas en `quota-invitar.json`, los dos en la raíz y los dos en el disco que se
formateó el 03/09.

Y lo que salió hoy se cuenta **desde los envíos R0 de hoy**, no desde un
contador aparte: un contador aparte se desincroniza con la realidad cada vez
que un proceso muere a la mitad, y nadie se entera.

**Lo que esta corrida NO hace todavía**: no escribe nota en la invitación (el
texto de R0 sale del repositorio de mensajes, §5.2, y falta decidir si va con
nota), no maneja el caso en que LinkedIn exige el correo para poder invitar —el
perfil se saltea—, no cancela (§5.4) y no corre solo: se dispara a mano.

### 8.2 WhatsApp

Vinculación por **QR por cuenta** (sesión de WhatsApp Web). Se necesita:

- Estado de sesión por cuenta y aviso cuando cae.
- Recepción de entrantes y el ruteo de §5.8.
- Acks de mensaje (`enviado` / `entregado` / `leído`).
- Acceso directo a `wa.me/<número>` como salida de escape cuando conviene escribir a mano.

### 8.3 Google Calendar

- Las reuniones creadas en el CRM se escriben en el calendario del usuario elegido.
- **De quién es ese calendario**: primero `reunion.calendario` —lo que eligió la pantalla al agendar, que es el usuario que estaba agendando— y sólo si está vacío, `lead.asignado`. El orden importa y no es teórico: mirando únicamente el asignado, esto **no funcionaba nunca**, porque la asignación es opcional y los 242 leads la tienen vacía; toda reunión nueva moría con «el lead no tiene a nadie asignado» y jamás llegaba a Google. Además `calendario` es el campo del que sale la vista `ocupado`: si el evento se escribiera en una agenda distinta de la que dibuja la grilla, la pantalla estaría mintiendo. Cuando la reunión se sincroniza y `calendario` estaba vacío, se completa con el dueño que se usó — y nunca se pisa uno que ya estaba.
- Los eventos existentes se leen como **bloqueos** para calcular disponibilidad. Lo que se muestra de un calendario ajeno es «Ocupado», sin nombre (→ D18).
- Cambiar hora, fecha o duración desde la agenda **actualiza** el evento; la interfaz confirma con «Calendar actualizado». Toda escritura es un upsert por `google_event_id` (→ D10). **Y le avisa al invitado**: todas las escrituras salen con `sendUpdates=all`, así que Google le manda el correo de actualización al lead.
- **La sincronización es de ida y de vuelta.** Lo que cambia en Google Calendar cambia en el CRM: si la reunión se mueve, se estira o se borra desde el celular —que es donde uno la mueve cuando el cliente pide correrla—, la agenda del CRM se entera. Sin esto la agenda mentía y no había forma de notarlo desde adentro: mostraba el horario viejo para siempre.

  **Cómo entra**: un reloj cada cinco minutos (`cronAdd`) pide a Google **sólo lo que cambió**, con `syncToken`. El token importa: sin él habría que pedir la ventana entera cada vuelta y, sobre todo, **no habría forma de enterarse de un evento borrado** — un evento borrado simplemente no aparece en un listado. Con token viene explícito, con `status: "cancelled"`. Cuando el token caduca Google contesta 410, y entonces se vacía y se vuelve a listar de cero.

  **Por qué un reloj y no un aviso empujado.** Google sabe empujar los cambios (`events.watch`), pero necesita una URL pública con HTTPS y hay que renovarle el canal cada siete días. El CRM todavía no está publicado, así que un aviso empujado ni se podría probar. El día que convenga empujar, lo que cambia es quién dispara: el pedido incremental y la escritura quedan iguales.

  **Las dos trampas de esto**, que explican todo el cuidado del código:
  1. **Eco infinito.** Escribir la reunión con `$app.save()` dispara el hook de salida, que la manda a Google, que en la vuelta siguiente vuelve como un cambio. Por eso la vuelta escribe con **SQL plano**, que no dispara hooks — el mismo motivo por el que `anotar()` escribe así.
  2. **Mails al lead.** Como cada escritura hacia Google sale con `sendUpdates=all`, un falso «cambió» no es ruido en un log: es un correo de más en la casilla de un cliente, cada cinco minutos. Por eso la comparación es **por instante, no por texto**: `2026-09-15 16:00:00.000Z` y `2026-09-15T10:00:00-06:00` son la misma hora, y compararlas como strings las haría distintas siempre.

  **Lo que la vuelta NO hace**: no resucita una reunión cancelada en el CRM. Cancelar es una decisión que se toma acá y hoy no borra el evento de Google, así que el reloj lo va a encontrar vivo en cada vuelta; si eso la reactivara, cancelar sería imposible. Y no crea reuniones nuevas a partir de eventos que el CRM no conoce: el calendario tiene la vida entera de la persona, no sólo prospección.

  La regla —qué significa que un evento haya cambiado— vive en `core/sincronizar.ts` con sus tests. **Está escrita dos veces**: el motor JS de PocketBase no puede cargar TypeScript y los hooks no tienen paso de build, así que `pb_hooks/google.js` lleva un espejo en JavaScript plano. Lo que impide que se separen es un test que **carga el archivo del hook de verdad** y le exige la misma respuesta que a la de core en diez casos (`espejo-del-hook.test.ts`).
- Reenviar la invitación del evento al lead es una **acción explícita**.
- **La disponibilidad de alguien que no es usuario del CRM** (el caso de
  Alberto) entra por el mismo lugar que la de un administrador con cuenta
  conectada: como filas que `ocupado` pueda devolver. Hoy `ocupado` es una
  vista sobre `reunion`, así que un calendario externo necesita una tabla
  propia y que la vista sea la unión de las dos. La agenda ya las dibuja sin
  tocar una línea: el punto de encastre está hecho (§7.6).

  **Un link de `calendar.app.google` no sirve para esto.** Redirige a
  `/calendar/appointments/schedules/…`: es una **página de reserva** de Google,
  la que se le manda a alguien para que elija un hueco. Muestra lo LIBRE, no lo
  ocupado; se arma con JavaScript y no tiene API. Es útil para mandársela a un
  lead, no para que el CRM calcule disponibilidad.

  **Para la cuenta AL el problema no existe, y se descubrió tarde.** El
  09/09/2026, mirando la lista de calendarios de la cuenta de Google de Augusto,
  aparece `alejandroc@globalita.io` con `accessRole: "owner"`. No hay que
  pedirle nada ni raspar ninguna página: el calendario de Alejandro **ya se lee
  con la misma conexión OAuth de Augusto**, y lo único que faltaba era pedir el
  alcance `calendar.readonly` junto con `calendar.events` — que ahora se piden
  juntos, porque agregar un alcance después obliga a reconectar a todo el mundo.

  Antes de eso se habían planteado tres caminos —que compartiera el calendario,
  su dirección privada `…/basic.ics`, o raspar la página de reserva— y se llegó a
  decidir el tercero. **Ninguno hacía falta.** Queda anotado porque el error fue
  de método: se discutió tres veces cómo conseguir un acceso que ya estaba, sin
  haber mirado la lista de calendarios una sola vez.

  **Lo que sí queda pendiente** es una agenda de alguien que NO esté en la lista
  de calendarios de la cuenta conectada. Para ese caso siguen valiendo las dos
  formas limpias —compartir el calendario, o la dirección `…/basic.ics`— y sigue
  siendo cierto que un link de `calendar.app.google` no sirve. Raspar la página
  de reserva es el último recurso: Google la cambia cuando quiere y se rompe sin
  avisar, y la falla se ve como «no hay huecos» en vez de como un error.
- **Se conecta desde Cuentas conectadas**, en una tercera sección aparte de LinkedIn y WhatsApp. No es lo mismo: esas dos son una sesión **por cuenta de prospección**, y Google es una cuenta **por persona del CRM**. La pantalla muestra el estado (sin configurar / sin conectar / conectada, con el correo), y de consecuencia dice cuántas reuniones futuras todavía no llegaron al calendario.
- **Son dos URL de configuración, y en producción son la misma.** `APP_URL` es donde la persona ve la aplicación —ahí vuelve el navegador después de dar el permiso— y `PB_URL` es donde contesta PocketBase, que es lo único que le importa a Google: el `redirect_uri` tiene que apuntar a una ruta de este servidor. En el VPS PocketBase sirve la app, así que alcanza con `APP_URL`. En desarrollo son distintas (Vite en `:5173`, PocketBase en `:8090`) y sin separarlas la vuelta de Google aterriza en un 404: la conexión queda guardada pero parece que falló.
- **El resultado vuelve por la URL.** El callback no puede devolver una pantalla —ahí llega el navegador redirigido desde Google—, así que deja `/?google=…` y la aplicación lo levanta al arrancar, abre Cuentas conectadas y lo muestra. El parámetro se saca de la URL apenas se lee: si quedara, recargar la página volvería a decir «conectado» sin que nadie se haya conectado.
- **El `refresh_token` no sale nunca por la API.** La colección que guarda la cuenta de Google tiene todas las reglas en `null`: sólo el servidor la lee. Y el `client_secret` no vive en ningún archivo del repo: en desarrollo va en `.env` (ignorado por git) y en el VPS en `/etc/crm-globalita.env` con `chmod 600`, que el servicio levanta con `EnvironmentFile`. El repo es público y un secreto que estuvo en un commit hay que rotarlo aunque después se borre.

### 8.4 CSV

Importación de leads con detección de país por código de 2 letras o nombre completo, y carga masiva de teléfonos. Previsualiza y deja elegir qué filas entran.

### 8.5 Gmail

Decisión cerrada: queda como **estado de interfaz simple** (un toggle en WA Personal), sin pantalla de permisos ni elección de cuenta.

### 8.6 Nota sobre múltiples administradores

Nada en el modelo de calendarios debe asumir un solo administrador: los bloques
«Ocupado» se arman con **todos** los usuarios con rol `Administrador` activos
menos el que mira, y se suman a la grilla propia. Si se suma un tercero,
aparece solo, sin tocar código.

Antes se elegía **uno** con un chip. Se sacó el 09/09/2026: elegir de a uno era
responder a medias la única pregunta que se le hace a la agenda cuando se va a
agendar —dónde entra la reunión en las dos agendas—, y obligaba a mirar la
misma semana dos veces.

---

## 9. Atajos de teclado y detalles de UX

### 9.1 Atajos

| Tecla | Acción | Tecla | Acción |
|---|---|---|---|
| `A` | Guardar la ficha | `H` | Abrir el chat real del canal |
| `S` | Enviar el mensaje escrito (→ D30) | `V` | Abrir el perfil de LinkedIn |
| `D` | Fecha de próximo contacto | `C` / `Z` / `Ctrl+Z` | Deshacer |
| `R` | Fecha de reunión | | |
| `F` | Cambiar canal de envío | | |
| `G` | Abrir/cerrar la conversación | | |

Dentro del calendario de próximo contacto, `A S D F` pasan a ser 1, 2, 3 y 4 semanas.

Los atajos se **ignoran** cuando el foco está en un `input`, `textarea`, `select` o campo editable.

### 9.2 Deshacer y revertir

- Toda edición de la ficha apila su estado anterior.
- El botón **Deshacer** del header del detalle saca el último cambio; **guardar limpia la pila**.
- En el log de ediciones, cada campo revertible tiene su propio botón **revertir**.
- Un envío de mensaje (§5.10) entra como **una sola** edición, aunque toque varios campos (→ D21).

### 9.3 Cambios sin guardar

Cambiar de sección o de lead con cambios pendientes dispara el aviso, con opciones de **descartar** o **volver**. Los campos se siguen viendo en vivo mientras se editan; lo que no puede pasar es cruzar de sección sin decidir qué hacer con lo pendiente.

### 9.4 Anchos arrastrables

Columna 1 (260–520, normal 340), agenda (340–900, normal 560) y repositorio (300–620, normal 400). Cada uno con doble clic para volver al ancho normal y persistencia local.

### 9.5 Popovers

Los popovers grandes (filtros, próximo contacto, histórico) se posicionan con coordenadas calculadas desde el botón (`position: fixed`), para que no los recorte el scroll de la columna.

### 9.6 Color, densidad y temas

Tres temas: claro, oscuro y **noche** (cálido, menos contraste). El botón del header cicla claro → oscuro → noche.

**Todo el color pasa por `apps/web/public/design-tokens.css`**, que es el único archivo de tokens. No hay colores sueltos. Colores de marca fijos: LinkedIn azul, WhatsApp verde. En modo oscuro el acento se aclara para que el texto sobre acento mantenga contraste.

**La densidad es el diseño, no un detalle del diseño.** El objetivo es una laptop de 14" donde se trabaja todo el día. Los tamaños de texto son 9, 10, 11, 12, 13, 14 y 17 px, sin escalar; los bordes son de `.5px`, no de 1. Tomar sólo los colores del prototipo y maquetar de cero da algo que funciona pero se ve distinto, y la diferencia se nota sobre todo acá.

### 9.7 Estados vacíos y deshabilitados

Preferir **deshabilitado con motivo** antes que oculto: WhatsApp sin teléfono se muestra tachado con el título «Sin teléfono cargado», no desaparece. **Los permisos son la excepción**: lo que un usuario no puede usar, no se muestra.

---

## 10. Casos borde y decisiones ya tomadas

Estas son decisiones cerradas. Cambiarlas es rediseñar, no corregir.

1. **Los leads son compartidos.** El administrador ve todos siempre. No hay «devolver al administrador»: reasignar es directo.
2. **Las conversaciones de leads no viven en WA Personal.** Están en la ficha y en la columna 1.
3. **Un entrante que coincide con un lead ya cargado no crea nada**: entra al follow-up y en WA Personal sólo queda el aviso.
4. **La última página vista de una lista es un dato de la automatización**, no un campo editable.
5. **Las listas de invitación se reordenan con flechas, no con drag.**
6. **Los textos de los R salen del repositorio**, nunca de constantes en el código.
7. **Al enviar, la próxima fecha se propone, no se fija.**
8. **Gmail queda como toggle de interfaz**, sin flujo de permisos.
9. **El nombre del lead se guarda completo** aunque traiga el cargo adentro y mida 120 caracteres. Se trunca en la vista, nunca en el dato.
10. **Aceptadas se cuenta por fecha de aceptación**, no de envío.
11. **Los cupos son por cuenta.** No existe un cupo global.
12. **Domingo no se muestra en la agenda.** Sábado sí, en gris.
13. **El rol es un preset de permisos, no una jaula.** Cualquier permiso se puede prender o apagar por usuario.
14. **Retención del log de actividad: 90 días.**
15. **Un lead que responde sale de la cadencia automática.**
16. **La cola de envíos tiene que correr del lado del servidor.**
17. **Un proyecto se abre a mano**, nunca solo (§5.12).
18. **Control es sólo lectura** para todos los roles (§7.11).
19. **Congelado se calcula, no se guarda** (§3.13.2).
20. **La casa sale de la cuenta**, no de una etiqueta ni de un campo aparte (§3.3).
21. **El alcance se aplica en el servidor**, nunca al dibujar (§6.3.1).
22. **La traducción al portugués** es transversal: parte de la operación se lee en portugués.
23. **La misma persona en dos cuentas son dos leads y un solo perfil** (→ D27).
24. **El Observador no ve datos de contacto**: ni teléfono, ni email, ni links, ni conversaciones.

---

## 11. Orden de construcción

Cada etapa deja algo usable. El criterio: primero lo que hace que el equipo pueda trabajar aunque falte todo lo demás.

**Etapa 1 — El lead y su ficha.** Modelo de Perfil, Lead, Cuenta y Etiqueta. Login y sesión. Follow-up con columna 1 (lista, buscador, filtros) y columna 2 (ficha completa, edición con deshacer, log). Sin automatización: todo a mano. Con esto el equipo ya puede reemplazar la planilla.

**Etapa 2 — Los textos y el envío manual.** Repositorio con idiomas y destacados. Enviar mensaje desde la ficha, con registro en `envio`. Conversaciones en la ficha. Idioma sugerido y normalización de teléfono.

**Etapa 3 — El calendario.** Reunión en la ficha, agenda con las tres vistas, Google Calendar (escribir y leer bloqueos), estados de asistencia e historial.

**Etapa 4 — La cadencia y el control.** Próximo contacto, cadencia R1–R8 configurable, Vencimientos, reglas de fábrica, proyectos y la sección Control. Acá el sistema empieza a empujar el trabajo en lugar de sólo registrarlo.

**Etapa 5 — Las invitaciones.** Cuentas, listas con prioridad y páginas, cupos, R0, cancelación a 90 días y recontacto a 60. Es la etapa con más riesgo técnico (§8.1): conviene aislarla detrás de una interfaz de worker desde el principio.

**Etapa 6 — El equipo.** Usuarios, los 19 permisos, asignación, asignación masiva, calendarios por administrador, log de actividad.

**Etapa 7 — La medición.** Métricas semanales por cuenta, rendimiento por R, cuándo responden, qué perfiles y qué industrias convierten, qué variante rinde, qué páginas rinden. Los datos ya se venían guardando desde la etapa 2.

**Transversal, desde el día uno:** los tres temas, los atajos, el aviso de cambios sin guardar, la escala de la columna 1 (renderizar de a 80) y los backups (§13.2). Meterlos al final cuesta el triple.

**El orden real de construcción es otro, y lo decidió Augusto**: primero **todo
el diseño, con datos falsos**, para poder verlo entero; las integraciones al
final. El criterio es que mirar las 29 pantallas con datos adentro es lo único
que permite decidir si el diseño está bien **antes** de invertir en la plomería:
una integración sobre una pantalla que después cambia es trabajo tirado. Cada
pantalla necesita tres cosas —su colección, sus datos de demo y la pantalla— y
las tres van juntas.

Las etapas de arriba siguen valiendo como orden de **dependencias**: qué
necesita qué. No como cronograma.

---

## 12. Datos de demo

El prototipo usa constantes estáticas con fecha fija: **hoy es 04/09/2026**. Sirven como semilla de pruebas.

- **6 leads** que cubren los casos interesantes: uno que respondió rápido y frenó por el área de compras (DL, R3); el más avanzado, con reunión agendada (AL, R2); uno que aceptó y nunca respondió, ya en Fase 2 (FR); una decisora que escribió ella primero y espera respuesta (ED, R1, con un **nombre deliberadamente larguísimo** para probar el truncado); un referido que llegó por WhatsApp y ya tuvo la reunión (AU, R4); y una que respondió tarde y no asistió (AMU, R5).
- **6 cuentas vinculadas** de 10 slots. `AMU` con la sesión de WhatsApp caída y 3 envíos frenados: es el caso que prueba los avisos de sesión.
- **4 usuarios**: un administrador, una colaboradora activa, uno pendiente y una suspendida.
- **10 plantillas** en el repositorio (R0–R8 más agradecimiento post reunión), con textos en español y algunos en portugués.
- **Base compartida** con 27.412 perfiles declarados y una muestra cargada, incluyendo duplicados entre cuentas.

> **Los teléfonos de la demo son inventados y están enmascarados.** El
> repositorio es público: ningún CSV, ningún export de calendario y ningún dato
> real de una persona puede entrar acá.

---

## 13. Operación

### 13.1 Despliegue

**Decidido**: VPS de Hostinger (→ D35). Todo corre ahí: base, API, web y los workers.

| Proceso | Qué hace |
|---|---|
| `api` | backend + auth + sirve la web construida |
| `worker-cola` | consume la cola de envíos: mensajes de cadencia, recordatorios, agradecimientos |
| `worker-cuenta-{abrev}` | una instancia por cuenta de LinkedIn/WhatsApp, aislada |
| `backup` | dump diario y subida fuera del VPS |

Pendiente de confirmar: **región del VPS** (São Paulo si está disponible, por §8.1), **dominio y HTTPS** —sin dominio propio las sesiones y el QR quedan sobre IP pelada— y **recursos**: los navegadores headless son lo que consume RAM, así que con 10 cuentas conviene medir con una antes de dimensionar.

### 13.2 Backups

No es una feature: es lo que evita repetir la pérdida de datos de septiembre de 2026.

**Regla: tres copias de todo.** Local + GitHub + Drive. Un commit sin push no cuenta.

| Qué | Dónde vive | Frecuencia |
|---|---|---|
| Base de datos | VPS | diaria, automática |
| Sesiones de LinkedIn/WhatsApp (perfiles de navegador) | VPS | semanal — recuperarlas evita revincular 10 cuentas por QR |
| Fotos y adjuntos | VPS | diaria |
| Código y documentación | GitHub | en cada push |
| Variables de entorno y secretos | fuera del repo | manual, documentado |

**Un backup que nunca se restauró no es un backup.** Probar una restauración completa **antes** de cargar los 27.000 perfiles reales, y después una vez por trimestre.

### 13.3 La base de desarrollo también se cuida

La base local no es «descartable». Es donde se prueba con los datos reales
recuperados —los contactos del CSV y el histórico de Calendar— y volver a
armarla cuesta correr dos imports que dependen de archivos que existen en una
sola máquina.

**Nada se borra sin una copia antes.** `dev.mjs --reset` copia el directorio
entero de PocketBase a `.pb/copias/` antes de tocar nada, y **se niega** si la
base tiene leads que no vienen del seed. Insistir requiere escribir
`--si-quiero-borrar-datos-reales`, que nadie tipea por inercia.

Para arrancar limpio sin destruir lo que hay: `PB_DATOS=.pb/pb_data_limpia`.

| Para | Comando |
|---|---|
| Copiar ahora | `node packages/db/dev.mjs --copia` |
| Ver las copias, con cuántos leads tiene cada una | `node packages/db/dev.mjs --copias` |
| Volver a una | `node packages/db/restaurar.mjs <nombre>` |

Restaurar también copia lo que había antes de pisarlo: restaurar la copia
equivocada no pierde nada.

> **Las copias viven sólo en el disco local**, porque tienen datos reales y el
> repositorio es público (§13.4). El esquema de tres copias del §13.2 no las
> cubre: si se rompe el disco, se van. Lo que las reconstruye son los archivos
> de `packages/db/recuperacion/`, que están en la misma máquina — así que
> **esos** sí conviene tenerlos en Drive.

### 13.4 El repositorio es público

`github.com/Augustomu/CRMGlobalita` es público. No se commitean: CSV de contactos, exports de calendario, nombres, teléfonos ni emails reales. Los datos de recuperación viven en `packages/db/recuperacion/`, que está en `.gitignore`, y los teléfonos de la demo son inventados.

> **Pendiente y conocido (08/09/2026).** El bundle del prototipo
> —`docs/_bundle/CRM de prospeccion.html`, que **sí** está commiteado— trae
> adentro un documento con teléfonos y un email **reales**. No se ven al abrir
> el archivo porque es un ZIP, pero eso no es protección: cualquiera que clone
> el repo y corra `node docs/desempacar.mjs` los tiene. La copia que estaba
> suelta en `docs/` ya estaba enmascarada; la de adentro del bundle no.
> Anotado en `docs/PENDIENTES.md` — arreglarlo es re-exportar el bundle con
> los datos enmascarados, y decidir aparte si vale la pena limpiar el
> historial.

### 13.5 Sesiones caídas

Cada cuenta tiene dos sesiones independientes: **LinkedIn** (`estado_sesion`) y **WhatsApp** (`sesion_wa`, por QR).

Cuando una cae:

- La cuenta **queda en cero** y sus envíos **se acumulan, no se pierden**.
- La interfaz muestra el chip **«sesión caída»** y sugiere una **tarea automática** para revincular.
- El panel *Cuentas conectadas* ofrece el QR para volver a vincular.

### 13.6 Un solo planificador por cuenta

El cupo de invitaciones, el tope de cancelaciones y la cola de seguimiento **comparten la misma sesión de LinkedIn**. Por eso hay un planificador por cuenta y no tres colas independientes (→ D31): los mensajes salen primero, las invitaciones últimas.

---

## 14. Las decisiones, una por una

Cada una tiene su problema y su resolución. Las **cerradas** no se rediscuten: cambiarlas es rediseñar. Las **abiertas** tienen una recomendación aplicada por defecto, y elegir distinto cuesta un refactor — preguntar antes de asumir.

| # | Qué se preguntaba | Estado | Qué quedó |
|---|---|---|---|
| D01 | ¿La base compartida es tabla propia o proyección del lead? | cerrada | Tabla `perfil` (identidad) + tabla `lead` (el trabajo de una cuenta). La base compartida es una consulta |
| D02 | ¿Cuál es la clave para deduplicar perfiles? | cerrada | `slug` y `urn` únicos nullable; `huella` (nombre+empresa normalizados) sólo sugiere. **La fusión nunca es automática** |
| D03 | ¿Cuándo se canceló una invitación? | cerrada | Campo `cancelada_en` + situación `esperando_recontacto` |
| D04 | «Fase 2» era etapa y etiqueta a la vez | cerrada | No es un estado: es estar en R5–R8. Si un dato decide qué hace el sistema es estado; si sólo sirve para filtrar es etiqueta |
| D05 | Un lead con no leídos en los dos canales | cerrada | Dos flags, `sin_leer_li` y `sin_leer_wa` |
| D06 | `envio[]` vs `mensajes_li[]`: ¿cuál manda? | abierta | La analítica lee **sólo** `envio[]`; la conversación es el espejo del hilo real |
| D07 | Lead sin asignar con varios administradores | abierta | Pool sin dueño, visible para todos los administradores |
| D08 | ¿Cómo se rutea un WhatsApp entrante? | cerrada | El teléfono se mudó a `perfil`: una búsqueda por E.164, cuatro resultados posibles (§5.8) |
| D09 | El idioma se re-deducía y perdía el override | cerrada | Campo `idioma` en el lead; vacío = deducción por país |
| D10 | Reagendar creaba eventos duplicados en Calendar | abierta | Guardar `google_event_id` y `google_calendar_id`; toda escritura es upsert |
| D11 | `demora_reunion` con reuniones reagendadas | abierta | Medir contra la **primera** reunión agendada |
| D12 | `demora_respuesta` sin aceptación | abierta | Caer al primer envío nuestro; si el lead escribió primero, no aplica y se muestra vacío, no cero |
| D13 | Loops en el motor de reglas | abierta | Profundidad 1, sin re-disparo en la misma transacción, tope por semana |
| D14 | ¿Qué pasa con los leads al suspender a alguien? | abierta | Quedan, pero se avisa y se ofrece reasignar |
| D15 | Fase 2: ¿+28 o +90 días? | cerrada | 90 desde el envío de R4; los 90 **reemplazan** la espera de 28 |
| D16 | ¿Una plantilla por paso? | cerrada | Campo `paso` independiente del nombre; varias por paso, una por defecto |
| D17 | `etapa` no alcanzaba para el estado real | cerrada | Dos ejes: `etapa` (dónde está) y `situacion` (qué hacer con él) |
| D18 | ¿El colaborador ve el nombre del evento del admin? | abierta | El nombre del evento, sólo en el calendario propio. Del ajeno se dice de QUIÉN es la agenda (nombre de pila) y el horario: hace falta para agendarle, y con quién se reúne sigue sin viajar al navegador (09/09/2026) |
| D19 | WA Personal no tenía permiso propio | cerrada | El chat personal pertenece a la cuenta de WhatsApp que lo recibió |
| D20 | Un colaborador con `usuarios` se da todo | abierta | No se editan los permisos propios; sólo un admin otorga `usuarios` |
| D21 | ¿Deshacer un envío deshace el mensaje? | abierta | Revierte los campos, no el mensaje — y lo dice |
| D22 | «Rol» significa dos cosas | abierta | El del perfil se llama `cargo`; `rol` queda para el usuario |
| D23 | Zona horaria de la reunión | abierta | Timestamp con zona + la zona del lead. Todo pasa por `enSuZona()` |
| D24 | ¿Con qué texto vuelve un recontacto? | abierta | Paso `R0-recontacto` en el repositorio |
| D25 | ¿En qué zona corta la semana? | abierta | `America/Argentina/Buenos_Aires` para todo el sistema |
| D26 | ¿A qué cuenta va el lead creado desde un entrante? | abierta | La cuenta que recibió el mensaje |
| D27 | El mismo perfil en dos cuentas | cerrada | Un perfil compartido, un lead por cuenta |
| D28 | Países que faltaban en el idioma | cerrada | `es` y `pt` ampliados; `en` es el default fuera de la región, no una lista propia |
| D29 | La normalización de teléfono era de mentira | cerrada | Normalizador propio para los 12 países; un teléfono inválido **no bloquea** al lead |
| D30 | `S` envía sin confirmar | abierta | Ventana de arrepentimiento de 5 segundos |
| D31 | Tres colas compitiendo por la misma sesión | cerrada | Un planificador por cuenta; mensajes primero, invitaciones últimas |
| D32 | ¿Desde cuándo hay export y backup? | cerrada | Los dos desde la etapa 1 |
| D33 | ¿Se borran leads? | cerrada | Se **descartan**, no se borran. Y `no_contactar` vive en el perfil, así que frena a las 10 cuentas de una |
| D34 | Stack | cerrada | PocketBase + React/Vite + worker Node |
| D35 | ¿Dónde corren los workers? | cerrada | Todo en el VPS de Hostinger |
| D36 | ¿El alcance de Control es por casa o por cuenta? | cerrada | **Tres formas**: todo, por casa (sin datos de contacto), por cuenta (con datos). §6.3.1 |
| D37 | ¿Un lead se asigna a una persona o a varias? | cerrada | **Responsable** (uno) + **acompañantes**. §6.5 |
| D38 | El alcance de los mensajes destacados | cerrada | Cuatro formas, incluida `casa:` — la cuenta nueva hereda los destacados sola. §3.5 |

---

## 15. Registro de cambios

### 08/09/2026 — consolidación

Este archivo pasa a ser **el documento único**. Absorbió `MANUAL-control-proyectos.md` (§3.13, §5.12, §6.3.1, §7.11), las notas del vault de negocio, modelo, pantallas y operación (§3, §5, §9, §13) y las 38 decisiones (§14). Los archivos que quedaron vacíos de contenido propio se borraron: tener el mismo párrafo en dos lugares es lo que hizo falta arreglar.

### 08/09/2026 — decisiones de Augusto sobre la app andando

| § | Cambio | Por qué |
|---|---|---|
| 3.5 | El destacado suma el alcance **por casa** | Con una lista de cuentas, la que se sume mañana empieza sin ningún destacado y nadie se entera |
| 6.1 | Las claves pasan de 15 a **19**: se separan `verTelefono`, `verEmails`, `verLinks`, `verConversaciones` | §10.24 pide que el Observador no vea datos de contacto y §10.13 pide decidirlo por persona. Metido en el rol, «que Vera no vea teléfonos» obligaba a inventarle un rol |
| 6.2 | Los **presets de rol** se van a poder editar desde Usuarios | Al invitar a alguien como Colaborador hay que saber qué trae, sin mirar el código |
| 6.3.1 | El alcance de Control suma **por cuenta**, además de por casa | El dueño de una cuenta quiere ver Control como lo ve el partner, pero sólo lo suyo — y **con** datos de contacto, porque son sus leads |
| 6.5 | Un lead puede tener **responsable y acompañantes** | Varias personas trabajan el mismo lead; la columna 1 tiene lugar para un chip, así que uno responde y el resto acompaña |
| 7.2 | Etiquetas y Log de ediciones vuelven a ser **iconos**, no bloques | Como bloques empujaban Enviar mensaje hacia abajo, que es lo que se usa todo el día |
| 7.2 | El **switch de canal manda de verdad**, y el paso se muestra como **secuencia con tildes** | El desplegable decía qué paso tocaba pero no dejaba elegir el canal; la secuencia muestra de un vistazo qué se mandó y qué falta |
| 7.2 | La lista muestra cuenta, último mensaje (R o `FU`), etiquetas, WhatsApp y agente; lo que no entra va al hover | Con 1.500 leads la fila decide si hay que abrir la ficha o no |
| 7.6 | La agenda se comporta **como Google Calendar**: el bloque mide lo que dura y cruza las horas que ocupa | Es el patrón que el equipo ya tiene en la mano |
| 7.10 | **Administrador de estados** de proyecto, con nombre y significado | Los estados los lee gente que no los definió; la leyenda tiene que salir del mismo lugar donde se escriben |
| 7.11 | En la tabla de Control: enlaces, nombre completo de la cuenta en el hover, sin la columna de cantidad de reuniones, con notas, histórico y etiquetas | Sin los enlaces hay que salir del CRM para ver con quién se está hablando |
| 10.22 | **Portugués** | Parte de la operación se lee en portugués |

### Qué falta

`docs/PENDIENTES.md`. Lo de acá es lo que ya está **decidido**; lo de allá es lo que falta **hacer**.
