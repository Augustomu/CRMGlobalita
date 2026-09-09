# Pendientes

Lo decidido y todavía no hecho. La especificación —cómo tiene que ser— está
entera en `docs/MANUAL.md`. Acá va sólo lo que falta hacer.

Última revisión: **08/09/2026**, después de la recorrida de Augusto por la app.

> **Cómo leer esto.** Los ⚠️ son choques con el manual o el prototipo: hay que
> decidir cuál gana antes de tocarlos. Los ❓ son preguntas que no puedo
> responder yo. El resto es trabajo.

---

## 0 · Decisiones

### ✅ Cerradas el 08/09 — ya están en el manual

- **Asignación múltiple**: responsable (uno) + acompañantes. `verTodosLeads`
  pasa a leerse *«sólo ve los leads en los que figura»*. → [[D27-asignacion-multiple]]
- **El alcance de Control tiene tres formas**: todo, por casa, y **por
  cuenta**. El dueño de una cuenta ve lo suyo **con** datos de contacto; el
  partner por casa **sin** ellos, porque no es su gente.
  → [[D26-alcance-de-control]]
  - Esto **también responde** la pregunta que estaba abierta sobre *«las
    reuniones que aplican sólo al perfil de Alberto Córdoba»*: es el mismo
    mecanismo acotado a la cuenta AL. No hace falta una regla aparte.
- **Etiquetas y Log vuelven a ser iconos**, no bloques colapsables. Choca con
  §7.2 del PDF y por eso está anotado en el registro de cambios del manual.
- **Los estados de proyecto se van a poder administrar** (nombre + qué
  significa). Eso resuelve solo la discusión de *«estamos viendo el
  prototipo»*: agregar un estado deja de ser un cambio de código.

### ❓ 0.1 · La única que sigue abierta: el alcance de los destacados

**Hoy**: un mensaje destacado se marca «todas las cuentas» o con una lista de
cuentas puntuales (`AL, DL`).

**Lo que hace falta**: que Seng (la cuenta de Alberto) tenga su propio juego de
destacados, que las cinco cuentas de Globalita compartan el mismo, y que igual
se pueda clavar un mensaje a **una** cuenta.

Con el modelo de hoy eso se puede escribir —listando las cinco cuentas de
Globalita en cada mensaje— pero **cada cuenta nueva hay que agregarla a mano en
cada mensaje destacado**, y el día que alguien se olvide, esa cuenta trabaja
con menos mensajes sin que nadie se entere.

**La propuesta**: que el alcance tenga tres formas en vez de dos.

| Alcance | Qué significa |
|---|---|
| `todas` | Todas las cuentas, como hoy |
| `casa: globalita` / `casa: seng` | Todas las cuentas de esa empresa propia, **incluidas las que se agreguen después** |
| `cuentas: AL, DL` | Cuentas puntuales, como hoy |

Es exactamente el mismo patrón que el alcance de Control (D26), y por eso
conviene decidirlo igual.

**Depende de**: si una cuenta puede pertenecer a más de una casa. Hoy no:
`cuenta.linea_negocio` es un valor.

## 1 · Follow-up · columna 2 (la ficha)

### ⚠️ 1.1 · Etiquetas y Log vuelven a ser iconos, no bloques

Augusto: *«el colapsable de etiquetas no va ahí, eliminarlo de la columna dos,
eso va con un emoji al lado del perfil»*, y lo mismo para el log.

**Choca con §7.2**, que enumera *«Datos · Contacto · Fecha de reunión ·
Etiquetas · Log de ediciones · Análisis del perfil»* — seis bloques. Los pasé a
bloques hace dos días justamente por esa línea.

Gana Augusto, pero conviene que quede escrito: el manual va a decir una cosa y
la app otra.

- Etiquetas: icono al lado del perfil, con agregar y **quitar del lead** (no
  borrar del catálogo).
- Log de ediciones: icono. Y **reemplaza al tooltip** del perfil.
- Análisis del perfil: se queda como está.

### 1.2 · Enviar mensaje

- **El switch de canal tiene que mandar de verdad.** Hoy dice «enviar mensaje a
  LinkedIn» sin poder cambiarlo; el prototipo tiene el switch LinkedIn/WhatsApp
  y lo que se elige es por donde sale.
- **La secuencia en vez del desplegable de paso.** En lugar de «Paso: R2
  (toca)», una fila de chips `R0 ✓ · R1 ✓ · R2` donde lo tildado ya se mandó y
  lo que falta se ve solo. Cada uno con **el idioma en que se mandó**.
- **«Ir al chat» al lado del título** «Enviar mensaje».
- **Sacar el botón «Copiar»**.
- **Sacar los tres textos de ayuda de abajo** («al registrar se agregan…», «el
  CRM no manda el mensaje…», «el envío automático llega con el worker»).

