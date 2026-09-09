# Registro de errores

Todo lo que salió mal en este CRM, con de dónde vino y cuántas veces volvió.

**Para qué sirve.** No es una lista de culpas: es el material del que salen las
reglas de `CLAUDE.md` y los chequeos de `docs/revisar-aprendizajes.mjs`. Un
error que aparece una vez es un descuido; uno que aparece cinco es una regla
que falta. La columna que importa es **cuántas veces**.

**Cómo se hizo.** Reconstruido desde el historial de git (134 commits), los
logs de PocketBase y la base, el 09/09/2026. No de memoria.

**Cómo se comprueba.** `node docs/revisar-aprendizajes.mjs` vuelve a buscar los
que se pueden buscar solos. Al 09/09/2026 **no aparece ninguno**.

---

## El tablero

| # | Familia | Veces | ¿Se puede chequear solo? | Estado |
|---|---|---|---|---|
| 1 | Borrar datos sin que nadie lo pida | **1** (10 ejecuciones) | no | cerrado con regla |
| 2 | El contraste de la agenda | **6** | sí · B | cerrado |
| 3 | Una regla vieja pisando a la nueva | **3** (14 reglas) | sí · C | cerrado |
| 4 | Un control nuevo en vez del que ya existe | **5** | sí · D | cerrado |
| 5 | El scope de los handlers de PocketBase | **2** | sí · E | cerrado |
| 6 | Programar contra el modelo imaginado | **6** | **no** | práctica |
| 7 | Pedir la misma cosa en dos lugares | **5** | no | práctica |
| 8 | Decidir por el usuario | **3** | no | práctica |
| 9 | Trampas de las APIs | **3** | no | documentado |
| 10 | Datos reales en un repo público | **1** | parcial | cerrado |
| 11 | No había dónde guardarlo | **1** (pedido 4 veces) | no | cerrado |

**35 incidentes.** Los cuatro que se pueden mecanizar son los que más se
repitieron: 16 de los 35.

---

## 1 · Borrar datos sin que nadie lo pida

> **1 vez · 10 ejecuciones · 546 registros perdidos**

**El problema.** El 08/09/2026 se corrió `node packages/db/dev.mjs --reset`
unas diez veces mientras se trabajaba en otra cosa. Se perdieron los **248
contactos y las 298 reuniones** que Augusto había importado. Nadie se dio
cuenta hasta que él preguntó, **dos días después**.

**De dónde vino.** De tratar un comando destructivo como parte de la rutina de
«reiniciar el entorno». Nadie lo pidió. La instrucción de fondo era «seguí
trabajando», y eso se leyó como permiso para hacer, cuando era permiso para
hacer, no para borrar.

**Cómo se resolvió.** Commit `76d3e86`:

- `--reset` **se niega solo** cuando hay datos que no son de demo.
- Copia obligatoria antes de tocar nada, siempre.
- Para arrancar limpio se usa **otra carpeta**: `PB_DATOS=.pb/pb_data_limpia`.
- Es la **primera sección de `CLAUDE.md`**, antes que cualquier otra cosa.

**Cómo está hoy.** 27 copias fechadas en `.pb/copias/`, una copia por hora en
`~/globalita-backups/crm/` y dos copias fuera de la máquina en Drive.

---

## 2 · El contraste de la agenda

> **6 vueltas.** El error más caro del proyecto, y el que más tardó en verse.

Augusto lo reportó tres veces con las mismas palabras —«los colores son muy
tenues»— y las tres primeras respuestas fueron arreglos del lugar equivocado.

