# Pendientes

Lo decidido y todavía no hecho. La especificación —cómo tiene que ser— está
entera en `docs/MANUAL.md`. Acá va sólo el control de qué falta.

Última revisión: **09/09/2026**, verificada contra el código y contra la base,
no de memoria.

> **Cómo leer esto.**
> `[x]` hecho y verificado · `[ ]` falta · `[~]` a medias
> ⚠️ está mal hoy (no es una ausencia) · ❓ necesita una decisión de Augusto
> 🔒 bloqueado por algo que no es código

---

## Tablero

| Bloque | Hecho |
|---|---|
| 0 · Bugs vivos | 1 de 5 |
| 1 · Ficha (columna 2) | 0 de 5 |
| 2 · Mensajes destacados | 0 de 2 |
| 3 · Lista (columna 1) | 0 de 3 |
| 4 · Estados de proyecto | 0 de 2 |
| 5 · Usuarios | 0 de 3 |
| 6 · WA Personal | 0 de 3 |
| 7 · Agenda y Calendar | 2 de 7 |
| 8 · Integraciones y worker | 1 de 5 |
| 9 · Producción | 1 de 4 |
| 10 · Los datos | 5 de 10 |

**El orden que conviene**: bloque 0 (lo que hoy miente en pantalla), después 1 y
3 (lo que se toca todos los días), después 7 (Calendar, que ya está conectado y a
mitad de camino), y recién ahí el worker (bloque 8), del que cuelga el resto.

---

## 0 · Bugs vivos — lo que hoy está mal

- [ ] ⚠️ **«Cuentas conectadas» miente.** Dice *5 LinkedIn · 5/7 WhatsApp* y
      **no hay ninguna sesión real**. Los estados salen de `cuenta.estado_sesion`
      y `cuenta.sesion_wa`, que son valores del seed de demo. Verificado contra
      la base: cinco en `activa`, una en `caida`, una en `sin_vincular`, todas
      inventadas.
      **Cómo se arregla bien**: el estado no puede ser un campo que alguien
      escribió una vez; tiene que salir de la sesión de verdad (el worker) y
      llevar fecha de última señal. Mientras el worker no exista, lo honesto es
      que **todas digan «sin vincular»** y que la pantalla diga por qué.
- [ ] ⚠️ **El switch de canal en Enviar mensaje no manda.** Hoy el canal lo
      calcula `canalDe()` desde la cadencia y la pastilla sólo lo informa.
      Se arregla junto con 1.2.
- [ ] ⚠️ **Tareas muestra las de todos.** `Tareas.tsx` pide la colección entera
      sin filtrar por `usuario`: un colaborador ve —y puede borrar— las del
      administrador.
- [ ] ❓ **El link de perfil abre con el perfil personal**, no con la cuenta de
      origen del lead. Se decide junto con 7.7 (qué Chrome abre qué).
- [x] **La sincronización con Google no llegaba nunca.** `sincronizar()` elegía
      el calendario mirando sólo `lead.asignado`, vacío en los 242 leads.

---

## 1 · Ficha del lead — columna 2

- [ ] **1.1 · Sacar el botón de WhatsApp del header.** Está en
      `FichaLead.tsx:513`. Ir al chat pasa a ser una sola acción, abajo.
- [ ] **1.2 · Switch LinkedIn/WhatsApp + botón «ir al chat» en Enviar mensaje.**
      El botón es una flecha en diagonal hacia arriba (↗) y **respeta el
      switch**: en LinkedIn abre LinkedIn, en WhatsApp abre WhatsApp. Esto
      reemplaza el bug del canal que no manda: el switch pasa a decidir de
      verdad, no a informar.
- [ ] **1.3 · Una sola fila de R.** Todos los pasos R0…R8 juntos, con tilde los
      enviados y sin tilde los que no, **más un hueco para agregar un chip de
      mensaje destacado**.
- [ ] **1.4 · Borrar el bloque de abajo.** Hoy repite R0 y R1 con el nombre
      completo y tiene otro botón de destacados. Se va entero: quedan sólo los
      títulos cortos, `R1`, `R2`, `R3`.
- [ ] **1.5 · El idioma, en dos letras al lado de «Enviar mensaje»**: `PT`, `EN`,
      `ES`. Sin la palabra «idioma» adelante.

---

## 2 · Mensajes destacados

- [ ] **2.1 · Preguntar el alcance al destacar.** Hoy destaca sin preguntar.
      Tiene que ofrecer **sólo este perfil / toda la cuenta (ej. Bruno) / todas
      las cuentas**. El modelo ya lo soporta (`estaDestacadaPara` y
      `escribirAlcance`, `EnviarMensaje.tsx:114-136`); falta el paso que pregunta.