---

## 2 · Follow-up · columna 1 (la lista)

- **De qué cuenta viene** cada perfil.
- **El último mensaje enviado**: si fue un R, decir cuál; si fue suelto, `FU`.
- **Etiquetas** en la fila.
- **El icono de WhatsApp** cuando hay teléfono. Hoy hay un icono de mensaje
  genérico que no se entiende.
- **El agente asignado**: hoy es un chip con iniciales (`SF`). Tocarlo tiene
  que abrir la lista de agentes para asignar. Con muchos, un solo icono y el
  detalle al pasar por encima.
- **Etiquetas que no entran**: mismo criterio — hover para verlas todas, y
  **poder elegir cuáles se muestran y en qué orden** cuando entran dos o tres.
- **Ancho ajustable de la columna 1 en WA Personal** (hoy sólo en Follow-up).

---

## 3 · Vencimientos

- **El próximo contacto tiene que ser editable**: clic → calendario → elegir la
  fecha. Hoy es sólo lectura.
- **Los chips de mensajes destacados no aparecen.** Depende de 0.1.

---

## 4 · Agenda

Augusto: *«tomá de referencia cómo funciona Google Calendar y copialo tal
cual»*.

- ✅ **Hecho el 08/09.** El bloque se dibuja SOBRE la columna del día, no
  dentro de la celda de su hora: una reunión de 12:00 a 14:00 ocupa las dos
  horas en vez de estirar la fila de las 12. Las dos vistas son ahora la misma
  grilla, así que la diaria también deja estirar; el bloque dice cuánto dura;
  y dos reuniones encimadas se reparten el ancho en carriles en vez de taparse.
  Geometría en `core/reunion.ts` (`bloqueDelEvento`, `horaEnLaColumna`,
  `carriles`) con sus tests.
- **Próximo contacto**: mostrar día y mes, sin año.
- **El icono de notas** tiene que ser el mismo en todos lados.
- **El link de perfil** abre el LinkedIn del lead (no Sales Navigator) — bien —
  pero en la lista de reuniones abre **con el perfil personal, no con la cuenta
  de origen del lead**. Augusto lo deja para configurar después.
- **WhatsApp con su icono**, no uno genérico.

---

## 5 · Repositorio de mensajes

La reescribí como sidebar hace dos días y **el diseño quedó mal**:

- No se ve el mensaje: la tarjeta parece colapsada.
- «destacado en *todas las cuentas*» sale cortado.
- Al abrir una tarjeta, el contenido se ve cortado.

---

## 6 · Tareas

- **Icono de notas**, el mismo de toda la app.
- Una tarea conectada a un lead tiene que **traer sus datos**: nombre, enlace a
  LinkedIn y a WhatsApp, y las notas ya cargadas.
- **Órdenes combinables**, no filtros: ordenar por vencimiento **y** por
  prioridad a la vez. Hoy están como filtros y es un nombre equivocado (lo dice
  el propio Augusto).
- **La vista de Vencimientos, también como sidebar derecho** en Tareas.

---

## 7 · Notificaciones

- Tocar una sin leer tiene que **marcarla leída**.
- Y **abrir la conversación en la columna 1**, en el canal por el que escribió.
- Estados: **leído sin responder** / **leído y respondido**.

---

## 8 · Control de proyectos

- **Administrador de estados**: hoy los siete están fijos. Poder agregar y
  editar, con **el nombre y qué significa** — la leyenda del pie sale de ahí.
  Desde Control y desde la columna 2.
- **Enlaces**: el LinkedIn de la empresa, la web de la empresa y el perfil del
  prospecto. No están, ni en Proyectos ni en Leads.
- **La cuenta de origen abreviada**: al pasar por encima, el nombre completo.
  Quien no sabe qué significa `AL` no lo entiende.
- **Sacar la columna «cantidad de reuniones»**; dejar última reunión, próximo
  contacto y fecha de la próxima.
- **La tabla es muy ancha**: hueco grande entre contacto y empresa, y espacio
  muerto a la derecha. Achicar o alinear a la izquierda.
- **Notas y comentarios** en la tabla.
- **Histórico de reuniones** con su icono.
- **Etiquetas asignadas**.

---

## 9 · Automatizaciones

- **Las tablas son muy anchas** (Cuentas de invitación, Sale hoy por cuenta,
  Métricas, Cadencia). Nombre a la izquierda y un vacío enorme a la derecha.
- **Métricas semanales por cuenta**: poder elegir semana, mes o un rango
  propio.
- **Cancelación**: la misma métrica por cuenta con el mismo selector (semana,
  mes, trimestre, semestre, año), y agregar **última ejecución, cuántos se
  mandaron y en qué fecha**, por cuenta.