| # | Qué se hizo | Por qué no alcanzó |
|---|---|---|
| 1 | Doce franjas del mismo blanco separadas por medio píxel | Para saber si un bloque caía a las 11 o a las 12 había que contar desde arriba |
| 2 | Se agregó una banda alterna por hora, en `--bg` | **`--bg` era el color de los eventos**: el bloque y el fondo eran el mismo beige y el evento desaparecía |
| 3 | Se sacaron las bandas, columna clara y bloques sólidos | Iba bien, pero seguía sin ser la causa |
| 4 | — | **Tres reglas de la versión pálida habían quedado después de las nuevas** y ganaban: el hover devolvía el bloque a `--info-light` con el nombre en `--text`. Texto oscuro sobre fondo oscuro |
| 5 | Se midió | **La causa real**: `--surface` (#FAF7F1) sobre `--success-light` (#E8F5EB) = **1.1:1**, cuando lo mínimo legible es 4.5:1. En **tres de los cuatro estados** el nombre de la reunión era invisible |
| 6 | Los cuatro estados sólidos | El ámbar no daba: `--warning` con texto blanco queda en **4.38:1**. Lo encontró el chequeo automático, no una persona |

**De dónde vino.** De dos cosas, y la segunda es la grave:

1. **Buscar el contraste en el fondo y no en el bloque.** El contraste de una
   agenda no sale de la columna: sale de los bloques. Los tres primeros
   intentos jugaron con el fondo.
2. **Nunca calcular el número.** «Se ve tenue» se trató como una opinión de
   diseño durante tres rondas. Era una medición: 1.1:1. Un minuto de cuenta lo
   habría cerrado la primera vez.

**Cómo se resolvió.**

- Los cuatro estados con contraste **calculado**: programada 5.80:1, asistió
  6.19:1, no asistió 6.05:1.
- **Cancelada va al revés** —fondo claro, texto oscuro, 12.83:1— y no por
  capricho: es la única de las cuatro donde la reunión **no pasó**, así que no
  tiene por qué gritar como las tres que sí ocurrieron.
- Lo que **no** era una reunión dejó de gritar: el almuerzo y el focus time
  estaban sólidos en el gris más oscuro de la paleta y le peleaban atención a
  las reuniones. Van rayados. **No era que las reuniones fueran tenues: era
  que todo gritaba igual.**
- Chequeo **B** en `revisar-aprendizajes.mjs`.

**La lección, en una línea.** Cuando alguien dice «no se ve», medilo antes de
opinar.

---

## 3 · Una regla vieja pisando a la nueva

> **3 veces · 14 reglas muertas**

**El problema.** Una regla de CSS queda declarada dos veces. La segunda gana
por venir después en el archivo, así que la primera **no se aplica nunca** —
pero sigue ahí, leyéndose como si hiciera algo.

| # | Dónde | Cuántas |
|---|---|---|
| 1 | `.agenda-evento-calendario` — el hover pálido pisando al sólido | 3 reglas |
| 2 | La auditoría del 09/09: `.cc-aviso`, `.fila-reunion` y sus tres variantes, `.repo-vacio`, `.repo-destacar`, `.repo-alcance`, `.agenda-hora-col`, `.usuario-rapidos` | 11 reglas |
| 3 | `.agenda-evento-cancelada .agenda-evento-hora`, el mismo día | 1 — **atajada por el chequeo antes de subirla** |

**De dónde vino.** De editar **agregando al final del archivo** en vez de
modificar la regla que ya existe. Con 6.500 líneas de CSS escritas en tandas,
buscar la regla original cuesta más que escribir una nueva abajo — y funciona,
hasta que alguien vuelve a tocar la de arriba.

**Cómo se resolvió.** Chequeo **C**: agrupa por selector y avisa cuando el
mismo selector declara la misma propiedad con dos valores distintos. Eran 8,
quedaron 0. Se borraron las muertas y no se tocaron las que ganaban, así que
no cambió nada en pantalla.

**Nota.** Este error es el que hizo invisible el error 2 durante una vuelta
entera. Los errores se tapan entre ellos.

---

## 4 · Un control nuevo en vez del que ya existe

> **5 veces**

**El problema.** Construir a mano un control que el producto ya tiene.

| # | Qué pasó | Cómo se veía |
|---|---|---|
| 1 | El switch de canal | Un rectángulo de 3px con **azul de marca**, cuando el CRM es verde y todo tiene radio 8px |
| 2 | El checklist de permisos | Un `<input type=checkbox>` del navegador, que **en Windows sale azul** |
| 3 | El punto de sin leer | `15px`, cuando la escala del producto es 9/10/11/12/13/14/17 |
| 4 | El chevron de la hora | `8px`, por debajo del piso de la escala |
| 5 | Los fondos de los overlays | `rgba(0,0,0,.45)` escrito a mano, más un token `--rule-fuerte` **que no existe en ningún lado** y siempre caía en el fallback |

**De dónde vino.** De escribir el CSS nuevo sin abrir antes el prototipo ni los
tokens. Cada uno funcionaba; el problema es que juntos hacían que el producto
se viera de tres productos distintos.

**La regla que dictó Augusto**, y que quedó en `CLAUDE.md`:

> «Cada funcionalidad que hagas nueva en la UI tiene que respetar la estética
> del producto, no puede desarrollarse nada por fuera de ahí.»

**Cómo se resolvió.** El switch y el idioma pasaron a `.selector-idioma`, el
control segmentado del resto del CRM; los permisos usan el mismo tilde que el
repositorio de mensajes. Y el chequeo **D**, que busca solo los tamaños fuera
de escala, los colores literales y los tokens fantasma. Eran 5, quedaron 0.

---

## 5 · El scope de los handlers de PocketBase

> **2 veces**

**El problema.** Los handlers de PocketBase corren en un runtime JS aislado y
**no ven el scope del archivo**. Una constante declarada arriba existe al
cargar el archivo y desaparece cuando el handler corre.

1. Documentado en `google.js` la primera vez.
2. Repetido en `abrir.pb.js`: la lista `DOMINIOS` estaba al nivel del archivo, y
   **toda llamada moría con un 400 genérico** que no decía por qué.

**De dónde vino.** De que la trampa ya estaba escrita en un comentario del
repositorio y no se leyó antes de escribir el segundo handler. Documentar no
alcanza si nadie vuelve a leerlo.

**Cómo se resolvió.** Todo lo que usa un handler se declara **adentro** o se
`require` adentro. Y el chequeo **E**, que lee cada archivo de `pb_hooks/`,
busca lo declarado al nivel del archivo y avisa si un handler lo usa.

---

## 6 · Programar contra el modelo imaginado, no contra los datos

> **6 veces.** El que más se repite de los que **no** se pueden automatizar.

**El problema.** Escribir una regla contra cómo uno cree que son los datos, y
no contra cómo son.

| # | Qué se supuso | Qué eran los datos |
|---|---|---|
| 1 | Que `lead.asignado` tenía el dueño de la reunión | Estaba **vacío en los 242 leads**. Toda reunión nueva moría con «el lead no tiene a nadie asignado» |
| 2 | Que un título de prospección es «Nombre / Cuenta / Augusto» | El calendario usa las dos formas desde antes del CRM, y «Rodrigues **-** Augusto» quedaba afuera: **media agenda** |
| 3 | Que «Manual 35f9q8» eran eventos fantasma | Eran **7 reuniones reales** con fecha, cuenta y correo del invitado. Borrarlas perdía siete reuniones |
| 4 | Que `updated` sirve para ordenar chats por hora | `updated` es cuándo se tocó la fila, y marcar leído la toca: los chats salían 08:12, 11:24, 17:40, 10:45 |
| 5 | Que la × del chip sacaba el chip | Llamaba a `sinCuenta()`, que con un alcance por casa devuelve el alcance **intacto**, a propósito. La × no hacía nada |
| 6 | Que los huecos libres se calculan sobre lo que se ve | Se calculaban sobre los eventos **filtrados**: con el filtro en «BR» aparecía «2 h libre» encima de una reunión de AL |

**De dónde vino.** De implementar sin consultar la base primero. Los seis se
habrían visto con una consulta de treinta segundos.

**Por qué no se puede automatizar.** Ningún script sabe qué esperabas. La única
defensa es la práctica: **antes de escribir una regla sobre los datos, contarlos
contra la base.** Todos los números de `PENDIENTES.md` salen de consultas por
eso.

---

## 7 · Pedir la misma cosa en dos lugares

> **5 veces**

1. **El teléfono**: un chip vacío para escribirlo a mano **y** un botón aparte
   para conectarlo. Augusto no encontró el botón — estaba debajo del
   desplegable. Ahora **el chip vacío ES el botón**.
2. **El bloque de abajo de la ficha** repetía R0 y R1 con nombre completo y
   tenía su propio botón de destacados.
3. **El triage de números desconocidos** en WA Personal separaba «ya están en la
   base» de «no están» — y la lista de chats ya tenía esos números con un
   filtro que los deja solos.
4. **El «5 de 5»**: cada interruptor ya traía su conteo.
5. **El selector ES/PT/EN** en el encabezado: el idioma ya viaja con el chip
   desde que se destaca, así que era una pregunta ya contestada.

**De dónde vino.** De agregar lo nuevo **al lado** de lo viejo en vez de
reemplazarlo. Es lo más fácil de hacer y lo más difícil de ver después, porque
las dos cosas funcionan.

**La práctica.** Cuando se agrega una forma de hacer algo, se busca si ya
había otra. Si la hay, una de las dos se va en el mismo commit.

---

## 8 · Decidir por el usuario

> **3 veces**

1. **Once chips fijos** R0–R8, «reinvitar» y «gracias» aparecían quisiera uno o
   no. Augusto: *«todo esto se elimina, yo elijo qué es lo que queda
   guardado»*. Los pasos de la cadencia son una regla del sistema; **cuáles
   tener a mano es de quien escribe**.
2. **Diez plantillas destacadas de fábrica**, con alcances que nadie eligió.
   Un destacado es una decisión; precargarlos es adivinarla, y encima mal.
3. **El flujo de destacar al revés**: la lista primero, el alcance al final. Se
   elegía el mensaje a ciegas. Ahora son tres pasos en el orden en que se
   piensan: idioma → dónde vale → cuáles.

**De dónde vino.** De confundir «tener un valor por defecto» con «tener la
respuesta». Un default está bien cuando la pregunta tiene una respuesta obvia;
acá no la tenía.

---

## 9 · Trampas de las APIs

> **3 veces.** No son errores de criterio: son cosas que la documentación no
> dice y se aprenden chocando. Quedan acá para no volver a chocar.

1. **`singleEvents=true` sin `timeMax`.** Google expande los eventos
   recurrentes **al infinito**: traía 5.000 eventos cada cinco minutos y el
   `syncToken` no se obtenía nunca. Va con una ventana acotada.
2. **El correo de la cuenta venía vacío.** `userinfo` necesita el scope `email`
   que no pedimos —y pedirlo obligaría a reconectar a todos—. Se resuelve
   leyendo `GET /calendars/{id}`: **el id del calendario ES el correo**.
3. **`UNION` suelto en una vista de PocketBase.** No puede deducir los campos:
   muere con «invalid identifier parts» y **la base no arranca**. Va envuelto
   en una subconsulta. PocketBase estuvo caído un minuto.

**Además, dos que conviene tener presentes:**

- PocketBase devuelve **404 con «sql: no rows in result set»**, no 403, cuando
  una regla de API no coincide. Parece que el registro no existe.
- El SQL plano (`$app.db().newQuery`) **no dispara los hooks**. Es lo que
  evita el eco infinito al sincronizar desde Google, y es a propósito.

---

## 10 · Datos reales en un repo público

> **1 vez**

**El problema.** El repositorio `Augustomu/CRMGlobalita` es **público**, y el
bundle del prototipo tenía **6 teléfonos, 2 nombres y 1 correo** de contactos
de verdad, usados como datos de ejemplo en las maquetas.

**De dónde vino.** Las maquetas se exportan con lo que haya en pantalla, y en
pantalla había datos reales.

**Cómo se resolvió.** Se reemplazaron por inventados y se reescribió el
historial de git: el bundle viejo ya no está en ningún commit del remoto,
verificado después del push. `docs/enmascarar.mjs` lo deja resuelto para la
próxima exportación —**va a volver a pasar**— y compara contra la base en vez
de adivinar: sin base **se niega a correr** antes que dar un falso «está
limpio».

**Lo que sigue siendo cierto.** GitHub puede conservar el objeto viejo un
tiempo aunque ya no lo alcance ninguna rama. Y **lo que estuvo público, estuvo
público**: esto corta hacia adelante, no borra lo que alguien ya haya clonado.

---

## 11 · No había dónde guardarlo

> **1 error · pedido 4 veces**

**El problema.** Augusto pidió cuatro veces poder **conectar un evento del
calendario con un lead**. Las cuatro se respondió sobre la pantalla. Recién a
la cuarta se miró el esquema: `evento_externo` **no tenía campo `lead`**. No
había dónde guardar el vínculo.

**De dónde vino.** De tratar un pedido como un problema de interfaz sin
verificar si el modelo lo soportaba. Es el error 6 con otra cara.

**Cómo se resolvió.** Migración `1788604000_evento_con_lead` y la pantalla
encima. Y **por persona, no por evento**: son 278 eventos sueltos pero 145
personas, y dos de ellas se llevan 83 eventos.

**La lección.** Cuando algo se pide más de una vez, el problema no es el pedido:
es que la respuesta anterior no fue a la causa.

---

## Los cuatro chequeos

`node docs/revisar-aprendizajes.mjs` — sale con código 1 si encuentra algo.

| | Qué busca | Familia |
|---|---|---|
| **B** | Contraste por debajo de 4.5:1 en las parejas fondo/texto que conviven | 2 |
| **C** | El mismo selector declarando la misma propiedad dos veces | 3 |
| **D** | Tamaños fuera de escala, colores literales, tokens que no existen | 4 |
| **E** | Handlers de PocketBase que usan algo del scope del archivo | 5 |

**B se mantiene a mano y es a propósito.** Se intentó primero cruzar fondos y
colores automáticamente: da **83 avisos y casi todos son falsos**, porque sin
un DOM el script no sabe qué elemento está dentro de cuál ni qué regla gana por
especificidad. Un chequeo que grita 83 veces no lo corre nadie, y eso es peor
que no tenerlo. Así que las parejas se declaran: **un bloque de color nuevo
suma una línea a la tabla**, y si un selector deja de existir el chequeo avisa
en vez de callarse — ya pasó una vez, el mismo día que se escribió.

**Lo que ningún chequeo puede ver** son las familias 6, 7 y 8, que son 14 de
los 35 incidentes. Ésas no son de código: son de mirar los datos antes de
escribir la regla, buscar si eso ya existía en otro lado, y no contestar una
pregunta que le toca al usuario.