- [ ] **2.2 · Filtrar por idioma del chat por defecto.** Al agregar un destacado,
      mostrar los del idioma configurado en ese chat. Si se cambia el idioma, la
      lista cambia sola.

---

## 3 · Lista de contactos — columna 1

- [ ] **3.1 · El icono de WhatsApp, sólo si hay WhatsApp.** Hoy aparece en gris
      cuando no hay. Si no hay número, no va nada.
- [ ] **3.2 · Sin próximo contacto: vacío**, sin texto de relleno.
- [ ] **3.3 · La fecha de la última reunión, con color**: verde si asistió, rojo
      si no asistió, gris si todavía no pasó.

---

## 4 · Estados de proyecto

- [ ] **4.1 · Hoy no hay dónde editarlos**, y por eso Augusto no los encontró:
      los siete están fijos en `core/proyecto.ts` (`ESTADOS_ACTIVOS`,
      `ESTADOS_CERRADOS`). No existe pantalla.
- [ ] **4.2 · Administrador de estados**: crear, editar y borrar, con **nombre y
      qué significa cada uno** — la leyenda del pie sale de ahí (§3.13.2 del
      manual). Accesible desde Control y desde la ficha del lead.

---

## 5 · Usuarios

- [ ] **5.1 · Permisos visibles y editables al dar de alta.** Al elegir rol
      (administrador / colaborador / observador) tiene que mostrarse **la lista
      completa de permisos de ese preset**, y poder tocarlos para esa persona.
      Lo que se cambia queda marcado como **permiso especial**, para que se vea
      que esa persona no tiene el preset puro.
- [ ] **5.2 · El correo, debajo del perfil en la columna 1.** Hoy está en el
      header.
- [ ] **5.3 · «Reiniciar contraseña» junto a «Eliminar»**, en el box de accesos
      rápidos de la columna 1.

---

## 6 · WA Personal

- [ ] **6.1 · Filtro rápido de contactos no agendados**: los que están en el
      teléfono y no existen como lead.
- [ ] **6.2 · Marcar personal / trabajo**, como filtro.
- [ ] **6.3 · Leído / no leído.** Sin más vueltas: son amigos y familia, no hay
      cadencia ni estados.

---

## 7 · Agenda y Google Calendar

- [x] **7.1 · Conectado.** `augustou@globalita.io`, con `refresh_token` guardado.
      El correo se resuelve leyendo el id del calendario, sin pedir el alcance
      `email` —que habría obligado a reconectar a todos—.
- [x] **7.2 · Sincronización de ida y vuelta.** El CRM escribe en Google (y le
      avisa al lead, `sendUpdates=all`) y un reloj cada cinco minutos trae lo que
      cambió allá. En la primera corrida real **corrigió 65 duraciones**: el
      importador había puesto 30 minutos por defecto y las reuniones eran de 45,
      60 y 20.
- [ ] **7.3 · Traer TODOS los eventos del calendario, no sólo las reuniones del
      CRM.** Hoy la agenda dibuja lo que está en `reunion`; Augusto quiere ver su
      día y su semana completos, como en Google. Es una fuente de eventos nueva:
      los que no son leads existen para no agendar encima.
- [ ] **7.4 · La vista Lista, desde septiembre del año pasado.** Hoy sólo está lo
      importado; hay que traer el histórico completo del calendario.
- [ ] **7.5 · Una fila por lead en Lista, con la última reunión.** Si con la
      misma persona hubo cinco reuniones se muestra **una sola** —la última— y
      las otras cuatro viven en el histórico de esa ficha. Hoy la vista ya ordena
      de la más nueva a la más vieja, pero no agrupa.
- [ ] **7.6 · Confirmar asistencia de las pasadas.** Las 173 en `sin_dato` tienen
      que poder marcarse asistió/no asistió, y las pasadas mostrarse
      **archivadas**: son historia, no pendientes.
- [ ] ❓ **7.7 · «Abrir» tiene que usar un Chrome específico**, el que tiene la
      sesión de LinkedIn de Augusto. Un navegador no se elige desde una página
      web: hace falta que lo abra el worker o un handler local. **Falta decidir
      cómo.**

---

## 8 · Integraciones y worker

- [x] **8.1 · Google Calendar** (bloque 7).
- [ ] 🔒 **8.2 · `apps/worker/` está vacío.** Es la mitad del producto que no
      existe: hoy el CRM registra lo que se hace a mano, no manda un mensaje ni
      invita a nadie. De acá cuelgan LinkedIn, WhatsApp, el estado real de las
      sesiones (bloque 0) y el Chrome de 7.7.
- [ ] 🔒 **8.3 · LinkedIn.** Augusto tiene que pasar **las URLs de los perfiles**
      y **cuál es el Chrome que tiene conectado**. Sin eso no se puede empezar.
      Es donde está el 90% de la operación y lo que completa empresa e industria.