- **La cadencia R0–R8 va al final** del panel, y hay que poder **agregar
  fases**.
- **«Cuándo responden»**: franjas de dos o tres horas, más finas que las
  cuatro actuales.
- Pensar qué otros datos vale la pena sumar al análisis.

---

## 10 · WA Personal

- **Acceso rápido a los números que no están agendados**, poder agendarlos y
  poder pasarlos a Follow-up.
- **Regla que hay que respetar**: todos los chats empiezan en WA Personal;
  cuando el contacto está en Follow-up **se ve sólo ahí**. WA Personal es
  personal.
- **Revisar el ancho** y que la columna 1 se pueda agrandar y achicar.

---

## 11 · Usuarios

- ✅ **Hecho el 08/09.** El alta manda un correo con el usuario y un enlace de
  un solo uso para elegir la contraseña (§6.7). Ni el administrador ve ni fija
  la clave de nadie. Incluye reenviar la invitación y reiniciar la contraseña
  desde la ficha.
  - **Falta configurar el SMTP de Hostinger** para que salga de verdad: está en
    `deploy/PASO-A-PASO.md`, paso 4.5. Hasta entonces, dar de alta falla y lo
    dice; no crea a nadie a medias.
- **Editar los permisos de cada rol** y que queden como preset: al invitar a
  alguien como colaborador ya sabe qué permisos trae.
- Y **después** poder ajustarlo persona por persona (esto ya funciona).

---

## 12 · Transversal

- **Traducción al portugués** de todo el CRM.

---

## 13 · El worker: lo único que hace que el CRM *actúe*

**`apps/worker/` está vacío.** Hoy el CRM registra lo que hacés a mano; no manda
un mensaje ni invita a nadie. Es la Etapa 5 del manual y la que el propio manual
marca como *«la de más riesgo técnico»* (§8.1).

| | Estado |
|---|---|
| **Cola del lado del servidor** (§10.16) | La colección está, la pantalla la muestra, la cuenta regresiva corre — **y nadie la procesa** |
| **LinkedIn** (§8.1) | No existe. Todos los envíos llevan `a_mano: true` |
| **WhatsApp** (§8.2) | No hay sesión ni QR real. No llegan entrantes ni acks |
| **Google Calendar** (§8.3) | Los hooks están escritos, la cuenta no está conectada: las reuniones tienen `sync: "omitida"` |

Empezado: el cálculo del turno se extrajo a `core/cola.ts` (`turnosDeLote`,
`queSale`) para que el worker y la pantalla den **el mismo** turno.

---

## 14 · Lo que sigue esperando a Augusto

- **El alcance de los destacados** (0.1). Es la única decisión abierta.
- **«Estamos viendo el prototipo»**: se resuelve solo cuando exista el
  administrador de estados (8). Queda la pregunta de si un proyecto puede estar
  en dos situaciones a la vez —*viendo el prototipo* **y** *esperando
  presupuesto*—; si la respuesta es sí, hace falta etiqueta de proyecto además
  del estado.

---

## 15 · Producción

- ⚠️ **Hay datos reales adentro del bundle, y el repo es público.**
  `docs/_bundle/CRM de prospeccion.html` está commiteado y trae un documento
  con teléfonos y un email de personas reales. No se leen abriendo el archivo
  —es un ZIP— pero cualquiera que clone el repo y corra
  `node docs/desempacar.mjs` los tiene. La copia suelta que había en `docs/`
  ya estaba enmascarada; la de adentro del bundle no.
  **Arreglarlo**: re-exportar el bundle con los datos enmascarados. Y decidir
  aparte —es tu decisión, no mía— si vale la pena reescribir el historial:
  reescribirlo rompe los clones y los links a commits viejos, y el dato ya
  estuvo público de todos modos.
- **El deploy no se hizo.** `deploy/publicar.sh` necesita la IP del VPS.
- **Backups del VPS.** El backup actual depende de que la PC esté prendida, y
  `globalita-data` no está en GitHub. Un snapshot del proveedor cubre lo que el
  esquema de tres copias no cubre: que se rompa el servidor, no la PC. No
  reemplaza al backup a GitHub — devuelve la máquina, no el historial.

---

## 16 · La auditoría, ciclo 4

Ciclos 1 a 3 cerrados. Queda revisar contra el prototipo: `FollowupDetalle`,
`Login`, `ColaEnvios`, `ImportarCsv` y `BaseCompartida`. El método está montado
como script y se vuelve a correr solo.

---

## Nota sobre el orden

Casi todo lo de arriba es de **pantalla**, y lo de 13 es **la mitad del
producto que no existe**. Mi recomendación sigue siendo cerrar 0 (las
decisiones), después 13 (el worker), y meter lo de pantalla en el medio por
tandas — empezando por lo que está roto (5, 4, 3) antes que por lo que falta.