- [ ] 🔒 **8.4 · Las listas de prospección.** Las tiene que pasar Augusto.
- [ ] 🔒 **8.5 · WhatsApp con Baileys.** Una sola cuenta, según Augusto.

---

## 9 · Producción

- [x] **9.1 · Los datos reales salieron del bundle y del historial.** Eran 6
      teléfonos, 2 nombres y 1 correo de contactos de verdad, usados como
      datos de ejemplo en las maquetas. Se reemplazaron por inventados y el
      historial de git se reescribió: el bundle viejo ya no está en ningún
      commit del remoto, verificado después del push.
      `docs/enmascarar.mjs` lo deja resuelto para la próxima exportación —
      va a volver a pasar, porque las maquetas salen con lo que haya en
      pantalla—: compara contra la base en vez de adivinar, y sin base se
      niega a correr antes que dar un falso «está limpio».
      ⚠️ **Dos cosas siguen siendo ciertas.** GitHub puede conservar el
      objeto viejo un tiempo aunque ya no lo alcance ninguna rama; para
      borrarlo del todo hay que pedírselo a su soporte. Y lo que estuvo
      público, estuvo público: esto corta hacia adelante, no borra lo que
      alguien ya haya clonado.
- [ ] **9.2 · SMTP de Hostinger** (`deploy/PASO-A-PASO.md`, paso 4.5). Sin eso,
      dar de alta a alguien falla.
- [ ] **9.3 · El deploy no se hizo.** `deploy/publicar.sh 45.90.108.64` necesita
      el visto bueno de Augusto. Las credenciales de Google van en
      `/etc/crm-globalita.env` con `chmod 600`, nunca en el repo.
- [ ] **9.4 · Backups del VPS.** Un snapshot del proveedor cubre lo que las tres
      copias no cubren: que se rompa el servidor, no la PC.

---

## 10 · Los datos

Contado contra la base, no de memoria.

- [x] **Los cruces Calendar ↔ WhatsApp están hechos.** 76 perfiles absorbidos,
      **75 leads con teléfono** donde a la mañana había 2.
- [x] **Integridad verificada**: ningún lead cuelga de un perfil absorbido,
      ninguna reunión sin lead, ningún lead sin perfil.
- [x] **La separación de perfiles funciona**: se usó 5 veces.
- [x] **El slot 1 es Alejandro**, no Alberto. Corregido con migración.
- [x] **Las 288 reuniones tienen `calendario`.**
- [ ] **Quedan 2 en la bandeja de Duplicados**: el par «Jorge» / «Jorge Lara
      Huerta», que necesita separarse antes de fusionar.
- [ ] ⚠️ **6 perfiles todavía juntan a dos personas**: Luiz, Jorge, Carlos, Juan,
      Ricardo y Wellington tienen leads con correos distintos.
- [ ] ⚠️ **Los leads de WhatsApp no tienen correo, y no lo tienen en ningún
      lado.** Los dos CSV son exports de Google Contacts de 19 columnas y ninguna
      es de correo: cero `@` en las 248 filas. No se perdió al importar, nunca
      estuvo. Sale de otra exportación o del scan de LinkedIn.
- [ ] **Limpieza de demo**: 12 tareas del seed, 11 actividades, y 2 leads de
      prueba míos («Prueba Alta 41577», «Nueva Persona 09271»).
- [ ] ❓ **`AC` (Alberto Córdova) no existe como cuenta.** Si alguna vez hay leads
      suyos, hay que crearla con su cupo y línea de negocio.

---

## Deuda técnica anotada

- ⚠️ **Una regla del repo está escrita dos veces, y es la única.**
  `cambioDeGoogle()` vive en `core/sincronizar.ts` con nueve tests, y
  `pb_hooks/google.js` tiene un espejo en JavaScript plano porque el motor JS de
  PocketBase no puede cargar TypeScript. Lo que impide que se separen es
  `espejo-del-hook.test.ts`, que carga el archivo del hook de verdad y le exige
  la misma respuesta en diez casos. **Si se toca una, se tocan las dos.** La
  salida limpia sería un paso de build que compile core a JS para los hooks.
- **No hay login de pruebas.** Al borrar `alberto@globalita.test` se perdió la
  sesión con la que se verificaban las pantallas: las comprobaciones visuales las
  tiene que hacer Augusto hasta que haya un usuario de pruebas.
- **La cuenta `_superusers` falla todos los días.** En los logs hay
  `auth-with-password` con `invalid login credentials` a las 03:00, 05:44, 06:00
  y 15:00. Algo automático intenta entrar con una clave que no es. Hay que
  encontrar qué.
